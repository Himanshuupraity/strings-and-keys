"use client";

import Link from "next/link";
import { ChevronLeft, ExternalLink, FileMusic, PlayCircle, PlusCircle } from "lucide-react";
import { Badge, Callout, Card, CardBody } from "@/components/ui";

export const LINK_BUTTON = "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover";
import type { CatalogueSong } from "@/content/songs/types";

export function catalogueEditorHref(s: Pick<CatalogueSong, "id" | "title" | "artist">) {
  return `/songs/custom?new=1&from=${encodeURIComponent(s.id)}&title=${encodeURIComponent(s.title)}&artist=${encodeURIComponent(s.artist)}`;
}

/** A popular (copyrighted) song: links only, no chords or lyrics. */
export function CatalogueView({ song }: { song: CatalogueSong }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/songs" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ChevronLeft className="h-4 w-4" /> All songs
      </Link>
      <div>
        <Badge tone={song.region === "bollywood" ? "guitar" : "piano"}>{song.region === "bollywood" ? "Bollywood / Hindi" : "International pop"}</Badge>
        <h1 className="mt-2 font-display text-4xl tracking-tight">{song.title}</h1>
        <p className="mt-1 text-muted">{song.artist}</p>
        {song.credit && <p className="text-sm text-subtle">{song.credit}</p>}
      </div>
      <Callout tone="info" title="Chords not included">
        This song is copyrighted. We only include verified, licensed musical data, so there are no chords, lyrics or melody here. Use an official or licensed source below, then add the chords yourself to unlock looping, slow practice, the capo helper and play-along.
      </Callout>
      <Card>
        <CardBody className="space-y-3 pt-5">
          <a href={song.officialAudioSearch} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-surface-2">
            <PlayCircle className="h-5 w-5 text-danger" />
            <span className="flex-1">
              <span className="block font-medium">Find the official audio on YouTube</span>
              <span className="text-xs text-muted">YouTube search — look for the label’s or artist’s official channel. Not a verified link.</span>
            </span>
            <ExternalLink className="h-4 w-4 text-muted" />
          </a>
          <a href={song.licensedSheetSearch} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-surface-2">
            <FileMusic className="h-5 w-5 text-accent" />
            <span className="flex-1">
              <span className="block font-medium">Search licensed sheet music &amp; chords</span>
              <span className="text-xs text-muted">Musicnotes.com search — official arrangements are sold under licence. Availability varies.</span>
            </span>
            <ExternalLink className="h-4 w-4 text-muted" />
          </a>
          <Link href={catalogueEditorHref(song)} className={LINK_BUTTON}>
            <PlusCircle className="h-5 w-5" /> Add this song with my own chords
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
