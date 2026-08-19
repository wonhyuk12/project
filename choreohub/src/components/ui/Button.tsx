import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "ghost";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-light",
  outline:
    "border border-border bg-surface text-zinc-200 hover:bg-surface-hover",
  ghost: "text-muted hover:text-foreground",
};

export function Button({ variant = "primary", className = "", ...props }: Props) {
  return (
    <button
      className={`rounded-xl px-4 py-3 text-sm font-medium transition-colors active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
