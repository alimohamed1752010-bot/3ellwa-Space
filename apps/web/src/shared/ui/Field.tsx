import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../cn";

const control =
  "w-full rounded-control border bg-bg/60 px-3 text-sm text-ink placeholder:text-muted/70 transition-colors duration-150 " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 border-line hover:border-line-strong";

function Wrap({ id, label, hint, error, children }: { id: string; label?: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>}
      {children}
      {(error || hint) && <p id={`${id}-note`} className={cn("text-xs", error ? "text-danger" : "text-muted")}>{error ?? hint}</p>}
    </div>
  );
}

interface Common { label?: string; hint?: string; error?: string }

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & Common>(function Textarea({ label, hint, error, className, id, ...rest }, ref) {
  const auto = useId(); const tid = id ?? auto;
  return (
    <Wrap id={tid} label={label} hint={hint} error={error}>
      <textarea ref={ref} id={tid} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? `${tid}-note` : undefined} className={cn(control, "min-h-24 py-2", className)} {...rest} />
    </Wrap>
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & Common>(function Select({ label, hint, error, className, id, children, ...rest }, ref) {
  const auto = useId(); const sid = id ?? auto;
  return (
    <Wrap id={sid} label={label} hint={hint} error={error}>
      <select ref={ref} id={sid} aria-describedby={error || hint ? `${sid}-note` : undefined} className={cn(control, "h-10", className)} {...rest}>{children}</select>
    </Wrap>
  );
});

export function Checkbox({ label, hint, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-4 accent-[var(--color-accent)]" aria-describedby={hint ? `${id}-note` : undefined} {...rest} />
      <label htmlFor={id} className="text-sm text-ink">
        {label}
        {hint && <span id={`${id}-note`} className="block text-xs text-muted">{hint}</span>}
      </label>
    </div>
  );
}
