"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { PinPad } from "./pin-pad";

/** Modal sheet around the PIN pad (bottom sheet on phones, centred card on larger screens). */
export function PinDialog({ open, onClose, ...pad }: { open: boolean; onClose: () => void } & Parameters<typeof PinPad>[0]) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={pad.title}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-t-3xl bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl sm:pb-6">
        <button type="button" onClick={onClose} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
        <PinPad {...pad} />
      </div>
    </div>
  );
}
