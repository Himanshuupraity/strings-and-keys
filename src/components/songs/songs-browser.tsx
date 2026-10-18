"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookmarkCheck, Clock, Music2, PlayCircle, PlusCircle, Search } from "lucide-react";
import { Badge, Card, EmptyState, Input, PageHeader, Segmented, Select, cn } from "@/components/ui";
import { useData } from "@/hooks/use-data";
import { usePrefs } from "@/hooks/use-prefs";
import { songRepo } from "@/lib/storage/repositories";
import { BUILT_IN_SONGS, CATALOGUE_SONGS } from "@/content/songs";
import { songChords } from "@/content/songs/parse";
import type { Song } from "@/content/songs/types";
import { customSongRepo } from "./custom-repo";
import { LINK_BUTTON, catalogueEditorHref } from "./catalogue-view";
import type { CatalogueSong } from "@/content/songs/types";

type Tab = "hindi" | "english" | "mine";

function Difficulty({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`Difficulty ${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn("h-1.5 w-3 rounded-full", i <= n ? "bg-accent" : "bg-surface-3")} />
      ))}
    </span>
  );
}

const isHindi = (s: Song) => s.genre === "bollywood" || s.genre === "bollywood-style";

export function SongsBrowser() {
  const [prefs] = usePrefs();
  const [tab, setTab] = useState<Tab>("hindi");
  const [q, setQ] = useState("");
  const [maxDiff, setMaxDiff] = useState(5);
  const [decade, setDecade] = useState<number | null>(null);
  const [shown, setShown] = useState(40);
  const progress = useData(() => songRepo.list(), ["songProgress"], []);
  const custom = useData(() => customSongRepo.list(), ["savedSongs"], []);

  const progressFor = (id: string) => progress.data.find((p) => p.songId === id && p.instrument === prefs.instrument);
  const match = (s: { title: string; artist: string; film?: string; composer?: string; year?: number }) =>
    (!q || `${s.title} ${s.artist} ${s.film ?? ""} ${s.composer ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())) &&
    (decade === null || (s.year !== undefined && Math.floor(s.year / 10) * 10 === decade));

  const visible = useMemo(
    () => BUILT_IN_SONGS.filter((s) => s.difficulty <= maxDiff && match(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maxDiff, q, decade],
  );
  const charts = visible.filter((s) => s.source === "chord-chart");
  const hindiPieces = visible.filter((s) => s.source !== "chord-chart" && isHindi(s));
  const english = BUILT_IN_SONGS.filter((s) => !isHindi(s) && s.difficulty <= maxDiff && (!q || `${s.title} ${s.artist}`.toLowerCase().includes(q.toLowerCase())));
  const decades = Array.from(new Set(CATALOGUE_SONGS.filter((c) => c.year).map((c) => Math.floor(c.year! / 10) * 10))).sort((a, b) => a - b);
  // Songs with a chord chart aren't repeated in the plain list ("Pyar Ke Pal (Pal)" ≡ "Pyar Ke Pal").
  const norm = (t: string) => t.toLowerCase().replace(/\s*\(.*?\)\s*/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const chartedTitles = new Set(BUILT_IN_SONGS.filter((s) => s.source === "chord-chart").map((s) => norm(s.title)));
  const moreHindi = CATALOGUE_SONGS.filter((c) => c.region === "bollywood" && !chartedTitles.has(norm(c.title)) && match(c));
  const mine = custom.data.filter(match);

  const grid = (list: Song[]) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {list.map((s) => (
        <SongCard key={s.id} song={s} saved={!!progressFor(s.id)?.saved} minutes={progressFor(s.id)?.minutes ?? 0} />
      ))}
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Song Lab"
        title="Play the songs you love"
        description="Bollywood and Hindi songs with chords, capo help, strumming and slow play-along — plus Hindi-style practice pieces with melodies you can play note by note."
        actions={<Link href="/songs/custom?new=1" className={cn(LINK_BUTTON, "h-10 w-auto px-4 text-sm")}><PlusCircle className="h-4 w-4" /> Add your own song</Link>}
      />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="scrollbar-thin -mx-1 overflow-x-auto px-1">
          <Segmented<Tab>
            label="Song collection"
            value={tab}
            onChange={setTab}
            options={[
              { value: "hindi", label: "Hindi & Bollywood", testId: "tab-hindi" },
              { value: "mine", label: `My songs${custom.data.length ? ` (${custom.data.length})` : ""}` },
              { value: "english", label: "English & classics", testId: "tab-english" },
            ]}
          />
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 lg:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input aria-label="Search songs" placeholder="Search songs or films" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          {tab !== "mine" && (
            <Select aria-label="Maximum difficulty" value={maxDiff} onChange={(e) => setMaxDiff(Number(e.target.value))}>
              <option value={5}>Any level</option>
              <option value={1}>Easiest only</option>
              <option value={2}>Up to level 2</option>
              <option value={3}>Up to level 3</option>
            </Select>
          )}
        </div>
      </div>

      {tab === "hindi" && decades.length > 0 && (
        <div className="-mt-3 mb-6 flex flex-wrap gap-1.5" role="group" aria-label="Filter by decade">
          {[null, ...decades].map((d) => (
            <button
              key={d ?? "all"}
              type="button"
              aria-pressed={decade === d}
              onClick={() => { setDecade(d); setShown(40); }}
              className={cn("rounded-full border px-3 py-1 text-sm", decade === d ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:bg-surface-2")}
            >
              {d === null ? "All years" : `${d}s`}
            </button>
          ))}
        </div>
      )}

      {tab === "hindi" ? (
        <div className="space-y-8">
          {charts.length > 0 && (
            <section>
              <h2 className="font-semibold">Bollywood songs</h2>
              <p className="mb-3 mt-1 max-w-3xl text-sm text-muted">Chord charts of real songs, cross-checked against several chord sources. Chords only — play along with the original recording.</p>
              {grid(charts)}
            </section>
          )}
          {hindiPieces.length > 0 && (
            <section>
              <h2 className="font-semibold">Hindi-style practice pieces</h2>
              <p className="mb-3 mt-1 max-w-3xl text-sm text-muted">Original tunes in Bollywood styles, with a melody you can play and get note-by-note feedback on.</p>
              {grid(hindiPieces)}
            </section>
          )}
          <section>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-semibold">All Bollywood songs <span className="font-normal text-muted">({moreHindi.length})</span></h2>
                <p className="mt-1 max-w-3xl text-sm text-muted">Listen to the official audio, find the chords online, then add them to practise with all the tools.</p>
              </div>
            </div>
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface" data-testid="catalogue-list">
              {moreHindi.slice(0, shown).map((c) => <CatalogueRowItem key={c.id} song={c} />)}
            </ul>
            {moreHindi.length > shown && (
              <button type="button" onClick={() => setShown((n) => n + 40)} className="mt-3 w-full rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-surface-2">
                Show more ({moreHindi.length - shown} left)
              </button>
            )}
          </section>
          {!charts.length && !hindiPieces.length && !moreHindi.length && <EmptyState title="No songs match" description="Try a different search or difficulty." />}
        </div>
      ) : tab === "mine" ? (
        mine.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {mine.map((s) => (
              <Link key={s.id} href={`/songs/custom?id=${s.id}`} className="group">
                <Card className="h-full p-4 transition-colors group-hover:border-border-strong">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{s.title}</p>
                      <p className="text-sm text-muted">{s.artist || "Unknown artist"}</p>
                    </div>
                    <Badge tone="piano">User-provided</Badge>
                  </div>
                  <p className="mt-3 truncate font-mono text-xs text-muted">{songChords({ sections: s.sections }).join(" · ")}</p>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Music2 className="h-8 w-8" />} title={custom.loading ? "Loading…" : "No songs yet"} description="Add any Hindi song with chords from a source you trust, and get looping, slow practice and the capo helper." action={<Link href="/songs/custom?new=1" className="text-accent hover:underline">Add your first song</Link>} />
        )
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="font-semibold">Classic tunes</h2>
            <p className="mb-3 mt-1 max-w-3xl text-sm text-muted">Simple public-domain melodies — handy for practising reading and finger patterns.</p>
            {english.length ? grid(english) : <EmptyState title="No songs match" description="Try a different search or difficulty." />}
          </section>
        </div>
      )}
    </div>
  );
}

function SongCard({ song, saved, minutes }: { song: Song; saved: boolean; minutes: number }) {
  const chords = songChords(song);
  return (
    <Link href={`/songs/${song.id}`} className="group" data-testid={`song-card-${song.id}`}>
      <Card className="flex h-full flex-col p-4 transition-colors group-hover:border-border-strong">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold">{song.title}</p>
            <p className="truncate text-sm text-muted">{song.artist}</p>
            {song.film && <p className="truncate text-xs text-subtle">{song.film}{song.year ? ` (${song.year})` : ""}</p>}
          </div>
          {saved && <BookmarkCheck className="h-5 w-5 shrink-0 text-accent" aria-label="Saved" />}
        </div>
        {song.styleNote && <p className="mt-2 text-xs text-accent">{song.styleNote}</p>}
        {song.sourceCapo ? <p className="mt-2 text-xs text-muted">Capo {song.sourceCapo} · easy shapes</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={song.source === "public-domain" ? "theory" : song.source === "chord-chart" ? "guitar" : "accent"}>{song.source === "public-domain" ? "Public domain" : song.source === "chord-chart" ? "Chord chart" : "Original"}</Badge>
          <Badge>Key {song.key}</Badge>
          <Difficulty n={song.difficulty} />
        </div>
        <p className="mt-3 font-mono text-xs text-muted">{chords.join(" · ")}</p>
        <div className="mt-auto flex items-center justify-between pt-3 text-xs text-muted">
          <span>{song.sections.some((s) => s.melody) ? "Melody + chords" : "Chords only"}</span>
          {minutes > 0 && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {minutes} min</span>}
        </div>
      </Card>
    </Link>
  );
}

function CatalogueRowItem({ song }: { song: CatalogueSong }) {
  return (
    <li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
      <Link href={`/songs/${song.id}`} className="min-w-0 flex-1 hover:underline-offset-2">
        <p className="truncate font-medium">{song.title}</p>
        <p className="truncate text-sm text-muted">
          {song.artist}
          {song.film && <span className="text-subtle"> · {song.film}{song.year ? ` (${song.year})` : ""}</span>}
        </p>
      </Link>
      <div className="flex shrink-0 gap-1.5">
        <a href={song.officialAudioSearch} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-surface-2" aria-label={`Listen to ${song.title} (YouTube search)`}>
          <PlayCircle className="h-3.5 w-3.5 text-danger" /> Listen
        </a>
        <a href={song.chordSearch} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-surface-2" aria-label={`Find chords for ${song.title} (web search)`}>
          <Search className="h-3.5 w-3.5 text-guitar" /> Find chords
        </a>
        <Link href={catalogueEditorHref(song)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-accent px-2.5 text-xs font-medium text-accent-fg hover:bg-accent-hover" aria-label={`Add chords for ${song.title}`}>
          <PlusCircle className="h-3.5 w-3.5" /> Add chords
        </Link>
      </div>
    </li>
  );
}
