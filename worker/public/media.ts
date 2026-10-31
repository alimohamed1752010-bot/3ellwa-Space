import { Hono } from "hono";
import type { AppEnv } from "../env";
import { IMAGE_TYPES } from "../lib/media";

export const mediaPublicRoutes = new Hono<AppEnv>();

// The random asset id selects the immutable object; the filename is cosmetic.
mediaPublicRoutes.get("/:assetId/:name", async (c) => {
  const notFound = () => new Response("Not found", { status: 404 });
  const row = await c.env.DB.prepare("SELECT r2_key,mime_type,kind FROM media_assets WHERE id=?").bind(c.req.param("assetId")).first<{r2_key:string;mime_type:string;kind:string}>();
  if(!row)return notFound();
  const validImage=row.kind==="image"&&row.mime_type in IMAGE_TYPES;
  const validVideo=row.kind==="video"&&(row.mime_type==="video/mp4"||row.mime_type==="video/webm");
  if(!validImage&&!validVideo)return notFound();
  const obj=await c.env.MEDIA.get(row.r2_key);
  if(!obj)return notFound();
  const headers=new Headers({
    "content-type":row.mime_type,
    "cache-control":"public, max-age=31536000, immutable",
    etag:obj.httpEtag,
    "x-content-type-options":"nosniff",
    "cross-origin-resource-policy":"same-origin",
  });
  if(validImage)headers.set("content-security-policy","default-src 'none'; sandbox");
  if(c.req.header("if-none-match")===obj.httpEtag)return new Response(null,{status:304,headers});
  return new Response(c.req.method==="HEAD"?null:obj.body,{headers});
});
