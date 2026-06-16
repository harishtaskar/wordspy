import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@wordspy/types";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Absolute server URL — the Socket.IO server is deployed on a long-lived host
 * (Railway/Render), NOT same-origin with the Vercel frontend. So we MUST read
 * an absolute URL from env and never assume same-origin. [implementation-plan.md §1]
 *
 * NEXT_PUBLIC_* is inlined at BUILD time. Use a trimmed truthy check (not `??`)
 * so an empty string ("") falls back instead of silently connecting same-origin.
 */
function resolveSocketUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();
  const url = raw && raw.length > 0 ? raw : "http://localhost:4000";
  try {
    // Fail loud on a malformed value rather than passing garbage to io().
    new URL(url);
  } catch {
    throw new Error(`Invalid NEXT_PUBLIC_SOCKET_URL: "${url}". Must be an absolute URL.`);
  }
  return url;
}

export const SOCKET_URL = resolveSocketUrl();

let socket: GameSocket | null = null;

/** Lazily create a single shared client socket (autoConnect off; caller connects). */
export function getSocket(): GameSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      // Prefer websocket, but keep polling as a fallback for restrictive proxies.
      transports: ["websocket", "polling"],
      timeout: 8000,
      autoConnect: false,
    });
  }
  return socket;
}
