import { useCallback, useEffect, useState } from "react";
import type { ComponentType } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { api, setUnauthorizedHandler } from "../shared/api";
import { ToastProvider, useToast } from "../shared/ui";
import EmptyScreen from "./EmptyScreen";
import LinksScreen from "./links/LinksScreen";
import Layout from "./Layout";
import MediaScreen from "./media/MediaScreen";
import Login from "./Login";
import { NAV } from "./nav";
import NavigationScreen from "./navigation/NavigationScreen";
import ProfileScreen from "./profile/ProfileScreen";
import PageManager from "./PageManager";

// Screens that exist so far. Everything else in NAV is still an EmptyScreen (see nav.ts for the part that builds it).
const SCREENS: Record<string, ComponentType> = { profile: ProfileScreen, navigation: NavigationScreen, links: LinksScreen, media: MediaScreen, pages: PageManager };

type Auth = "loading" | "anon" | "authed";

function Gate() {
  const [auth, setAuth] = useState<Auth>("loading");
  const toast = useToast();

  useEffect(() => {
    api.get<{ authenticated: boolean }>("/api/auth/me")
      .then((r) => setAuth(r.authenticated ? "authed" : "anon"))
      .catch(() => setAuth("anon"));
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setAuth("anon"));
    return () => setUnauthorizedHandler(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
      setAuth("anon");
    } catch {
      toast.show("Could not log out. Try again.", "error");
    }
  }, [toast]);

  if (auth === "loading") {
    return (
      <div className="grid min-h-screen place-items-center" role="status" aria-label="Loading">
        <span className="size-5 animate-spin rounded-full border-2 border-accent-soft border-t-transparent" />
      </div>
    );
  }
  if (auth === "anon") return <Login onAuthed={() => setAuth("authed")} />;

  return (
    <Routes>
      <Route element={<Layout onLogout={logout} />}>
        {NAV.map((item) => {
          const Screen = SCREENS[item.to];
          return <Route key={item.to} index={item.to === ""} path={item.to === "" ? undefined : item.to} element={Screen ? <Screen /> : <EmptyScreen item={item} />} />;
        })}
        <Route path="*" element={<EmptyScreen item={{ to: "", label: "Not found", part: 0, blurb: "That admin screen does not exist." }} />} />
      </Route>
    </Routes>
  );
}

export default function AdminApp({ basename }: { basename: string }) {
  return (
    <ToastProvider>
      <BrowserRouter basename={basename}>
        <Gate />
      </BrowserRouter>
    </ToastProvider>
  );
}
