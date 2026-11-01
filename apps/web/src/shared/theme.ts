import type { ProfileColors } from "./profileColors";
import type { FxTokens } from "./fx";

export interface ThemeTokens {
  colors:{bg:string;surface:string;raised:string;line:string;lineStrong:string;ink:string;muted:string;accent:string;accentStrong:string;accentSoft:string;danger:string;ok:string};
  background:{mode:"solid"|"gradient"|"image"|"video";color:string;gradientStart:string;gradientEnd:string;gradientAngle:number;assetId?:string|null;assetUrl?:string|null;overlay:number;position:"center"|"top"|"bottom"};
  cards:{background:string;border:string;radius:number;shadow:"none"|"soft"|"strong";blur:number};
  typography:{family:"system"|"serif"|"mono";monoFamily:"system"|"mono";baseSize:number;headingScale:number;fontWeight:number;lineHeight:number};
  layout:{containerWidth:number;density:"compact"|"comfortable"|"spacious";spacing:number};
  animation:{enabled:boolean;intensity:"subtle"|"balanced"|"expressive";duration:number;hoverEffects:boolean;pageTransitions:boolean};
  profile?:ProfileColors;
  fx?:FxTokens;
}
export interface PublicTheme { name:string; tokens:ThemeTokens }

const fontFamilies={
 system:'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
 serif:'ui-serif, Georgia, Cambria, "Times New Roman", serif',
 mono:'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
};
const monoFamilies={system:fontFamilies.system,mono:fontFamilies.mono};

export function applyThemeTokens(tokens:ThemeTokens){
 const root=document.documentElement;
 const c=tokens.colors;
 const vars:Record<string,string>={
  "--3w-bg":c.bg,"--3w-surface":c.surface,"--3w-raised":c.raised,"--3w-line":c.line,"--3w-line-strong":c.lineStrong,
  "--3w-ink":c.ink,"--3w-muted":c.muted,"--3w-accent":c.accent,"--3w-accent-strong":c.accentStrong,"--3w-accent-soft":c.accentSoft,
  "--3w-danger":c.danger,"--3w-ok":c.ok,
  "--3w-card-bg":tokens.cards.background,"--3w-card-border":tokens.cards.border,"--3w-card-radius":tokens.cards.radius+"px",
  "--3w-card-blur":tokens.cards.blur+"px",
  "--3w-card-shadow":tokens.cards.shadow==="none"?"none":tokens.cards.shadow==="strong"?"0 18px 50px -22px rgb(0 0 0 / .8)":"0 10px 30px -18px rgb(0 0 0 / .8)",
  "--3w-font-sans":fontFamilies[tokens.typography.family],"--3w-font-mono":monoFamilies[tokens.typography.monoFamily],
  "--3w-font-size":tokens.typography.baseSize+"px","--3w-line-height":String(tokens.typography.lineHeight),
  "--3w-container-width":tokens.layout.containerWidth+"px","--3w-spacing":tokens.layout.spacing+"px",
  "--3w-motion-duration":tokens.animation.duration+"ms",
  "--3w-hover-duration":Math.round(tokens.animation.duration*.9)+"ms",
  "--3w-lift-distance":tokens.animation.intensity==="subtle"?"-2px":tokens.animation.intensity==="balanced"?"-3px":"-5px",
  "--3w-hover-scale":tokens.animation.intensity==="subtle"?"1.01":tokens.animation.intensity==="balanced"?"1.02":"1.03",
  "--3w-bg-position":tokens.background.position,
  "--3w-bg-overlay":String(tokens.background.overlay/100),
 };
 if(tokens.background.mode==="solid")vars["--3w-bg-image"]="none";
 else if(tokens.background.mode==="gradient")vars["--3w-bg-image"]=`linear-gradient(${tokens.background.gradientAngle}deg, ${tokens.background.gradientStart}, ${tokens.background.gradientEnd})`;
 else if(tokens.background.mode==="image"&&tokens.background.assetUrl)vars["--3w-bg-image"]=`linear-gradient(rgb(0 0 0 / ${tokens.background.overlay/100}), rgb(0 0 0 / ${tokens.background.overlay/100})), url("${tokens.background.assetUrl}")`;
 else vars["--3w-bg-image"]="none";
 for(const [name,value] of Object.entries(vars))root.style.setProperty(name,value);
 root.dataset.motion=tokens.animation.enabled?"on":"off";
 root.dataset.density=tokens.layout.density;
}