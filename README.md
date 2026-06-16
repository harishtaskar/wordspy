# wordspy — Secret Word Agent

A fast browser social-deduction party game. Monorepo: Next.js web client + Node/Socket.IO server + shared types.

## Structure

```
packages/types   # shared client↔server event contract (single source of truth)
apps/server      # Express + Socket.IO authoritative game server (Railway/Render)
apps/web         # Next.js + Tailwind + Zustand client (Vercel)
```

## Develop

```bash
npm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env.local
npm run dev          # builds types, then runs server (:4000) + web (:3000)
```

Open http://localhost:3000 — the brutalist shell renders and the connection
indicator flips to **CONNECTED**. Stop the server and it flips to **DISCONNECTED**.

## Test

```bash
npm test             # all workspaces (Vitest)
```

## Deploy note

The Socket.IO server needs a long-lived host (Railway/Render) — **not** Vercel
serverless. The web app talks to it via the absolute `NEXT_PUBLIC_SOCKET_URL`.
