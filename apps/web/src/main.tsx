import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import PublicApp from "./public/PublicApp";

// The Worker injects these meta tags so the app knows which shell to render.
const meta = (name: string) => document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ?? "";
const isAdmin = meta("3w-shell") === "admin";

// Admin code is a separate chunk that public visitors never download.
const AdminApp = lazy(() => import("./admin/AdminApp"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isAdmin ? (
      <Suspense fallback={null}>
        <AdminApp basename={meta("3w-base")} />
      </Suspense>
    ) : (
      <PublicApp />
    )}
  </StrictMode>
);
