import { useEffect, useState } from "react";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Rotating or typed subtitle. With reduced motion (or typing off and one phrase) it is plain static text. */
export default function TypingSubtitle({ phrases, typing }: { phrases: string[]; typing: boolean }) {
  const reduced = prefersReducedMotion();
  const animate = !reduced && phrases.length > 0 && (typing || phrases.length > 1);
  const [text, setText] = useState(animate && typing ? "" : phrases[0] ?? "");

  useEffect(() => {
    if (!animate) { setText(phrases[0] ?? ""); return; }
    let i = 0, n = 0, dead = false, timer = 0;
    const later = (fn: () => void, ms: number) => { timer = window.setTimeout(() => { if (!dead) fn(); }, ms); };
    if (!typing) {
      setText(phrases[0]);
      const rotate = () => { i = (i + 1) % phrases.length; setText(phrases[i]); later(rotate, 3500); };
      later(rotate, 3500);
    } else {
      const type = () => {
        const full = phrases[i];
        n++; setText(full.slice(0, n));
        if (n < full.length) return later(type, 60);
        if (phrases.length === 1) return; // a single phrase is typed once and stays
        later(erase, 1800);
      };
      const erase = () => {
        n--; setText(phrases[i].slice(0, n));
        if (n > 0) return later(erase, 30);
        i = (i + 1) % phrases.length;
        later(type, 350);
      };
      later(type, 300);
    }
    return () => { dead = true; window.clearTimeout(timer); };
  }, [animate, typing, phrases.join("\u0000")]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phrases.length === 0) return null;
  return (
    <p className="min-h-6 text-base text-accent-soft">
      <span className="sr-only">{phrases.join(". ")}</span>
      <span aria-hidden>{text}{animate && typing && <span className="ml-0.5 inline-block w-px animate-pulse bg-accent-soft align-middle">&nbsp;</span>}</span>
    </p>
  );
}
