'use strict';

/** Wipe the local embedded database (development only). */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const dbDir = path.join(__dirname, '..', 'data');
if (process.env.DATABASE_URL) {
  console.error('DATABASE_URL is set — refusing to wipe an external database.');
  process.exit(1);
}
fs.rmSync(dbDir, { recursive: true, force: true });
console.log('Local database wiped. Restart the server to recreate it.');
