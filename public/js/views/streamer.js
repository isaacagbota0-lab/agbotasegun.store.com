/* Streamer dashboard — /dashboard and tabs. All numbers are real database data. */
'use strict';

import { api, post, patch, postForm } from '../api.js';
import { store, refreshAll, refreshOrders, refreshPayments, refreshConversations } from '../store.js';
import { esc, icon, money, fmtDate, fmtDateTime, toastOk, toastErr, openModal, closeModal, modalHead, statusPill, emptyState, skeleton } from '../ui.js';
import { renderChatPage, openConversation } from './chat.js';
import { navigate } from '../app.js';

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'home' },
  { id: 'orders', label: 'My Orders', icon: 'orders' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'payments', label: 'Payments', icon: 'payments' },
  { id: 'reviews', label: 'Reviews', icon: 'star' },
  { id: 'profile', label: 'Profile', icon: 'profile' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export async function streamerView(el, [tab = 'overview']) {
  const active = TABS.find((t) => t.id === tab) ? tab : 'overview';
  el.innerHTML = `
    <div class="dash">
      <aside class="dash-side">
        ${TABS.map((t) => `
          <button class="dash-link ${active === t.id ? 'active' : ''}" data-tab="${t.id}">
            ${icon(t.icon, 18)}${t.label}
            ${t.id === 'chat' ? `<span data-unread-badge></span>` : ''}
          </button>`).join('')}
        <div class="side-foot">
          <button class="dash-link" data-action="logout">${icon('logout', 18)}Logout</button>
        </div>
      </aside>
      <main class="dash-main" id="dash-main"></main>
    </div>`;

  el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    navigate('/dashboard/' + b.dataset.tab);
  }));

  const main = el.querySelector('#dash-main');
  const views = {
    overview: renderOverview, orders: renderOrders, chat: renderChat,
    payments: renderPayments, reviews: renderReviews, profile: renderProfile, settings: renderSettings,
  };
  await views[active](main);
}

/* ── Overview ───────────────────────────────────────────────────────────── */
async function renderOverview(main) {
  try {
    await Promise.all([refreshOrders(), refreshConversations(), refreshPayments()]);
  } catch (_) { /* render with whatever data we have */ }
  const orders = store.orders;
  const unread = store.convs.reduce((a, c) => a + (c.unread || 0), 0);
  const pending = orders.filter((o) => o.payment_status === 'awaiting' || o.payment_status === 'review').length;
  const completed = orders.filter((o) => o.order_status === 'completed').length;

  main.innerHTML = `
    <div class="dash-head">
      <div>
        <div class="crumb">Streamer dashboard</div>
        <h1>Welcome, ${esc(store.user.name.split(' ')[0])}</h1>
      </div>
      <a class="btn btn-primary" href="/strategies" data-nav>${icon('plus', 16)}New order</a>
    </div>
    <div class="stat-grid">
      ${statCard('My Orders', orders.length, 'orders', 'All orders on your account')}
      ${statCard('Unread Messages', unread, 'chat', 'From Agbota Segun', true)}
      ${statCard('Pending Payments', pending, 'payments', 'Awaiting payment or review')}
      ${statCard('Completed', completed, 'checkCircle', 'Finished orders')}
    </div>
    <div class="card">
      <div class="flex-between">
        <h2 style="font-size:20px">Recent orders</h2>
        <a class="btn btn-ghost btn-sm" href="/dashboard/orders" data-nav>All orders</a>
      </div>
      <div class="mt-16">${orders.length ? orders.slice(0, 5).map(orderRow).join('') : emptyState('orders', 'No orders yet', 'Browse the store and place your first order — it will appear here instantly.', `<a class="btn btn-primary btn-sm mt-8" href="/strategies" data-nav>Browse strategies</a>`)}</div>
    </div>`;
}

function statCard(label, value, ic, hint, accent = false) {
  return `<div class="card stat-card">
    <span class="label">${esc(label)}</span>
    <span class="value ${accent ? 'accent' : ''}">${value}</span>
    <span class="hint">${esc(hint)}</span>
  </div>`;
}

function orderRow(o) {
  return `
    <div class="order-card" style="padding:14px 0;border-bottom:1px solid var(--line)">
      <div class="row">
        <div>
          <div class="order-no">${esc(o.order_number)}</div>
          <div class="muted small">${esc(o.product_name)} · ${money(o.price_cents)} · ${fmtDate(o.created_at)}</div>
        </div>
        <div class="flex">
          ${o.payment_status === 'confirmed' ? `<span class="pay-done">${icon('checkCircle', 17)}Payment confirmed</span>` : statusPill(o.payment_status === 'review' ? 'review' : 'awaiting')}
          ${statusPill(o.order_status)}
        </div>
      </div>
    </div>`;
}

/* ── Orders ─────────────────────────────────────────────────────────────── */
async function renderOrders(main) {
  main.innerHTML = `
    <div class="dash-head">
      <div>
        <div class="crumb">Streamer dashboard</div>
        <h1>My Orders</h1>
      </div>
      <a class="btn btn-primary" href="/strategies" data-nav>${icon('plus', 16)}New order</a>
    </div>
    <div class="stack" id="orders-list">${skeleton(3)}</div>`;

  await refreshOrders();
  const orders = store.orders;
  const list = main.querySelector('#orders-list');

  if (!orders.length) {
    list.innerHTML = `<div class="card">${emptyState('orders', 'No orders yet', 'When you order a strategy, it appears here with its order number and payment status.', `<a class="btn btn-primary btn-sm mt-8" href="/strategies" data-nav>Browse strategies</a>`)}</div>`;
    return;
  }

  // highlight the order the user was redirected to after placing it
  const highlight = new URLSearchParams(location.search).get('order');

  list.innerHTML = orders.map((o) => `
    <div class="card order-card ${o.id === highlight ? 'highlight' : ''}" style="${o.id === highlight ? 'border-color:var(--accent-line);background:linear-gradient(180deg,#1a1c28,var(--bg-soft))' : ''}">
      <div class="row">
        <div>
          <div class="order-no">${esc(o.order_number)}</div>
          <div class="muted small">${esc(o.product_name)} · ${esc((o.product_platforms || []).join(' + ')) || '—'}</div>
        </div>
        <div class="price" style="font-size:22px">${money(o.price_cents)}</div>
      </div>
      <div class="row">
        <div class="flex" style="flex-wrap:wrap">
          ${statusPill(o.payment_status === 'confirmed' ? 'confirmed' : o.payment_status === 'review' ? 'review' : 'awaiting')}
          ${statusPill(o.order_status)}
        </div>
        <div class="small muted">Placed ${fmtDateTime(o.created_at)}</div>
      </div>
      ${o.payment_status === 'confirmed'
        ? `<div class="row"><span class="pay-done">${icon('checkCircle', 18)} Payment confirmed — your strategy is being prepared.</span></div>`
        : o.payment_status === 'review'
          ? `<div class="row"><span class="pill amber">Payment under review</span><span class="small muted">Agbota Segun will confirm it shortly. You can also follow up in Chat.</span></div>`
          : `
          <div class="row">
            <div class="instructions">
              <b style="color:var(--accent-strong)">How to pay for ${esc(o.order_number)}</b>
              <span>1. Pay using the method you arranged (ask in Chat for instructions if needed).</span>
              <span>2. Click <b>Payment made</b> below and add the payment reference.</span>
              <span>3. Agbota Segun reviews and confirms it — your order is only confirmed after that.</span>
            </div>
          </div>
          <div class="row">
            <button class="btn btn-primary" data-action="payment-made" data-id="${esc(o.id)}">${icon('payments', 17)}Payment made</button>
            <a class="btn btn-ghost" href="/dashboard/chat" data-nav>${icon('chat', 17)}Ask in Chat</a>
          </div>`}
    </div>`).join('');

  list.querySelectorAll('[data-action="payment-made"]').forEach((b) => {
    b.addEventListener('click', () => paymentMadeModal(b.dataset.id));
  });

  // If redirected right after placing an order, open the payment modal.
  const params = new URLSearchParams(location.search);
  if (params.get('placed') === '1' && highlight) {
    history.replaceState({}, '', '/dashboard/orders');
    const order = orders.find((o) => o.id === highlight);
    if (order && order.payment_status === 'awaiting') paymentMadeModal(order.id);
  }
}

/* ── Payment made (real notification to the owner) ──────────────────────── */
function paymentMadeModal(orderId) {
  const order = store.orders.find((o) => o.id === orderId);
  if (!order) return;
  openModal(`
    ${modalHead('Report a payment')}
    <div class="modal-body">
      <p class="small muted" style="line-height:1.6">You are reporting the payment for <b>${esc(order.order_number)}</b> (${money(order.price_cents)}). Nothing is marked paid automatically — Agbota Segun reviews this report and confirms the payment personally.</p>
      <div class="field">
        <label for="pm-method">Payment method</label>
        <select class="input" id="pm-method">
          <option value="paypal">PayPal</option>
          <option value="btc">Bitcoin / crypto</option>
          <option value="other">Other (arranged in Chat)</option>
        </select>
      </div>
      <div class="field">
        <label for="pm-ref">Reference (transaction ID, wallet address…)</label>
        <input class="input" id="pm-ref" maxlength="200" placeholder="Optional but helpful">
      </div>
      <div class="field">
        <label for="pm-note">Note for Agbota Segun</label>
        <textarea class="input" id="pm-note" maxlength="500" rows="2" placeholder="Optional"></textarea>
      </div>
      <div class="field">
        <label for="pm-file">Receipt (optional)</label>
        <input class="input" type="file" id="pm-file" accept=".pdf,.png,.jpg,.jpeg,.webp">
      </div>
      <button class="btn btn-primary btn-lg btn-block" id="pm-submit" style="justify-content:center">${icon('send', 17)}Send payment notification</button>
    </div>`);

  const submit = document.getElementById('pm-submit');
  submit.addEventListener('click', async () => {
    submit.disabled = true;
    submit.innerHTML = `<span class="spin">${icon('refresh', 16)}</span> Sending…`;
    const fd = new FormData();
    fd.append('method', document.getElementById('pm-method').value);
    fd.append('reference', document.getElementById('pm-ref').value.trim());
    fd.append('note', document.getElementById('pm-note').value.trim());
    const file = document.getElementById('pm-file').files[0];
    if (file) fd.append('receipt', file, file.name);
    try {
      await postForm(`/api/orders/${orderId}/payment-made`, fd);
      closeModal();
      toastOk('Payment notification sent', 'Agbota Segun will review it and confirm your payment.');
      await refreshOrders();
      renderOrders(document.getElementById('dash-main'));
    } catch (err) {
      submit.disabled = false;
      submit.innerHTML = `${icon('send', 17)}Send payment notification`;
      toastErr('Could not send notification', err.message);
    }
  });
}

/* ── Chat tab ───────────────────────────────────────────────────────────── */
async function renderChat(main) {
  await refreshConversations();
  main.innerHTML = '';
  await renderChatPage(main, { admin: false });
  if (store.convs.length) await openConversation(store.convs[0].id);
}

/* ── Payments ───────────────────────────────────────────────────────────── */
async function renderPayments(main) {
  main.innerHTML = `
    <div class="dash-head">
      <div>
        <div class="crumb">Streamer dashboard</div>
        <h1>Payments</h1>
      </div>
    </div>
    <div class="card"><div id="payments-list">${skeleton(3)}</div></div>`;

  await refreshPayments();
  const list = main.querySelector('#payments-list');
  if (!store.payments.length) {
    list.innerHTML = emptyState('payments', 'No payments yet', 'When you report a payment for an order, it appears here with its real status.');
    return;
  }
  list.innerHTML = `
    <div class="table-wrap" style="border:0">
      <table class="data">
        <thead><tr><th>Order</th><th>Product</th><th>Method</th><th>Reference</th><th>Status</th><th>Reported</th></tr></thead>
        <tbody>
          ${store.payments.map((p) => `
            <tr>
              <td class="cell-main">${esc(p.order_number)}</td>
              <td>${esc(p.product_name)}</td>
              <td class="small">${esc(p.method.toUpperCase())}</td>
              <td class="small muted">${esc(p.reference || '—')}</td>
              <td>${statusPill(p.status)}</td>
              <td class="small muted">${fmtDate(p.created_at)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ── Reviews ────────────────────────────────────────────────────────────── */
async function renderReviews(main) {
  main.innerHTML = `
    <div class="dash-head">
      <div>
        <div class="crumb">Streamer dashboard</div>
        <h1>Reviews</h1>
      </div>
    </div>
    <div class="stack">
      <div class="card">
        <h2 style="font-size:20px">Review a completed order</h2>
        <p class="muted small mt-8">Reviews are only accepted from real customers, on completed orders. They are published after a quick review.</p>
        <div id="review-form-area" class="mt-16"></div>
      </div>
      <div class="card">
        <h2 style="font-size:20px">My reviews</h2>
        <div id="my-reviews" class="mt-16"></div>
      </div>
    </div>`;

  await Promise.all([refreshOrders(), api('/api/reviews/mine').then((r) => { store.myReviews = r; })]);

  const eligible = store.orders.filter((o) => o.order_status === 'completed' && !store.myReviews.some((r) => r.order_id === o.id));
  const formArea = main.querySelector('#review-form-area');
  if (!eligible.length) {
    formArea.innerHTML = `<div class="muted small" style="padding:10px 0">${store.orders.length ? 'You have no completed orders left to review.' : 'Complete an order first — reviews are reserved for real customers.'}</div>`;
  } else {
    formArea.innerHTML = `
      <div class="field">
        <label for="rv-order">Order</label>
        <select class="input" id="rv-order">${eligible.map((o) => `<option value="${esc(o.id)}">${esc(o.order_number)} — ${esc(o.product_name)}</option>`).join('')}</select>
      </div>
      <div class="field mt-16">
        <label>Rating</label>
        <div id="rv-stars" style="display:flex;gap:4px;font-size:26px;color:var(--muted-2)">
          ${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-star="${i}" style="background:none;border:0;padding:2px;color:var(--muted-2)">★</button>`).join('')}
        </div>
      </div>
      <div class="field mt-16">
        <label for="rv-body">Your review (10–1200 characters)</label>
        <textarea class="input" id="rv-body" rows="4" maxlength="1200" placeholder="How did the strategy help your growth approach?"></textarea>
      </div>
      <button class="btn btn-primary mt-16" id="rv-submit">Submit review</button>`;
    let rating = 0;
    main.querySelectorAll('[data-star]').forEach((b) => b.addEventListener('click', () => {
      rating = +b.dataset.star;
      main.querySelectorAll('[data-star]').forEach((x) => {
        x.style.color = +x.dataset.star <= rating ? 'var(--accent)' : 'var(--muted-2)';
      });
    }));
    main.querySelector('#rv-submit').addEventListener('click', async () => {
      const orderId = main.querySelector('#rv-order').value;
      const body = main.querySelector('#rv-body').value.trim();
      if (!rating) return toastErr('Rating required', 'Select 1–5 stars.');
      if (body.length < 10) return toastErr('Review too short', 'Write at least 10 characters.');
      try {
        await post('/api/reviews', { orderId, rating, body });
        toastOk('Review submitted', 'It will be published after a quick review.');
        renderReviews(main);
      } catch (err) {
        toastErr('Could not submit review', err.message);
      }
    });
  }

  const myList = main.querySelector('#my-reviews');
  myList.innerHTML = store.myReviews.length
    ? `<div class="stack">${store.myReviews.map((r) => `
        <div class="flex-between" style="border:1px solid var(--line);border-radius:12px;padding:14px 16px">
          <div>
            <div class="small" style="color:var(--accent);letter-spacing:2px">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
            <p class="small muted mt-8" style="line-height:1.6">“${esc(r.body)}”</p>
            <p class="micro muted-2 mt-8">${esc(r.product_name)} · ${fmtDate(r.created_at)}</p>
          </div>
          ${statusPill(r.status)}
        </div>`).join('')}</div>`
    : emptyState('star', 'No reviews yet', 'Your reviews will appear here.');
}

/* ── Profile ────────────────────────────────────────────────────────────── */
async function renderProfile(main) {
  main.innerHTML = `
    <div class="dash-head">
      <div>
        <div class="crumb">Streamer dashboard</div>
        <h1>Profile</h1>
      </div>
    </div>
    <div class="grid-2" style="grid-template-columns:1fr 1fr;align-items:start">
      <div class="card">
        <div class="flex" style="gap:14px">
          <span class="avatar lg">${esc(store.user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</span>
          <div><b style="font-size:17px">${esc(store.user.name)}</b><div class="muted small">${esc(store.user.email)}</div><div class="muted micro mt-8">Member since ${fmtDate(store.user.created_at)} · Role: Streamer</div></div>
        </div>
      </div>
      <div class="card">
        <h2 style="font-size:20px">Edit name</h2>
        <div class="field mt-16">
          <label for="pf-name">Full name</label>
          <input class="input" id="pf-name" value="${esc(store.user.name)}" maxlength="80">
        </div>
        <button class="btn btn-primary mt-16" id="pf-save">Save name</button>
      </div>
    </div>`;

  main.querySelector('#pf-save').addEventListener('click', async () => {
    const name = main.querySelector('#pf-name').value.trim();
    if (name.length < 2) return toastErr('Invalid name', 'Name must be 2–80 characters.');
    try {
      const d = await patch('/api/profile', { name });
      store.user.name = d.user.name;
      toastOk('Profile updated', 'Your name was saved.');
      renderProfile(main);
    } catch (err) { toastErr('Could not update profile', err.message); }
  });
}

/* ── Settings ───────────────────────────────────────────────────────────── */
async function renderSettings(main) {
  main.innerHTML = `
    <div class="dash-head">
      <div>
        <div class="crumb">Streamer dashboard</div>
        <h1>Settings</h1>
      </div>
    </div>
    <div class="stack" style="max-width:560px">
      <div class="card">
        <h2 style="font-size:20px">Change email</h2>
        <p class="muted small mt-8">You'll need to confirm with your current password.</p>
        <div class="field mt-16">
          <label for="st-email">New email</label>
          <input class="input" id="st-email" type="email" value="${esc(store.user.email)}">
        </div>
        <div class="field mt-16">
          <label for="st-pw">Current password</label>
          <input class="input" id="st-pw" type="password" autocomplete="current-password">
        </div>
        <button class="btn btn-primary mt-16" id="st-email-save">Update email</button>
      </div>
      <div class="card">
        <h2 style="font-size:20px">Change password</h2>
        <div class="field mt-16">
          <label for="st-cur">Current password</label>
          <input class="input" id="st-cur" type="password" autocomplete="current-password">
        </div>
        <div class="field mt-16">
          <label for="st-new">New password (8+ characters)</label>
          <input class="input" id="st-new" type="password" autocomplete="new-password" minlength="8">
        </div>
        <div class="field mt-16">
          <label for="st-new2">Confirm new password</label>
          <input class="input" id="st-new2" type="password" autocomplete="new-password">
        </div>
        <button class="btn btn-primary mt-16" id="st-pw-save">Update password</button>
      </div>
      <div class="card">
        <h2 style="font-size:20px">Session</h2>
        <p class="muted small mt-8">Logging out ends this session on this device. Your orders and messages stay saved on your account.</p>
        <button class="btn btn-danger mt-16" data-action="logout">${icon('logout', 16)}Logout</button>
      </div>
    </div>`;

  main.querySelector('#st-email-save').addEventListener('click', async () => {
    const email = main.querySelector('#st-email').value.trim();
    const password = main.querySelector('#st-pw').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return toastErr('Invalid email', 'Enter a valid email address.');
    if (!password) return toastErr('Password required', 'Confirm your current password.');
    try {
      await post('/api/profile/email', { email, password });
      store.user.email = email;
      toastOk('Email updated', 'Your email address was changed.');
      renderSettings(main);
    } catch (err) { toastErr('Could not update email', err.message); }
  });

  main.querySelector('#st-pw-save').addEventListener('click', async () => {
    const current = main.querySelector('#st-cur').value;
    const next = main.querySelector('#st-new').value;
    const next2 = main.querySelector('#st-new2').value;
    if (next.length < 8) return toastErr('Weak password', 'New password must be at least 8 characters.');
    if (next !== next2) return toastErr('Passwords do not match', 'Confirm your new password correctly.');
    try {
      await post('/api/profile/password', { current, next });
      main.querySelector('#st-cur').value = '';
      main.querySelector('#st-new').value = '';
      main.querySelector('#st-new2').value = '';
      toastOk('Password updated', 'Use your new password next time you log in.');
    } catch (err) { toastErr('Could not update password', err.message); }
  });
}

/* Realtime: keep orders fresh */
window.addEventListener('orders:refresh', () => {
  const main = document.getElementById('dash-main');
  if (!main) return;
  if (location.pathname.startsWith('/dashboard/orders')) renderOrders(main).catch(() => {});
  if (location.pathname === '/dashboard' || location.pathname === '/dashboard/') renderOverview(main).catch(() => {});
});
