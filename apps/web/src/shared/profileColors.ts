import type { CSSProperties } from "react";

export interface ProfileColors {
  mode: "off" | "solid" | "gradient";
  primary: string;
  accent: string;
  angle: number;
}

export const DEFAULT_PROFILE_COLORS: ProfileColors = { mode: "off", primary: "#5b4bdb", accent: "#b44cd6", angle: 160 };

export const PROFILE_PRESETS: Array<{ name: string; primary: string; accent: string }> = [
  { name: "Violet dusk", primary: "#5b4bdb", accent: "#b44cd6" },
  { name: "Ocean", primary: "#1e6fd9", accent: "#19c3b1" },
  { name: "Sunset", primary: "#f5622e", accent: "#f0a53a" },
  { name: "Rose", primary: "#d6336c", accent: "#ff8fab" },
  { name: "Forest", primary: "#1f7a4d", accent: "#7ed957" },
  { name: "Midnight", primary: "#141e3c", accent: "#3a4a8c" },
  { name: "Crimson", primary: "#b3122f", accent: "#3a0a14" },
  { name: "Gold", primary: "#e0a800", accent: "#8a5a00" },
  { name: "Mint", primary: "#0fb894", accent: "#2d5be3" },
  { name: "Candy", primary: "#ff6ec7", accent: "#7a5cff" },
  { name: "Slate", primary: "#3b4252", accent: "#88c0d0" },
  { name: "Ember", primary: "#ff5f2e", accent: "#7a1fa2" },
];

const WHITE = "#ffffff";
const DARK = "#0b0a10";
const TARGET_CONTRAST = 6;

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Blend a color toward black or white by `k` (0..1), the same result as a scrim of alpha k on top of it. */
function shade(hex: string, k: number, toward: 0 | 255): string {
  const mixed = toRgb(hex).map((v) => Math.round(v + (toward - v) * k));
  return "#" + mixed.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** Smallest scrim that makes `ink` readable on every color in `ends`, or null if it cannot be reached. */
function scrimFor(ink: string, ends: string[]): number | null {
  const inkLum = luminance(ink);
  const toward = ink === WHITE ? 0 : 255;
  for (let k = 0; k <= 0.7001; k += 0.05) {
    const worst = Math.min(...ends.map((c) => ratio(inkLum, luminance(shade(c, k, toward)))));
    if (worst >= TARGET_CONTRAST) return Math.round(k * 100) / 100;
  }
  return null;
}

export interface ProfileCardLook {
  style: CSSProperties;
  ink: string;
}

/**
 * Builds the inline style for the profile card, or null when profile colors are off.
 * Text color is chosen automatically, and a light scrim is added when the colors alone
 * would not keep text readable. Custom properties are overridden so every child that
 * uses text-ink, text-muted, bg-raised or border-line follows the card.
 */
export function profileCardLook(p: ProfileColors | null | undefined): ProfileCardLook | null {
  if (!p || p.mode === "off") return null;
  const ends = p.mode === "solid" ? [p.primary] : [p.primary, p.accent];
  const white = scrimFor(WHITE, ends);
  const dark = scrimFor(DARK, ends);
  const useWhite = dark === null || (white !== null && white <= dark);
  const ink = useWhite ? WHITE : DARK;
  const k = (useWhite ? white : dark) ?? 0.7;
  const scrimColor = useWhite ? "0 0 0" : "255 255 255";
  const scrim = `linear-gradient(rgb(${scrimColor} / ${k}), rgb(${scrimColor} / ${k}))`;
  const base = p.mode === "solid"
    ? `linear-gradient(${p.primary}, ${p.primary})`
    : `linear-gradient(${p.angle}deg, ${p.primary}, ${p.accent})`;
  const vars: Record<string, string> = {
    background: `${scrim}, ${base}`,
    borderColor: `color-mix(in srgb, ${ink} 22%, transparent)`,
    color: ink,
    "--color-ink": ink,
    "--color-muted": `color-mix(in srgb, ${ink} 88%, transparent)`,
    "--color-accent": ink,
    "--color-accent-soft": ink,
    "--color-raised": `color-mix(in srgb, ${ink} 14%, transparent)`,
    "--color-line": `color-mix(in srgb, ${ink} 30%, transparent)`,
    "--color-surface": p.primary,
  };
  return { style: vars as CSSProperties, ink };
}