import { describe, it, expect, beforeEach } from "vitest";
import { DEFAULT_ROOM_SETTINGS } from "@wordspy/types";
import { createRoom, addPlayer, setWinner, toSummary, _clearAllRooms, type Room } from "./registry.js";
import { computeScores } from "./computeScores.js";

beforeEach(() => _clearAllRooms());

function room3(): Room {
  const r = createRoom({ id: "imp", username: "Imp" }, DEFAULT_ROOM_SETTINGS);
  addPlayer(r.code, { id: "c1", username: "C1" });
  addPlayer(r.code, { id: "c2", username: "C2" });
  r.imposterId = "imp";
  return r;
}

describe("computeScores (PRD §10)", () => {
  it("Crew win R1: correct voters get win + correct-vote + survive", () => {
    const r = room3();
    r.round = 1;
    r.winner = "crew";
    r.imposterCaughtRound = 1;
    r.correctVoters = new Set(["c1", "c2"]);
    const s = computeScores(r);
    expect(s.c1).toBe(270); // 150 win + 100 correct + 20 survive(1 round)
    expect(s.c2).toBe(270);
    expect(s.imp).toBe(0); // caught R1, crew won
  });

  it("Imposter steal (caught R1, correct guess): big imposter score", () => {
    const r = room3();
    r.round = 1;
    r.winner = "imposter";
    r.imposterCaughtRound = 1;
    r.stole = true;
    const s = computeScores(r);
    expect(s.imp).toBe(550); // 300 steal + 250 win (no survival — caught R1)
  });

  it("Imposter survives both rounds: survival tiers + win", () => {
    const r = room3();
    r.round = 2;
    r.winner = "imposter";
    r.imposterCaughtRound = undefined; // never caught
    const s = computeScores(r);
    expect(s.imp).toBe(550); // 100 R1 + 200 R2 + 250 win
    expect(s.c1).toBe(40); // imposter won → no win bonus; survived 2 rounds
  });

  it("Crew win R2: eliminated-R1 crew still gets the win bonus, fewer survive points", () => {
    const r = room3();
    r.round = 2;
    r.winner = "crew";
    r.imposterCaughtRound = 2;
    const c1 = r.players.get("c1")!;
    c1.eliminated = true;
    c1.eliminatedRound = 1; // out in round 1
    const s = computeScores(r);
    expect(s.c1).toBe(150); // win only (survived 0 rounds)
    expect(s.c2).toBe(190); // 150 win + 40 survive(2 rounds)
    expect(s.imp).toBe(100); // survived R1 only (caught R2)
  });

  it("setWinner applies scores to players and they appear in the summary", () => {
    const r = room3();
    r.round = 1;
    r.imposterCaughtRound = 1;
    r.correctVoters = new Set(["c1"]);
    setWinner(r, "crew");
    expect(r.players.get("c1")?.score).toBe(270);
    expect(toSummary(r).players.find((p) => p.id === "c1")?.score).toBe(270);
  });
});
