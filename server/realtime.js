'use strict';

/**
 * Realtime layer (Socket.IO). Authentication is the same signed httpOnly
 * cookie used by the REST API; every socket is bound to a real database
 * user. Events are emitted only into rooms the user is authorized to join.
 */
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cfg = require('./config');
const db = require('./db');

let io = null;

function getIO() {
  if (!io) throw new Error('Realtime not initialized yet');
  return io;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function initRealtime(server) {
  io = new Server(server, {
    cors: false, // same-origin only
    maxHttpBufferSize: 1e6,
  });

  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const token = (socket.handshake.auth && socket.handshake.auth.token) || cookies[cfg.cookieName];
      if (!token) throw new Error('missing session');
      const payload = jwt.verify(token, cfg.jwtSecret);
      if (!payload || !payload.sub) throw new Error('bad token');
      const rows = await db.withTx((q) =>
        q('SELECT id, name, email, role FROM profiles WHERE id = $1', [payload.sub])
      );
      if (!rows.length) throw new Error('unknown user');
      socket.data.user = rows[0];
      next();
    } catch (_) {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user.id}`);

    socket.on('conversation:join', async (conversationId, ack) => {
      try {
        if (typeof conversationId !== 'string' || !conversationId) return;
        const ok = await db.withUser(user, async (q) => {
          const rows = await q(
            `SELECT c.id FROM conversations c
             JOIN conversation_participants cp ON cp.conversation_id = c.id
             WHERE c.id = $1 AND cp.profile_id = $2`,
            [conversationId, user.id]
          );
          return rows.length > 0;
        });
        if (ok) socket.join(`conv:${conversationId}`);
        if (typeof ack === 'function') ack(!!ok);
      } catch (_) { /* ignore */ }
    });

    socket.on('disconnect', () => { /* rooms are cleaned automatically */ });
  });

  return io;
}

module.exports = { initRealtime, getIO };
