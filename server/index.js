'use strict';

/**
 * Agbota Segun — application server.
 * Express REST API + Socket.IO realtime + PostgreSQL (embedded PGlite by
 * default, or any DATABASE_URL you provide).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const cfg = require('./config');
const db = require('./db');
const auth = require('./auth');
const { seedProducts } = require('./seed');
const { initRealtime, getIO } = require('./realtime');
const { httpError } = require('./uploads');

const authRoutes = require('./routes/auth').router;
const storeRoutes = require('./routes/store');
const reviewRoutes = require('./routes/reviews');
const messagingRoutes = require('./routes/messaging');
const adminRoutes = require('./routes/admin');
const proofRoutes = require('./routes/proof');

// ── Boot ───────────────────────────────────────────────────────────────────
async function boot() {
  fs.mkdirSync(cfg.uploadsDir, { recursive: true });

  const engine = await db.init();
  console.log(`[db] connected (${engine === 'pg' ? 'external PostgreSQL via DATABASE_URL' : 'embedded PostgreSQL (PGlite)'})`);
  await db.withTx((q) => seedProducts(q));

  // Create the Owner/Admin account from environment variables if it does not
  // exist yet. The password is hashed with bcrypt; nothing plaintext is kept.
  if (cfg.adminEmail && cfg.adminPassword) {
    const existing = await db.withTx((q) => q('SELECT * FROM app_get_profile_by_email($1)', [cfg.adminEmail]));
    if (!existing.length) {
      const id = require('crypto').randomUUID();
      const hash = await auth.hashPassword(cfg.adminPassword);
      await db.withUser({ id, role: 'owner' }, async (q) => {
        await q(
          `INSERT INTO profiles (id, name, email, password_hash, role) VALUES ($1, 'Agbota Segun', $2, $3, 'owner')`,
          [id, cfg.adminEmail, hash]
        );
      });
      console.log(`[auth] Owner account created for ${cfg.adminEmail}`);
    }
  } else {
    console.warn('[auth] ADMIN_EMAIL / ADMIN_PASSWORD not set — no owner account configured.');
  }

  // ── Express ──────────────────────────────────────────────────────────────
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // ── Health check (used by hosting platforms) ─────────────────────────────
  app.get('/api/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

  // ── API routes ───────────────────────────────────────────────────────────
  app.use('/api', authRoutes);          // auth + profile
  app.use('/api', storeRoutes);
  app.use('/api', reviewRoutes);
  app.use('/api', messagingRoutes);
  app.use('/api', proofRoutes);
  app.use('/api/admin', adminRoutes);

  // Static assets (frontend + self-hosted fonts)
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: cfg.isProd ? '1h' : 0 }));
  app.use('/fonts/fraunces', express.static(path.join(__dirname, '..', 'node_modules', '@fontsource-variable', 'fraunces')));
  app.use('/fonts/dm-sans', express.static(path.join(__dirname, '..', 'node_modules', '@fontsource-variable', 'dm-sans')));

  // API 404s and errors
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error('[error]', err.stack || err.message);
    if (res.headersSent) return;
    res.status(status).json({ error: err.status ? err.message : 'Something went wrong on the server. Please try again.' });
  });

  // SPA fallback (public marketing + dashboard routes are client-side)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  // ── HTTP + realtime ──────────────────────────────────────────────────────
  const server = http.createServer(app);
  initRealtime(server);

  server.listen(cfg.port, '0.0.0.0', () => {
    console.log(`[server] Agbota Segun listening on http://0.0.0.0:${cfg.port}`);
  });

  // Announce order/payment changes in real time to the affected streamer.
  const io = getIO();
  const emitTo = (userId, event, payload) => io.to(`user:${userId}`).emit(event, payload);
  module.exports.emitTo = emitTo;
  module.exports.getIO = getIO;

  process.on('SIGTERM', () => { server.close(); db.close(); process.exit(0); });
  process.on('SIGINT', () => { server.close(); db.close(); process.exit(0); });
}

module.exports = { httpError };

if (require.main === module) {
  boot().catch((err) => {
    console.error('[boot] fatal:', err);
    process.exit(1);
  });
}
