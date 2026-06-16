/**
 * @wordspy/types — single source of truth for the client↔server event contract.
 * Imported by both apps/web (Socket.IO client) and apps/server (Socket.IO server).
 *
 * Story 1.1 scope: connection + heartbeat only. Room/game events are added by
 * later stories (1.3+ rooms, Epic 2 roles, Epic 3 voting). Keep this contract
 * the ONE place those types live — never duplicate event/payload shapes per side.
 */

/** Protocol version — bump when the event contract changes in a breaking way. */
export const PROTOCOL_VERSION = 1 as const;

// ---- Username (shared client + server validation) -------------------------

export const USERNAME_MIN = 2;
export const USERNAME_MAX = 16;

/** Starter blocklist — extend as needed. Enforced on BOTH client and server. */
const USERNAME_BLOCKLIST = ["admin", "fuck", "shit", "bitch", "nigger", "cunt"];

export interface UsernameResult {
  ok: boolean;
  /** Normalized value (trimmed, internal whitespace collapsed). */
  value: string;
  error?: string;
}

/**
 * Validate + normalize a username. Pure (no DOM) so it is the single source of
 * truth for both the web client and the authoritative server.
 * Allowed: letters, digits, space, underscore, hyphen. Length 2–16 after trim.
 */
export function validateUsername(raw: unknown): UsernameResult {
  const value = (typeof raw === "string" ? raw : "").trim().replace(/\s+/g, " ");

  if (value.length === 0) return { ok: false, value, error: "Enter a name." };
  if (value.length < USERNAME_MIN) return { ok: false, value, error: `At least ${USERNAME_MIN} characters.` };
  if (value.length > USERNAME_MAX) return { ok: false, value, error: `At most ${USERNAME_MAX} characters.` };
  if (!/^[A-Za-z0-9 _-]+$/.test(value)) {
    return { ok: false, value, error: "Letters, numbers, space, _ or - only." };
  }
  const lowered = value.toLowerCase();
  if (USERNAME_BLOCKLIST.some((bad) => lowered.includes(bad))) {
    return { ok: false, value, error: "Pick a different name." };
  }
  return { ok: true, value };
}

/** Server → client health/heartbeat acknowledgement. */
export interface HeartbeatAck {
  /** Server time (epoch ms) when the pong was sent. */
  serverTime: number;
  protocolVersion: number;
}

// ---- Rooms (Story 1.3) ----------------------------------------------------

export const CATEGORIES = [
  "food",
  "movies",
  "animals",
  "countries",
  "sports",
  "technology",
  "random",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const DISCUSSION_TIMES = [60, 90, 120] as const;
export type DiscussionSeconds = (typeof DISCUSSION_TIMES)[number];

export const MAX_PLAYERS_OPTIONS = [4, 6, 8, 10] as const;
export type MaxPlayers = (typeof MAX_PLAYERS_OPTIONS)[number];

/** Minimum players required to start a match (NFR7: 3–10 players). */
export const MIN_PLAYERS = 3;

/** Room lifecycle phase. */
export type RoomPhase =
  | "lobby"
  | "role-reveal"
  | "discussion"
  | "voting"
  | "result"
  | "final-guess"
  | "game-over";

/** Winning side of a finished match. */
export type GameWinner = "crew" | "imposter";

/** Aggregate count of votes for one target (not who voted — anonymity preserved). */
export interface VoteTally {
  playerId: string;
  username: string;
  count: number;
}

/** Outcome of a closed voting round. Revealed only at the `result` phase. */
export interface VoteResult {
  round: number;
  /** The most-voted player, or null on a tie. */
  suspectId: string | null;
  suspectUsername: string | null;
  /** True if the suspect was the Imposter. */
  wasImposter: boolean;
  /** True when no single suspect (tie). */
  tie: boolean;
  tally: VoteTally[];
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  category: "food",
  discussionSeconds: 90,
  maxPlayers: 8,
  isPrivate: true,
};

export interface RoomSettings {
  category: Category;
  discussionSeconds: DiscussionSeconds;
  maxPlayers: MaxPlayers;
  isPrivate: boolean;
}

/** Wire-safe view of a player (no socket internals, no secrets). */
export interface PlayerSummary {
  id: string;
  username: string;
  isHost: boolean;
  isReady: boolean;
  /** Voted out — spectating, cannot chat or vote. */
  isEliminated: boolean;
}

/** Wire-safe view of a room broadcast to its members. */
export interface RoomSummary {
  code: string;
  phase: RoomPhase;
  /** Current round (1-based). Round 2 arrives in Epic 3. */
  round: number;
  /** Server deadline for the current timed phase (epoch ms), if any. */
  phaseEndsAt?: number;
  /** Count of votes cast this voting round. Targets are NEVER broadcast (anonymous). */
  votesCast: number;
  /** Set at the `result` phase once a voting round closes. */
  voteResult?: VoteResult;
  /** True while a re-vote round (after a tie) is open. */
  revote: boolean;
  /** Winning side, set only at `game-over`. */
  winner?: GameWinner;
  settings: RoomSettings;
  hostId: string;
  players: PlayerSummary[];
}

export interface CreateRoomRequest {
  username: string;
  settings: RoomSettings;
}

export interface JoinRoomRequest {
  code: string;
  username: string;
}

export interface SetReadyRequest {
  code: string;
  ready: boolean;
}

export interface KickRequest {
  code: string;
  targetId: string;
}

export interface StartRequest {
  code: string;
}

/** Generic request/response over a Socket.IO ack callback. */
export type AckResponse<T> = { ok: true; data: T } | { ok: false; error: string };

// ---- Roles (Story 2.2) — secrets travel ONLY via the per-socket game:role --

/**
 * Crew receive the secret word. The Imposter payload below intentionally has
 * NO `word` key — the word must never reach the Imposter on the wire.
 */
export interface CrewRolePayload {
  role: "crew";
  word: string;
  category: Category;
}

export interface ImposterRolePayload {
  role: "imposter";
  category: Category;
}

export type RolePayload = CrewRolePayload | ImposterRolePayload;

// ---- Chat (Story 2.5) -----------------------------------------------------

export const CHAT_MAX_LENGTH = 200;

export interface ChatMessage {
  playerId: string;
  username: string;
  text: string;
  /** Server timestamp (epoch ms). */
  ts: number;
}

/** Shape of the GET /health response. */
export interface HealthResponse {
  status: "ok";
  uptimeSeconds: number;
  protocolVersion: number;
}

/**
 * Events the client emits to the server.
 * The optional ack callback pattern is used so the client can confirm liveness.
 */
export interface ClientToServerEvents {
  /** Liveness check. Server replies via the ack callback with HeartbeatAck. */
  heartbeat: (ack: (reply: HeartbeatAck) => void) => void;
  /** Create a room. Server replies via ack with the room summary or an error. */
  "room:create": (
    req: CreateRoomRequest,
    ack: (res: AckResponse<RoomSummary>) => void,
  ) => void;
  /** Join an existing room by code. Ack with the room summary or an error. */
  "room:join": (
    req: JoinRoomRequest,
    ack: (res: AckResponse<RoomSummary>) => void,
  ) => void;
  /** Toggle the caller's ready state in a room. */
  "room:setReady": (
    req: SetReadyRequest,
    ack: (res: AckResponse<RoomSummary>) => void,
  ) => void;
  /** Host removes a player from the room. */
  "room:kick": (req: KickRequest, ack: (res: AckResponse<RoomSummary>) => void) => void;
  /** Host starts the match (lobby → starting). */
  "room:start": (req: StartRequest, ack: (res: AckResponse<RoomSummary>) => void) => void;
  /** Voluntarily leave a room (distinct from disconnect). */
  "room:leave": (req: { code: string }) => void;
  /** Send a discussion chat message (fire-and-forget; server validates). */
  "chat:send": (req: { code: string; text: string }) => void;
  /** Cast an anonymous, final vote for a suspect. */
  "vote:cast": (
    req: { code: string; targetId: string },
    ack: (res: AckResponse<RoomSummary>) => void,
  ) => void;
  /** Caught Imposter's final word guess. */
  "guess:submit": (
    req: { code: string; word: string },
    ack: (res: AckResponse<RoomSummary>) => void,
  ) => void;
}

/** Events the server emits to the client. */
export interface ServerToClientEvents {
  /** Sent once on successful connection so the client can confirm the contract. */
  "server:welcome": (payload: { socketId: string; protocolVersion: number }) => void;
  /** Broadcast of the current sanitized room state to its members. */
  "room:state": (room: RoomSummary) => void;
  /** Sent to a player who has been kicked from a room. */
  "room:kicked": (payload: { code: string }) => void;
  /** Per-socket secret role assignment. Crew payload has the word; Imposter does NOT. */
  "game:role": (payload: RolePayload) => void;
  /** A discussion chat message broadcast to the room. */
  "chat:message": (msg: ChatMessage) => void;
}

/** Per-socket data the server attaches to each connection. */
export interface SocketData {
  connectedAt: number;
  /** Last chat send time (epoch ms) for rate limiting. */
  lastChatAt?: number;
}

/** Inter-server events (unused in MVP single-node; reserved for typing). */
export type InterServerEvents = Record<string, never>;
