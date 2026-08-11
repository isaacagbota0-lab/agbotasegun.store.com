'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const auth = require('../auth');
const db = require('../db');
const cfg = require('../config');
const { upload, saveUpload, httpError } = require('../uploads');
const { createNotification, emitNotification } = require('../notifications');
const { getIO } = require('../realtime');

const router = express.Router();

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.pdf': 'application/pdf', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv', '.zip': 'application/zip',
  '.webm': 'audio/webm', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.aac': 'audio/aac',
};

/** Build the conversation list for the current user (with unread + last message). */
async function conversationList(user) {
  return db.withUser(user, async (q) => {
    const convs = await q(
      `SELECT c.id, c.created_at, c.updated_at
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE cp.profile_id = $1
       ORDER BY c.updated_at DESC`,
      [user.id]
    );
    const out = [];
    for (const c of convs) {
      const partner = await q('SELECT * FROM app_get_conversation_partner($1, $2)', [c.id, user.id]);
      const stats = await q(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE sender_id <> $2 AND read_at IS NULL)::int AS unread,
           (SELECT m.content FROM messages m
             WHERE m.conversation_id = $1 AND m.message_type = 'text'
             ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_text,
           (SELECT m.message_type FROM messages m
             WHERE m.conversation_id = $1
             ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_type,
           (SELECT m.attachment_name FROM messages m
             WHERE m.conversation_id = $1
             ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_attachment,
           (SELECT m.created_at FROM messages m
             WHERE m.conversation_id = $1
             ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_at
         FROM messages
         WHERE conversation_id = $1`,
        [c.id, user.id]
      );
      const s = stats[0];
      out.push({
        id: c.id,
        created_at: c.created_at,
        updated_at: c.updated_at,
        partner: partner[0] || null,
        total_messages: s ? s.total : 0,
        unread: s ? s.unread : 0,
        last_message: s && s.last_at ? {
          type: s.last_type,
          preview: s.last_type === 'text' ? s.last_text
            : s.last_type === 'image' ? 'Image'
            : s.last_type === 'voice' ? 'Voice message'
            : s.last_attachment || 'Document',
          created_at: s.last_at,
        } : null,
      });
    }
    return out;
  });
}

// ── List conversations ─────────────────────────────────────────────────────
router.get('/conversations', auth.requireAuth, async (req, res, next) => {
  try {
    res.json(await conversationList(req.user));
  } catch (err) { next(err); }
});

// ── Owner: start (or open) the conversation with a streamer ────────────────
router.post('/conversations/start/:streamerId', auth.requireAuth, auth.requireOwner, async (req, res, next) => {
  try {
    const { streamerId } = req.params;
    await db.withUser(req.user, async (q) => {
      const streamers = await q("SELECT id FROM profiles WHERE id = $1 AND role = 'streamer'", [streamerId]);
      if (!streamers.length) throw httpError(404, 'Streamer not found.');
      const existing = await q(
        `SELECT c.id FROM conversations c
         JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.profile_id = $1
         JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.profile_id = $2`,
        [streamerId, req.user.id]
      );
      if (!existing.length) {
        const convId = crypto.randomUUID();
        await q('INSERT INTO conversations (id) VALUES ($1)', [convId]);
        await q(
          'INSERT INTO conversation_participants (conversation_id, profile_id) VALUES ($1, $2), ($1, $3)',
          [convId, req.user.id, streamerId]
        );
      }
    });
    const list = await conversationList(req.user);
    const conv = list.find((c) => c.partner && c.partner.id === streamerId) || null;
    res.json({ conversation: conv });
  } catch (err) { next(err); }
});

/** Participation gate: the current user must belong to this conversation. */
async function assertParticipant(q, user, conversationId) {
  const rows = await q(
    `SELECT c.id FROM conversations c
     JOIN conversation_participants cp ON cp.conversation_id = c.id
     WHERE c.id = $1 AND cp.profile_id = $2`,
    [conversationId, user.id]
  );
  if (!rows.length) throw httpError(404, 'Conversation not found.');
}

// ── Conversation messages (load history from the database) ────────────────
router.get('/conversations/:id/messages', auth.requireAuth, async (req, res, next) => {
  try {
    const messages = await db.withUser(req.user, async (q) => {
      await assertParticipant(q, req.user, req.params.id);
      const rows = await q(
        'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC, id ASC',
        [req.params.id]
      );
      // Real read receipts: mark the other side's messages as read.
      await q(
        `UPDATE messages SET read_at = now()
         WHERE conversation_id = $1 AND sender_id <> $2 AND read_at IS NULL`,
        [req.params.id, req.user.id]
      );
      return rows;
    });
    res.json(messages);
  } catch (err) { next(err); }
});

// ── Mark a conversation read (without loading history) ─────────────────────
router.post('/conversations/:id/read', auth.requireAuth, async (req, res, next) => {
  try {
    await db.withUser(req.user, async (q) => {
      await assertParticipant(q, req.user, req.params.id);
      await q(
        `UPDATE messages SET read_at = now()
         WHERE conversation_id = $1 AND sender_id <> $2 AND read_at IS NULL`,
        [req.params.id, req.user.id]
      );
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Send a message (text / image / document / voice) ───────────────────────
router.post('/conversations/:id/messages', auth.requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const { type, content } = req.body || {};
    const validTypes = ['text', 'image', 'document', 'voice'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid message type.' });

    let attachment = null;
    const msgId = crypto.randomUUID();
    if (type === 'text') {
      if (typeof content !== 'string' || !content.trim() || content.trim().length > 4000) {
        return res.status(400).json({ error: 'Message must be between 1 and 4000 characters.' });
      }
    } else {
      if (!req.file) return res.status(400).json({ error: 'Attach a file to send this message.' });
      attachment = saveUpload(req.file, type, { kind: 'm', id: msgId });
    }

    const sent = await db.withUser(req.user, async (q) => {
      await assertParticipant(q, req.user, req.params.id);

      const msg = {
        id: msgId,
        conversation_id: req.params.id,
        sender_id: req.user.id,
        message_type: type,
        content: type === 'text' ? content.trim() : null,
        attachment_url: attachment ? attachment.url : null,
        attachment_name: attachment ? attachment.name : null,
        attachment_size: attachment ? attachment.size : null,
        created_at: new Date().toISOString(),
        read_at: null,
      };
      await q(
        `INSERT INTO messages (id, conversation_id, sender_id, message_type, content, attachment_url, attachment_name, attachment_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [msg.id, msg.conversation_id, msg.sender_id, msg.message_type, msg.content,
         msg.attachment_url, msg.attachment_name, msg.attachment_size]
      );
      await q('UPDATE conversations SET updated_at = now() WHERE id = $1', [req.params.id]);

      const others = await q(
        `SELECT profile_id FROM conversation_participants WHERE conversation_id = $1 AND profile_id <> $2`,
        [req.params.id, req.user.id]
      );
      for (const o of others) {
        await createNotification(
          q, o.profile_id, 'new_message',
          type === 'text' ? `New message from ${req.user.name}` : `${req.user.name} sent ${type === 'image' ? 'an image' : type === 'voice' ? 'a voice message' : 'a document'}`,
          type === 'text' ? content.trim().slice(0, 140) : (attachment ? attachment.name : ''),
          { conversation_id: req.params.id, message_id: msg.id }
        );
      }
      return { msg, recipientIds: others.map((o) => o.profile_id) };
    });

    // Realtime delivery to the conversation room and both participants.
    const io = getIO();
    io.to(`conv:${sent.msg.conversation_id}`).emit('message:new', sent.msg);
    io.to(`conv:${sent.msg.conversation_id}`).emit('conversation:update', { conversationId: sent.msg.conversation_id });
    for (const rid of sent.recipientIds) {
      io.to(`user:${rid}`).emit('conversation:update', { conversationId: sent.msg.conversation_id });
      const notif = await db.withTx((q) =>
        q('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [rid])
      );
      if (notif.length) emitNotification(io, notif[0]);
    }

    res.status(201).json(sent.msg);
  } catch (err) { next(err); }
});

// ── Notifications (own only — enforced by RLS) ─────────────────────────────
router.get('/notifications', auth.requireAuth, async (req, res, next) => {
  try {
    const rows = await db.withUser(req.user, (q) =>
      q('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [req.user.id])
    );
    const unread = await db.withUser(req.user, (q) =>
      q('SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = $1 AND read_at IS NULL', [req.user.id])
    );
    res.json({ notifications: rows, unread: unread[0].c });
  } catch (err) { next(err); }
});

router.post('/notifications/read', auth.requireAuth, async (req, res, next) => {
  try {
    await db.withUser(req.user, (q) =>
      q('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [req.user.id])
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Authorized file serving ────────────────────────────────────────────────
// URL forms: /api/files/m/<messageId>  (message attachment)
//            /api/files/o/<orderId>     (order receipt)
//            /api/files/p/<paymentId>   (payment receipt)
// Access is granted only to conversation participants / the streamer who owns
// the order / the owner — enforced with the same RLS-scoped queries.
router.get('/files/:kind/:id', auth.requireAuth, async (req, res, next) => {
  try {
    const { kind, id } = req.params;
    if (!['m', 'o', 'p'].includes(kind)) return res.status(404).json({ error: 'File not found.' });

    const isOwner = req.user.role === 'owner';
    const fileMeta = await db.withUser(req.user, async (q) => {
      if (kind === 'm') {
        // Only participants of the conversation (or the owner) may fetch it.
        const rows = await q(
          `SELECT m.attachment_url, m.attachment_name
           FROM messages m
           JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.profile_id = $2
           WHERE m.id = $1`,
          [id, req.user.id]
        );
        if (!rows.length || !rows[0].attachment_url) return null;
        return { url: rows[0].attachment_url, name: rows[0].attachment_name || 'attachment' };
      }
      if (kind === 'o') {
        // Only the streamer who owns the order (or the owner).
        const rows = isOwner
          ? await q('SELECT receipt_url FROM orders WHERE id = $1', [id])
          : await q('SELECT receipt_url FROM orders WHERE id = $1 AND streamer_id = $2', [id, req.user.id]);
        if (!rows.length || !rows[0].receipt_url) return null;
        return { url: rows[0].receipt_url, name: 'receipt' };
      }
      const rows = isOwner
        ? await q('SELECT receipt_url FROM payments WHERE id = $1', [id])
        : await q('SELECT receipt_url FROM payments WHERE id = $1 AND streamer_id = $2', [id, req.user.id]);
      if (!rows.length || !rows[0].receipt_url) return null;
      return { url: rows[0].receipt_url, name: 'payment-receipt' };
    });

    if (!fileMeta || !fileMeta.url.startsWith(`/api/files/${kind}/`)) {
      return res.status(404).json({ error: 'File not found.' });
    }
    const fileId = fileMeta.url.split('/').pop();
    const fileOnDisk = fs.readdirSync(cfg.uploadsDir).find((f) => f.startsWith(fileId + '.'));
    if (!fileOnDisk) return res.status(404).json({ error: 'File not found.' });

    const ext = path.extname(fileOnDisk).toLowerCase();
    const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
    const inline = mime.startsWith('image/') || mime.startsWith('audio/');
    const safeName = String(fileMeta.name || 'file').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '_').slice(0, 120) || 'file';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`);
    fs.createReadStream(path.join(cfg.uploadsDir, fileOnDisk)).pipe(res);
  } catch (err) { next(err); }
});

module.exports = router;
