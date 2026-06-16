import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "crew" | "imposter" | "ghost";

const variantClass: Record<Variant, string> = {
  primary: "bg-accent text-ink",
  crew: "bg-crew text-white",
  imposter: "bg-imposter text-white",
  ghost: "bg-surface text-ink",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/**
 * Brutalist button: 3px ink border, hard shadow, uppercase 800.
 * Press collapses the shadow and nudges +2,+2 (stamp feel). [DESIGN.md Components]
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={[
        "border-[3px] border-ink px-4 py-3 font-extrabold uppercase tracking-tight",
        "shadow-[var(--shadow-button)] transition-all",
        "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ink",
        "min-h-[44px]",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
        variantClass[variant] ?? variantClass.primary,
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
});
