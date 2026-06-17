const AVATAR_COLORS = [
  "#1763E8", // blue
  "#FF5436", // orange-red
  "#0FA968", // green
  "#B967FF", // purple
  "#FF6EC7", // pink
  "#FFD23F", // yellow
  "#00B3A6", // teal
  "#F2762E", // amber
  "#8B5CF6", // violet
  "#E11D74", // magenta
];

/** Deterministic colour from an id (fallback when no stable index is known). */
export function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length] as string;
}

function colorFor(id: string, colorIndex?: number): string {
  if (colorIndex !== undefined) return AVATAR_COLORS[colorIndex % AVATAR_COLORS.length] as string;
  return avatarColor(id);
}

/** Netflix-style avatar: solid colour tile with the player's initial. */
export function Avatar({
  id,
  name,
  size = 28,
  colorIndex,
}: {
  id: string;
  name: string;
  size?: number;
  /** Stable per-player palette index (preferred — guarantees distinct colours). */
  colorIndex?: number;
}) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const bg = colorFor(id, colorIndex);
  const onYellow = bg === "#FFD23F";
  return (
    <span
      aria-hidden
      className="flex items-center justify-center border-2 border-ink font-extrabold uppercase"
      style={{
        width: size,
        height: size,
        background: bg,
        color: onYellow ? "#111" : "#fff",
        fontSize: Math.round(size * 0.45),
        flex: "0 0 auto",
        fontFamily: "var(--font-display)",
      }}
    >
      {initial}
    </span>
  );
}

/** Light tint of a player's avatar colour, for message backgrounds etc. */
export function avatarTint(id: string, colorIndex?: number): string {
  return `${colorFor(id, colorIndex)}1A`;
}
