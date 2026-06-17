"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type AckResponse, type PublicRoomInfo, type RoomSummary } from "@wordspy/types";
import { Button } from "./Button";
import { RoomView } from "./RoomView";
import { getSocket } from "@/lib/socket";
import { usePlayerSession } from "@/store/session";
import { useRoomStore } from "@/store/room";
import { validateUsername } from "@/lib/validateUsername";

/** Live directory of joinable public rooms. */
export function PublicRooms() {
  const router = useRouter();
  const username = usePlayerSession((s) => s.username);
  const room = useRoomStore((s) => s.room);
  const setRoom = useRoomStore((s) => s.setRoom);

  const [list, setList] = useState<PublicRoomInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);

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
    getSocket().emit("room:join", { code, username }, (res: AckResponse<RoomSummary>) => {
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

      {list.length === 0 ? (
        <p className="border-[3px] border-ink bg-surface p-4 text-center text-[13px] text-muted">
          No public games right now. Create one and make it public!
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((r) => {
            const full = r.players >= r.maxPlayers;
            return (
              <li
                key={r.code}
                className="flex items-center gap-2 border-[3px] border-ink bg-surface px-3 py-2 shadow-[var(--shadow-card)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-extrabold">{r.hostName}&apos;s room</p>
                  <p className="text-[10px] font-bold uppercase tracking-[1px] text-muted">
                    {r.category} · {r.players}/{r.maxPlayers}
                  </p>
                </div>
                <Button
                  variant="crew"
                  disabled={full || joining === r.code}
                  onClick={() => join(r.code)}
                >
                  {joining === r.code ? "…" : full ? "Full" : "Join"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

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
