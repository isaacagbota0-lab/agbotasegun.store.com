'use strict';

const crypto = require('crypto');
const express = require('express');
const auth = require('../auth');
const db = require('../db');
const { httpError } = require('../uploads');

const router = express.Router();

// ── Rate limiting (brute-force protection) ─────────────────────────────────
const attempts = new Map();
function rateLimit(route) {
  return (req, res, next) => {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase().slice(0, 120);
    const key = `${req.ip}:${route}:${email}`;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const entry = attempts.get(key) || { count: 0, resetAt: now + windowMs };
    if (entry.resetAt < now) { entry.count = 0; entry.resetAt = now + windowMs; }
    entry.count += 1;
    attempts.set(key, entry);
    if (attempts.size > 5000) {
      for (const [k, v] of attempts) if (v.resetAt < now) attempts.delete(k);
    }
    if (entry.count > 20) {
      return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
    }
    next();
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validName(name) {
  return typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 80;
}
function validEmail(email) {
  return typeof email === 'string' && email.trim().length <= 254 && EMAIL_RE.test(email.trim());
}
function validPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 && pw.length <= 72;
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, created_at: u.created_at };
}

// ── Register (streamer signup) ─────────────────────────────────────────────
// Creates the real account, profile, automatic conversation with the owner,
// and an admin notification — all in one transaction.
router.post('/auth/register', rateLimit('register'), async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!validName(name)) return res.status(400).json({ error: 'Please enter your full name (2–80 characters).' });
    if (!validEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (!validPassword(password)) return res.status(400).json({ error: 'Password must be at least 8 characters long.' });

    const cleanEmail = email.trim().toLowerCase();
    const existing = await db.withTx((q) => q('SELECT id FROM app_get_profile_by_email($1)', [cleanEmail]));
    if (existing.length) return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' });

    const id = crypto.randomUUID();
    const passwordHash = await auth.hashPassword(password);
    const owner = await db.withTx((q) => q("SELECT id FROM profiles WHERE role = 'owner' LIMIT 1"));

    await db.withUser({ id, role: 'streamer' }, async (q) => {
      await q(
        'INSERT INTO profiles (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
        [id, name.trim(), cleanEmail, passwordHash, 'streamer']
      );
      if (owner.length) {
        const convId = crypto.randomUUID();
        await q('INSERT INTO conversations (id) VALUES ($1)', [convId]);
        await q(
          'INSERT INTO conversation_participants (conversation_id, profile_id) VALUES ($1, $2), ($1, $3)',
          [convId, owner[0].id, id]
        );
        // Real database notification so the owner immediately knows a new streamer registered.
        await q(
          `INSERT INTO notifications (id, user_id, type, title, body, data)
           VALUES ($1, $2, 'streamer_signup', $3, $4, $5)`,
          [crypto.randomUUID(), owner[0].id, 'New streamer registered',
           `${name.trim()} created a streamer account. You can start a conversation right away.`,
           JSON.stringify({ streamer_id: id, streamer_name: name.trim() })]
        );
      }
    });

    const user = (await db.withTx((q) => q('SELECT * FROM app_get_profile_by_id($1)', [id])))[0];
    const token = auth.signToken(user);
    auth.setSessionCookie(res, token);
    console.log(`[auth] register ok: ${cleanEmail} (${user.role})`);
    res.status(201).json({ user: publicUser(user), token });
  } catch (err) {
    next(err);
  }
});

// ── Login ──────────────────────────────────────────────────────────────────
router.post('/auth/login', rateLimit('login'), async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!validEmail(email) || typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Please enter your email and password.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const rows = await db.withTx((q) => q('SELECT * FROM app_get_profile_by_email($1)', [cleanEmail]));
    const user = rows[0];
    if (!user || !(await auth.verifyPassword(password, user.password_hash))) {
      console.log(`[auth] login failed: ${cleanEmail}`);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const token = auth.signToken(user);
    auth.setSessionCookie(res, token);
    console.log(`[auth] login ok: ${user.email} (${user.role})`);
    res.json({ user: publicUser(user), token });
  } catch (err) {
    next(err);
  }
});

// ── Logout ─────────────────────────────────────────────────────────────────
router.post('/auth/logout', (req, res) => {
  auth.clearSessionCookie(res);
  res.json({ ok: true });
});

// ── Current session ────────────────────────────────────────────────────────
router.get('/auth/me', auth.requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// ── Update own profile (name) ──────────────────────────────────────────────
router.patch('/profile', auth.requireAuth, async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!validName(name)) return res.status(400).json({ error: 'Please enter your full name (2–80 characters).' });
    await db.withUser(req.user, (q) => q('UPDATE profiles SET name = $1 WHERE id = $2', [name.trim(), req.user.id]));
    res.json({ ok: true, user: { ...publicUser(req.user), name: name.trim() } });
  } catch (err) {
    next(err);
  }
});

// ── Update own email (requires current password) ───────────────────────────
router.post('/profile/email', auth.requireAuth, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!validEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (typeof password !== 'string' || !password) return res.status(400).json({ error: 'Confirm your current password.' });
    const cleanEmail = email.trim().toLowerCase();
    const me = (await db.withTx((q) => q('SELECT * FROM app_get_profile_by_id($1)', [req.user.id])))[0];
    if (!me || !(await auth.verifyPassword(password, me.password_hash))) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    const clash = await db.withTx((q) => q('SELECT id FROM app_get_profile_by_email($1)', [cleanEmail]));
    if (clash.length && clash[0].id !== req.user.id) {
      return res.status(409).json({ error: 'That email is already used by another account.' });
    }
    await db.withUser(req.user, (q) => q('UPDATE profiles SET email = $1 WHERE id = $2', [cleanEmail, req.user.id]));
    res.json({ ok: true, email: cleanEmail });
  } catch (err) {
    next(err);
  }
});

// ── Change password ────────────────────────────────────────────────────────
router.post('/profile/password', auth.requireAuth, async (req, res, next) => {
  try {
    const { current, next: nextPassword } = req.body || {};
    if (typeof current !== 'string' || !current) return res.status(400).json({ error: 'Enter your current password.' });
    if (!validPassword(nextPassword)) return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    const me = (await db.withTx((q) => q('SELECT * FROM app_get_profile_by_id($1)', [req.user.id])))[0];
    if (!me || !(await auth.verifyPassword(current, me.password_hash))) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    const hash = await auth.hashPassword(nextPassword);
    await db.withUser(req.user, (q) => q('UPDATE profiles SET password_hash = $1 WHERE id = $2', [hash, req.user.id]));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = { router, httpError };
