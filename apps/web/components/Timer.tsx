"use client";

import { useEffect, useState } from "react";

function fmt(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Renders a countdown to a server-provided `endsAt` (epoch ms). Purely visual —
 * it never ends the phase; the server does. Reconciles whenever `endsAt` changes
 * (i.e. on the next `room:state`). Turns the danger colour under 10s.
 */
export function Timer({ endsAt }: { endsAt?: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === undefined) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  if (endsAt === undefined) return null;

  const remaining = endsAt - now;
  const urgent = remaining <= 10_000;

  return (
    <div
      role="timer"
      aria-live="polite"
      className={`text-[40px] uppercase leading-none ${urgent ? "text-imposter" : "text-ink"}`}
      style={{ fontFamily: "var(--font-display)" }}
    >
      {fmt(remaining)}
    </div>
  );
}
