export type Rng = () => number;

/**
 * Choose exactly one Imposter at random from the given player ids.
 * Pure given an injected `rng` (default Math.random) for deterministic tests.
 */
export function assignRoles(playerIds: string[], rng: Rng = Math.random): { imposterId: string } {
  if (playerIds.length === 0) {
    throw new Error("Cannot assign roles with no players");
  }
  const index = Math.floor(rng() * playerIds.length) % playerIds.length;
  return { imposterId: playerIds[index] as string };
}
