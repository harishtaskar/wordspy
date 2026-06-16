"use client";

import { useSocket } from "@/hooks/useSocket";
import { ConnectionIndicator } from "./ConnectionIndicator";

/**
 * Brutalist app shell + live connection. Mobile-first single column; desktop
 * centers the same ~420px column as a framed poster. [DESIGN.md Layout / EXPERIENCE.md Responsive]
 */
export function AppShell() {
  useSocket();

  return (
    <main className="min-h-dvh w-full bg-bg p-4">
      <div className="mx-auto flex w-full max-w-[420px] flex-col gap-4">
        <header className="flex items-center justify-between">
          <h1
            className="text-[24px] uppercase leading-none tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            wordspy
          </h1>
          <ConnectionIndicator />
        </header>

        <section className="border-[3px] border-ink bg-surface p-[14px] shadow-[var(--shadow-hero)]">
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted">
            Secret Word Agent
          </p>
          <p
            className="mt-1 text-[28px] uppercase leading-none tracking-tight text-crew"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Ready
          </p>
          <p className="mt-2 text-[13px]">
            Foundation online. Rooms, roles, and voting arrive in later stories.
          </p>
        </section>
      </div>
    </main>
  );
}
