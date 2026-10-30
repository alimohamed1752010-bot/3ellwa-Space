import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { randomId } from "../lib/crypto";
import { apiError } from "../lib/http";
import { imageSize } from "../lib/imageSize";
import { IMAGE_TYPES, MAX_BYTES, buildFilename, displayName, mediaUrl, newTag, safeBaseName, sniffImage, splitFilename } from "../lib/media";
import type { ImageMime, UploadPurpose } from "../lib/media";
import { USED_COUNT_SQL, assetUsage } from "../lib/mediaUsage";
import { parseBody } from "../lib/validate";

export const mediaAdminRoutes = new Hono<AppEnv>();

interface AssetRow {
  id: string; folder_id: string | null; filename: string; mime_type: string; size_bytes: number;
  width: number | null; height: number | null; alt_text: string | null; created_at: string; updated_at: string; used_count: number;
}
const COLS = `a.id, a.folder_id, a.filename, a.mime_type, a.size_bytes, a.width, a.height, a.alt_text, a.created_at, a.updated_at, ${USED_COUNT_SQL} AS used_count`;

// id, filename, mimeType, sizeBytes, url, createdAt are what Parts 2.5 and 3 already returned; the rest is new in Part 4 and additive.
const out = (r: AssetRow) => ({
  id: r.id,
  filename: r.filename,
  name: displayName(r.filename),
  mimeType: r.mime_type,
  sizeBytes: r.size_bytes,
  width: r.width,
  height: r.height,
  altText: r.alt_text,
  folderId: r.folder_id,
  url: mediaUrl(r.id, r.filename),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  usedCount: r.used_count,
});

async function getAsset(db: D1Database, id: string) {
  return db.prepare(`SELECT ${COLS} FROM media_assets a WHERE a.id = ? AND a.kind = 'image'`).bind(id).first<AssetRow>();
}

const PURPOSES: UploadPurpose[] = ["avatar", "banner", "link", "library"];
const MAX_FOLDERS = 50;
const MAX_LIST = 500;

/* ---------- folders (one level deep) ---------- */

const folderOut = (r: { id: string; name: string; created_at: string; asset_count: number }) => ({ id: r.id, name: r.name, createdAt: r.created_at, assetCount: r.asset_count });

async function listFolders(db: D1Database) {
  const { results } = await db
    .prepare("SELECT f.id, f.name, f.created_at, (SELECT COUNT(*) FROM media_assets a WHERE a.folder_id = f.id AND a.kind = 'image') AS asset_count FROM media_folders f ORDER BY LOWER(f.name), f.rowid")
    .all<{ id: string; name: string; created_at: string; asset_count: number }>();
  return results.map(folderOut);
}

const folderBody = z.object({ name: z.string().trim().min(1, "Give the folder a name.").max(60) });

async function folderNameTaken(db: D1Database, name: string, exceptId?: string) {
  const row = await db.prepare("SELECT id FROM media_folders WHERE LOWER(name) = LOWER(?) AND id != ?").bind(name, exceptId ?? "").first();
  return row !== null;
}

mediaAdminRoutes.get("/media/folders", async (c) => c.json({ items: await listFolders(c.env.DB) }));

mediaAdminRoutes.post("/media/folders", async (c) => {
  const p = await parseBody(c, folderBody);
  if ("res" in p) return p.res;
  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM media_folders").first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_FOLDERS) return apiError(c, 400, "too_many_folders", `You can have up to ${MAX_FOLDERS} folders.`);
  if (await folderNameTaken(c.env.DB, p.data.name)) return apiError(c, 409, "folder_exists", "A folder with that name already exists.", { field: "name" });
  await c.env.DB.prepare("INSERT INTO media_folders (id, name) VALUES (?, ?)").bind(randomId(12), p.data.name).run();
  return c.json({ items: await listFolders(c.env.DB) }, 201);
});

mediaAdminRoutes.put("/media/folders/:id", async (c) => {
  const p = await parseBody(c, folderBody);
  if ("res" in p) return p.res;
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT id FROM media_folders WHERE id = ?").bind(id).first();
  if (!row) return apiError(c, 404, "not_found", "Folder not found.");
  if (await folderNameTaken(c.env.DB, p.data.name, id)) return apiError(c, 409, "folder_exists", "A folder with that name already exists.", { field: "name" });
  await c.env.DB.prepare("UPDATE media_folders SET name = ? WHERE id = ?").bind(p.data.name, id).run();
  return c.json({ items: await listFolders(c.env.DB) });
});

// Deleting a folder never deletes files: they go back to "Unfiled" (media_assets.folder_id is ON DELETE SET NULL).
mediaAdminRoutes.delete("/media/folders/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT id FROM media_folders WHERE id = ?").bind(id).first();
  if (!row) return apiError(c, 404, "not_found", "Folder not found.");
  await c.env.DB.prepare("DELETE FROM media_folders WHERE id = ?").bind(id).run();
  return c.json({ items: await listFolders(c.env.DB) });
});

/* ---------- list, search ---------- */

// GET /media?q=&folder=all|none|<id>&sort=newest|oldest|name|size|used&limit=
mediaAdminRoutes.get("/media", async (c) => {
  const q = (c.req.query("q") ?? "").trim().slice(0, 100);
  const folder = c.req.query("folder") ?? "all";
  const sort = c.req.query("sort") ?? "newest";
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 200, 1), MAX_LIST);

  const where: string[] = ["a.kind = 'image'"];
  const args: unknown[] = [];
  if (q) {
    where.push("(a.filename LIKE ? ESCAPE '\\' OR COALESCE(a.alt_text, '') LIKE ? ESCAPE '\\')");
    const like = "%" + q.replace(/[\\%_]/g, (m) => "\\" + m) + "%";
    args.push(like, like);
  }
  if (folder === "none") where.push("a.folder_id IS NULL");
  else if (folder !== "all") { where.push("a.folder_id = ?"); args.push(folder); }

  const order =
    sort === "oldest" ? "a.created_at ASC, a.rowid ASC"
    : sort === "name" ? "LOWER(a.filename) ASC, a.rowid ASC"
    : sort === "size" ? "a.size_bytes DESC, a.rowid DESC"
    : sort === "used" ? "used_count DESC, a.created_at DESC, a.rowid DESC"
    : "a.created_at DESC, a.rowid DESC";

  const { results } = await c.env.DB.prepare(`SELECT ${COLS} FROM media_assets a WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ?`).bind(...args, limit).all<AssetRow>();
  const total = await c.env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(size_bytes), 0) AS bytes FROM media_assets WHERE kind = 'image'").first<{ n: number; bytes: number }>();
  return c.json({ items: results.map(out), totalAssets: total?.n ?? 0, totalBytes: total?.bytes ?? 0 });
});

mediaAdminRoutes.get("/media/:id/usage", async (c) => {
  const row = await getAsset(c.env.DB, c.req.param("id"));
  if (!row) return apiError(c, 404, "not_found", "Image not found.");
  return c.json({ usage: await assetUsage(c.env.DB, row.id) });
});

/* ---------- upload ---------- */

type FormResult = { file: File; form: FormData } | { res: Response };
async function readFile(c: Context<AppEnv>, limitFor: (form: FormData) => number): Promise<FormResult> {
  const declared = Number(c.req.header("content-length") ?? 0);
  if (declared > MAX_BYTES.library + 64 * 1024) return { res: apiError(c, 413, "too_large", "That file is too large.") };
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return { res: apiError(c, 400, "invalid_form", "Send the image as a multipart form with a 'file' field.") };
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { res: apiError(c, 400, "no_file", "Choose an image file first.") };
  const limit = limitFor(form);
  if (file.size > limit) return { res: apiError(c, 413, "too_large", `That file is ${(file.size / 1048576).toFixed(1)} MB. The limit here is ${limit / 1048576} MB.`) };
  return { file, form };
}

// Multipart form: file, purpose = avatar | banner | link | library (default avatar, as before), optional folderId and alt.
mediaAdminRoutes.post("/media/upload", async (c) => {
  const r = await readFile(c, (form) => {
    const raw = form.get("purpose");
    const purpose: UploadPurpose = PURPOSES.includes(raw as UploadPurpose) ? (raw as UploadPurpose) : "avatar";
    return MAX_BYTES[purpose];
  });
  if ("res" in r) return r.res;
  const { file, form } = r;

  let folderId: string | null = null;
  const rawFolder = form.get("folderId");
  if (typeof rawFolder === "string" && rawFolder) {
    const f = await c.env.DB.prepare("SELECT id FROM media_folders WHERE id = ?").bind(rawFolder).first();
    if (!f) return apiError(c, 400, "bad_folder", "That folder does not exist.", { field: "folderId" });
    folderId = rawFolder;
  }
  const rawAlt = form.get("alt");
  const alt = typeof rawAlt === "string" && rawAlt.trim() ? rawAlt.trim().slice(0, 300) : null;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImage(bytes);
  if (!mime) return apiError(c, 415, "bad_type", "Only PNG, JPEG, WebP, and GIF images are allowed.");
  const dims = imageSize(bytes);

  const id = randomId(12);
  const filename = `${safeBaseName(file.name)}.${IMAGE_TYPES[mime]}`;
  const key = `media/${id}/${filename}`;
  await c.env.MEDIA.put(key, bytes, { httpMetadata: { contentType: mime } });
  try {
    await c.env.DB.prepare("INSERT INTO media_assets (id, folder_id, r2_key, filename, mime_type, size_bytes, width, height, alt_text, kind) VALUES (?,?,?,?,?,?,?,?,?, 'image')")
      .bind(id, folderId, key, filename, mime, bytes.byteLength, dims?.width ?? null, dims?.height ?? null, alt)
      .run();
  } catch (e) {
    await c.env.MEDIA.delete(key); // do not leave an orphan file if the row failed
    throw e;
  }
  return c.json({ asset: out((await getAsset(c.env.DB, id))!) }, 201);
});

/* ---------- rename, alt text, move ---------- */

const updateBody = z.object({
  name: z.string().trim().min(1, "Give the file a name.").max(80).optional(),
  altText: z.string().trim().max(300).nullable().optional(),
  folderId: z.string().nullable().optional(),
});

mediaAdminRoutes.put("/media/:id", async (c) => {
  const p = await parseBody(c, updateBody);
  if ("res" in p) return p.res;
  const id = c.req.param("id");
  const row = await getAsset(c.env.DB, id);
  if (!row) return apiError(c, 404, "not_found", "Image not found.");
  const d = p.data;

  let filename = row.filename;
  if (d.name !== undefined) {
    const cur = splitFilename(row.filename);
    // safeBaseName drops any typed extension; the real extension and the cache tag are kept.
    filename = buildFilename(safeBaseName(d.name), cur.tag, cur.ext);
  }
  let folderId = row.folder_id;
  if (d.folderId !== undefined) {
    if (d.folderId) {
      const f = await c.env.DB.prepare("SELECT id FROM media_folders WHERE id = ?").bind(d.folderId).first();
      if (!f) return apiError(c, 400, "bad_folder", "That folder does not exist.", { field: "folderId" });
    }
    folderId = d.folderId || null;
  }
  const alt = d.altText === undefined ? row.alt_text : d.altText || null;
  // r2_key is deliberately unchanged: the stored object keeps its key, and the name in the URL is cosmetic.
  await c.env.DB.prepare("UPDATE media_assets SET filename = ?, folder_id = ?, alt_text = ?, updated_at = datetime('now') WHERE id = ?").bind(filename, folderId, alt, id).run();
  return c.json({ asset: out((await getAsset(c.env.DB, id))!) });
});

/* ---------- replace the file, keep the id ---------- */

// Everything that uses this asset keeps working because it references the id. The URL changes (new cache tag), so browsers fetch the new bytes.
mediaAdminRoutes.post("/media/:id/replace", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT r2_key, filename FROM media_assets WHERE id = ? AND kind = 'image'").bind(id).first<{ r2_key: string; filename: string }>();
  if (!row) return apiError(c, 404, "not_found", "Image not found.");
  const r = await readFile(c, () => MAX_BYTES.library);
  if ("res" in r) return r.res;

  const bytes = new Uint8Array(await r.file.arrayBuffer());
  const mime: ImageMime | null = sniffImage(bytes);
  if (!mime) return apiError(c, 415, "bad_type", "Only PNG, JPEG, WebP, and GIF images are allowed.");
  const dims = imageSize(bytes);

  const cur = splitFilename(row.filename);
  const filename = buildFilename(cur.base, newTag(), IMAGE_TYPES[mime]);
  const key = `media/${id}/${filename}`;
  await c.env.MEDIA.put(key, bytes, { httpMetadata: { contentType: mime } });
  try {
    await c.env.DB.prepare("UPDATE media_assets SET r2_key = ?, filename = ?, mime_type = ?, size_bytes = ?, width = ?, height = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(key, filename, mime, bytes.byteLength, dims?.width ?? null, dims?.height ?? null, id)
      .run();
  } catch (e) {
    await c.env.MEDIA.delete(key);
    throw e;
  }
  if (row.r2_key !== key) await c.env.MEDIA.delete(row.r2_key); // the old bytes are no longer reachable
  return c.json({ asset: out((await getAsset(c.env.DB, id))!) });
});

/* ---------- delete (one or many) ---------- */

// Deleting clears references (foreign keys are SET NULL, gallery rows cascade). The library UI shows /usage first and asks for confirmation.
mediaAdminRoutes.delete("/media/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT r2_key FROM media_assets WHERE id = ?").bind(id).first<{ r2_key: string }>();
  if (!row) return apiError(c, 404, "not_found", "Image not found.");
  await c.env.DB.prepare("DELETE FROM media_assets WHERE id = ?").bind(id).run();
  await c.env.MEDIA.delete(row.r2_key);
  return c.json({ ok: true });
});

const bulkBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delete"), ids: z.array(z.string()).min(1).max(100) }),
  z.object({ action: z.literal("move"), ids: z.array(z.string()).min(1).max(100), folderId: z.string().nullable() }),
]);

mediaAdminRoutes.post("/media/bulk", async (c) => {
  const p = await parseBody(c, bulkBody);
  if ("res" in p) return p.res;
  const ids = [...new Set(p.data.ids)];
  const marks = ids.map(() => "?").join(",");
  if (p.data.action === "move") {
    if (p.data.folderId) {
      const f = await c.env.DB.prepare("SELECT id FROM media_folders WHERE id = ?").bind(p.data.folderId).first();
      if (!f) return apiError(c, 400, "bad_folder", "That folder does not exist.", { field: "folderId" });
    }
    await c.env.DB.prepare(`UPDATE media_assets SET folder_id = ?, updated_at = datetime('now') WHERE id IN (${marks})`).bind(p.data.folderId || null, ...ids).run();
    return c.json({ ok: true, count: ids.length });
  }
  const { results } = await c.env.DB.prepare(`SELECT id, r2_key FROM media_assets WHERE id IN (${marks})`).bind(...ids).all<{ id: string; r2_key: string }>();
  if (results.length === 0) return apiError(c, 404, "not_found", "Those images were not found.");
  await c.env.DB.prepare(`DELETE FROM media_assets WHERE id IN (${results.map(() => "?").join(",")})`).bind(...results.map((r) => r.id)).run();
  await c.env.MEDIA.delete(results.map((r) => r.r2_key));
  return c.json({ ok: true, count: results.length });
});
