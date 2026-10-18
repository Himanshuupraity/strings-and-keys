"use client";

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
        title="Song not found"
        description="It may have been deleted, or it was saved in a different browser. User songs are stored on this device."
        action={<Link className="text-accent hover:underline" href="/songs">Back to songs</Link>}
      />
    );

  if (editing)
    return <SongEditor initial={toDraft(song)} onSaved={(s) => router.replace(`/songs/custom?id=${s.id}`)} onCancel={() => router.replace(`/songs/custom?id=${song.id}`)} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => router.replace(`/songs/custom?id=${song.id}&edit=1`)}>
          <Pencil className="h-4 w-4" /> Edit chords
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
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>
      <SongWorkspace song={customToSong(song)} />
    </div>
  );
}

function SongEditor({ initial, onSaved, onCancel }: { initial: Draft; onSaved: (s: CustomSong) => void; onCancel: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const setSection = (i: number, patch: Partial<DraftSection>) => setD((x) => ({ ...x, sections: x.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  const sectionErrors = d.sections.map((s) => {
    if (!s.chart.trim()) return null;
    const bad = invalidChords({ sections: [{ bars: parseChordChart(s.chart, d.beatsPerBar) }] } as never);
    return bad.length ? `Unknown chord${bad.length > 1 ? "s" : ""}: ${bad.join(", ")}` : null;
  });

  const save = async () => {
    setError(null);
    const sections = d.sections.filter((s) => s.chart.trim()).map((s) => ({ id: s.id, name: s.name.trim() || "Section", bars: parseChordChart(s.chart, d.beatsPerBar) }));
    if (!d.title.trim()) return setError("Give your song a title.");
    if (!sections.length) return setError("Add at least one section with chords.");
    if (sectionErrors.some(Boolean)) return setError("Fix the unknown chords highlighted below.");
    setSaving(true);
    try {
      const saved = await customSongRepo.save({ id: d.id, createdAt: d.createdAt, title: d.title.trim(), artist: d.artist.trim(), key: d.key, tempo: d.tempo, beatsPerBar: d.beatsPerBar, strum: d.strum, notes: d.notes, fromCatalogue: d.fromCatalogue, sections });
      toast.success("Song saved on this device");
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the song.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/songs" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ChevronLeft className="h-4 w-4" /> All songs
      </Link>
      <div>
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{d.id ? "Edit your song" : "Add a song with your own chords"}</h1>
        <p className="mt-2 text-muted">Enter chords from a source you trust (an official songbook or licensed chart). Lyrics aren’t needed — and please don’t paste copyrighted lyrics here.</p>
      </div>
      <Card>
        <CardHeader title="Song details" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="cs-title">
            <Input id="cs-title" value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={80} />
          </Field>
          <Field label="Artist (optional)" htmlFor="cs-artist">
            <Input id="cs-artist" value={d.artist} onChange={(e) => set({ artist: e.target.value })} maxLength={80} />
          </Field>
          <Field label="Key" htmlFor="cs-key" hint="Used for roman numerals and the capo helper.">
            <Select id="cs-key" value={d.key} onChange={(e) => set({ key: e.target.value })} className="w-full">
              <optgroup label="Major">
                {MAJOR_KEYS.map((k) => (<option key={k} value={k}>{k} major</option>))}
              </optgroup>
              <optgroup label="Minor">
                {MINOR_KEYS.map((k) => (<option key={k} value={k}>{k.replace(/m$/, "")} minor</option>))}
              </optgroup>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tempo (BPM)" htmlFor="cs-tempo">
              <Input id="cs-tempo" type="number" min={40} max={220} value={d.tempo} onChange={(e) => set({ tempo: Math.max(40, Math.min(220, Number(e.target.value) || 90)) })} />
            </Field>
            <Field label="Beats per bar" htmlFor="cs-bpb">
              <Select id="cs-bpb" value={d.beatsPerBar} onChange={(e) => set({ beatsPerBar: Number(e.target.value) as Draft["beatsPerBar"] })} className="w-full">
                <option value={4}>4 (4/4)</option>
                <option value={3}>3 (3/4)</option>
                <option value={2}>2 (2/4)</option>
              </Select>
            </Field>
          </div>
          <Field label="Strumming pattern" htmlFor="cs-strum" hint="Eighth-note slots: D = down, U = up, - = miss. e.g. D-DU-UDU">
            <Input id="cs-strum" value={d.strum} onChange={(e) => set({ strum: e.target.value.toUpperCase().replace(/[^DU-]/g, "").slice(0, 16) })} />
          </Field>
          <Field label="Notes (optional)" htmlFor="cs-notes">
            <Input id="cs-notes" value={d.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={500} placeholder="e.g. Source: official songbook, p. 12" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Sections & chords" description="Separate bars with |. Two chords in one bar share it equally: “G D | Em | C”." />
        <CardBody className="space-y-4">
          {d.sections.map((s, i) => (
            <div key={s.id} className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <Input aria-label="Section name" value={s.name} onChange={(e) => setSection(i, { name: e.target.value })} className="max-w-48" maxLength={40} />
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
              {sectionErrors[i] && <p className="text-xs text-danger">{sectionErrors[i]} — try symbols like C, Am, G7, Fmaj7, Bb, F#m, Dsus4, C/G.</p>}
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => setD((x) => ({ ...x, sections: [...x.sections, { id: uid("sec_"), name: x.sections.length === 1 ? "Chorus" : `Section ${x.sections.length + 1}`, chart: "" }] }))}>
            <Plus className="h-4 w-4" /> Add section
          </Button>
        </CardBody>
      </Card>

      {error && <Callout tone="danger" title="Can't save yet">{error}</Callout>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => void save()} loading={saving} data-testid="custom-song-save">
          <Save className="h-4 w-4" /> Save song
        </Button>
      </div>
    </div>
  );
}
