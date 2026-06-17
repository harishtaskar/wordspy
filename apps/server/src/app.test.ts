import { describe, it, expect, afterEach } from "vitest";
import type { AddressInfo } from "node:net";
import { io as ioClient, type Socket } from "socket.io-client";
import { createApp, type AppHandles } from "./app.js";
import { _clearAllRooms, getRoom } from "./rooms/registry.js";
import type { ChatMessage } from "@wordspy/types";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  HealthResponse,
  HeartbeatAck,
  AckResponse,
  RoomSummary,
  RolePayload,
} from "@wordspy/types";
import { DEFAULT_ROOM_SETTINGS } from "@wordspy/types";

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
  _clearAllRooms(); // drop rooms + any pending phase timers between tests
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

describe("room:create", () => {
  it("creates a room and acks a summary with a code", async () => {
    const port = await listen();
    client = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((resolve) => client!.on("connect", () => resolve()));

    const res = await new Promise<AckResponse<RoomSummary>>((resolve) => {
      client!.emit("room:create", { username: "Aanya", settings: DEFAULT_ROOM_SETTINGS }, resolve);
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.code).toHaveLength(5);
      expect(res.data.hostId).toBeTruthy();
      expect(res.data.players[0]?.username).toBe("Aanya");
      expect(res.data.players[0]?.isHost).toBe(true);
    }
  });

  it("rejects an invalid payload with an error ack", async () => {
    const port = await listen();
    client = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((resolve) => client!.on("connect", () => resolve()));

    const res = await new Promise<AckResponse<RoomSummary>>((resolve) => {
      client!.emit("room:create", { username: "X", settings: DEFAULT_ROOM_SETTINGS }, resolve);
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBeTruthy();
  });
});

describe("room:join", () => {
  let client2: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;

  it("adds a joiner and broadcasts room:state to the host", async () => {
    const port = await listen();
    client = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((resolve) => client!.on("connect", () => resolve()));

    const created = await new Promise<AckResponse<RoomSummary>>((resolve) => {
      client!.emit("room:create", { username: "Aanya", settings: DEFAULT_ROOM_SETTINGS }, resolve);
    });
    if (!created.ok) throw new Error("create failed");
    const code = created.data.code;

    // Host listens for the live update.
    const hostSees2 = new Promise<RoomSummary>((resolve) => {
      client!.on("room:state", (room) => {
        if (room.players.length === 2) resolve(room);
      });
    });

    client2 = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((resolve) => client2!.on("connect", () => resolve()));
    const joined = await new Promise<AckResponse<RoomSummary>>((resolve) => {
      client2!.emit("room:join", { code, username: "Rex" }, resolve);
    });

    expect(joined.ok).toBe(true);
    if (joined.ok) expect(joined.data.players).toHaveLength(2);

    const hostRoom = await hostSees2;
    expect(hostRoom.players.map((p) => p.username).sort()).toEqual(["Aanya", "Rex"]);

    client2.close();
  });

  it("rejects joining a non-existent room", async () => {
    const port = await listen();
    client = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((resolve) => client!.on("connect", () => resolve()));

    const res = await new Promise<AckResponse<RoomSummary>>((resolve) => {
      client!.emit("room:join", { code: "ZZZZZ", username: "Mo" }, resolve);
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not found/i);
  });
});

describe("disconnect + host migration", () => {
  let client2: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;

  it("promotes the survivor to host when the host disconnects", async () => {
    const port = await listen();
    client = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((resolve) => client!.on("connect", () => resolve()));
    const created = await new Promise<AckResponse<RoomSummary>>((resolve) => {
      client!.emit("room:create", { username: "Aanya", settings: DEFAULT_ROOM_SETTINGS }, resolve);
    });
    if (!created.ok) throw new Error("create failed");
    const code = created.data.code;

    client2 = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((resolve) => client2!.on("connect", () => resolve()));
    const joined = await new Promise<AckResponse<RoomSummary>>((resolve) => {
      client2!.emit("room:join", { code, username: "Rex" }, resolve);
    });
    if (!joined.ok) throw new Error("join failed");
    const myId = joined.data.players.find((p) => p.username === "Rex")!.id;

    const becameHost = new Promise<RoomSummary>((resolve) => {
      client2!.on("room:state", (room) => {
        if (room.hostId === myId) resolve(room);
      });
    });

    // Host drops.
    client.close();

    const room = await becameHost;
    expect(room.players).toHaveLength(1);
    expect(room.players[0]?.username).toBe("Rex");
    expect(room.players[0]?.isHost).toBe(true);

    client2.close();
  });
});

describe("room:kick + room:start", () => {
  let c2: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;
  let c3: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;

  afterEach(() => {
    c2?.close();
    c3?.close();
    c2 = c3 = undefined;
  });

  async function connect(port: number) {
    const s = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((resolve) => s.on("connect", () => resolve()));
    return s as Socket<ServerToClientEvents, ClientToServerEvents>;
  }

  it("host kicks a player → target gets room:kicked, others updated", async () => {
    const port = await listen();
    client = await connect(port);
    const created = await new Promise<AckResponse<RoomSummary>>((r) =>
      client!.emit("room:create", { username: "Aanya", settings: DEFAULT_ROOM_SETTINGS }, r),
    );
    if (!created.ok) throw new Error("create");
    const code = created.data.code;

    c2 = await connect(port);
    const joined = await new Promise<AckResponse<RoomSummary>>((r) =>
      c2!.emit("room:join", { code, username: "Rex" }, r),
    );
    if (!joined.ok) throw new Error("join");
    const rexId = joined.data.players.find((p) => p.username === "Rex")!.id;

    const kicked = new Promise<{ code: string }>((resolve) => c2!.on("room:kicked", resolve));
    const res = await new Promise<AckResponse<RoomSummary>>((r) =>
      client!.emit("room:kick", { code, targetId: rexId }, r),
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.players).toHaveLength(1);
    expect((await kicked).code).toBe(code);
  });

  it("host starts with 3 players → phase starting broadcast; <3 rejected", async () => {
    const port = await listen();
    client = await connect(port);
    const created = await new Promise<AckResponse<RoomSummary>>((r) =>
      client!.emit("room:create", { username: "Aanya", settings: DEFAULT_ROOM_SETTINGS }, r),
    );
    if (!created.ok) throw new Error("create");
    const code = created.data.code;

    // Too few → rejected.
    const early = await new Promise<AckResponse<RoomSummary>>((r) =>
      client!.emit("room:start", { code }, r),
    );
    expect(early.ok).toBe(false);

    c2 = await connect(port);
    await new Promise<AckResponse<RoomSummary>>((r) => c2!.emit("room:join", { code, username: "Rex" }, r));
    c3 = await connect(port);
    await new Promise<AckResponse<RoomSummary>>((r) => c3!.emit("room:join", { code, username: "Mo" }, r));

    const starting = new Promise<RoomSummary>((resolve) => {
      c2!.on("room:state", (room) => {
        if (room.phase === "role-reveal") resolve(room);
      });
    });
    const res = await new Promise<AckResponse<RoomSummary>>((r) => client!.emit("room:start", { code }, r));
    expect(res.ok).toBe(true);
    const startedRoom = await starting;
    expect(startedRoom.phase).toBe("role-reveal");
    // Server-authoritative timer: phaseEndsAt is set ~5s ahead for the reveal.
    expect(startedRoom.phaseEndsAt).toBeGreaterThan(Date.now() + 3000);
    expect(startedRoom.phaseEndsAt).toBeLessThan(Date.now() + 7000);
    expect(startedRoom.round).toBe(1);
  });

  it("🔒 distributes per-socket roles: exactly one imposter, and the imposter payload has NO word", async () => {
    const port = await listen();
    client = await connect(port);
    const created = await new Promise<AckResponse<RoomSummary>>((r) =>
      client!.emit("room:create", { username: "Aanya", settings: DEFAULT_ROOM_SETTINGS }, r),
    );
    if (!created.ok) throw new Error("create");
    const code = created.data.code;

    c2 = await connect(port);
    await new Promise<AckResponse<RoomSummary>>((r) => c2!.emit("room:join", { code, username: "Rex" }, r));
    c3 = await connect(port);
    await new Promise<AckResponse<RoomSummary>>((r) => c3!.emit("room:join", { code, username: "Mo" }, r));

    // Every client captures its own role payload AND the broadcast room:state.
    const roleOf = (s: Socket<ServerToClientEvents, ClientToServerEvents>) =>
      new Promise<RolePayload>((resolve) => s.on("game:role", resolve));
    const roles = [roleOf(client), roleOf(c2), roleOf(c3)];
    const broadcastState = new Promise<RoomSummary>((resolve) =>
      c3!.on("room:state", (room) => room.phase === "role-reveal" && resolve(room)),
    );

    await new Promise<AckResponse<RoomSummary>>((r) => client!.emit("room:start", { code }, r));
    const payloads = await Promise.all(roles);

    const imposters = payloads.filter((p) => p.role === "imposter");
    const crew = payloads.filter((p) => p.role === "crew");
    expect(imposters).toHaveLength(1);
    expect(crew).toHaveLength(2);

    // Crew get the word; it's the same word for both.
    const words = crew.map((p) => (p as { word: string }).word);
    expect(words[0]).toBeTruthy();
    expect(new Set(words).size).toBe(1);

    // 🔒 The imposter payload must carry NO word under any key.
    const imposter = imposters[0]!;
    expect("word" in imposter).toBe(false);
    expect(JSON.stringify(imposter)).not.toContain(words[0]!);

    // 🔒 The broadcast room:state must carry no role and no word for anyone.
    const state = await broadcastState;
    const stateJson = JSON.stringify(state);
    expect(stateJson).not.toContain(words[0]!);
    expect(stateJson).not.toContain("imposter");
    expect(stateJson).not.toContain('"role"');
  });
});

describe("chat:send", () => {
  let c2: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;

  afterEach(() => {
    c2?.close();
    c2 = undefined;
  });

  async function startedRoom(port: number) {
    client = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => client!.on("connect", () => r()));
    const created = await new Promise<AckResponse<RoomSummary>>((r) =>
      client!.emit("room:create", { username: "Aanya", settings: DEFAULT_ROOM_SETTINGS }, r),
    );
    if (!created.ok) throw new Error("create");
    const code = created.data.code;
    c2 = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => c2!.on("connect", () => r()));
    await new Promise<AckResponse<RoomSummary>>((r) => c2!.emit("room:join", { code, username: "Rex" }, r));
    // Force discussion phase deterministically (no waiting on the 5s reveal).
    getRoom(code)!.phase = "discussion";
    return code;
  }

  it("broadcasts a message to the room during discussion", async () => {
    const port = await listen();
    const code = await startedRoom(port);
    const got = new Promise<ChatMessage>((resolve) => c2!.on("chat:message", resolve));
    client!.emit("chat:send", { code, text: "  Best when shared.  " });
    const msg = await got;
    expect(msg.username).toBe("Aanya");
    expect(msg.text).toBe("Best when shared."); // trimmed
  });

  it("ignores chat outside the discussion phase", async () => {
    const port = await listen();
    client = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => client!.on("connect", () => r()));
    const created = await new Promise<AckResponse<RoomSummary>>((r) =>
      client!.emit("room:create", { username: "Aanya", settings: DEFAULT_ROOM_SETTINGS }, r),
    );
    if (!created.ok) throw new Error("create");
    let received = false;
    client!.on("chat:message", () => (received = true));
    client!.emit("chat:send", { code: created.data.code, text: "hi" }); // phase = lobby
    await new Promise((r) => setTimeout(r, 150));
    expect(received).toBe(false);
  });

  it("rate-limits rapid messages from one socket", async () => {
    const port = await listen();
    const code = await startedRoom(port);
    const seen: string[] = [];
    c2!.on("chat:message", (m) => seen.push(m.text));
    client!.emit("chat:send", { code, text: "first" });
    client!.emit("chat:send", { code, text: "second" }); // too fast → dropped
    await new Promise((r) => setTimeout(r, 200));
    expect(seen).toEqual(["first"]);
  });

  it("ignores chat from an eliminated player", async () => {
    const port = await listen();
    const code = await startedRoom(port);
    const room = getRoom(code)!;
    const hostId = [...room.players.values()].find((p) => p.isHost)!.id;
    room.players.get(hostId)!.eliminated = true;

    let received = false;
    c2!.on("chat:message", () => (received = true));
    client!.emit("chat:send", { code, text: "I'm out but talking" });
    await new Promise((r) => setTimeout(r, 150));
    expect(received).toBe(false);
  });
});

describe("vote:cast", () => {
  let c2: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;
  let c3: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;

  afterEach(() => {
    c2?.close();
    c3?.close();
    c2 = c3 = undefined;
  });

  it("records a vote, broadcasts the count, and never reveals targets", async () => {
    const port = await listen();
    client = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => client!.on("connect", () => r()));
    const created = await new Promise<AckResponse<RoomSummary>>((r) =>
      client!.emit("room:create", { username: "Aanya", settings: DEFAULT_ROOM_SETTINGS }, r),
    );
    if (!created.ok) throw new Error("create");
    const code = created.data.code;
    c2 = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => c2!.on("connect", () => r()));
    const j2 = await new Promise<AckResponse<RoomSummary>>((r) => c2!.emit("room:join", { code, username: "Rex" }, r));
    c3 = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => c3!.on("connect", () => r()));
    await new Promise<AckResponse<RoomSummary>>((r) => c3!.emit("room:join", { code, username: "Mo" }, r));

    getRoom(code)!.phase = "voting";
    const rexId = j2.ok ? j2.data.players.find((p) => p.username === "Rex")!.id : "";

    const progress = new Promise<RoomSummary>((resolve) =>
      c3!.on("room:state", (room) => room.votesCast === 1 && resolve(room)),
    );
    const ack = await new Promise<AckResponse<RoomSummary>>((r) =>
      client!.emit("vote:cast", { code, targetId: rexId }, r),
    );
    expect(ack.ok).toBe(true);
    const broadcast = await progress;
    expect(broadcast.votesCast).toBe(1);
    // Anonymity: the broadcast carries the COUNT only — no votes map / target field.
    expect((broadcast as unknown as Record<string, unknown>).votes).toBeUndefined();
    expect(Object.keys(broadcast)).not.toContain("votes");
    expect(rexId).toBeTruthy();
  });

  it("rejects a self-vote", async () => {
    const port = await listen();
    client = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => client!.on("connect", () => r()));
    const created = await new Promise<AckResponse<RoomSummary>>((r) =>
      client!.emit("room:create", { username: "Aanya", settings: DEFAULT_ROOM_SETTINGS }, r),
    );
    if (!created.ok) throw new Error("create");
    const code = created.data.code;
    const myId = created.data.hostId;
    getRoom(code)!.phase = "voting";
    const ack = await new Promise<AckResponse<RoomSummary>>((r) =>
      client!.emit("vote:cast", { code, targetId: myId }, r),
    );
    expect(ack.ok).toBe(false);
  });

  it("resolves to the result phase once everyone has voted", async () => {
    const port = await listen();
    client = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => client!.on("connect", () => r()));
    const created = await new Promise<AckResponse<RoomSummary>>((r) =>
      client!.emit("room:create", { username: "Aanya", settings: DEFAULT_ROOM_SETTINGS }, r),
    );
    if (!created.ok) throw new Error("create");
    const code = created.data.code;
    const hostId = created.data.hostId;
    c2 = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => c2!.on("connect", () => r()));
    const j2 = await new Promise<AckResponse<RoomSummary>>((r) => c2!.emit("room:join", { code, username: "Rex" }, r));
    c3 = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => c3!.on("connect", () => r()));
    const j3 = await new Promise<AckResponse<RoomSummary>>((r) => c3!.emit("room:join", { code, username: "Mo" }, r));
    if (!j2.ok || !j3.ok) throw new Error("join");
    const rexId = j2.data.players.find((p) => p.username === "Rex")!.id;
    const moId = j3.data.players.find((p) => p.username === "Mo")!.id;

    const room = getRoom(code)!;
    room.phase = "voting";
    room.imposterId = rexId; // Rex is the imposter

    const resultState = new Promise<RoomSummary>((resolve) =>
      c3!.on("room:state", (rm) => rm.phase === "result" && resolve(rm)),
    );
    client!.emit("vote:cast", { code, targetId: rexId }); // Aanya → Rex
    c3!.emit("vote:cast", { code, targetId: rexId }); // Mo → Rex
    c2!.emit("vote:cast", { code, targetId: moId }); // Rex → Mo (all voted)

    const rs = await resultState;
    expect(rs.phase).toBe("result");
    expect(rs.voteResult?.suspectId).toBe(rexId);
    expect(rs.voteResult?.wasImposter).toBe(true);
  });
});

describe("imposter disconnect insta-win (4.3)", () => {
  let c2: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;
  let c3: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;
  afterEach(() => {
    c2?.close();
    c3?.close();
    c2 = c3 = undefined;
  });

  async function threeInRoom(port: number) {
    client = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => client!.on("connect", () => r()));
    const created = await new Promise<AckResponse<RoomSummary>>((r) =>
      client!.emit("room:create", { username: "Aanya", settings: DEFAULT_ROOM_SETTINGS }, r),
    );
    if (!created.ok) throw new Error("create");
    const code = created.data.code;
    c2 = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => c2!.on("connect", () => r()));
    const j2 = await new Promise<AckResponse<RoomSummary>>((r) => c2!.emit("room:join", { code, username: "Rex" }, r));
    c3 = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => c3!.on("connect", () => r()));
    await new Promise<AckResponse<RoomSummary>>((r) => c3!.emit("room:join", { code, username: "Mo" }, r));
    const rexId = j2.ok ? j2.data.players.find((p) => p.username === "Rex")!.id : "";
    return { code, rexId };
  }

  it("ends the match with a Crew win when the imposter disconnects mid-match", async () => {
    const port = await listen();
    const { code, rexId } = await threeInRoom(port);
    const room = getRoom(code)!;
    room.phase = "discussion";
    room.imposterId = rexId; // Rex (c2) is the imposter

    const over = new Promise<RoomSummary>((resolve) =>
      c3!.on("room:state", (rm) => rm.phase === "game-over" && resolve(rm)),
    );
    c2!.close(); // imposter quits

    const rs = await over;
    expect(rs.phase).toBe("game-over");
    expect(rs.winner).toBe("crew");
    expect(rs.winReason).toBe("imposter-left");
  });

  it("does NOT end the match when a non-imposter disconnects", async () => {
    const port = await listen();
    const { code, rexId } = await threeInRoom(port);
    const room = getRoom(code)!;
    room.phase = "discussion";
    room.imposterId = rexId; // Rex is imposter; Mo (c3) is crew

    let endedEarly = false;
    c2!.on("room:state", (rm) => {
      if (rm.phase === "game-over") endedEarly = true;
    });
    c3!.close(); // a crew member quits
    await new Promise((r) => setTimeout(r, 150));
    expect(endedEarly).toBe(false);
    expect(getRoom(code)!.phase).toBe("discussion");
  });
});

describe("review fixes — voting deadlock + multi-room (2026-06-17)", () => {
  let c2: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;
  let c3: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;
  afterEach(() => {
    c2?.close();
    c3?.close();
    c2 = c3 = undefined;
  });

  it("resolves the voting round when the last non-voter disconnects (no deadlock)", async () => {
    const port = await listen();
    client = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => client!.on("connect", () => r()));
    const created = await new Promise<AckResponse<RoomSummary>>((r) =>
      client!.emit("room:create", { username: "Aanya", settings: DEFAULT_ROOM_SETTINGS }, r),
    );
    if (!created.ok) throw new Error("create");
    const code = created.data.code;
    c2 = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => c2!.on("connect", () => r()));
    const j2 = await new Promise<AckResponse<RoomSummary>>((r) => c2!.emit("room:join", { code, username: "Rex" }, r));
    c3 = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => c3!.on("connect", () => r()));
    const j3 = await new Promise<AckResponse<RoomSummary>>((r) => c3!.emit("room:join", { code, username: "Mo" }, r));
    if (!j2.ok || !j3.ok) throw new Error("join");
    const rexId = j2.data.players.find((p) => p.username === "Rex")!.id;
    const moId = j3.data.players.find((p) => p.username === "Mo")!.id;

    const room = getRoom(code)!;
    room.phase = "voting";
    room.imposterId = rexId;

    // host + Mo vote; Rex never votes, then disconnects → round must still resolve.
    const resolved = new Promise<RoomSummary>((resolve) =>
      c3!.on("room:state", (rm) => (rm.phase === "result" || rm.phase === "game-over") && resolve(rm)),
    );
    client!.emit("vote:cast", { code, targetId: moId });
    c3!.emit("vote:cast", { code, targetId: moId });
    // Now active = {host, Rex, Mo} = 3, votes = 2. Rex leaves → active 2, votes 2 → resolves.
    c2!.close();

    const rs = await resolved;
    expect(["result", "game-over"]).toContain(rs.phase);
  });

  it("rejects joining a second room while already in one", async () => {
    const port = await listen();
    client = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => client!.on("connect", () => r()));
    const a = await new Promise<AckResponse<RoomSummary>>((r) =>
      client!.emit("room:create", { username: "Aanya", settings: DEFAULT_ROOM_SETTINGS }, r),
    );
    if (!a.ok) throw new Error("create");
    // Same socket creates another room → rejected.
    const dup = await new Promise<AckResponse<RoomSummary>>((r) =>
      client!.emit("room:create", { username: "Aanya", settings: DEFAULT_ROOM_SETTINGS }, r),
    );
    expect(dup.ok).toBe(false);
  });
});

describe("chat masks the secret word (#7)", () => {
  let c2: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;
  afterEach(() => { c2?.close(); c2 = undefined; });

  it("replaces the secret word with asterisks before broadcasting", async () => {
    const port = await listen();
    client = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => client!.on("connect", () => r()));
    const created = await new Promise<AckResponse<RoomSummary>>((r) =>
      client!.emit("room:create", { username: "Aanya", settings: DEFAULT_ROOM_SETTINGS }, r),
    );
    if (!created.ok) throw new Error("create");
    const code = created.data.code;
    c2 = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => c2!.on("connect", () => r()));
    await new Promise<AckResponse<RoomSummary>>((r) => c2!.emit("room:join", { code, username: "Rex" }, r));

    const room = getRoom(code)!;
    room.phase = "discussion";
    room.secretWord = "Pizza";

    const got = new Promise<ChatMessage>((resolve) => c2!.on("chat:message", resolve));
    client!.emit("chat:send", { code, text: "i bet it's pizza honestly" });
    const msg = await got;
    expect(msg.text).not.toContain("pizza");
    expect(msg.text).toContain("*****");
  });
});

describe("public room browsing", () => {
  let c2: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;
  afterEach(() => { c2?.close(); c2 = undefined; });

  it("browseJoin returns the list and a new public room pushes a live update", async () => {
    const port = await listen();
    client = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => client!.on("connect", () => r()));

    const initial = await new Promise<AckResponse<unknown>>((r) => client!.emit("room:browseJoin", r));
    expect(initial.ok).toBe(true);

    const update = new Promise<Array<{ code: string; hostName: string }>>((resolve) =>
      client!.on("public:rooms", (rooms) => rooms.length > 0 && resolve(rooms)),
    );

    c2 = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => c2!.on("connect", () => r()));
    await new Promise<AckResponse<RoomSummary>>((r) =>
      c2!.emit("room:create", { username: "Aanya", settings: { ...DEFAULT_ROOM_SETTINGS, isPrivate: false } }, r),
    );

    const rooms = await update;
    expect(rooms[0]?.hostName).toBe("Aanya");
  });

  it("does not list a private room", async () => {
    const port = await listen();
    client = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => client!.on("connect", () => r()));
    await new Promise<AckResponse<RoomSummary>>((r) =>
      client!.emit("room:create", { username: "Aanya", settings: { ...DEFAULT_ROOM_SETTINGS, isPrivate: true } }, r),
    );
    c2 = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((r) => c2!.on("connect", () => r()));
    const list = await new Promise<AckResponse<unknown[]>>((r) => c2!.emit("room:browseJoin", r));
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.data).toHaveLength(0);
  });
});
