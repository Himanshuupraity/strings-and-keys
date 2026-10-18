"use client";
import { useT, useTx } from "@/lib/i18n";

import { CheckCircle2, ChevronDown, Star } from "lucide-react";
import { LEVEL_NAMES } from "@/content/types";
import { Badge, ProgressBar, cn } from "@/components/ui";
import { LessonCard } from "./lesson-card";
import type { LevelSummary } from "./lesson-state";

export function LevelSection({ summary, defaultOpen, highlightId, tone = "accent" }: { summary: LevelSummary; defaultOpen?: boolean; highlightId?: string; tone?: "accent" | "guitar" | "piano" | "theory" }) {
  const tr = useT();
  const tx = useTx();
  const { level, views, done, total, complete, allMastered, mastered } = summary;
  return (
    <details open={defaultOpen} className="group rounded-2xl border border-border bg-surface-2/50" data-testid={`level-${level}`}>
      <summary className="flex cursor-pointer list-none items-center gap-4 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-semibold tabular-nums", complete ? "bg-success text-white dark:text-black" : "bg-surface text-text border border-border")}>
          {complete ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : level}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{tr("ui.level_n_name", { n: level, name: tx(LEVEL_NAMES[level]) })}</h3>
            {allMastered ? <Badge tone="accent"><Star className="h-3 w-3" /> {tr("dash.mastered")}</Badge> : complete ? <Badge tone="success">{tr("ui.complete")}</Badge> : null}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <ProgressBar value={total ? done / total : 0} tone={tone} className="max-w-xs" label={`Level ${level} progress`} />
            <span className="whitespace-nowrap text-xs text-muted">
              {tr("ui.done_mastered", { done, total, mastered })}
            </span>
          </div>
        </div>
        <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="grid gap-3 px-4 pb-5 sm:grid-cols-2 sm:px-5 xl:grid-cols-3">
        {views.map((v) => (
          <LessonCard key={v.lesson.id} view={v} highlight={v.lesson.id === highlightId} />
        ))}
      </div>
    </details>
  );
}

export function CompletionCriteria() {
  const tr = useT();
  return (
    <p className="text-sm text-muted">
      {tr("ui.level_complete_rule")}{" "}
      <strong className="text-text">{tr("ui.mastery")}</strong> {tr("ui.additionally_requires_passing_the_measured_exerc")}
    </p>
  );
}
