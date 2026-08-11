'use strict';

require('dotenv').config();
const path = require('path');
const crypto = require('crypto');

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  port: Number(process.env.PORT) || 3000,
  isProd,
  // Never commit a real secret; if unset we generate one (sessions reset on restart).
  jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex'),
  cookieName: 'as_session',
  adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || '',
  btcAddress: (process.env.BTC_ADDRESS || '').trim(),
  paypalInstructions: process.env.PAYPAL_INSTRUCTIONS ||
    'PayPal payments are arranged personally through Chat after you place your order.',
  maxUploadBytes: (Number(process.env.MAX_UPLOAD_MB) || 20) * 1024 * 1024,
  dataDir: path.join(__dirname, '..', 'data'),
  uploadsDir: path.join(__dirname, '..', 'data', 'uploads'),
};
