import type { HTMLAttributes } from "react";

type Elevation = "card" | "hero" | "none";

const shadow: Record<Elevation, string> = {
  card: "shadow-[var(--shadow-card)]",
  hero: "shadow-[var(--shadow-hero)]",
  none: "",
};

interface BoxProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: Elevation;
}

/** Brutalist container: 3px ink border, hard offset shadow, zero radius. [DESIGN.md Components] */
export function Box({ elevation = "card", className = "", children, ...rest }: BoxProps) {
  return (
    <div
      className={`border-[3px] border-ink bg-surface p-[14px] ${shadow[elevation] ?? shadow.card} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
