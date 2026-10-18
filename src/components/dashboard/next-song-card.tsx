"use client";

import Link from "next/link";
import { ArrowRight, ListMusic } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Skeleton } from "@/components/ui";
import { useSongInsights } from "@/components/songs/use-song-insights";
import { useT, useTm } from "@/lib/i18n";

/** Dashboard card: the best song to learn next, based on the chords you already know. */
export function NextSongCard({ instrument }: { instrument: "guitar" | "piano" }) {
  const t = useT();
  const tm = useTm();
  const { loading, known, suggestions } = useSongInsights(instrument, 1);
  const top = suggestions[0];
  return (
    <Card data-testid="next-song-card">
      <CardHeader icon={<ListMusic className="h-5 w-5" />} title={t("dash.nextSongTitle")} description={known.size ? t("dash.nextSongKnown", { n: known.size }) : t("dash.nextSongFirst")} />
      <CardBody>
        {loading ? (
          <Skeleton className="h-20" />
        ) : top ? (
          <div className="space-y-3">
            <div>
              <p className="text-lg font-semibold">{top.song.title}</p>
              <p className="text-xs text-subtle">{[top.song.artist, top.song.film].filter(Boolean).join(" · ")}</p>
              <p className="mt-2 text-sm text-muted">{tm(top.reasonMsg)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/songs/${top.song.id}`}>
                <Button size="sm">
                  {t("common.start")} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/songs">
                <Button size="sm" variant="secondary">{t("common.seeMore")}</Button>
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">{t("dash.nextSongAllDone")}</p>
        )}
      </CardBody>
    </Card>
  );
}
