"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ClipboardPaste, ExternalLink, Pencil, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Callout, Card, CardBody, CardHeader, EmptyState, Field, Input, Skeleton } from "@/components/ui";
import { getSong } from "@/content/songs";
import { getCatalogueSong } from "@/content/songs";
import { ultimateGuitarSearch } from "@/content/songs/catalogue";
import { guessKey, parseSheet, sheetSections, uniqueChords, youtubeId } from "@/lib/sheet/parse";

/** Web search for a lyrics-with-chords page (third-party sites; the student copies what they need). */
export function lyricsChordsSearch(title: string, artist?: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${title} ${artist?.split(/[,&(]/)[0] ?? ""} lyrics chords`.replace(/\s+/g, " ").trim())}`;
}
import { customSongRepo, type CustomSong } from "../custom-repo";
import { SongSheet } from "./song-sheet";

// Example of the format, written for this app (not lyrics from any song).
const EXAMPLE = `[Verse]
Am            F
Paste the words under the chords
C               G
just like on a chord website

[Chorus]
F        G         Am
Or write chords inline like [C]this`;

export function SheetPage() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const editing = params.get("new") === "1" || params.get("edit") === "1";
  const [loaded, setLoaded] = useState<{ id: string; song: CustomSong | null } | null>(null);
  const song: CustomSong | null | undefined = !id ? null : loaded?.id === id ? loaded.song : undefined;

  useEffect(() => {
    let alive = true;
    if (!id) return;
    void customSongRepo.get(id).then((s) => alive && setLoaded({ id, song: s ?? null }));
    return () => {
      alive = false;
    };
  }, [id]);

  if (editing) {
    if (id && song === undefined) return <Skeleton className="h-96" />;
    return <SheetEditor existing={song ?? undefined} onSaved={(s) => router.replace(`/songs/sheet?id=${s.id}`)} />;
  }
  if (song === undefined) return <Skeleton className="h-96" />;
  if (!song || !song.sheet) {
    return <EmptyState title="Song sheet not found" description="It may have been deleted, or it was saved on another device/profile." action={<Link href="/songs/sheet?new=1" className="text-accent hover:underline">Paste a new song</Link>} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/songs" className="-ml-1 inline-flex min-h-10 items-center gap-1 px-1 text-sm text-muted hover:text-text">
          <ChevronLeft className="h-4 w-4" /> All songs
        </Link>
        <div className="flex flex-wrap gap-2">
          {song.sourceUrl && (
            <a href={song.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-surface-2" data-testid="open-source">
              <ExternalLink className="h-4 w-4" /> Open original
            </a>
          )}
          <Link href={`/songs/custom?id=${song.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-surface-2">
            <SlidersHorizontal className="h-4 w-4" /> Practice tools
          </Link>
          <Link href={`/songs/sheet?id=${song.id}&edit=1`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-surface-2" data-testid="sheet-edit">
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Delete this song"
            onClick={async () => {
              if (!window.confirm(`Delete “${song.title}”?`)) return;
              await customSongRepo.remove(song.id);
              router.replace("/songs");
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <SongSheet
        key={song.updatedAt}
        sheetId={song.id}
        title={song.title}
        artist={song.artist}
        sheet={song.sheet}
        youtube={song.youtube}
        findLyricsHref={ultimateGuitarSearch(song.title)}
        onPasteLyrics={async (text) => {
          const parsed = parseSheet(text);
          if (!uniqueChords(parsed.lines).length) {
            toast.error("No chords found in what you pasted. Copy a version with chords above the words.");
            return;
          }
          const saved = await customSongRepo.save({
            ...song,
            key: guessKey(parsed.lines),
            sections: sheetSections(parsed.lines).map((s, i) => ({ id: `s${i}`, name: s.name, bars: s.bars })),
            sheet: text.slice(0, 30000),
          });
          setLoaded({ id: saved.id, song: saved });
          toast.success("Lyrics added");
        }}
      />
    </div>
  );
}

function SheetEditor({ existing, onSaved }: { existing?: CustomSong; onSaved: (s: CustomSong) => void }) {
  const params = useSearchParams();
  const chart = params.get("chart") ? getSong(params.get("chart")!) : undefined;
  const catalogue = params.get("from") ? getCatalogueSong(params.get("from")!) : undefined;
  const skeleton = chart ? chart.sections.map((s) => `[${s.name}]\n${(s.bars as (string | [string, number][])[]).map((b) => (typeof b === "string" ? b : b.map(([c]) => c).join(" "))).join("  ")}`).join("\n\n") : "";

  const [title, setTitle] = useState(existing?.title ?? chart?.title ?? params.get("title") ?? catalogue?.title ?? "");
  const [artist, setArtist] = useState(existing?.artist ?? chart?.artist ?? params.get("artist") ?? catalogue?.artist ?? "");
  const [youtube, setYoutube] = useState(existing?.youtube ?? "");
  const [sourceUrl, setSourceUrl] = useState(existing?.sourceUrl ?? "");
  const sourceOk = !sourceUrl.trim() || /^https?:\/\/\S+$/i.test(sourceUrl.trim());
  const [text, setText] = useState(existing?.sheet ?? skeleton);
  const [saving, setSaving] = useState(false);
  const parsed = useMemo(() => parseSheet(text), [text]);
  const chords = uniqueChords(parsed.lines);
  const lyricLines = parsed.lines.filter((l) => l.kind === "lyric" && l.text.trim()).length;
  const sections = parsed.lines.filter((l) => l.kind === "section").length;
  const ytOk = !youtube.trim() || youtubeId(youtube) !== null;

  // Pasted ChordPro may carry its own title/artist; used when the fields are left empty.
  const finalTitle = title.trim() || parsed.title || "";
  const finalArtist = artist.trim() || parsed.artist || "";

  const save = async () => {
    if (!finalTitle) return toast.error("Give the song a title.");
    if (!chords.length) return toast.error("No chords found. Put chords on their own line above the words, or inline like [Am].");
    if (!ytOk) return toast.error("That doesn't look like a YouTube link.");
    if (!sourceOk) return toast.error("The source page should be a web link starting with https://");
    setSaving(true);
    try {
      const secs = sheetSections(parsed.lines).map((s, i) => ({ id: `s${i}`, name: s.name, bars: s.bars }));
      const saved = await customSongRepo.save({
        id: existing?.id,
        createdAt: existing?.createdAt,
        title: finalTitle.slice(0, 80),
        artist: finalArtist.slice(0, 80),
        key: guessKey(parsed.lines),
        tempo: existing?.tempo ?? 80,
        beatsPerBar: existing?.beatsPerBar ?? 4,
        strum: existing?.strum ?? "D-DU-UDU",
        notes: existing?.notes ?? "",
        fromCatalogue: existing?.fromCatalogue ?? catalogue?.id ?? chart?.id,
        sections: secs,
        sheet: text.slice(0, 30000),
        youtube: youtube.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
      });
      toast.success("Song saved to your profile");
      onSaved(saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the song.");
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/songs" className="-ml-1 inline-flex min-h-10 items-center gap-1 px-1 text-sm text-muted hover:text-text">
        <ChevronLeft className="h-4 w-4" /> All songs
      </Link>
      <div>
        <h1 className="font-display text-4xl tracking-tight">{existing ? "Edit song sheet" : "Add a song with lyrics & chords"}</h1>
        <p className="mt-2 text-muted">Paste the lyrics with chords from any chord site or songbook you use (or type them). Then sing along with the chords above the words, and let the sheet follow your voice.</p>
      </div>
      {chart && (
        <Callout tone="info" title={`Chords for ${chart.title} are filled in`}>
          Easiest: tap “Find lyrics with chords”, copy the whole lyrics-and-chords page for this song, then “Paste from clipboard” to replace this chords-only outline.
        </Callout>
      )}
      <Card>
        <CardHeader title="Song details" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="sheet-title">
            <Input id="sheet-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder={parsed.title ?? "Song title"} />
          </Field>
          <Field label="Singer / artist" htmlFor="sheet-artist">
            <Input id="sheet-artist" value={artist} maxLength={80} onChange={(e) => setArtist(e.target.value)} placeholder="Optional" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="YouTube link (optional)" htmlFor="sheet-yt" hint={ytOk ? "Paste the song's official video link to play it beside the lyrics." : "That doesn't look like a YouTube link."}>
              <Input id="sheet-yt" value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" aria-invalid={!ytOk} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Source page (optional)" htmlFor="sheet-src" hint={sourceOk ? "Where you copied the lyrics & chords from (e.g. an Ultimate Guitar page) — saved so you can open it again." : "Use a full web link starting with https://"}>
              <Input id="sheet-src" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://tabs.ultimate-guitar.com/…" aria-invalid={!sourceOk} />
            </Field>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          icon={<ClipboardPaste className="h-5 w-5" />}
          title="Lyrics & chords"
          description="Chords on their own line above the words (spacing is kept), or inline like [Am]. Section names like [Chorus] or “Verse:” are optional."
        />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <a href={ultimateGuitarSearch(finalTitle || "song")} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-2" data-testid="editor-find-ug">
              <Search className="h-4 w-4 text-guitar" /> 1. Find on Ultimate Guitar <ExternalLink className="h-3.5 w-3.5 text-muted" />
            </a>
            <a href={lyricsChordsSearch(finalTitle || "song", finalArtist)} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-2" data-testid="editor-find-lyrics">
              <Search className="h-4 w-4 text-muted" /> or search the web <ExternalLink className="h-3.5 w-3.5 text-muted" />
            </a>
            <Button
              size="sm"
              variant="secondary"
              className="h-9"
              data-testid="paste-clipboard"
              onClick={async () => {
                try {
                  const clip = await navigator.clipboard.readText();
                  if (!clip.trim()) return toast.message("Your clipboard is empty — copy the lyrics with chords first.");
                  setText(clip);
                  toast.success("Pasted. Check the preview below.");
                } catch {
                  toast.message("Your browser blocked clipboard access — click in the box below and press Ctrl+V (⌘V on Mac).");
                }
              }}
            >
              <ClipboardPaste className="h-4 w-4" /> 2. Paste from clipboard
            </Button>
          </div>
          <textarea
            aria-label="Lyrics and chords"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={18}
            spellCheck={false}
            placeholder={EXAMPLE}
            className="w-full rounded-xl border border-border bg-surface p-3 font-mono text-sm leading-relaxed placeholder:text-subtle focus:border-accent focus:outline-none"
            data-testid="sheet-text"
          />
          <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
            <Badge tone={chords.length ? "success" : "neutral"}>{chords.length} chord{chords.length === 1 ? "" : "s"}{chords.length ? `: ${chords.slice(0, 8).join(" ")}${chords.length > 8 ? "…" : ""}` : ""}</Badge>
            <Badge>{lyricLines} lyric line{lyricLines === 1 ? "" : "s"}</Badge>
            {sections > 0 && <Badge>{sections} section{sections === 1 ? "" : "s"}</Badge>}
            {chords.length > 0 && <Badge tone="theory">Key looks like {guessKey(parsed.lines)}</Badge>}
          </div>
          <p className="text-xs text-muted">
            For your personal practice. The song stays in your profile; it isn&apos;t shared or published. Keep in mind profiles have no password, so anyone using this site can open any profile.
          </p>
        </CardBody>
      </Card>
      <div className="flex gap-2">
        <Button onClick={() => void save()} loading={saving} data-testid="sheet-save">Save & open</Button>
        <Link href="/songs" className="inline-flex h-10 items-center rounded-xl px-4 text-sm text-muted hover:bg-surface-2">Cancel</Link>
      </div>
    </div>
  );
}
