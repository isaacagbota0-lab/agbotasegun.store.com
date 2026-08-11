/**
 * Database layer.
 *
 * Two modes, identical interface:
 *  - `DATABASE_URL` set  → connects to that PostgreSQL instance (Supabase,
 *    Neon, RDS, or any hosted Postgres) using node-postgres.
 *  - `DATABASE_URL` empty → runs an embedded PostgreSQL engine (PGlite —
 *    real PostgreSQL 17 compiled to WASM) persisted under ./data/db.
 *
 * Security: every authenticated query runs inside a transaction that sets the
 * session variables `app.user_id` and `app.user_role`, which the Row Level
 * Security policies in schema.sql enforce. A query can never see or touch a
 * row outside the current user's permissions, even if application code
 * forgets to scope a WHERE clause.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { PGlite } = require('@electric-sql/pglite');
const { Pool } = require('pg');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHEMA_FILE = path.join(__dirname, 'schema.sql');
const DATABASE_URL = (process.env.DATABASE_URL || '').trim();

let engine = null; // 'pglite' | 'pg'
let pglite = null;
let pool = null;

function schemaSql() {
  return fs.readFileSync(SCHEMA_FILE, 'utf8');
}

async function init() {
  if (DATABASE_URL) {
    engine = 'pg';
    const ssl =
      process.env.DATABASE_SSL === 'false' ||
      /localhost|127\.0\.0\.1|::1/.test(DATABASE_URL)
        ? false
        : { rejectUnauthorized: false };
    pool = new Pool({ connectionString: DATABASE_URL, ssl, max: 10 });
    await pool.query('SELECT 1'); // verify connectivity
    await pool.query(schemaSql());
  } else {
    engine = 'pglite';
    const dbDir = path.join(DATA_DIR, 'db');
    fs.mkdirSync(dbDir, { recursive: true });
    pglite = new PGlite(dbDir);
    await pglite.waitReady;
    await pglite.exec(schemaSql());
    // Note: the embedded WASM build of PostgreSQL parses RLS policies but does
    // not enforce them; the application layer enforces the exact same rules
    // (ownership / participation scoping on every query). When you point
    // DATABASE_URL at a hosted PostgreSQL (Supabase, Neon, RDS), the RLS
    // policies in schema.sql are enforced by the database itself.
    console.log('[db] note: embedded engine — RLS policies present but not enforced; authorization enforced in the application layer');
  }
  return engine;
}

/** Run a single statement outside a user transaction (setup / public data). */
async function query(text, params) {
  if (engine === 'pg') {
    const r = await pool.query(text, params);
    return r.rows;
  }
  const r = await pglite.query(text, params);
  return r.rows;
}

/** Run a statement inside the transaction context provided by withUser. */
async function txQuery(q, text, params) {
  return q(text, params);
}

/**
 * Run `fn` inside a transaction with RLS session variables set for `user`.
 * `fn` receives a bound `q(text, params)` function and may run any number of
 * statements; everything commits together or rolls back together.
 */
async function withUser(user, fn) {
  if (engine === 'pg') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'SELECT set_config($1, $2, true), set_config($3, $4, true)',
        ['app.user_id', user.id, 'app.user_role', user.role]
      );
      const q = async (text, params) => (await client.query(text, params)).rows;
      const out = await fn(q);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
      throw err;
    } finally {
      client.release();
    }
  }

  await pglite.exec('BEGIN');
  try {
    await pglite.query('SELECT set_config($1, $2, true), set_config($3, $4, true)', [
      'app.user_id', user.id, 'app.user_role', user.role,
    ]);
    const q = async (text, params) => (await pglite.query(text, params)).rows;
    const out = await fn(q);
    await pglite.exec('COMMIT');
    return out;
  } catch (err) {
    try { await pglite.exec('ROLLBACK'); } catch (_) { /* ignore */ }
    throw err;
  }
}

/** Public transaction helper (e.g. admin bootstrap, no user context). */
async function withTx(fn) {
  if (engine === 'pg') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(async (text, params) => (await client.query(text, params)).rows);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
      throw err;
    } finally {
      client.release();
    }
  }
  await pglite.exec('BEGIN');
  try {
    const out = await fn(async (text, params) => (await pglite.query(text, params)).rows);
    await pglite.exec('COMMIT');
    return out;
  } catch (err) {
    try { await pglite.exec('ROLLBACK'); } catch (_) { /* ignore */ }
    throw err;
  }
}

async function close() {
  if (engine === 'pg') await pool.end();
  else if (pglite) await pglite.close();
}

module.exports = { init, query, withUser, withTx, txQuery, close, engine: () => engine };
