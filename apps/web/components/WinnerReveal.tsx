"use client";

import type { RoomSummary } from "@wordspy/types";
import { Button } from "./Button";
import { getSocket } from "@/lib/socket";
import { useConnectionStore } from "@/store/connection";

/** End screen: winner, revealed word, imposter identity, scoreboard, host rematch. */
export function WinnerReveal({ room }: { room: RoomSummary }) {
  const myId = useConnectionStore((s) => s.socketId);
  const isHost = room.hostId === myId;
  const crewWon = room.winner === "crew";
  const ranked = [...room.players].sort((a, b) => b.score - a.score);

  const playAgain = () => {
    getSocket().emit("room:playAgain", { code: room.code }, () => {});
  };

  return (
    <section className="flex flex-col gap-3">
      <div
        className={`border-[3px] border-ink p-6 text-center text-white shadow-[var(--shadow-hero)] ${crewWon ? "bg-crew" : "bg-imposter"}`}
      >
        <p className="text-[10px] font-bold uppercase tracking-[1.5px] opacity-80">Winner</p>
        <p className="mt-1 text-[34px] uppercase leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          {crewWon ? "Crew wins" : "Imposter wins"}
        </p>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 border-[3px] border-ink bg-surface p-3 text-center shadow-[var(--shadow-card)]">
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted">The word</p>
          <p className="mt-1 text-[20px] uppercase leading-none text-crew" style={{ fontFamily: "var(--font-display)" }}>
            {room.revealedWord ?? "—"}
          </p>
        </div>
        <div className="flex-1 border-[3px] border-ink bg-surface p-3 text-center shadow-[var(--shadow-card)]">
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted">Imposter</p>
          <p className="mt-1 text-[18px] uppercase leading-none text-imposter" style={{ fontFamily: "var(--font-display)" }}>
            {room.revealedImposter ?? "—"}
          </p>
        </div>
      </div>

      <div className="border-[3px] border-ink bg-surface p-[14px] shadow-[var(--shadow-card)]">
        <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted">Scores</p>
        <ul className="mt-2 flex flex-col gap-1">
          {ranked.map((p) => (
            <li key={p.id} className="flex justify-between text-[14px] font-bold">
              <span>
                {p.username}
                {p.username === room.revealedImposter ? " 🕵" : ""}
              </span>
              <span style={{ fontFamily: "var(--font-display)" }}>+{p.score}</span>
            </li>
          ))}
        </ul>
      </div>

      {isHost ? (
        <Button variant="primary" className="w-full" onClick={playAgain}>
          Play Again ↻
        </Button>
      ) : (
        <p className="text-center text-[12px] text-muted">Waiting for the host to restart…</p>
      )}
    </section>
  );
}
