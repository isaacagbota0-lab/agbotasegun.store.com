'use strict';

/**
 * Notification helpers. Notifications are real database rows tied to real
 * events (signup, message, order, payment…) and are pushed in real time to
 * the recipient's socket room.
 */
const crypto = require('crypto');

async function createNotification(q, userId, type, title, body, data = {}) {
  const id = crypto.randomUUID();
  await q(
    `INSERT INTO notifications (id, user_id, type, title, body, data)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, userId, type, title, body, JSON.stringify(data)]
  );
  return { id, user_id: userId, type, title, body, data, read_at: null, created_at: new Date().toISOString() };
}

function emitNotification(io, notification) {
  io.to(`user:${notification.user_id}`).emit('notification:new', notification);
}

module.exports = { createNotification, emitNotification };
