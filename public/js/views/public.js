/* Home page — premium marketing, real data only (products + approved reviews). */
'use strict';

import { store } from '../store.js';
import { esc, icon, money, skeleton, statusPill } from '../ui.js';

export async function homeView(el) {
  const products = store.products;
  el.innerHTML = `
    <section class="hero">
      <div class="container hero-grid">
        <div>
          <span class="eyebrow">Creator &amp; Streamer Growth Strategies</span>
          <h1>Grow with a <span class="amp">strategy</span>, not just hope.</h1>
          <p class="lead">Agbota Segun designs structured growth blueprints for Twitch streamers, YouTube creators and short-form creators — then stays with you in chat as you put them to work.</p>
          <div class="hero-actions">
            <a class="btn btn-primary btn-lg" href="/strategies" data-nav>${icon('spark', 18)}Explore strategies</a>
            <a class="btn btn-ghost btn-lg" href="/how-it-works" data-nav>How it works</a>
          </div>
          <p class="hero-note">${icon('shield', 15)}Real strategy documents · direct support from Agbota Segun · no automation pretending to be human</p>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <div class="glow"></div>
          <div class="hero-card">
            <div class="hero-card-top"><span class="dot a"></span><span class="dot b"></span><span class="dot c"></span><span>Chat with Agbota Segun</span></div>
            <div class="hero-chat">
              <div class="hero-bubble in">Hey — I stream on Twitch and TikTok. My growth feels random. Where do I start?</div>
              <div class="hero-bubble out">Start with one clear plan. Pick your main platform, build a weekly structure, and let short-form feed the stream. I'll map it out with you.</div>
              <div class="hero-bubble in">That's exactly what I needed. Let's do it.</div>
            </div>
          </div>
          <div class="hero-float f1">
            <span class="ic" style="background:var(--green-soft);color:var(--green)">${icon('checkCircle', 18)}</span>
            <div><b>Strategy delivered</b><small>YouTube + TikTok · $60</small></div>
          </div>
          <div class="hero-float f2">
            <span class="ic" style="background:var(--accent-soft);color:var(--accent)">${icon('spark', 18)}</span>
            <div><b>Personal plan</b><small>Built for your platforms</small></div>
          </div>
        </div>
      </div>
    </section>

    <div class="logo-strip">
      <div class="container">
        <span>Twitch</span><span>YouTube</span><span>TikTok</span><span>Facebook</span><span>Instagram</span><span>Discord</span>
      </div>
    </div>

    <section class="section" id="why">
      <div class="container">
        <div class="section-head center">
          <span class="eyebrow">Why a growth strategy</span>
          <h2>Most creators don't have a growth problem.<br>They have a <em style="font-style:italic;color:var(--accent)">structure</em> problem.</h2>
          <p class="lead">No strategy can guarantee viewers or followers — anyone who promises that is not being honest with you. What a well-built strategy does is give your work direction: clear positioning, consistent output and a plan you can actually follow.</p>
        </div>
        <div class="feature-row">
          <div class="card feature">
            <span class="ic">${icon('compass', 20)}</span>
            <div><h3>Positioning first</h3><p>Know exactly who you serve and why they should watch — before you post another video.</p></div>
          </div>
          <div class="card feature">
            <span class="ic">${icon('calendar', 20)}</span>
            <div><h3>Consistency that lasts</h3><p>A realistic content structure you can sustain for months, not a sprint that burns out in two weeks.</p></div>
          </div>
          <div class="card feature">
            <span class="ic">${icon('users', 20)}</span>
            <div><h3>Community that returns</h3><p>Turn one-time viewers into regulars who show up, engage and bring others with them.</p></div>
          </div>
          <div class="card feature">
            <span class="ic">${icon('chat', 20)}</span>
            <div><h3>Direct support</h3><p>Every strategy comes with direct access to Agbota Segun through the site's chat — ask, adjust, keep moving.</p></div>
          </div>
          <div class="card feature">
            <span class="ic">${icon('doc', 20)}</span>
            <div><h3>Real documents</h3><p>Your order delivers a practical written strategy — checklists, frameworks and plans you can apply immediately.</p></div>
          </div>
          <div class="card feature">
            <span class="ic">${icon('lock', 20)}</span>
            <div><h3>One-to-one privacy</h3><p>Your conversations and orders are private to you and Agbota Segun. No community threads, no noise.</p></div>
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="categories" style="padding-top:0">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow">Strategy categories</span>
          <h2>Built around the platforms you actually use</h2>
        </div>
        <div class="grid-3">
          <div class="card">
            <span class="pill amber">Single platform</span>
            <h3 class="mt-16" style="font-size:20px">One platform, one clear plan</h3>
            <p class="muted mt-8" style="font-size:14px">A focused blueprint for your main platform — positioning, content structure, discovery and consistency. <b>$30</b></p>
          </div>
          <div class="card">
            <span class="pill blue">Combined strategies</span>
            <h3 class="mt-16" style="font-size:20px">Platforms that work together</h3>
            <p class="muted mt-8" style="font-size:14px">Coordinated systems for creators active on two, three or four platforms — one engine, every platform pulling the same direction. <b>$55 – $120</b></p>
          </div>
          <div class="card">
            <span class="pill green">Custom</span>
            <h3 class="mt-16" style="font-size:20px">Built around your situation</h3>
            <p class="muted mt-8" style="font-size:14px">A personal strategy designed around your exact platforms, goals and starting point — starting around <b>$150</b>, agreed before you pay.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="products" style="padding-top:0">
      <div class="container">
        <div class="section-head flex-between" style="display:flex;align-items:flex-end;gap:20px">
          <div>
            <span class="eyebrow">The store</span>
            <h2>Growth strategies</h2>
          </div>
          <a class="btn btn-ghost" href="/strategies" data-nav>View all strategies ${icon('arrowLeft', 16, 2)}</a>
        </div>
        ${products.length ? `
        <div class="grid-3">
          ${products.slice(0, 6).map((p) => productCard(p)).join('')}
        </div>` : `<div class="card">${skeleton(3)}</div>`}
      </div>
    </section>

    <section class="section" id="how" style="padding-top:0">
      <div class="container">
        <div class="section-head center">
          <span class="eyebrow">How it works</span>
          <h2>From decision to direction in four steps</h2>
        </div>
        <div class="grid-4">
          <div class="card step">
            <span class="ic">${icon('search', 20)}</span>
            <span class="num">01</span>
            <h3>Browse</h3>
            <p>Explore the single-platform, combined and custom strategies and find the right fit.</p>
          </div>
          <div class="card step">
            <span class="ic">${icon('profile', 20)}</span>
            <span class="num">02</span>
            <h3>Create your account</h3>
            <p>Sign up free as a streamer — you get your own dashboard and a private chat with Agbota Segun.</p>
          </div>
          <div class="card step">
            <span class="ic">${icon('box', 20)}</span>
            <span class="num">03</span>
            <h3>Choose &amp; order</h3>
            <p>Place your order. A real order is created on your account — nothing is charged automatically.</p>
          </div>
          <div class="card step">
            <span class="ic">${icon('chat', 20)}</span>
            <span class="num">04</span>
            <h3>Contact through Chat</h3>
            <p>Message Agbota Segun through Chat to receive your payment details for the chosen method.</p>
          </div>
          <div class="card step">
            <span class="ic">${icon('payments', 20)}</span>
            <span class="num">05</span>
            <h3>Complete the payment</h3>
            <p>Pay externally, then click <b>Payment made</b> on your order with the reference.</p>
          </div>
          <div class="card step">
            <span class="ic">${icon('shield', 20)}</span>
            <span class="num">06</span>
            <h3>Manually confirmed</h3>
            <p>Agbota Segun verifies the payment personally and confirms it. Nothing is auto-confirmed.</p>
          </div>
          <div class="card step">
            <span class="ic">${icon('doc', 20)}</span>
            <span class="num">07</span>
            <h3>Strategy delivered</h3>
            <p>Your strategy is delivered, with chat support for questions and adjustments along the way.</p>
          </div>
          <div class="card step" style="border-color:var(--accent-line);background:linear-gradient(160deg,#191d2e,#10131d)">
            <span class="ic">${icon('spark', 20)}</span>
            <span class="num" style="color:var(--accent-strong)">Start now</span>
            <h3>Ready when you are</h3>
            <p>Create your free account and start the conversation — the store is open.</p>
            <a class="btn btn-primary btn-sm mt-16" href="/strategies" data-nav style="justify-content:center">Explore strategies</a>
          </div>
        </div>
      </div>
    </section>

    ${store.reviews.length ? `
    <section class="section" id="reviews" style="padding-top:0">
      <div class="container">
        <div class="section-head center">
          <span class="eyebrow">From real customers</span>
          <h2>Reviews from verified orders</h2>
          <p class="lead">Reviews are written only by streamers who completed an order — and published after review.</p>
        </div>
        <div class="grid-3">
          ${store.reviews.slice(0, 6).map((r) => `
            <div class="card review-card">
              <span class="review-stars" aria-label="${r.rating} out of 5 stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
              <blockquote>“${esc(r.body)}”</blockquote>
              <div class="who">
                <span class="avatar">${esc(r.streamer_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</span>
                <div><b class="small">${esc(r.streamer_name)}</b><span class="small muted" style="display:block">${esc(r.product_name)}</span></div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </section>` : ''}

    <section class="section" id="proof" style="padding-top:0">
      <div class="container">
        <div class="section-head center">
          <span class="eyebrow">Proof of work</span>
          <h2>Real Work. <span style="font-style:italic;color:var(--accent)">Real Conversations.</span></h2>
          <p class="lead">Actual client conversations, strategy deliveries and channel progress — evidence of real work, shared transparently. Client details are redacted for privacy, and results are never guaranteed.</p>
        </div>
        <div class="grid-3">
          <div class="card card-hover" style="display:grid;gap:10px">
            <span class="ic" style="width:44px;height:44px;border-radius:12px;background:var(--accent-soft);border:1px solid var(--accent-line);display:grid;place-items:center;color:var(--accent)">${icon('chat', 20)}</span>
            <h3 style="font-size:19px">Client Conversations</h3>
            <p class="muted" style="font-size:14px;line-height:1.65">Authentic communication, support, feedback and delivery conversations with real clients.</p>
            <a class="btn btn-ghost btn-sm" href="/proof" data-nav style="justify-content:center">View conversations</a>
          </div>
          <div class="card card-hover" style="display:grid;gap:10px">
            <span class="ic" style="width:44px;height:44px;border-radius:12px;background:var(--blue-soft);border:1px solid rgba(122,167,240,.3);display:grid;place-items:center;color:var(--blue)">${icon('box', 20)}</span>
            <h3 style="font-size:19px">Strategy Delivery</h3>
            <p class="muted" style="font-size:14px;line-height:1.65">Proof that strategy products are actually delivered and supported — not just sold.</p>
            <a class="btn btn-ghost btn-sm" href="/proof" data-nav style="justify-content:center">View deliveries</a>
          </div>
          <div class="card card-hover" style="display:grid;gap:10px">
            <span class="ic" style="width:44px;height:44px;border-radius:12px;background:var(--green-soft);border:1px solid rgba(67,209,138,.3);display:grid;place-items:center;color:var(--green)">${icon('trend', 20)}</span>
            <h3 style="font-size:19px">Channel Progress</h3>
            <p class="muted" style="font-size:14px;line-height:1.65">Examples of channel and account progress — shared as evidence, never as a guarantee.</p>
            <a class="btn btn-ghost btn-sm" href="/proof" data-nav style="justify-content:center">View progress</a>
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="about" style="padding-top:0">
      <div class="container">
        <div class="grid-2" style="align-items:center">
          <div>
            <span class="eyebrow">About</span>
            <h2 style="font-size:clamp(28px,3.4vw,40px);margin:12px 0 14px">Agbota Segun —<br>growth strategy, delivered personally</h2>
            <p class="lead">Agbota Segun builds practical growth strategies for streamers and creators who want structure instead of guesswork. Every strategy is written with a clear understanding of how each platform actually works — and every customer gets direct access to ask questions and refine the plan.</p>
            <div class="hero-actions">
              <a class="btn btn-primary" href="/about" data-nav>More about Agbota Segun</a>
            </div>
          </div>
          <div class="card" style="padding:32px">
            <div class="stack">
              <div class="flex" style="gap:14px"><span class="ic" style="width:44px;height:44px;border-radius:12px;background:var(--accent-soft);border:1px solid var(--accent-line);display:grid;place-items:center;color:var(--accent)">${icon('spark', 20)}</span><div><b>Built for creators</b><p class="muted small">Focused on Twitch streamers, YouTube creators and short-form creators.</p></div></div>
              <div class="flex" style="gap:14px"><span class="ic" style="width:44px;height:44px;border-radius:12px;background:var(--accent-soft);border:1px solid var(--accent-line);display:grid;place-items:center;color:var(--accent)">${icon('chat', 20)}</span><div><b>Human support</b><p class="muted small">Real conversations through the site's chat — not bots or templates.</p></div></div>
              <div class="flex" style="gap:14px"><span class="ic" style="width:44px;height:44px;border-radius:12px;background:var(--accent-soft);border:1px solid var(--accent-line);display:grid;place-items:center;color:var(--accent)">${icon('shield', 20)}</span><div><b>Honest expectations</b><p class="muted small">No guaranteed viewers, no fake numbers. Just a real plan and real work.</p></div></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section" style="padding-top:0">
      <div class="container">
        <div class="cta-band">
          <span class="eyebrow" style="justify-content:center">Ready to build your plan?</span>
          <h2 class="mt-8">Your growth deserves a strategy.</h2>
          <p>Browse the strategies, create your free streamer account, and start a conversation with Agbota Segun today.</p>
          <div class="hero-actions" style="justify-content:center">
            <a class="btn btn-primary btn-lg" href="/strategies" data-nav>${icon('spark', 18)}Explore strategies</a>
            <a class="btn btn-ghost btn-lg" href="/contact" data-nav>${icon('chat', 18)}Contact / Chat</a>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function productCard(p) {
  return `
    <article class="card card-hover product-card">
      <div class="flex-between">
        <span class="pill ${p.category === 'single' ? 'amber' : p.category === 'bundle' ? 'blue' : 'green'}">${esc(p.category === 'single' ? 'Single platform' : p.category === 'bundle' ? 'Combined' : 'Custom')}</span>
        <span class="pf">${(p.platforms || []).map((pl) => `<span class="platform-chip">${esc(pl)}</span>`).join('')}</span>
      </div>
      <h3>${esc(p.name)}</h3>
      <p class="tagline">${esc(p.tagline)}</p>
      <div class="price-row">
        <span class="price">${money(p.price_cents)}${p.id === 'custom-multi' ? '<small> starting</small>' : ''}</span>
        <a class="btn btn-primary btn-sm" href="/strategies/${encodeURIComponent(p.id)}" data-nav>View strategy</a>
      </div>
    </article>`;
}
