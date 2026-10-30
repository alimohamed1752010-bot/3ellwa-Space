// Image handling: type detection, limits, names, URLs. Used by the upload routes and the media library (Part 4).
export const IMAGE_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
} as const;
export type ImageMime = keyof typeof IMAGE_TYPES;

export const MAX_BYTES = { avatar: 2 * 1024 * 1024, banner: 5 * 1024 * 1024, link: 1024 * 1024, library: 8 * 1024 * 1024 } as const;
export type UploadPurpose = keyof typeof MAX_BYTES;

/** Detect the real type from the file's first bytes. The client-sent type is never trusted. SVG is refused on purpose (script risk). */
export function sniffImage(b: Uint8Array): ImageMime | null {
  const eq = (off: number, s: number[]) => s.every((v, i) => b[off + i] === v);
  if (b.length >= 8 && eq(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (b.length >= 3 && eq(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (b.length >= 12 && eq(0, [0x52, 0x49, 0x46, 0x46]) && eq(8, [0x57, 0x45, 0x42, 0x50])) return "image/webp";
  if (b.length >= 6 && (eq(0, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || eq(0, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))) return "image/gif";
  return null;
}

/** "My Photo (1).PNG" -> "my-photo-1" */
export function safeBaseName(name: string): string {
  const base = name.replace(/\.[^.]*$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return base || "image";
}

export function mediaUrl(id: string | null | undefined, filename: string | null | undefined): string | null {
  return id && filename ? `/media/${encodeURIComponent(id)}/${encodeURIComponent(filename)}` : null;
}

// A replaced file gets a new name tag ("photo~a1b2c3.png") so its URL changes while the asset id stays the same.
// Every URL is immutable-cached, so a new URL is what makes browsers fetch the new bytes. safeBaseName never produces "~".
const TAG = /~[0-9a-f]{6}$/;
export function splitFilename(filename: string): { base: string; tag: string; ext: string } {
  const dot = filename.lastIndexOf(".");
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot + 1) : "";
  const m = stem.match(TAG);
  return { base: m ? stem.slice(0, -m[0].length) : stem, tag: m ? m[0] : "", ext };
}
export function buildFilename(base: string, tag: string, ext: string): string {
  return `${base}${tag}.${ext}`;
}
/** What the owner sees: the name without the cache tag, e.g. "photo.png". */
export function displayName(filename: string): string {
  const { base, ext } = splitFilename(filename);
  return ext ? `${base}.${ext}` : base;
}
export function newTag(): string {
  const b = new Uint8Array(3);
  crypto.getRandomValues(b);
  return "~" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
