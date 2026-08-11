'use strict';
/* Renders the Open Graph image (1200×630) from SVG using the real Fraunces
   font, so the typography is pixel-perfect. Run: node scripts/render-og.js */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const fraunces = fs.readFileSync(
  path.join(__dirname, '..', 'node_modules', '@fontsource-variable', 'fraunces', 'files', 'fraunces-latin-wght-normal.woff2')
).toString('base64');

const dmSans = fs.readFileSync(
  path.join(__dirname, '..', 'node_modules', '@fontsource-variable', 'dm-sans', 'files', 'dm-sans-latin-wght-normal.woff2')
).toString('base64');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <style>
      @font-face { font-family: 'Fraunces'; src: url(data:font/woff2;base64,${fraunces}) format('woff2'); font-weight: 100 900; }
      @font-face { font-family: 'DMSans'; src: url(data:font/woff2;base64,${dmSans}) format('woff2'); font-weight: 100 900; }
    </style>
    <radialGradient id="glow" cx="50%" cy="38%" r="55%">
      <stop offset="0%" stop-color="#d4a853" stop-opacity="0.22"/>
      <stop offset="55%" stop-color="#d4a853" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#d4a853" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e8c57e"/>
      <stop offset="100%" stop-color="#c99a44"/>
    </linearGradient>
    <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#d4a853" stop-opacity="0"/>
      <stop offset="50%" stop-color="#d4a853" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#d4a853" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#0a0c12"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="60" y="60" width="1080" height="510" rx="24" fill="none" stroke="#d4a853" stroke-opacity="0.25" stroke-width="1.5"/>
  <line x1="300" y1="196" x2="900" y2="196" stroke="url(#line)" stroke-width="1.5"/>
  <text x="600" y="290" text-anchor="middle" font-family="Fraunces" font-size="96" font-weight="600" fill="#f3f0e9" letter-spacing="-2">Agbota <tspan fill="url(#gold)">Segun</tspan></text>
  <text x="600" y="362" text-anchor="middle" font-family="DMSans" font-size="30" font-weight="500" fill="#9aa1b2" letter-spacing="6">CREATOR &amp; STREAMER GROWTH STRATEGIES</text>
  <line x1="300" y1="420" x2="900" y2="420" stroke="url(#line)" stroke-width="1.5"/>
  <text x="600" y="478" text-anchor="middle" font-family="DMSans" font-size="19" font-weight="400" fill="#6d7485" letter-spacing="1">Twitch · YouTube · TikTok · Facebook · Instagram · Discord</text>
</svg>`;

sharp(Buffer.from(svg)).png().toFile(path.join(__dirname, '..', 'public', 'assets', 'og.png'))
  .then(() => console.log('og.png rendered'))
  .catch((e) => { console.error(e); process.exit(1); });
