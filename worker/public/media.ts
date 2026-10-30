import { Hono } from "hono";
import type { AppEnv } from "../env";
import { IMAGE_TYPES } from "../lib/media";

export const mediaPublicRoutes = new Hono<AppEnv>();

// GET /media/:assetId/:name. The name is cosmetic; the id decides what is served. Ids are random and never reused, so files are immutable.
mediaPublicRoutes.get("/:assetId/:name", async (c) => {
  const notFound = () => new Response("Not found", { status: 404 });
  const row = await c.env.DB.prepare("SELECT r2_key, mime_type FROM media_assets WHERE id = ? AND kind = 'image'").bind(c.req.param("assetId")).first<{ r2_key: string; mime_type: string }>();
  if (!row || !(row.mime_type in IMAGE_TYPES)) return notFound();
  const obj = await c.env.MEDIA.get(row.r2_key);
  if (!obj) return notFound();
  const headers = new Headers({
    "content-type": row.mime_type,
    "cache-control": "public, max-age=31536000, immutable",
    etag: obj.httpEtag,
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; sandbox",
    "cross-origin-resource-policy": "same-origin",
  });
  if (c.req.header("if-none-match") === obj.httpEtag) return new Response(null, { status: 304, headers });
  return new Response(c.req.method === "HEAD" ? null : obj.body, { headers });
});
