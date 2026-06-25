"use client";

import { useEffect, useRef, useState } from "react";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  DISCUSSION_TIMES,
  MAX_PLAYERS_OPTIONS,
  type Category,
  type RoomSettings,
  type RoomSummary,
  type AckResponse,
} from "@wordspy/types";
import { Button } from "./Button";
import { getSocket } from "@/lib/socket";

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
              "min-h-[40px] border-[3px] border-ink px-3 text-[12px] font-extrabold uppercase",
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

/** Host-only settings editor overlay (lobby or after a match). */
export function RoomSettingsEditor({ room, onClose }: { room: RoomSummary; onClose: () => void }) {
  const [settings, setSettings] = useState<RoomSettings>(room.settings);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const patch = (p: Partial<RoomSettings>) => setSettings((s) => ({ ...s, ...p }));

  const save = () => {
    getSocket().emit("room:updateSettings", { code: room.code, settings }, (res: AckResponse<RoomSummary>) => {
      if (res.ok) onClose();
      else setError(res.error);
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Room settings"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-[420px] flex-col gap-4 border-[3px] border-ink bg-surface p-[14px] shadow-[var(--shadow-hero)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[22px] uppercase leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          Room Settings
        </h2>

        <OptionRow label="Category" options={CATEGORIES} value={settings.category} onPick={(category) => patch({ category })} fmt={(v) => CATEGORY_LABELS[v as Category]} />
        <OptionRow
          label="Discussion time"
          options={DISCUSSION_TIMES}
          value={settings.discussionSeconds}
          onPick={(discussionSeconds) => patch({ discussionSeconds })}
          fmt={(v) => `${v}s`}
        />
        <OptionRow label="Max players" options={MAX_PLAYERS_OPTIONS} value={settings.maxPlayers} onPick={(maxPlayers) => patch({ maxPlayers })} />
        <OptionRow
          label="Visibility"
          options={["private", "public"] as const}
          value={settings.isPrivate ? "private" : "public"}
          onPick={(v) => patch({ isPrivate: v === "private" })}
        />

        {error && <p role="alert" className="text-[12px] font-bold text-imposter">{error}</p>}

        <div className="flex gap-2">
          <Button ref={closeRef} variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1" onClick={save}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
