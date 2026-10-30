import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "../cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, hint, error, className, id, ...rest }, ref) {
  const auto = useId();
  const inputId = id ?? auto;
  const noteId = `${inputId}-note`;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? noteId : undefined}
        className={cn(
          "h-10 w-full rounded-control border bg-bg/60 px-3 text-sm text-ink placeholder:text-muted/70",
          "transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30",
          "disabled:opacity-50",
          error ? "border-danger/60" : "border-line hover:border-line-strong",
          className
        )}
        {...rest}
      />
      {(error || hint) && (
        <p id={noteId} className={cn("text-xs", error ? "text-danger" : "text-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
