import type {
  RoomSettings,
  RoomSummary,
  PlayerSummary,
  RoomPhase,
  VoteResult,
  GameWinner,
  WinReason,
  PublicRoomInfo,
} from "@wordspy/types";
import { MIN_PLAYERS } from "@wordspy/types";
import { generateRoomCode } from "../lib/roomCode.js";
import { normalizeGuess } from "../lib/normalizeGuess.js";
import { resolveVotes } from "./resolveVotes.js";
import { computeScores } from "./computeScores.js";

/** Server-internal player — keyed by socket id. */
export interface Player {
  id: string;
  /** Stable per-browser id (survives a socket reconnect); used to reclaim a seat. */
  sessionId: string;
  username: string;
  isHost: boolean;
  isReady: boolean;
  /** True while the socket is dropped but inside the reconnect grace window. */
  disconnected?: boolean;
  /** Grace timer that finalizes the departure if no reconnect arrives. */
  disconnectTimer?: ReturnType<typeof setTimeout>;
  /** Voted out — spectating, cannot chat or vote. */
  eliminated: boolean;
  /** Round in which this player was eliminated (for scoring). */
  eliminatedRound?: number;
  /** Joined mid-match — watch-only, no role; promoted to a full player next match. */
  pending?: boolean;
  /** Match score, computed at game-over. */
  score: number;
  /** Stable avatar palette index (distinct per player within the room). */
  colorIndex: number;
  /** Secret role, set at game start. NEVER included in any broadcast. */
  role?: "crew" | "imposter";
}

/** Smallest avatar colour index not already used by a player in the room. */
function nextColorIndex(room: Room): number {
  const used = new Set([...room.players.values()].map((p) => p.colorIndex));
  for (let i = 0; i < 10; i++) if (!used.has(i)) return i;
  return room.players.size % 10;
}

/** Server-internal room. Holds live state; never sent to clients directly. */
export interface Room {
  code: string;
  phase: RoomPhase;
  settings: RoomSettings;
  hostId: string;
  /** Current round (1-based). */
  round: number;
  /** Server deadline for the current timed phase (epoch ms), if any. */
  phaseEndsAt?: number;
  /** Active phase-transition timer handle (server-internal; never broadcast). */
  timer?: ReturnType<typeof setTimeout>;
  players: Map<string, Player>;
  /** Votes for the current voting round: voterId → targetId. NEVER broadcast. */
  votes: Map<string, string>;
  /** Words already used this room session (no-repeat tracking for Epic 2). */
  usedWords: Set<string>;
  /** Secret word for the current round. NEVER broadcast. */
  secretWord?: string;
  /** Socket id of the Imposter for the current round. NEVER broadcast. */
  imposterId?: string;
  /** Imposter username, captured at assignment so it survives a disconnect. */
  imposterUsername?: string;
  /** Result of the last closed voting round (revealed at the `result` phase). */
  voteResult?: VoteResult;
  /** True while a re-vote round (after a tie) is open. */
  revote: boolean;
  /** Winning side, set at `game-over`. */
  winner?: GameWinner;
  /** Why the match ended (for the reveal screen). */
  winReason?: WinReason;
  /** Round the imposter was caught (undefined = never), for scoring. */
  imposterCaughtRound?: number;
  /** Crew who voted the imposter in the catching round (correct-vote bonus). */
  correctVoters: Set<string>;
  /** Imposter's final guess was correct. */
  stole: boolean;
  createdAt: number;
}

const rooms = new Map<string, Room>();

export function hasRoom(code: string): boolean {
  return rooms.has(code);
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function deleteRoom(code: string): void {
  rooms.delete(code);
}

/** Create a room with the given host. Returns the internal room. */
export function createRoom(
  host: { id: string; username: string; sessionId?: string },
  settings: RoomSettings,
): Room {
  const code = generateRoomCode(hasRoom);
  const room: Room = {
    code,
    phase: "lobby",
    round: 1,
    settings,
    hostId: host.id,
    players: new Map([
      [
        host.id,
        { id: host.id, sessionId: host.sessionId ?? "", username: host.username, isHost: true, isReady: false, eliminated: false, score: 0, colorIndex: 0 },
      ],
    ]),
    votes: new Map<string, string>(),
    revote: false,
    correctVoters: new Set<string>(),
    stole: false,
    usedWords: new Set<string>(),
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

export type AddPlayerResult =
  | { ok: true; room: Room }
  | { ok: false; error: string };

/**
 * Add a non-host player to a room, enforcing capacity/duplicate rules. Joining
 * is allowed in any phase as long as a seat is free — a player who joins after
 * the match has started becomes a watch-only spectator (`pending`) and is
 * promoted to a full player on the next match (see `resetForRematch`).
 */
export function addPlayer(
  code: string,
  player: { id: string; username: string; sessionId?: string },
): AddPlayerResult {
  const room = rooms.get(code);
  if (!room) return { ok: false, error: "Room not found." };
  if (room.players.has(player.id)) return { ok: true, room }; // idempotent re-join by same socket
  if (room.players.size >= room.settings.maxPlayers) return { ok: false, error: "Room full." };

  const dupe = [...room.players.values()].some(
    (p) => p.username.toLowerCase() === player.username.toLowerCase(),
  );
  if (dupe) return { ok: false, error: "Name taken in this room." };

  room.players.set(player.id, {
    id: player.id,
    sessionId: player.sessionId ?? "",
    username: player.username,
    isHost: false,
    isReady: false,
    eliminated: false,
    pending: room.phase !== "lobby", // mid-match join → spectate, play next match
    score: 0,
    colorIndex: nextColorIndex(room),
  });
  return { ok: true, room };
}

/** Find a player in a room by their stable session id (used on reconnect). */
export function findPlayerBySession(room: Room, sessionId: string): Player | undefined {
  if (!sessionId) return undefined;
  for (const p of room.players.values()) {
    if (p.sessionId === sessionId) return p;
  }
  return undefined;
}

/**
 * Re-key a player from an old socket id to a new one after a reconnect, keeping
 * roster order and fixing every id reference (votes, host, imposter). Preserves
 * the player's score and all match state — the whole point of resume.
 */
export function rebindPlayer(room: Room, oldId: string, newId: string): void {
  if (oldId === newId || !room.players.has(oldId)) return;
  // Rebuild the map in-order so the roster doesn't reshuffle on reconnect.
  const rebuilt = new Map<string, Player>();
  for (const [id, p] of room.players) {
    if (id === oldId) {
      p.id = newId;
      rebuilt.set(newId, p);
    } else {
      rebuilt.set(id, p);
    }
  }
  room.players = rebuilt;

  // Move the vote this player cast, and re-point any votes aimed at them.
  if (room.votes.has(oldId)) {
    const target = room.votes.get(oldId)!;
    room.votes.delete(oldId);
    room.votes.set(newId, target);
  }
  for (const [voter, target] of room.votes) {
    if (target === oldId) room.votes.set(voter, newId);
  }

  if (room.hostId === oldId) room.hostId = newId;
  if (room.imposterId === oldId) room.imposterId = newId;
}

export interface RemovePlayerResult {
  /** The room after removal, or undefined if it was deleted. */
  room?: Room;
  deleted: boolean;
}

/**
 * Remove a player. If the host left and others remain, promote the next player
 * (insertion order). If the room is now empty, delete it. [FR18, empty-cleanup]
 */
export function removePlayer(code: string, id: string): RemovePlayerResult {
  const room = rooms.get(code);
  if (!room) return { deleted: false };

  const wasHost = room.hostId === id;
  const leaving = room.players.get(id);
  if (leaving?.disconnectTimer) clearTimeout(leaving.disconnectTimer);
  room.players.delete(id);
  room.votes.delete(id); // drop any vote they had cast (stale otherwise)
  // Drop votes that targeted the leaver too, so the tally stays consistent.
  for (const [voter, target] of room.votes) {
    if (target === id) room.votes.delete(voter);
  }

  if (room.players.size === 0) {
    if (room.timer) clearTimeout(room.timer); // don't fire on a freed room
    rooms.delete(code);
    return { deleted: true };
  }
  if (wasHost) {
    const next = room.players.values().next().value as Player;
    next.isHost = true;
    room.hostId = next.id;
  }
  return { room, deleted: false };
}

export type KickResult =
  | { ok: true; room: Room }
  | { ok: false; error: string };

/** Host removes a target player. Only the host may kick; cannot kick self. */
export function kickPlayer(code: string, hostId: string, targetId: string): KickResult {
  const room = rooms.get(code);
  if (!room) return { ok: false, error: "Room not found." };
  if (room.hostId !== hostId) return { ok: false, error: "Only the host can kick." };
  if (room.phase !== "lobby") return { ok: false, error: "Can't kick mid-match." };
  if (targetId === hostId) return { ok: false, error: "You can't kick yourself." };
  if (!room.players.has(targetId)) return { ok: false, error: "Player not in room." };
  room.players.delete(targetId);
  return { ok: true, room };
}

export type StartResult =
  | { ok: true; room: Room }
  | { ok: false; error: string };

/** Host starts the match: lobby → starting, gated on host + quorum. */
export function startGame(code: string, hostId: string): StartResult {
  const room = rooms.get(code);
  if (!room) return { ok: false, error: "Room not found." };
  if (room.hostId !== hostId) return { ok: false, error: "Only the host can start." };
  if (room.phase !== "lobby") return { ok: false, error: "Game already started." };
  if (room.players.size < MIN_PLAYERS) {
    return { ok: false, error: `Need ${MIN_PLAYERS}+ players to start.` };
  }
  room.phase = "role-reveal";
  return { ok: true, room };
}

/** Toggle a player's ready flag. */
export function setReady(code: string, id: string, ready: boolean): Room | undefined {
  const room = rooms.get(code);
  const player = room?.players.get(id);
  if (!room || !player) return undefined;
  player.isReady = ready;
  return room;
}

const PUBLIC_LIST_CAP = 50;

/**
 * All public rooms, newest first — the browser shows every public room (lobby,
 * in-progress, or full) and derives the status/seat info client-side. Private
 * rooms stay hidden.
 */
export function listPublicRooms(): PublicRoomInfo[] {
  const out: PublicRoomInfo[] = [];
  for (const room of rooms.values()) {
    if (room.settings.isPrivate) continue;
    out.push({
      code: room.code,
      hostName: room.players.get(room.hostId)?.username ?? "—",
      players: room.players.size,
      maxPlayers: room.settings.maxPlayers,
      category: room.settings.category,
      phase: room.phase,
      round: room.round,
    });
  }
  out.sort((a, b) => (rooms.get(b.code)?.createdAt ?? 0) - (rooms.get(a.code)?.createdAt ?? 0));
  return out.slice(0, PUBLIC_LIST_CAP);
}

/**
 * Active players — the eligible voters/targets for the current match. Excludes
 * both eliminated players and mid-match spectators (`pending`).
 */
export function activePlayers(room: Room): Player[] {
  return [...room.players.values()].filter((p) => !p.eliminated && !p.pending);
}

export type CastVoteResult = { ok: true; room: Room } | { ok: false; error: string };

/**
 * Record an anonymous, FINAL vote. Rules: phase must be `voting`; voter must be
 * present + active; target present + active + not self; voter must not have voted.
 */
export function castVote(code: string, voterId: string, targetId: string): CastVoteResult {
  const room = rooms.get(code);
  if (!room) return { ok: false, error: "Room not found." };
  if (room.phase !== "voting") return { ok: false, error: "Not voting right now." };

  const voter = room.players.get(voterId);
  if (!voter || voter.eliminated || voter.pending) return { ok: false, error: "You can't vote." };
  if (room.votes.has(voterId)) return { ok: false, error: "You already voted." };

  if (targetId === voterId) return { ok: false, error: "You can't vote for yourself." };
  const target = room.players.get(targetId);
  if (!target || target.eliminated || target.pending) return { ok: false, error: "Invalid target." };

  room.votes.set(voterId, targetId);
  return { ok: true, room };
}

export type RoundOutcome = { kind: "result"; result: VoteResult } | { kind: "revote" };

/**
 * Resolve the current voting round. On the FIRST tie, trigger a single re-vote
 * (back to `voting`, votes cleared). On a clear suspect — or a second tie —
 * produce the `VoteResult` and move to the `result` phase.
 */
export function resolveRound(room: Room): RoundOutcome {
  const nameOf = (id: string) => room.players.get(id)?.username ?? "—";
  const { tally, suspectId, tie } = resolveVotes(room.votes, nameOf);

  // First tie → one re-vote.
  if (tie && !room.revote) {
    room.revote = true;
    room.votes.clear();
    room.phase = "voting";
    return { kind: "revote" };
  }

  const wasImposter = suspectId !== null && suspectId === room.imposterId;
  if (wasImposter && suspectId) {
    // Record the catch + the crew who voted correctly (scoring facts).
    room.imposterCaughtRound = room.round;
    room.correctVoters = new Set(
      [...room.votes.entries()].filter(([, t]) => t === suspectId).map(([v]) => v),
    );
  } else if (suspectId) {
    // A caught Crew member is eliminated for the rest of the match.
    const p = room.players.get(suspectId);
    if (p) {
      p.eliminated = true;
      p.eliminatedRound = room.round;
    }
  }

  const result: VoteResult = {
    round: room.round,
    suspectId,
    suspectUsername: suspectId ? (room.players.get(suspectId)?.username ?? null) : null,
    wasImposter,
    tie,
    tally,
  };
  room.voteResult = result;
  room.phase = "result";
  room.revote = false;
  return { kind: "result", result };
}

/**
 * Decide what follows a `result`: a Round 2 (Crew caught or no-elim tie in
 * Round 1) or a terminal match (Imposter caught, or any Round 2 result).
 */
export function nextAfterResult(room: Room): "round2" | "terminal" {
  if (room.round === 1 && room.voteResult && !room.voteResult.wasImposter) {
    return "round2";
  }
  return "terminal";
}

/** Record the winning side, compute scores, and end the match. Idempotent. */
export function setWinner(room: Room, winner: GameWinner): void {
  if (room.winner) return; // already decided — don't let a race overwrite it
  room.winner = winner;
  room.phase = "game-over";
  const scores = computeScores(room); // PRD §10 — this match's points
  for (const p of room.players.values()) {
    p.score += scores[p.id] ?? 0; // accumulate across matches ("Continue")
  }
}

export type FinalGuessResult = { ok: true; correct: boolean } | { ok: false; error: string };

/**
 * The caught Imposter's final guess. Only the imposter, only during `final-guess`.
 * Correct → Imposter steals the win; wrong → Crew wins. Server-authoritative.
 */
export function submitFinalGuess(room: Room, guesserId: string, word: string): FinalGuessResult {
  if (room.phase !== "final-guess") return { ok: false, error: "Not the final guess." };
  if (guesserId !== room.imposterId) return { ok: false, error: "Only the imposter guesses." };
  const correct = normalizeGuess(word) === normalizeGuess(room.secretWord ?? "");
  room.stole = correct;
  setWinner(room, correct ? "imposter" : "crew");
  return { ok: true, correct };
}

/**
 * Resolve a TERMINAL round result into the end state.
 * - Imposter caught → `final-guess` (winner pending; Story 4.2 finalizes).
 * - Imposter survived (Crew caught / tie in R2) → Imposter wins (`game-over`).
 */
export function resolveTerminal(room: Room): void {
  if (room.voteResult?.wasImposter) {
    room.phase = "final-guess"; // Crew provisionally ahead; final guess decides
  } else {
    setWinner(room, "imposter"); // imposter survived both rounds
  }
}

/** Reset per-match state back to lobby, keeping the roster + session word history. */
export function resetForRematch(room: Room): void {
  if (room.timer) clearTimeout(room.timer);
  room.timer = undefined;
  room.phase = "lobby";
  room.round = 1;
  room.phaseEndsAt = undefined;
  room.votes.clear();
  room.voteResult = undefined;
  room.revote = false;
  room.winner = undefined;
  room.winReason = undefined;
  room.secretWord = undefined;
  room.imposterId = undefined;
  room.imposterUsername = undefined;
  room.imposterCaughtRound = undefined;
  room.correctVoters = new Set<string>();
  room.stole = false;
  for (const p of room.players.values()) {
    p.eliminated = false;
    p.eliminatedRound = undefined;
    p.pending = false; // mid-match spectators join the next match as full players
    p.role = undefined;
    p.isReady = false;
    if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
    p.disconnectTimer = undefined;
    p.disconnected = false;
    // KEEP p.score — points carry across matches ("Continue").
  }
  // KEEP: players, usedWords (no-repeat across the session), settings, hostId, scores.
}

export type UpdateSettingsResult = { ok: true; room: Room } | { ok: false; error: string };

/** Host updates room settings (only in lobby or after a match — never mid-game). */
export function updateRoomSettings(code: string, hostId: string, settings: RoomSettings): UpdateSettingsResult {
  const room = rooms.get(code);
  if (!room) return { ok: false, error: "Room not found." };
  if (room.hostId !== hostId) return { ok: false, error: "Only the host can change settings." };
  if (room.phase !== "lobby" && room.phase !== "game-over") {
    return { ok: false, error: "Can't change settings mid-match." };
  }
  room.settings = settings;
  return { ok: true, room };
}

export type PlayAgainResult = { ok: true; room: Room } | { ok: false; error: string };

/** Host restarts the match (game-over → lobby), same players. */
export function playAgain(code: string, hostId: string): PlayAgainResult {
  const room = rooms.get(code);
  if (!room) return { ok: false, error: "Room not found." };
  if (room.hostId !== hostId) return { ok: false, error: "Only the host can restart." };
  if (room.phase !== "game-over") return { ok: false, error: "Match not finished." };
  resetForRematch(room);
  return { ok: true, room };
}

/** Begin Round 2 of the SAME match: new discussion, votes reset, word/roles kept. */
export function startRound2(room: Room): void {
  room.round = 2;
  room.phase = "discussion";
  room.votes.clear();
  room.voteResult = undefined;
  room.revote = false;
  // secretWord + imposterId intentionally unchanged — Round 2 continues the match.
}

/** Mark a player eliminated (or not). Called by Epic 3 voting on vote-out. */
export function setEliminated(code: string, id: string, value: boolean): Room | undefined {
  const room = rooms.get(code);
  const player = room?.players.get(id);
  if (!room || !player) return undefined;
  player.eliminated = value;
  return room;
}

/** Codes of every room containing the given socket (scan — registry is tiny). */
export function findRoomsForSocket(id: string): string[] {
  const codes: string[] = [];
  for (const room of rooms.values()) {
    if (room.players.has(id)) codes.push(room.code);
  }
  return codes;
}

/** Wire-safe projection sent to clients (no socket internals, no secrets). */
export function toSummary(room: Room): RoomSummary {
  const players: PlayerSummary[] = [...room.players.values()].map((p) => ({
    id: p.id,
    username: p.username,
    isHost: p.isHost,
    isReady: p.isReady,
    isEliminated: p.eliminated,
    isSpectator: !!p.pending,
    score: p.score,
    colorIndex: p.colorIndex,
    isConnected: !p.disconnected,
  }));
  const isOver = room.phase === "game-over";
  return {
    code: room.code,
    phase: room.phase,
    round: room.round,
    phaseEndsAt: room.phaseEndsAt,
    votesCast: room.votes.size, // count only — targets stay server-side (anonymous)
    voteResult: room.voteResult,
    revote: room.revote,
    winner: room.winner,
    winReason: room.winReason,
    // Secret word + imposter identity are revealed ONLY at game-over.
    revealedWord: isOver ? room.secretWord : undefined,
    revealedImposter: isOver
      ? (room.players.get(room.imposterId ?? "")?.username ?? room.imposterUsername)
      : undefined,
    settings: room.settings,
    hostId: room.hostId,
    players,
  };
}

/** Test/maintenance helper — also clears any pending phase timers. */
export function _clearAllRooms(): void {
  for (const room of rooms.values()) {
    if (room.timer) clearTimeout(room.timer);
  }
  rooms.clear();
}
