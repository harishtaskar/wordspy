import type { ReactNode } from "react";

/* Uniform small game-themed line glyphs (stroke = currentColor, viewBox 32). */
const SIZE = 38;
const sw = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
const Svg = ({ children }: { children: ReactNode }) => (
  <svg width={SIZE} height={SIZE} viewBox="0 0 32 32">{children}</svg>
);

const ICONS: Array<() => ReactNode> = [
  () => <Svg><circle cx="13" cy="13" r="8" {...sw} /><line x1="19" y1="19" x2="27" y2="27" {...sw} /></Svg>, // magnifier
  () => <Svg><path d="M4 6h24v15H14l-6 5v-5H4z" {...sw} /></Svg>, // speech
  () => <Svg><path d="M5 9c0 11 5 17 11 17s11-6 11-17c-4-2-7-2.5-11-2.5S9 7 5 9z" {...sw} /><circle cx="11" cy="14" r="2" {...sw} /><circle cx="21" cy="14" r="2" {...sw} /></Svg>, // mask
  () => <Svg><path d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16z" {...sw} /><circle cx="16" cy="16" r="3.5" {...sw} /></Svg>, // eye
  () => <Svg><rect x="6" y="6" width="20" height="20" {...sw} /><path d="M11 17l4 4 7-9" {...sw} /></Svg>, // vote
  () => <Svg><path d="M10 11a6 6 0 1112 0c0 4-6 4-6 8" {...sw} /><circle cx="16" cy="26" r="1.4" fill="currentColor" /></Svg>, // question
  () => <Svg><circle cx="16" cy="16" r="11" {...sw} /><circle cx="16" cy="16" r="7" {...sw} /><circle cx="16" cy="16" r="3" {...sw} /></Svg>, // target
  () => <Svg><path d="M16 5a8 8 0 00-5 14v3h10v-3a8 8 0 00-5-14z" {...sw} /><line x1="13" y1="27" x2="19" y2="27" {...sw} /></Svg>, // lightbulb (clue)
  () => <Svg><circle cx="16" cy="16" r="11" {...sw} /><path d="M16 9v7l5 3" {...sw} /></Svg>, // clock
  () => <Svg><circle cx="11" cy="13" r="5" {...sw} /><path d="M15 17l9 9M22 24l3-3M19 21l3-3" {...sw} /></Svg>, // key
  () => <Svg><rect x="7" y="14" width="18" height="13" {...sw} /><path d="M11 14v-3a5 5 0 0110 0v3" {...sw} /></Svg>, // lock
  () => <Svg><path d="M5 11l5 6 6-9 6 9 5-6v14H5z" {...sw} /></Svg>, // crown
  () => <Svg><path d="M16 5l3 7 8 .6-6 5 2 7.4-7-4-7 4 2-7.4-6-5 8-.6z" {...sw} /></Svg>, // star
  () => <Svg><path d="M9 7v8a7 7 0 0014 0V7z" {...sw} /><path d="M9 9H5a3 3 0 003 5M23 9h4a3 3 0 01-3 5M13 25h6M11 28h10" {...sw} /></Svg>, // trophy
  () => <Svg><path d="M5 8h14v10H10l-5 4v-4H5z" {...sw} /><path d="M14 13h13v9h-3v3l-4-3" {...sw} /></Svg>, // chats
  () => <Svg><path d="M12 6c4 0 6 4 6 8s-1 7-4 7-3-3-6-3-3 4-3 0 1-12 7-12z" {...sw} /><circle cx="22" cy="13" r="2.5" {...sw} /><circle cx="24" cy="20" r="2" {...sw} /></Svg>, // fingerprint-ish
];

const COLS = 12;
const ROWS = 20;

export type DecorTone = "neutral" | "crew" | "imposter";

/** Icon ink colour per role tone (neutral = subtle gray on paper). */
const TONE_TEXT: Record<DecorTone, string> = {
  neutral: "text-ink/[0.06]",
  crew: "text-crew/[0.16]",
  imposter: "text-imposter/[0.16]",
};

/** Fixed, dense game-icon pattern; tinted by the player's role when in a match. */
export function BackgroundDecor({ tone = "neutral" }: { tone?: DecorTone }) {
  const cells: ReactNode[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const Icon = ICONS[i % ICONS.length]!;
      const offset = r % 2 === 0 ? 0 : 100 / COLS / 2; // brick-stagger
      const left = c * (100 / COLS) + offset + 2;
      const top = r * (100 / ROWS) + 3;
      const rot = ((i * 37) % 31) - 15; // deterministic jitter
      cells.push(
        <span
          key={i}
          className="absolute"
          style={{ top: `${top}vh`, left: `${left}vw`, transform: `rotate(${rot}deg)` }}
        >
          <Icon />
        </span>,
      );
    }
  }
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${TONE_TEXT[tone]}`}
    >
      {cells}
    </div>
  );
}
