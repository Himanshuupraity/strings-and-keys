"use client";

import { Badge } from "@/components/ui";
import { STATE_LABEL, type SongStatus } from "@/lib/songs/status";

const TONE = { new: "neutral", learning: "piano", "can-play": "accent", mastered: "success" } as const;

/** "Learning", "Can play · 50%", "Mastered" — from the student's own section marks. */
export function SongStatusChip({ status, className }: { status: SongStatus; className?: string }) {
  if (status.state === "new") return null;
  const pct = Math.round(status.pct * 100);
  return (
    <Badge tone={TONE[status.state]} className={className} data-testid="song-status">
      {STATE_LABEL[status.state]}
      {status.state !== "mastered" && status.mastered > 0 ? ` · ${pct}%` : ""}
    </Badge>
  );
}
