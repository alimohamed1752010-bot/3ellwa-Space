import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "../cn";

type Tone = "info" | "success" | "error";
interface ToastItem { id: number; tone: Tone; message: string }
interface ToastApi { show: (message: string, tone?: Tone) => void }

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);

  const show = useCallback((message: string, tone: Tone = "info") => {
    const id = next.current++;
    setItems((cur) => [...cur.slice(-3), { id, tone, message }]);
    window.setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), tone === "error" ? 7000 : 4000);
  }, []);
  const api = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rise pointer-events-auto max-w-md rounded-control border px-4 py-2.5 text-sm shadow-xl backdrop-blur",
              t.tone === "success" && "border-ok/30 bg-ok/10 text-ok",
              t.tone === "error" && "border-danger/40 bg-danger/10 text-danger",
              t.tone === "info" && "border-line-strong bg-raised/90 text-ink"
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast must be used inside <ToastProvider>");
  return v;
}
