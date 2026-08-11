/* Proof of Work — premium gallery driven by the database.
   Shows ONLY items the owner has explicitly published. Categories:
   conversations · strategy · analysis · progress · feedback · payouts.
   Lightbox: prev/next, close, zoom, keyboard, mobile swipe. */
'use strict';

import { api } from '../api.js';
import { esc, icon, fmtDate } from '../ui.js';

export const PROOF_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'conversations', label: 'Conversations', short: 'Client conversations' },
  { id: 'strategy', label: 'Strategy Work', short: 'Strategy delivery' },
  { id: 'analysis', label: 'Streamer Analysis', short: 'Streamer analysis' },
  { id: 'progress', label: 'Channel Progress', short: 'Channel progress' },
  { id: 'feedback', label: 'Feedback', short: 'Streamer feedback' },
  { id: 'payouts', label: 'Payout Evidence', short: 'Payout evidence' },
];

const TRANSPARENCY_NOTE =
  'These examples represent genuine work and evidence shared by creators. ' +
  'Results vary by creator, platform, content, consistency and other factors. ' +
  'Nothing on this page represents a guaranteed result.';

let lightboxIndex = 0;
let lightboxItems = [];
let zoomed = false;

export async function proofView(el) {
  let items = [];
  try {
    items = await api('/api/proof');
  } catch (_) { items = []; }

  el.innerHTML = `
    <section class="section" style="padding-bottom:0">
      <div class="container">
        <div class="proof-head">
          <span class="eyebrow" style="justify-content:center">Proof of work</span>
          <h1>Proof of Work</h1>
          <p class="lead">Real examples of strategy, analysis, communication and creator progress.</p>
        </div>
        <div class="proof-note">${icon('shield', 16)}<span>${esc(TRANSPARENCY_NOTE)}</span></div>
        <div class="proof-filters" role="tablist" aria-label="Filter proof by category" id="proof-filters">
          ${PROOF_CATEGORIES.map((c) => {
            const count = c.id === 'all' ? items.length : items.filter((i) => i.category === c.id).length;
            return `<button class="chip ${c.id === 'all' ? 'active' : ''}" data-cat="${c.id}" role="tab" aria-selected="${c.id === 'all'}">
              ${esc(c.label)}${count ? ` <span class="badge-count accent" style="margin-left:4px">${count}</span>` : ''}
            </button>`;
          }).join('')}
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div id="proof-content"></div>
      </div>
    </section>`;

  const content = el.querySelector('#proof-content');
  el.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
    el.querySelectorAll('[data-cat]').forEach((x) => {
      x.classList.toggle('active', x === b);
      x.setAttribute('aria-selected', String(x === b));
    });
    renderGrid(content, items, b.dataset.cat);
  }));

  renderGrid(content, items, 'all');
}

function renderGrid(content, items, cat) {
  const filtered = cat === 'all' ? items : items.filter((i) => i.category === cat);

  if (!filtered.length) {
    const catLabel = PROOF_CATEGORIES.find((c) => c.id === cat)?.label || 'this category';
    content.innerHTML = `
      <div class="proof-empty">
        <span class="ic">${icon('camera', 24)}</span>
        <h3>${cat === 'all' ? 'Real proof is being prepared' : `No ${catLabel.toLowerCase()} yet`}</h3>
        <p>${cat === 'all'
          ? 'Screenshots of real work — client conversations, strategy delivery, streamer analysis, channel progress, feedback and payout evidence — will appear here as the owner publishes them. Nothing is shown unless it is genuine.'
          : 'Genuine screenshots for this category will appear here as the owner publishes them.'}</p>
      </div>`;
    return;
  }

  content.innerHTML = `
    <div class="proof-grid">
      ${filtered.map((item, idx) => proofCard(item, idx)).join('')}
    </div>`;

  content.querySelectorAll('[data-proof]').forEach((card) => {
    card.addEventListener('click', () => openLightbox(filtered, Number(card.dataset.proof)));
  });
}

function proofCard(item, idx) {
  const cat = PROOF_CATEGORIES.find((c) => c.id === item.category);
  const date = item.item_date ? `<span class="pill gray">${esc(item.item_date)}</span>` : '';
  const platform = item.platform ? `<span class="pill amber">${esc(item.platform)}</span>` : '';
  return `
    <button class="proof-card" data-proof="${idx}" aria-label="View proof: ${esc(item.title)}">
      <span class="proof-thumb">
        <span class="proof-cat">${esc(cat ? cat.short : item.category)}</span>
        <img src="${esc(item.image_url)}" alt="${esc(item.title)}" loading="lazy">
      </span>
      <span class="proof-body">
        <h3>${esc(item.title)}</h3>
        ${item.caption ? `<p>${esc(item.caption)}</p>` : ''}
        <span class="proof-meta">${platform}${date}</span>
        <span class="btn btn-ghost btn-sm" style="pointer-events:none;justify-content:center">${icon('search', 15)}View Proof</span>
      </span>
    </button>`;
}

/* ── Lightbox: prev/next, close, zoom, keyboard, mobile swipe ───────────── */
function openLightbox(items, startIdx) {
  lightboxItems = items;
  lightboxIndex = startIdx;
  zoomed = false;
  renderLightbox();
}

function renderLightbox() {
  const item = lightboxItems[lightboxIndex];
  if (!item) return;
  const cat = PROOF_CATEGORIES.find((c) => c.id === item.category);
  const root = document.getElementById('modal-root');

  root.innerHTML = `
    <div class="lightbox" role="dialog" aria-modal="true" aria-label="${esc(item.title)}">
      <div class="lightbox-top">
        <span class="lb-caption"><b>${esc(item.title)}</b></span>
        <span class="flex" style="gap:10px">
          <span class="lb-counter">${lightboxIndex + 1} / ${lightboxItems.length}</span>
          <button class="lightbox-close" data-action="lb-close" aria-label="Close">${icon('x', 18)}</button>
        </span>
      </div>
      <div class="lightbox-stage ${zoomed ? 'zoomed' : ''}" id="lb-stage">
        ${lightboxItems.length > 1 ? `
        <button class="lightbox-nav prev" data-action="lb-prev" aria-label="Previous">${icon('arrowLeft', 20)}</button>` : ''}
        <img src="${esc(item.image_url)}" alt="${esc(item.title)}" id="lb-img">
        ${lightboxItems.length > 1 ? `
        <button class="lightbox-nav next" data-action="lb-next" aria-label="Next">${icon('arrowRight', 20)}</button>` : ''}
      </div>
      <div class="lightbox-foot">
        <span class="lb-cat">${esc(cat ? cat.label : item.category)}</span>
        ${item.caption ? `<p>${esc(item.caption)}</p>` : ''}
        ${item.platform || item.item_date ? `<p class="small" style="color:var(--muted-2)">${[item.platform, item.item_date].filter(Boolean).join(' · ')}</p>` : ''}
        <p class="micro" style="color:var(--muted-2);margin-top:4px">Click the image to zoom · ${icon('arrowLeft', 11)} ${icon('arrowRight', 11)} to navigate · Esc to close</p>
      </div>
    </div>`;

  root.querySelector('[data-action="lb-close"]').addEventListener('click', closeLightbox);
  const prev = root.querySelector('[data-action="lb-prev"]');
  const next = root.querySelector('[data-action="lb-next"]');
  if (prev) prev.addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
  if (next) next.addEventListener('click', (e) => { e.stopPropagation(); step(1); });

  // Click image toggles zoom; click backdrop closes.
  const stage = root.querySelector('#lb-stage');
  const img = root.querySelector('#lb-img');
  img.addEventListener('click', () => {
    zoomed = !zoomed;
    stage.classList.toggle('zoomed', zoomed);
  });
  root.addEventListener('click', (e) => {
    if (e.target.classList.contains('lightbox') || e.target.id === 'lb-stage') closeLightbox();
  });

  // Mobile swipe (touch)
  let touchX = null;
  stage.addEventListener('touchstart', (e) => { touchX = e.changedTouches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 48) step(dx < 0 ? 1 : -1);
    touchX = null;
  }, { passive: true });

  document.addEventListener('keydown', lbKeydown);
}

function step(dir) {
  zoomed = false;
  lightboxIndex = (lightboxIndex + dir + lightboxItems.length) % lightboxItems.length;
  renderLightbox();
}

function lbKeydown(e) {
  if (!document.querySelector('.lightbox')) { document.removeEventListener('keydown', lbKeydown); return; }
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
}

function closeLightbox() {
  document.getElementById('modal-root').innerHTML = '';
  zoomed = false;
  document.removeEventListener('keydown', lbKeydown);
}
