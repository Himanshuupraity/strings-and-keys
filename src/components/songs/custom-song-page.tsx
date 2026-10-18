"use client";
import { useT } from "@/lib/i18n";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Callout, Card, CardBody, CardHeader, EmptyState, Field, Input, Select, Skeleton } from "@/components/ui";
import { MAJOR_KEYS, MINOR_KEYS } from "@/lib/music/transpose";
import { uid } from "@/lib/storage/db";
import { chordChartText, parseChordChart } from "@/content/songs/parse";
import { customSongRepo, customToSong, invalidChords, type CustomSong } from "./custom-repo";
import { SongWorkspace } from "./song-workspace";

interface DraftSection {
  id: string;
  name: string;
  chart: string;
}

interface Draft {
  id?: string;
  createdAt?: string;
  title: string;
  artist: string;
  key: string;
  tempo: number;
  beatsPerBar: 2 | 3 | 4 | 6;
  strum: string;
  notes: string;
  fromCatalogue?: string;
  sections: DraftSection[];
}

function toDraft(c: CustomSong): Draft {
  return { ...c, sections: c.sections.map((s) => ({ id: s.id, name: s.name, chart: chordChartText(s.bars) })) };
}

export function CustomSongPage() {
  const tr = useT();
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const isNew = params.get("new") === "1";
  const editing = params.get("edit") === "1";
  const [loaded, setLoaded] = useState<{ id: string; song: CustomSong | null } | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    void customSongRepo.get(id).then((s) => alive && setLoaded({ id, song: s ?? null }));
    return () => {
      alive = false;
    };
  }, [id, editing]);
  const song = !id ? null : loaded?.id === id ? loaded.song : undefined;

  if (isNew) {
    return (
      <SongEditor
        initial={{ title: params.get("title") ?? "", artist: params.get("artist") ?? "", key: "G", tempo: 90, beatsPerBar: 4, strum: "D-DU-UDU", notes: "", fromCatalogue: params.get("from") ?? undefined, sections: [{ id: "verse", name: "Verse", chart: "" }] }}
        onSaved={(s) => router.replace(`/songs/custom?id=${s.id}`)}
        onCancel={() => router.push("/songs")}
      />
    );
  }

  if (song === undefined) return <Skeleton className="h-96" />;
  if (song === null)
    return (
      <EmptyState
        title={tr("ui.song_not_found")}
        description={tr("ui.it_may_have_been_deleted_or_it_was_saved_in_a_di")}
        action={<Link className="text-accent hover:underline" href="/songs">{tr("ui.back_to_songs")}</Link>}
      />
    );

  if (editing)
    return <SongEditor initial={toDraft(song)} onSaved={(s) => router.replace(`/songs/custom?id=${s.id}`)} onCancel={() => router.replace(`/songs/custom?id=${song.id}`)} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => router.replace(`/songs/custom?id=${song.id}&edit=1`)}>
          <Pencil className="h-4 w-4" /> {tr("ui.edit_chords")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await customSongRepo.remove(song.id);
            toast.success(`Deleted “${song.title}”`);
            router.push("/songs");
          }}
        >
          <Trash2 className="h-4 w-4" /> {tr("common.delete")}
        </Button>
      </div>
      <SongWorkspace song={customToSong(song)} />
    </div>
  );
}

function SongEditor({ initial, onSaved, onCancel }: { initial: Draft; onSaved: (s: CustomSong) => void; onCancel: () => void }) {
  const tr = useT();
  const [d, setD] = useState<Draft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const setSection = (i: number, patch: Partial<DraftSection>) => setD((x) => ({ ...x, sections: x.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  const sectionErrors = d.sections.map((s) => {
    if (!s.chart.trim()) return null;
    const bad = invalidChords({ sections: [{ bars: parseChordChart(s.chart, d.beatsPerBar) }] } as never);
    return bad.length ? tr(bad.length > 1 ? "ui.unknown_chords" : "ui.unknown_chord", { list: bad.join(", ") }) : null;
  });

  const save = async () => {
    setError(null);
    const sections = d.sections.filter((s) => s.chart.trim()).map((s) => ({ id: s.id, name: s.name.trim() || "Section", bars: parseChordChart(s.chart, d.beatsPerBar) }));
    if (!d.title.trim()) return setError(tr("ui.give_your_song_a_title"));
    if (!sections.length) return setError(tr("ui.add_at_least_one_section_with_chords"));
    if (sectionErrors.some(Boolean)) return setError(tr("ui.fix_the_unknown_chords_highlighted_below"));
    setSaving(true);
    try {
      const saved = await customSongRepo.save({ id: d.id, createdAt: d.createdAt, title: d.title.trim(), artist: d.artist.trim(), key: d.key, tempo: d.tempo, beatsPerBar: d.beatsPerBar, strum: d.strum, notes: d.notes, fromCatalogue: d.fromCatalogue, sections });
      toast.success(tr("ui.song_saved_on_this_device"));
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("ui.could_not_save_the_song"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/songs" className="-ml-1 inline-flex min-h-10 items-center gap-1 px-1 text-sm text-muted hover:text-text">
        <ChevronLeft className="h-4 w-4" /> {tr("common.allSongs")}
      </Link>
      <div>
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{d.id ? tr("ui.edit_your_song") : tr("ui.add_a_song_with_your_own_chords")}</h1>
        <p className="mt-2 text-muted">{tr("ui.enter_chords_from_a_source_you_trust_an_official")}</p>
      </div>
      <Card>
        <CardHeader title={tr("ui.song_details")} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={tr("ui.title")} htmlFor="cs-title">
            <Input id="cs-title" value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={80} />
          </Field>
          <Field label={tr("ui.artist_optional")} htmlFor="cs-artist">
            <Input id="cs-artist" value={d.artist} onChange={(e) => set({ artist: e.target.value })} maxLength={80} />
          </Field>
          <Field label={tr("ui.key")} htmlFor="cs-key" hint={tr("ui.used_for_roman_numerals_and_the_capo_helper")}>
            <Select id="cs-key" value={d.key} onChange={(e) => set({ key: e.target.value })} className="w-full">
              <optgroup label={tr("ui.major")}>
                {MAJOR_KEYS.map((k) => (<option key={k} value={k}>{k} major</option>))}
              </optgroup>
              <optgroup label={tr("ui.minor")}>
                {MINOR_KEYS.map((k) => (<option key={k} value={k}>{k.replace(/m$/, "")} minor</option>))}
              </optgroup>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("ui.tempo_bpm")} htmlFor="cs-tempo">
              <Input id="cs-tempo" type="number" min={40} max={220} value={d.tempo} onChange={(e) => set({ tempo: Math.max(40, Math.min(220, Number(e.target.value) || 90)) })} />
            </Field>
            <Field label={tr("ui.beats_per_bar")} htmlFor="cs-bpb">
              <Select id="cs-bpb" value={d.beatsPerBar} onChange={(e) => set({ beatsPerBar: Number(e.target.value) as Draft["beatsPerBar"] })} className="w-full">
                <option value={4}>4 (4/4)</option>
                <option value={3}>3 (3/4)</option>
                <option value={2}>2 (2/4)</option>
              </Select>
            </Field>
          </div>
          <Field label={tr("ui.strumming_pattern")} htmlFor="cs-strum" hint={tr("ui.strum_hint")}>
            <Input id="cs-strum" value={d.strum} onChange={(e) => set({ strum: e.target.value.toUpperCase().replace(/[^DU-]/g, "").slice(0, 16) })} />
          </Field>
          <Field label={tr("ui.notes_optional")} htmlFor="cs-notes">
            <Input id="cs-notes" value={d.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={500} placeholder={tr("ui.e_g_source_official_songbook_p_12")} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={tr("ui.sections_chords")} description={tr("ui.separate_bars_with_two_chords_in_one_bar_share_i")} />
        <CardBody className="space-y-4">
          {d.sections.map((s, i) => (
            <div key={s.id} className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <Input aria-label={tr("ui.section_name")} value={s.name} onChange={(e) => setSection(i, { name: e.target.value })} className="max-w-48" maxLength={40} />
                {d.sections.length > 1 && (
                  <Button size="icon" variant="ghost" aria-label={`Remove ${s.name}`} onClick={() => setD((x) => ({ ...x, sections: x.sections.filter((_, j) => j !== i) }))}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <textarea
                aria-label={`${s.name} chords`}
                value={s.chart}
                onChange={(e) => setSection(i, { chart: e.target.value })}
                rows={2}
                placeholder="G D | Em C | G D | C"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-sm focus:border-accent focus:outline-none"
              />
              {sectionErrors[i] && <p className="text-xs text-danger">{sectionErrors[i]} {tr("ui.try_symbols")}</p>}
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => setD((x) => ({ ...x, sections: [...x.sections, { id: uid("sec_"), name: x.sections.length === 1 ? "Chorus" : `Section ${x.sections.length + 1}`, chart: "" }] }))}>
            <Plus className="h-4 w-4" /> {tr("ui.add_section")}
          </Button>
        </CardBody>
      </Card>

      {error && <Callout tone="danger" title={tr("ui.can_t_save_yet")}>{error}</Callout>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>{tr("common.cancel")}</Button>
        <Button onClick={() => void save()} loading={saving} data-testid="custom-song-save">
          <Save className="h-4 w-4" /> {tr("ui.save_song")}
        </Button>
      </div>
    </div>
  );
}
