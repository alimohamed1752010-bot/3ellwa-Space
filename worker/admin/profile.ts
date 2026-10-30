import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { randomId } from "../lib/crypto";
import { apiError } from "../lib/http";
import { mediaUrl } from "../lib/media";
import { isTimezone, parseBody, safeUrl } from "../lib/validate";

export const profileRoutes = new Hono<AppEnv>();

const badge = z.object({
  label: z.string().trim().min(1).max(30),
  icon: z.string().trim().max(30).optional(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "must be a hex color like #8b5cf6").optional(),
});

const profileSchema = z.object({
  displayName: z.string().trim().max(80),
  username: z.string().trim().max(40),
  shortBio: z.string().trim().max(280),
  extendedBio: z.string().trim().max(5000),
  subtitles: z.array(z.string().trim().min(1).max(100)).max(10),
  typingEnabled: z.boolean(),
  statusText: z.string().trim().max(100),
  onlineMode: z.enum(["hidden", "online", "offline", "auto"]),
  locationText: z.string().trim().max(80),
  showLocation: z.boolean(),
  timezone: z.string().trim().max(60).nullable().refine((v) => v === null || v === "" || isTimezone(v), "unknown time zone"),
  showLocalTime: z.boolean(),
  avatarAssetId: z.string().max(100).nullable(),
  bannerAssetId: z.string().max(100).nullable(),
  badges: z.array(badge).max(10),
});

interface ProfileRow {
  display_name: string; username: string; short_bio: string; extended_bio: string; subtitle_json: string;
  typing_enabled: number; status_text: string; online_mode: string; location_text: string; show_location: number;
  timezone: string | null; show_local_time: number; avatar_asset_id: string | null; banner_asset_id: string | null;
  badges_json: string; updated_at: string; avatar_name: string | null; banner_name: string | null;
}

export function parseJsonArray<T>(s: string | null | undefined): T[] {
  try {
    const v = JSON.parse(s ?? "[]");
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

export async function loadProfileRow(db: D1Database): Promise<ProfileRow | null> {
  return db
    .prepare(
      `SELECT p.*, a.filename AS avatar_name, b.filename AS banner_name
       FROM profile_settings p
       LEFT JOIN media_assets a ON a.id = p.avatar_asset_id
       LEFT JOIN media_assets b ON b.id = p.banner_asset_id
       WHERE p.id = 1`
    )
    .first<ProfileRow>();
}

function adminProfile(r: ProfileRow | null) {
  return {
    displayName: r?.display_name ?? "",
    username: r?.username ?? "",
    shortBio: r?.short_bio ?? "",
    extendedBio: r?.extended_bio ?? "",
    subtitles: parseJsonArray<string>(r?.subtitle_json),
    typingEnabled: !!r?.typing_enabled,
    statusText: r?.status_text ?? "",
    onlineMode: r?.online_mode ?? "hidden",
    locationText: r?.location_text ?? "",
    showLocation: !!r?.show_location,
    timezone: r?.timezone ?? null,
    showLocalTime: !!r?.show_local_time,
    avatarAssetId: r?.avatar_asset_id ?? null,
    bannerAssetId: r?.banner_asset_id ?? null,
    avatarUrl: mediaUrl(r?.avatar_asset_id, r?.avatar_name),
    bannerUrl: mediaUrl(r?.banner_asset_id, r?.banner_name),
    badges: parseJsonArray<{ label: string; icon?: string; color?: string }>(r?.badges_json),
    updatedAt: r?.updated_at ?? null,
  };
}

profileRoutes.get("/profile", async (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ profile: adminProfile(await loadProfileRow(c.env.DB)) });
});

profileRoutes.put("/profile", async (c) => {
  const p = await parseBody(c, profileSchema);
  if ("res" in p) return p.res;
  const d = p.data;
  for (const [field, id] of [["avatarAssetId", d.avatarAssetId], ["bannerAssetId", d.bannerAssetId]] as const) {
    if (id) {
      const ok = await c.env.DB.prepare("SELECT 1 AS ok FROM media_assets WHERE id = ? AND kind = 'image'").bind(id).first();
      if (!ok) return apiError(c, 400, "validation_failed", `${field}: image not found`, { field });
    }
  }
  await c.env.DB.prepare(
    `UPDATE profile_settings SET display_name=?, username=?, short_bio=?, extended_bio=?, subtitle_json=?, typing_enabled=?,
       status_text=?, online_mode=?, location_text=?, show_location=?, timezone=?, show_local_time=?,
       avatar_asset_id=?, banner_asset_id=?, badges_json=?, updated_at=datetime('now') WHERE id = 1`
  )
    .bind(
      d.displayName, d.username, d.shortBio, d.extendedBio, JSON.stringify(d.subtitles), d.typingEnabled ? 1 : 0,
      d.statusText, d.onlineMode, d.locationText, d.showLocation ? 1 : 0, d.timezone || null, d.showLocalTime ? 1 : 0,
      d.avatarAssetId, d.bannerAssetId, JSON.stringify(d.badges)
    )
    .run();
  return c.json({ profile: adminProfile(await loadProfileRow(c.env.DB)) });
});

// ---- Social links ----
const socialSchema = z.object({
  platform: z.string().trim().min(1).max(30),
  label: z.string().trim().max(40).nullable().optional(),
  url: safeUrl,
  icon: z.string().trim().max(30).nullable().optional(),
  visible: z.boolean().default(true),
});

interface SocialRow { id: string; platform: string; label: string | null; url: string; icon: string | null; sort_order: number; visible: number }
const socialOut = (r: SocialRow) => ({ id: r.id, platform: r.platform, label: r.label, url: r.url, icon: r.icon, visible: !!r.visible, sortOrder: r.sort_order });

async function listSocial(db: D1Database) {
  const { results } = await db.prepare("SELECT * FROM social_links ORDER BY sort_order, rowid").all<SocialRow>();
  return results.map(socialOut);
}

profileRoutes.get("/social-links", async (c) => c.json({ items: await listSocial(c.env.DB) }));

profileRoutes.post("/social-links", async (c) => {
  const p = await parseBody(c, socialSchema);
  if ("res" in p) return p.res;
  const d = p.data;
  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(MAX(sort_order), -1) AS m FROM social_links").first<{ n: number; m: number }>();
  if ((count?.n ?? 0) >= 30) return apiError(c, 400, "limit_reached", "You can have up to 30 social links.");
  const id = randomId(9);
  await c.env.DB.prepare("INSERT INTO social_links (id, platform, label, url, icon, sort_order, visible) VALUES (?,?,?,?,?,?,?)")
    .bind(id, d.platform, d.label || null, d.url, d.icon || null, (count?.m ?? -1) + 1, d.visible ? 1 : 0)
    .run();
  return c.json({ items: await listSocial(c.env.DB) }, 201);
});

// Reorder must be registered before "/:id" routes.
profileRoutes.put("/social-links/order", async (c) => {
  const p = await parseBody(c, z.object({ ids: z.array(z.string().max(100)).max(100) }));
  if ("res" in p) return p.res;
  await c.env.DB.batch(p.data.ids.map((id, i) => c.env.DB.prepare("UPDATE social_links SET sort_order = ? WHERE id = ?").bind(i, id)));
  return c.json({ items: await listSocial(c.env.DB) });
});

profileRoutes.put("/social-links/:id", async (c) => {
  const p = await parseBody(c, socialSchema);
  if ("res" in p) return p.res;
  const d = p.data;
  const r = await c.env.DB.prepare("UPDATE social_links SET platform=?, label=?, url=?, icon=?, visible=? WHERE id = ?")
    .bind(d.platform, d.label || null, d.url, d.icon || null, d.visible ? 1 : 0, c.req.param("id"))
    .run();
  if (!r.meta.changes) return apiError(c, 404, "not_found", "Social link not found.");
  return c.json({ items: await listSocial(c.env.DB) });
});

profileRoutes.delete("/social-links/:id", async (c) => {
  const r = await c.env.DB.prepare("DELETE FROM social_links WHERE id = ?").bind(c.req.param("id")).run();
  if (!r.meta.changes) return apiError(c, 404, "not_found", "Social link not found.");
  return c.json({ items: await listSocial(c.env.DB) });
});
