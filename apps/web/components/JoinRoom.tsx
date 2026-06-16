"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type AckResponse,
  type RoomSummary,
} from "@wordspy/types";
import { Button } from "./Button";
import { RoomView } from "./RoomView";
import { getSocket } from "@/lib/socket";
import { usePlayerSession } from "@/store/session";
import { useRoomStore } from "@/store/room";
import { validateUsername } from "@/lib/validateUsername";

const CODE_LENGTH = 5;

export function JoinRoom() {
  const router = useRouter();
  const params = useSearchParams();
  const username = usePlayerSession((s) => s.username);
  const room = useRoomStore((s) => s.room);
  const setRoom = useRoomStore((s) => s.setRoom);

  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from a share link (?room=CODE).
  useEffect(() => {
    const fromLink = params.get("room");
    if (fromLink) setCode(fromLink.toUpperCase().slice(0, CODE_LENGTH));
  }, [params]);

  // Guard: a valid username is required (Story 1.2).
  useEffect(() => {
    if (!validateUsername(username).ok) router.replace("/");
  }, [username, router]);

  if (room) return <RoomView room={room} />;

  const canSubmit = code.length === CODE_LENGTH && !pending;

  const submit = () => {
    setError(null);
    setPending(true);
    getSocket().emit("room:join", { code, username }, (res: AckResponse<RoomSummary>) => {
      setPending(false);
      if (res.ok) setRoom(res.data);
      else setError(res.error);
    });
  };

  return (
    <section className="flex flex-col gap-4">
      <h2
        className="text-[22px] uppercase leading-none tracking-tight"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Join Room
      </h2>

      <div className="flex flex-col gap-1">
        <label htmlFor="code" className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted">
          Room code
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, "").slice(0, CODE_LENGTH))}
          placeholder="ABCDE"
          autoComplete="off"
          autoCapitalize="characters"
          className="min-h-[44px] border-[3px] border-ink bg-surface px-3 text-[20px] font-extrabold uppercase tracking-[4px] text-ink focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ink"
          style={{ fontFamily: "var(--font-display)" }}
        />
      </div>

      {error && (
        <p role="alert" className="text-[12px] font-bold text-imposter">
          {error}
        </p>
      )}

      <Button variant="primary" className="w-full" disabled={!canSubmit} onClick={submit}>
        {pending ? "Joining…" : "Join ▸"}
      </Button>

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
