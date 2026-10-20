"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, Copy, Pencil, Play, Save, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, EmptyState, Field, Input, Segmented, Select, Skeleton } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { DEFAULT_TUNING, NOTE_KINDS, notesUsed, pianoToText, tabToAscii, tuningLabels, type Note, type NoteKind } from "@/lib/notes/model";
import { notesRepo } from "@/lib/notes/repo";
import { KIND_LABEL } from "./notes-home";
import { TabEditor, newTabSection } from "./tab-editor";
import { TabStaff, useTabPlayer } from "./tab-staff";
import { ChordsEditor, ChordsView } from "./chords-note";
import { PianoEditor, PianoView, newPianoLine } from "./piano-note";

const TUNINGS = [
  { value: "E A D G B E", label: "Standard (E A D G B E)" },
  { value: "D A D G B E", label: "Drop D (D A D G B E)" },
  { value: "Eb Ab Db Gb Bb Eb", label: "Half-step down (Eb Ab Db Gb Bb Eb)" },
  { value: "D G D G B D", label: "Open G (D G D G B D)" },
  { value: "D A D G A D", label: "DADGAD" },
];

type Draft = Omit<Note, "id" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string };

function blankDraft(kind: NoteKind): Draft {
  if (kind === "tab") return { kind, title: "", artist: "", tuning: DEFAULT_TUNING, capo: 0, tab: [newTabSection()] };
  if (kind === "chords") return { kind, title: "", artist: "", capo: 0, text: "" };
  return { kind, title: "", artist: "", piano: [newPianoLine(), newPianoLine()] };
}

/** The whole note as plain text, for pasting into WhatsApp / another app. */
function noteText(n: Note): string {
  const head = [n.title, n.artist].filter(Boolean).join(" — ");
  const meta = n.kind === "piano" ? "" : [n.kind === "tab" && n.tuning ? `Tuning: ${n.tuning}` : "", n.capo ? `Capo: ${n.capo}` : ""].filter(Boolean).join(" · ");
  const body = n.kind === "tab" ? tabToAscii(n.tab ?? [], n.tuning) : n.kind === "chords" ? n.text ?? "" : `Notes: ${notesUsed(n.piano ?? []).join(" ")}\n\n${pianoToText(n.piano ?? [])}`;
  return [head, meta, body].filter(Boolean).join("\n\n");
}

export function NotePage() {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const newKind = params.get("new") as NoteKind | null;
  const editing = params.get("edit") === "1";
  const [loaded, setLoaded] = useState<{ id: string; note: Note | null } | null>(null);
  const note = !id ? null : loaded?.id === id ? loaded.note : undefined;

  useEffect(() => {
    if (!id) return;
    let alive = true;
    void notesRepo.get(id).then((n) => alive && setLoaded({ id, note: n ?? null }));
    return () => {
      alive = false;
    };
  }, [id, editing]);

  if (newKind && NOTE_KINDS.includes(newKind)) {
    return <NoteEditor key={`new-${newKind}`} initial={blankDraft(newKind)} onSaved={(n) => router.replace(`/notes/note?id=${n.id}`)} onCancel={() => router.push(`/notes?i=${newKind === "piano" ? "piano" : "guitar"}`)} />;
  }
  if (note === undefined) return <Skeleton className="h-96" />;
  if (note === null) {
    return <EmptyState title={t("notes.notFound")} description={t("notes.notFoundHint")} action={<Link href="/notes" className="text-accent hover:underline">{t("notes.backToNotes")}</Link>} />;
  }
  if (editing) return <NoteEditor key={note.id} initial={note} onSaved={(n) => router.replace(`/notes/note?id=${n.id}`)} onCancel={() => router.replace(`/notes/note?id=${note.id}`)} />;
  return <NoteView note={note} />;
}

function BackLink({ kind }: { kind: NoteKind }) {
  const t = useT();
  return (
    <Link href={`/notes?i=${kind === "piano" ? "piano" : "guitar"}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
      <ChevronLeft className="h-4 w-4" /> {t("notes.backToNotes")}
    </Link>
  );
}

function NoteView({ note }: { note: Note }) {
  const t = useT();
  const router = useRouter();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(noteText(note));
      toast.success(t("notes.copied"));
    } catch {
      toast.error(t("notes.copyFailed"));
    }
  };
  const remove = async () => {
    if (!window.confirm(t("notes.confirmDelete", { title: note.title }))) return;
    await notesRepo.remove(note.id);
    toast.success(t("notes.deleted"));
    router.replace(`/notes?i=${note.kind === "piano" ? "piano" : "guitar"}`);
  };

  return (
    <div>
      <BackLink kind={note.kind} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl" data-testid="note-title">
            {note.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            {note.artist && <span>{note.artist}</span>}
            <Badge tone={note.kind === "piano" ? "piano" : "guitar"}>{t(KIND_LABEL[note.kind])}</Badge>
            {note.kind === "tab" && <Badge>{t("notes.tuningIs", { tuning: note.tuning ?? DEFAULT_TUNING })}</Badge>}
            {note.kind !== "piano" && <Badge>{note.capo ? t("notes.capoOn", { n: note.capo }) : t("notes.noCapo")}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => router.push(`/notes/note?id=${note.id}&edit=1`)} data-testid="note-edit">
            <Pencil className="h-4 w-4" /> {t("common.edit")}
          </Button>
          <Button variant="secondary" onClick={() => void copy()}>
            <Copy className="h-4 w-4" /> {t("notes.copyText")}
          </Button>
          <Button variant="ghost" onClick={() => void remove()} aria-label={t("common.delete")}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {note.kind === "tab" && <TabView note={note} />}
      {note.kind === "chords" && <ChordsView text={note.text ?? ""} capo={note.capo} />}
      {note.kind === "piano" && <PianoView lines={note.piano ?? []} />}
    </div>
  );
}

const SPEEDS = { slow: 0.5, medium: 0.32, fast: 0.2 } as const;

function TabView({ note }: { note: Note }) {
  const t = useT();
  const sections = note.tab ?? [];
  const labels = tuningLabels(note.tuning);
  const [speed, setSpeed] = useState<keyof typeof SPEEDS>("medium");
  const player = useTabPlayer(note.tuning, note.capo ?? 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {player.playing ? (
          <Button variant="secondary" onClick={player.stop}>
            <Square className="h-4 w-4" /> {t("notes.stop")}
          </Button>
        ) : (
          <Button onClick={() => player.play(sections, SPEEDS[speed])} data-testid="tab-play">
            <Play className="h-4 w-4" /> {t("notes.play")}
          </Button>
        )}
        <Segmented
          size="sm"
          label={t("notes.speed")}
          value={speed}
          onChange={setSpeed}
          options={[
            { value: "slow", label: t("notes.slow") },
            { value: "medium", label: t("notes.medium") },
            { value: "fast", label: t("notes.fast") },
          ]}
        />
        <span className="text-xs text-muted">{t("notes.tapToPlayFrom")}</span>
      </div>
      <Card className="space-y-2 p-3 sm:p-5" data-testid="tab-view">
        {sections.map((s, si) => (
          <TabStaff
            key={s.id}
            section={s}
            labels={labels}
            playing={player.pos?.s === si ? player.pos.c : null}
            onCellTap={(c) => player.play(sections, SPEEDS[speed], { s: si, c })}
          />
        ))}
      </Card>
    </div>
  );
}

function NoteEditor({ initial, onSaved, onCancel }: { initial: Draft; onSaved: (n: Note) => void; onCancel: () => void }) {
  const t = useT();
  const [draft, setDraft] = useState<Draft>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  };

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async () => {
    setSaving(true);
    try {
      const title = draft.title.trim() || t(draft.kind === "tab" ? "notes.untitledTab" : draft.kind === "chords" ? "notes.untitledChords" : "notes.untitledPiano");
      const n = await notesRepo.save({ ...draft, title: title.slice(0, 80), artist: draft.artist.trim() });
      setDirty(false);
      toast.success(t("notes.saved"));
      onSaved(n);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("notes.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const heading = initial.id ? t("notes.editing", { kind: t(KIND_LABEL[draft.kind]) }) : t(draft.kind === "tab" ? "notes.newTab" : draft.kind === "chords" ? "notes.newChords" : "notes.newPiano");

  return (
    <div>
      <BackLink kind={draft.kind} />
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl tracking-tight sm:text-3xl">{heading}</h1>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void save()} loading={saving} data-testid="note-save">
            <Save className="h-4 w-4" /> {t("common.save")}
          </Button>
        </div>
      </div>

      <Card className="mb-5 grid gap-3 p-4 sm:grid-cols-2">
        <Field label={t("notes.songTitle")} htmlFor="note-title">
          <Input id="note-title" value={draft.title} onChange={(e) => set({ title: e.target.value.slice(0, 80) })} placeholder={t("notes.songTitlePlaceholder")} />
        </Field>
        <Field label={t("notes.artist")} htmlFor="note-artist">
          <Input id="note-artist" value={draft.artist} onChange={(e) => set({ artist: e.target.value.slice(0, 80) })} placeholder={t("notes.artistPlaceholder")} />
        </Field>
        {draft.kind === "tab" && (
          <Field label={t("notes.tuning")} htmlFor="note-tuning">
            <Select id="note-tuning" value={draft.tuning ?? DEFAULT_TUNING} onChange={(e) => set({ tuning: e.target.value })} className="w-full">
              {TUNINGS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {draft.kind !== "piano" && (
          <Field label={t("notes.capo")} htmlFor="note-capo">
            <Select id="note-capo" value={draft.capo ?? 0} onChange={(e) => set({ capo: Number(e.target.value) })} className="w-full">
              {Array.from({ length: 13 }, (_, i) => (
                <option key={i} value={i}>
                  {i === 0 ? t("notes.noCapo") : t("notes.capoOn", { n: i })}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </Card>

      {draft.kind === "tab" && <TabEditor sections={draft.tab ?? []} onChange={(tab) => set({ tab })} tuning={draft.tuning} />}
      {draft.kind === "chords" && <ChordsEditor text={draft.text ?? ""} onChange={(text) => set({ text })} />}
      {draft.kind === "piano" && <PianoEditor lines={draft.piano ?? []} onChange={(piano) => set({ piano })} />}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button onClick={() => void save()} loading={saving}>
          <Save className="h-4 w-4" /> {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
