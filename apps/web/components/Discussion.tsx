"use client";

import { useState } from "react";
import { CHAT_MAX_LENGTH, type RoomSummary } from "@wordspy/types";
import { Timer } from "./Timer";
import { getSocket } from "@/lib/socket";
import { useChatStore } from "@/store/chat";
import { useConnectionStore } from "@/store/connection";

/** Discussion phase: round, category, server timer, roster, and live chat. */
export function Discussion({ room }: { room: RoomSummary }) {
  const messages = useChatStore((s) => s.messages);
  const myId = useConnectionStore((s) => s.socketId);
  const [draft, setDraft] = useState("");
  const eliminated = room.players.find((p) => p.id === myId)?.isEliminated ?? false;

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    getSocket().emit("chat:send", { code: room.code, text });
    setDraft("");
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="border-2 border-ink bg-crew px-2 py-[2px] text-[10px] font-extrabold uppercase text-white">
          Round {room.round}
        </span>
        <span className="border-2 border-ink px-2 py-[2px] text-[10px] font-extrabold uppercase">
          {room.settings.category}
        </span>
      </div>

      <div className="flex flex-col items-center gap-1 border-[3px] border-ink bg-surface p-4 shadow-[var(--shadow-card)]">
        <Timer endsAt={room.phaseEndsAt} />
        <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted">discussion</span>
      </div>

      <ul className="flex max-h-[260px] flex-col gap-2 overflow-y-auto" aria-label="Discussion chat">
        {messages.length === 0 && (
          <li className="text-center text-[12px] text-muted">Drop a clue…</li>
        )}
        {messages.map((m, i) => (
          <li key={`${m.ts}-${i}`} className="border-[3px] border-ink bg-surface px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-[1px] text-muted">
              {m.username}
              {m.playerId === myId ? " (you)" : ""}
            </span>
            <p className="text-[13px] font-bold">{m.text}</p>
          </li>
        ))}
      </ul>

      {eliminated ? (
        <p
          role="status"
          className="border-[3px] border-ink bg-imposter px-3 py-2 text-center text-[12px] font-extrabold uppercase text-white"
        >
          Spectating — you&apos;re out
        </p>
      ) : (
        <div className="flex items-center gap-2 border-[3px] border-ink bg-surface px-3 py-2">
          <input
            aria-label="Message"
            value={draft}
            maxLength={CHAT_MAX_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Drop a clue…"
            className="flex-1 bg-transparent font-bold text-ink focus:outline-none"
          />
          <button
            type="button"
            aria-label="Send"
            onClick={send}
            className="text-[20px] font-extrabold text-crew focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ink"
          >
            ▸
          </button>
        </div>
      )}
    </section>
  );
}
