"use client";

import { useEffect, useRef, useState } from "react";
import { ReportIssueModal } from "./ReportIssueModal";
import { useRoomStore } from "@/store/room";

const GITHUB_URL = "https://github.com/harishtaskar";

/** Phases where a match is actively underway (report hidden to avoid mid-game taps). */
const IN_GAME_PHASES = new Set(["role-reveal", "discussion", "voting", "result", "final-guess"]);

/** Bottom-left info button → menu (Report an issue · GitHub). */
export function InfoMenu() {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Hide "Report an issue" once the game has started (lobby / game-over keep it).
  const phase = useRoomStore((s) => s.room?.phase);
  const canReport = !phase || !IN_GAME_PHASES.has(phase);

  // Close the menu on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <div ref={wrapRef} className="fixed bottom-4 left-4 z-40">
        {open && (
          <div
            role="menu"
            className="absolute bottom-[52px] left-0 flex w-[200px] flex-col border-[3px] border-ink bg-surface shadow-[var(--shadow-card)]"
          >
            {canReport && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setReporting(true);
                }}
                className="border-b-2 border-ink px-3 py-2 text-left text-[13px] font-bold hover:bg-accent focus-visible:bg-accent focus:outline-none"
              >
                🐞 Report an issue
              </button>
            )}
            <a
              role="menuitem"
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="px-3 py-2 text-left text-[13px] font-bold hover:bg-accent focus-visible:bg-accent focus:outline-none"
            >
              ⭐ Check out my GitHub
            </a>
          </div>
        )}

        <button
          type="button"
          aria-label="Info menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-11 w-11 items-center justify-center border-[3px] border-ink bg-surface text-[20px] font-extrabold shadow-[var(--shadow-button)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          ⓘ
        </button>
      </div>

      {reporting && <ReportIssueModal onClose={() => setReporting(false)} />}
    </>
  );
}
