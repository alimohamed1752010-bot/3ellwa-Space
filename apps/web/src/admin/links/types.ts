export type Status = "live" | "scheduled" | "expired" | "disabled" | "hidden";
export interface LinkItem {
  id: string; categoryId: string | null; title: string; url: string; description: string | null; icon: string | null;
  imageAssetId: string | null; imageUrl: string | null; color: string | null; background: string | null; badge: string | null;
  hoverAnimation: string; openNewTab: boolean; featured: boolean; visible: boolean; enabled: boolean;
  publishAt: string | null; expiresAt: string | null; sortOrder: number; clicksTotal: number; clicks7d: number; status: Status;
}
export interface Category { id: string; name: string; description: string | null; color: string | null; visible: boolean; sortOrder: number; linkCount: number }
export interface Stats { total: number; uniqueVisitors: number; lastClickAt: string | null; last7: number; last30: number; daily: Array<{ date: string; count: number }> }

export const HOVERS = [["none", "None"], ["lift", "Lift"], ["scale", "Scale"], ["glow", "Glow"], ["shine", "Shine"]] as const;
export const STATUS_LABEL: Record<Status, string> = { live: "Live", scheduled: "Scheduled", expired: "Expired", disabled: "Disabled", hidden: "Hidden" };

export interface Filters { q: string; status: "all" | Status; categoryId: "all" | "none" | string }
export const NO_FILTERS: Filters = { q: "", status: "all", categoryId: "all" };
export const isFiltered = (f: Filters) => f.q.trim() !== "" || f.status !== "all" || f.categoryId !== "all";

export function filterLinks(items: LinkItem[], f: Filters): LinkItem[] {
  const q = f.q.trim().toLowerCase();
  return items.filter((l) => {
    if (f.status !== "all" && l.status !== f.status) return false;
    if (f.categoryId === "none" ? l.categoryId !== null : f.categoryId !== "all" && l.categoryId !== f.categoryId) return false;
    return !q || [l.title, l.url, l.description ?? "", l.badge ?? ""].some((x) => x.toLowerCase().includes(q));
  });
}

/** Same rule as the Worker (http, https, mailto; no spaces or credentials), for instant feedback. The Worker still decides. */
export function checkUrl(v: string): string | null {
  const t = v.trim();
  if (!t) return "Enter a URL.";
  if (t.length > 2000) return "That URL is too long.";
  if (/[\s\\]/.test(t)) return "A URL cannot contain spaces.";
  try {
    const u = new URL(t);
    if (u.protocol === "mailto:") return u.pathname ? null : "Enter an email address after mailto:";
    if (u.protocol !== "http:" && u.protocol !== "https:") return "Use a full http(s) or mailto link.";
    if (u.username || u.password) return "Links with a username or password are not allowed.";
    return null;
  } catch {
    return "Use a full link such as https://example.com";
  }
}

export interface Draft {
  title: string; url: string; description: string; icon: string; categoryId: string; imageAssetId: string | null; imageUrl: string | null;
  color: string; background: string; badge: string; hoverAnimation: string; openNewTab: boolean; featured: boolean; visible: boolean; enabled: boolean;
  publishAt: string; expiresAt: string; // datetime-local strings
}
export const EMPTY_DRAFT: Draft = {
  title: "", url: "", description: "", icon: "", categoryId: "", imageAssetId: null, imageUrl: null, color: "", background: "", badge: "",
  hoverAnimation: "none", openNewTab: true, featured: false, visible: true, enabled: true, publishAt: "", expiresAt: "",
};

const pad = (n: number) => String(n).padStart(2, "0");
/** ISO (UTC) -> value for <input type="datetime-local"> in the browser's timezone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const toDraft = (l: LinkItem): Draft => ({
  title: l.title, url: l.url, description: l.description ?? "", icon: l.icon ?? "", categoryId: l.categoryId ?? "", imageAssetId: l.imageAssetId, imageUrl: l.imageUrl,
  color: l.color ?? "", background: l.background ?? "", badge: l.badge ?? "", hoverAnimation: l.hoverAnimation, openNewTab: l.openNewTab, featured: l.featured,
  visible: l.visible, enabled: l.enabled, publishAt: toLocalInput(l.publishAt), expiresAt: toLocalInput(l.expiresAt),
});

export function draftError(d: Draft): string | null {
  if (!d.title.trim()) return "Enter a title.";
  const u = checkUrl(d.url);
  if (u) return u;
  const a = fromLocalInput(d.publishAt), b = fromLocalInput(d.expiresAt);
  if (a && b && b <= a) return "The expiry must be after the publish date.";
  return null;
}

export function toPayload(d: Draft) {
  return {
    title: d.title.trim(), url: d.url.trim(), description: d.description.trim() || null, icon: d.icon.trim() || null, categoryId: d.categoryId || null,
    imageAssetId: d.imageAssetId, color: d.color || null, background: d.background || null, badge: d.badge.trim() || null, hoverAnimation: d.hoverAnimation,
    openNewTab: d.openNewTab, featured: d.featured, visible: d.visible, enabled: d.enabled, publishAt: fromLocalInput(d.publishAt), expiresAt: fromLocalInput(d.expiresAt),
  };
}

export const trackedUrl = (id: string) => `${window.location.origin}/go/${id}`;
