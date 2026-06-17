# Deploying wordspy

Two pieces, deployed separately:

- **Web (Next.js)** → **Vercel**
- **Socket.IO server (Node)** → **Railway** or **Render** (needs a long-lived
  process — Vercel serverless can't hold WebSockets)

No database (state is in-memory).

---

## 1. Deploy the server (Railway)

1. Push this repo to GitHub (done).
2. [Railway](https://railway.app) → **New Project → Deploy from GitHub repo** →
   pick this repo. Railway reads `railway.json`:
   - build: `npm install && npm run build:server`
   - start: `npm run start:server`  (→ `node apps/server/dist/index.js`)
3. **Variables** (Railway tab):
   - `WEB_ORIGIN` = your Vercel URL (fill in after step 2) — e.g.
     `https://wordspy.vercel.app`
   - `PORT` — Railway sets this automatically; the server reads it.
4. **Settings → Networking → Generate Domain.** Copy the URL, e.g.
   `https://wordspy-server.up.railway.app`.

(Render alternative: New → Blueprint, it reads `render.yaml`.)

### Server on Fly.io (warm, no cold-start)

Uses `Dockerfile` + `fly.toml` (already in the repo; the image bundles only the
server + shared types).

```bash
# install flyctl: https://fly.io/docs/flyctl/install/
fly auth login
fly launch --no-deploy        # accept the fly.toml; pick a unique app name + region
fly secrets set WEB_ORIGIN=https://your-app.vercel.app
fly deploy
fly status                    # shows the https URL, e.g. https://wordspy-server.fly.dev
```

`fly.toml` keeps one machine always running (`auto_stop_machines = "off"`,
`min_machines_running = 1`) so there's no cold start; `force_https` gives `wss`
for Socket.IO. Health check hits `/health`.

## 2. Deploy the web (Vercel)

1. [Vercel](https://vercel.com) → **Add New → Project** → import this repo.
2. **Root Directory:** `apps/web` (Vercel detects the monorepo and installs from
   the repo root, which builds `@wordspy/types`). Framework: Next.js (auto).
3. **Environment Variables:**
   - `NEXT_PUBLIC_SOCKET_URL` = the server URL from step 1
     (`https://wordspy-server.up.railway.app`).
   - ⚠️ This is baked in at **build time** — set it before deploying.
4. **Deploy.** Copy the production URL (e.g. `https://wordspy.vercel.app`).

## 3. Close the CORS loop

Back on Railway, set `WEB_ORIGIN` = the Vercel production URL → redeploy the
server. Done — open the Vercel URL and play.

**Order:** server first (get URL) → Vercel with that URL → set `WEB_ORIGIN` →
redeploy server.

---

## Known limits (fine for casual play)

- **`WEB_ORIGIN` is one exact origin.** Vercel **preview** deploys get random
  `*.vercel.app` URLs that won't match → they fail CORS. Only the production
  domain works (widening this is a deferred item).
- **In-memory state:** every server redeploy/restart **drops all active games**.
- Still deferred for hardened public play: crypto room codes, rate-limiting,
  room cap, Postgres persistence/reconnect.

## Local

```bash
npm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env.local
npm run dev        # server :4000 + web :3000
```
