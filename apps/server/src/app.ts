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

    socket.on("disconnect", (reason) => {
      console.log(`[socket] disconnected ${socket.id} (${reason})`);
    });
  });

  return { app, httpServer, io };
}
