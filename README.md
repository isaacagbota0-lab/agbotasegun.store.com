# Agbota Segun — Creator & Streamer Growth Strategies

A production-quality commercial platform operated by **Agbota Segun**: a digital
creator/streamer growth strategy store with real accounts, real orders, real
payment review, and a real-time human-to-human messaging system.

> This is not a demo. Authentication, messaging, orders, payments, reviews and
> the admin dashboard are fully implemented against a real PostgreSQL database.

---

## Quick start

```bash
npm install
cp .env.example .env      # then edit .env (see below)
npm start                 # → http://localhost:3000
```

On first boot the server:

1. creates all database tables, indexes, triggers and Row Level Security policies;
2. seeds the official strategy catalog (prices exactly as published);
3. creates the Owner/Admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

### Owner / Admin account

| Field    | Value                                  |
| -------- | -------------------------------------- |
| Email    | `agbotasegun.outreach@gmail.com`       |
| Password | `ecomexpert` (initial — **change it** from Admin → Settings) |
| Role     | `owner`                                |

The password is hashed with **bcrypt** (cost 12). It is never stored in plain
text and never exposed to the browser. After login the owner is redirected
straight to `/admin`.

### Environment variables (`.env.example`)

| Variable            | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `PORT`              | HTTP port (default 3000)                                       |
| `NODE_ENV`          | `development` / `production`                                   |
| `DATABASE_URL`      | **Optional.** A hosted PostgreSQL connection string (Supabase, Neon, RDS…). When empty, the server uses an embedded PostgreSQL engine (PGlite) persisted in `./data/db`. |
| `JWT_SECRET`        | Long random secret signing session cookies. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ADMIN_EMAIL`       | Owner account email, created on first boot                     |
| `ADMIN_PASSWORD`    | Owner initial password (bcrypt-hashed before storage)          |
| `BTC_ADDRESS`       | Bitcoin address shown to streamers when they report a payment  |
| `PAYPAL_INSTRUCTIONS` | Instructions shown for PayPal payments                       |
| `MAX_UPLOAD_MB`     | Attachment size limit (default 20)                             |

**Security:** the service-role style key (`DATABASE_URL` with elevated
credentials) is only ever used server-side. No secret appears in frontend
JavaScript. `JWT_SECRET` is read from the environment only.

---

## Architecture

```
public/                 Frontend (vanilla ES modules, no build step)
  index.html            SPA shell, SEO/OG metadata, self-hosted fonts
  css/styles.css        Design system (dark theme, #D4A853 accent)
  js/                   api client · ui toolkit · store/realtime · views
server/
  index.js              Express app, security headers, boot, SPA fallback
  config.js             Environment configuration
  db.js                 Database layer (embedded PGlite ⇄ hosted Postgres)
  schema.sql            Full schema + Row Level Security policies
  seed.js               Official product catalog (fixed prices)
  auth.js               bcrypt + JWT httpOnly-cookie sessions, role guards
  uploads.js            Multer + magic-byte validation, typed allow-lists
  realtime.js           Socket.IO (cookie-authenticated, room-scoped)
  notifications.js      Database-backed notifications + realtime push
  routes/               auth · store (orders/payments) · reviews ·
                        messaging (chat) · admin
scripts/                db reset · OG image renderer
```

### Frontend ⇄ backend

The SPA talks to the REST API (`/api/*`) and the realtime socket
(Socket.IO). Pages: Home, Strategies, product pages, How it works, About,
Contact, Login, Signup, Streamer Dashboard (`/dashboard/*`), Owner Dashboard
(`/admin/*`).

### Database

PostgreSQL with:

- `profiles` (users + role), `products`, `conversations`,
  `conversation_participants`, `messages`, `orders`, `payments`, `reviews`,
  `notifications`;
- timestamps, foreign keys, CHECK constraints, indexes;
- **Row Level Security enabled and forced on every table** — policies are
  evaluated against `app.user_id` / `app.user_role` session variables set per
  request. On hosted PostgreSQL the database itself enforces these policies;
  the application layer enforces the identical rules on the embedded engine.

### Storage

Uploads (images, documents, voice messages, receipts) are validated by MIME
type **and** magic bytes, stored under `./data/uploads` (or your object store
in production), referenced from the database, and served only through the
authorized `/api/files/*` route — access is limited to conversation
participants / the owning streamer / the owner.

---

## Feature map

- **Auth** — real signup/login/logout; streamer signup creates the account,
  profile, `streamer` role, an automatic conversation with the owner, and an
  admin notification — all in one transaction. Login rate limiting included.
  Sessions work three ways: an httpOnly cookie, an `Authorization: Bearer`
  token, and a `?token=` query parameter — so authentication works even in
  environments that strip cookies and headers (e.g. sandboxed preview
  iframes). New streamers land on the public homepage after signup; the
  owner is redirected straight to `/admin` after login.
- **Roles** — `streamer` and `owner`. `/admin/*` is guarded server-side;
  a streamer can never reach it, even by URL.
- **Messaging** — permanent database storage; Socket.IO realtime (no refresh);
  owner-first conversations; unread counters; text / image / document / voice
  messages; per-conversation isolation. The workspace is full-height
  (Upwork-style): contact list left, conversation right, its own vertical
  scroll area, a pinned composer, smart auto-scroll with a "scroll to latest"
  button, and a full-screen mobile conversation with a back button.
- **Orders** — real orders with order numbers, prices from the catalog, and
  status history. New accounts start with **0** orders.
- **Payments** — "Payment made" creates a *pending* record and notifies the
  owner; only the owner's **Confirm payment** marks it confirmed. No fake
  successes.
- **Reviews** — only real customers with completed orders can review; owner
  moderates; only approved reviews appear publicly.
- **Admin** — overview stats (real counts), streamer management + search,
  inbox, orders, payments, product catalog editing, review moderation,
  settings.
- **Proof of work** — a database-backed "Proof of Work" gallery with six
  categories (client conversations, strategy work, streamer analysis, channel
  progress, feedback, payout evidence), live counts per category, and a
  lightbox with prev/next, zoom, keyboard and mobile swipe. The owner manages
  everything from Admin → Proof: upload screenshots (with a privacy warning —
  new items start unpublished), edit, publish/unpublish, reorder and delete.
  Only explicitly published items appear publicly; nothing is invented.
- **Notifications** — database rows pushed in realtime for signups, messages,
  orders and payment reviews.

---

## Production notes

- Set `NODE_ENV=production` (secure cookies, longer static caching).
- Point `DATABASE_URL` at a hosted PostgreSQL so RLS is enforced by the
  database (the schema applies automatically on boot).
- Store `JWT_SECRET`, admin credentials and DB credentials in your
  deployment's secret manager, not in the repo.
- Serve behind a TLS-terminating reverse proxy (Caddy/Nginx/Cloudflare).
- `npm run db:reset` wipes only the local embedded database.

## Tests

Manual/scripted QA flows covered during development:

- Streamer signup → appears in Admin contacts → owner messages first →
  streamer replies in realtime → messages persist across refresh/logout/login.
- Order → payment report → owner confirm → streamer sees PAYMENT CONFIRMED.
- Streamer ↔ streamer isolation (messages, orders, payments, files).
- Streamer → `/admin` blocked; logged-out → dashboards require login.
- Image, document and voice message uploads with type/byte validation.
