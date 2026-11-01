/** Shared checks so every effect respects reduced motion, the theme's animation switch, and weak devices. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
export function themeMotionOn(): boolean {
  return typeof document === "undefined" || document.documentElement.dataset.motion !== "off";
}
export function hasFinePointer(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(pointer: fine)").matches;
}
export function isLowEndDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const n = navigator as Navigator & { deviceMemory?: number };
  return (n.hardwareConcurrency ?? 8) <= 2 || (n.deviceMemory ?? 8) <= 2;
}
export function canAnimate(): boolean {
  return themeMotionOn() && !prefersReducedMotion();
}