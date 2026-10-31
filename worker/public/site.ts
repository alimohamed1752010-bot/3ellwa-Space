import { Hono } from "hono";
import type { AppEnv } from "../env";
import { loadProfileRow, parseJsonArray } from "../admin/profile";
import { mediaUrl } from "../lib/media";

export const publicRoutes = new Hono<AppEnv>();

interface SocialRow { id: string; platform: string; label: string | null; url: string; icon: string | null }
interface NavRow { id: string; label: string; target_type: string; url: string | null; open_new_tab: number; page_slug: string | null; page_home: number | null }

// Public data only: no draft fields, no ids of private things, no timestamps. Empty database returns defaults, never an error.
publicRoutes.get("/site", async (c) => {
  c.header("Cache-Control", "public, max-age=0, must-revalidate");
  let profile = null, social: SocialRow[] = [], nav: NavRow[] = [];
  try {
    const [p, s, n] = await Promise.all([
      loadProfileRow(c.env.DB),
      c.env.DB.prepare("SELECT id, platform, label, url, icon FROM social_links WHERE visible = 1 ORDER BY sort_order, rowid").all<SocialRow>(),
      c.env.DB.prepare(
        `SELECT n.id, n.label, n.target_type, n.url, n.open_new_tab, pg.slug AS page_slug, pg.is_home AS page_home
         FROM navigation_items n LEFT JOIN pages pg ON pg.id = n.page_id AND pg.status = 'published'
         WHERE n.visible = 1 AND n.parent_id IS NULL ORDER BY n.sort_order, n.rowid`
      ).all<NavRow>(),
    ]);
    profile = p; social = s.results; nav = n.results;
  } catch {
    // fall through to defaults
  }
  const showLoc = !!profile?.show_location && !!profile.location_text;
  return c.json({
    profile: {
      displayName: profile?.display_name ?? "",
      username: profile?.username ?? "",
      shortBio: profile?.short_bio ?? "",
      extendedBio: profile?.extended_bio ?? "",
      subtitles: parseJsonArray<string>(profile?.subtitle_json),
      typingEnabled: !!profile?.typing_enabled,
      statusText: profile?.status_text ?? "",
      // "auto" needs live presence (Part 7); until then it is not shown.
      onlineMode: profile?.online_mode === "online" || profile?.online_mode === "offline" ? profile.online_mode : "hidden",
      location: showLoc ? profile!.location_text : null,
      timezone: profile?.show_local_time && profile.timezone ? profile.timezone : null,
      avatarUrl: mediaUrl(profile?.avatar_asset_id, profile?.avatar_name),
      bannerUrl: mediaUrl(profile?.banner_asset_id, profile?.banner_name),
      badges: parseJsonArray<{ label: string; icon?: string; color?: string }>(profile?.badges_json),
    },
    social: social.map((r) => ({ id: r.id, platform: r.platform, label: r.label, url: r.url, icon: r.icon })),
    navigation: nav
      .map((r) => ({
        id: r.id,
        label: r.label,
        href: r.target_type === "page" ? (r.page_slug === null ? null : r.page_home ? "/" : "/" + r.page_slug) : r.url,
        newTab: !!r.open_new_tab,
      }))
      .filter((r) => r.href),
    site: { title: profile?.display_name || "3ellwa.space" },
  });
});

interface PublicPageRow { id:string; slug:string; title:string; meta_title:string|null; meta_description:string|null; indexable:number }
interface PublicSectionRow { id:string; type:string; sort_order:number; published_json:string|null }
publicRoutes.get("/pages/:slug", async (c) => {
  const slug = c.req.param("slug");
  if (slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return c.json({ error: { code: "not_found", message: "Page not found." } }, 404);
  const page = await c.env.DB.prepare("SELECT id,slug,title,meta_title,meta_description,indexable FROM pages WHERE slug=? AND status='published' AND visibility='public'").bind(slug).first<PublicPageRow>();
  if (!page) return c.json({ error: { code: "not_found", message: "Page not found." } }, 404);
  const rows = (await c.env.DB.prepare("SELECT id,type,sort_order,published_json FROM page_sections WHERE page_id=? AND published_json IS NOT NULL ORDER BY sort_order,rowid").bind(page.id).all<PublicSectionRow>()).results;
  const sections = [];
  for (const row of rows) {
    let data: Record<string, unknown> = {};
    try { data = row.published_json ? JSON.parse(row.published_json) : {}; } catch {}
    let imageUrl: string | null = null;
    if (typeof data.assetId === "string" && data.assetId) {
      const asset = await c.env.DB.prepare("SELECT id,filename FROM media_assets WHERE id=? AND kind='image'").bind(data.assetId).first<{id:string;filename:string}>();
      if (asset) imageUrl = mediaUrl(asset.id, asset.filename);
    }
    sections.push({ id: row.id, type: row.type, title: typeof data.title === "string" ? data.title : "", body: typeof data.body === "string" ? data.body : "", url: typeof data.url === "string" ? data.url : "", imageUrl });
  }
  c.header("Cache-Control", "public, max-age=0, must-revalidate");
  return c.json({ page: { slug: page.slug, title: page.title, metaTitle: page.meta_title || page.title, metaDescription: page.meta_description || "", indexable: !!page.indexable, sections } });
});
