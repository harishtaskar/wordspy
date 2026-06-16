# Implementation Plan — Secret Word Agent (Wordspy)

Source: `prd.md` v1.0 MVP
Stack: Next.js / React / Tailwind (frontend) · Node.js / Socket.IO (backend) · PostgreSQL · Vercel + Railway/Render

---

## 1. Architecture Overview

**Authoritative server model.** The Socket.IO server is the single source of truth for every room's game state. Clients render state and send intents (join, start, vote, guess); they never compute outcomes. This is mandatory for a social-deduction game — the secret word and Imposter identity must never leak to the wrong client.

```
┌─────────────┐   WebSocket    ┌──────────────────┐
│ Next.js SPA │ ◄───────────► │ Socket.IO server  │
│ (Vercel)    │   intents/     │ (Railway/Render)  │
│             │   state diffs  │  - room registry  │
└─────────────┘                │  - game FSM       │
                               │  - timers         │
                               └────────┬─────────┘
                                        │
                                  ┌─────▼─────┐
                                  │ PostgreSQL │  (match history, scores — Nice-to-Have)
                                  └───────────┘
```

**State location:** Live game state lives in server memory (a `Map<roomCode, Room>`). Postgres is only for persistence (scores, match history) and is NOT on the MVP critical path — rooms work fully in-memory first.

**Per-player payloads.** On role assignment the server emits a *different* payload to each socket: Crew gets `{ role: "crew", word }`, Imposter gets `{ role: "imposter" }`. Never broadcast the word to the room.

---

## 2. MVP Decisions (resolving PRD §17 open questions)

To unblock build, these defaults are assumed. Flag any to change.

| # | Question | MVP Default |
|---|----------|-------------|
| 1 | Player count | min 3, max 10 |
| 2 | Vote tie | re-vote once; if still tied, nobody eliminated → next round |
| 3 | Vote for self | No |
| 4 | Skip vote | No (must vote; abstain counts as no-vote, not blocking) |
| 5 | Imposter knows category | Yes (matches PRD discussion examples) |
| 6 | Eliminated players watch | Yes, spectate; cannot vote/talk |
| 7 | Editable usernames mid-match | No |
| 8 | Discussion medium | Text chat only (voice = future) |
| 9 | Host disconnect | Migrate host to next player; room persists |
| 10 | Username profanity filter | Basic wordlist filter |
| 11 | Final guess timed | Yes, 20s |
| 12 | Show vote counts | Yes, after each round reveal |
| 13 | One Imposter only | Yes (multi = future) |
| 14 | Word selection | Static JSON word packs per category, random pick |
| 15 | Disconnect during voting | Their vote dropped; round proceeds |
| 16 | Instant rematch | Yes, "Play Again" keeps room + players |
| 17 | Account required | No — anonymous, ephemeral session id |
| 18 | Public matchmaking | No in MVP (private rooms via code/link) |
| 19 | Custom categories | No (future) |
| 20 | Scoring → ranking | Score tracked per match only; no persistence ranking |

---

## 3. Game State Machine (server-side FSM)

```
LOBBY
  → (host starts, ≥3 players)
ROLE_ASSIGNMENT        (brief reveal, ~5s)
  → DISCUSSION_1       (timer: host setting 60–120s)
  → VOTE_1             (all active players vote)
  → RESULT_1
      ├─ suspect == Imposter → END (Crew win) → FINAL_GUESS
      └─ suspect == Crew     → DISCUSSION_2
  → DISCUSSION_2
  → VOTE_2
  → RESULT_2
      ├─ suspect == Imposter → FINAL_GUESS
      └─ Imposter survived   → END (Imposter win)
FINAL_GUESS            (Imposter guesses word, 20s)
  ├─ correct   → END (Imposter steals win)
  └─ incorrect → END (Crew win)
END → (Play Again) → LOBBY
```

Each transition validates: who can act, current phase, quorum. Reject out-of-phase intents.

---

## 4. Socket.IO Event Contract

**Client → Server**
| Event | Payload | Phase |
|-------|---------|-------|
| `room:create` | `{ username, settings }` | — |
| `room:join` | `{ roomCode, username }` | LOBBY |
| `room:updateSettings` | `{ category, discussionTime, maxPlayers }` | LOBBY (host) |
| `game:start` | `{}` | LOBBY (host) |
| `chat:send` | `{ text }` | DISCUSSION_* |
| `vote:cast` | `{ targetPlayerId }` | VOTE_* |
| `guess:submit` | `{ word }` | FINAL_GUESS (imposter) |
| `game:playAgain` | `{}` | END (host) |

**Server → Client**
| Event | Payload |
|-------|---------|
| `room:state` | full sanitized room snapshot (per-recipient) |
| `room:playerJoined` / `room:playerLeft` | player delta |
| `game:roleAssigned` | `{ role, word? }` (per-socket secret) |
| `phase:changed` | `{ phase, endsAt }` |
| `timer:tick` | `{ remainingMs }` (or client derives from `endsAt`) |
| `chat:message` | `{ playerId, username, text, ts }` |
| `vote:update` | `{ votedCount, totalCount }` (no targets revealed) |
| `vote:result` | `{ tally, suspectId, wasImposter }` |
| `game:over` | `{ winner, scores, word, imposterId }` |

**Timer sync:** server emits `endsAt` (epoch ms); clients render countdown locally and reconcile on each `phase:changed`. Avoids per-second broadcast spam.

---

## 5. Build Phases

### Phase 0 — Scaffolding
- Monorepo or two-package layout: `apps/web` (Next.js), `apps/server` (Node + Socket.IO).
- Shared `packages/types` for event/payload TypeScript types (client + server import same contract).
- Tailwind config, base layout, env wiring (`NEXT_PUBLIC_SOCKET_URL`).
- **Exit:** client connects to server, logs a heartbeat.

### Phase 1 — Lobby & Rooms (Must Have: create/join)
- Server room registry (`Map`), 4–6 char room codes, share link `?room=CODE`.
- Create room, join by code/link, player list, host badge.
- Host settings UI (category, discussion timer, max players).
- Disconnect handling + host migration.
- **Exit:** two browsers join one room, see each other live.

### Phase 2 — Role & Word Distribution (Must Have)
- Static word packs `server/data/words/<category>.json`.
- On `game:start`: pick word, pick random Imposter, emit per-socket secret payloads.
- Role reveal screen (Crew: word card; Imposter: "Find the secret word").
- **Exit:** roles assigned correctly; Imposter never receives word in any payload (verify via network inspector).

### Phase 3 — Discussion + Chat + Timer (Must Have: discussion timer)
- Text chat scoped to active players, eliminated players read-only.
- Server-authoritative phase timer with `endsAt`; auto-advance to VOTE on expiry.
- **Exit:** timed discussion round runs and auto-transitions.

### Phase 4 — Voting Engine (Must Have: anonymous voting, result screen)
- Anonymous `vote:cast`; server tallies; live "X/Y voted" progress (no targets).
- Tie rule (re-vote once). Self-vote blocked.
- Result reveal screen with tally + suspect.
- Round-1 short-circuit (Imposter caught → end) vs round-2 path.
- **Exit:** full 2-round vote flow resolves correctly.

### Phase 5 — Win Conditions + Final Guess (Must Have: winner screen)
- Win resolution per FSM. Final-guess phase (20s timer, exact/normalized match).
- Winner reveal screen: winner, revealed word, Imposter identity, per-player scores.
- **Exit:** all four end states reachable and correct (Crew R1, Crew R2, Imposter survive, Imposter steal).

### Phase 6 — Scoring + Polish (Must Have: mobile responsive)
- Apply PRD §10 scoring per match (in-memory tally on game-over).
- Mobile-first responsive pass (target usability >90, PRD §16).
- "Play Again" rematch keeping room + players.
- **Exit:** full match playable end-to-end on phone + desktop.

### Phase 7 — Persistence & Nice-to-Have (post-MVP)
- Postgres: match history, score persistence, reconnect support.
- Sound effects, avatars, leaderboard.

---

## 6. Critical Risks

| Risk | Mitigation |
|------|------------|
| Word leaking to Imposter | Per-socket payloads + integration test asserting Imposter payload has no `word` field |
| Timer drift across clients | Server `endsAt` authority; clients never own phase end |
| Reconnect loses player | MVP: short grace window keyed by session id; full reconnect in Phase 7 |
| Vercel ≠ persistent WebSocket | Socket.IO server runs on Railway/Render (long-lived), NOT Vercel serverless |
| In-memory state lost on server restart | Acceptable for MVP (ephemeral rooms); document it |
| Vote manipulation / spoofed intents | Server validates actor, phase, and quorum on every intent |

---

## 7. Suggested Milestones

- **M1 (Phases 0–2):** Players join a room and get roles.
- **M2 (Phases 3–5):** A complete match is playable start to finish.
- **M3 (Phase 6):** Mobile-polished, rematch, scoring — **MVP ship candidate.**
- **M4 (Phase 7):** Persistence, reconnect, nice-to-haves.

---

## 8. Next Step

This maps cleanly onto BMad epics. Recommended: each Build Phase (§5) becomes an Epic, each phase exit-criterion a story cluster. Run `/bmad-create-epics-and-stories` to formalize, then `/bmad-sprint-planning` to generate tracking.
