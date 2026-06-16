import { describe, it, expect, expectTypeOf } from "vitest";
import {
  PROTOCOL_VERSION,
  CATEGORIES,
  DISCUSSION_TIMES,
  MAX_PLAYERS_OPTIONS,
  DEFAULT_ROOM_SETTINGS,
  validateUsername,
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

  it("event maps declare the heartbeat + welcome + room events", () => {
    expectTypeOf<ClientToServerEvents>().toHaveProperty("heartbeat");
    expectTypeOf<ClientToServerEvents>().toHaveProperty("room:create");
    expectTypeOf<ClientToServerEvents>().toHaveProperty("room:join");
    expectTypeOf<ClientToServerEvents>().toHaveProperty("room:setReady");
    expectTypeOf<ClientToServerEvents>().toHaveProperty("room:kick");
    expectTypeOf<ClientToServerEvents>().toHaveProperty("room:start");
    expectTypeOf<ClientToServerEvents>().toHaveProperty("room:leave");
    expectTypeOf<ServerToClientEvents>().toHaveProperty("server:welcome");
    expectTypeOf<ServerToClientEvents>().toHaveProperty("room:state");
    expectTypeOf<ServerToClientEvents>().toHaveProperty("room:kicked");
  });

  it("room option lists are non-empty and defaults are members of them", () => {
    expect(CATEGORIES.length).toBe(7);
    expect(CATEGORIES).toContain(DEFAULT_ROOM_SETTINGS.category);
    expect(DISCUSSION_TIMES).toContain(DEFAULT_ROOM_SETTINGS.discussionSeconds);
    expect(MAX_PLAYERS_OPTIONS).toContain(DEFAULT_ROOM_SETTINGS.maxPlayers);
  });

  it("validateUsername normalizes, length-checks, and blocks the blocklist", () => {
    expect(validateUsername("  Rex  the Cat ")).toEqual({ ok: true, value: "Rex the Cat" });
    expect(validateUsername("A").ok).toBe(false);
    expect(validateUsername("admin").ok).toBe(false);
    expect(validateUsername(42 as unknown).ok).toBe(false);
  });
});
