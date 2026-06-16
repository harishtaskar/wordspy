import type { Category } from "@wordspy/types";
import { enabledWords, type WordEntry } from "./packs.js";

export type Rng = () => number;

/**
 * Pick a random enabled word for a category that hasn't been used this session.
 * When every enabled word has been used, the `used` set is cleared and selection
 * restarts (pool reset). Throws only if the category has zero enabled words.
 *
 * `rng` is injectable for deterministic tests (defaults to Math.random).
 * The chosen word is added to `used` as a side effect.
 */
export function pickWord(category: Category, used: Set<string>, rng: Rng = Math.random): WordEntry {
  const pool = enabledWords(category);
  if (pool.length === 0) {
    throw new Error(`No enabled words for category "${category}"`);
  }

  let available = pool.filter((w) => !used.has(w.word));
  if (available.length === 0) {
    // Whole pool exhausted this session — reset and reuse.
    used.clear();
    available = pool;
  }

  const index = Math.floor(rng() * available.length) % available.length;
  const choice = available[index] as WordEntry;
  used.add(choice.word);
  return choice;
}
