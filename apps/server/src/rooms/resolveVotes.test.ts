import { describe, it, expect } from "vitest";
import { resolveVotes } from "./resolveVotes.js";

const name = (id: string) => ({ a: "Aanya", b: "Rex", c: "Mo" })[id] ?? id;

describe("resolveVotes", () => {
  it("picks the unique top scorer as suspect", () => {
    const votes = new Map([
      ["v1", "a"],
      ["v2", "a"],
      ["v3", "b"],
    ]);
    const r = resolveVotes(votes, name);
    expect(r.suspectId).toBe("a");
    expect(r.tie).toBe(false);
    expect(r.tally[0]).toEqual({ playerId: "a", username: "Aanya", count: 2 });
  });

  it("flags a tie when two share the top count", () => {
    const votes = new Map([
      ["v1", "a"],
      ["v2", "b"],
    ]);
    const r = resolveVotes(votes, name);
    expect(r.suspectId).toBeNull();
    expect(r.tie).toBe(true);
  });

  it("handles no votes", () => {
    const r = resolveVotes(new Map(), name);
    expect(r.tally).toEqual([]);
    expect(r.suspectId).toBeNull();
    expect(r.tie).toBe(false);
  });
});
