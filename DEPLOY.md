# Publishing Agbota Segun

The site is a standard Node.js app (Express + Socket.IO + PostgreSQL). It can
run on any host that runs Node — from a free platform to your own server.

**Recommended: Render.com** — free tier, supports Docker, WebSockets and
PostgreSQL, and deploys straight from GitHub.

---

## Option A — Render (easiest, free to start)

1. **Push this repository to GitHub** (or GitLab):
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/agbota-segun.git
   git push -u origin main
   ```
   (If you have not pushed yet, create an empty repo on GitHub first — no
   README, no license — then run the two commands above.)

2. **Create a Render account** at https://render.com (email signup is fine).

3. In the Render dashboard click **New → Blueprint** and select your repo.
   Render reads `render.yaml` in this folder and creates:
   - the web service (Docker),
   - a PostgreSQL database,
   - all environment variables — including a **generated JWT_SECRET**.

4. Click **Apply**. After a few minutes the site is live at
   `https://agbota-segun.onrender.com`.

5. Log in as owner (`agbotasegun.outreach@gmail.com` / `ecomexpert`) and
   **change the admin password** under Admin → Settings. (If the app has
   already been live for a moment, the owner account was created on first
   boot — the password is whatever ADMIN_PASSWORD was at that moment.)

### Render free-tier caveats
- Free web services **sleep after 15 minutes** of no visitors and take
  ~30 s to wake up. For a real launch, upgrade to the $7/month "Starter"
  plan so it is always on.
- The free **database expires after 30 days**. For permanence use a free
  **Neon** or **Supabase** Postgres instead (both have generous free tiers
  that do not expire) and set `DATABASE_URL` yourself:
  - Neon: https://neon.tech → create project → copy the connection string
    (`postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`)
  - Supabase: Project Settings → Database → Connection string (pooler),
    port 6543, e.g.
    `postgresql://postgres.<project>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`
  - Paste it into Render → Environment → `DATABASE_URL`, then remove the
    `databases:` block from `render.yaml` or ignore it.
  - On first boot the app creates all tables, indexes and Row Level
    Security policies automatically.

---

## Option B — Railway (alternative one-click host)

1. Push the repo to GitHub.
2. https://railway.app → **New Project → Deploy from GitHub** → select repo.
3. Railway auto-detects the `start` script. Add environment variables:
   `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DATABASE_URL`.
4. Provision **PostgreSQL** from Railway's plugins and copy its connection
   string into `DATABASE_URL`.
5. Railway gives you a `*.up.railway.app` URL immediately.

---

## Option C — Your own server / VPS (full control)

Works on any Ubuntu/Debian VPS (Hetzner, DigitalOcean, Contabo, or a local
Nigerian provider).

```bash
# On the server
apt update && apt install -y nodejs npm git
npm install -g pm2

git clone https://github.com/YOUR_USERNAME/agbota-segun.git
cd agbota-segun
npm ci --omit=dev
cp .env.example .env          # fill in JWT_SECRET, ADMIN_*, DATABASE_URL
npm start                     # test it once

pm2 start server/index.js --name agbota-segun
pm2 save && pm2 startup       # survives reboots
```

Then put Nginx in front (optional but recommended) with a free HTTPS
certificate:

```nginx
# /etc/nginx/sites-available/agbota-segun
server {
  listen 80;
  server_name agbotasegun.com www.agbotasegun.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;      # WebSockets (chat)
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d agbotasegun.com -d www.agbotasegun.com
```

---

## Environment variables (all hosts)

| Variable            | Required | Purpose |
| ------------------- | -------- | ------- |
| `PORT`              | no       | Defaults to 3000 |
| `NODE_ENV`          | yes      | `production` |
| `JWT_SECRET`        | yes      | Long random string — generates session tokens. Never share it. |
| `ADMIN_EMAIL`       | yes      | Owner login email (created on first boot) |
| `ADMIN_PASSWORD`    | yes      | Owner initial password — change it after first login |
| `DATABASE_URL`      | yes*     | Hosted PostgreSQL. If empty, uses an embedded DB stored on disk (fine for a single-server VPS, not for ephemeral platforms). |
| `BTC_ADDRESS`       | no       | Bitcoin address shown when streamers report a payment |
| `MAX_UPLOAD_MB`     | no       | Attachment size limit (default 20) |

\* **Important:** on Render/Railway free tiers the filesystem is
**ephemeral** — uploaded files (receipts, chat images, voice notes) are
deleted on every redeploy. Two fixes, pick one:
- Enable the **persistent disk** (Render blueprint already mounts
  `/app/data`, $1/month) or a **volume** on Railway, or
- Ask me to add **S3-compatible object storage** (Supabase Storage, Cloudflare
  R2, Backblaze B2 — all have free tiers) so files live permanently in the
  cloud. It is a small code change I can do in a few minutes.

---

## Custom domain (optional)

- Buy a domain (e.g. from Namecheap, GoDaddy, or a Nigerian registrar like
  Whogohost / QServers).
- Render: Dashboard → your service → **Settings → Custom Domain** → add it,
  then set the DNS records Render shows you.
- VPS: point an `A` record at your server IP, then run the certbot command
  above.

---

## After deploy — checklist

1. Open the site → register a test streamer → log in → place an order.
2. Log in as owner → `/admin` → confirm the payment → mark order delivered.
3. Send a chat message both ways → refresh → messages persist.
4. Change the admin password (Admin → Settings).
5. Point your domain at it and tell the world. 🚀
