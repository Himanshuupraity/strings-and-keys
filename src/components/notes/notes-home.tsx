"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Guitar, ListMusic, NotebookPen, Piano, Plus, Search } from "lucide-react";
import { Badge, Card, EmptyState, Input, PageHeader, Segmented, Skeleton, cn } from "@/components/ui";
import { useData } from "@/hooks/use-data";
import { usePrefs } from "@/hooks/use-prefs";
import { useLang, useT, type MessageKey } from "@/lib/i18n";
import { notePreview, noteInstrument, type Note, type NoteKind } from "@/lib/notes/model";
import { notesRepo } from "@/lib/notes/repo";

export const KIND_LABEL: Record<NoteKind, MessageKey> = { tab: "notes.kind.tab", chords: "notes.kind.chords", piano: "notes.kind.piano" };
export const KIND_ICON = { tab: Guitar, chords: ListMusic, piano: Piano } as const;

export function NotesHome() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const [prefs, setPrefs] = usePrefs();
  const instrument = prefs.instrument;
  // Links like /notes?i=piano switch the app's instrument mode, so the header toggle stays in step.
  const linked = params.get("i");
  useEffect(() => {
    if (linked !== "guitar" && linked !== "piano") return;
    setPrefs({ instrument: linked });
    router.replace("/notes", { scroll: false });
  }, [linked, setPrefs, router]);
  const [filter, setFilter] = useState<"all" | "tab" | "chords">("all");
  const [q, setQ] = useState("");
  const { data: notes, loading } = useData(() => notesRepo.list(), ["notes"], [] as Note[]);

  const counts = { guitar: notes.filter((n) => noteInstrument(n.kind) === "guitar").length, piano: notes.filter((n) => n.kind === "piano").length };
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return notes.filter(
      (n) =>
        noteInstrument(n.kind) === instrument &&
        (instrument === "piano" || filter === "all" || n.kind === filter) &&
        (!needle || `${n.title} ${n.artist}`.toLowerCase().includes(needle)),
    );
  }, [notes, instrument, filter, q]);

  const creators: { kind: NoteKind; label: MessageKey; hint: MessageKey }[] =
    instrument === "guitar"
      ? [
          { kind: "tab", label: "notes.newTab", hint: "notes.newTabHint" },
          { kind: "chords", label: "notes.newChords", hint: "notes.newChordsHint" },
        ]
      : [{ kind: "piano", label: "notes.newPiano", hint: "notes.newPianoHint" }];

  return (
    <div>
      <PageHeader eyebrow={t("notes.eyebrow")} title={t("notes.title")} description={t("notes.description")} />

      <Segmented
        size="lg"
        className="mb-5 w-full sm:w-auto"
        label={t("shell.instrumentMode")}
        value={instrument}
        onChange={(v) => setPrefs({ instrument: v })}
        options={[
          { value: "guitar", label: `${t("notes.guitarNotes")} (${counts.guitar})`, icon: <Guitar className="h-4 w-4" />, activeClass: "text-guitar", testId: "notes-guitar" },
          { value: "piano", label: `${t("notes.pianoNotes")} (${counts.piano})`, icon: <Piano className="h-4 w-4" />, activeClass: "text-piano", testId: "notes-piano" },
        ]}
      />

      <div className={cn("mb-6 grid gap-3", creators.length > 1 && "sm:grid-cols-2")}>
        {creators.map((c) => {
          const Icon = KIND_ICON[c.kind];
          return (
            <Link
              key={c.kind}
              href={`/notes/note?new=${c.kind}`}
              className={cn(
                "flex items-center gap-3 rounded-2xl border-2 border-dashed p-4 transition-colors",
                instrument === "guitar" ? "border-guitar/40 hover:bg-guitar-soft" : "border-piano/40 hover:bg-piano-soft",
              )}
              data-testid={`new-${c.kind}`}
            >
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white", instrument === "guitar" ? "bg-guitar" : "bg-piano")}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 font-semibold">
                  <Plus className="h-4 w-4" /> {t(c.label)}
                </span>
                <span className="block text-sm text-muted">{t(c.hint)}</span>
              </span>
            </Link>
          );
        })}
      </div>

      {(instrument === "guitar" ? counts.guitar : counts.piano) > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {instrument === "guitar" && (
            <Segmented
              size="sm"
              label={t("notes.filter")}
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: t("notes.all") },
                { value: "tab", label: t("notes.kind.tab") },
                { value: "chords", label: t("notes.kind.chords") },
              ]}
            />
          )}
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("notes.search")} aria-label={t("notes.search")} className="pl-9" />
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : shown.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="notes-list">
          {shown.map((n) => {
            const Icon = KIND_ICON[n.kind];
            const preview = notePreview(n);
            return (
              <li key={n.id}>
                <Link href={`/notes/note?id=${n.id}`} className="block h-full">
                  <Card className="h-full p-4 transition-colors hover:border-border-strong hover:bg-surface-2/50">
                    <div className="flex items-start gap-3">
                      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", n.kind === "piano" ? "bg-piano-soft text-piano" : "bg-guitar-soft text-guitar")}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{n.title}</p>
                        {n.artist && <p className="truncate text-sm text-muted">{n.artist}</p>}
                      </div>
                      <Badge tone={n.kind === "piano" ? "piano" : "guitar"}>{t(KIND_LABEL[n.kind])}</Badge>
                    </div>
                    {preview && <p className="mt-3 truncate text-sm text-muted">{preview}</p>}
                    <p className="mt-2 text-xs text-subtle">{t("notes.updated", { date: new Date(n.updatedAt).toLocaleDateString(lang === "hi" ? "hi-IN" : undefined, { day: "numeric", month: "short", year: "numeric" }) })}</p>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={<NotebookPen className="h-8 w-8" />}
          title={q.trim() ? t("notes.noMatches") : instrument === "guitar" ? t("notes.emptyGuitar") : t("notes.emptyPiano")}
          description={q.trim() ? undefined : instrument === "guitar" ? t("notes.emptyGuitarHint") : t("notes.emptyPianoHint")}
        />
      )}
    </div>
  );
}
