"use client";

import { useEffect, useRef, useState } from "react";
import { CHAT_MAX_LENGTH, type RoomSummary } from "@wordspy/types";
import { Timer } from "./Timer";
import { Avatar, avatarTint } from "./Avatar";
import { getSocket } from "@/lib/socket";
import { useChatStore } from "@/store/chat";
import { useConnectionStore } from "@/store/connection";

/** Discussion phase: round, category, server timer, roster, and live chat. */
export function Discussion({ room }: { room: RoomSummary }) {
  const messages = useChatStore((s) => s.messages);
  const myId = useConnectionStore((s) => s.socketId);
  const [draft, setDraft] = useState("");
  const eliminated = room.players.find((p) => p.id === myId)?.isEliminated ?? false;

  // Auto-scroll the chat panel to the newest message.
  const feedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

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

      <div
        ref={feedRef}
        aria-label="Discussion chat"
        className="flex h-[44vh] min-h-[300px] flex-col overflow-y-auto border-[3px] border-ink bg-bg"
      >
        {messages.length === 0 && (
          <p className="m-auto text-[12px] text-muted">Drop a clue…</p>
        )}
        {messages.map((m, i) => {
          const mine = m.playerId === myId;
          const colorIndex = room.players.find((p) => p.id === m.playerId)?.colorIndex;
          return (
            <div
              key={`${m.ts}-${i}`}
              className="flex w-full items-center gap-2 border-b-2 border-ink px-3 py-2 last:border-b-0"
              style={{ background: mine ? "#FFF3C4" : avatarTint(m.playerId, colorIndex) }}
            >
              <Avatar id={m.playerId} name={m.username} size={28} colorIndex={colorIndex} />
              <div className="min-w-0 flex-1 gap-0">
                <span className="text-[12px] font-bold tracking-[1px] text-muted">
                  {mine ? `${m.username} (You)` : m.username}
                </span>
                <p className="break-words text-[14px] font-medium leading-snug">{m.text}</p>
              </div>
            </div>
          );
        })}
      </div>

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
