"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORY_LABELS,
  type AckResponse,
  type PublicRoomInfo,
  type RoomSummary,
} from "@wordspy/types";
import { Button } from "./Button";
import { RoomView } from "./RoomView";
import { getSocket } from "@/lib/socket";
import { usePlayerSession } from "@/store/session";
import { useRoomStore } from "@/store/room";
import { validateUsername } from "@/lib/validateUsername";

type RoomStatus = "waiting" | "in-progress" | "full";
type StatusFilter = "all" | "waiting" | "in-progress";

/** Derive the display status + open seats for a room card. */
function roomStatus(r: PublicRoomInfo): { status: RoomStatus; seats: number } {
  const seats = Math.max(0, r.maxPlayers - r.players);
  if (seats <= 0) return { status: "full", seats };
  if (r.phase === "lobby") return { status: "waiting", seats };
  return { status: "in-progress", seats };
}

const STATUS_BADGE: Record<RoomStatus, { label: string; cls: string }> = {
  waiting: { label: "Waiting", cls: "bg-success text-white" },
  "in-progress": { label: "In Progress", cls: "bg-accent text-ink" },
  full: { label: "Room Full", cls: "bg-imposter text-white" },
};

/** Live directory of public rooms (any state). */
export function PublicRooms() {
  const router = useRouter();
  const username = usePlayerSession((s) => s.username);
  const ensureSession = usePlayerSession((s) => s.ensureSession);
  const room = useRoomStore((s) => s.room);
  const setRoom = useRoomStore((s) => s.setRoom);

  const [list, setList] = useState<PublicRoomInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");

  // Need a name to join — bounce back to Landing if missing.
  useEffect(() => {
    if (!validateUsername(username).ok) router.replace("/");
  }, [username, router]);

  // Subscribe to the live directory.
  useEffect(() => {
    const socket = getSocket();
    const onRooms = (rooms: PublicRoomInfo[]) => setList(rooms);
    socket.on("public:rooms", onRooms);
    socket.emit("room:browseJoin", (res: AckResponse<PublicRoomInfo[]>) => {
      if (res.ok) setList(res.data);
    });
    return () => {
      socket.off("public:rooms", onRooms);
      socket.emit("room:browseLeave");
    };
  }, []);

  if (room) return <RoomView room={room} />;

  const join = (code: string) => {
    setError(null);
    setJoining(code);
    ensureSession();
    const sessionId = usePlayerSession.getState().sessionId ?? "";
    getSocket().emit("room:join", { code, username, sessionId }, (res: AckResponse<RoomSummary>) => {
      setJoining(null);
      if (res.ok) {
        getSocket().emit("room:browseLeave");
        setRoom(res.data);
      } else {
        setError(res.error); // e.g. filled/started just now — list will refresh
      }
    });
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[22px] uppercase leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
        Public games
      </h2>

      {error && <p role="alert" className="text-[12px] font-bold text-imposter">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {(["all", "waiting", "in-progress"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={[
              "min-h-[36px] border-[3px] border-ink px-3 text-[11px] font-extrabold uppercase tracking-[1px]",
              "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ink",
              filter === f ? "bg-crew text-white" : "bg-surface text-ink",
            ].join(" ")}
          >
            {f === "all" ? "All" : f === "waiting" ? "Waiting" : "In Progress"}
          </button>
        ))}
      </div>

      {(() => {
        const shown = list.filter((r) => {
          if (filter === "all") return true;
          return roomStatus(r).status === filter;
        });
        if (shown.length === 0) {
          return (
            <p className="border-[3px] border-ink bg-surface p-4 text-center text-[13px] text-muted">
              No public games here right now. Create one and make it public!
            </p>
          );
        }
        return (
          <ul className="flex flex-col gap-2">
            {shown.map((r) => {
              const { status, seats } = roomStatus(r);
              const badge = STATUS_BADGE[status];
              const joinable = seats > 0;
              const spectate = joinable && r.phase !== "lobby";
              return (
                <li
                  key={r.code}
                  className="flex items-center gap-2 border-[3px] border-ink bg-surface px-3 py-2 shadow-[var(--shadow-card)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-extrabold">{r.hostName}&apos;s room</p>
                    <p className="text-[10px] font-bold uppercase tracking-[1px] text-muted">
                      {CATEGORY_LABELS[r.category]} · {r.players}/{r.maxPlayers}
                      {joinable ? ` · ${seats} seat${seats === 1 ? "" : "s"} open` : ""}
                      {status === "in-progress" && r.round > 1 ? ` · Round ${r.round}` : ""}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`border-2 border-ink px-2 py-[1px] text-[9px] font-extrabold uppercase ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {spectate && (
                        <span className="text-[9px] font-bold uppercase tracking-[1px] text-muted">
                          Join as spectator · play next round
                        </span>
                      )}
                    </div>
                  </div>
                  {joinable ? (
                    <Button variant="crew" disabled={joining === r.code} onClick={() => join(r.code)}>
                      {joining === r.code ? "…" : spectate ? "Spectate" : "Join"}
                    </Button>
                  ) : (
                    <span className="border-2 border-ink bg-imposter px-2 py-[3px] text-[10px] font-extrabold uppercase text-white">
                      Full
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        );
      })()}

      <button
        type="button"
        onClick={() => router.replace("/")}
        className="min-h-[44px] text-[12px] font-bold uppercase tracking-[1.5px] text-muted underline underline-offset-4 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ink"
      >
        ← Back
      </button>
    </section>
  );
}
