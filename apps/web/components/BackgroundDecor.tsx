import type { ReactNode } from "react";

/* Simple line-icon glyphs (stroke = currentColor). Game-themed. */
const S = 40;
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Magnifier() {
  return (
    <svg width={S} height={S} viewBox="0 0 40 40"><circle cx="16" cy="16" r="10" {...stroke} /><line x1="23" y1="23" x2="34" y2="34" {...stroke} /></svg>
  );
}
function Speech() {
  return (
    <svg width={S} height={S} viewBox="0 0 40 40"><path d="M5 7h30v20H17l-8 7v-7H5z" {...stroke} /></svg>
  );
}
function Mask() {
  return (
    <svg width={S} height={S} viewBox="0 0 40 40"><path d="M6 10c0 14 6 22 14 22s14-8 14-22c-5-2-9-3-14-3s-9 1-14 3z" {...stroke} /><circle cx="14" cy="17" r="2.5" {...stroke} /><circle cx="26" cy="17" r="2.5" {...stroke} /></svg>
  );
}
function Question() {
  return (
    <svg width={S} height={S} viewBox="0 0 40 40"><path d="M13 14a7 7 0 1114 0c0 5-7 5-7 10" {...stroke} /><circle cx="20" cy="32" r="1.6" fill="currentColor" /></svg>
  );
}
function Eye() {
  return (
    <svg width={S} height={S} viewBox="0 0 40 40"><path d="M4 20s6-10 16-10 16 10 16 10-6 10-16 10S4 20 4 20z" {...stroke} /><circle cx="20" cy="20" r="4" {...stroke} /></svg>
  );
}
function Vote() {
  return (
    <svg width={S} height={S} viewBox="0 0 40 40"><rect x="7" y="7" width="26" height="26" {...stroke} /><path d="M13 21l5 5 9-11" {...stroke} /></svg>
  );
}

/** position: [topVh, leftVw, size, rotateDeg] */
const PLACES: Array<[number, number, number, number, () => ReactNode]> = [
  [6, 8, 1.3, -12, Magnifier],
  [12, 78, 1, 14, Speech],
  [22, 40, 0.8, -6, Question],
  [30, 14, 1.1, 8, Mask],
  [34, 88, 0.9, -18, Eye],
  [46, 60, 1.2, 10, Vote],
  [52, 22, 0.85, -10, Speech],
  [58, 82, 1, 16, Magnifier],
  [66, 46, 1.15, -8, Mask],
  [72, 10, 0.9, 12, Question],
  [78, 70, 1.05, -14, Eye],
  [86, 32, 1, 6, Vote],
  [90, 90, 0.8, -10, Speech],
  [16, 56, 0.8, 20, Vote],
  [42, 6, 0.95, -16, Eye],
  [62, 92, 0.85, 8, Question],
  [82, 52, 0.9, -6, Magnifier],
  [4, 44, 0.85, 10, Mask],
];

/** Fixed, subtle light-gray game-icon pattern behind all content (paper bg unchanged). */
export function BackgroundDecor() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden text-ink/[0.05]">
      {PLACES.map(([top, left, scale, rot, Icon], i) => (
        <span
          key={i}
          className="absolute"
          style={{ top: `${top}vh`, left: `${left}vw`, transform: `rotate(${rot}deg) scale(${scale})` }}
        >
          <Icon />
        </span>
      ))}
    </div>
  );
}
