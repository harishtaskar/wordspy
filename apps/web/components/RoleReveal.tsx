"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABELS, type RolePayload } from "@wordspy/types";
import { Button } from "./Button";
import { playSfx } from "@/lib/sound";

const AUTO_ADVANCE_SECONDS = 5;

/** Renders the per-socket role payload from Story 2.2. Crew see the word; Imposter never does. */
export function RoleReveal({ role, onDone }: { role: RolePayload; onDone: () => void }) {
  const [left, setLeft] = useState(AUTO_ADVANCE_SECONDS);

  // Sting on reveal.
  useEffect(() => {
    playSfx("reveal");
  }, []);

  useEffect(() => {
    if (left <= 0) {
      onDone();
      return;
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left, onDone]);

  const isImposter = role.role === "imposter";

  return (
    <section className="flex flex-col items-center gap-4 text-center">
      <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted">
        {isImposter ? "Your role" : "Your secret word"}
      </span>

      <div
        className={[
          "w-full border-[3px] border-ink p-7 text-white shadow-[var(--shadow-hero)]",
          isImposter ? "bg-imposter" : "bg-crew",
        ].join(" ")}
      >
        <div
          className="text-[40px] uppercase leading-none tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {isImposter ? "IMPOSTER" : role.word}
        </div>
        {/* Explicit role label so role is never conveyed by colour alone. */}
        <div className="mt-3 text-[11px] font-extrabold uppercase tracking-[1.5px]">
          {isImposter ? "You are the Imposter" : "You are Crew"}
        </div>
      </div>

      {isImposter ? (
        <>
          <span className="inline-block border-2 border-ink bg-accent px-2 py-[3px] text-[10px] font-extrabold uppercase">
            Category: {CATEGORY_LABELS[role.category]}
          </span>
          <p className="text-[13px] font-bold">No word for you. Blend in, find the word, survive.</p>
        </>
      ) : (
        <p className="text-[13px] font-bold">Drop clues. Don&apos;t say the word. Find the imposter.</p>
      )}

      <div
        className="text-[28px] uppercase leading-none"
        style={{ fontFamily: "var(--font-display)" }}
      >
        0:0{Math.max(0, left)}
      </div>
      <Button variant={isImposter ? "imposter" : "crew"} className="w-full" onClick={onDone}>
        Continue ▸
      </Button>
    </section>
  );
}
