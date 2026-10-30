import type { Context } from "hono";
import { z } from "zod";
import { apiError } from "./http";

/** Parse a JSON body with a zod schema. Returns the data, or a ready 400 Response. */
export async function parseBody<S extends z.ZodType>(c: Context, schema: S): Promise<{ data: z.infer<S> } | { res: Response }> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return { res: apiError(c, 400, "invalid_json", "Request body must be JSON.") };
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    const issue = r.error.issues[0];
    const field = issue?.path.join(".") || "body";
    return { res: apiError(c, 400, "validation_failed", `${field}: ${issue?.message ?? "invalid"}`, { field }) };
  }
  return { data: r.data };
}

/** Links we accept for users to put on the public site: web URLs and mailto only. Never javascript: or data:. */
export const safeUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return ["http:", "https:", "mailto:"].includes(u.protocol);
    } catch {
      return false;
    }
  }, "must be a full http(s) or mailto link");

/** Navigation targets: an internal path like /about or a full URL. "//host" is refused (protocol-relative). */
export const navTarget = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    if (v.startsWith("/")) return !v.startsWith("//") && !/[\s\\]/.test(v);
    try {
      return ["http:", "https:", "mailto:"].includes(new URL(v).protocol);
    } catch {
      return false;
    }
  }, "must be a path starting with / or a full http(s) link");

export function isTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
