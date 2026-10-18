"use client";

import { CheckCircle2, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Button, SourceTag, cn } from "@/components/ui";
import { exerciseRepo } from "@/lib/storage/repositories";
import type { InputMethod } from "@/lib/storage/schemas";

export async function saveGuitarResult(r: { exerciseId: string; skill: string; input: InputMethod; correct: number; total: number; measured: boolean; details?: string }) {
  const accuracy = r.total ? Math.max(0, Math.min(1, r.correct / r.total)) : 0;
  await exerciseRepo.add({ instrument: "guitar", ...r, accuracy });
  return accuracy;
}

export function ResultSummary({ title, correct, total, source, children, onRetry }: { title: string; correct: number; total: number; source: "measured" | "self-reported"; children?: ReactNode; onRetry: () => void }) {
  const pct = total ? Math.round((correct / total) * 100) : 0;
  return (
    <div className="animate-pop space-y-3 rounded-2xl border border-border bg-surface-2 p-4" role="status">
      <div className="flex flex-wrap items-center gap-2">
        <CheckCircle2 className={cn("h-5 w-5", pct >= 80 ? "text-success" : "text-warn")} aria-hidden />
        <p className="font-semibold">{title}</p>
        <Badge tone={pct >= 80 ? "success" : pct >= 50 ? "warn" : "danger"}>{correct}/{total} · {pct}%</Badge>
        <SourceTag source={source} />
      </div>
      {children && <div className="text-sm text-muted">{children}</div>}
      <Button size="sm" variant="secondary" onClick={onRetry}><RotateCcw className="h-4 w-4" /> Try again</Button>
    </div>
  );
}

/** Builds simple ASCII tab lines (high e on top) from string/fret positions. */
export function buildTab(positions: { string: number; fret: number }[]): string[] {
  const names = ["E", "A", "D", "G", "B", "e"];
  const lines = names.map((n) => `${n}|-`);
  for (const p of positions) {
    const w = String(p.fret).length;
    for (let s = 0; s < 6; s++) lines[s] += (s === p.string ? String(p.fret) : "-".repeat(w)) + "-";
  }
  return lines.map((l) => l + "|").reverse();
}

export function TabView({ positions, current }: { positions: { string: number; fret: number }[]; current?: number }) {
  const lines = buildTab(positions);
  return (
    <div className="scrollbar-thin overflow-x-auto rounded-xl border border-border bg-surface p-3">
      <pre className="font-mono text-sm leading-6" aria-label="Guitar tablature: lines are strings, high e on top; numbers are frets">
        {lines.join("\n")}
      </pre>
      {current !== undefined && current < positions.length && (
        <p className="mt-1 text-xs text-muted">Next: string {6 - positions[current].string}, {positions[current].fret === 0 ? "open" : `fret ${positions[current].fret}`} ({current + 1} of {positions.length})</p>
      )}
    </div>
  );
}
