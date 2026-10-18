"use client";

import { useT, useTm } from "@/lib/i18n";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui";
import { useSongInsights } from "./use-song-insights";

/** "Ready to learn" — songs that fit the chords you already know. */
export function ReadyToLearn({ instrument }: { instrument: "guitar" | "piano" }) {
  const t = useT();
  const tm = useTm();
  const { loading, known, suggestions } = useSongInsights(instrument, 3);
  if (loading || !suggestions.length) return null;
  return (
    <section aria-labelledby="ready-h" data-testid="ready-to-learn">
      <h2 id="ready-h" className="flex items-center gap-2 font-semibold">
        <Sparkles className="h-4 w-4 text-accent" /> {t("songs.ready")}
      </h2>
      <p className="mb-3 mt-1 text-sm text-muted">
        {known.size ? t("songs.readyKnown", { n: known.size }) : t("songs.readyFirst")}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {suggestions.map((s) => (
          <Link key={s.song.id} href={`/songs/${s.song.id}`} className="group">
            <Card className="flex h-full flex-col p-4 transition-colors group-hover:border-accent">
              <p className="font-semibold">{s.song.title}</p>
              <p className="truncate text-xs text-subtle">{s.song.film ?? s.song.artist}</p>
              <p className="mt-2 text-sm text-muted">{tm(s.reasonMsg)}</p>
              <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-medium text-accent">
                {t("common.start")} <ArrowRight className="h-4 w-4" />
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
