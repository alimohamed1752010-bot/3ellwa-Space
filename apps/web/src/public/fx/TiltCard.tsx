import { useMemo, useRef } from "react";
import type { PointerEvent, ReactNode } from "react";
import { canAnimate, hasFinePointer } from "./motion";

/** Gentle 3D tilt that follows the pointer. Desktop only; renders children untouched otherwise. */
export default function TiltCard({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useMemo(() => enabled && hasFinePointer() && canAnimate(), [enabled]);
  if (!active) return <>{children}</>;

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1000px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 7).toFixed(2)}deg)`;
  };
  const leave = () => { if (ref.current) ref.current.style.transform = ""; };

  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} style={{ transition: "transform 180ms ease-out", willChange: "transform" }}>
      {children}
    </div>
  );
}