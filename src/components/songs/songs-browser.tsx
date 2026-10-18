"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookmarkCheck, Clock, ExternalLink, Music2, PlusCircle, Search } from "lucide-react";
import { Badge, Card, EmptyState, Input, PageHeader, Segmented, Select, cn } from "@/components/ui";
import { useData } from "@/hooks/use-data";
import { usePrefs } from "@/hooks/use-prefs";
import { songRepo } from "@/lib/storage/repositories";
import { BUILT_IN_SONGS, CATALOGUE_SONGS } from "@/content/songs";
import { songChords } from "@/content/songs/parse";
import type { Song } from "@/content/songs/types";
import { customSongRepo } from "./custom-repo";
import { LINK_BUTTON } from "./catalogue-view";

type Tab = "all" | "public-domain" | "original" | "popular" | "mine";

function Difficulty({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`Difficulty ${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn("h-1.5 w-3 rounded-full", i <= n ? "bg-accent" : "bg-surface-3")} />
      ))}
    </span>
  );
}

export function SongsBrowser() {
  const [prefs] = usePrefs();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [maxDiff, setMaxDiff] = useState(5);
  const progress = useData(() => songRepo.list(), ["songProgress"], []);
  const custom = useData(() => customSongRepo.list(), ["savedSongs"], []);

  const progressFor = (id: string) => progress.data.find((p) => p.songId === id && p.instrument === prefs.instrument);
  const match = (s: { title: string; artist: string }) => !q || `${s.title} ${s.artist}`.toLowerCase().includes(q.toLowerCase());

  const songs = useMemo(
    () => BUILT_IN_SONGS.filter((s) => (tab === "all" || tab === s.source) && s.difficulty <= maxDiff && match(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tab, maxDiff, q],
  );
  const catalogue = CATALOGUE_SONGS.filter(match);
  const mine = custom.data.filter(match);

  return (
    <div>
      <PageHeader
        eyebrow="Song Lab"
        title="Learn real music"
        description="Public-domain classics and original practice pieces with full play-along tools, plus a catalogue of popular Bollywood and pop songs that you can add with chords from a licensed source."
        actions={<Link href="/songs/custom?new=1" className={cn(LINK_BUTTON, "h-10 w-auto px-4 text-sm")}><PlusCircle className="h-4 w-4" /> Add your own song</Link>}
      />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="scrollbar-thin -mx-1 overflow-x-auto px-1">
          <Segmented<Tab>
            label="Song collection"
            value={tab}
            onChange={setTab}
            options={[
              { value: "all", label: "All playable" },
              { value: "public-domain", label: "Public domain" },
              { value: "original", label: "Original pieces" },
              { value: "popular", label: "Bollywood & pop" },
              { value: "mine", label: `My songs${custom.data.length ? ` (${custom.data.length})` : ""}` },
            ]}
          />
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 lg:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input aria-label="Search songs" placeholder="Search songs" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          {tab !== "popular" && tab !== "mine" && (
            <Select aria-label="Maximum difficulty" value={maxDiff} onChange={(e) => setMaxDiff(Number(e.target.value))}>
              <option value={5}>Any level</option>
              <option value={1}>Easiest only</option>
              <option value={2}>Up to level 2</option>
              <option value={3}>Up to level 3</option>
            </Select>
          )}
        </div>
      </div>

      {tab === "popular" ? (
        <div className="space-y-6">
          <p className="max-w-3xl rounded-xl bg-surface-2 p-3 text-sm text-muted">
            These songs are copyrighted, so we don’t include their chords, lyrics or melodies — unofficial chord sites are often wrong anyway. Each page links to the official audio and to licensed sheet music. Add the chords yourself to unlock looping, slow practice, the capo helper and play-along.
          </p>
          {(["bollywood", "international"] as const).map((region) => (
            <section key={region}>
              <h2 className="mb-3 font-semibold">{region === "bollywood" ? "Bollywood & Hindi" : "International pop"}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {catalogue.filter((c) => c.region === region).map((c) => (
                  <Link key={c.id} href={`/songs/${c.id}`} className="group">
                    <Card className="h-full p-4 transition-colors group-hover:border-border-strong">
                      <p className="font-semibold">{c.title}</p>
                      <p className="text-sm text-muted">{c.artist}</p>
                      {c.credit && <p className="mt-1 text-xs text-subtle">{c.credit}</p>}
                      <p className="mt-3 inline-flex items-center gap-1 text-xs text-muted"><ExternalLink className="h-3.5 w-3.5" /> Official & licensed links · chords not included</p>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
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
          <EmptyState icon={<Music2 className="h-8 w-8" />} title={custom.loading ? "Loading…" : "No songs yet"} description="Add any song with chords from a source you trust. It's saved on this device only." action={<Link href="/songs/custom?new=1" className="text-accent hover:underline">Add your first song</Link>} />
        )
      ) : songs.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {songs.map((s) => (
            <SongCard key={s.id} song={s} saved={!!progressFor(s.id)?.saved} minutes={progressFor(s.id)?.minutes ?? 0} />
          ))}
        </div>
      ) : (
        <EmptyState title="No songs match" description="Try a different search or difficulty." />
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
          </div>
          {saved && <BookmarkCheck className="h-5 w-5 shrink-0 text-accent" aria-label="Saved" />}
        </div>
        {song.styleNote && <p className="mt-2 text-xs text-accent">{song.styleNote}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={song.source === "public-domain" ? "theory" : "accent"}>{song.source === "public-domain" ? "Public domain" : "Original"}</Badge>
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
