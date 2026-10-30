import { useCallback, useEffect, useState } from "react";
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
  return !(p.displayName || p.username || p.shortBio || p.extendedBio || p.statusText || p.avatarUrl || p.bannerUrl || p.subtitles.length || p.badges.length || s.social.length || s.navigation.length);
}
