const AVATAR_COLORS = [
  "#1763E8",
  "#FF5436",
  "#0FA968",
  "#B967FF",
  "#FF6EC7",
  "#FFD23F",
  "#00B3A6",
  "#F2762E",
];

/** Deterministic colour from an id, so a player keeps the same avatar. */
export function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length] as string;
}

/** Netflix-style avatar: solid colour tile with the player's initial. */
export function Avatar({
  id,
  name,
  size = 28,
}: {
  id: string;
  name: string;
  size?: number;
}) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const onYellow = avatarColor(id) === "#FFD23F";
  return (
    <span
      aria-hidden
      className="flex items-center justify-center border-2 border-ink font-extrabold uppercase"
      style={{
        width: size,
        height: size,
        background: avatarColor(id),
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
