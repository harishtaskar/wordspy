"use client";

import { useEffect, useRef } from "react";
import { Button } from "./Button";
import { useSettings } from "@/store/settings";

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between border-[3px] border-ink bg-surface px-3 py-2">
      <span className="text-[13px] font-bold">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={[
          "min-h-[36px] min-w-[72px] border-[3px] border-ink px-3 text-[11px] font-extrabold uppercase",
          "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ink",
          checked ? "bg-success text-white" : "bg-surface text-ink",
        ].join(" ")}
      >
        {checked ? "On" : "Off"}
      </button>
    </div>
  );
}

export function Settings({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const soundEnabled = useSettings((s) => s.soundEnabled);
  const musicEnabled = useSettings((s) => s.musicEnabled);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const setSoundEnabled = useSettings((s) => s.setSoundEnabled);
  const setMusicEnabled = useSettings((s) => s.setMusicEnabled);
  const setReducedMotion = useSettings((s) => s.setReducedMotion);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] border-[3px] border-ink bg-surface p-[14px] shadow-[var(--shadow-hero)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-[22px] uppercase leading-none tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Settings
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          <Toggle label="Sound effects" checked={soundEnabled} onChange={setSoundEnabled} />
          <Toggle label="Background music" checked={musicEnabled} onChange={setMusicEnabled} />
          <Toggle label="Reduced motion" checked={reducedMotion} onChange={setReducedMotion} />
        </div>
        <Button ref={closeRef} variant="primary" className="mt-4 w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
