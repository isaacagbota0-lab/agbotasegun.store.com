/* Login + Signup — real authentication against the server. */
'use strict';

import { api, post, setToken } from '../api.js';
import { store, refreshAll, connectSocket } from '../store.js';
import { esc, icon, toastErr, toastOk } from '../ui.js';
import { navigate } from '../app.js';

function nextPath() {
  const n = new URLSearchParams(location.search).get('next');
  return n && n.startsWith('/') ? n : null;
}

function redirectAfterLogin(user) {
  const next = nextPath();
  if (next && (next.startsWith('/admin') ? user.role === 'owner' : true)) { navigate(next); return; }
  navigate(user.role === 'owner' ? '/admin' : '/dashboard');
}

/* ── /login ─────────────────────────────────────────────────────────────── */
export async function loginView(el) {
  el.innerHTML = `
    <div class="auth-wrap">
      <div class="card auth-card">
        <span class="eyebrow">Welcome back</span>
        <h1>Log in</h1>
        <p class="sub">Access your dashboard, orders and chat.</p>
        <form id="login-form" novalidate>
          <div class="field">
            <label for="email">Email</label>
            <input class="input" type="email" id="email" name="email" autocomplete="email" placeholder="you@example.com" required>
            <span class="field-error">Enter a valid email address.</span>
          </div>
          <div class="field mt-16">
            <label for="password">Password</label>
            <div class="password-wrap">
              <input class="input" type="password" id="password" name="password" autocomplete="current-password" placeholder="Your password" required>
              <button type="button" class="password-toggle" data-action="toggle-pw" data-target="password" aria-label="Show password">${icon('eye', 17)}</button>
            </div>
            <span class="field-error">Enter your password.</span>
          </div>
          <button class="btn btn-primary btn-lg btn-block mt-24" id="login-btn" style="justify-content:center">Log in</button>
        </form>
        <p class="auth-alt">New here? <a href="/signup" data-nav>Create a streamer account</a></p>
      </div>
    </div>`;

  el.querySelector('[data-action="toggle-pw"]').addEventListener('click', (e) => {
    const inp = el.querySelector('#' + e.currentTarget.dataset.target);
    inp.type = inp.type === 'password' ? 'text' : 'password';
    e.currentTarget.innerHTML = icon(inp.type === 'password' ? 'eye' : 'eyeOff', 17);
  });

  el.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = el.querySelector('#login-btn');
    const email = el.querySelector('#email').value.trim();
    const password = el.querySelector('#password').value;
    let ok = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { el.querySelector('#email').closest('.field').classList.add('invalid'); ok = false; }
    if (!password) { el.querySelector('#password').closest('.field').classList.add('invalid'); ok = false; }
    if (!ok) return;

    btn.disabled = true;
    btn.innerHTML = `<span class="spin">${icon('refresh', 16)}</span> Logging in…`;
    try {
      const d = await post('/api/auth/login', { email, password });
      setToken(d.token);
      try { sessionStorage.setItem('as_token', d.token); } catch (_) { /* storage unavailable */ }
      store.user = d.user;
      connectSocket();
      try { await refreshAll(); } catch (_) { /* dashboard renders from cached state */ }
      toastOk(`Welcome back, ${d.user.name.split(' ')[0]}`);
      redirectAfterLogin(d.user);
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = 'Log in';
      toastErr('Login failed', err.message);
    }
  });
}

/* ── /signup ────────────────────────────────────────────────────────────── */
export async function signupView(el) {
  el.innerHTML = `
    <div class="auth-wrap">
      <div class="card auth-card">
        <span class="eyebrow">Streamer account</span>
        <h1>Create your account</h1>
        <p class="sub">Free to create. You get a dashboard for orders and a private chat with Agbota Segun.</p>
        <form id="signup-form" novalidate>
          <div class="field">
            <label for="name">Full name</label>
            <input class="input" type="text" id="name" name="name" autocomplete="name" placeholder="Your name" required minlength="2" maxlength="80">
            <span class="field-error">Enter your full name (2–80 characters).</span>
          </div>
          <div class="field mt-16">
            <label for="email">Email</label>
            <input class="input" type="email" id="email" name="email" autocomplete="email" placeholder="you@example.com" required>
            <span class="field-error">Enter a valid email address.</span>
          </div>
          <div class="field mt-16">
            <label for="password">Password</label>
            <div class="password-wrap">
              <input class="input" type="password" id="password" name="password" autocomplete="new-password" placeholder="At least 8 characters" required minlength="8" maxlength="72">
              <button type="button" class="password-toggle" data-action="toggle-pw" data-target="password" aria-label="Show password">${icon('eye', 17)}</button>
            </div>
            <span class="field-error">Password must be at least 8 characters.</span>
          </div>
          <div class="field mt-16">
            <label for="confirm">Confirm password</label>
            <div class="password-wrap">
              <input class="input" type="password" id="confirm" name="confirm" autocomplete="new-password" placeholder="Repeat your password" required>
              <button type="button" class="password-toggle" data-action="toggle-pw" data-target="confirm" aria-label="Show password">${icon('eye', 17)}</button>
            </div>
            <span class="field-error">Passwords do not match.</span>
          </div>
          <button class="btn btn-primary btn-lg btn-block mt-24" id="signup-btn" style="justify-content:center">Create account</button>
        </form>
        <p class="auth-alt">Already have an account? <a href="/login" data-nav>Log in</a></p>
      </div>
    </div>`;

  el.querySelectorAll('[data-action="toggle-pw"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const inp = el.querySelector('#' + btn.dataset.target);
      inp.type = inp.type === 'password' ? 'text' : 'password';
      btn.innerHTML = icon(inp.type === 'password' ? 'eye' : 'eyeOff', 17);
    });
  });

  el.querySelector('#signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = el.querySelector('#signup-form');
    const name = f.querySelector('#name').value.trim();
    const email = f.querySelector('#email').value.trim();
    const password = f.querySelector('#password').value;
    const confirm = f.querySelector('#confirm').value;
    const btn = el.querySelector('#signup-btn');

    let ok = true;
    const setInvalid = (id, bad) => {
      const field = el.querySelector('#' + id).closest('.field');
      field.classList.toggle('invalid', bad);
      if (bad) ok = false;
    };
    setInvalid('name', name.length < 2 || name.length > 80);
    setInvalid('email', !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email));
    setInvalid('password', password.length < 8);
    setInvalid('confirm', confirm !== password || !confirm);
    if (!ok) return;

    btn.disabled = true;
    btn.innerHTML = `<span class="spin">${icon('refresh', 16)}</span> Creating your account…`;
    try {
      const d = await post('/api/auth/register', { name, email, password });
      setToken(d.token);
      try { sessionStorage.setItem('as_token', d.token); } catch (_) { /* storage unavailable */ }
      store.user = d.user;
      connectSocket();
      try { await refreshAll(); } catch (_) { /* dashboard renders from cached state */ }
      toastOk('Account created', `Welcome, ${d.user.name.split(' ')[0]} — you're logged in.`);
      redirectAfterLogin(d.user);
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = 'Create account';
      if (err.status === 409) {
        toastErr('Email already registered', 'An account with this email already exists. Log in instead.');
        el.querySelector('#email').closest('.field').classList.add('invalid');
      } else {
        toastErr('Signup failed', err.message);
      }
    }
  });
}
