'use strict';

const crypto = require('crypto');
const express = require('express');
const auth = require('../auth');
const db = require('../db');
const cfg = require('../config');
const { upload, saveUpload, httpError } = require('../uploads');
const { createNotification, emitNotification } = require('../notifications');
const { getIO } = require('../realtime');

const router = express.Router();

const ORDER_STATUSES = ['awaiting_payment', 'payment_review', 'confirmed', 'in_progress', 'delivered', 'completed', 'cancelled'];

function productRow(p) {
  return {
    id: p.id, name: p.name, price_cents: p.price_cents, category: p.category,
    platforms: p.platforms, tagline: p.tagline, description: p.description,
    includes: p.includes, audience: p.audience, active: p.active,
  };
}

// ── Public catalog ─────────────────────────────────────────────────────────
router.get('/products', async (req, res, next) => {
  try {
    const rows = await db.query(
      'SELECT * FROM products WHERE active = TRUE ORDER BY sort_order, name'
    );
    res.json(rows.map(productRow));
  } catch (err) { next(err); }
});

// ── Orders: list (streamer sees only their own; owner sees all) ────────────
router.get('/orders', auth.requireAuth, async (req, res, next) => {
  try {
    const orders = await db.withUser(req.user, async (q) => {
      const where = req.user.role === 'owner' ? '' : 'WHERE o.streamer_id = $1';
      const params = req.user.role === 'owner' ? [] : [req.user.id];
      return q(
        `SELECT o.*, p.name AS product_name, p.platforms AS product_platforms
         FROM orders o JOIN products p ON p.id = o.product_id
         ${where}
         ORDER BY o.created_at DESC`,
        params
      );
    });
    res.json(orders);
  } catch (err) { next(err); }
});

// ── Order detail with payment history ──────────────────────────────────────
router.get('/orders/:id', auth.requireAuth, async (req, res, next) => {
  try {
    const order = await db.withUser(req.user, async (q) => {
      const where = req.user.role === 'owner'
        ? 'WHERE o.id = $1'
        : 'WHERE o.id = $1 AND o.streamer_id = $2';
      const params = req.user.role === 'owner' ? [req.params.id] : [req.params.id, req.user.id];
      const rows = await q(
        `SELECT o.*, p.name AS product_name, p.platforms AS product_platforms
         FROM orders o JOIN products p ON p.id = o.product_id ${where}`,
        params
      );
      if (!rows.length) return null;
      const payments = await q(
        `SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC`,
        [rows[0].id]
      );
      return { ...rows[0], payments };
    });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json(order);
  } catch (err) { next(err); }
});

// ── Create a real order ────────────────────────────────────────────────────
router.post('/orders', auth.requireAuth, async (req, res, next) => {
  try {
    const { productId } = req.body || {};
    if (typeof productId !== 'string' || !productId) return res.status(400).json({ error: 'Choose a strategy first.' });

    const result = await db.withUser(req.user, async (q) => {
      const products = await q('SELECT * FROM products WHERE id = $1 AND active = TRUE', [productId]);
      if (!products.length) throw httpError(404, 'Strategy not found.');
      const product = products[0];

      let orderNumber = '';
      for (let attempt = 0; attempt < 5; attempt++) {
        orderNumber = 'AGB-' + Date.now().toString(36).toUpperCase().slice(-6) + crypto.randomBytes(2).toString('hex').toUpperCase();
        const clash = await q('SELECT id FROM orders WHERE order_number = $1', [orderNumber]);
        if (!clash.length) break;
      }

      const id = crypto.randomUUID();
      await q(
        `INSERT INTO orders (id, order_number, streamer_id, product_id, price_cents, payment_status, order_status)
         VALUES ($1, $2, $3, $4, $5, 'awaiting', 'awaiting_payment')`,
        [id, orderNumber, req.user.id, product.id, product.price_cents]
      );

      // Notify the owner that a real order was placed.
      const owner = await q("SELECT id FROM profiles WHERE role = 'owner' LIMIT 1");
      if (owner.length) {
        await createNotification(
          q, owner[0].id, 'new_order', 'New order placed',
          `${req.user.name} ordered ${product.name} (${orderNumber}).`,
          { order_id: id, order_number: orderNumber, streamer_id: req.user.id }
        );
      }
      return { id, orderNumber, product };
    });

    res.status(201).json({
      id: result.id,
      order_number: result.orderNumber,
      product_id: result.product.id,
      product_name: result.product.name,
      price_cents: result.product.price_cents,
      payment_status: 'awaiting',
      order_status: 'awaiting_payment',
      payment: {
        methods: [
          ...(cfg.btcAddress ? [{ id: 'btc', label: 'Bitcoin (BTC)', address: cfg.btcAddress }] : []),
          { id: 'paypal', label: 'PayPal', instructions: cfg.paypalInstructions },
          { id: 'other', label: 'Other / ask in Chat', instructions: 'Send a message in Chat to arrange another method.' },
        ],
      },
    });
  } catch (err) { next(err); }
});

// ── Streamer reports a payment (PAYMENT MADE) ──────────────────────────────
// Creates a real payment record in 'pending' state. Nothing is marked paid
// until the owner reviews and confirms it.
router.post('/orders/:id/payment-made', auth.requireAuth, upload.single('receipt'), async (req, res, next) => {
  try {
    const { method, reference, note } = req.body || {};
    if (!['btc', 'paypal', 'other'].includes(method)) return res.status(400).json({ error: 'Choose a payment method.' });
    if (reference && String(reference).length > 200) return res.status(400).json({ error: 'Reference is too long.' });
    if (note && String(note).length > 500) return res.status(400).json({ error: 'Note is too long.' });

    let receipt = null;
    if (req.file) receipt = saveUpload(req.file, 'document');

    const result = await db.withUser(req.user, async (q) => {
      const orders = await q('SELECT * FROM orders WHERE id = $1 AND streamer_id = $2', [req.params.id, req.user.id]);
      if (!orders.length) throw httpError(404, 'Order not found.');
      const order = orders[0];
      if (order.payment_status !== 'awaiting') {
        throw httpError(409, `This order already has a payment ${order.payment_status === 'review' ? 'under review' : 'confirmed'}.`);
      }

      const paymentId = crypto.randomUUID();
      await q(
        `INSERT INTO payments (id, order_id, streamer_id, method, reference, receipt_url, note, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
        [paymentId, order.id, req.user.id, method,
         reference ? String(reference).trim() : null,
         receipt ? `/api/files/p/${paymentId}` : null,
         note ? String(note).trim() : null]
      );
      await q(
        `UPDATE orders SET payment_status = 'review', order_status = 'payment_review' WHERE id = $1`,
        [order.id]
      );

      const owner = await q("SELECT id FROM profiles WHERE role = 'owner' LIMIT 1");
      let notif = null;
      if (owner.length) {
        notif = await createNotification(
          q, owner[0].id, 'payment_review', 'Payment awaiting review',
          `${req.user.name} reported a ${method.toUpperCase()} payment for ${order.order_number}.`,
          { order_id: order.id, order_number: order.order_number, payment_id: paymentId }
        );
      }
      return { paymentId, orderNumber: order.order_number, notif, ownerId: owner.length ? owner[0].id : null };
    });

    const io = getIO();
    if (result.notif && result.ownerId) emitNotification(io, result.notif);
    res.status(201).json({ ok: true, ...result, status: 'review' });
  } catch (err) { next(err); }
});

// ── Owner confirms a payment → order becomes confirmed ─────────────────────
router.post('/orders/:id/confirm-payment', auth.requireAuth, auth.requireOwner, async (req, res, next) => {
  try {
    const result = await db.withUser(req.user, async (q) => {
      const orders = await q('SELECT * FROM orders WHERE id = $1', [req.params.id]);
      if (!orders.length) throw httpError(404, 'Order not found.');
      const order = orders[0];
      if (order.payment_status !== 'review') throw httpError(409, 'There is no payment awaiting confirmation for this order.');

      await q(
        `UPDATE payments SET status = 'confirmed', confirmed_at = now() WHERE order_id = $1 AND status = 'pending'`,
        [order.id]
      );
      await q(
        `UPDATE orders SET payment_status = 'confirmed', order_status = 'confirmed', confirmed_at = now() WHERE id = $1`,
        [order.id]
      );
      const notif = await createNotification(
        q, order.streamer_id, 'payment_confirmed', 'Payment confirmed',
        `Your payment for ${order.order_number} was confirmed by Agbota Segun.`,
        { order_id: order.id, order_number: order.order_number }
      );
      return { ...order, payment_status: 'confirmed', order_status: 'confirmed', confirmed_at: new Date().toISOString(), notif };
    });
    const io = getIO();
    io.to(`user:${result.streamer_id}`).emit('order:update', { order_id: result.id, payment_status: 'confirmed', order_status: 'confirmed' });
    if (result.notif) emitNotification(io, result.notif);
    res.json({ ok: true, order: result });
  } catch (err) { next(err); }
});

// ── Owner rejects a reported payment (back to awaiting) ────────────────────
router.post('/orders/:id/reject-payment', auth.requireAuth, auth.requireOwner, async (req, res, next) => {
  try {
    const result = await db.withUser(req.user, async (q) => {
      const orders = await q('SELECT * FROM orders WHERE id = $1', [req.params.id]);
      if (!orders.length) throw httpError(404, 'Order not found.');
      const order = orders[0];
      if (order.payment_status !== 'review') throw httpError(409, 'No payment is awaiting review on this order.');

      await q(
        `UPDATE payments SET status = 'cancelled', admin_note = $2 WHERE order_id = $1 AND status = 'pending'`,
        [order.id, req.body && req.body.reason ? String(req.body.reason).slice(0, 300) : null]
      );
      await q(
        `UPDATE orders SET payment_status = 'awaiting', order_status = 'awaiting_payment' WHERE id = $1`,
        [order.id]
      );
      const notif = await createNotification(
        q, order.streamer_id, 'order_update', 'Payment not confirmed',
        `The reported payment for ${order.order_number} could not be confirmed. Check Chat for details.`,
        { order_id: order.id, order_number: order.order_number }
      );
      return { ...order, payment_status: 'awaiting', order_status: 'awaiting_payment', notif };
    });
    const io = getIO();
    io.to(`user:${result.streamer_id}`).emit('order:update', { order_id: result.id, payment_status: 'awaiting', order_status: 'awaiting_payment' });
    if (result.notif) emitNotification(io, result.notif);
    res.json({ ok: true, order: result });
  } catch (err) { next(err); }
});

// ── Owner updates order status (confirmed → in_progress → delivered → …) ───
router.post('/orders/:id/status', auth.requireAuth, auth.requireOwner, async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid order status.' });
    const result = await db.withUser(req.user, async (q) => {
      const orders = await q('SELECT * FROM orders WHERE id = $1', [req.params.id]);
      if (!orders.length) throw httpError(404, 'Order not found.');
      const order = orders[0];
      await q('UPDATE orders SET order_status = $1 WHERE id = $2', [status, order.id]);
      const notif = await createNotification(
        q, order.streamer_id, 'order_update', 'Order status updated',
        `Order ${order.order_number} is now ${status.replace(/_/g, ' ')}.`,
        { order_id: order.id, order_number: order.order_number, status }
      );
      return { ...order, order_status: status, notif };
    });
    const io = getIO();
    io.to(`user:${result.streamer_id}`).emit('order:update', { order_id: result.id, order_status: status });
    if (result.notif) emitNotification(io, result.notif);
    res.json({ ok: true, order: result });
  } catch (err) { next(err); }
});

// ── Payment list (streamer → own; owner → all) ─────────────────────────────
router.get('/payments', auth.requireAuth, async (req, res, next) => {
  try {
    const where = req.user.role === 'owner' ? '' : 'WHERE pay.streamer_id = $1';
    const params = req.user.role === 'owner' ? [] : [req.user.id];
    const rows = await db.withUser(req.user, (q) =>
      q(
        `SELECT pay.*, o.order_number, o.product_id, p.name AS product_name
         FROM payments pay
         JOIN orders o ON o.id = pay.order_id
         JOIN products p ON p.id = o.product_id
         ${where}
         ORDER BY pay.created_at DESC`,
        params
      )
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
