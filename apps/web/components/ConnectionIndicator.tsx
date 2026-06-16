"use client";

import { useConnectionStore, type ConnectionStatus } from "@/store/connection";

const label: Record<ConnectionStatus, string> = {
  connecting: "CONNECTING…",
  connected: "CONNECTED",
  disconnected: "DISCONNECTED",
};

const tone: Record<ConnectionStatus, string> = {
  connecting: "bg-accent text-ink",
  connected: "bg-success text-white",
  disconnected: "bg-imposter text-white",
};

/** Live socket status pill, bound to the Zustand connection store. */
export function ConnectionIndicator() {
  const status = useConnectionStore((s) => s.status);
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-block border-2 border-ink px-[10px] py-[3px] text-[10px] font-extrabold uppercase tracking-[1.5px] ${tone[status] ?? tone.disconnected}`}
    >
      {label[status] ?? label.disconnected}
    </span>
  );
}
