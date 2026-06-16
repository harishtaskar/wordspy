export const USERNAME_MIN = 2;
export const USERNAME_MAX = 16;

/** Small starter blocklist — extend server-side later (ux_specifications.md §13). */
const BLOCKLIST = ["admin", "fuck", "shit", "bitch", "nigger", "cunt"];

export interface UsernameResult {
  ok: boolean;
  /** Normalized value (trimmed, internal whitespace collapsed). */
  value: string;
  error?: string;
}

/**
 * Validate + normalize a username. Pure — safe for tests and render-time use.
 * Allowed: letters, digits, space, underscore, hyphen. Length 2–16 after trim.
 */
export function validateUsername(raw: string): UsernameResult {
  const value = raw.trim().replace(/\s+/g, " ");

  if (value.length === 0) {
    return { ok: false, value, error: "Enter a name." };
  }
  if (value.length < USERNAME_MIN) {
    return { ok: false, value, error: `At least ${USERNAME_MIN} characters.` };
  }
  if (value.length > USERNAME_MAX) {
    return { ok: false, value, error: `At most ${USERNAME_MAX} characters.` };
  }
  if (!/^[A-Za-z0-9 _-]+$/.test(value)) {
    return { ok: false, value, error: "Letters, numbers, space, _ or - only." };
  }
  const lowered = value.toLowerCase();
  if (BLOCKLIST.some((bad) => lowered.includes(bad))) {
    return { ok: false, value, error: "Pick a different name." };
  }
  return { ok: true, value };
}
