import type { RoomPhase, RoomSettings } from "@wordspy/types";

/** Seconds the role reveal is shown before discussion auto-starts. */
export const ROLE_REVEAL_SECONDS = 5;

export interface PhaseStep {
  next: RoomPhase;
  durationMs: number;
}

/**
 * Pure FSM step: given the current phase + room settings, what phase comes next
 * and how long the current phase lasts. `null` means no auto-advance (the phase
 * is ended by something else — e.g. voting, owned by Epic 3).
 */
export function phasePlan(phase: RoomPhase, settings: RoomSettings): PhaseStep | null {
  switch (phase) {
    case "role-reveal":
      return { next: "discussion", durationMs: ROLE_REVEAL_SECONDS * 1000 };
    case "discussion":
      return { next: "voting", durationMs: settings.discussionSeconds * 1000 };
    case "lobby":
    case "voting":
    case "result":
    case "final-guess":
    case "game-over":
      return null;
  }
}
