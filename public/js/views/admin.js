/* Owner / Admin dashboard — /admin and tabs. Every number is real database data. */
'use strict';

import { api, post, patch } from '../api.js';
import { store, refreshAdmin, refreshOrders } from '../store.js';
import { esc, icon, money, fmtDate, fmtDateTime, timeAgo, toastOk, toastErr, openModal, closeModal, modalHead, statusPill, emptyState, skeleton } from '../ui.js';
import { renderChatPage } from './chat.js';
import { navigate, avatar } from '../app.js';

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'streamers', label: 'Streamers', icon: 'users' },
  { id: 'messages', label: 'Messages', icon: 'chat' },
  { id: 'orders', label: 'Orders', icon: 'orders' },
  { id: 'payments', label: 'Payments', icon: 'payments' },
  { id: 'products', label: 'Products', icon: 'box' },
  { id: 'reviews', label: 'Reviews', icon: 'star' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export async function adminView(el, [tab = 'overview']) {
  const active = TABS.find((t) => t.id === tab) ? tab : 'overview';
  el.innerHTML = `
    <div class="dash">
      <aside class="dash-side">
        ${TABS.map((t) => `
          <button class="dash-link ${active === t.id ? 'active' : ''}" data-tab="${t.id}">
            ${icon(t.icon, 18)}${t.label}
            ${t.id === 'messages' ? `<span data-unread-badge></span>` : ''}
            ${t.id === 'reviews' ? `<span id="review-count-badge"></span>` : ''}
          </button>`).join('')}
        <div class="side-foot">
          <button class="dash-link" data-action="logout">${icon('logout', 18)}Logout</button>
        </div>
      </aside>
      <main class="dash-main" id="dash-main"></main>
    </div>`;

  el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => navigate('/admin/' + b.dataset.tab)));

  const main = el.querySelector('#dash-main');
  main.classList.toggle('chat-mode', active === 'messages');
  const views = {
    overview: renderOverview, streamers: renderStreamers, messages: renderMessages,
    orders: renderOrders, payments: renderPayments, products: renderProducts,
    reviews: renderReviews, settings: renderSettings,
  };
  await views[active](main);
}

/* ── Overview ───────────────────────────────────────────────────────────── */
async function renderOverview(main) {
  main.innerHTML = `
    <div class="dash-head">
      <div>
        <div class="crumb">Owner dashboard</div>
        <h1>Overview</h1>
      </div>
      <p class="muted small" style="max-width:360px">Live numbers from the database — new streamers appear here automatically.</p>
    </div>
    <div class="stat-grid" id="stats">${skeleton(4, 64)}</div>
    <div class="grid-2" style="grid-template-columns:1fr 1fr;align-items:start">
      <div class="card">
        <h2 style="font-size:20px">Newest streamers</h2>
        <div class="mt-16" id="new-streamers">${skeleton(4)}</div>
      </div>
      <div class="card">
        <h2 style="font-size:20px">Recent orders</h2>
        <div class="mt-16" id="recent-orders">${skeleton(4)}</div>
      </div>
    </div>`;

  try {
    await refreshAdmin();
  } catch (_) { /* render with whatever data we have */ }
  const s = store.stats;
  if (!s) return;
  main.querySelector('#stats').innerHTML = `
    ${statCard('Registered streamers', s.streamers, 'users', 'appear in your contacts automatically')}
    ${statCard('Unread messages', s.unread_messages, 'chat', 'waiting for your reply', true)}
    ${statCard('Orders', s.orders, 'orders', 'real orders on the platform')}
    ${statCard('Pending payments', s.pending_payments, 'payments', 'awaiting your confirmation', true)}
    ${statCard('Completed orders', s.completed_orders, 'checkCircle', 'delivered and finished')}
    ${statCard('Reviews to moderate', s.pending_reviews, 'star', 'awaiting your decision')}`;

  const ns = main.querySelector('#new-streamers');
  ns.innerHTML = s.recent_streamers.length
    ? `<div class="stack">${s.recent_streamers.map((u) => `
        <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--line)">
          <div class="avatar-row">${avatar(u.name, 36)}
            <div class="ar-main"><div class="ar-name">${esc(u.name)}</div><div class="ar-sub">${esc(u.email)} · joined ${fmtDate(u.created_at)}</div></div>
          </div>
          <div class="flex" style="gap:8px">
            ${u.unread ? `<span class="badge-count">${u.unread}</span>` : ''}
            <button class="btn btn-ghost btn-sm" data-action="msg-streamer" data-id="${esc(u.id)}">${icon('chat', 14)}</button>
          </div>
        </div>`).join('')}</div>`
    : emptyState('users', 'No streamers yet', 'When a streamer registers, they appear here and in your contacts automatically.');

  ns.querySelectorAll('[data-action="msg-streamer"]').forEach((b) => b.addEventListener('click', async () => {
    await api(`/api/conversations/start/${b.dataset.id}`, { method: 'POST' }).catch(() => {});
    navigate('/admin/messages?streamer=' + b.dataset.id);
  }));

  const ro = main.querySelector('#recent-orders');
  ro.innerHTML = s.recent_orders.length
    ? `<div class="stack">${s.recent_orders.map((o) => `
        <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--line)">
          <div>
            <b class="small">${esc(o.order_number)}</b>
            <div class="ar-sub small muted">${esc(o.streamer_name)} · ${esc(o.product_name)} · ${money(o.price_cents)}</div>
          </div>
          ${statusPill(o.payment_status === 'review' ? 'review' : o.payment_status === 'confirmed' ? 'confirmed' : 'awaiting')}
        </div>`).join('')}</div>`
    : emptyState('orders', 'No orders yet', 'Orders placed by streamers appear here.');

  updateReviewBadge(s.pending_reviews);
}

function statCard(label, value, ic, hint, accent = false) {
  return `<div class="card stat-card">
    <span class="label">${esc(label)}</span>
    <span class="value ${accent ? 'accent' : ''}">${value}</span>
    <span class="hint">${esc(hint)}</span>
  </div>`;
}

function updateReviewBadge(n) {
  const el = document.getElementById('review-count-badge');
  if (el) el.innerHTML = n > 0 ? `<span class="badge-count accent">${n}</span>` : '';
}

/* ── Streamers ──────────────────────────────────────────────────────────── */
async function renderStreamers(main) {
  main.innerHTML = `
    <div class="dash-head">
      <div>
        <div class="crumb">Owner dashboard</div>
        <h1>Streamers</h1>
      </div>
      <input class="input" id="streamer-search" type="search" placeholder="Search by name or email…" style="width:280px" aria-label="Search streamers">
    </div>
    <div class="table-wrap"><div id="streamers-table">${skeleton(5)}</div></div>`;

  const load = async (q = '') => {
    const list = await api('/api/admin/streamers' + (q ? `?q=${encodeURIComponent(q)}` : ''));
    const box = main.querySelector('#streamers-table');
    if (!list.length) {
      box.innerHTML = `<div class="empty" style="padding:50px 20px">${icon('users', 24)}<h3>${q ? 'No streamers match your search' : 'No streamers registered yet'}</h3><p>${q ? 'Try a different name or email.' : 'When a streamer creates an account, they appear here automatically — and you can message them first.'}</p></div>`;
      return;
    }
    box.innerHTML = `
      <table class="data">
        <thead><tr><th>Streamer</th><th>Registered</th><th>Orders</th><th>Payment</th><th>Unread</th><th>Last message</th><th></th></tr></thead>
        <tbody>
          ${list.map((u) => `
            <tr class="row-link" data-streamer="${esc(u.id)}">
              <td>
                <div class="avatar-row">${avatar(u.name, 36)}
                  <div class="ar-main"><div class="ar-name">${esc(u.name)}</div><div class="ar-sub">${esc(u.email)}</div></div>
                </div>
              </td>
              <td class="small muted">${fmtDate(u.created_at)}</td>
              <td>${u.order_count}</td>
              <td>${u.pending_payments ? `<span class="pill amber">${u.pending_payments} pending</span>` : `<span class="pill gray">—</span>`}</td>
              <td>${u.unread ? `<span class="badge-count">${u.unread}</span>` : '<span class="muted small">—</span>'}</td>
              <td class="small muted">${u.last_message_at ? `${u.last_message_type === 'text' ? 'message' : u.last_message_type} · ${timeAgo(u.last_message_at)}` : '<span class="ci-new" style="color:var(--accent);font-weight:700">New — message first</span>'}</td>
              <td style="text-align:right">
                <button class="btn btn-ghost btn-sm" data-action="msg-streamer" data-id="${esc(u.id)}">${icon('chat', 14)} Message</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    box.querySelectorAll('[data-action="msg-streamer"]').forEach((b) => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      await api(`/api/conversations/start/${b.dataset.id}`, { method: 'POST' }).catch(() => {});
      navigate('/admin/messages?streamer=' + b.dataset.id);
    }));
    box.querySelectorAll('[data-streamer]').forEach((tr) => tr.addEventListener('click', () => streamerModal(tr.dataset.streamer)));
  };

  await load();
  main.querySelector('#streamer-search').addEventListener('input', debounce((e) => load(e.target.value.trim()), 300));
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

async function streamerModal(id) {
  const d = await api('/api/admin/streamers/' + id);
  openModal(`
    ${modalHead(d.name)}
    <div class="modal-body">
      <div class="flex" style="gap:14px">
        ${avatar(d.name, 52)}
        <div>
          <div class="muted micro" style="text-transform:uppercase;letter-spacing:.08em">Streamer</div>
          <div class="flex" style="gap:10px"><b style="font-size:17px">${esc(d.name)}</b></div>
          <div class="muted small">${esc(d.email)} · joined ${fmtDate(d.created_at)}</div>
        </div>
      </div>
      <div class="grid-3" style="grid-template-columns:repeat(3,1fr)">
        <div class="card" style="padding:14px;text-align:center"><b style="font-size:22px">${d.orders.length}</b><div class="muted micro">Orders</div></div>
        <div class="card" style="padding:14px;text-align:center"><b style="font-size:22px">${d.orders.filter((o) => o.payment_status === 'review').length}</b><div class="muted micro">Pending payments</div></div>
        <div class="card" style="padding:14px;text-align:center"><b style="font-size:22px">${d.orders.filter((o) => o.order_status === 'completed').length}</b><div class="muted micro">Completed</div></div>
      </div>
      <div>
        <b class="small">Orders</b>
        <div class="stack mt-8">
          ${d.orders.length ? d.orders.map((o) => `
            <div class="flex-between" style="border:1px solid var(--line);border-radius:10px;padding:10px 12px">
              <div><b class="small">${esc(o.order_number)}</b><div class="muted micro">${esc(o.product_name)} · ${money(o.price_cents)}</div></div>
              ${statusPill(o.payment_status === 'review' ? 'review' : o.payment_status === 'confirmed' ? 'confirmed' : 'awaiting')}
            </div>`).join('') : '<p class="muted small">No orders yet.</p>'}
        </div>
      </div>
      <button class="btn btn-primary btn-block" data-action="msg-streamer-modal" data-id="${esc(d.id)}" style="justify-content:center">${icon('chat', 16)}Start a conversation</button>
    </div>`);
  document.querySelector('[data-action="msg-streamer-modal"]').addEventListener('click', async (e) => {
    await api(`/api/conversations/start/${e.currentTarget.dataset.id}`, { method: 'POST' }).catch(() => {});
    closeModal();
    navigate('/admin/messages?streamer=' + e.currentTarget.dataset.id);
  });
}

/* ── Messages ───────────────────────────────────────────────────────────── */
async function renderMessages(main) {
  main.innerHTML = '';
  await renderChatPage(main, { admin: true });
  const sid = new URLSearchParams(location.search).get('streamer');
  if (sid) {
    history.replaceState({}, '', '/admin/messages');
    try {
      const d = await api(`/api/conversations/start/${sid}`, { method: 'POST' });
      if (d.conversation) {
        await import('./chat.js').then((m) => m.openConversation(d.conversation.id));
      }
    } catch (_) { /* conversation will exist */ }
  }
}

/* ── Orders ─────────────────────────────────────────────────────────────── */
async function renderOrders(main) {
  main.innerHTML = `
    <div class="dash-head">
      <div>
        <div class="crumb">Owner dashboard</div>
        <h1>Orders</h1>
      </div>
    </div>
    <div class="table-wrap"><div id="admin-orders">${skeleton(5)}</div></div>`;

  await refreshAdmin();
  const orders = store.adminOrders;
  const box = main.querySelector('#admin-orders');
  if (!orders.length) {
    box.innerHTML = `<div class="empty">${icon('orders', 24)}<h3>No orders yet</h3><p>Orders placed by streamers appear here.</p></div>`;
    return;
  }
  box.innerHTML = `
    <table class="data">
      <thead><tr><th>Order</th><th>Streamer</th><th>Product</th><th>Price</th><th>Payment</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
      <tbody>
        ${orders.map((o) => `
          <tr>
            <td class="cell-main">${esc(o.order_number)}</td>
            <td>${esc(o.streamer_name)}</td>
            <td class="small">${esc(o.product_name)}</td>
            <td>${money(o.price_cents)}</td>
            <td>${o.payment_status === 'confirmed'
              ? `<span class="pay-done">${icon('checkCircle', 15)}Confirmed</span>`
              : o.payment_status === 'review'
                ? `<span class="pill amber">Review</span>`
                : `<span class="pill gray">Awaiting</span>`}</td>
            <td>${statusPill(o.order_status)}</td>
            <td class="small muted">${fmtDate(o.created_at)}</td>
            <td>
              <div class="flex" style="gap:6px;flex-wrap:wrap">
                ${o.payment_status === 'review'
                  ? `<button class="btn btn-primary btn-sm" data-action="confirm-pay" data-id="${esc(o.id)}">${icon('check', 14)}Confirm payment</button>
                     <button class="btn btn-danger btn-sm" data-action="reject-pay" data-id="${esc(o.id)}">Reject</button>`
                  : ''}
                ${o.payment_status === 'confirmed'
                  ? `<select class="input" style="width:auto;padding:7px 30px 7px 10px;font-size:12.5px" data-action="set-status" data-id="${esc(o.id)}">
                      ${['confirmed', 'in_progress', 'delivered', 'completed', 'cancelled'].map((s) => `<option value="${s}" ${o.order_status === s ? 'selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('')}
                    </select>`
                  : ''}
                <a class="btn btn-ghost btn-sm" href="/dashboard/chat" data-nav hidden></a>
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  box.querySelectorAll('[data-action="confirm-pay"]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      await post(`/api/orders/${b.dataset.id}/confirm-payment`, {});
      toastOk('Payment confirmed', 'The streamer now sees PAYMENT CONFIRMED.');
      await refreshAdmin();
      renderOrders(main);
    } catch (err) { toastErr('Could not confirm payment', err.message); b.disabled = false; }
  }));
  box.querySelectorAll('[data-action="reject-pay"]').forEach((b) => b.addEventListener('click', async () => {
    const reason = window.prompt('Reason (visible to the streamer in Chat)?', '');
    if (reason === null) return;
    try {
      await post(`/api/orders/${b.dataset.id}/reject-payment`, { reason });
      toastOk('Payment rejected', 'The order is back to awaiting payment.');
      await refreshAdmin();
      renderOrders(main);
    } catch (err) { toastErr('Could not reject payment', err.message); }
  }));
  box.querySelectorAll('[data-action="set-status"]').forEach((sel) => sel.addEventListener('change', async () => {
    try {
      await post(`/api/orders/${sel.dataset.id}/status`, { status: sel.value });
      toastOk('Order updated', `Status changed to ${sel.value.replace(/_/g, ' ')}.`);
      await refreshAdmin();
      renderOrders(main);
    } catch (err) { toastErr('Could not update order', err.message); }
  }));
}

/* ── Payments ───────────────────────────────────────────────────────────── */
async function renderPayments(main) {
  main.innerHTML = `
    <div class="dash-head">
      <div>
        <div class="crumb">Owner dashboard</div>
        <h1>Payments</h1>
      </div>
    </div>
    <div class="table-wrap"><div id="admin-payments">${skeleton(5)}</div></div>`;

  await refreshAdmin();
  const payments = store.adminPayments;
  const box = main.querySelector('#admin-payments');
  if (!payments.length) {
    box.innerHTML = `<div class="empty">${icon('payments', 24)}<h3>No payments yet</h3><p>When a streamer reports a payment, it appears here for review.</p></div>`;
    return;
  }
  box.innerHTML = `
    <table class="data">
      <thead><tr><th>Streamer</th><th>Order</th><th>Product</th><th>Method</th><th>Reference</th><th>Status</th><th>Reported</th></tr></thead>
      <tbody>
        ${payments.map((p) => `
          <tr>
            <td class="cell-main">${esc(p.streamer_name)}</td>
            <td>${esc(p.order_number)}</td>
            <td class="small">${esc(p.product_name)}</td>
            <td class="small">${esc(p.method.toUpperCase())}</td>
            <td class="small muted">${esc(p.reference || '—')}${p.note ? `<div class="micro muted">${esc(p.note)}</div>` : ''}</td>
            <td>${statusPill(p.status)}</td>
            <td class="small muted">${fmtDateTime(p.created_at)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

/* ── Products ───────────────────────────────────────────────────────────── */
async function renderProducts(main) {
  main.innerHTML = `
    <div class="dash-head">
      <div>
        <div class="crumb">Owner dashboard</div>
        <h1>Products</h1>
      </div>
      <p class="muted small" style="max-width:360px">Manage the catalog. Prices are published as set — edit them only when you intend to change them.</p>
    </div>
    <div class="table-wrap"><div id="admin-products">${skeleton(6)}</div></div>`;

  await refreshAdmin();
  const products = store.products;
  const box = main.querySelector('#admin-products');
  if (!products.length) {
    box.innerHTML = `<div class="empty">${icon('box', 24)}<h3>No products</h3></div>`;
    return;
  }
  box.innerHTML = `
    <table class="data">
      <thead><tr><th>Product</th><th>Category</th><th>Platforms</th><th>Price</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${products.map((p) => `
          <tr>
            <td><b class="small">${esc(p.name)}</b><div class="micro muted">${esc(p.id)}</div></td>
            <td><span class="pill ${p.category === 'single' ? 'amber' : p.category === 'bundle' ? 'blue' : 'green'}">${esc(p.category)}</span></td>
            <td class="small">${esc((p.platforms || []).join(', '))}</td>
            <td>${money(p.price_cents)}</td>
            <td>${p.active ? '<span class="pill green">Active</span>' : '<span class="pill gray">Hidden</span>'}</td>
            <td style="text-align:right"><button class="btn btn-ghost btn-sm" data-action="edit-product" data-id="${esc(p.id)}">${icon('edit', 14)} Edit</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  box.querySelectorAll('[data-action="edit-product"]').forEach((b) => b.addEventListener('click', () => productModal(products.find((p) => p.id === b.dataset.id), main)));
}

function productModal(p, main) {
  openModal(`
    ${modalHead(`Edit — ${p.name}`)}
    <div class="modal-body">
      <div class="field">
        <label>Name</label>
        <input class="input" id="pd-name" value="${esc(p.name)}" maxlength="120">
      </div>
      <div class="field">
        <label>Price (USD)</label>
        <input class="input" id="pd-price" type="number" min="0" step="1" value="${(p.price_cents / 100).toFixed(0)}">
      </div>
      <div class="field">
        <label>Tagline</label>
        <input class="input" id="pd-tagline" value="${esc(p.tagline)}" maxlength="200">
      </div>
      <div class="field">
        <label>Description</label>
        <textarea class="input" id="pd-desc" rows="4" maxlength="3000">${esc(p.description)}</textarea>
      </div>
      <div class="field">
        <label>What's included (one per line)</label>
        <textarea class="input" id="pd-includes" rows="4">${esc((p.includes || []).join('\n'))}</textarea>
      </div>
      <div class="field">
        <label>Who it's for (one per line)</label>
        <textarea class="input" id="pd-audience" rows="3">${esc((p.audience || []).join('\n'))}</textarea>
      </div>
      <div class="field">
        <label>Visibility</label>
        <select class="input" id="pd-active">
          <option value="true" ${p.active ? 'selected' : ''}>Visible in store</option>
          <option value="false" ${!p.active ? 'selected' : ''}>Hidden</option>
        </select>
      </div>
      <button class="btn btn-primary btn-block" id="pd-save" style="justify-content:center">Save changes</button>
    </div>`);

  document.getElementById('pd-save').addEventListener('click', async () => {
    const btn = document.getElementById('pd-save');
    btn.disabled = true;
    const body = {
      name: document.getElementById('pd-name').value.trim(),
      price_cents: Math.round(Number(document.getElementById('pd-price').value) * 100),
      tagline: document.getElementById('pd-tagline').value.trim(),
      description: document.getElementById('pd-desc').value.trim(),
      includes: document.getElementById('pd-includes').value.split('\n').map((s) => s.trim()).filter(Boolean),
      audience: document.getElementById('pd-audience').value.split('\n').map((s) => s.trim()).filter(Boolean),
      active: document.getElementById('pd-active').value === 'true',
    };
    try {
      await patch(`/api/admin/products/${p.id}`, body);
      closeModal();
      toastOk('Product updated', `${body.name} was saved.`);
      await refreshAdmin();
      renderProducts(main);
    } catch (err) {
      btn.disabled = false;
      toastErr('Could not save product', err.message);
    }
  });
}

/* ── Reviews ────────────────────────────────────────────────────────────── */
async function renderReviews(main) {
  main.innerHTML = `
    <div class="dash-head">
      <div>
        <div class="crumb">Owner dashboard</div>
        <h1>Reviews</h1>
      </div>
    </div>
    <div class="stack" id="admin-reviews">${skeleton(4)}</div>`;

  await refreshAdmin();
  const reviews = store.adminReviews;
  const box = main.querySelector('#admin-reviews');
  if (!reviews.length) {
    box.innerHTML = `<div class="card">${emptyState('star', 'No reviews yet', 'Reviews submitted by streamers with completed orders appear here for moderation.')}</div>`;
    updateReviewBadge(0);
    return;
  }
  box.innerHTML = reviews.map((r) => `
    <div class="card">
      <div class="flex-between">
        <div class="avatar-row">${avatar(r.streamer_name, 38)}
          <div>
            <b class="small">${esc(r.streamer_name)}</b>
            <div class="micro muted">${esc(r.product_name)} · ${esc(r.order_number)} · ${fmtDate(r.created_at)}</div>
          </div>
        </div>
        <div class="flex" style="gap:8px">
          <span class="small" style="color:var(--accent);letter-spacing:2px">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
          ${statusPill(r.status)}
        </div>
      </div>
      <p class="small muted mt-16" style="line-height:1.65">“${esc(r.body)}”</p>
      ${r.status === 'pending' ? `
      <div class="flex mt-16">
        <button class="btn btn-primary btn-sm" data-action="review-decision" data-id="${esc(r.id)}" data-d="approved">${icon('check', 14)}Approve</button>
        <button class="btn btn-danger btn-sm" data-action="review-decision" data-id="${esc(r.id)}" data-d="rejected">Reject</button>
      </div>` : `
      <div class="flex mt-16">
        <button class="btn btn-danger btn-sm" data-action="review-delete" data-id="${esc(r.id)}">${icon('trash', 14)}Remove</button>
      </div>`}
    </div>`).join('');

  box.querySelectorAll('[data-action="review-decision"]').forEach((b) => b.addEventListener('click', async () => {
    try {
      await post(`/api/admin/reviews/${b.dataset.id}/decision`, { decision: b.dataset.d });
      toastOk(b.dataset.d === 'approved' ? 'Review published' : 'Review rejected', 'The streamer was notified.');
      await refreshAdmin();
      renderReviews(main);
    } catch (err) { toastErr('Could not moderate review', err.message); }
  }));
  box.querySelectorAll('[data-action="review-delete"]').forEach((b) => b.addEventListener('click', async () => {
    if (!window.confirm('Remove this review permanently?')) return;
    try {
      await api(`/api/admin/reviews/${b.dataset.id}`, { method: 'DELETE' });
      toastOk('Review removed', 'It is no longer visible anywhere.');
      await refreshAdmin();
      renderReviews(main);
    } catch (err) { toastErr('Could not remove review', err.message); }
  }));
  updateReviewBadge(reviews.filter((r) => r.status === 'pending').length);
}

/* ── Settings ───────────────────────────────────────────────────────────── */
async function renderSettings(main) {
  main.innerHTML = `
    <div class="dash-head">
      <div>
        <div class="crumb">Owner dashboard</div>
        <h1>Settings</h1>
      </div>
    </div>
    <div class="stack" style="max-width:560px">
      <div class="card">
        <h2 style="font-size:20px">Profile</h2>
        <div class="flex mt-16" style="gap:14px">
          ${avatar('Agbota Segun', 48)}
          <div><b style="font-size:17px">${esc(store.user.name)}</b><div class="muted small">${esc(store.user.email)}</div><div class="muted micro mt-8">Role: Owner / Admin · member since ${fmtDate(store.user.created_at)}</div></div>
        </div>
      </div>
      <div class="card">
        <h2 style="font-size:20px">Change email</h2>
        <div class="field mt-16">
          <label for="ad-email">Email</label>
          <input class="input" id="ad-email" type="email" value="${esc(store.user.email)}">
        </div>
        <div class="field mt-16">
          <label for="ad-pw">Current password</label>
          <input class="input" id="ad-pw" type="password" autocomplete="current-password">
        </div>
        <button class="btn btn-primary mt-16" id="ad-email-save">Update email</button>
      </div>
      <div class="card">
        <h2 style="font-size:20px">Change password</h2>
        <p class="muted small mt-8">The initial admin password should be changed after your first login.</p>
        <div class="field mt-16">
          <label for="ad-cur">Current password</label>
          <input class="input" id="ad-cur" type="password" autocomplete="current-password">
        </div>
        <div class="field mt-16">
          <label for="ad-new">New password (8+ characters)</label>
          <input class="input" id="ad-new" type="password" autocomplete="new-password" minlength="8">
        </div>
        <div class="field mt-16">
          <label for="ad-new2">Confirm new password</label>
          <input class="input" id="ad-new2" type="password" autocomplete="new-password">
        </div>
        <button class="btn btn-primary mt-16" id="ad-pw-save">Update password</button>
      </div>
      <div class="card">
        <h2 style="font-size:20px">Security</h2>
        <div class="stack mt-16 small muted" style="line-height:1.7">
          <p>• Passwords are hashed with bcrypt — never stored or transmitted in plain text.</p>
          <p>• Sessions use signed httpOnly cookies; the admin area is protected server-side.</p>
          <p>• Row Level Security policies are defined in the database schema and enforced on hosted PostgreSQL; the application layer enforces the same rules on the embedded engine.</p>
          <p>• Files are stored privately and served only to the people allowed to see them.</p>
        </div>
      </div>
    </div>`;

  main.querySelector('#ad-email-save').addEventListener('click', async () => {
    const email = main.querySelector('#ad-email').value.trim();
    const password = main.querySelector('#ad-pw').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return toastErr('Invalid email', 'Enter a valid email address.');
    if (!password) return toastErr('Password required', 'Confirm your current password.');
    try {
      await post('/api/profile/email', { email, password });
      store.user.email = email;
      toastOk('Email updated', 'Your email address was changed.');
    } catch (err) { toastErr('Could not update email', err.message); }
  });

  main.querySelector('#ad-pw-save').addEventListener('click', async () => {
    const current = main.querySelector('#ad-cur').value;
    const next = main.querySelector('#ad-new').value;
    const next2 = main.querySelector('#ad-new2').value;
    if (next.length < 8) return toastErr('Weak password', 'New password must be at least 8 characters.');
    if (next !== next2) return toastErr('Passwords do not match', 'Confirm your new password correctly.');
    try {
      await post('/api/profile/password', { current, next });
      toastOk('Password updated', 'Use your new password next time you log in.');
      main.querySelector('#ad-cur').value = '';
      main.querySelector('#ad-new').value = '';
      main.querySelector('#ad-new2').value = '';
    } catch (err) { toastErr('Could not update password', err.message); }
  });
}
