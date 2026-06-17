"use client";

import type { ReactNode } from "react";
import { useSocket } from "@/hooks/useSocket";
import { ConnectionIndicator } from "./ConnectionIndicator";
import { BackgroundDecor } from "./BackgroundDecor";

/**
 * Brutalist app frame: header (wordmark + live connection) + a centered column.
 * Mobile-first single column; desktop centers the same ~420px column as a
 * framed poster. [DESIGN.md Layout / EXPERIENCE.md Responsive]
 */
export function AppShell({ children }: { children: ReactNode }) {
  useSocket();

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center bg-bg p-4">
      <BackgroundDecor />
      <div className="relative z-10 flex w-full max-w-[420px] flex-col gap-4">
        <header className="flex items-center justify-between">
          <h1
            className="text-[24px] uppercase leading-none tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            wordspy
          </h1>
          <ConnectionIndicator />
        </header>
        {children}
      </div>
    </main>
  );
}
