"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Card, CardBody } from "@/components/ui";
import { useData } from "@/hooks/use-data";
import { useHydrated } from "@/hooks/use-prefs";
import { useT } from "@/lib/i18n";
import { revisionRepo } from "@/lib/revision/repo";
import { isDue, localDay } from "@/lib/revision/schedule";
import type { RevisionItem } from "@/lib/storage/schemas";

/** Dashboard nudge: how many mistakes are due for revision today. Renders nothing when none are due. */
export function RevisionCard() {
  const t = useT();
  const hydrated = useHydrated();
  const { data } = useData(() => revisionRepo.all(), ["revision"], [] as RevisionItem[]);
  if (!hydrated) return null;
  const today = localDay();
  const due = data.filter((i) => isDue(i, today)).length;
  if (due === 0) return null;
  return (
    <Card className="border-accent/40" data-testid="revision-card">
      <CardBody className="flex items-center justify-between gap-3 pt-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><RotateCcw className="h-5 w-5" /></span>
          <div>
            <p className="font-semibold">{due === 1 ? t("dash.revisionOne") : t("dash.revisionTitle", { n: due })}</p>
            <p className="text-sm text-muted">{t("dash.revisionBody")}</p>
          </div>
        </div>
        <Link href="/revise" className="inline-flex h-11 shrink-0 items-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent-hover">{t("common.start")}</Link>
      </CardBody>
    </Card>
  );
}
