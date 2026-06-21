"use client";

import { useEffect } from "react";
import { PROTOCOL_VERSION, type AckResponse, type RoomSummary } from "@wordspy/types";
import { getSocket } from "@/lib/socket";
import { useConnectionStore } from "@/store/connection";
import { useRoomStore } from "@/store/room";
import { usePlayerSession } from "@/store/session";
import { useRoleStore } from "@/store/role";
import { useChatStore } from "@/store/chat";

/** How often the client pings the server for app-level liveness. */
const HEARTBEAT_INTERVAL_MS = 3000;
/** How long to wait for a heartbeat ack before treating it as a miss. */
const HEARTBEAT_TIMEOUT_MS = 2000;

/**
 * Connects the shared socket on mount and keeps the Zustand connection store
 * in sync with live socket state. Mount once near the app root.
 *
 * Liveness (AC#4): in addition to Socket.IO's transport ping (tightened to ~2s
 * on the server), the client emits an explicit `heartbeat` on an interval with a
 * short ack timeout so a silent drop surfaces quickly.
 */
export function useSocket(): void {
  const setStatus = useConnectionStore((s) => s.setStatus);
  const setWelcome = useConnectionStore((s) => s.setWelcome);
  const reset = useConnectionStore((s) => s.reset);

  useEffect(() => {
    const socket = getSocket();
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

    const startHeartbeat = () => {
      stopHeartbeat();
      heartbeatTimer = setInterval(() => {
        if (!socket.connected) return;
        socket
          .timeout(HEARTBEAT_TIMEOUT_MS)
          .emit("heartbeat", (err) => {
            // Missed ack ⇒ the link is likely dead; show retrying immediately.
            if (err && socket.connected === false) setStatus("connecting");
          });
      }, HEARTBEAT_INTERVAL_MS);
    };

    const stopHeartbeat = () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = undefined;
    };

    // After a transient drop the socket reconnects with a NEW id; if we still
    // think we're in a room, reclaim that seat (and our score) via room:resume.
    const tryResume = () => {
      const current = useRoomStore.getState().room;
      const sessionId = usePlayerSession.getState().sessionId;
      if (!current || !sessionId) return;
      socket.emit(
        "room:resume",
        { code: current.code, sessionId },
        (res: AckResponse<RoomSummary>) => {
          if (res.ok) {
            useRoomStore.getState().setRoom(res.data);
          } else {
            // Seat is truly gone (grace lapsed / room closed) — drop back to home.
            useRoomStore.getState().clearRoom();
            useRoleStore.getState().clearRole();
            useChatStore.getState().clear();
          }
        },
      );
    };

    const onConnect = () => {
      // Seed socketId immediately so state is correct even if welcome races/misses.
      setWelcome({ socketId: socket.id ?? "", protocolVersion: PROTOCOL_VERSION });
      setStatus("connected");
      startHeartbeat();
      tryResume();
    };

    const onDisconnect = (reason: string) => {
      stopHeartbeat();
      if (reason === "io server disconnect") {
        // Server forced us off — socket.io won't auto-reconnect; do it ourselves.
        setStatus("connecting");
        socket.connect();
      } else if (reason === "io client disconnect") {
        // We intentionally disconnected — terminal.
        reset();
      } else {
        // Transport drop (ping timeout / transport close) — auto-reconnect in flight.
        setStatus("connecting");
      }
    };

    const onConnectError = () => {
      // socket.io keeps retrying in the background — reflect "retrying", not dead.
      setStatus("connecting");
    };

    const onWelcome = (payload: { socketId?: string; protocolVersion?: number }) => {
      if (typeof payload?.socketId !== "string" || typeof payload?.protocolVersion !== "number") {
        return; // ignore malformed welcome
      }
      if (payload.protocolVersion !== PROTOCOL_VERSION) {
        console.warn(
          `[socket] protocol mismatch: server ${payload.protocolVersion} vs client ${PROTOCOL_VERSION}`,
        );
      }
      setWelcome({ socketId: payload.socketId, protocolVersion: payload.protocolVersion });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("server:welcome", onWelcome);

    if (socket.connected) {
      // Already connected (e.g. StrictMode remount of the singleton) — sync now.
      onConnect();
    } else {
      setStatus("connecting");
      socket.connect();
    }

    return () => {
      stopHeartbeat();
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("server:welcome", onWelcome);
    };
  }, [setStatus, setWelcome, reset]);
}
