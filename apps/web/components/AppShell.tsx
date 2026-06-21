"use client";

import type { ReactNode } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useSoundController } from "@/hooks/useSoundController";
import { useRoleStore } from "@/store/role";
import { useRoomStore } from "@/store/room";
import { ConnectionIndicator } from "./ConnectionIndicator";
import { BackgroundDecor, type DecorTone } from "./BackgroundDecor";
import { InfoMenu } from "./InfoMenu";

/** Page wash behind the icon pattern, keyed to the player's current role. */
const TONE_BG: Record<DecorTone, string> = {
  neutral: "var(--color-bg)",
  crew: "#E8F0FE", // light blue
  imposter: "#FFE9E4", // light red
};

/**
 * Brutalist app frame: header (wordmark + live connection) + a centered column.
 * Mobile-first single column; desktop centers the same ~420px column as a
 * framed poster. [DESIGN.md Layout / EXPERIENCE.md Responsive]
 */
export function AppShell({ children }: { children: ReactNode }) {
  useSocket();
  useSoundController();
  const role = useRoleStore((s) => s.role);
  const phase = useRoomStore((s) => s.room?.phase);
  const tone: DecorTone = role?.role === "imposter" ? "imposter" : role?.role === "crew" ? "crew" : "neutral";
  // Discussion gets a roster column on big screens, so let it use a wider frame.
  const wide = phase === "discussion";

  return (
    <main
      className="relative flex min-h-dvh w-full items-center justify-center p-4 transition-colors duration-500"
      style={{ background: TONE_BG[tone] }}
    >
      <BackgroundDecor tone={tone} />
      <div
        className={[
          "relative z-10 flex w-full flex-col gap-4 transition-[max-width] duration-300",
          wide ? "max-w-[420px] lg:max-w-[760px]" : "max-w-[420px]",
        ].join(" ")}
      >
        <header className="flex flex-col items-center gap-2">
          <h1
            className="text-[44px] lowercase leading-none"
            style={{ fontFamily: "var(--font-logo)", textShadow: "3px 3px 0 #111" }}
          >
            <span className="text-crew">word</span>
            <span className="text-imposter">spy</span>
          </h1>
          <ConnectionIndicator />
        </header>
        {children}
      </div>
      <InfoMenu />
    </main>
  );
}
