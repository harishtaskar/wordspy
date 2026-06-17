"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import type { RoomSummary } from "@wordspy/types";
import { Button } from "./Button";
import { Avatar } from "./Avatar";
import { RoomSettingsEditor } from "./RoomSettingsEditor";
import { getSocket } from "@/lib/socket";
import { useConnectionStore } from "@/store/connection";

const MEDALS = ["🥇", "🥈", "🥉"];

/** End screen: confetti, winner, revealed word + imposter, podium + scoreboard, host rematch. */
export function WinnerReveal({ room }: { room: RoomSummary }) {
  const myId = useConnectionStore((s) => s.socketId);
  const isHost = room.hostId === myId;
  const crewWon = room.winner === "crew";
  const ranked = [...room.players].sort((a, b) => b.score - a.score);
  const podium = ranked.slice(0, 3);

  // Celebratory confetti, coloured by the winning side.
  useEffect(() => {
    const colors = crewWon ? ["#1763E8", "#FFD23F", "#0FA968"] : ["#FF5436", "#FFD23F", "#B967FF"];
    const burst = (particleRatio: number, opts: confetti.Options) =>
      confetti({ origin: { y: 0.6 }, colors, particleCount: Math.floor(200 * particleRatio), ...opts });
    burst(0.25, { spread: 26, startVelocity: 55 });
    burst(0.35, { spread: 60 });
    burst(0.2, { spread: 100, decay: 0.91, scalar: 0.8 });
    burst(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  }, [crewWon]);

  const [editing, setEditing] = useState(false);
  const cont = () => {
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

      {room.winReason === "imposter-left" && (
        <div role="status" className="border-[3px] border-ink bg-accent px-3 py-2 text-center">
          <p className="text-[13px] font-extrabold uppercase">🚪 The Imposter bailed</p>
          <p className="mt-1 text-[12px] font-bold">
            They quit mid-match — Crew wins by forfeit. No final guess.
          </p>
        </div>
      )}

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

      {/* Podium — top 3 by score */}
      <div className="border-[3px] border-ink bg-surface p-[14px] shadow-[var(--shadow-card)]">
        <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted">Podium</p>
        <ul className="mt-2 flex flex-col gap-2">
          {podium.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 border-2 border-ink bg-bg px-2 py-[6px]">
              <span className="text-[18px]">{MEDALS[i]}</span>
              <Avatar id={p.id} name={p.username} size={26} colorIndex={p.colorIndex} />
              <span className="text-[14px] font-bold">
                {p.username}
                {p.id === myId ? " (you)" : ""}
                {p.username === room.revealedImposter ? " 🕵" : ""}
              </span>
              <span className="ml-auto text-[16px]" style={{ fontFamily: "var(--font-display)" }}>
                +{p.score}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {ranked.length > 3 && (
        <div className="border-[3px] border-ink bg-surface p-[14px] shadow-[var(--shadow-card)]">
          <ul className="flex flex-col gap-1">
            {ranked.slice(3).map((p, i) => (
              <li key={p.id} className="flex items-center gap-2 text-[13px] font-bold">
                <span className="w-4 text-muted">{i + 4}</span>
                <Avatar id={p.id} name={p.username} size={22} colorIndex={p.colorIndex} />
                <span>{p.username}</span>
                <span className="ml-auto" style={{ fontFamily: "var(--font-display)" }}>+{p.score}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isHost ? (
        <div className="flex flex-col gap-2">
          <Button variant="primary" className="w-full" onClick={cont}>
            Continue ▸
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setEditing(true)}>
            Change Settings
          </Button>
        </div>
      ) : (
        <p className="text-center text-[12px] text-muted">Waiting for the host to continue…</p>
      )}

      {editing && <RoomSettingsEditor room={room} onClose={() => setEditing(false)} />}
    </section>
  );
}
