import { z } from "zod";

export const MAX_LINKS = 1000;
export const HOVER_ANIMATIONS = ["none", "lift", "glow", "scale", "shine"] as const;

/** Destinations we will ever redirect to: http(s) and mailto only, no spaces or control characters, no embedded credentials. Used on save AND at redirect time. */
export function isSafeDestination(v: unknown): v is string {
  if (typeof v !== "string" || v.length === 0 || v.length > 2000) return false;
  if (/[\u0000-\u0020\u007f\\]/.test(v)) return false;
  try {
    const u = new URL(v);
    if (u.protocol === "mailto:") return u.pathname.length > 0;
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return u.hostname.length > 0 && !u.username && !u.password;
  } catch {
    return false;
  }
}

export const destination = z.string().trim().max(2000).refine(isSafeDestination, "must be a full http(s) or mailto link with no spaces");

const hex = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "must be a color like #8b5cf6");

/** ISO string -> "YYYY-MM-DD HH:MM:SS" (UTC), the format SQLite's datetime('now') compares against. */
export function toDbDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace("T", " ");
}
export function fromDbDate(v: string | null): string | null {
  return v ? v.replace(" ", "T") + "Z" : null;
}
const dateField = z.string().trim().max(40).nullish().refine((v) => !v || !Number.isNaN(new Date(v).getTime()), "must be a valid date and time");

export const linkFields = {
  title: z.string().trim().min(1).max(100),
  url: destination,
  description: z.string().trim().max(300).nullish(),
  icon: z.string().trim().max(40).nullish(),
  imageAssetId: z.string().trim().max(100).nullish(),
  color: hex.nullish(),
  background: hex.nullish(),
  badge: z.string().trim().max(24).nullish(),
  hoverAnimation: z.enum(HOVER_ANIMATIONS).default("none"),
  openNewTab: z.boolean().default(true),
  featured: z.boolean().default(false),
  visible: z.boolean().default(true),
  enabled: z.boolean().default(true),
  publishAt: dateField,
  expiresAt: dateField,
};

export function scheduleOrder(d: { publishAt?: string | null; expiresAt?: string | null }): string | null {
  const a = toDbDate(d.publishAt), b = toDbDate(d.expiresAt);
  return a && b && b <= a ? "expiresAt: must be after the publish date" : null;
}

/** SQL fragment: link row `l` is live for the public right now. */
export const LIVE_SQL =
  "l.enabled = 1 AND l.visible = 1 AND (l.publish_at IS NULL OR l.publish_at <= datetime('now')) AND (l.expires_at IS NULL OR l.expires_at > datetime('now')) " +
  "AND (l.category_id IS NULL OR EXISTS (SELECT 1 FROM link_categories c WHERE c.id = l.category_id AND c.visible = 1))";

export function deviceOf(ua: string): string {
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}
export function browserOf(ua: string): string {
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/chrome|crios/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  return "Other";
}
