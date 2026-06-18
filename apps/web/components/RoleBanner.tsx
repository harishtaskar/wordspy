"use client";

import type { RolePayload } from "@wordspy/types";

/**
 * Persistent reminder shown the entire round so a player never loses track of
 * their job: Crew always see the secret word (highlighted); the Imposter is
 * reminded they must guess it from the clues. [Feature: always-on role banner]
 */
export function RoleBanner({ role }: { role: RolePayload }) {
  if (role.role === "imposter") {
    return (
      <div
        role="status"
        className="border-[3px] border-ink bg-imposter px-3 py-2 text-center text-white shadow-[var(--shadow-card)]"
      >
        <p className="text-[13px] font-bold leading-snug">
          You&apos;re the{" "}
          <span className="bg-white px-1 font-extrabold uppercase text-imposter">imposter</span> —
          guess the word from the crew&apos;s clues.
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="border-[3px] border-ink bg-crew px-3 py-2 text-center text-white shadow-[var(--shadow-card)]"
    >
      <p className="text-[13px] font-bold leading-snug">
        The word is{" "}
        <span
          className="bg-accent px-1 font-extrabold uppercase text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {role.word}
        </span>{" "}
        — drop a clue and find out who&apos;s the imposter.
      </p>
    </div>
  );
}
