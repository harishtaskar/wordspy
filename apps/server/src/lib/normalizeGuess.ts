/**
 * Normalize a word for forgiving comparison: trim, lowercase, strip everything
 * but letters/digits. So "Pizza", " pizza! ", "PIZZA" all compare equal.
 */
export function normalizeGuess(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}
