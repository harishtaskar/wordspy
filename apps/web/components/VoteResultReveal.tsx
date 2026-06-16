"use client";

import type { RoomSummary } from "@wordspy/types";

/** Vote result reveal: suspect hero + per-target tally bars with counts. */
export function VoteResultReveal({ room }: { room: RoomSummary }) {
  const r = room.voteResult;

  if (!r) {
    return (
      <section className="border-[3px] border-ink bg-surface p-[14px] text-center shadow-[var(--shadow-card)]">
        <p className="text-[14px] font-bold uppercase">Resolving…</p>
      </section>
    );
  }

  const maxCount = r.tally.reduce((m, t) => Math.max(m, t.count), 0) || 1;
  const heroColour = r.tie ? "bg-accent text-ink" : r.wasImposter ? "bg-imposter text-white" : "bg-crew text-white";
  const heroTitle = r.tie ? "Tie — nobody out" : (r.suspectUsername ?? "—");
  const heroSub = r.tie ? "Vote was split" : r.wasImposter ? "Was the IMPOSTER 🎯" : "Was Crew";

  return (
    <section className="flex flex-col gap-3">
      <span className="self-center border-2 border-ink bg-crew px-2 py-[2px] text-[10px] font-extrabold uppercase text-white">
        Round {r.round} result
      </span>

      <div className={`border-[3px] border-ink p-6 text-center shadow-[var(--shadow-hero)] ${heroColour}`}>
        <div className="text-[34px] uppercase leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          {heroTitle}
        </div>
        <div className="mt-2 text-[12px] font-extrabold uppercase tracking-[1px]">{heroSub}</div>
      </div>

      <div className="border-[3px] border-ink bg-surface p-[14px] shadow-[var(--shadow-card)]">
        <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted">Tally</p>
        <ul className="mt-2 flex flex-col gap-2">
          {r.tally.length === 0 && <li className="text-[12px] text-muted">No votes.</li>}
          {r.tally.map((t) => (
            <li key={t.playerId}>
              <div className="flex justify-between text-[12px] font-bold">
                <span>{t.username}</span>
                <span>{t.count}</span>
              </div>
              <div
                className={`mt-[2px] h-[10px] border-2 border-ink ${t.playerId === r.suspectId ? (r.wasImposter ? "bg-imposter" : "bg-crew") : "bg-accent"}`}
                style={{ width: `${Math.max(8, (t.count / maxCount) * 100)}%` }}
                aria-label={`${t.username}: ${t.count} votes`}
              />
            </li>
          ))}
        </ul>
      </div>

      <p className="text-center text-[12px] text-muted">
        {r.round === 1 && !r.wasImposter ? "Round 2 starting…" : "Wrapping up…"}
      </p>
    </section>
  );
}
