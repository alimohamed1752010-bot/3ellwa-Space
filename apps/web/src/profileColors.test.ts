import { describe, expect, it } from "vitest";
import { PROFILE_PRESETS, profileCardLook, type ProfileColors } from "./shared/profileColors";

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const mix = (hex: string, k: number, toward: number) => {
  const n = parseInt(hex.slice(1), 16);
  const out = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (toward - v) * k));
  return "#" + out.map((v) => v.toString(16).padStart(2, "0")).join("");
};
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

function worstContrast(p: ProfileColors) {
  const look = profileCardLook(p)!;
  const bg = String(look.style.background);
  const k = Number(/rgb\(\d+ \d+ \d+ \/ ([0-9.]+)\)/.exec(bg)![1]);
  const toward = look.ink === "#ffffff" ? 0 : 255;
  const ends = p.mode === "solid" ? [p.primary] : [p.primary, p.accent];
  return Math.min(...ends.map((c) => ratio(lum(look.ink), lum(mix(c, k, toward)))));
}

describe("profile card colors", () => {
  it("returns nothing when off or missing", () => {
    expect(profileCardLook(undefined)).toBeNull();
    expect(profileCardLook({ mode: "off", primary: "#5b4bdb", accent: "#b44cd6", angle: 160 })).toBeNull();
  });

  it("keeps text readable for every preset", () => {
    for (const preset of PROFILE_PRESETS) {
      const worst = worstContrast({ mode: "gradient", primary: preset.primary, accent: preset.accent, angle: 160 });
      expect(worst, preset.name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("handles hard pairs and extremes", () => {
    const hard: Array<[string, string]> = [["#ffffff", "#000000"], ["#ffff00", "#0000ff"], ["#777777", "#888888"], ["#00ff00", "#ff00ff"]];
    for (const [primary, accent] of hard) {
      expect(worstContrast({ mode: "gradient", primary, accent, angle: 90 })).toBeGreaterThanOrEqual(4.5);
    }
    expect(worstContrast({ mode: "solid", primary: "#ffffff", accent: "#000000", angle: 0 })).toBeGreaterThanOrEqual(4.5);
  });

  it("picks dark text on light colors and light text on dark colors", () => {
    expect(profileCardLook({ mode: "solid", primary: "#f5f5f5", accent: "#f5f5f5", angle: 0 })!.ink).toBe("#0b0a10");
    expect(profileCardLook({ mode: "solid", primary: "#141e3c", accent: "#141e3c", angle: 0 })!.ink).toBe("#ffffff");
  });
});