"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORIES,
  DISCUSSION_TIMES,
  MAX_PLAYERS_OPTIONS,
  DEFAULT_ROOM_SETTINGS,
  type RoomSettings,
  type AckResponse,
  type RoomSummary,
} from "@wordspy/types";
import { Button } from "./Button";
import { RoomView } from "./RoomView";
import { getSocket } from "@/lib/socket";
import { usePlayerSession } from "@/store/session";
import { useRoomStore } from "@/store/room";
import { validateUsername } from "@/lib/validateUsername";

function OptionRow<T extends string | number>({
  label,
  options,
  value,
  onPick,
  fmt = (v) => String(v),
}: {
  label: string;
  options: readonly T[];
  value: T;
  onPick: (v: T) => void;
  fmt?: (v: T) => string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={String(opt)}
            type="button"
            aria-pressed={opt === value}
            onClick={() => onPick(opt)}
            className={[
              "min-h-[44px] border-[3px] border-ink px-3 text-[12px] font-extrabold uppercase",
              "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ink",
              opt === value ? "bg-crew text-white" : "bg-surface text-ink",
            ].join(" ")}
          >
            {fmt(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CreateRoom() {
  const router = useRouter();
  const username = usePlayerSession((s) => s.username);
  const ensureSession = usePlayerSession((s) => s.ensureSession);
  const room = useRoomStore((s) => s.room);
  const setRoom = useRoomStore((s) => s.setRoom);

  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_ROOM_SETTINGS);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard: a valid username is required (Story 1.2). Redirect to Landing if absent.
  useEffect(() => {
    if (!validateUsername(username).ok) router.replace("/");
  }, [username, router]);

  // Make sure a stable session id exists before we can hold a reconnectable seat.
  useEffect(() => {
    ensureSession();
  }, [ensureSession]);

  if (room) return <RoomView room={room} />;

  const patch = (p: Partial<RoomSettings>) => setSettings((s) => ({ ...s, ...p }));

  const submit = () => {
    setError(null);
    setPending(true);
    ensureSession();
    const sessionId = usePlayerSession.getState().sessionId ?? "";
    getSocket().emit(
      "room:create",
      { username, settings, sessionId },
      (res: AckResponse<RoomSummary>) => {
        setPending(false);
        if (res.ok) setRoom(res.data);
        else setError(res.error);
      },
    );
  };

  return (
    <section className="flex flex-col gap-4">
      <h2
        className="text-[22px] uppercase leading-none tracking-tight"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Create Room
      </h2>

      <OptionRow
        label="Category"
        options={CATEGORIES}
        value={settings.category}
        onPick={(category) => patch({ category })}
      />
      <OptionRow
        label="Discussion time"
        options={DISCUSSION_TIMES}
        value={settings.discussionSeconds}
        onPick={(discussionSeconds) => patch({ discussionSeconds })}
        fmt={(v) => `${v}s`}
      />
      <OptionRow
        label="Max players"
        options={MAX_PLAYERS_OPTIONS}
        value={settings.maxPlayers}
        onPick={(maxPlayers) => patch({ maxPlayers })}
      />
      <OptionRow
        label="Visibility"
        options={["private", "public"] as const}
        value={settings.isPrivate ? "private" : "public"}
        onPick={(v) => patch({ isPrivate: v === "private" })}
      />

      {error && (
        <p role="alert" className="text-[12px] font-bold text-imposter">
          {error}
        </p>
      )}

      <Button variant="primary" className="w-full" disabled={pending} onClick={submit}>
        {pending ? "Creating…" : "Create Room ▸"}
      </Button>
    </section>
  );
}
