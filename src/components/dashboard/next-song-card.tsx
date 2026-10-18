"use client";

import Link from "next/link";
import { ArrowRight, ListMusic } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Skeleton } from "@/components/ui";
import { useSongInsights } from "@/components/songs/use-song-insights";

/** Dashboard card: the best song to learn next, based on the chords you already know. */
export function NextSongCard({ instrument }: { instrument: "guitar" | "piano" }) {
  const { loading, known, suggestions } = useSongInsights(instrument, 1);
  const top = suggestions[0];
  return (
    <Card data-testid="next-song-card">
      <CardHeader icon={<ListMusic className="h-5 w-5" />} title="Next song to learn" description={known.size ? `Based on the ${known.size} chord${known.size === 1 ? "" : "s"} you know on ${instrument}` : `A good first song on ${instrument}`} />
      <CardBody>
        {loading ? (
          <Skeleton className="h-20" />
        ) : top ? (
          <div className="space-y-3">
            <div>
              <p className="text-lg font-semibold">{top.song.title}</p>
              <p className="text-xs text-subtle">{[top.song.artist, top.song.film].filter(Boolean).join(" · ")}</p>
              <p className="mt-2 text-sm text-muted">{top.reason}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/songs/${top.song.id}`}>
                <Button size="sm">
                  Start <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/songs">
                <Button size="sm" variant="secondary">See more</Button>
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">You&apos;ve mastered every song we&apos;d suggest — paste a new one in the Song Lab.</p>
        )}
      </CardBody>
    </Card>
  );
}
