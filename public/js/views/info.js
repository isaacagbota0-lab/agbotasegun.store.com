/* How it works / About / Contact — public pages. */
'use strict';

import { store } from '../store.js';
import { esc, icon } from '../ui.js';

/* ── /how-it-works ──────────────────────────────────────────────────────── */
export async function howView(el) {
  el.innerHTML = `
    <section class="section">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow">How it works</span>
          <h1 style="font-size:clamp(34px,4.6vw,52px);margin:12px 0 12px">From decision to direction</h1>
          <p class="lead">A simple, honest process: choose a strategy, place your order, confirm your payment, and work with Agbota Segun directly.</p>
        </div>

        <div class="grid-2">
          <div class="card step">
            <span class="ic">${icon('search', 20)}</span>
            <span class="num">01 — Choose your strategy</span>
            <h3>Find the right fit</h3>
            <p>Browse single-platform strategies ($30), combined strategies ($55–$120) or a custom multi-platform plan (from $150). Every product page explains exactly what you get, what's included and who it's for.</p>
          </div>
          <div class="card step">
            <span class="ic">${icon('profile', 20)}</span>
            <span class="num">02 — Create your account</span>
            <h3>Free streamer account</h3>
            <p>Sign up with your name, email and a password. Your account is created securely, you're logged in immediately, and you get a private conversation with Agbota Segun — no need to send the first message.</p>
          </div>
          <div class="card step">
            <span class="ic">${icon('box', 20)}</span>
            <span class="num">03 — Place your order</span>
            <h3>Order from the store</h3>
            <p>One click creates your real order with its own order number. Nothing is charged automatically — you choose how to pay and report it when done.</p>
          </div>
          <div class="card step">
            <span class="ic">${icon('payments', 20)}</span>
            <span class="num">04 — Pay &amp; report</span>
            <h3>Payment, personally confirmed</h3>
            <p>Pay through the method you arranged, then click <b>Payment made</b> on your order. Agbota Segun receives a notification, reviews it and confirms the payment — your dashboard shows every status change.</p>
          </div>
          <div class="card step">
            <span class="ic">${icon('doc', 20)}</span>
            <span class="num">05 — Receive your strategy</span>
            <h3>Your strategy is delivered</h3>
            <p>Once payment is confirmed, your strategy is delivered to you. It arrives as a real, practical document you can keep and apply.</p>
          </div>
          <div class="card step">
            <span class="ic">${icon('chat', 20)}</span>
            <span class="num">06 — Keep the conversation open</span>
            <h3>Support in chat</h3>
            <p>Questions about your strategy? Send a message — or an image, document or voice note — and get a reply from Agbota Segun. Messages are stored on your account and survive refreshes, logouts and devices.</p>
          </div>
        </div>

        <div class="cta-band mt-24">
          <h2>Ready to start?</h2>
          <p>Create your account and browse the strategies.</p>
          <div class="hero-actions" style="justify-content:center">
            <a class="btn btn-primary btn-lg" href="/signup" data-nav>Create free account</a>
            <a class="btn btn-ghost btn-lg" href="/strategies" data-nav>Browse strategies</a>
          </div>
        </div>
      </div>
    </section>`;
}

/* ── /about ─────────────────────────────────────────────────────────────── */
export async function aboutView(el) {
  el.innerHTML = `
    <section class="section">
      <div class="container-narrow">
        <span class="eyebrow">About</span>
        <h1 style="font-size:clamp(36px,5vw,56px);margin:14px 0 18px">Agbota Segun</h1>
        <p class="lead" style="font-size:19px">Independent creator &amp; streamer growth strategist. Agbota Segun designs structured growth blueprints for creators who are done guessing.</p>

        <div class="card mt-24" style="padding:30px">
          <h2 style="font-size:24px">What this platform is</h2>
          <div class="stack mt-16 muted" style="font-size:15.5px;line-height:1.75">
            <p>Most creators don't fail because they lack talent or effort — they fail because they lack structure. Content goes up randomly, platforms are treated the same way, and growth never compounds.</p>
            <p>This platform exists to replace that randomness with a plan. Each strategy is a written blueprint covering positioning, content structure, discovery and consistency — built around how the platform you create for actually works.</p>
            <p>The store is the product. The chat is the support. When you order a strategy, you get the document itself and direct access to Agbota Segun to ask questions, clarify the plan and adjust it to your situation.</p>
          </div>
        </div>

        <div class="card mt-16" style="padding:30px">
          <h2 style="font-size:24px">Who it's for</h2>
          <div class="stack mt-16 muted" style="font-size:15.5px;line-height:1.75">
            <p>Twitch streamers building a returning-viewer community. YouTube creators who want their uploads to actually compound. TikTok and short-form creators who post daily without direction. Facebook and Instagram creators organizing their presence. Discord community builders. And small creators — the ones with real ambition and no roadmap — who want a structured approach to growth.</p>
          </div>
        </div>

        <div class="card mt-16" style="padding:30px;border-color:var(--accent-line);background:linear-gradient(160deg,#191d2e,#10131d)">
          <h2 style="font-size:24px">The honest part</h2>
          <div class="stack mt-16 muted" style="font-size:15.5px;line-height:1.75">
            <p>Nobody can guarantee viewers, followers or income — and this platform never will. What a strategy <em>can</em> do is give you a clearer, more structured and more effective way to grow: the right positioning, the right content structure, and the consistency to let your work compound.</p>
            <p>If that sounds like what you need, the store is open. If you're not sure which strategy fits, create an account and ask — the conversation is free.</p>
          </div>
          <div class="hero-actions">
            <a class="btn btn-primary" href="/strategies" data-nav>Browse strategies</a>
            <a class="btn btn-ghost" href="/contact" data-nav>${icon('chat', 18)}Contact</a>
          </div>
        </div>
      </div>
    </section>`;
}

/* ── /contact ───────────────────────────────────────────────────────────── */
export async function contactView(el) {
  const authed = !!store.user;
  el.innerHTML = `
    <section class="section">
      <div class="container-narrow">
        <span class="eyebrow">Contact</span>
        <h1 style="font-size:clamp(36px,5vw,56px);margin:14px 0 18px">Let's talk</h1>
        <p class="lead">The fastest way to reach Agbota Segun is the website's internal <b>Chat</b> — real conversations, stored on your account, available from any device.</p>

        <div class="grid-2 mt-24" style="grid-template-columns:1fr 1fr">
          <div class="card" style="padding:28px">
            <span class="ic" style="width:44px;height:44px;border-radius:12px;background:var(--accent-soft);border:1px solid var(--accent-line);display:grid;place-items:center;color:var(--accent);margin-bottom:16px">${icon('chat', 20)}</span>
            <h3 style="font-size:20px">Chat (recommended)</h3>
            <p class="muted small mt-8" style="line-height:1.7">Message Agbota Segun directly from your dashboard. Attach images, documents or voice notes, and get replies in real time. Your messages stay saved on your account.</p>
            <a class="btn btn-primary btn-block mt-16" style="justify-content:center" href="${authed ? (store.user.role === 'owner' ? '/admin/messages' : '/dashboard/chat') : '/signup?next=/dashboard/chat'}" data-nav>${icon('chat', 18)}${authed ? 'Open Chat' : 'Create account & Chat'}</a>
          </div>
          <div class="card" style="padding:28px">
            <span class="ic" style="width:44px;height:44px;border-radius:12px;background:var(--blue-soft);border:1px solid rgba(122,167,240,.3);display:grid;place-items:center;color:var(--blue);margin-bottom:16px">${icon('mail', 20)}</span>
            <h3 style="font-size:20px">Email</h3>
            <p class="muted small mt-8" style="line-height:1.7">For business inquiries and anything that is not account-related, write to the business email.</p>
            <a class="btn btn-ghost btn-block mt-16" style="justify-content:center" href="mailto:agbotasegun.outreach@gmail.com">${icon('mail', 18)}agbotasegun.outreach@gmail.com</a>
          </div>
        </div>

        <div class="card mt-16" style="padding:28px">
          <h3 style="font-size:18px">What to expect</h3>
          <div class="stack mt-16 muted small" style="line-height:1.7">
            <p>• Orders and payments are handled inside your dashboard — no need to email payment details.</p>
            <p>• If you already placed an order, use Chat for anything related to it; the order and conversation are linked to your account.</p>
            <p>• For account problems (login, password, email), use Chat — it is the primary customer support method.</p>
          </div>
        </div>
      </div>
    </section>`;
}
