import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}

/** Built on the native <dialog>: focus trap, Esc to close, and inert background come from the browser. */
export function Modal({ open, onClose, title, children, footer, size = "md" }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
      aria-label={title}
      className={`m-auto max-h-[92vh] overflow-y-auto rounded-card ${size === "lg" ? "w-[min(94vw,40rem)]" : "w-[min(92vw,28rem)]"} border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm`}
    >
      {open && (
        <div className="rise">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-base font-medium">{title}</h2>
          </div>
          <div className="px-5 py-4 text-sm text-muted">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
