import { useEffect, useRef } from "react";
import { canAnimate, hasFinePointer } from "./motion";

/** A soft light that follows the mouse. Desktop pointers only, off for reduced motion. */
export default function CursorGlow({ color }: { color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasFinePointer() || !canAnimate()) return;
    let raf = 0, x = 0, y = 0;
    const move = (e: PointerEvent) => {
      x = e.clientX; y = e.clientY;
      el.style.opacity = "1";
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; el.style.transform = `translate3d(${x - 170}px, ${y - 170}px, 0)`; });
    };
    const leave = () => { el.style.opacity = "0"; };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("pointermove", move); document.removeEventListener("pointerleave", leave); };
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: "fixed", left: 0, top: 0, width: 340, height: 340, borderRadius: "50%", zIndex: -1, pointerEvents: "none",
        opacity: 0, transition: "opacity 300ms ease", willChange: "transform",
        background: `radial-gradient(circle, color-mix(in srgb, ${color} 30%, transparent), transparent 65%)`,
      }}
    />
  );
}