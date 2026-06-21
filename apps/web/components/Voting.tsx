"use client";

import { useEffect, useState } from "react";
import { type RoomSummary, type AckResponse } from "@wordspy/types";
import { Button } from "./Button";
import { Avatar } from "./Avatar";
import { getSocket } from "@/lib/socket";
import { playSfx } from "@/lib/sound";
import { useConnectionStore } from "@/store/connection";

/** Anonymous voting: pick a suspect, submit once (final), watch live progress. */
export function Voting({ room }: { room: RoomSummary }) {
  const myId = useConnectionStore((s) => s.socketId);
  const me = room.players.find((p) => p.id === myId);
  const active = room.players.filter((p) => !p.isEliminated);
  const targets = active.filter((p) => p.id !== myId);

  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eliminated = me?.isEliminated ?? false;

  // A new voting round (incl. a re-vote after a tie) resets the count to 0 —
  // unlock and clear the selection so the player can vote again.
  useEffect(() => {
    if (room.votesCast === 0) {
      setSubmitted(false);
      setSelected(null);
    }
  }, [room.votesCast]);

  const submit = () => {
    if (!selected) return;
    setError(null);
    getSocket().emit(
      "vote:cast",
      { code: room.code, targetId: selected },
      (res: AckResponse<RoomSummary>) => {
        if (res.ok) {
          setSubmitted(true);
          playSfx("vote");
        } else setError(res.error);
      },
    );
  };

  const progress = (
    <div className="border-[3px] border-ink bg-accent p-3 text-center" role="status" aria-live="polite">
      <span className="text-[10px] font-bold uppercase tracking-[1.5px]">votes in</span>
      <div className="text-[28px] uppercase leading-none" style={{ fontFamily: "var(--font-display)" }}>
        {room.votesCast} / {active.length}
      </div>
    </div>
  );

  if (eliminated) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] uppercase leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          Vote
        </h2>
        <p role="status" className="border-[3px] border-ink bg-imposter px-3 py-2 text-center text-[12px] font-extrabold uppercase text-white">
          Spectating — you&apos;re out
        </p>
        {progress}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[22px] uppercase leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
        Who&apos;s the imposter?
      </h2>
      {room.revote ? (
        <p role="status" className="border-[3px] border-ink bg-accent px-3 py-2 text-center text-[12px] font-extrabold uppercase">
          Tied — vote again
        </p>
      ) : (
        <p className="text-[12px] font-bold text-muted">One vote. No take-backs. Anonymous.</p>
      )}

      <div className="flex flex-col gap-2">
        {targets.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={submitted}
            aria-pressed={selected === p.id}
            onClick={() => setSelected(p.id)}
            className={[
              "flex min-h-[44px] items-center gap-2 border-[3px] border-ink px-3 text-left text-[14px] font-extrabold uppercase",
              "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ink",
              "disabled:opacity-50",
              selected === p.id ? "bg-imposter text-white" : "bg-surface text-ink",
            ].join(" ")}
          >
            <Avatar id={p.id} name={p.username} size={24} colorIndex={p.colorIndex} />
            <span>{p.username}</span>
            {p.isConnected === false && (
              <span className="text-[9px] font-bold normal-case text-muted">reconnecting…</span>
            )}
            {selected === p.id ? <span className="ml-auto">✓</span> : null}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="text-[12px] font-bold text-imposter">{error}</p>}

      {submitted ? (
        <p className="border-[3px] border-ink bg-crew px-3 py-2 text-center text-[12px] font-extrabold uppercase text-white">
          Vote locked
        </p>
      ) : (
        <Button variant="imposter" className="w-full" disabled={!selected} onClick={submit}>
          Submit vote
        </Button>
      )}

      {progress}
    </section>
  );
}
