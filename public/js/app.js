/* Agbota Segun — application entry: boot, router, layout. */
'use strict';

import { api, setToken } from './api.js';
import * as storeMod from './store.js';
import { esc, icon, toastErr } from './ui.js';

import { homeView } from './views/public.js';
import { strategiesView, productView } from './views/store.js';
import { howView, aboutView, contactView } from './views/info.js';
import { proofView } from './views/proof.js';
import { loginView, signupView } from './views/auth.js';
import { streamerView } from './views/streamer.js';
import { adminView } from './views/admin.js';

const { store, connectSocket, refreshAll, unreadTotal, setRealtimeHandler, loadPublicData } = storeMod;

/* ── Router ─────────────────────────────────────────────────────────────── */
const ROUTES = [
  { re: /^\/$/, view: homeView, public: true },
  { re: /^\/strategies$/, view: strategiesView, public: true },
  { re: /^\/strategies\/([^/]+)$/, view: productView, public: true },
  { re: /^\/how-it-works$/, view: howView, public: true },
  { re: /^\/proof$/, view: proofView, public: true },
  { re: /^\/about$/, view: aboutView, public: true },
  { re: /^\/contact$/, view: contactView, public: true },
  { re: /^\/login$/, view: loginView, public: true },
  { re: /^\/signup$/, view: signupView, public: true },
  { re: /^\/dashboard(?:\/([^/]+))?$/, view: streamerView, role: 'streamer' },
  { re: /^\/admin(?:\/([^/]+))?$/, view: adminView, role: 'owner' },
];

let currentRoute = null;

function matchRoute(path) {
  for (const r of ROUTES) {
    const m = path.match(r.re);
    if (m) return { route: r, params: m.slice(1) };
  }
  return { route: ROUTES[0], params: [] };
}

export function navigate(path) {
  if (path === location.pathname) { render(); return; }
  history.pushState({}, '', path);
  render();
}

async function render() {
  const { route, params } = matchRoute(location.pathname);
  currentRoute = route;

  // Guards
  if (!route.public) {
    if (!store.user) {
      toastErr('Login required', 'Please log in to access that page.');
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    if (route.role && store.user.role !== route.role) {
      const home = store.user.role === 'owner' ? '/admin' : '/dashboard';
      toastErr('Access denied', route.role === 'owner' ? 'Only the owner can open the admin area.' : 'Streamers use the streamer dashboard.');
      navigate(home);
      return;
    }
  }
  if (route.public && store.user && (route === ROUTES[7] || route === ROUTES[8])) {
    // logged-in users skip login/signup
    navigate(store.user.role === 'owner' ? '/admin' : '/dashboard');
    return;
  }

  document.getElementById('app').innerHTML = layoutShell(route);
  const viewEl = document.getElementById('view');
  setRealtimeHandler(null);

  try {
    await route.view(viewEl, params, route);
  } catch (err) {
    console.error(err);
    viewEl.innerHTML = `<div class="container" style="padding:60px 0"><div class="empty"><h3>Something went wrong</h3><p>${esc(err.message || 'Please try again.')}</p></div></div>`;
  }

  // re-render live nav badges + handle realtime
  setRealtimeHandler((evt) => {
    if (evt.type === 'message:new') {
      // The chat view decides whether the message belongs to the open
      // conversation; it appends, re-renders and marks read itself.
      window.dispatchEvent(new CustomEvent('chat:message', { detail: evt.msg }));
      updateNavBadges();
    }
    if (evt.type === 'conversation:update') {
      updateNavBadges();
      window.dispatchEvent(new CustomEvent('chat:refresh'));
    }
    if (evt.type === 'notification:new') {
      updateNavBadges();
      window.dispatchEvent(new CustomEvent('notif:new', { detail: evt.notif }));
    }
    if (evt.type === 'order:update') {
      window.dispatchEvent(new CustomEvent('orders:refresh'));
    }
  });
  updateNavBadges();
  window.scrollTo(0, 0);
}

function updateNavBadges() {
  document.querySelectorAll('[data-unread-badge]').forEach((el) => {
    const n = unreadTotal();
    el.innerHTML = n > 0 ? `<span class="badge-count">${n > 99 ? '99+' : n}</span>` : '';
  });
  document.querySelectorAll('[data-notif-badge]').forEach((el) => {
    const n = store.notifUnread || 0;
    el.innerHTML = n > 0 ? `<span class="badge-count accent">${n > 99 ? '99+' : n}</span>` : '';
  });
}

/* ── Layout ─────────────────────────────────────────────────────────────── */
function layoutShell(route) {
  const authed = !!store.user;
  const inDash = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/admin');
  return `
    ${navHtml(authed)}
    ${inDash ? '' : ''}
    <div id="view"></div>
    ${authed && inDash ? '' : footerHtml()}
  `;
}

function navHtml(authed) {
  const isActive = (p) => location.pathname === p || (p !== '/' && location.pathname.startsWith(p)) ? 'active' : '';
  const links = authed
    ? `
      <a class="nav-link ${isActive('/strategies')}" href="/strategies" data-nav>Strategies</a>
      <a class="nav-link ${isActive('/proof')}" href="/proof" data-nav>Proof of Work</a>
      <a class="nav-link ${isActive(store.user.role === 'owner' ? '/admin' : '/dashboard')}" href="${store.user.role === 'owner' ? '/admin' : '/dashboard'}" data-nav>Dashboard</a>
      <a class="nav-link ${isActive('/dashboard/chat') || isActive('/admin/messages')}" href="${store.user.role === 'owner' ? '/admin/messages' : '/dashboard/chat'}" data-nav>Chat <span data-unread-badge></span></a>`
    : `
      <a class="nav-link ${isActive('/strategies')}" href="/strategies" data-nav>Strategies</a>
      <a class="nav-link ${isActive('/proof')}" href="/proof" data-nav>Proof of Work</a>
      <a class="nav-link ${isActive('/how-it-works')}" href="/how-it-works" data-nav>How it works</a>
      <a class="nav-link ${isActive('/about')}" href="/about" data-nav>About</a>
      <a class="nav-link ${isActive('/contact')}" href="/contact" data-nav>Contact</a>`;
  const cta = authed
    ? `
      <button class="bell-wrap nav-link" data-action="toggle-bell" aria-label="Notifications" style="position:relative">
        ${icon('bell', 19)}<span data-notif-badge></span>
      </button>
      <div class="nav-cta">
        <span class="muted small" style="display:flex;align-items:center;gap:8px">${avatar(store.user.name, 28)}<span class="hide-sm">${esc(store.user.name.split(' ')[0])}</span></span>
        <button class="btn btn-ghost btn-sm" data-action="logout">Logout</button>
      </div>`
    : `
      <div class="nav-cta">
        <a class="nav-link" href="/login" data-nav>Login</a>
        <a class="btn btn-primary btn-sm" href="/signup" data-nav>Create account</a>
      </div>`;
  return `
  <header class="nav">
    <div class="container nav-inner">
      <a class="brand" href="/" data-nav><span class="mark">AS</span>Agbota <em>Segun</em></a>
      <nav class="nav-links" aria-label="Main">${links}${cta}</nav>
      <button class="nav-burger" data-action="burger" aria-label="Menu" aria-expanded="false">☰</button>
    </div>
    <div class="mobile-menu" id="mobile-menu">${links}${authed ? cta : ''}</div>
  </header>`;
}

export function avatar(name, size = 34) {
  const n = String(name || '?').trim().split(/\s+/);
  const ini = ((n[0] || '?')[0] + (n.length > 1 ? n[n.length - 1][0] : '')).toUpperCase();
  return `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px" aria-hidden="true">${esc(ini)}</span>`;
}

function footerHtml() {
  return `
  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <a class="brand" href="/" data-nav><span class="mark">AS</span>Agbota <em>Segun</em></a>
          <p class="muted small mt-16" style="max-width:320px">Creator &amp; streamer growth strategies — structured blueprints and direct support for Twitch, YouTube, TikTok, Facebook, Instagram and Discord creators.</p>
        </div>
        <div>
          <h4>Platform</h4>
          <a href="/strategies" data-nav>Strategies</a>
          <a href="/how-it-works" data-nav>How it works</a>
          <a href="/proof" data-nav>Proof of work</a>
          <a href="/about" data-nav>About Agbota Segun</a>
          <a href="/contact" data-nav>Contact</a>
        </div>
        <div>
          <h4>Access</h4>
          ${store.user
            ? `<a href="${store.user.role === 'owner' ? '/admin' : '/dashboard'}" data-nav>My dashboard</a><a href="${store.user.role === 'owner' ? '/admin/messages' : '/dashboard/chat'}" data-nav>Chat</a><button class="nav-link" data-action="logout" style="padding:4px 0;color:var(--muted)">Logout</button>`
            : `<a href="/login" data-nav>Login</a><a href="/signup" data-nav>Create account</a>`}
          <a href="mailto:agbotasegun.outreach@gmail.com">agbotasegun.outreach@gmail.com</a>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} Agbota Segun. All rights reserved.</span>
        <span>Creator &amp; Streamer Growth Strategies</span>
      </div>
    </div>
  </footer>`;
}

/* ── Global event delegation ────────────────────────────────────────────── */
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  if (action === 'burger') {
    const menu = document.getElementById('mobile-menu');
    const open = menu.classList.toggle('open');
    el.setAttribute('aria-expanded', String(open));
  }
  if (action === 'close-modal') { document.getElementById('modal-root').innerHTML = ''; }
  if (action === 'logout') {
    e.preventDefault();
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setToken(null);
    try { sessionStorage.removeItem('as_token'); } catch (_) { /* private mode */ }
    location.href = '/';
  }
  if (action === 'toggle-bell') {
    e.stopPropagation();
    toggleBell(e.currentTarget);
  }
  if (action === 'mark-notifs-read') {
    await api('/api/notifications/read', { method: 'POST' }).catch(() => {});
    store.notifs.forEach((n) => { n.read_at = new Date().toISOString(); });
    store.notifUnread = 0;
    updateNavBadges();
    document.querySelector('.bell-pop')?.remove();
  }
});

document.addEventListener('click', (e) => {
  const pop = document.querySelector('.bell-pop');
  if (pop && !e.target.closest('.bell-wrap')) pop.remove();
});

async function toggleBell(btn) {
  document.querySelector('.bell-pop')?.remove();
  if (store.notifs.length === 0) {
    await storeMod.refreshNotifications();
  }
  const pop = document.createElement('div');
  pop.className = 'bell-pop';
  pop.innerHTML = `
    <div class="bell-pop-head"><b>Notifications</b>
      ${store.notifUnread ? `<button data-action="mark-notifs-read">Mark all read</button>` : ''}
    </div>
    <div class="bell-list">
      ${store.notifs.length
        ? store.notifs.slice(0, 20).map((n) => `
          <div class="bell-item ${n.read_at ? '' : 'unread'}">
            <span class="bi-dot"></span>
            <div><b>${esc(n.title)}</b><span>${esc(n.body)}</span><span class="bi-time">${new Date(n.created_at).toLocaleString()}</span></div>
          </div>`).join('')
        : `<div class="empty" style="padding:28px 16px"><p>No notifications yet.</p></div>`}
    </div>`;
  btn.appendChild(pop);
  e.preventDefault();
}

/* ── Boot ───────────────────────────────────────────────────────────────── */
async function boot() {
  // Restore the session token if the environment blocks cookies (preview
  // iframes/proxies): the token was saved at login and authenticates every
  // request through the Authorization header instead.
  try {
    const saved = sessionStorage.getItem('as_token');
    if (saved) setToken(saved);
  } catch (_) { /* storage unavailable */ }

  try {
    const me = await api('/api/auth/me').catch(() => null);
    if (me && me.user) {
      store.user = me.user;
      connectSocket();
      await refreshAll();
    } else {
      setToken(null);
      try { sessionStorage.removeItem('as_token'); } catch (_) { /* ignore */ }
    }
  } catch (_) { /* not logged in */ }

  await loadPublicData().catch(() => {});

  // Session expired mid-use (e.g. token cleared server-side): return to login.
  window.addEventListener('auth:expired', () => {
    store.user = null;
    try { sessionStorage.removeItem('as_token'); } catch (_) { /* ignore */ }
    toastErr('Session expired', 'Please log in again.');
    navigate('/login');
  });

  window.addEventListener('popstate', render);
  window.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-nav]');
    if (a && a.origin === location.origin) {
      e.preventDefault();
      navigate(a.pathname);
    }
  });

  render();
}

boot();
