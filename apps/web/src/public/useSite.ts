import { createContext, createElement, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { applyThemeTokens, type PublicTheme } from "../shared/theme";
import { api } from "../shared/api";

export interface PublicSite {
  profile: {
    displayName: string; username: string; shortBio: string; extendedBio: string;
    subtitles: string[]; typingEnabled: boolean; statusText: string;
    onlineMode: "hidden" | "online" | "offline";
    location: string | null; timezone: string | null;
    avatarUrl: string | null; bannerUrl: string | null;
    badges: Array<{ label: string; icon?: string; color?: string }>;
  };
  social: Array<{ id: string; platform: string; label: string | null; url: string; icon: string | null }>;
  navigation: Array<{ id: string; label: string; href: string; newTab: boolean }>;
  site: { title: string };
  theme: PublicTheme;
  layout: { sections: Array<{id:string;type:"profile"|"links"|"projects"|"text"|"gallery"|"widget"|"spacer";title:string;body:string;assetId:string|null;widgetId:string|null;enabled:boolean;visibleDesktop:boolean;visibleMobile:boolean;imageUrl:string|null}> };
}

export function useSite() {
  const [state, setState] = useState<{ status: "loading" | "error" | "ready"; data?: PublicSite }>({ status: "loading" });
  const load = useCallback(() => {
    setState({ status: "loading" });
    api.get<PublicSite>("/api/public/site").then((data) => setState({ status: "ready", data })).catch(() => setState({ status: "error" }));
  }, []);
  useEffect(load, [load]);
  return { ...state, retry: load };
}

/** True when nothing worth showing has been configured yet. */
export function isEmptySite(s: PublicSite): boolean {
  const p = s.profile;
  const customSections=s.layout?.sections?.some(x=>x.enabled&&x.type!=="profile"&&x.type!=="links"&&x.type!=="spacer");
  return !(customSections || p.displayName || p.username || p.shortBio || p.extendedBio || p.statusText || p.avatarUrl || p.bannerUrl || p.subtitles.length || p.badges.length || s.social.length || s.navigation.length);
}

type SiteState=ReturnType<typeof useSite>;
const SiteContext=createContext<SiteState|null>(null);

export function PublicSiteProvider({children}:{children:ReactNode}){
 const state=useSite();
 useEffect(()=>{if(state.status==="ready"&&state.data?.theme?.tokens)applyThemeTokens(state.data.theme.tokens);},[state.status,state.data]);
 const bg=state.status==="ready"?state.data?.theme?.tokens?.background:null;
 const video=bg?.mode==="video"&&bg.assetUrl?createElement("video",{id:"theme-background-video",key:bg.assetUrl,"aria-hidden":true,autoPlay:true,muted:true,loop:true,playsInline:true,src:bg.assetUrl}):null;
 return createElement(SiteContext.Provider,{value:state},video,children);
}

export function usePublicSite(){
 const state=useContext(SiteContext);
 if(!state)throw new Error("usePublicSite must be used inside PublicSiteProvider.");
 return state;
}
