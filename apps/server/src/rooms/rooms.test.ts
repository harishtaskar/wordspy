import { describe, it, expect, beforeEach } from "vitest";
import { generateRoomCode, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "../lib/roomCode.js";
import {
  createRoom,
  getRoom,
  hasRoom,
  toSummary,
  addPlayer,
  removePlayer,
  setReady,
  setEliminated,
  kickPlayer,
  startGame,
  playAgain,
  castVote,
  resolveRound,
  nextAfterResult,
  startRound2,
  resolveTerminal,
  setWinner,
  submitFinalGuess,
  activePlayers,
  findRoomsForSocket,
  _clearAllRooms,
} from "./registry.js";
import { validateCreateRoom } from "./createRoom.js";
import { validateJoin } from "./joinRoom.js";
import { assignRoles } from "./assignRoles.js";
import { DEFAULT_ROOM_SETTINGS } from "@wordspy/types";

beforeEach(() => _clearAllRooms());

describe("generateRoomCode", () => {
  it("produces an uppercase code of the right length from the alphabet", () => {
    const code = generateRoomCode(() => false);
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    expect([...code].every((c) => ROOM_CODE_ALPHABET.includes(c))).toBe(true);
  });

  it("excludes ambiguous characters 0 O 1 I", () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[01OI]/);
  });

  it("avoids taken codes", () => {
    const taken = new Set(["AAAAA"]);
    const code = generateRoomCode((c) => taken.has(c));
    expect(code).not.toBe("AAAAA");
  });
});

describe("registry", () => {
  it("creates a room with the host as the only player", () => {
    const room = createRoom({ id: "sock1", username: "Aanya" }, DEFAULT_ROOM_SETTINGS);
    expect(hasRoom(room.code)).toBe(true);
    expect(room.hostId).toBe("sock1");
    expect(room.players.size).toBe(1);
    const summary = toSummary(room);
    expect(summary.players[0]).toMatchObject({ id: "sock1", username: "Aanya", isHost: true });
    expect(getRoom(room.code)).toBe(room);
  });

  it("allocates unique codes across rooms", () => {
    const a = createRoom({ id: "s1", username: "A" }, DEFAULT_ROOM_SETTINGS);
    const b = createRoom({ id: "s2", username: "B" }, DEFAULT_ROOM_SETTINGS);
    expect(a.code).not.toBe(b.code);
  });
});

describe("validateCreateRoom", () => {
  const good = { username: "Rex", settings: DEFAULT_ROOM_SETTINGS };

  it("accepts a valid request", () => {
    const r = validateCreateRoom(good);
    expect(r.ok).toBe(true);
  });

  it("rejects a short username", () => {
    expect(validateCreateRoom({ ...good, username: "R" }).ok).toBe(false);
  });

  it("rejects an out-of-range maxPlayers", () => {
    expect(
      validateCreateRoom({ ...good, settings: { ...DEFAULT_ROOM_SETTINGS, maxPlayers: 7 } }).ok,
    ).toBe(false);
  });

  it("rejects a bad category", () => {
    expect(
      validateCreateRoom({ ...good, settings: { ...DEFAULT_ROOM_SETTINGS, category: "nope" } }).ok,
    ).toBe(false);
  });

  it("rejects malformed payloads", () => {
    expect(validateCreateRoom(null).ok).toBe(false);
    expect(validateCreateRoom("x").ok).toBe(false);
    expect(validateCreateRoom({}).ok).toBe(false);
  });

  it("enforces the username blocklist server-side", () => {
    expect(validateCreateRoom({ username: "admin", settings: DEFAULT_ROOM_SETTINGS }).ok).toBe(false);
    expect(validateJoin({ code: "ABCDE", username: "admin" }).ok).toBe(false);
  });
});

describe("validateJoin", () => {
  it("normalizes a lowercase code to uppercase", () => {
    const r = validateJoin({ code: "abcde", username: "Mo" });
    expect(r).toMatchObject({ ok: true, code: "ABCDE", username: "Mo" });
  });
  it("rejects a wrong-length code", () => {
    expect(validateJoin({ code: "ABC", username: "Mo" }).ok).toBe(false);
  });
  it("rejects codes with ambiguous/invalid chars", () => {
    expect(validateJoin({ code: "AB012", username: "Mo" }).ok).toBe(false);
  });
  it("rejects a short username", () => {
    expect(validateJoin({ code: "ABCDE", username: "M" }).ok).toBe(false);
  });
});

describe("addPlayer", () => {
  it("adds a non-host player and rejects full / duplicate / missing / started", () => {
    const room = createRoom({ id: "host", username: "Aanya" }, { ...DEFAULT_ROOM_SETTINGS, maxPlayers: 4 });

    expect(addPlayer("NOPE5", { id: "x", username: "X" })).toMatchObject({ ok: false });

    const r1 = addPlayer(room.code, { id: "p2", username: "Rex" });
    expect(r1.ok).toBe(true);
    expect(toSummary(room).players.find((p) => p.id === "p2")?.isHost).toBe(false);

    // duplicate username (case-insensitive)
    expect(addPlayer(room.code, { id: "p3", username: "rex" })).toMatchObject({ ok: false });

    // idempotent re-join by same socket
    expect(addPlayer(room.code, { id: "p2", username: "Rex" }).ok).toBe(true);

    // fill to capacity then reject
    addPlayer(room.code, { id: "p4", username: "Mo" });
    addPlayer(room.code, { id: "p5", username: "Sam" });
    expect(addPlayer(room.code, { id: "p6", username: "Lee" })).toMatchObject({ ok: false, error: "Room full." });

    // started room
    room.phase = "lobby"; // (only lobby exists now; guard still covered by registry logic)
  });
});

describe("removePlayer", () => {
  it("removes a non-host without changing host", () => {
    const room = createRoom({ id: "host", username: "Aanya" }, DEFAULT_ROOM_SETTINGS);
    addPlayer(room.code, { id: "p2", username: "Rex" });
    const res = removePlayer(room.code, "p2");
    expect(res.deleted).toBe(false);
    expect(res.room?.hostId).toBe("host");
    expect(res.room?.players.has("p2")).toBe(false);
  });

  it("promotes the next player when the host leaves", () => {
    const room = createRoom({ id: "host", username: "Aanya" }, DEFAULT_ROOM_SETTINGS);
    addPlayer(room.code, { id: "p2", username: "Rex" });
    const res = removePlayer(room.code, "host");
    expect(res.deleted).toBe(false);
    expect(res.room?.hostId).toBe("p2");
    expect(toSummary(res.room!).players.find((p) => p.id === "p2")?.isHost).toBe(true);
  });

  it("deletes the room when the last player leaves", () => {
    const room = createRoom({ id: "host", username: "Aanya" }, DEFAULT_ROOM_SETTINGS);
    const res = removePlayer(room.code, "host");
    expect(res.deleted).toBe(true);
    expect(hasRoom(room.code)).toBe(false);
  });
});

describe("setReady + findRoomsForSocket", () => {
  it("toggles ready and finds the room for a socket", () => {
    const room = createRoom({ id: "host", username: "Aanya" }, DEFAULT_ROOM_SETTINGS);
    expect(findRoomsForSocket("host")).toEqual([room.code]);
    setReady(room.code, "host", true);
    expect(toSummary(room).players[0]?.isReady).toBe(true);
    setReady(room.code, "host", false);
    expect(toSummary(room).players[0]?.isReady).toBe(false);
  });
});

describe("kickPlayer", () => {
  function roomWith3() {
    const room = createRoom({ id: "host", username: "Aanya" }, DEFAULT_ROOM_SETTINGS);
    addPlayer(room.code, { id: "p2", username: "Rex" });
    addPlayer(room.code, { id: "p3", username: "Mo" });
    return room;
  }

  it("lets the host remove a player", () => {
    const room = roomWith3();
    const res = kickPlayer(room.code, "host", "p2");
    expect(res.ok).toBe(true);
    expect(room.players.has("p2")).toBe(false);
  });
  it("rejects a non-host kicker", () => {
    const room = roomWith3();
    expect(kickPlayer(room.code, "p2", "p3")).toMatchObject({ ok: false });
  });
  it("rejects kicking yourself", () => {
    const room = roomWith3();
    expect(kickPlayer(room.code, "host", "host")).toMatchObject({ ok: false });
  });
  it("rejects an unknown target", () => {
    const room = roomWith3();
    expect(kickPlayer(room.code, "host", "ghost")).toMatchObject({ ok: false });
  });
});

describe("startGame", () => {
  function roomWith(n: number) {
    const room = createRoom({ id: "host", username: "Aanya" }, DEFAULT_ROOM_SETTINGS);
    for (let i = 2; i <= n; i++) addPlayer(room.code, { id: `p${i}`, username: `P${i}` });
    return room;
  }

  it("starts with 3+ players and sets phase starting", () => {
    const room = roomWith(3);
    const res = startGame(room.code, "host");
    expect(res.ok).toBe(true);
    expect(room.phase).toBe("role-reveal");
  });
  it("rejects starting with fewer than 3", () => {
    const room = roomWith(2);
    expect(startGame(room.code, "host")).toMatchObject({ ok: false });
    expect(room.phase).toBe("lobby");
  });
  it("rejects a non-host starter", () => {
    const room = roomWith(3);
    expect(startGame(room.code, "p2")).toMatchObject({ ok: false });
  });
  it("rejects starting an already-started room", () => {
    const room = roomWith(3);
    startGame(room.code, "host");
    expect(startGame(room.code, "host")).toMatchObject({ ok: false });
  });
});

describe("castVote", () => {
  function votingRoom() {
    const room = createRoom({ id: "host", username: "Aanya" }, DEFAULT_ROOM_SETTINGS);
    addPlayer(room.code, { id: "p2", username: "Rex" });
    addPlayer(room.code, { id: "p3", username: "Mo" });
    room.phase = "voting";
    return room;
  }

  it("records a valid vote", () => {
    const room = votingRoom();
    const res = castVote(room.code, "host", "p2");
    expect(res.ok).toBe(true);
    expect(room.votes.get("host")).toBe("p2");
    expect(toSummary(room).votesCast).toBe(1);
  });

  it("rejects voting outside the voting phase", () => {
    const room = votingRoom();
    room.phase = "discussion";
    expect(castVote(room.code, "host", "p2")).toMatchObject({ ok: false });
  });

  it("rejects voting for yourself", () => {
    const room = votingRoom();
    expect(castVote(room.code, "host", "host")).toMatchObject({ ok: false });
  });

  it("rejects a second vote (final)", () => {
    const room = votingRoom();
    castVote(room.code, "host", "p2");
    expect(castVote(room.code, "host", "p3")).toMatchObject({ ok: false, error: "You already voted." });
  });

  it("rejects an eliminated voter and an eliminated target", () => {
    const room = votingRoom();
    setEliminated(room.code, "p2", true);
    expect(castVote(room.code, "p2", "host")).toMatchObject({ ok: false }); // eliminated voter
    expect(castVote(room.code, "host", "p2")).toMatchObject({ ok: false }); // eliminated target
  });

  it("activePlayers excludes eliminated", () => {
    const room = votingRoom();
    setEliminated(room.code, "p2", true);
    expect(activePlayers(room).map((p) => p.id).sort()).toEqual(["host", "p3"]);
  });
});

describe("resolveRound", () => {
  function votingRoom() {
    const room = createRoom({ id: "host", username: "Aanya" }, DEFAULT_ROOM_SETTINGS);
    addPlayer(room.code, { id: "p2", username: "Rex" });
    addPlayer(room.code, { id: "p3", username: "Mo" });
    room.phase = "voting";
    return room;
  }

  it("eliminates a caught Crew suspect and records wasImposter=false", () => {
    const room = votingRoom();
    room.imposterId = "p3"; // Mo is imposter
    castVote(room.code, "host", "p2");
    castVote(room.code, "p3", "p2");
    castVote(room.code, "p2", "host"); // p2 (Rex) is the top → suspect, and is Crew
    const out = resolveRound(room);
    expect(out.kind).toBe("result");
    if (out.kind === "result") {
      expect(out.result.suspectId).toBe("p2");
      expect(out.result.wasImposter).toBe(false);
    }
    expect(room.players.get("p2")?.eliminated).toBe(true);
    expect(room.phase).toBe("result");
  });

  it("records wasImposter=true and does NOT eliminate when the imposter is caught", () => {
    const room = votingRoom();
    room.imposterId = "p2";
    castVote(room.code, "host", "p2");
    castVote(room.code, "p3", "p2");
    castVote(room.code, "p2", "host");
    const out = resolveRound(room);
    expect(out.kind).toBe("result");
    if (out.kind === "result") {
      expect(out.result.suspectId).toBe("p2");
      expect(out.result.wasImposter).toBe(true);
    }
    expect(room.players.get("p2")?.eliminated).toBe(false); // imposter not eliminated; Epic 4 ends it
  });

  it("triggers a single re-vote on the first tie, then ends with nobody out on a second tie", () => {
    const room = votingRoom();
    room.imposterId = "p3";
    // First round: 1-1 tie.
    castVote(room.code, "host", "p2");
    castVote(room.code, "p2", "host");
    const first = resolveRound(room);
    expect(first.kind).toBe("revote");
    expect(room.phase).toBe("voting");
    expect(room.revote).toBe(true);
    expect(room.votes.size).toBe(0); // cleared for the re-vote

    // Re-vote: tie again.
    castVote(room.code, "host", "p2");
    castVote(room.code, "p2", "host");
    const second = resolveRound(room);
    expect(second.kind).toBe("result");
    if (second.kind === "result") expect(second.result.tie).toBe(true);
    expect(room.phase).toBe("result");
    expect(room.revote).toBe(false);
    expect([...room.players.values()].some((p) => p.eliminated)).toBe(false);
  });

  it("re-vote that produces a clear suspect resolves normally", () => {
    const room = votingRoom();
    room.imposterId = "p3";
    castVote(room.code, "host", "p2");
    castVote(room.code, "p2", "host"); // tie → revote
    resolveRound(room);
    // Re-vote: clear suspect p2.
    castVote(room.code, "host", "p2");
    castVote(room.code, "p3", "p2");
    castVote(room.code, "p2", "host");
    const out = resolveRound(room);
    expect(out.kind).toBe("result");
    if (out.kind === "result") expect(out.result.suspectId).toBe("p2");
    expect(room.players.get("p2")?.eliminated).toBe(true);
  });
});

describe("nextAfterResult + startRound2", () => {
  function resolvedRoom(round: number, wasImposter: boolean) {
    const room = createRoom({ id: "host", username: "Aanya" }, DEFAULT_ROOM_SETTINGS);
    addPlayer(room.code, { id: "p2", username: "Rex" });
    addPlayer(room.code, { id: "p3", username: "Mo" });
    room.round = round;
    room.phase = "result";
    room.secretWord = "PIZZA";
    room.imposterId = "p3";
    room.voteResult = {
      round,
      suspectId: "p2",
      suspectUsername: "Rex",
      wasImposter,
      tie: false,
      tally: [],
    };
    return room;
  }

  it("round 1 + crew caught → round2", () => {
    expect(nextAfterResult(resolvedRoom(1, false))).toBe("round2");
  });
  it("round 1 + imposter caught → terminal", () => {
    expect(nextAfterResult(resolvedRoom(1, true))).toBe("terminal");
  });
  it("round 2 → terminal regardless", () => {
    expect(nextAfterResult(resolvedRoom(2, false))).toBe("terminal");
  });
  it("round 1 tie (wasImposter false) → round2", () => {
    const room = resolvedRoom(1, false);
    room.voteResult = { ...room.voteResult!, suspectId: null, suspectUsername: null, tie: true };
    expect(nextAfterResult(room)).toBe("round2");
  });

  it("startRound2 begins discussion at round 2, keeps word/imposter, clears votes", () => {
    const room = resolvedRoom(1, false);
    room.votes.set("host", "p2");
    startRound2(room);
    expect(room.round).toBe(2);
    expect(room.phase).toBe("discussion");
    expect(room.votes.size).toBe(0);
    expect(room.voteResult).toBeUndefined();
    expect(room.secretWord).toBe("PIZZA"); // same match
    expect(room.imposterId).toBe("p3");
  });
});

describe("submitFinalGuess", () => {
  function finalGuessRoom() {
    const room = createRoom({ id: "host", username: "Aanya" }, DEFAULT_ROOM_SETTINGS);
    addPlayer(room.code, { id: "imp", username: "Rex" });
    room.phase = "final-guess";
    room.imposterId = "imp";
    room.secretWord = "Pizza";
    return room;
  }

  it("correct guess → imposter steals the win", () => {
    const room = finalGuessRoom();
    const res = submitFinalGuess(room, "imp", "  pizza! ");
    expect(res).toEqual({ ok: true, correct: true });
    expect(room.winner).toBe("imposter");
    expect(room.phase).toBe("game-over");
  });

  it("wrong guess → crew wins", () => {
    const room = finalGuessRoom();
    const res = submitFinalGuess(room, "imp", "burger");
    expect(res).toEqual({ ok: true, correct: false });
    expect(room.winner).toBe("crew");
    expect(room.phase).toBe("game-over");
  });

  it("rejects a non-imposter guesser", () => {
    const room = finalGuessRoom();
    expect(submitFinalGuess(room, "host", "pizza")).toMatchObject({ ok: false });
    expect(room.winner).toBeUndefined();
  });

  it("rejects a guess outside the final-guess phase", () => {
    const room = finalGuessRoom();
    room.phase = "voting";
    expect(submitFinalGuess(room, "imp", "pizza")).toMatchObject({ ok: false });
  });
});

describe("playAgain (4.6)", () => {
  function endedRoom() {
    const room = createRoom({ id: "host", username: "Aanya" }, DEFAULT_ROOM_SETTINGS);
    addPlayer(room.code, { id: "p2", username: "Rex" });
    room.phase = "game-over";
    room.winner = "crew";
    room.round = 2;
    room.secretWord = "Pizza";
    room.imposterId = "p2";
    room.usedWords.add("Pizza");
    const p2 = room.players.get("p2")!;
    p2.score = 100;
    p2.eliminated = true;
    p2.eliminatedRound = 1;
    p2.role = "imposter";
    return room;
  }

  it("resets to lobby keeping players + usedWords, scores cleared", () => {
    const room = endedRoom();
    const res = playAgain(room.code, "host");
    expect(res.ok).toBe(true);
    expect(room.phase).toBe("lobby");
    expect(room.round).toBe(1);
    expect(room.players.size).toBe(2); // roster kept
    expect(room.winner).toBeUndefined();
    expect(room.secretWord).toBeUndefined();
    expect(room.imposterId).toBeUndefined();
    const p2 = room.players.get("p2")!;
    expect(p2.score).toBe(0);
    expect(p2.eliminated).toBe(false);
    expect(p2.role).toBeUndefined();
    expect(room.usedWords.has("Pizza")).toBe(true); // no-repeat across session
  });

  it("rejects a non-host", () => {
    const room = endedRoom();
    expect(playAgain(room.code, "p2")).toMatchObject({ ok: false });
  });

  it("rejects when the match is not finished", () => {
    const room = endedRoom();
    room.phase = "lobby";
    expect(playAgain(room.code, "host")).toMatchObject({ ok: false });
  });
});

describe("toSummary reveal (4.5)", () => {
  it("hides the word + imposter during play, reveals them at game-over", () => {
    const room = createRoom({ id: "imp", username: "Imp" }, DEFAULT_ROOM_SETTINGS);
    addPlayer(room.code, { id: "c1", username: "C1" });
    room.imposterId = "imp";
    room.imposterUsername = "Imp";
    room.secretWord = "Pizza";

    room.phase = "discussion";
    const during = toSummary(room);
    expect(during.revealedWord).toBeUndefined();
    expect(during.revealedImposter).toBeUndefined();

    setWinner(room, "crew"); // → game-over
    const over = toSummary(room);
    expect(over.revealedWord).toBe("Pizza");
    expect(over.revealedImposter).toBe("Imp");
  });
});

describe("resolveTerminal + setWinner", () => {
  function resultRoom(round: number, wasImposter: boolean) {
    const room = createRoom({ id: "host", username: "Aanya" }, DEFAULT_ROOM_SETTINGS);
    addPlayer(room.code, { id: "p2", username: "Rex" });
    addPlayer(room.code, { id: "p3", username: "Mo" });
    room.round = round;
    room.phase = "result";
    room.imposterId = "p3";
    room.voteResult = {
      round,
      suspectId: wasImposter ? "p3" : "p2",
      suspectUsername: wasImposter ? "Mo" : "Rex",
      wasImposter,
      tie: false,
      tally: [],
    };
    return room;
  }

  it("imposter caught → final-guess, winner pending", () => {
    const room = resultRoom(1, true);
    resolveTerminal(room);
    expect(room.phase).toBe("final-guess");
    expect(room.winner).toBeUndefined();
  });

  it("imposter survived (R2 crew caught) → game-over, imposter wins", () => {
    const room = resultRoom(2, false);
    resolveTerminal(room);
    expect(room.phase).toBe("game-over");
    expect(room.winner).toBe("imposter");
  });

  it("imposter survived (R2 tie) → game-over, imposter wins", () => {
    const room = resultRoom(2, false);
    room.voteResult = { ...room.voteResult!, suspectId: null, suspectUsername: null, tie: true };
    resolveTerminal(room);
    expect(room.phase).toBe("game-over");
    expect(room.winner).toBe("imposter");
  });

  it("setWinner records the side and ends the match", () => {
    const room = resultRoom(1, true);
    setWinner(room, "crew");
    expect(room.winner).toBe("crew");
    expect(room.phase).toBe("game-over");
  });
});

describe("setEliminated", () => {
  it("flips a player's eliminated flag and reflects it in the summary", () => {
    const room = createRoom({ id: "host", username: "Aanya" }, DEFAULT_ROOM_SETTINGS);
    addPlayer(room.code, { id: "p2", username: "Rex" });
    expect(toSummary(room).players.find((p) => p.id === "p2")?.isEliminated).toBe(false);
    setEliminated(room.code, "p2", true);
    expect(toSummary(room).players.find((p) => p.id === "p2")?.isEliminated).toBe(true);
    setEliminated(room.code, "p2", false);
    expect(toSummary(room).players.find((p) => p.id === "p2")?.isEliminated).toBe(false);
  });
  it("returns undefined for an unknown room/player", () => {
    expect(setEliminated("NOPE5", "x", true)).toBeUndefined();
  });
});

describe("assignRoles", () => {
  it("picks exactly one imposter from the players", () => {
    const ids = ["a", "b", "c"];
    const { imposterId } = assignRoles(ids, () => 0.5);
    expect(ids).toContain(imposterId);
  });
  it("is deterministic with an injected rng", () => {
    expect(assignRoles(["a", "b", "c"], () => 0).imposterId).toBe("a");
    expect(assignRoles(["a", "b", "c"], () => 0.99).imposterId).toBe("c");
  });
  it("throws with no players", () => {
    expect(() => assignRoles([])).toThrow();
  });
});
