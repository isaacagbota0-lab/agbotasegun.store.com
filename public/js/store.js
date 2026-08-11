/* Global state + realtime socket + data loading. The database is the source
   of truth; this module only caches what the UI shows. */
'use strict';

import { api, getToken } from './api.js';

export const store = {
  user: null,
  products: [],
  reviews: [],
  convs: [],
  orders: [],
  payments: [],
  notifs: [],
  notifUnread: 0,
  stats: null,
  streamers: [],
  adminOrders: [],
  adminPayments: [],
  adminReviews: [],
  socket: null,
  chat: { convId: null, messages: [], opened: false },
};

export const unreadTotal = () => store.convs.reduce((a, c) => a + (c.unread || 0), 0);

/* ── Socket (real time, no polling) ─────────────────────────────────────── */
let onRealtime = null; // callback the active view registers for live events

export function setRealtimeHandler(fn) { onRealtime = fn; }

export function connectSocket() {
  if (store.socket) return store.socket;
  if (typeof io === 'undefined') return null;
  // Same-origin by default; pass the origin explicitly so the socket works
  // in every embedding environment (preview proxies, iframes, jsdom tests).
  const origin = typeof location !== 'undefined' && location.origin ? location.origin : undefined;
  const socket = io(origin, { auth: { token: getToken() }, transports: ['websocket', 'polling'] });
  store.socket = socket;

  socket.on('message:new', (msg) => {
    if (onRealtime) onRealtime({ type: 'message:new', msg });
  });
  socket.on('message:sent', (msg) => {
    if (onRealtime) onRealtime({ type: 'message:sent', msg });
  });
  socket.on('conversation:update', (payload) => {
    refreshConversations().then(() => {
      if (onRealtime) onRealtime({ type: 'conversation:update', payload });
    });
  });
  socket.on('notification:new', (notif) => {
    store.notifs.unshift(notif);
    store.notifUnread += 1;
    if (onRealtime) onRealtime({ type: 'notification:new', notif });
  });
  socket.on('order:update', () => {
    refreshOrders();
    if (onRealtime) onRealtime({ type: 'order:update' });
  });
  return socket;
}

export function joinConversation(convId) {
  if (store.socket && convId) store.socket.emit('conversation:join', convId);
}

/* ── Data loading ───────────────────────────────────────────────────────── */
export async function loadPublicData() {
  const [products, reviews] = await Promise.all([
    api('/api/products'),
    api('/api/reviews').catch(() => []),
  ]);
  store.products = products;
  store.reviews = Array.isArray(reviews) ? reviews : [];
  return store.products;
}

export async function refreshConversations() {
  if (!store.user) return [];
  store.convs = await api('/api/conversations');
  return store.convs;
}

export async function refreshOrders() {
  if (!store.user) return [];
  store.orders = await api('/api/orders');
  return store.orders;
}

export async function refreshPayments() {
  if (!store.user) return [];
  store.payments = await api('/api/payments');
  return store.payments;
}

export async function refreshNotifications() {
  if (!store.user) return;
  const d = await api('/api/notifications');
  store.notifs = d.notifications;
  store.notifUnread = d.unread;
}

export async function refreshAdmin() {
  if (!store.user || store.user.role !== 'owner') return;
  const [stats, streamers, orders, payments, reviews] = await Promise.all([
    api('/api/admin/stats'),
    api('/api/admin/streamers'),
    api('/api/admin/orders'),
    api('/api/admin/payments'),
    api('/api/admin/reviews'),
  ]);
  store.stats = stats;
  store.streamers = streamers;
  store.adminOrders = orders;
  store.adminPayments = payments;
  store.adminReviews = reviews;
}

export async function refreshAll() {
  const jobs = [refreshConversations(), refreshOrders(), refreshPayments(), refreshNotifications()];
  if (store.user?.role === 'owner') jobs.push(refreshAdmin());
  await Promise.all(jobs);
}

/* ── Lookups ────────────────────────────────────────────────────────────── */
export const productById = (id) => store.products.find((p) => p.id === id);
export const convById = (id) => store.convs.find((c) => c.id === id);
