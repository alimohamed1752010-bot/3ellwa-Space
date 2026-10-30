export interface Badge { label: string; icon?: string; color?: string }
export interface Profile {
  displayName: string; username: string; shortBio: string; extendedBio: string;
  subtitles: string[]; typingEnabled: boolean; statusText: string;
  onlineMode: "hidden" | "online" | "offline" | "auto";
  locationText: string; showLocation: boolean; timezone: string | null; showLocalTime: boolean;
  avatarAssetId: string | null; bannerAssetId: string | null; avatarUrl: string | null; bannerUrl: string | null;
  badges: Badge[];
}
export interface MediaAsset { id: string; filename: string; mimeType: string; sizeBytes: number; url: string }
export interface SocialLink { id: string; platform: string; label: string | null; url: string; icon: string | null; visible: boolean }

/** Only the fields the PUT endpoint accepts (no preview URLs or timestamps). */
export function toPayload(p: Profile) {
  const { avatarUrl: _a, bannerUrl: _b, ...rest } = p;
  return { ...rest, timezone: p.timezone || null };
}

export const IMAGE_LIMITS = { avatar: 2, banner: 5, link: 1 } as const; // MB, same as the Worker
export const IMAGE_ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Check a file before upload so the owner gets a clear message without waiting for the server. */
export function checkImageFile(file: File, purpose: "avatar" | "banner" | "link"): string | null {
  if (!IMAGE_ACCEPT.includes(file.type)) return "Only PNG, JPEG, WebP, and GIF images are allowed.";
  const max = IMAGE_LIMITS[purpose];
  if (file.size > max * 1048576) return `That file is ${(file.size / 1048576).toFixed(1)} MB. The ${purpose} limit is ${max} MB.`;
  return null;
}
