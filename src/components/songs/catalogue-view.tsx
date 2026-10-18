"use client";
import { useT } from "@/lib/i18n";

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
  const tr = useT();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/songs" className="-ml-1 inline-flex min-h-10 items-center gap-1 px-1 text-sm text-muted hover:text-text">
        <ChevronLeft className="h-4 w-4" /> {tr("common.allSongs")}
      </Link>
      <div>
        <Badge tone={song.region === "bollywood" ? "guitar" : "piano"}>{song.region === "bollywood" ? tr("ui.bollywood_hindi") : tr("ui.international_pop")}</Badge>
        <h1 className="mt-2 font-display text-4xl tracking-tight">{song.title}</h1>
        <p className="mt-1 text-muted">{song.artist}</p>
        {song.credit && <p className="text-sm text-subtle">{song.credit}</p>}
      </div>
      <Callout tone="info" title={tr("ui.how_to_practise_this_song")}>
        <ol className="mt-1 list-inside list-decimal space-y-0.5">
          <li>{tr("ui.listen_to_the_official_audio")}</li>
          <li>{tr("ui.find_the_chords_online_pick_a_chart_that_sounds")}</li>
          <li>{tr("ui.add_them_here_to_unlock_looping_slow_practice_th")}</li>
        </ol>
      </Callout>
      <Card>
        <CardBody className="space-y-3 pt-5">
          <a href={song.officialAudioSearch} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-surface-2">
            <PlayCircle className="h-5 w-5 text-danger" />
            <span className="flex-1">
              <span className="block font-medium">{tr("ui.find_the_official_audio_on_youtube")}</span>
              <span className="text-xs text-muted">{tr("ui.youtube_search_look_for_the_label_s_or_artist_s")}</span>
            </span>
            <ExternalLink className="h-4 w-4 text-muted" />
          </a>
          <a href={ultimateGuitarSearch(song.title)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-surface-2" data-testid="find-ug">
            <Search className="h-5 w-5 text-guitar" />
            <span className="flex-1">
              <span className="block font-medium">{tr("ui.find_it_on_ultimate_guitar")}</span>
              <span className="text-xs text-muted">{tr("ui.ug_search_hint")}</span>
            </span>
            <ExternalLink className="h-4 w-4 text-muted" />
          </a>
          <a href={song.chordSearch} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-surface-2" data-testid="find-chords">
            <Search className="h-5 w-5 text-guitar" />
            <span className="flex-1">
              <span className="block font-medium">{tr("ui.find_the_chords_online")}</span>
              <span className="text-xs text-muted">{tr("ui.web_search_chord_sites_are_written_by_fans_and_c")}</span>
            </span>
            <ExternalLink className="h-4 w-4 text-muted" />
          </a>
          <a href={song.licensedSheetSearch} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-surface-2">
            <FileMusic className="h-5 w-5 text-accent" />
            <span className="flex-1">
              <span className="block font-medium">{tr("ui.search_licensed")}</span>
              <span className="text-xs text-muted">{tr("ui.musicnotes_com_search_official_arrangements_are")}</span>
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
