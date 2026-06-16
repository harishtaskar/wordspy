import { describe, it, expect } from "vitest";
import { CATEGORIES } from "@wordspy/types";
import { WORD_PACKS, enabledWords, CONCRETE_CATEGORIES } from "./packs.js";
import { pickWord } from "./pickWord.js";

describe("word packs", () => {
  it("every concrete category has enabled words", () => {
    for (const c of CONCRETE_CATEGORIES) {
      expect(WORD_PACKS[c].length).toBeGreaterThanOrEqual(8);
      expect(enabledWords(c).length).toBeGreaterThan(0);
    }
  });

  it("random unions every concrete pack", () => {
    const total = CONCRETE_CATEGORIES.reduce((n, c) => n + enabledWords(c).length, 0);
    expect(enabledWords("random").length).toBe(total);
  });

  it("never selects disabled words", () => {
    const used = new Set<string>();
    // Disable one word and confirm it is never returned across many picks.
    const food = WORD_PACKS.food;
    const target = food[0]!;
    target.enabled = false;
    try {
      for (let i = 0; i < 200; i++) {
        const w = pickWord("food", used);
        expect(w.word).not.toBe(target.word);
        if (used.size >= enabledWords("food").length) used.clear();
      }
    } finally {
      target.enabled = true; // restore for other tests
    }
  });

  it("CATEGORIES includes random plus the concrete ones", () => {
    expect(CATEGORIES).toContain("random");
    expect(CONCRETE_CATEGORIES).not.toContain("random" as never);
  });
});

describe("pickWord", () => {
  it("is deterministic with an injected rng", () => {
    const used = new Set<string>();
    const first = pickWord("food", used, () => 0); // index 0
    expect(first.word).toBe(enabledWords("food")[0]!.word);
    expect(used.has(first.word)).toBe(true);
  });

  it("does not repeat within a session until exhausted", () => {
    const used = new Set<string>();
    const seen = new Set<string>();
    const poolSize = enabledWords("food").length;
    for (let i = 0; i < poolSize; i++) {
      const w = pickWord("food", used);
      expect(seen.has(w.word)).toBe(false);
      seen.add(w.word);
    }
    expect(seen.size).toBe(poolSize);
  });

  it("resets and reuses once the pool is exhausted", () => {
    const used = new Set<string>();
    const poolSize = enabledWords("food").length;
    for (let i = 0; i < poolSize; i++) pickWord("food", used);
    // pool now exhausted; next pick should reset `used` and still return a word
    const next = pickWord("food", used);
    expect(next.word).toBeTruthy();
    expect(used.size).toBe(1); // reset, then added the new pick
  });

  it("throws when a category has zero enabled words", () => {
    const pack = WORD_PACKS.movies;
    const saved = pack.map((w) => w.enabled);
    pack.forEach((w) => (w.enabled = false));
    try {
      expect(() => pickWord("movies", new Set())).toThrow(/no enabled words/i);
    } finally {
      pack.forEach((w, i) => (w.enabled = saved[i]!));
    }
  });
});
