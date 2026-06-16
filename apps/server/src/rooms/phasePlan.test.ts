import { describe, it, expect } from "vitest";
import { DEFAULT_ROOM_SETTINGS } from "@wordspy/types";
import { phasePlan, ROLE_REVEAL_SECONDS } from "./phasePlan.js";

describe("phasePlan", () => {
  it("role-reveal → discussion after the reveal window", () => {
    expect(phasePlan("role-reveal", DEFAULT_ROOM_SETTINGS)).toEqual({
      next: "discussion",
      durationMs: ROLE_REVEAL_SECONDS * 1000,
    });
  });

  it("discussion → voting after the configured duration", () => {
    const settings = { ...DEFAULT_ROOM_SETTINGS, discussionSeconds: 120 as const };
    expect(phasePlan("discussion", settings)).toEqual({ next: "voting", durationMs: 120_000 });
  });

  it("lobby and voting have no auto-advance", () => {
    expect(phasePlan("lobby", DEFAULT_ROOM_SETTINGS)).toBeNull();
    expect(phasePlan("voting", DEFAULT_ROOM_SETTINGS)).toBeNull();
  });
});
