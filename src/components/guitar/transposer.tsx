"use client";
import { useT, useTx } from "@/lib/i18n";

import { useMemo, useState } from "react";
import { ArrowRight, Bookmark, CheckCircle2, Info, Play, Shuffle, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { ChordDiagram } from "@/components/instruments/chord-diagram";
import { Badge, Button, Callout, Card, CardBody, CardHeader, Input, Segmented, Select, cn } from "@/components/ui";
import { useData } from "@/hooks/use-data";
import { strum } from "@/lib/audio/engine";
import { easiestShape, shapeMidi } from "@/lib/music/chords";
import { capoArrangements, keyChangeOptions, MAJOR_KEYS, MINOR_KEYS, transposeProgression, semitonesBetweenKeys, type CapoArrangement } from "@/lib/music/transpose";
import { transpositionRepo } from "@/lib/storage/repositories";
import { parseProgressionInput } from "./transpose-helpers";

const PRESETS: { label: string; key: string; chords: string[] }[] = [
  { label: "F – Bb – C (in F)", key: "F", chords: ["F", "Bb", "C"] },
  { label: "Bb – Gm – Eb – F (in Bb)", key: "Bb", chords: ["Bb", "Gm", "Eb", "F"] },
  { label: "Eb – Cm – Ab – Bb (in Eb)", key: "Eb", chords: ["Eb", "Cm", "Ab", "Bb"] },
  { label: "A – E – F#m – D (in A)", key: "A", chords: ["A", "E", "F#m", "D"] },
  { label: "Fm – Db – Ab – Eb (in Fm)", key: "Fm", chords: ["Fm", "Db", "Ab", "Eb"] },
];

function difficultyTone(d: number) {
  return d <= 2 ? "success" : d <= 3 ? "warn" : "danger";
}

export function Transposer({ initialProgression, initialKey }: { initialProgression?: string[]; initialKey?: string }) {
  const tl = useT();
  const tx = useTx();
  const [key, setKey] = useState(initialKey && [...MAJOR_KEYS, ...MINOR_KEYS].includes(initialKey) ? initialKey : "F");
  const [chords, setChords] = useState<string[]>(initialProgression?.length ? initialProgression : ["F", "Bb", "C"]);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"capo" | "key">("capo");
  const [capoChoice, setCapoChoice] = useState<"auto" | number>("auto");
  const [targetKey, setTargetKey] = useState("G");
  const recent = useData(() => transpositionRepo.list(), ["transpositions"], []);

  const arrangements = useMemo(() => (chords.length ? capoArrangements(chords, key) : []), [chords, key]);
  const best = arrangements.find((a) => a.verified) ?? arrangements[0];
  const selected: CapoArrangement | undefined = capoChoice === "auto" ? best : arrangements.find((a) => a.capo === capoChoice);
  const keyOptions = useMemo(() => (chords.length ? keyChangeOptions(chords, key).slice(0, 4) : []), [chords, key]);
  const isMinor = key.endsWith("m");
  const targetKeys = isMinor ? MINOR_KEYS : MAJOR_KEYS;
  const effectiveTarget = targetKeys.includes(targetKey) ? targetKey : targetKeys[0];
  const keyShift = semitonesBetweenKeys(key, effectiveTarget);
  const keyChanged = transposeProgression(chords, keyShift, effectiveTarget);

  const addChords = () => {
    const { chords: parsed, invalid } = parseProgressionInput(draft);
    if (invalid.length) toast.error(tl("ui.couldnt_read_chords", { list: invalid.join(", ") }));
    if (parsed.length) {
      setChords((c) => [...c, ...parsed].slice(0, 12));
      setDraft("");
    }
  };

  const save = async () => {
    if (!selected) return;
    await transpositionRepo.add({ progression: chords, originalKey: key, capo: selected.capo, shapes: selected.shapes, label: `${chords.join("–")} · capo ${selected.capo}` });
    toast.success(tl("ui.saved_to_your_recent_transpositions"));
  };

  const playProg = (list: string[], capo = 0) => {
    list.forEach((c, i) => {
      const s = easiestShape(c);
      if (s) void strum(shapeMidi(s, capo), "down", 0.028, i * 1.1);
    });
  };

  return (
    <Card>
      <CardHeader icon={<Shuffle className="h-5 w-5" />} title={tl("ui.easy_chord_transposer")} description={tl("ui.turn_hard_chords_into_easy_shapes_with_a_capo_wi")} />
      <CardBody className="space-y-5">
        {/* Input */}
        <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
          <label className="space-y-1 text-sm">
            <span className="block font-medium">{tl("ui.original_key")}</span>
            <Select aria-label={tl("ui.original_key")} value={key} onChange={(e) => setKey(e.target.value)}>
              <optgroup label={tl("ui.major")}>{MAJOR_KEYS.map((k) => <option key={k} value={k}>{tl("ui.key_major", { k })}</option>)}</optgroup>
              <optgroup label={tl("ui.minor")}>{MINOR_KEYS.map((k) => <option key={k} value={k}>{tl("ui.key_minor", { k: k.slice(0, -1) })}</option>)}</optgroup>
            </Select>
          </label>
          <div className="space-y-1 text-sm">
            <span className="block font-medium" id="prog-label">{tl("ui.chord_progression")}</span>
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface p-2" aria-labelledby="prog-label">
              {chords.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-surface-2 py-1 pl-2.5 pr-1 font-semibold">
                  {c}
                  <button type="button" aria-label={`Remove ${c}`} className="-my-1 -mr-1.5 rounded p-1.5 text-muted hover:bg-surface-3 hover:text-text" onClick={() => setChords((cs) => cs.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5" /></button>
                </span>
              ))}
              <Input
                aria-label={tl("songs.addChords")}
                placeholder={chords.length ? tl("ui.add_chord") : tl("ui.type_chords_e_g_f_bb_c")}
                className="h-8 w-40 flex-1 border-none px-1"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addChords(); }
                  if (e.key === "Backspace" && !draft) setChords((cs) => cs.slice(0, -1));
                }}
                onBlur={() => draft && addChords()}
              />
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESETS.map((p) => (
                <button key={p.label} type="button" onClick={() => { setKey(p.key); setChords(p.chords); setCapoChoice("auto"); }} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted hover:bg-surface-2 hover:text-text">
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {chords.length === 0 ? (
          <Callout tone="neutral" title={tl("ui.add_a_few_chords_to_begin")}>{tl("ui.pick_a_preset_above_or_type_the_chords_of_a_song")}</Callout>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Segmented<"capo" | "key">
                label={tl("ui.transpose_using")}
                value={mode}
                onChange={setMode}
                options={[{ value: "capo", label: tl("ui.capo_same_sound") }, { value: "key", label: tl("ui.change_key_new_sound") }]}
              />
              {mode === "capo" ? (
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted">{tl("sheet.capo")}</span>
                  <Select aria-label={tl("ui.capo_position_2")} className="h-9" value={String(capoChoice)} onChange={(e) => setCapoChoice(e.target.value === "auto" ? "auto" : Number(e.target.value))}>
                    <option value="auto">{tl("ui.easiest_recommended")}</option>
                    {arrangements.slice().sort((a, b) => a.capo - b.capo).map((a) => <option key={a.capo} value={a.capo}>{a.capo === 0 ? tl("ui.no_capo") : tl("ui.fret_n", { n: a.capo })}</option>)}
                  </Select>
                </label>
              ) : (
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted">{tl("ui.target_key")}</span>
                  <Select aria-label={tl("ui.target_key")} className="h-9" value={effectiveTarget} onChange={(e) => setTargetKey(e.target.value)}>
                    {targetKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                  </Select>
                </label>
              )}
            </div>

            {/* Side by side */}
            <div className="grid gap-4 xl:grid-cols-2">
              <section aria-label={tl("ui.original_progression")} className="space-y-3 rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{tl("ui.original_label")} <span className="font-normal text-muted">{tl("ui.key_of", { k: key })}</span></h4>
                  <Button size="sm" variant="ghost" onClick={() => playProg(chords)}><Play className="h-4 w-4" /> {tl("ui.hear")}</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {chords.map((c, i) => {
                    const s = easiestShape(c);
                    return <ChordDiagram key={i} chord={c} size="sm" subtitle={s ? tl("ui.difficulty_n5", { n: s.difficulty }) : undefined} />;
                  })}
                </div>
              </section>

              {mode === "capo" && selected && (
                <section aria-label={tl("ui.capo_arrangement")} className="space-y-3 rounded-2xl border-2 border-accent/50 bg-accent-soft/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold">{selected.capo === 0 ? tl("ui.no_capo") : tl("ui.capo_on_fret", { n: selected.capo })} <span className="font-normal text-muted">{tl("ui.play_key_shapes", { k: selected.shapeKey ?? "" })}</span></h4>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => playProg(selected.shapes, selected.capo)}><Play className="h-4 w-4" /> {tl("ui.hear")}</Button>
                      <Button size="sm" variant="secondary" onClick={save}><Bookmark className="h-4 w-4" /> {tl("common.save")}</Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.shapes.map((shape, i) => (
                      <ChordDiagram key={i} chord={shape} capo={selected.capo} size="sm" title={shape} subtitle={tl("ui.sounds_chord", { chord: chords[i] })} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {selected.verified ? (
                      <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> {tl("ui.verified_shapes_capo_give_the_original_chords")}</Badge>
                    ) : (
                      <Badge tone="danger"><TriangleAlert className="h-3 w-3" /> {tl("ui.some_shapes_aren_t_in_our_library")}</Badge>
                    )}
                    <Badge tone={difficultyTone(selected.maxDifficulty)}>{tl("ui.hardest_shape", { n: selected.maxDifficulty })}</Badge>
                    {selected.allOpen && <Badge tone="success">{tl("ui.all_open_chords")}</Badge>}
                    {selected.requiresBarre && <Badge tone="warn">{tl("ui.needs_a_barre_chord")}</Badge>}
                  </div>
                  {selected.notes.length > 0 && <ul className="list-disc pl-5 text-xs text-muted">{selected.notes.map((n) => <li key={n}>{tx(n)}</li>)}</ul>}
                  <p className="text-xs text-muted">{tl("ui.still_sounds_in", { k: key })}</p>
                </section>
              )}

              {mode === "key" && (
                <section aria-label={tl("ui.key_change")} className="space-y-3 rounded-2xl border-2 border-warn/50 bg-warn-soft/40 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{tl("ui.new_key", { k: effectiveTarget })} <span className="font-normal text-muted">{tl("ui.n_semitones", { n: keyShift > 6 ? keyShift - 12 : keyShift })}</span></h4>
                    <Button size="sm" variant="ghost" onClick={() => playProg(keyChanged)}><Play className="h-4 w-4" /> {tl("ui.hear")}</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {keyChanged.map((c, i) => <ChordDiagram key={i} chord={c} size="sm" subtitle={tl("ui.was_chord", { chord: chords[i] })} />)}
                  </div>
                  <Callout tone="warn" icon={<TriangleAlert className="h-4 w-4" />} title={tl("ui.this_changes_the_song_s_key")}>{tl("ui.it_will_sound_higher_or_lower_than_the_original")}</Callout>
                </section>
              )}
            </div>

            {/* Compare all capo positions */}
            {mode === "capo" && (
              <details className="rounded-2xl border border-border p-4" open>
                <summary className="cursor-pointer font-semibold">{tl("ui.compare_every_capo_position")}</summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted">
                      <tr><th className="py-1.5">{tl("sheet.capo")}</th><th>{tl("ui.shapes_you_play")}</th><th>{tl("ui.sounds_as")}</th><th>{tl("ui.difficulty")}</th><th /></tr>
                    </thead>
                    <tbody>
                      {arrangements.slice().sort((a, b) => a.capo - b.capo).map((a) => (
                        <tr key={a.capo} className={cn("border-t border-border", selected?.capo === a.capo && "bg-accent-soft/50")}>
                          <td className="py-1.5 font-medium">{a.capo === 0 ? tl("ui.none") : a.capo}</td>
                          <td className="font-semibold">{a.shapes.join(" – ")}</td>
                          <td className="text-muted">{a.sounding.join(" – ")}</td>
                          <td>
                            <Badge tone={difficultyTone(a.maxDifficulty)}>{a.maxDifficulty}/5</Badge>
                            {a.requiresBarre && <span className="ml-1 text-xs text-warn">{tl("ui.barre")}</span>}
                            {a.capo === best?.capo && <span className="ml-1 text-xs font-semibold text-success">{tl("ui.best")}</span>}
                          </td>
                          <td className="text-right"><Button size="sm" variant="ghost" onClick={() => setCapoChoice(a.capo)} aria-label={tl("ui.use_capo_n", { n: a.capo })}><ArrowRight className="h-4 w-4" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            {mode === "capo" && keyOptions.length > 0 && (
              <div className="rounded-2xl border border-dashed border-border-strong p-4 text-sm">
                <p className="font-medium">{tl("ui.easy_keys_title")} <span className="font-normal text-muted">{tl("ui.changes_songs_key")}</span></p>
                <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                  {keyOptions.map((o) => (
                    <li key={o.targetKey}>
                      <button type="button" className="text-left hover:text-accent" onClick={() => { setMode("key"); setTargetKey(o.targetKey); }}>
                        <span className="font-semibold">{o.targetKey}</span>: {o.chords.join(" – ")} <span className="text-muted">({o.semitones > 0 ? "+" : ""}{o.semitones})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Callout tone="info" icon={<Info className="h-4 w-4" />} title={tl("ui.shape_vs_sounding_chord")}>
              {tl("ui.shape_vs_sounding_body")}
            </Callout>
          </>
        )}

        {recent.data.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{tl("ui.recent_transpositions")}</p>
            <ul className="flex flex-wrap gap-2">
              {recent.data.slice(0, 8).map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => { setKey(t.originalKey); setChords(t.progression); setMode("capo"); setCapoChoice(t.capo); }} className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface-2">
                    {t.label ?? t.progression.join("–")} <span className="text-muted">({t.originalKey})</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
