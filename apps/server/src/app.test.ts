import { describe, it, expect, afterEach } from "vitest";
import type { AddressInfo } from "node:net";
import { io as ioClient, type Socket } from "socket.io-client";
import { createApp, type AppHandles } from "./app.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  HealthResponse,
  HeartbeatAck,
} from "@wordspy/types";

let handles: AppHandles | undefined;
let client: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;

function listen(): Promise<number> {
  handles = createApp({ corsOrigin: "*" });
  return new Promise((resolve) => {
    handles!.httpServer.listen(0, () => {
      const { port } = handles!.httpServer.address() as AddressInfo;
      resolve(port);
    });
  });
}

afterEach(async () => {
  client?.close();
  client = undefined;
  await new Promise<void>((resolve) => {
    if (!handles) return resolve();
    handles.io.close(() => handles!.httpServer.close(() => resolve()));
  });
  handles = undefined;
});

describe("GET /health", () => {
  it("returns status ok with protocol version", async () => {
    const port = await listen();
    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as HealthResponse;
    expect(body.status).toBe("ok");
    expect(body.protocolVersion).toBeGreaterThanOrEqual(1);
    expect(typeof body.uptimeSeconds).toBe("number");
  });
});

describe("Socket.IO connection", () => {
  it("emits server:welcome on connect", async () => {
    const port = await listen();
    client = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });

    const welcome = await new Promise<{ socketId: string; protocolVersion: number }>(
      (resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("no welcome")), 3000);
        client!.on("server:welcome", (payload) => {
          clearTimeout(timer);
          resolve(payload);
        });
      },
    );
    expect(welcome.socketId).toBeTruthy();
    expect(welcome.protocolVersion).toBeGreaterThanOrEqual(1);
  });

  it("answers a heartbeat with an ack", async () => {
    const port = await listen();
    client = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((resolve) => client!.on("connect", () => resolve()));

    const ack = await new Promise<HeartbeatAck>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("no ack")), 3000);
      client!.emit("heartbeat", (reply) => {
        clearTimeout(timer);
        resolve(reply);
      });
    });
    expect(ack.serverTime).toBeGreaterThan(0);
    expect(ack.protocolVersion).toBeGreaterThanOrEqual(1);
  });
});
