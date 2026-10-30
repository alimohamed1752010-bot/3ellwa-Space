import { useEffect } from "react";

// One flag for "the current screen has unsaved edits". Layout asks before following a sidebar link;
// beforeunload covers closing the tab or reloading. (BrowserRouter has no route blocker, so this stays small and explicit.)
let dirty = false;
export const hasUnsavedChanges = () => dirty;
export const UNSAVED_MESSAGE = "You have unsaved changes. Leave without saving?";

export function useUnsavedGuard(isDirty: boolean) {
  useEffect(() => {
    dirty = isDirty;
    if (!isDirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [isDirty]);
  useEffect(() => () => { dirty = false; }, []);
}
