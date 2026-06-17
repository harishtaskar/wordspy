import { createServer, type Server as HttpServer } from "node:http";
import express, { type Express } from "express";
import cors from "cors";
import { Server as IOServer } from "socket.io";
import {
  PROTOCOL_VERSION,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type InterServerEvents,
  type SocketData,
  type HealthResponse,
} from "@wordspy/types";
import {
  createRoom,
  addPlayer,
  removePlayer,
  setReady,
  kickPlayer,
  startGame,
  playAgain,
  updateRoomSettings,
  castVote,
  resolveRound,
  nextAfterResult,
  startRound2,
  resolveTerminal,
  submitFinalGuess,
  setWinner,
  activePlayers,
  findRoomsForSocket,
  getRoom,
  toSummary,
  type Room,
} from "./rooms/registry.js";
import { validateCreateRoom, validateSettings } from "./rooms/createRoom.js";
import { validateJoin } from "./rooms/joinRoom.js";
import { assignRoles } from "./rooms/assignRoles.js";
import { phasePlan } from "./rooms/phasePlan.js";
import { pickWord } from "./words/pickWord.js";
import { CHAT_MAX_LENGTH } from "@wordspy/types";
import type { CrewRolePayload, ImposterRolePayload, ChatMessage } from "@wordspy/types";
import { maskSecretWord } from "./lib/maskSecretWord.js";

/** Minimum interval between chat messages from one socket (ms). */
const CHAT_MIN_INTERVAL_MS = 750;
/** How long the round result is shown before Round 2 auto-starts (ms). */
const RESULT_REVEAL_MS = 5000;
/** How long the caught Imposter has to make a final guess (ms). */
const FINAL_GUESS_MS = 20000;
/** Hard voting deadline — guarantees a round resolves even if someone never votes. */
const VOTE_MS = 30000;

/**
 * Server-authoritative phase clock. Sets `phaseEndsAt` for the current phase and
 * schedules the transition to the next phase, broadcasting on each flip. The
 * client only renders the countdown — it never advances a phase.
 */
function scheduleNextPhase(room: Room, io: GameIOServer): void {
  if (room.timer) clearTimeout(room.timer);
  const plan = phasePlan(room.phase, room.settings);
  if (!plan) {
    room.phaseEndsAt = undefined;
    room.timer = undefined;
    return;
  }
  const fromPhase = room.phase;
  room.phaseEndsAt = Date.now() + plan.durationMs;
  room.timer = setTimeout(() => {
    const current = getRoom(room.code);
    if (!current || current.phase !== fromPhase) return; // stale (phase already moved)
    current.phase = plan.next;
    if (plan.next === "voting") {
      current.votes.clear(); // fresh tally each voting round
      current.voteResult = undefined;
      current.revote = false;
      startVotingTimer(current, io);
    } else {
      scheduleNextPhase(current, io);
    }
    io.to(current.code).emit("room:state", toSummary(current));
  }, plan.durationMs);
  // Don't let a pending phase timer keep the process (or a test runner) alive.
  room.timer.unref?.();
}

/** A hard voting deadline: when it expires, resolve with whatever votes are in. */
function startVotingTimer(room: Room, io: GameIOServer): void {
  if (room.timer) clearTimeout(room.timer);
  room.phaseEndsAt = Date.now() + VOTE_MS;
  room.timer = setTimeout(() => {
    const current = getRoom(room.code);
    if (!current || current.phase !== "voting") return;
    resolveVotingRound(current, io);
    io.to(current.code).emit("room:state", toSummary(current));
  }, VOTE_MS);
  room.timer.unref?.();
}

/** Resolve the round once every active player has voted (or call directly to force it). */
function maybeResolveVoting(room: Room, io: GameIOServer): void {
  if (room.phase !== "voting") return;
  const active = activePlayers(room).length;
  if (active > 0 && room.votes.size >= active) {
    resolveVotingRound(room, io);
  }
}

/** Tally the voting round; a tie → another timed re-vote, else → the result advance. */
function resolveVotingRound(room: Room, io: GameIOServer): void {
  const outcome = resolveRound(room);
  if (outcome.kind === "revote") {
    startVotingTimer(room, io); // the re-vote gets its own deadline
    return;
  }
  scheduleResultAdvance(room, io);
}

/** After the reveal window, go to Round 2 (quorum-guarded) or a terminal end state. */
function scheduleResultAdvance(room: Room, io: GameIOServer): void {
  if (room.timer) clearTimeout(room.timer);
  room.timer = setTimeout(() => {
    const current = getRoom(room.code);
    if (!current || current.phase !== "result") return;
    const activeCrew = activePlayers(current).filter((p) => p.id !== current.imposterId);
    if (nextAfterResult(current) === "round2") {
      if (activeCrew.length === 0) {
        setWinner(current, "imposter"); // no crew left to continue
      } else {
        startRound2(current);
        scheduleNextPhase(current, io); // discussion → voting
      }
    } else {
      resolveTerminal(current); // → final-guess (imposter caught) or game-over
      // Imposter caught ⇒ final-guess phase ⇒ start their 20s clock.
      if (current.voteResult?.wasImposter) startFinalGuess(current, io);
    }
    io.to(current.code).emit("room:state", toSummary(current));
  }, RESULT_REVEAL_MS);
  room.timer.unref?.();
}

/**
 * Start the caught Imposter's final-guess countdown. If it expires with no
 * correct guess, Crew wins. A submitted guess clears this timer.
 */
function startFinalGuess(room: Room, io: GameIOServer): void {
  if (room.timer) clearTimeout(room.timer);
  room.phaseEndsAt = Date.now() + FINAL_GUESS_MS;
  room.timer = setTimeout(() => {
    const current = getRoom(room.code);
    if (!current || current.phase !== "final-guess") return;
    setWinner(current, "crew"); // ran out of time → Crew wins
    io.to(current.code).emit("room:state", toSummary(current));
  }, FINAL_GUESS_MS);
  room.timer.unref?.();
}

export type GameIOServer = IOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export interface AppHandles {
  app: Express;
  httpServer: HttpServer;
  io: GameIOServer;
}

export interface CreateAppOptions {
  /** Allowed CORS / Socket.IO origin. Defaults to permissive for local dev. */
  corsOrigin?: string | string[];
}

/**
 * Build the Express app + HTTP server + typed Socket.IO server.
 * Pure factory (no listen) so tests can bind an ephemeral port.
 */
export function createApp(options: CreateAppOptions = {}): AppHandles {
  const corsOrigin = options.corsOrigin ?? "*";
  // Captured per-instance so /health uptime is correct (and isolated in tests).
  const startedAt = Date.now();

  const app = express();
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    const body: HealthResponse = {
      status: "ok",
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      protocolVersion: PROTOCOL_VERSION,
    };
    res.json(body);
  });

  const httpServer = createServer(app);

  const io: GameIOServer = new IOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: { origin: corsOrigin },
    // Tightened transport heartbeat so a silent drop is detected in ~2-4s
    // (AC#4 "~1s of a drop"), complementing the client's explicit heartbeat.
    pingInterval: 2_000,
    pingTimeout: 2_000,
  });

  io.on("connection", (socket) => {
    socket.data.connectedAt = Date.now();
    console.log(`[socket] connected ${socket.id}`);

    socket.emit("server:welcome", {
      socketId: socket.id,
      protocolVersion: PROTOCOL_VERSION,
    });

    socket.on("heartbeat", (ack) => {
      if (typeof ack === "function") {
        ack({ serverTime: Date.now(), protocolVersion: PROTOCOL_VERSION });
      }
    });

    socket.on("room:create", (req, ack) => {
      const result = validateCreateRoom(req);
      if (!result.ok) {
        if (typeof ack === "function") ack({ ok: false, error: result.error });
        return;
      }
      if (findRoomsForSocket(socket.id).length > 0) {
        if (typeof ack === "function") ack({ ok: false, error: "You're already in a room." });
        return;
      }
      try {
        const room = createRoom({ id: socket.id, username: result.username }, result.settings);
        socket.join(room.code);
        const summary = toSummary(room);
        if (typeof ack === "function") ack({ ok: true, data: summary });
        // Broadcast to the room (just the host for now; matters as players join).
        io.to(room.code).emit("room:state", summary);
        console.log(`[room] created ${room.code} by ${socket.id}`);
      } catch (err) {
        console.error("[room] create failed:", err);
        if (typeof ack === "function") ack({ ok: false, error: "Could not create room. Try again." });
      }
    });

    socket.on("room:join", (req, ack) => {
      const valid = validateJoin(req);
      if (!valid.ok) {
        if (typeof ack === "function") ack({ ok: false, error: valid.error });
        return;
      }
      const existing = findRoomsForSocket(socket.id);
      if (existing.length > 0 && !existing.includes(valid.code)) {
        if (typeof ack === "function") ack({ ok: false, error: "You're already in a room." });
        return;
      }
      const result = addPlayer(valid.code, { id: socket.id, username: valid.username });
      if (!result.ok) {
        if (typeof ack === "function") ack({ ok: false, error: result.error });
        return;
      }
      socket.join(valid.code);
      const summary = toSummary(result.room);
      if (typeof ack === "function") ack({ ok: true, data: summary });
      // Existing members see the new player live.
      io.to(valid.code).emit("room:state", summary);
      console.log(`[room] ${socket.id} joined ${valid.code}`);
    });

    socket.on("room:setReady", (req, ack) => {
      const code = typeof req?.code === "string" ? req.code.trim().toUpperCase() : "";
      const ready = typeof req?.ready === "boolean" ? req.ready : false;
      const existing = getRoom(code);
      if (existing && existing.phase !== "lobby") {
        if (typeof ack === "function") ack({ ok: false, error: "Ready only in the lobby." });
        return;
      }
      const room = setReady(code, socket.id, ready);
      if (!room) {
        if (typeof ack === "function") ack({ ok: false, error: "Not in this room." });
        return;
      }
      const summary = toSummary(room);
      if (typeof ack === "function") ack({ ok: true, data: summary });
      io.to(code).emit("room:state", summary);
    });

    socket.on("room:playAgain", (req, ack) => {
      const code = typeof req?.code === "string" ? req.code.trim().toUpperCase() : "";
      const result = playAgain(code, socket.id);
      if (!result.ok) {
        if (typeof ack === "function") ack({ ok: false, error: result.error });
        return;
      }
      const summary = toSummary(result.room);
      if (typeof ack === "function") ack({ ok: true, data: summary });
      io.to(code).emit("room:state", summary);
      console.log(`[room] ${code} rematch → lobby`);
    });

    socket.on("room:updateSettings", (req, ack) => {
      const code = typeof req?.code === "string" ? req.code.trim().toUpperCase() : "";
      const valid = validateSettings(req?.settings);
      if (!valid.ok) {
        if (typeof ack === "function") ack({ ok: false, error: valid.error });
        return;
      }
      const result = updateRoomSettings(code, socket.id, valid.settings);
      if (!result.ok) {
        if (typeof ack === "function") ack({ ok: false, error: result.error });
        return;
      }
      const summary = toSummary(result.room);
      if (typeof ack === "function") ack({ ok: true, data: summary });
      io.to(code).emit("room:state", summary);
    });

    socket.on("room:kick", (req, ack) => {
      const code = typeof req?.code === "string" ? req.code.trim().toUpperCase() : "";
      const targetId = typeof req?.targetId === "string" ? req.targetId : "";
      const result = kickPlayer(code, socket.id, targetId);
      if (!result.ok) {
        if (typeof ack === "function") ack({ ok: false, error: result.error });
        return;
      }
      const summary = toSummary(result.room);
      if (typeof ack === "function") ack({ ok: true, data: summary });
      io.to(code).emit("room:state", summary);
      // Tell the kicked player and remove them from the room channel.
      io.to(targetId).emit("room:kicked", { code });
      io.sockets.sockets.get(targetId)?.leave(code);
      console.log(`[room] ${targetId} kicked from ${code}`);
    });

    socket.on("room:start", (req, ack) => {
      const code = typeof req?.code === "string" ? req.code.trim().toUpperCase() : "";
      const result = startGame(code, socket.id);
      if (!result.ok) {
        if (typeof ack === "function") ack({ ok: false, error: result.error });
        return;
      }
      const room = result.room;

      // --- Role assignment + per-socket secret distribution (Story 2.2) ---
      const playerIds = [...room.players.keys()];
      const { imposterId } = assignRoles(playerIds);
      const word = pickWord(room.settings.category, room.usedWords).word;
      const category = room.settings.category;

      room.secretWord = word;
      room.imposterId = imposterId;
      room.imposterUsername = room.players.get(imposterId)?.username;
      for (const p of room.players.values()) {
        p.role = p.id === imposterId ? "imposter" : "crew";
      }

      // Start the server-authoritative phase clock: role-reveal → discussion → voting.
      scheduleNextPhase(room, io);

      // Ack first (host gets it like everyone via the per-socket emit below).
      const summary = toSummary(room); // secret-free: no role/word/imposterId
      if (typeof ack === "function") ack({ ok: true, data: summary });

      // Emit the role to EACH socket individually. The Imposter payload is built
      // WITHOUT a `word` key — the word never reaches the Imposter on the wire.
      for (const p of room.players.values()) {
        const target = io.sockets.sockets.get(p.id);
        if (!target) continue;
        if (p.id === imposterId) {
          const imposterPayload: ImposterRolePayload = { role: "imposter", category };
          target.emit("game:role", imposterPayload);
        } else {
          const crewPayload: CrewRolePayload = { role: "crew", word, category };
          target.emit("game:role", crewPayload);
        }
      }

      // Broadcast the phase change (secret-free) to the whole room.
      io.to(code).emit("room:state", summary);
      console.log(`[room] ${code} started; imposter assigned, roles distributed`);
    });

    const leaveRoom = (code: string) => {
      const result = removePlayer(code, socket.id);
      socket.leave(code);
      if (!result.deleted && result.room) {
        // A departing voter may have completed (or unblocked) the round.
        maybeResolveVoting(result.room, io);
        io.to(code).emit("room:state", toSummary(result.room));
        console.log(`[room] ${socket.id} left ${code}; host=${result.room.hostId}`);
      } else {
        console.log(`[room] ${code} emptied and removed`);
      }
    };

    socket.on("room:leave", (req) => {
      const code = typeof req?.code === "string" ? req.code.trim().toUpperCase() : "";
      if (code) leaveRoom(code);
    });

    socket.on("chat:send", (req) => {
      const code = typeof req?.code === "string" ? req.code.trim().toUpperCase() : "";
      const room = getRoom(code);
      const player = room?.players.get(socket.id);
      if (!room || !player) return; // not a member of this room
      if (player.eliminated) return; // eliminated players spectate, no chat
      if (room.phase !== "discussion") return; // chat is a discussion-phase activity

      const raw = (typeof req?.text === "string" ? req.text : "").trim().slice(0, CHAT_MAX_LENGTH);
      if (!raw) return; // drop empty

      const now = Date.now();
      if (socket.data.lastChatAt && now - socket.data.lastChatAt < CHAT_MIN_INTERVAL_MS) {
        return; // rate-limited
      }
      socket.data.lastChatAt = now;

      // CRITICAL: never let the secret word appear in chat — mask it server-side
      // (the server is the only party that always knows it).
      const text = maskSecretWord(raw, room.secretWord);
      const msg: ChatMessage = { playerId: socket.id, username: player.username, text, ts: now };
      io.to(code).emit("chat:message", msg);
    });

    socket.on("vote:cast", (req, ack) => {
      const code = typeof req?.code === "string" ? req.code.trim().toUpperCase() : "";
      const targetId = typeof req?.targetId === "string" ? req.targetId : "";
      const result = castVote(code, socket.id, targetId);
      if (!result.ok) {
        if (typeof ack === "function") ack({ ok: false, error: result.error });
        return;
      }
      const room = result.room;
      // Resolve once every active player has voted (or the deadline fires).
      maybeResolveVoting(room, io);
      const summary = toSummary(room);
      if (typeof ack === "function") ack({ ok: true, data: summary });
      io.to(code).emit("room:state", summary);
    });

    socket.on("guess:submit", (req, ack) => {
      const code = typeof req?.code === "string" ? req.code.trim().toUpperCase() : "";
      const word = typeof req?.word === "string" ? req.word : "";
      const room = getRoom(code);
      if (!room) {
        if (typeof ack === "function") ack({ ok: false, error: "Room not found." });
        return;
      }
      const res = submitFinalGuess(room, socket.id, word);
      if (!res.ok) {
        if (typeof ack === "function") ack({ ok: false, error: res.error });
        return;
      }
      if (room.timer) clearTimeout(room.timer); // cancel the final-guess timeout
      const summary = toSummary(room); // phase game-over, winner set
      if (typeof ack === "function") ack({ ok: true, data: summary });
      io.to(code).emit("room:state", summary);
      console.log(`[room] ${code} final guess ${res.correct ? "CORRECT (imposter steals)" : "wrong (crew win)"}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[socket] disconnected ${socket.id} (${reason})`);
      for (const code of findRoomsForSocket(socket.id)) {
        const room = getRoom(code);
        const inProgress =
          room && room.phase !== "lobby" && room.phase !== "game-over";
        if (room && inProgress && room.imposterId === socket.id) {
          // Imposter quit mid-match → instant Crew win (FR24).
          if (room.timer) clearTimeout(room.timer);
          setWinner(room, "crew");
          removePlayer(code, socket.id); // drop the imposter from the roster
          const after = getRoom(code);
          if (after) io.to(code).emit("room:state", toSummary(after));
          console.log(`[room] ${code} imposter left mid-match → Crew win`);
        } else {
          // Normal removal: migrate host / delete empties; notify survivors.
          leaveRoom(code);
        }
      }
    });
  });

  return { app, httpServer, io };
}
