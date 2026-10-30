import { useCallback, useEffect, useState } from "react";
import { api } from "../shared/api";
import type { PublicLink } from "./LinkCard";

export interface PublicLinks {
  groups: Array<{ id: string | null; name: string | null; description: string | null; color: string | null; links: PublicLink[] }>;
  featured: PublicLink[];
  total: number;
}

export function useLinks() {
  const [state, setState] = useState<{ status: "loading" | "error" | "ready"; data?: PublicLinks }>({ status: "loading" });
  const load = useCallback(() => {
    setState({ status: "loading" });
    api.get<PublicLinks>("/api/public/links").then((data) => setState({ status: "ready", data })).catch(() => setState({ status: "error" }));
  }, []);
  useEffect(load, [load]);
  return { ...state, retry: load };
}

/** Homepage picks: featured links if any, otherwise the first few. */
export function homepagePicks(d: PublicLinks, max = 6): PublicLink[] {
  const all = d.groups.flatMap((g) => g.links);
  return (d.featured.length ? d.featured : all).slice(0, max);
}
