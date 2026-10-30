import { api } from "./api";

export interface MediaItem {
  id: string; filename: string; name: string; mimeType: string; sizeBytes: number;
  width: number | null; height: number | null; altText: string | null; folderId: string | null;
  url: string; createdAt: string; updatedAt: string; usedCount: number;
}
export interface MediaFolder { id: string; name: string; createdAt: string; assetCount: number }
export interface MediaUsage { type: string; label: string; id?: string }

export const LIBRARY_MAX_MB = 8; // same as the Worker (MAX_BYTES.library)
export const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const OK_TYPES = ACCEPT.split(",");

/** Returns a plain-language problem, or null when the file can be uploaded to the library. */
export function checkLibraryType(file: File): string | null {
  return OK_TYPES.includes(file.type) ? null : `${file.name}: only PNG, JPEG, WebP, and GIF images are allowed.`;
}
export function checkLibraryFile(file: File): string | null {
  const t = checkLibraryType(file);
  if (t) return t;
  if (file.size > LIBRARY_MAX_MB * 1048576) return `${file.name} is ${(file.size / 1048576).toFixed(1)} MB. The limit is ${LIBRARY_MAX_MB} MB.`;
  return null;
}

export async function uploadToLibrary(file: File, folderId: string | null, alt?: string): Promise<MediaItem> {
  const form = new FormData();
  form.set("file", file);
  form.set("purpose", "library");
  if (folderId) form.set("folderId", folderId);
  if (alt) form.set("alt", alt);
  return (await api.upload<{ asset: MediaItem }>("/api/admin/media/upload", form)).asset;
}

export async function replaceAsset(id: string, file: File): Promise<MediaItem> {
  const form = new FormData();
  form.set("file", file);
  return (await api.upload<{ asset: MediaItem }>(`/api/admin/media/${id}/replace`, form)).asset;
}

export function listMedia(params: { q?: string; folder?: string; sort?: string; limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.folder && params.folder !== "all") qs.set("folder", params.folder);
  if (params.sort && params.sort !== "newest") qs.set("sort", params.sort);
  if (params.limit) qs.set("limit", String(params.limit));
  const s = qs.toString();
  return api.get<{ items: MediaItem[]; totalAssets: number; totalBytes: number }>(`/api/admin/media${s ? "?" + s : ""}`);
}
export const listFolders = () => api.get<{ items: MediaFolder[] }>("/api/admin/media/folders");
