"use client";

import { useEffect, useRef, useState } from "react";
import { Cloud, CloudOff, HardDrive, Loader2, Lock, LogOut, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/components/ui";
import { useLearner } from "@/hooks/use-learner";
import { initials } from "@/lib/learner/names";
import { pushNow, switchLearner } from "@/lib/learner/sync";
import type { SyncStatus } from "@/lib/learner/store";

export function syncLabel(s: SyncStatus): { text: string; icon: typeof Cloud; tone: string } {
  switch (s.state) {
    case "local-only":
      return { text: "Saved on this device", icon: HardDrive, tone: "text-muted" };
    case "saving":
      return { text: "Saving…", icon: Loader2, tone: "text-muted" };
    case "offline":
      return { text: "Offline — will sync later", icon: CloudOff, tone: "text-warn" };
    case "error":
      return { text: s.message ?? "Sync problem", icon: AlertTriangle, tone: "text-danger" };
    case "locked":
      return { text: "PIN needed to sync — see Settings", icon: Lock, tone: "text-warn" };
    default:
      return { text: s.lastSyncedAt ? "Synced to your profile" : "Synced", icon: Cloud, tone: "text-success" };
  }
}

/** Header chip with the learner's name, sync status and "Switch learner". */
export function LearnerMenu() {
  const { learner, status } = useLearner();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!learner) return null;
  const s = syncLabel(status);
  const Icon = s.icon;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-1 text-sm hover:bg-surface-2 sm:pr-3"
        data-testid="learner-chip"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-guitar to-piano text-xs font-semibold text-white" aria-hidden>
          {initials(learner.name)}
        </span>
        <span className="hidden max-w-28 truncate font-medium sm:block">{learner.name}</span>
        <Icon className={cn("hidden h-3.5 w-3.5 sm:block", s.tone, status.state === "saving" && "animate-spin")} aria-label={s.text} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-40 w-64 rounded-2xl border border-border bg-surface p-2 shadow-card">
          <div className="px-3 py-2">
            <p className="font-semibold">{learner.name}</p>
            <p className={cn("mt-0.5 flex items-center gap-1.5 text-xs", s.tone)} role="status">
              <Icon className={cn("h-3.5 w-3.5", status.state === "saving" && "animate-spin")} /> {s.text}
            </p>
          </div>
          {learner.id && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-surface-2"
              onClick={async () => {
                await pushNow();
                toast.success("Progress saved to your profile");
              }}
            >
              <RefreshCw className="h-4 w-4" /> Sync now
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-surface-2"
            data-testid="switch-learner"
            onClick={async () => {
              const r = await switchLearner();
              setOpen(false);
              if (!r.ok) toast.error(r.message);
            }}
          >
            <LogOut className="h-4 w-4" /> Switch learner
          </button>
        </div>
      )}
    </div>
  );
}
