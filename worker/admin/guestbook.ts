import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { apiError } from "../lib/http";
import { parseBody } from "../lib/validate";

export const guestbookAdminRoutes = new Hono<AppEnv>();

guestbookAdminRoutes.get("/guestbook", async (c) => {
  const status = c.req.query("status") ?? "pending";
  if (!["pending","approved","rejected","all"].includes(status)) return apiError(c,400,"invalid_status","Unknown guestbook status.");
  const where = status === "all" ? "" : "WHERE status=?";
  const query = `SELECT id,name,message,status,created_at AS createdAt FROM guestbook_entries ${where} ORDER BY created_at DESC LIMIT 200`;
  const result = status === "all" ? await c.env.DB.prepare(query).all() : await c.env.DB.prepare(query).bind(status).all();
  return c.json({items:result.results});
});

guestbookAdminRoutes.put("/guestbook/:id/status", async (c) => {
  const parsed = await parseBody(c,z.object({status:z.enum(["pending","approved","rejected"])}));
  if ("res" in parsed) return parsed.res;
  const result = await c.env.DB.prepare("UPDATE guestbook_entries SET status=? WHERE id=?").bind(parsed.data.status,c.req.param("id")).run();
  if (!result.meta.changes) return apiError(c,404,"not_found","Guestbook entry not found.");
  return c.json({ok:true});
});

guestbookAdminRoutes.delete("/guestbook/:id", async (c) => {
  const result = await c.env.DB.prepare("DELETE FROM guestbook_entries WHERE id=?").bind(c.req.param("id")).run();
  if (!result.meta.changes) return apiError(c,404,"not_found","Guestbook entry not found.");
  return c.json({ok:true});
});
