import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong shadow-[0_0_0_1px_rgb(167_139_250/0.35),0_6px_18px_-8px_rgb(139_92_246/0.7)]",
  secondary: "bg-raised text-ink border border-line hover:border-line-strong hover:bg-[#201c2d]",
  ghost: "text-muted hover:text-ink hover:bg-raised",
  danger: "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20",
};
const sizes: Record<Size, string> = { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm" };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, disabled, className, children, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {loading && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
});
