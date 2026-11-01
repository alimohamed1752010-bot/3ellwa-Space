import { useEffect, useRef } from "react";
import { canAnimate, isLowEndDevice } from "./motion";

interface Props {
  kind: "aurora" | "stars";
  colors: string[];
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

interface Star { x: number; y: number; r: number; a: number; tw: number; ph: number; sp: number; c: number }

/**
 * Animated page background drawn on a canvas that sits behind the content.
 * Aurora renders at a fraction of the screen size so it stays cheap and soft.
 * With reduced motion, animations off, or a weak device it draws a single still frame.
 */
export default function BackgroundFx({ kind, colors }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const colorKey = colors.join(",");

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try { ctx = canvas.getContext("2d"); } catch { ctx = null; }
    if (!ctx) return;
    const g = ctx;
    const palette = colorKey.split(",").map(hexToRgb);
    const animate = canAnimate() && !isLowEndDevice();
    const scale = kind === "aurora" ? 1 / 8 : Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 1, h = 1, raf = 0, last = 0, alive = true;
    let stars: Star[] = [];

    const blobs = [
      { x: 0.28, y: 0.3, sx: 0.00031, sy: 0.00023, r: 0.62, c: 0 },
      { x: 0.72, y: 0.28, sx: 0.00024, sy: 0.00037, r: 0.56, c: 1 },
      { x: 0.5, y: 0.82, sx: 0.00028, sy: 0.00021, r: 0.66, c: 0 },
      { x: 0.18, y: 0.76, sx: 0.0002, sy: 0.00033, r: 0.5, c: 1 },
    ];

    const initStars = () => {
      const count = Math.min(170, Math.round((window.innerWidth * window.innerHeight) / 9000));
      stars = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * w, y: Math.random() * h,
        r: (0.4 + Math.random() * 1.2) * scale, a: 0.35 + Math.random() * 0.65,
        tw: 0.0006 + Math.random() * 0.0016, ph: Math.random() * 6.28,
        sp: (0.004 + Math.random() * 0.012) * scale, c: i % 4 === 0 ? i % palette.length : -1,
      }));
    };

    const resize = () => {
      w = Math.max(1, Math.floor(window.innerWidth * scale));
      h = Math.max(1, Math.floor(window.innerHeight * scale));
      canvas.width = w; canvas.height = h;
      if (kind === "stars") initStars();
    };

    const draw = (t: number, dt: number) => {
      g.clearRect(0, 0, w, h);
      if (kind === "aurora") {
        g.globalCompositeOperation = "lighter";
        blobs.forEach((b, i) => {
          const cx = w * (b.x + 0.16 * Math.sin(t * b.sx + i * 1.7));
          const cy = h * (b.y + 0.14 * Math.cos(t * b.sy + i * 2.3));
          const rad = Math.max(w, h) * b.r * 0.6;
          const [r, gr, bl] = palette[b.c % palette.length]!;
          const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
          grad.addColorStop(0, `rgba(${r},${gr},${bl},0.5)`);
          grad.addColorStop(1, `rgba(${r},${gr},${bl},0)`);
          g.fillStyle = grad;
          g.fillRect(0, 0, w, h);
        });
        g.globalCompositeOperation = "source-over";
      } else {
        for (const s of stars) {
          s.y -= s.sp * dt;
          if (s.y < -2) { s.y = h + 2; s.x = Math.random() * w; }
          const a = s.a * (0.6 + 0.4 * Math.sin(t * s.tw + s.ph));
          const [r, gr, bl] = s.c >= 0 ? palette[s.c]! : [255, 255, 255];
          g.fillStyle = `rgba(${r},${gr},${bl},${a.toFixed(3)})`;
          g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.2832); g.fill();
        }
      }
    };

    const frame = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      if (document.hidden || now - last < 33) return;
      const dt = Math.min(64, now - last);
      last = now;
      draw(now, dt);
    };

    resize();
    draw(1500, 0);
    if (animate) raf = requestAnimationFrame(frame);
    const onResize = () => { resize(); draw(1500, 0); };
    window.addEventListener("resize", onResize);
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [kind, colorKey]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      data-testid="background-fx"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: -1, pointerEvents: "none", opacity: kind === "aurora" ? 0.6 : 1 }}
    />
  );
}