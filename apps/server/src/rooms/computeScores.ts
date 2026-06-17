import type { Room } from "./registry.js";

/** PRD §10 point values. */
export const POINTS = {
  crewWin: 150,
  crewCorrectVote: 100,
  crewSurviveRound: 20,
  imposterSurviveR1: 100,
  imposterSurviveR2: 200,
  imposterSteal: 300,
  imposterWin: 250,
} as const;

/**
 * Pure per-match scoring from the tracked room facts (PRD §10). Returns a map
 * of playerId → score. Called by `setWinner` at game-over.
 *
 * Intentional design choices (confirmed 2026-06-17, code review):
 *   - Crew survive-round is +20 PER round survived (so a 2-round survivor = +40),
 *     not a flat +20. Rewards lasting longer.
 *   - The crew win bonus (+150) goes to EVERY crew member when Crew wins,
 *     including those eliminated mid-match (team-win feel).
 */
export function computeScores(room: Room): Record<string, number> {
  const roundsPlayed = room.round;
  const caught = room.imposterCaughtRound;
  const out: Record<string, number> = {};

  for (const p of room.players.values()) {
    let s = 0;
    if (p.id === room.imposterId) {
      const survivedR1 = caught !== 1;
      const survivedR2 = survivedR1 && roundsPlayed >= 2 && caught !== 2;
      if (survivedR1) s += POINTS.imposterSurviveR1;
      if (survivedR2) s += POINTS.imposterSurviveR2;
      if (room.stole) s += POINTS.imposterSteal;
      if (room.winner === "imposter") s += POINTS.imposterWin;
    } else {
      if (room.winner === "crew") s += POINTS.crewWin;
      if (room.correctVoters.has(p.id)) s += POINTS.crewCorrectVote;
      const survived = p.eliminatedRound === undefined ? roundsPlayed : p.eliminatedRound - 1;
      s += POINTS.crewSurviveRound * Math.max(0, survived);
    }
    out[p.id] = s;
  }
  return out;
}
