// Client-side image helpers: pure geometry (unit tested) and a canvas step that crops, resizes, and compresses before upload.

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

/** Scale (w, h) down so the longer edge is at most `max`. Never scales up. max 0 means keep the size. */
export function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  if (!max || Math.max(w, h) <= max) return { width: w, height: h };
  const s = max / Math.max(w, h);
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}

export interface View { frameW: number; frameH: number; imgW: number; imgH: number; zoom: number; offsetX: number; offsetY: number }

/** Scale at zoom 1: the smallest scale that still covers the whole frame. */
export function coverScale(v: Pick<View, "frameW" | "frameH" | "imgW" | "imgH">): number {
  return Math.max(v.frameW / v.imgW, v.frameH / v.imgH);
}

/** Keep the image covering the frame: offsets are the image's top-left relative to the frame, so they must be <= 0 and >= frame - shown size. */
export function clampOffset(v: View): { offsetX: number; offsetY: number } {
  const s = coverScale(v) * v.zoom;
  const minX = Math.min(0, v.frameW - v.imgW * s);
  const minY = Math.min(0, v.frameH - v.imgH * s);
  return { offsetX: Math.min(0, Math.max(minX, v.offsetX)), offsetY: Math.min(0, Math.max(minY, v.offsetY)) };
}

/** Offsets that centre the image in the frame at the given zoom. */
export function centeredOffset(v: Pick<View, "frameW" | "frameH" | "imgW" | "imgH" | "zoom">): { offsetX: number; offsetY: number } {
  const s = coverScale(v) * v.zoom;
  return { offsetX: (v.frameW - v.imgW * s) / 2, offsetY: (v.frameH - v.imgH * s) / 2 };
}

/** The part of the original image (in its own pixels) that is visible inside the frame. */
export function sourceRect(v: View): { x: number; y: number; w: number; h: number } {
  const s = coverScale(v) * v.zoom;
  const { offsetX, offsetY } = clampOffset(v);
  const x = Math.max(0, -offsetX / s);
  const y = Math.max(0, -offsetY / s);
  const w = Math.min(v.imgW - x, v.frameW / s);
  const h = Math.min(v.imgH - y, v.frameH / s);
  return { x, y, w, h };
}

/** Largest frame with the given aspect ratio (w / h) that fits inside a box. */
export function frameFor(aspect: number, boxW: number, boxH: number): { frameW: number; frameH: number } {
  let w = boxW;
  let h = w / aspect;
  if (h > boxH) { h = boxH; w = h * aspect; }
  return { frameW: Math.round(w), frameH: Math.round(h) };
}

export type OutFormat = "webp" | "jpeg" | "png";
const MIME: Record<OutFormat, string> = { webp: "image/webp", jpeg: "image/jpeg", png: "image/png" };
const EXT: Record<OutFormat, string> = { webp: "webp", jpeg: "jpg", png: "png" };

export interface ProcessOptions {
  crop?: { x: number; y: number; w: number; h: number }; // in source pixels; omitted = whole image
  maxEdge?: number; // longer edge in pixels, 0 or omitted = keep
  quality?: number; // 0..1 for webp and jpeg
  format?: OutFormat;
}

export async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

/** Crop, resize, and re-encode. Returns a new File named like the original with the new extension. Never throws on a bad encode: callers fall back to the original. */
export async function processImage(file: File, bitmap: ImageBitmap, opts: ProcessOptions): Promise<File> {
  const crop = opts.crop ?? { x: 0, y: 0, w: bitmap.width, h: bitmap.height };
  const { width, height } = fitWithin(Math.round(crop.w), Math.round(crop.h), opts.maxEdge ?? 0);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot process images.");
  ctx.imageSmoothingQuality = "high";
  const format = opts.format ?? "webp";
  if (format === "jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height); } // JPEG has no transparency
  ctx.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, width, height);
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, MIME[format], opts.quality ?? 0.85));
  if (!blob || blob.type !== MIME[format]) throw new Error(`This browser cannot save ${format.toUpperCase()} images.`);
  const base = file.name.replace(/\.[^.]*$/, "") || "image";
  return new File([blob], `${base}.${EXT[format]}`, { type: blob.type });
}

/** Animated GIFs would lose their animation on a canvas, so they are never re-encoded. */
export const canReencode = (file: File) => file.type !== "image/gif";

/**
 * Quiet default used for multi-file uploads: shrink big photos, keep small files and GIFs untouched, and never return something larger than the original.
 */
export async function autoOptimize(file: File, maxEdge = 2560): Promise<File> {
  if (!canReencode(file) || file.size < 300 * 1024) return file;
  try {
    const bmp = await loadBitmap(file);
    const out = await processImage(file, bmp, { maxEdge, quality: 0.85, format: "webp" });
    bmp.close();
    return out.size < file.size ? out : file;
  } catch {
    return file;
  }
}
