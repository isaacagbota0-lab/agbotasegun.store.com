'use strict';

const express = require('express');
const auth = require('../auth');
const db = require('../db');
const { httpError } = require('../uploads');

const router = express.Router();
router.use(auth.requireAuth, auth.requireOwner); // every admin route is owner-only

// ── Overview stats — all real database counts, never fabricated ────────────
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await db.withUser(req.user, async (q) => {
      const [streamers, unread, orders, pendingPayments, confirmedOrders, pendingReviews,
             activeConvs, recentStreamers, recentOrders] = await Promise.all([
        q("SELECT COUNT(*)::int AS c FROM profiles WHERE role = 'streamer'"),
        q(`SELECT COUNT(*)::int AS c FROM messages WHERE sender_id <> $1 AND read_at IS NULL`, [req.user.id]),
        q('SELECT COUNT(*)::int AS c FROM orders'),
        q(`SELECT COUNT(*)::int AS c FROM orders WHERE payment_status = 'review'`),
        q(`SELECT COUNT(*)::int AS c FROM orders WHERE order_status = 'completed'`),
        q(`SELECT COUNT(*)::int AS c FROM reviews WHERE status = 'pending'`),
        q(`SELECT COUNT(*)::int AS c FROM conversations`),
        q(
          `SELECT p.id, p.name, p.email, p.created_at,
                  (SELECT COUNT(*)::int FROM orders o WHERE o.streamer_id = p.id) AS order_count,
                  (SELECT COUNT(*)::int FROM messages m
                    JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.profile_id = p.id
                    WHERE m.sender_id = p.id AND m.read_at IS NULL) AS unread
           FROM profiles p WHERE p.role = 'streamer'
           ORDER BY p.created_at DESC LIMIT 5`
        ),
        q(
          `SELECT o.id, o.order_number, o.price_cents, o.payment_status, o.order_status, o.created_at,
                  p.name AS streamer_name, pr.name AS product_name
           FROM orders o
           JOIN profiles p ON p.id = o.streamer_id
           JOIN products pr ON pr.id = o.product_id
           ORDER BY o.created_at DESC LIMIT 6`
        ),
      ]);
      return {
        streamers: streamers[0].c,
        unread_messages: unread[0].c,
        orders: orders[0].c,
        pending_payments: pendingPayments[0].c,
        completed_orders: confirmedOrders[0].c,
        pending_reviews: pendingReviews[0].c,
        conversations: activeConvs[0].c,
        recent_streamers: recentStreamers,
        recent_orders: recentOrders,
      };
    });
    res.json(stats);
  } catch (err) { next(err); }
});

// ── Streamers list with search (name / email) ──────────────────────────────
router.get('/streamers', async (req, res, next) => {
  try {
    const qParam = String(req.query.q || '').trim().slice(0, 100);
    const rows = await db.withUser(req.user, async (q) => {
      const params = [];
      let where = "p.role = 'streamer'";
      if (qParam) {
        params.push(`%${qParam}%`);
        where += ` AND (p.name ILIKE $${params.length} OR p.email ILIKE $${params.length})`;
      }
      return q(
        `SELECT p.id, p.name, p.email, p.created_at,
                (SELECT COUNT(*)::int FROM orders o WHERE o.streamer_id = p.id) AS order_count,
                (SELECT COUNT(*)::int FROM orders o
                  WHERE o.streamer_id = p.id AND o.payment_status = 'review') AS pending_payments,
                (SELECT COUNT(*)::int FROM orders o
                  WHERE o.streamer_id = p.id AND o.order_status = 'completed') AS completed_orders,
                (SELECT COUNT(*)::int FROM messages m
                  JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.profile_id = p.id
                  WHERE m.sender_id = p.id AND m.read_at IS NULL) AS unread,
                (SELECT m.created_at FROM messages m
                  JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.profile_id = p.id
                  ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
                (SELECT m.message_type FROM messages m
                  JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.profile_id = p.id
                  ORDER BY m.created_at DESC LIMIT 1) AS last_message_type
         FROM profiles p
         WHERE ${where}
         ORDER BY p.created_at DESC`,
        params
      );
    });
    res.json(rows);
  } catch (err) { next(err); }
});

// ── Single streamer detail (profile + orders) ──────────────────────────────
router.get('/streamers/:id', async (req, res, next) => {
  try {
    const data = await db.withUser(req.user, async (q) => {
      const streamers = await q(
        `SELECT id, name, email, created_at FROM profiles WHERE id = $1 AND role = 'streamer'`,
        [req.params.id]
      );
      if (!streamers.length) return null;
      const orders = await q(
        `SELECT o.*, p.name AS product_name FROM orders o
         JOIN products p ON p.id = o.product_id
         WHERE o.streamer_id = $1 ORDER BY o.created_at DESC`,
        [req.params.id]
      );
      const conv = await q(
        `SELECT c.id FROM conversations c
         JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.profile_id = $1
         LIMIT 1`,
        [req.params.id]
      );
      return { ...streamers[0], orders, conversation_id: conv.length ? conv[0].id : null };
    });
    if (!data) return res.status(404).json({ error: 'Streamer not found.' });
    res.json(data);
  } catch (err) { next(err); }
});

// ── All orders (owner view) ────────────────────────────────────────────────
router.get('/orders', async (req, res, next) => {
  try {
    const rows = await db.withUser(req.user, (q) =>
      q(
        `SELECT o.*, p.name AS streamer_name, pr.name AS product_name
         FROM orders o
         JOIN profiles p ON p.id = o.streamer_id
         JOIN products pr ON pr.id = o.product_id
         ORDER BY o.created_at DESC`
      )
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── All payments (owner view) ──────────────────────────────────────────────
router.get('/payments', async (req, res, next) => {
  try {
    const rows = await db.withUser(req.user, (q) =>
      q(
        `SELECT pay.*, p.name AS streamer_name, o.order_number, pr.name AS product_name
         FROM payments pay
         JOIN profiles p ON p.id = pay.streamer_id
         JOIN orders o ON o.id = pay.order_id
         JOIN products pr ON pr.id = o.product_id
         ORDER BY pay.created_at DESC`
      )
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── All reviews (owner moderation queue) ───────────────────────────────────
router.get('/reviews', async (req, res, next) => {
  try {
    const rows = await db.withUser(req.user, (q) =>
      q(
        `SELECT r.*, p.name AS streamer_name, o.order_number, pr.name AS product_name
         FROM reviews r
         JOIN profiles p ON p.id = r.streamer_id
         JOIN orders o ON o.id = r.order_id
         JOIN products pr ON pr.id = o.product_id
         ORDER BY r.created_at DESC`
      )
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── Product catalog management ─────────────────────────────────────────────
router.get('/products', async (req, res, next) => {
  try {
    const rows = await db.withUser(req.user, (q) =>
      q('SELECT * FROM products ORDER BY sort_order, name')
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.patch('/products/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    const allowed = ['name', 'price_cents', 'tagline', 'description', 'includes', 'audience', 'active', 'platforms'];
    const update = {};
    for (const key of allowed) if (key in b) update[key] = b[key];

    if ('name' in update && (typeof update.name !== 'string' || !update.name.trim() || update.name.length > 120)) {
      return res.status(400).json({ error: 'Invalid product name.' });
    }
    if ('price_cents' in update && (!Number.isInteger(update.price_cents) || update.price_cents < 0 || update.price_cents > 1000000)) {
      return res.status(400).json({ error: 'Invalid price.' });
    }
    if ('tagline' in update && (typeof update.tagline !== 'string' || update.tagline.length > 200)) {
      return res.status(400).json({ error: 'Invalid tagline.' });
    }
    if ('description' in update && (typeof update.description !== 'string' || update.description.length > 3000)) {
      return res.status(400).json({ error: 'Invalid description.' });
    }
    for (const arrKey of ['includes', 'audience', 'platforms']) {
      if (arrKey in update && (!Array.isArray(update[arrKey]) || update[arrKey].length > 30)) {
        return res.status(400).json({ error: `Invalid ${arrKey}.` });
      }
    }
    if ('active' in update && typeof update.active !== 'boolean') {
      return res.status(400).json({ error: 'Invalid active flag.' });
    }

    const result = await db.withUser(req.user, async (q) => {
      const existing = await q('SELECT id FROM products WHERE id = $1', [req.params.id]);
      if (!existing.length) throw httpError(404, 'Product not found.');
      const sets = [];
      const params = [];
      for (const [key, value] of Object.entries(update)) {
        params.push(Array.isArray(value) ? JSON.stringify(value) : value);
        sets.push(`${key} = $${params.length}`);
      }
      params.push(req.params.id);
      await q(`UPDATE products SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
      return (await q('SELECT * FROM products WHERE id = $1', [req.params.id]))[0];
    });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
