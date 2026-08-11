/* Strategies listing + product detail pages. */
'use strict';

import { store } from '../store.js';
import { esc, icon, money, toastOk, toastErr, openModal, closeModal, modalHead, statusPill } from '../ui.js';
import { productCard } from './public.js';
import { post } from '../api.js';

/* ── /strategies ────────────────────────────────────────────────────────── */
export async function strategiesView(el) {
  const products = store.products;
  const cats = [
    { id: 'all', label: 'All strategies' },
    { id: 'single', label: 'Single platform' },
    { id: 'bundle', label: 'Combined' },
    { id: 'custom', label: 'Custom' },
  ];

  el.innerHTML = `
    <section class="section" style="padding-bottom:0">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow">Strategy store</span>
          <h1 style="font-size:clamp(34px,4.6vw,52px);margin:12px 0 12px">Growth strategies</h1>
          <p class="lead">Every strategy is a practical written blueprint for your platforms — positioning, content structure, discovery and consistency — with direct support from Agbota Segun in chat.</p>
        </div>
        <div class="dash-tabs" role="tablist" aria-label="Filter strategies" id="cat-tabs">
          ${cats.map((c) => `<button class="chip nav-link ${c.id === 'all' ? 'active' : ''}" data-cat="${c.id}" style="border:1px solid var(--line-strong);border-radius:99px;padding:8px 16px;font-size:13.5px;font-weight:600">${c.label}</button>`).join('')}
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="grid-3" id="product-grid">
          ${products.map((p) => productCard(p)).join('')}
        </div>
      </div>
    </section>`;

  el.querySelectorAll('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('active', b === btn));
      const cat = btn.dataset.cat;
      const grid = el.querySelector('#product-grid');
      grid.innerHTML = products
        .filter((p) => cat === 'all' || p.category === cat)
        .map(productCard)
        .join('');
    });
  });
}

/* ── /strategies/:id ────────────────────────────────────────────────────── */
export async function productView(el, [id]) {
  const p = store.products.find((x) => x.id === id);
  if (!p) {
    el.innerHTML = `<div class="container" style="padding:80px 0"><div class="empty">${icon('search', 24)}<h3>Strategy not found</h3><p>The strategy you are looking for does not exist.</p><a class="btn btn-primary" href="/strategies" data-nav>Browse strategies</a></div></div>`;
    return;
  }

  el.innerHTML = `
    <section class="section">
      <div class="container">
        <nav aria-label="Breadcrumb" class="small muted" style="margin-bottom:18px">
          <a href="/strategies" data-nav>Strategies</a> <span style="opacity:.5">/</span> ${esc(p.name)}
        </nav>
        <div class="grid-2" style="align-items:start;gap:40px">
          <div>
            <div class="flex" style="gap:8px;flex-wrap:wrap;margin-bottom:14px">
              <span class="pill ${p.category === 'single' ? 'amber' : p.category === 'bundle' ? 'blue' : 'green'}">${esc(p.category === 'single' ? 'Single platform' : p.category === 'bundle' ? 'Combined strategy' : 'Custom strategy')}</span>
              ${(p.platforms || []).map((pl) => `<span class="platform-chip">${esc(pl)}</span>`).join('')}
            </div>
            <h1 style="font-size:clamp(32px,4vw,46px)">${esc(p.name)}</h1>
            <p class="lead mt-16">${esc(p.tagline)}</p>
            <p class="muted mt-16" style="line-height:1.75">${esc(p.description)}</p>
            <div class="card mt-24" style="background:var(--accent-soft);border-color:var(--accent-line)">
              <div class="flex-between">
                <div>
                  <div class="muted micro" style="letter-spacing:.1em;text-transform:uppercase;font-weight:600">Price</div>
                  <div class="price" style="font-size:34px">${money(p.price_cents)}${p.id === 'custom-multi' ? '<small> starting</small>' : ''}</div>
                </div>
                <div style="text-align:right">
                  <div class="muted micro" style="letter-spacing:.1em;text-transform:uppercase;font-weight:600">Digital product</div>
                  <div class="small mt-8">Delivered personally after<br>payment is confirmed.</div>
                </div>
              </div>
              <div class="flex mt-16" style="flex-wrap:wrap">
                <button class="btn btn-primary btn-lg" data-action="buy" data-id="${esc(p.id)}">${icon('box', 18)}Purchase strategy</button>
                <button class="btn btn-ghost btn-lg" data-action="chat-about" data-id="${esc(p.id)}">${icon('chat', 18)}Ask about this</button>
              </div>
            </div>
          </div>
          <div class="stack" style="position:sticky;top:calc(var(--nav-h) + 24px)">
            <div class="card">
              <h3 style="font-size:19px">What's included</h3>
              <ul class="stack mt-16" style="list-style:none;padding:0;margin:0">
                ${(p.includes || []).map((i) => `
                  <li class="flex" style="gap:11px;align-items:flex-start">
                    <span style="color:var(--accent);margin-top:2px">${icon('check', 16, 2.4)}</span>
                    <span class="small" style="line-height:1.55">${esc(i)}</span>
                  </li>`).join('')}
              </ul>
            </div>
            <div class="card">
              <h3 style="font-size:19px">Who it's for</h3>
              <ul class="stack mt-16" style="list-style:none;padding:0;margin:0">
                ${(p.audience || []).map((a) => `
                  <li class="flex" style="gap:11px;align-items:flex-start">
                    <span style="color:var(--accent);margin-top:2px">${icon('users', 16)}</span>
                    <span class="small" style="line-height:1.55">${esc(a)}</span>
                  </li>`).join('')}
              </ul>
            </div>
            <div class="card" style="border-color:var(--line-strong)">
              <div class="flex" style="gap:12px">
                <span style="color:var(--accent)">${icon('shield', 20)}</span>
                <p class="small muted" style="line-height:1.6">Clear digital product explanation: this is a written strategy document and ongoing guidance — not software, not a subscription. It is delivered after your payment is confirmed, and every order includes direct chat support.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>`;

  el.querySelector('[data-action="buy"]').addEventListener('click', () => buyStrategy(p));
  el.querySelector('[data-action="chat-about"]').addEventListener('click', () => {
    if (store.user) {
      location.href = store.user.role === 'owner' ? '/admin/messages' : '/dashboard/chat';
    } else {
      toastInfo('Create an account', 'Create a free streamer account to chat with Agbota Segun.');
      location.href = '/signup?next=' + encodeURIComponent(location.pathname);
    }
  });
}

/* ── Purchase flow (creates a REAL order in the database) ───────────────── */
export async function buyStrategy(product) {
  if (!store.user) {
    toastInfo('Account required', 'Create a free streamer account to place your order.');
    location.href = '/signup?next=/strategies/' + encodeURIComponent(product.id);
    return;
  }
  if (store.user.role === 'owner') {
    toastErr('Owner account', 'Place orders from a streamer account.');
    return;
  }

  openModal(`
    ${modalHead(`Order ${esc(product.name)}`)}
    <div class="modal-body">
      <div class="flex-between">
        <div>
          <div class="muted micro" style="text-transform:uppercase;letter-spacing:.1em">Price</div>
          <div class="price" style="font-size:28px">${money(product.price_cents)}</div>
        </div>
        <span class="pill amber">Digital strategy</span>
      </div>
      <p class="small muted" style="line-height:1.6">Place this order now and pay after. Your payment is confirmed personally by Agbota Segun before the strategy is delivered.</p>
      <button class="btn btn-primary btn-lg btn-block" id="confirm-order" style="justify-content:center">${icon('box', 18)}Place order — ${money(product.price_cents)}</button>
      <p class="micro muted" style="text-align:center">Creating a real order on your account…</p>
    </div>`);

  const btn = document.getElementById('confirm-order');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.innerHTML = `<span class="spin">${icon('refresh', 16)}</span> Creating order…`;
    try {
      const order = await post('/api/orders', { productId: product.id });
      closeModal();
      toastOk('Order placed', `${order.order_number} — awaiting payment.`);
      location.href = `/dashboard/orders?order=${encodeURIComponent(order.id)}&placed=1`;
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `Place order — ${money(product.price_cents)}`;
      toastErr('Could not place order', err.message);
    }
  });
}
