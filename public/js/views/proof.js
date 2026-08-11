/* Real Work / Proof — premium gallery with categories and lightbox.
   Renders ONLY items from proof-data.js (real screenshots provided by the
   owner). Empty until real evidence is added. */
'use strict';

import { PROOF_ITEMS, PROOF_CATEGORIES, PROOF_NOTE } from '../proof-data.js';
import { esc, icon, fmtDate } from '../ui.js';

let lightboxIndex = 0;
let lightboxItems = [];

export async function proofView(el) {
  el.innerHTML = `
    <section class="section" style="padding-bottom:0">
      <div class="container">
        <div class="proof-head">
          <span class="eyebrow" style="justify-content:center">Proof of work</span>
          <h1>Real Work. <span style="font-style:italic;color:var(--accent)">Real Conversations.</span></h1>
          <p class="lead">Actual client conversations, strategy deliveries and channel progress — shared as evidence of how Agbota Segun works with creators.</p>
        </div>
        <div class="proof-note">
          ${icon('shield', 16)}
          <span>${esc(PROOF_NOTE)}</span>
        </div>
        <div class="proof-filters" role="tablist" aria-label="Filter proof by category" id="proof-filters">
          ${PROOF_CATEGORIES.map((c) => `<button class="chip ${c.id === 'all' ? 'active' : ''}" data-cat="${c.id}" role="tab" aria-selected="${c.id === 'all'}">${esc(c.label)}</button>`).join('')}
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
    renderGrid(content, b.dataset.cat);
  }));

  renderGrid(content, 'all');
}

function renderGrid(content, cat) {
  const items = cat === 'all' ? PROOF_ITEMS : PROOF_ITEMS.filter((i) => i.category === cat);

  if (!items.length) {
    const catLabel = PROOF_CATEGORIES.find((c) => c.id === cat)?.label || 'this category';
    content.innerHTML = `
      <div class="proof-empty">
        <span class="ic">${icon('camera', 24)}</span>
        <h3>${cat === 'all' ? 'Real work is being prepared' : `No ${catLabel.toLowerCase()} yet`}</h3>
        <p>${cat === 'all'
          ? 'Screenshots of real client conversations, strategy deliveries and channel progress will appear here as they become available. Nothing is shown unless it is real.'
          : 'Screenshots for this category will appear here as real evidence becomes available.'}</p>
        <div class="proof-filters" style="margin:0">
          ${PROOF_CATEGORIES.filter((c) => c.id !== 'all').map((c) => `
            <span class="chip" style="cursor:default">${esc(c.label)}</span>`).join('')}
        </div>
      </div>`;
    return;
  }

  content.innerHTML = `
    <div class="proof-grid">
      ${items.map((item, idx) => proofCard(item, idx)).join('')}
    </div>`;

  content.querySelectorAll('[data-proof]').forEach((card) => {
    card.addEventListener('click', () => openLightbox(items, Number(card.dataset.proof)));
  });
}

function proofCard(item, idx) {
  const cat = PROOF_CATEGORIES.find((c) => c.id === item.category);
  const date = item.date ? `<span class="pill gray">${esc(item.date)}</span>` : '';
  const platform = item.platform ? `<span class="pill amber">${esc(item.platform)}</span>` : '';
  return `
    <button class="proof-card" data-proof="${idx}" aria-label="Open full size: ${esc(item.title)}">
      <span class="proof-thumb">
        <span class="proof-cat">${esc(cat ? cat.short : item.category)}</span>
        <img src="${esc(item.image)}" alt="${esc(item.title)}" loading="lazy">
      </span>
      <span class="proof-body">
        <h3>${esc(item.title)}</h3>
        ${item.caption ? `<p>${esc(item.caption)}</p>` : ''}
        <span class="proof-meta">${platform}${date}</span>
      </span>
    </button>`;
}

/* ── Lightbox with prev/next, close, keyboard support ───────────────────── */
function openLightbox(items, startIdx) {
  lightboxItems = items;
  lightboxIndex = startIdx;
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
        <span class="lb-counter">${lightboxIndex + 1} / ${lightboxItems.length}</span>
        <button class="lightbox-close" data-action="lb-close" aria-label="Close">${icon('x', 18)}</button>
      </div>
      <div class="lightbox-stage">
        ${lightboxItems.length > 1 ? `
        <button class="lightbox-nav prev" data-action="lb-prev" aria-label="Previous">${icon('arrowLeft', 20)}</button>` : ''}
        <img src="${esc(item.image)}" alt="${esc(item.title)}">
        ${lightboxItems.length > 1 ? `
        <button class="lightbox-nav next" data-action="lb-next" aria-label="Next">${icon('arrowRight', 20)}</button>` : ''}
      </div>
      <div class="lightbox-foot">
        <span class="lb-cat">${esc(cat ? cat.label : item.category)}</span>
        ${item.caption ? `<p>${esc(item.caption)}</p>` : ''}
        ${item.platform || item.date ? `<p class="small" style="color:var(--muted-2)">${[item.platform, item.date].filter(Boolean).join(' · ')}</p>` : ''}
      </div>
    </div>`;

  root.querySelector('[data-action="lb-close"]').addEventListener('click', closeLightbox);
  const prev = root.querySelector('[data-action="lb-prev"]');
  const next = root.querySelector('[data-action="lb-next"]');
  if (prev) prev.addEventListener('click', () => { lightboxIndex = (lightboxIndex - 1 + lightboxItems.length) % lightboxItems.length; renderLightbox(); });
  if (next) next.addEventListener('click', () => { lightboxIndex = (lightboxIndex + 1) % lightboxItems.length; renderLightbox(); });

  root.addEventListener('click', (e) => { if (e.target.classList.contains('lightbox')) closeLightbox(); });
  document.addEventListener('keydown', lbKeydown);
}

function lbKeydown(e) {
  if (!document.querySelector('.lightbox')) { document.removeEventListener('keydown', lbKeydown); return; }
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') { lightboxIndex = (lightboxIndex - 1 + lightboxItems.length) % lightboxItems.length; renderLightbox(); }
  if (e.key === 'ArrowRight') { lightboxIndex = (lightboxIndex + 1) % lightboxItems.length; renderLightbox(); }
}

function closeLightbox() {
  document.getElementById('modal-root').innerHTML = '';
  document.removeEventListener('keydown', lbKeydown);
}
