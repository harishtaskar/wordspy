import { describe, it, expect, expectTypeOf } from "vitest";
import {
  PROTOCOL_VERSION,
  type HeartbeatAck,
  type HealthResponse,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "./index.js";

describe("@wordspy/types contract", () => {
  it("exposes a numeric protocol version", () => {
    expect(typeof PROTOCOL_VERSION).toBe("number");
    expect(PROTOCOL_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("HeartbeatAck has serverTime + protocolVersion", () => {
    const ack: HeartbeatAck = { serverTime: Date.now(), protocolVersion: PROTOCOL_VERSION };
    expect(ack.serverTime).toBeGreaterThan(0);
    expect(ack.protocolVersion).toBe(PROTOCOL_VERSION);
  });

  it("HealthResponse status is the literal 'ok'", () => {
    const res: HealthResponse = { status: "ok", uptimeSeconds: 0, protocolVersion: PROTOCOL_VERSION };
    expectTypeOf(res.status).toEqualTypeOf<"ok">();
  });

  it("event maps declare the heartbeat + welcome events", () => {
    expectTypeOf<ClientToServerEvents>().toHaveProperty("heartbeat");
    expectTypeOf<ServerToClientEvents>().toHaveProperty("server:welcome");
  });
});
