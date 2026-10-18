"use client";

import Link from "next/link";
import { ChevronLeft, ExternalLink, FileMusic, PlayCircle, PlusCircle, Search } from "lucide-react";
import { Badge, Callout, Card, CardBody } from "@/components/ui";

export const LINK_BUTTON = "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover";
import type { CatalogueSong } from "@/content/songs/types";
import { ultimateGuitarSearch } from "@/content/songs/catalogue";

export function catalogueEditorHref(s: Pick<CatalogueSong, "id" | "title" | "artist">) {
  return `/songs/sheet?new=1&from=${encodeURIComponent(s.id)}&title=${encodeURIComponent(s.title)}&artist=${encodeURIComponent(s.artist)}`;
}

/** A popular (copyrighted) song: links only, no chords or lyrics. */
export function CatalogueView({ song }: { song: CatalogueSong }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/songs" className="-ml-1 inline-flex min-h-10 items-center gap-1 px-1 text-sm text-muted hover:text-text">
        <ChevronLeft className="h-4 w-4" /> All songs
      </Link>
      <div>
        <Badge tone={song.region === "bollywood" ? "guitar" : "piano"}>{song.region === "bollywood" ? "Bollywood / Hindi" : "International pop"}</Badge>
        <h1 className="mt-2 font-display text-4xl tracking-tight">{song.title}</h1>
        <p className="mt-1 text-muted">{song.artist}</p>
        {song.credit && <p className="text-sm text-subtle">{song.credit}</p>}
      </div>
      <Callout tone="info" title="How to practise this song">
        <ol className="mt-1 list-inside list-decimal space-y-0.5">
          <li>Listen to the official audio.</li>
          <li>Find the chords online (pick a chart that sounds right when you play along).</li>
          <li>Add them here to unlock looping, slow practice, the capo helper and play-along.</li>
        </ol>
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
          <a href={ultimateGuitarSearch(song.title)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-surface-2" data-testid="find-ug">
            <Search className="h-5 w-5 text-guitar" />
            <span className="flex-1">
              <span className="block font-medium">Find it on Ultimate Guitar</span>
              <span className="text-xs text-muted">Opens UG&apos;s search. Copy the chords &amp; lyrics from there and paste them into a song sheet here.</span>
            </span>
            <ExternalLink className="h-4 w-4 text-muted" />
          </a>
          <a href={song.chordSearch} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-surface-2" data-testid="find-chords">
            <Search className="h-5 w-5 text-guitar" />
            <span className="flex-1">
              <span className="block font-medium">Find the chords online</span>
              <span className="text-xs text-muted">Web search. Chord sites are written by fans and can disagree, so check it against the recording.</span>
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
            <PlusCircle className="h-5 w-5" /> Add lyrics &amp; chords and sing along
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
