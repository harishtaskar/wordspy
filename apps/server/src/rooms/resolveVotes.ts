import type { VoteTally } from "@wordspy/types";

export interface VoteResolution {
  tally: VoteTally[];
  /** The unique most-voted player id, or null on a tie / no votes. */
  suspectId: string | null;
  tie: boolean;
}

/**
 * Pure tally. `votes` maps voterId → targetId. `nameOf` resolves a target id to
 * a display name. Returns aggregate counts (sorted desc) and the suspect: the
 * unique top scorer, or null when ≥2 share the top count (a tie).
 */
export function resolveVotes(
  votes: Map<string, string>,
  nameOf: (id: string) => string,
): VoteResolution {
  const counts = new Map<string, number>();
  for (const targetId of votes.values()) {
    counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
  }

  const tally: VoteTally[] = [...counts.entries()]
    .map(([playerId, count]) => ({ playerId, username: nameOf(playerId), count }))
    .sort((a, b) => b.count - a.count);

  if (tally.length === 0) {
    return { tally, suspectId: null, tie: false };
  }

  const top = tally[0]!.count;
  const leaders = tally.filter((t) => t.count === top);
  if (leaders.length === 1) {
    return { tally, suspectId: leaders[0]!.playerId, tie: false };
  }
  return { tally, suspectId: null, tie: true };
}
