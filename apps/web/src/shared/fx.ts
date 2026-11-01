export interface FxTokens {
  background: "none" | "aurora" | "stars";
  glow: "none" | "soft" | "pulse";
  tilt: boolean;
  cursorGlow: boolean;
  avatarShape: "circle" | "rounded" | "square";
  avatarGlow: boolean;
  nameEffect: "none" | "glitch" | "decrypt";
  enterScreen: { enabled: boolean; text: string };
}

export const DEFAULT_FX: FxTokens = {
  background: "none",
  glow: "none",
  tilt: false,
  cursorGlow: false,
  avatarShape: "circle",
  avatarGlow: false,
  nameEffect: "none",
  enterScreen: { enabled: false, text: "Click to enter" },
};

/** One-click bundle used by the admin "Apply Noiz look" button. The enter screen stays off because it blocks the page until clicked. */
export const NOIZ_FX: FxTokens = {
  background: "aurora",
  glow: "soft",
  tilt: true,
  cursorGlow: true,
  avatarShape: "circle",
  avatarGlow: true,
  nameEffect: "decrypt",
  enterScreen: { enabled: false, text: "Click to enter" },
};