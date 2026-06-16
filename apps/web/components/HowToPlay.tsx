"use client";

import { useEffect, useRef } from "react";
import { Button } from "./Button";

const RULES: Array<[string, string]> = [
  ["The word", "Everyone gets the same secret word — except one Imposter, who gets nothing."],
  ["Discuss", "Drop clues about the word without saying it. The Imposter fakes it and hunts for the word."],
  ["Vote", "Two rounds. Vote out who you think is the Imposter — anonymous, one vote, no take-backs."],
  ["Final guess", "Catch the Imposter and they get one shot to name the word. Right = they steal the win."],
];

export function HowToPlay({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

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
      aria-label="How to play"
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
          How To Play
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {RULES.map(([title, body]) => (
            <li key={title} className="border-[3px] border-ink p-3">
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted">{title}</p>
              <p className="mt-1 text-[13px]">{body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Button ref={closeRef} variant="primary" className="w-full" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
