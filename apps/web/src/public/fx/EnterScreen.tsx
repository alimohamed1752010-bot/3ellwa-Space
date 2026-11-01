import { useEffect, useRef, useState } from "react";

const KEY = "3w-entered";

/** Full-screen "click to enter" gate. Shown once per browser session; any click, Enter or Space opens the site. */
export default function EnterScreen({ text }: { text: string }) {
  const [open, setOpen] = useState(() => {
    try { return sessionStorage.getItem(KEY) !== "1"; } catch { return true; }
  });
  const [leaving, setLeaving] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    button.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  if (!open) return null;

  const enter = () => {
    try { sessionStorage.setItem(KEY, "1"); } catch { /* storage unavailable, the gate just shows again next visit */ }
    setLeaving(true);
    window.setTimeout(() => setOpen(false), 350);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome"
      onClick={enter}
      className={`fixed inset-0 z-50 grid cursor-pointer place-items-center bg-bg transition-opacity duration-300 ${leaving ? "opacity-0" : "opacity-100"}`}
    >
      <button ref={button} type="button" className="fx-enter-text rounded-control px-6 py-3 text-lg tracking-[0.3em] text-ink">
        {text}
      </button>
    </div>
  );
}