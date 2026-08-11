'use strict';

const crypto = require('crypto');
const express = require('express');
const auth = require('../auth');
const db = require('../db');
const { httpError } = require('../uploads');
const { createNotification, emitNotification } = require('../notifications');
const { getIO } = require('../realtime');

const router = express.Router();

// ── Public: approved reviews only ──────────────────────────────────────────
router.get('/reviews', async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT r.id, r.rating, r.body, r.created_at, pr.name AS streamer_name,
              p.name AS product_name, p.id AS product_id
       FROM reviews r
       JOIN profiles pr ON pr.id = r.streamer_id
       JOIN orders o ON o.id = r.order_id
       JOIN products p ON p.id = o.product_id
       WHERE r.status = 'approved'
       ORDER BY r.created_at DESC
       LIMIT 24`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── Streamer: their own reviews ────────────────────────────────────────────
router.get('/reviews/mine', auth.requireAuth, async (req, res, next) => {
  try {
    const rows = await db.withUser(req.user, (q) =>
      q(
        `SELECT r.*, o.order_number, p.name AS product_name
         FROM reviews r
         JOIN orders o ON o.id = r.order_id
         JOIN products p ON p.id = o.product_id
         WHERE r.streamer_id = $1
         ORDER BY r.created_at DESC`,
        [req.user.id]
      )
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── Streamer submits a review for a completed, confirmed order ─────────────
router.post('/reviews', auth.requireAuth, async (req, res, next) => {
  try {
    const { orderId, rating, body } = req.body || {};
    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5 stars.' });
    if (typeof body !== 'string' || body.trim().length < 10 || body.trim().length > 1200) {
      return res.status(400).json({ error: 'Review must be between 10 and 1200 characters.' });
    }

    const result = await db.withUser(req.user, async (q) => {
      const orders = await q('SELECT * FROM orders WHERE id = $1 AND streamer_id = $2', [orderId, req.user.id]);
      if (!orders.length) throw httpError(404, 'Order not found.');
      const order = orders[0];
      if (order.order_status !== 'completed') {
        throw httpError(409, 'Reviews can only be submitted for completed orders.');
      }
      const dup = await q('SELECT id FROM reviews WHERE order_id = $1', [orderId]);
      if (dup.length) throw httpError(409, 'You have already reviewed this order.');

      const id = crypto.randomUUID();
      await q(
        'INSERT INTO reviews (id, order_id, streamer_id, rating, body, status) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, orderId, req.user.id, r, body.trim(), 'pending']
      );
      const owner = await q("SELECT id FROM profiles WHERE role = 'owner' LIMIT 1");
      if (owner.length) {
        await createNotification(
          q, owner[0].id, 'review_moderated', 'New review awaiting moderation',
          `${req.user.name} submitted a ${r}-star review for ${order.order_number}.`,
          { order_id: orderId, review_id: id }
        );
      }
      return { id, status: 'pending' };
    });
    res.status(201).json({ ok: true, ...result });
  } catch (err) { next(err); }
});

// ── Owner moderation ───────────────────────────────────────────────────────
router.post('/admin/reviews/:id/decision', auth.requireAuth, auth.requireOwner, async (req, res, next) => {
  try {
    const { decision } = req.body || {};
    if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'Invalid decision.' });
    const result = await db.withUser(req.user, async (q) => {
      const rows = await q('SELECT * FROM reviews WHERE id = $1', [req.params.id]);
      if (!rows.length) throw httpError(404, 'Review not found.');
      const review = rows[0];
      await q(
        `UPDATE reviews SET status = $1, moderated_at = now() WHERE id = $2`,
        [decision, review.id]
      );
      const notif = await createNotification(
        q, review.streamer_id, 'review_moderated',
        decision === 'approved' ? 'Your review was published' : 'Your review was not published',
        decision === 'approved'
          ? 'Thank you — your review is now visible on the site.'
          : 'Your review did not meet the publication guidelines. It has not been published.',
        { review_id: review.id }
      );
      return { ...review, status: decision, notif };
    });
    const io = getIO();
    if (result.notif) emitNotification(io, result.notif);
    res.json({ ok: true, review: result });
  } catch (err) { next(err); }
});

// ── Owner can remove a published review ────────────────────────────────────
router.delete('/admin/reviews/:id', auth.requireAuth, auth.requireOwner, async (req, res, next) => {
  try {
    await db.withUser(req.user, (q) => q('DELETE FROM reviews WHERE id = $1', [req.params.id]));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
