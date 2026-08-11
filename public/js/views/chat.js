/* Chat / Messages — shared by the streamer dashboard and admin inbox.
   Real conversation with the database as source of truth; realtime via
   Socket.IO; text, image, document and voice messages. */
'use strict';

import { api, postForm, authedUrl } from '../api.js';
import { store, joinConversation, refreshConversations, unreadTotal } from '../store.js';
import { esc, icon, money, fmtTime, fmtBytes, timeAgo, toastErr, toastOk, openModal, closeModal } from '../ui.js';
import { avatar } from '../app.js';

export const chatState = { filter: 'all', query: '', selected: null, messages: [], opened: false, sending: false };

/* ── Page shell ─────────────────────────────────────────────────────────── */
export async function renderChatPage(el, { admin = false } = {}) {
  el.innerHTML = `
    <div class="dash-head">
      <div>
        <div class="crumb">${admin ? 'Admin' : 'Streamer dashboard'}</div>
        <h1>${admin ? 'Messages' : 'Chat with Agbota Segun'}</h1>
      </div>
      <p class="muted small" style="max-width:420px">${admin
        ? 'Every registered streamer appears here automatically. You can start the conversation first — no need to wait for them to message you.'
        : 'Your private conversation with Agbota Segun. Messages are stored on your account.'}</p>
    </div>
    <div class="chat-shell">
      <aside class="chat-list" id="chat-list">
        <div class="chat-list-head">
          <h2>${admin ? 'Streamers' : 'Conversation'}</h2>
          ${admin ? `
          <input class="input" id="contact-search" type="search" placeholder="Search by name or email…" aria-label="Search streamers">
          <div class="chat-filters" role="tablist" aria-label="Filter messages">
            <button class="chip active" data-filter="all">All</button>
            <button class="chip" data-filter="unread">Unread</button>
          </div>` : ''}
        </div>
        <div class="chat-contacts" id="contacts"></div>
      </aside>
      <main class="chat-main mobile-hidden" id="chat-main">
        <div class="chat-empty" id="chat-placeholder">
          <div>
            <span class="ic">${icon('chat', 26)}</span>
            <p>${admin ? 'Select a streamer to open the conversation.' : 'Select the conversation to open it.'}</p>
          </div>
        </div>
      </main>
    </div>`;

  const listEl = el.querySelector('#chat-list');
  const mainEl = el.querySelector('#chat-main');

  if (admin) {
    el.querySelector('#contact-search').addEventListener('input', (e) => {
      chatState.query = e.target.value;
      renderContacts();
    });
    el.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
      el.querySelectorAll('[data-filter]').forEach((x) => x.classList.toggle('active', x === b));
      chatState.filter = b.dataset.filter;
      renderContacts();
    }));
  }

  // Realtime: append new messages to the open conversation without refresh.
  window.addEventListener('chat:message', (e) => {
    const m = e.detail;
    if (chatState.opened && chatState.selected === m.conversation_id) {
      if (!chatState.messages.some((x) => x.id === m.id)) {
        chatState.messages.push(m);
        renderMessages();
        api(`/api/conversations/${chatState.selected}/read`, { method: 'POST' }).catch(() => {});
      }
    }
  });
  window.addEventListener('chat:refresh', () => {
    renderContacts();
  });

  renderContacts();

  // Auto-open the single streamer conversation on mobile-friendly layouts.
  if (!admin && store.convs.length) {
    openConversation(store.convs[0].id);
  }

  return { listEl, mainEl };
}

/* ── Contacts ───────────────────────────────────────────────────────────── */
export function renderContacts() {
  const list = document.getElementById('contacts');
  if (!list) return;
  let convs = store.convs;
  if (chatState.filter === 'unread') convs = convs.filter((c) => c.unread > 0);
  const q = chatState.query.trim().toLowerCase();
  if (q) {
    convs = convs.filter((c) =>
      (c.partner?.name || '').toLowerCase().includes(q) || (c.partner?.email || '').toLowerCase().includes(q)
    );
  }

  if (!convs.length) {
    list.innerHTML = `<div class="empty" style="padding:34px 16px">
      <span class="ic">${icon('chat', 22)}</span>
      <p>${chatState.filter === 'unread' ? 'No unread messages.' : chatState.query ? 'No streamers match your search.' : 'No conversations yet.'}</p>
    </div>`;
    return;
  }

  list.innerHTML = convs.map((c) => {
    const active = chatState.selected === c.id ? 'active' : '';
    const last = c.last_message;
    const preview = last
      ? (c.partner && last.type === 'text' ? esc(last.preview || '') : esc(last.preview))
      : '<span class="ci-new">New conversation — message first</span>';
    const time = last ? timeAgo(last.created_at) : timeAgo(c.created_at);
    return `
      <button class="contact-item ${active}" data-conv="${esc(c.id)}" aria-label="Conversation with ${esc(c.partner?.name || '')}">
        ${avatar(c.partner?.name || '?', 40)}
        <span class="ci-main">
          <span class="ci-name">${esc(c.partner?.name || 'Unknown')}${c.unread ? `<span class="badge-count">${c.unread}</span>` : ''}</span>
          <span class="ci-sub">${preview}</span>
        </span>
        <span class="ci-time">${time}</span>
      </button>`;
  }).join('');

  list.querySelectorAll('[data-conv]').forEach((b) => {
    b.addEventListener('click', () => openConversation(b.dataset.conv));
  });
}

/* ── Conversation ───────────────────────────────────────────────────────── */
export async function openConversation(convId) {
  if (chatState.sending) return; // don't switch mid-send
  chatState.selected = convId;
  chatState.opened = false;
  const main = document.getElementById('chat-main');
  const list = document.getElementById('chat-list');
  if (!main) return;

  main.classList.remove('mobile-hidden');
  if (window.innerWidth <= 1020) list.classList.add('mobile-hidden');
  main.innerHTML = `<div class="chat-head">
      <button class="chat-back" data-action="chat-back" aria-label="Back to contacts">${icon('arrowLeft', 20)}</button>
      <span id="chat-avatar"></span>
      <div class="ch-info">
        <div class="ch-name" id="chat-name">Loading…</div>
        <div class="ch-sub" id="chat-sub">Loading conversation…</div>
      </div>
    </div>
    <div class="chat-body" id="chat-body" aria-live="polite"></div>
    <div id="composer-area"></div>`;

  main.querySelector('[data-action="chat-back"]')?.addEventListener('click', () => {
    main.classList.add('mobile-hidden');
    list.classList.remove('mobile-hidden');
  });

  const conv = store.convs.find((c) => c.id === convId);
  if (conv) {
    document.getElementById('chat-avatar').innerHTML = avatar(conv.partner?.name || '?', 38);
    document.getElementById('chat-name').textContent = conv.partner?.name || 'Conversation';
    document.getElementById('chat-sub').textContent = conv.partner?.role === 'owner' ? 'Agbota Segun — Owner' : 'Streamer';
  }

  try {
    const msgs = await api(`/api/conversations/${convId}/messages`);
    chatState.messages = msgs;
    chatState.opened = true;
    joinConversation(convId);
    renderMessages();
    renderComposer();
    // mark read + refresh badges
    await refreshConversations();
    const c = store.convs.find((x) => x.id === convId);
    if (c) c.unread = 0;
    window.dispatchEvent(new CustomEvent('chat:refresh'));
  } catch (err) {
    toastErr('Could not open conversation', err.message);
    main.innerHTML = `<div class="chat-empty"><div><span class="ic">${icon('x', 24)}</span><p>${esc(err.message)}</p></div></div>`;
  }
}

/* ── Messages ───────────────────────────────────────────────────────────── */
export function renderMessages() {
  const body = document.getElementById('chat-body');
  if (!body) return;
  if (!chatState.messages.length) {
    body.innerHTML = `<div class="empty" style="padding:40px 20px">
      <span class="ic">${icon('chat', 22)}</span>
      <h3>No messages yet</h3>
      <p>${store.user.role === 'owner' ? 'Start the conversation — this streamer will see your message instantly.' : 'Agbota Segun will see your message instantly. This conversation is private between the two of you.'}</p>
    </div>`;
    return;
  }

  let html = '';
  let lastDay = '';
  for (const m of chatState.messages) {
    const day = new Date(m.created_at).toDateString();
    if (day !== lastDay) {
      lastDay = day;
      html += `<div class="day-divider">${new Date(m.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>`;
    }
    html += bubble(m);
  }
  body.innerHTML = html;
  body.scrollTop = body.scrollHeight;
}

function bubble(m) {
  const mine = m.sender_id === store.user.id;
  let content = '';
  if (m.message_type === 'text') {
    content = `<span>${esc(m.content)}</span>`;
  } else if (m.message_type === 'image') {
    content = `<a href="${esc(authedUrl(m.attachment_url))}" data-zoom data-src="${esc(authedUrl(m.attachment_url))}" aria-label="Open image"><img class="msg-img" src="${esc(authedUrl(m.attachment_url))}" alt="${esc(m.attachment_name || 'Image')}" loading="lazy"></a>`;
  } else if (m.message_type === 'voice') {
    content = `<audio controls preload="metadata" src="${esc(authedUrl(m.attachment_url))}" aria-label="Voice message"></audio>`;
  } else {
    content = `
      <a class="doc-link" href="${esc(authedUrl(m.attachment_url))}" target="_blank" rel="noopener">
        <span class="doc-ic">${icon('doc', 19)}</span>
        <span>
          <span class="doc-name">${esc(m.attachment_name || 'Document')}</span>
          <span class="doc-size">${fmtBytes(m.attachment_size)} · ${icon('download', 12)} Download</span>
        </span>
      </a>`;
  }
  return `
    <div class="msg-row ${mine ? 'mine' : ''}">
      <div class="bubble">${content}<span class="msg-time">${fmtTime(m.created_at)}</span></div>
    </div>`;
}

/* ── Composer ───────────────────────────────────────────────────────────── */
function renderComposer() {
  const area = document.getElementById('composer-area');
  if (!area) return;
  area.innerHTML = `
    <div class="composer" id="composer">
      <textarea id="msg-input" rows="1" placeholder="Write a message…" aria-label="Message"></textarea>
      <button class="cbtn" id="btn-image" title="Send image" aria-label="Send image">${icon('image', 18)}</button>
      <button class="cbtn" id="btn-doc" title="Send document" aria-label="Send document">${icon('paperclip', 18)}</button>
      <button class="cbtn" id="btn-voice" title="Record voice message" aria-label="Record voice message">${icon('mic', 18)}</button>
      <button class="btn btn-primary send-btn" id="btn-send" disabled>${icon('send', 16)}</button>
      <input type="file" id="file-input" class="hidden" style="display:none">
    </div>
    <div id="rec-area"></div>`;

  const input = area.querySelector('#msg-input');
  const send = area.querySelector('#btn-send');
  const fileInput = area.querySelector('#file-input');

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    send.disabled = !input.value.trim() || chatState.sending;
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  });
  send.addEventListener('click', sendText);

  area.querySelector('#btn-image').addEventListener('click', () => { fileInput.accept = 'image/*'; fileInput.click(); });
  area.querySelector('#btn-doc').addEventListener('click', () => { fileInput.accept = '.pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.ppt,.pptx,.zip'; fileInput.click(); });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) sendFile(fileInput.files[0]);
    fileInput.value = '';
  });
  area.querySelector('#btn-voice').addEventListener('click', toggleVoice);
}

async function sendText() {
  const input = document.getElementById('msg-input');
  const text = (input?.value || '').trim();
  if (!text || chatState.sending || !chatState.selected) return;
  await sendMessage(new FormData(), 'text', text, input);
}

async function sendFile(file) {
  const type = file.type.startsWith('image/') ? 'image' : 'document';
  const fd = new FormData();
  fd.append('file', file, file.name);
  await sendMessage(fd, type, null, null, file.name);
}

async function sendMessage(fd, type, text, input, label) {
  chatState.sending = true;
  const send = document.getElementById('btn-send');
  if (send) { send.disabled = true; send.innerHTML = `<span class="spin">${icon('refresh', 15)}</span>`; }
  const btnVoice = document.getElementById('btn-voice');
  if (btnVoice) btnVoice.disabled = true;
  if (input) input.disabled = true;

  fd.append('type', type);
  if (text !== null) fd.append('content', text);

  try {
    const msg = await postForm(`/api/conversations/${chatState.selected}/messages`, fd);
    chatState.messages.push(msg);
    renderMessages();
    if (input) { input.value = ''; input.style.height = 'auto'; }
    await refreshConversations();
    window.dispatchEvent(new CustomEvent('chat:refresh'));
  } catch (err) {
    toastErr(type === 'text' ? 'Message failed to send' : `Could not send ${label || 'file'}`, err.message);
  } finally {
    chatState.sending = false;
    if (send) { send.disabled = true; send.innerHTML = icon('send', 16); }
    if (btnVoice) btnVoice.disabled = false;
    if (input) input.disabled = false;
    const inp = document.getElementById('msg-input');
    if (inp) send.disabled = !inp.value.trim();
  }
}

/* ── Voice messages ─────────────────────────────────────────────────────── */
let recorder = null;
let recChunks = [];
let recTimer = null;
let recSeconds = 0;

function pickMime() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  if (typeof MediaRecorder === 'undefined') return null;
  for (const c of candidates) {
    try { if (MediaRecorder.isTypeSupported(c)) return c; } catch (_) { /* ignore */ }
  }
  return '';
}

async function toggleVoice() {
  if (recorder && recorder.state === 'recording') { recorder.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia) {
    toastErr('Recording not supported', 'Voice recording is not supported in this browser.');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = pickMime();
    if (mime === null) {
      stream.getTracks().forEach((t) => t.stop());
      toastErr('Recording not supported', 'Voice recording is not supported in this browser.');
      return;
    }
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recChunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) recChunks.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      clearInterval(recTimer);
      const mimeType = recorder?.mimeType || 'audio/webm';
      const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const blob = new Blob(recChunks, { type: mimeType });
      showVoicePreview(blob, ext);
      recorder = null;
    };
    recorder.start();
    recSeconds = 0;
    const btn = document.getElementById('btn-voice');
    if (btn) { btn.classList.add('rec'); btn.innerHTML = icon('stop', 18); }
    renderRecPanel(true);
    recTimer = setInterval(() => {
      recSeconds += 1;
      const t = document.getElementById('rec-time');
      if (t) t.textContent = `${String(Math.floor(recSeconds / 60)).padStart(2, '0')}:${String(recSeconds % 60).padStart(2, '0')}`;
    }, 1000);
  } catch (_) {
    toastErr('Microphone unavailable', 'Microphone permission was denied or no microphone was found.');
  }
}

function renderRecPanel(recording) {
  const area = document.getElementById('rec-area');
  if (!area) return;
  if (recording) {
    area.innerHTML = `
      <div class="rec-panel">
        <span class="rec-dot"></span>
        <span class="rec-time" id="rec-time">00:00</span>
        <span class="rec-bars">${Array.from({ length: 24 }, () => '<i></i>').join('')}</span>
        <span class="muted small">Recording… tap stop when done</span>
      </div>`;
  } else {
    area.innerHTML = '';
  }
}

function showVoicePreview(blob, ext) {
  const area = document.getElementById('rec-area');
  const btn = document.getElementById('btn-voice');
  if (btn) { btn.classList.remove('rec'); btn.innerHTML = icon('mic', 18); }
  if (!area) return;
  const url = URL.createObjectURL(blob);
  area.innerHTML = `
    <div class="rec-panel">
      <span class="muted small" style="font-weight:600">Voice message ready</span>
      <audio controls src="${url}" style="flex:1;min-width:0;height:38px"></audio>
      <button class="btn btn-primary btn-sm" id="rec-send">${icon('send', 15)} Send</button>
      <button class="btn btn-ghost btn-sm" id="rec-cancel">Cancel</button>
    </div>`;
  area.querySelector('#rec-send').addEventListener('click', async () => {
    const fd = new FormData();
    fd.append('file', blob, `voice-${Date.now()}.${ext}`);
    fd.append('type', 'voice');
    area.innerHTML = '';
    await sendMessage(fd, 'voice', null, null, 'voice message');
  });
  area.querySelector('#rec-cancel').addEventListener('click', () => {
    area.innerHTML = '';
    URL.revokeObjectURL(url);
  });
}

/* ── Image zoom ─────────────────────────────────────────────────────────── */
document.addEventListener('click', (e) => {
  const zoom = e.target.closest('[data-zoom]');
  if (!zoom) return;
  e.preventDefault();
  openModal(`
    <div class="modal-body" style="padding:16px">
      <div class="flex-between"><h3>Image</h3><button class="modal-x" data-action="close-modal">×</button></div>
      <img src="${esc(zoom.dataset.src)}" alt="Message image" style="border-radius:12px;max-height:70vh;width:auto;margin:0 auto">
    </div>`);
});
