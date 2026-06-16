"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MIN_PLAYERS, type RoomSummary } from "@wordspy/types";
import { Button } from "./Button";
import { getSocket } from "@/lib/socket";
import { useConnectionStore } from "@/store/connection";
import { useRoomStore } from "@/store/room";

const AVATAR_COLORS = ["#1763E8", "#FF5436", "#0FA968", "#B967FF", "#FFD23F", "#FF6EC7"];

function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length] as string;
}

/** Lobby roster: players, host badge, ready, live count, ready toggle. */
export function Lobby({ room }: { room: RoomSummary }) {
  const router = useRouter();
  const myId = useConnectionStore((s) => s.socketId);
  const clearRoom = useRoomStore((s) => s.clearRoom);
  const me = room.players.find((p) => p.id === myId);

  // Surface a transient "you're host now" notice when host migrates to me.
  const prevHost = useRef(room.hostId);
  const [becameHost, setBecameHost] = useState(false);
  useEffect(() => {
    if (room.hostId !== prevHost.current) {
      if (myId && room.hostId === myId) {
        setBecameHost(true);
        const t = setTimeout(() => setBecameHost(false), 4000);
        return () => clearTimeout(t);
      }
      prevHost.current = room.hostId;
    }
  }, [room.hostId, myId]);

  const isHost = !!me?.isHost;

  const toggleReady = () => {
    if (!me) return;
    getSocket().emit("room:setReady", { code: room.code, ready: !me.isReady }, () => {});
  };
  const kick = (targetId: string) => {
    getSocket().emit("room:kick", { code: room.code, targetId }, () => {});
  };
  const start = () => {
    getSocket().emit("room:start", { code: room.code }, () => {});
  };
  const leave = () => {
    getSocket().emit("room:leave", { code: room.code });
    clearRoom();
    router.replace("/");
  };

  if (room.phase !== "lobby") {
    return (
      <section className="border-[3px] border-ink bg-crew p-[14px] text-center text-white shadow-[var(--shadow-hero)]">
        <p
          className="text-[24px] uppercase leading-none tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Game starting…
        </p>
        <p className="mt-2 text-[13px]">Revealing roles… (Story 2.3)</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      {becameHost && (
        <p role="status" className="border-[3px] border-ink bg-accent px-3 py-2 text-[12px] font-extrabold uppercase">
          You're the host now
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted">
          Players
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted" aria-live="polite">
          {room.players.length} / {room.settings.maxPlayers}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {room.players.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-2 border-[3px] border-ink bg-surface px-3 py-2 font-bold"
          >
            <span
              aria-hidden
              className="h-[26px] w-[26px] border-2 border-ink"
              style={{ background: avatarColor(p.id) }}
            />
            <span className="text-[14px]">
              {p.username}
              {p.id === myId ? " (you)" : ""}
            </span>
            {p.isHost && (
              <span className="border-2 border-ink bg-accent px-2 py-[2px] text-[10px] font-extrabold uppercase">
                Host
              </span>
            )}
            <span className="ml-auto text-[12px] font-extrabold uppercase">
              {p.isReady ? <span className="text-success">Ready ✓</span> : <span className="text-muted">…</span>}
            </span>
            {isHost && p.id !== myId && (
              <button
                type="button"
                aria-label={`Kick ${p.username}`}
                onClick={() => kick(p.id)}
                className="border-2 border-ink bg-imposter px-2 py-[2px] text-[10px] font-extrabold uppercase text-white focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ink"
              >
                Kick
              </button>
            )}
          </li>
        ))}
      </ul>

      {me && (
        <Button
          variant={me.isReady ? "ghost" : "crew"}
          className="w-full"
          aria-pressed={me.isReady}
          onClick={toggleReady}
        >
          {me.isReady ? "Not ready" : "I'm ready"}
        </Button>
      )}

      {isHost && (
        <div className="flex flex-col gap-1">
          <Button
            variant="primary"
            className="w-full"
            disabled={room.players.length < MIN_PLAYERS}
            onClick={start}
          >
            Start Game ▸
          </Button>
          {room.players.length < MIN_PLAYERS && (
            <p className="text-center text-[12px] font-bold text-muted">
              Need {MIN_PLAYERS}+ to start
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={leave}
        className="min-h-[44px] text-[12px] font-bold uppercase tracking-[1.5px] text-muted underline underline-offset-4 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ink"
      >
        Leave room
      </button>
    </section>
  );
}
