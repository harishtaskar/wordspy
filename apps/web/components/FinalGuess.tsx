"use client";

import { useState } from "react";
import { type RoomSummary, type AckResponse } from "@wordspy/types";
import { Button } from "./Button";
import { Timer } from "./Timer";
import { getSocket } from "@/lib/socket";
import { useRoleStore } from "@/store/role";

/** The caught Imposter's last chance. Imposter sees the input; others wait. */
export function FinalGuess({ room }: { room: RoomSummary }) {
  const role = useRoleStore((s) => s.role);
  const isImposter = role?.role === "imposter";
  const [word, setWord] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    if (!word.trim() || submitted) return;
    setSubmitted(true);
    getSocket().emit("guess:submit", { code: room.code, word }, (_res: AckResponse<RoomSummary>) => {
      // The game-over broadcast drives the next screen; nothing to do on ack.
    });
  };

  return (
    <section className="flex flex-col items-center gap-3 text-center">
      <span className="border-2 border-ink bg-imposter px-2 py-[3px] text-[10px] font-extrabold uppercase text-white">
        Imposter&apos;s last chance
      </span>

      {isImposter ? (
        <>
          <h2 className="text-[22px] uppercase leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            What&apos;s the word?
          </h2>
          <p className="text-[12px] font-bold text-muted">Guess right, steal the win.</p>
          <Timer endsAt={room.phaseEndsAt} />
          <input
            aria-label="Final guess"
            value={word}
            disabled={submitted}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="TYPE THE WORD"
            className="w-full border-[3px] border-ink bg-surface px-3 py-2 text-center text-[22px] uppercase text-ink focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ink"
            style={{ fontFamily: "var(--font-display)" }}
          />
          <Button variant="imposter" className="w-full" disabled={!word.trim() || submitted} onClick={submit}>
            {submitted ? "Locked…" : "Lock in guess"}
          </Button>
        </>
      ) : (
        <>
          <h2 className="text-[20px] uppercase leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            They&apos;re guessing…
          </h2>
          <Timer endsAt={room.phaseEndsAt} />
          <p className="text-[13px] font-bold">The Imposter is taking their shot at the word.</p>
        </>
      )}
    </section>
  );
}
