import { z } from "zod";
import { mediaUrl } from "./media";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color.");
export const themeTokensSchema = z.object({
  colors: z.object({
    bg:hex,surface:hex,raised:hex,line:hex,lineStrong:hex,ink:hex,muted:hex,
    accent:hex,accentStrong:hex,accentSoft:hex,danger:hex,ok:hex,
  }).strict(),
  background: z.object({
    mode:z.enum(["solid","gradient","image","video"]),
    color:hex,gradientStart:hex,gradientEnd:hex,
    gradientAngle:z.number().int().min(0).max(360),
    assetId:z.string().trim().min(1).max(100).nullable(),
    overlay:z.number().int().min(0).max(90),
    position:z.enum(["center","top","bottom"]),
  }).strict(),
  cards:z.object({
    background:hex,border:hex,radius:z.number().min(0).max(32),
    shadow:z.enum(["none","soft","strong"]),blur:z.number().min(0).max(24),
  }).strict(),
  typography:z.object({
    family:z.enum(["system","serif","mono"]),monoFamily:z.enum(["system","mono"]),
    baseSize:z.number().int().min(12).max(20),headingScale:z.number().min(1).max(1.8),
    fontWeight:z.number().int().min(300).max(800),lineHeight:z.number().min(1.2).max(2),
  }).strict(),
  layout:z.object({
    containerWidth:z.number().int().min(640).max(1440),
    density:z.enum(["compact","comfortable","spacious"]),spacing:z.number().int().min(4).max(32),
  }).strict(),
  animation:z.object({
    enabled:z.boolean(),intensity:z.enum(["subtle","balanced","expressive"]),
    duration:z.number().int().min(80).max(800),hoverEffects:z.boolean(),pageTransitions:z.boolean(),
  }).strict(),
}).strict();
export type ThemeTokens = z.infer<typeof themeTokensSchema>;

export const DEFAULT_THEME_TOKENS:ThemeTokens={
  "colors": {
    "bg": "#0b0a10",
    "surface": "#13111b",
    "raised": "#1a1725",
    "line": "#2a2638",
    "lineStrong": "#3a3550",
    "ink": "#ece9f5",
    "muted": "#8d87a3",
    "accent": "#8b5cf6",
    "accentStrong": "#7c3aed",
    "accentSoft": "#a78bfa",
    "danger": "#f0616d",
    "ok": "#4ade80"
  },
  "background": {
    "mode": "gradient",
    "color": "#0b0a10",
    "gradientStart": "#17112a",
    "gradientEnd": "#0b0a10",
    "gradientAngle": 145,
    "assetId": null,
    "overlay": 25,
    "position": "center"
  },
  "cards": {
    "background": "#13111b",
    "border": "#2a2638",
    "radius": 14,
    "shadow": "soft",
    "blur": 10
  },
  "typography": {
    "family": "system",
    "monoFamily": "mono",
    "baseSize": 14,
    "headingScale": 1.25,
    "fontWeight": 400,
    "lineHeight": 1.55
  },
  "layout": {
    "containerWidth": 1024,
    "density": "comfortable",
    "spacing": 16
  },
  "animation": {
    "enabled": true,
    "intensity": "subtle",
    "duration": 180,
    "hoverEffects": true,
    "pageTransitions": true
  }
};

export function parseThemeTokens(raw:string|null|undefined):ThemeTokens{
  try{return themeTokensSchema.parse(JSON.parse(raw??"{}"));}catch{return DEFAULT_THEME_TOKENS;}
}

export async function loadPublicTheme(db:D1Database){
  try{
    const row=await db.prepare("SELECT name,tokens_json FROM themes WHERE is_active=1 LIMIT 1").first<{name:string;tokens_json:string}>();
    if(!row)return {name:"Midnight Violet",tokens:DEFAULT_THEME_TOKENS};
    const tokens=parseThemeTokens(row.tokens_json);
    let assetUrl:string|null=null;
    const assetId=tokens.background.assetId;
    if(assetId&&(tokens.background.mode==="image"||tokens.background.mode==="video")){
      const kind=tokens.background.mode;
      const asset=await db.prepare("SELECT id,filename FROM media_assets WHERE id=? AND kind=?").bind(assetId,kind).first<{id:string;filename:string}>();
      if(asset)assetUrl=mediaUrl(asset.id,asset.filename);
    }
    const {assetId:_assetId,...background}=tokens.background;
    return {name:row.name,tokens:{...tokens,background:{...background,assetUrl}}};
  }catch{return {name:"Midnight Violet",tokens:DEFAULT_THEME_TOKENS};}
}
