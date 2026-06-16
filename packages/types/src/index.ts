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

/** Server → client health/heartbeat acknowledgement. */
export interface HeartbeatAck {
  /** Server time (epoch ms) when the pong was sent. */
  serverTime: number;
  protocolVersion: number;
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
}

/** Events the server emits to the client. */
export interface ServerToClientEvents {
  /** Sent once on successful connection so the client can confirm the contract. */
  "server:welcome": (payload: { socketId: string; protocolVersion: number }) => void;
}

/** Per-socket data the server attaches to each connection. */
export interface SocketData {
  connectedAt: number;
}

/** Inter-server events (unused in MVP single-node; reserved for typing). */
export type InterServerEvents = Record<string, never>;
