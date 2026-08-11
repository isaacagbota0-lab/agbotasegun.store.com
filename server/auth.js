'use strict';

/**
 * Authentication: bcrypt password hashing + signed JWT sessions.
 *
 * Sessions work two ways (both secure, both server-verified):
 *  1. httpOnly cookie (default for normal browsers)
 *  2. `Authorization: Bearer <token>` header — used when the environment
 *     blocks cookies (e.g. sandboxed preview iframes/proxies). The token is
 *     the same signed JWT, returned in the login/signup response body and
 *     kept client-side for the session only.
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cfg = require('./config');
const db = require('./db');

const SESSION_DAYS = 30;

function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, cfg.jwtSecret, {
    expiresIn: `${SESSION_DAYS}d`,
  });
}

function setSessionCookie(res, token) {
  res.cookie(cfg.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cfg.isProd,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(cfg.cookieName, { path: '/' });
}

/** Extract the session token, tried in order:
 *  1. `Authorization: Bearer` header
 *  2. `?token=` query parameter (used when proxies strip headers/cookies)
 *  3. session cookie
 */
function tokenFrom(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  const q = req.query && req.query.token;
  if (typeof q === 'string' && q) return q.slice(0, 500);
  return (req.cookies && req.cookies[cfg.cookieName]) || null;
}

/** Read the session token (header or cookie), verify it, load the user row. */
async function loadUser(req) {
  const token = tokenFrom(req);
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, cfg.jwtSecret);
  } catch (_) {
    return null;
  }
  if (!payload || !payload.sub) return null;
  const rows = await db.withTx(async (q) =>
    q('SELECT id, name, email, role, created_at FROM profiles WHERE id = $1', [payload.sub])
  );
  return rows[0] || null;
}

/** Express middleware: requires a valid session; attaches req.user. */
function requireAuth(req, res, next) {
  loadUser(req)
    .then((user) => {
      if (!user) return res.status(401).json({ error: 'Authentication required. Please log in.' });
      req.user = user;
      next();
    })
    .catch((err) => {
      console.error('[auth] loadUser failed:', err.message);
      res.status(500).json({ error: 'Could not verify your session. Please try again.' });
    });
}

/** Express middleware: requires the owner/admin role. */
function requireOwner(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  if (req.user.role !== 'owner') {
    return res.status(403).json({ error: 'You do not have permission to access this area.' });
  }
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  setSessionCookie,
  clearSessionCookie,
  loadUser,
  requireAuth,
  requireOwner,
};
