"use client";
import { useT } from "@/lib/i18n";

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
  const tr = useT();
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
    return <EmptyState title={tr("ui.song_sheet_not_found")} description={tr("ui.it_may_have_been_deleted_or_it_was_saved_on_anot")} action={<Link href="/songs/sheet?new=1" className="text-accent hover:underline">{tr("ui.paste_a_new_song")}</Link>} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/songs" className="-ml-1 inline-flex min-h-10 items-center gap-1 px-1 text-sm text-muted hover:text-text">
          <ChevronLeft className="h-4 w-4" /> {tr("common.allSongs")}
        </Link>
        <div className="flex flex-wrap gap-2">
          {song.sourceUrl && (
            <a href={song.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-surface-2" data-testid="open-source">
              <ExternalLink className="h-4 w-4" /> {tr("ui.open_original")}
            </a>
          )}
          <Link href={`/songs/custom?id=${song.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-surface-2">
            <SlidersHorizontal className="h-4 w-4" /> {tr("ui.practice_tools")}
          </Link>
          <Link href={`/songs/sheet?id=${song.id}&edit=1`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-surface-2" data-testid="sheet-edit">
            <Pencil className="h-4 w-4" /> {tr("common.edit")}
          </Link>
          <Button
            size="sm"
            variant="ghost"
            aria-label={tr("ui.delete_this_song")}
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
            toast.error(tr("ui.no_chords_found_in_what_you_pasted_copy_a_versio"));
            return;
          }
          const saved = await customSongRepo.save({
            ...song,
            key: guessKey(parsed.lines),
            sections: sheetSections(parsed.lines).map((s, i) => ({ id: `s${i}`, name: s.name, bars: s.bars })),
            sheet: text.slice(0, 30000),
          });
          setLoaded({ id: saved.id, song: saved });
          toast.success(tr("ui.lyrics_added"));
        }}
      />
    </div>
  );
}

function SheetEditor({ existing, onSaved }: { existing?: CustomSong; onSaved: (s: CustomSong) => void }) {
  const tr = useT();
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
    if (!finalTitle) return toast.error(tr("ui.give_the_song_a_title"));
    if (!chords.length) return toast.error(tr("ui.no_chords_found_put_chords_on_their_own_line_abo"));
    if (!ytOk) return toast.error(tr("ui.that_doesn_t_look_like_a_youtube_link"));
    if (!sourceOk) return toast.error(tr("ui.the_source_page_should_be_a_web_link_starting_wi"));
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
      toast.success(tr("ui.song_saved_to_your_profile"));
      onSaved(saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("ui.couldn_t_save_the_song"));
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/songs" className="-ml-1 inline-flex min-h-10 items-center gap-1 px-1 text-sm text-muted hover:text-text">
        <ChevronLeft className="h-4 w-4" /> {tr("common.allSongs")}
      </Link>
      <div>
        <h1 className="font-display text-4xl tracking-tight">{existing ? tr("ui.edit_song_sheet") : tr("ui.add_a_song_with_lyrics_chords")}</h1>
        <p className="mt-2 text-muted">{tr("ui.paste_the_lyrics_with_chords_from_any_chord_site")}</p>
      </div>
      {chart && (
        <Callout tone="info" title={`Chords for ${chart.title} are filled in`}>
          {tr("ui.easiest_tap_find_lyrics_with_chords_copy_the_who")}
        </Callout>
      )}
      <Card>
        <CardHeader title={tr("ui.song_details")} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={tr("ui.title")} htmlFor="sheet-title">
            <Input id="sheet-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder={parsed.title ?? tr("ui.song_title")} />
          </Field>
          <Field label={tr("ui.singer_artist")} htmlFor="sheet-artist">
            <Input id="sheet-artist" value={artist} maxLength={80} onChange={(e) => setArtist(e.target.value)} placeholder={tr("ui.optional")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={tr("ui.youtube_link_optional")} htmlFor="sheet-yt" hint={ytOk ? tr("ui.paste_the_song_s_official_video_link_to_play_it") : tr("ui.that_doesn_t_look_like_a_youtube_link")}>
              <Input id="sheet-yt" value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" aria-invalid={!ytOk} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={tr("ui.source_page_optional")} htmlFor="sheet-src" hint={sourceOk ? tr("ui.where_you_copied_the_lyrics_chords_from_e_g_an_u") : tr("ui.use_a_full_web_link_starting_with_https")}>
              <Input id="sheet-src" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://tabs.ultimate-guitar.com/…" aria-invalid={!sourceOk} />
            </Field>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          icon={<ClipboardPaste className="h-5 w-5" />}
          title={tr("ui.lyrics_chords_2")}
          description={tr("ui.chords_on_their_own_line_above_the_words_spacing")}
        />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <a href={ultimateGuitarSearch(finalTitle || "song")} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-2" data-testid="editor-find-ug">
              <Search className="h-4 w-4 text-guitar" /> {tr("ui.1_find_on_ultimate_guitar")} <ExternalLink className="h-3.5 w-3.5 text-muted" />
            </a>
            <a href={lyricsChordsSearch(finalTitle || "song", finalArtist)} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-2" data-testid="editor-find-lyrics">
              <Search className="h-4 w-4 text-muted" /> {tr("ui.or_search_the_web")} <ExternalLink className="h-3.5 w-3.5 text-muted" />
            </a>
            <Button
              size="sm"
              variant="secondary"
              className="h-9"
              data-testid="paste-clipboard"
              onClick={async () => {
                try {
                  const clip = await navigator.clipboard.readText();
                  if (!clip.trim()) return toast.message(tr("ui.your_clipboard_is_empty_copy_the_lyrics_with_cho"));
                  setText(clip);
                  toast.success(tr("ui.pasted_check_the_preview_below"));
                } catch {
                  toast.message(tr("ui.your_browser_blocked_clipboard_access_click_in_t"));
                }
              }}
            >
              <ClipboardPaste className="h-4 w-4" /> {tr("ui.2_paste_from_clipboard")}
            </Button>
          </div>
          <textarea
            aria-label={tr("ui.lyrics_and_chords")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={18}
            spellCheck={false}
            placeholder={EXAMPLE}
            className="w-full rounded-xl border border-border bg-surface p-3 font-mono text-sm leading-relaxed placeholder:text-subtle focus:border-accent focus:outline-none"
            data-testid="sheet-text"
          />
          <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
            <Badge tone={chords.length ? "success" : "neutral"}>{tr(chords.length === 1 ? "ui.one_chord_badge" : "ui.n_chords_badge", { n: chords.length })}{chords.length ? `: ${chords.slice(0, 8).join(" ")}${chords.length > 8 ? "…" : ""}` : ""}</Badge>
            <Badge>{tr(lyricLines === 1 ? "ui.one_lyric_line" : "ui.n_lyric_lines", { n: lyricLines })}</Badge>
            {sections > 0 && <Badge>{tr(sections === 1 ? "ui.one_section" : "ui.n_sections", { n: sections })}</Badge>}
            {chords.length > 0 && <Badge tone="theory">{tr("ui.key_looks_like", { k: guessKey(parsed.lines) })}</Badge>}
          </div>
          <p className="text-xs text-muted">
            For your personal practice. The song stays in your profile; it isn&apos;t shared or published. Keep in mind profiles have no password, so anyone using this site can open any profile.
          </p>
        </CardBody>
      </Card>
      <div className="flex gap-2">
        <Button onClick={() => void save()} loading={saving} data-testid="sheet-save">{tr("ui.save_open")}</Button>
        <Link href="/songs" className="inline-flex h-10 items-center rounded-xl px-4 text-sm text-muted hover:bg-surface-2">{tr("common.cancel")}</Link>
      </div>
    </div>
  );
}
