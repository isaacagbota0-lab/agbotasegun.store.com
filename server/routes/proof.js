'use strict';

/**
 * Proof of Work — database-backed proof items.
 * Public: published items only. Owner: full CRUD (upload, edit, publish,
 * unpublish, reorder, delete). No item is ever invented — every row is
 * created by the owner uploading a real screenshot.
 */
const crypto = require('crypto');
const express = require('express');
const auth = require('../auth');
const db = require('../db');
const { upload, saveUpload, httpError } = require('../uploads');

const router = express.Router();

const CATEGORIES = ['conversations', 'strategy', 'analysis', 'progress', 'feedback', 'payouts'];

function rowToItem(r) {
  return {
    id: r.id, title: r.title, category: r.category, platform: r.platform,
    caption: r.caption, item_date: r.item_date, image_url: r.image_url,
    sort_order: r.sort_order, published: r.published,
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

function validMeta(b) {
  if (typeof b.title !== 'string' || !b.title.trim() || b.title.trim().length > 120) {
    return { error: 'Title is required (max 120 characters).' };
  }
  if (!CATEGORIES.includes(b.category)) return { error: 'Invalid category.' };
  if (b.platform !== undefined && (typeof b.platform !== 'string' || b.platform.length > 60)) {
    return { error: 'Platform is too long.' };
  }
  if (b.caption !== undefined && (typeof b.caption !== 'string' || b.caption.length > 500)) {
    return { error: 'Caption is too long (max 500 characters).' };
  }
  if (b.item_date !== undefined && (typeof b.item_date !== 'string' || b.item_date.length > 40)) {
    return { error: 'Date is too long.' };
  }
  return null;
}

// ── Public: published proof items only ────────────────────────────────────
router.get('/proof', async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT * FROM proof_items WHERE published = TRUE
       ORDER BY sort_order, created_at DESC`
    );
    res.json(rows.map(rowToItem));
  } catch (err) { next(err); }
});

// ── Owner: all items ──────────────────────────────────────────────────────
router.get('/admin/proof', auth.requireAuth, auth.requireOwner, async (req, res, next) => {
  try {
    const rows = await db.withUser(req.user, (q) =>
      q('SELECT * FROM proof_items ORDER BY sort_order, created_at DESC')
    );
    res.json(rows.map(rowToItem));
  } catch (err) { next(err); }
});

// ── Owner: upload a new proof screenshot (starts UNPUBLISHED) ─────────────
router.post('/admin/proof', auth.requireAuth, auth.requireOwner, upload.single('image'), async (req, res, next) => {
  try {
    const b = req.body || {};
    const invalid = validMeta(b);
    if (invalid) return res.status(400).json({ error: invalid.error });
    if (!req.file) return res.status(400).json({ error: 'Choose a screenshot image to upload.' });

    const id = crypto.randomUUID();
    const saved = saveUpload(req.file, 'image', { kind: 'pr', id });

    await db.withUser(req.user, async (q) => {
      const max = await q('SELECT COALESCE(MAX(sort_order), 0)::int AS m FROM proof_items');
      await q(
        `INSERT INTO proof_items (id, title, category, platform, caption, item_date, image_url, sort_order, published)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)`,
        [id, b.title.trim(), b.category,
         b.platform ? b.platform.trim() : null,
         b.caption ? b.caption.trim() : null,
         b.item_date ? b.item_date.trim() : null,
         saved.url, max[0].m + 1]
      );
    });

    const rows = await db.withUser(req.user, (q) => q('SELECT * FROM proof_items WHERE id = $1', [id]));
    res.status(201).json(rowToItem(rows[0]));
  } catch (err) { next(err); }
});

// ── Owner: edit metadata + publish/unpublish ──────────────────────────────
router.patch('/admin/proof/:id', auth.requireAuth, auth.requireOwner, async (req, res, next) => {
  try {
    const b = req.body || {};
    const invalid = validMeta(b);
    if (invalid) return res.status(400).json({ error: invalid.error });
    if (b.published !== undefined && typeof b.published !== 'boolean') {
      return res.status(400).json({ error: 'Invalid published value.' });
    }

    await db.withUser(req.user, async (q) => {
      const rows = await q('SELECT id FROM proof_items WHERE id = $1', [req.params.id]);
      if (!rows.length) throw httpError(404, 'Proof item not found.');
      await q(
        `UPDATE proof_items SET title = $2, category = $3, platform = $4, caption = $5,
                item_date = $6, published = COALESCE($7, published)
         WHERE id = $1`,
        [req.params.id, b.title.trim(), b.category,
         b.platform ? b.platform.trim() : null,
         b.caption ? b.caption.trim() : null,
         b.item_date ? b.item_date.trim() : null,
         b.published === undefined ? null : b.published]
      );
    });
    const rows = await db.withUser(req.user, (q) => q('SELECT * FROM proof_items WHERE id = $1', [req.params.id]));
    res.json(rowToItem(rows[0]));
  } catch (err) { next(err); }
});

// ── Owner: reorder (orderedIds = full ordered list) ───────────────────────
router.post('/admin/proof/reorder', auth.requireAuth, auth.requireOwner, async (req, res, next) => {
  try {
    const { orderedIds } = req.body || {};
    if (!Array.isArray(orderedIds) || orderedIds.length > 100) {
      return res.status(400).json({ error: 'Invalid order list.' });
    }
    await db.withUser(req.user, async (q) => {
      for (let i = 0; i < orderedIds.length; i++) {
        if (typeof orderedIds[i] !== 'string') continue;
        await q('UPDATE proof_items SET sort_order = $1 WHERE id = $2', [i + 1, orderedIds[i]]);
      }
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Owner: delete ─────────────────────────────────────────────────────────
router.delete('/admin/proof/:id', auth.requireAuth, auth.requireOwner, async (req, res, next) => {
  try {
    const deleted = await db.withUser(req.user, async (q) => {
      const rows = await q('SELECT image_url FROM proof_items WHERE id = $1', [req.params.id]);
      if (!rows.length) return false;
      await q('DELETE FROM proof_items WHERE id = $1', [req.params.id]);
      return rows[0];
    });
    if (!deleted) return res.status(404).json({ error: 'Proof item not found.' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
