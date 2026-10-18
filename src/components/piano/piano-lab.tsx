"use client";

import { useT } from "@/lib/i18n";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, Crosshair, Hand, Info, KeyboardMusic, Music2, Piano, SlidersHorizontal, ZoomIn } from "lucide-react";
import { Badge, Button, Callout, Card, CardBody, CardHeader, PageHeader, Segmented, Select, Slider, Switch, cn } from "@/components/ui";
import { MetronomeWidget } from "@/components/practice/metronome-widget";
import type { KeyTone } from "@/components/instruments/piano-keyboard";
import { usePrefs } from "@/hooks/use-prefs";
import { useMidi } from "@/hooks/use-midi";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { pianoAttack, pianoRelease } from "@/lib/audio/engine";
import { KEYBOARD_PRESETS, SELECTABLE_SIZES, keysInRange, type KeyboardSize } from "@/lib/music/keyboard";
import { midiToName, mod12, pcDualName } from "@/lib/music/notes";
import { identifyChord } from "@/lib/music/chords";
import { ALANKARS, labelNote } from "@/lib/music/sargam";
import type { LabelMode } from "@/lib/music/sargam";
import { EXERCISE_GROUPS, PIANO_EXERCISES, focusWindow, resolveExercise, type Hand as HandT, type PianoExerciseDef } from "./exercises";
import { LabKeyboard, PianoLabContext, type KeyLabels, type MidiListener, type PianoLabContextValue } from "./lab-context";
import { ChordRunner, EarRunner, FindAllRunner, SequenceRunner } from "./runners";
import { MidiPanel } from "./midi-panel";

const narrowQuery = "(max-width: 639px)";
function useNarrow() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(narrowQuery);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(narrowQuery).matches,
    () => false,
  );
}

export function PianoLab() {
  const t = useT();
  const [prefs, setPrefs] = usePrefs();
  const narrow = useNarrow();
  const preset = KEYBOARD_PRESETS[prefs.keyboardSize];
  const [viewChoice, setViewChoice] = useState<"full" | "focus" | null>(null);
  const view = viewChoice ?? (narrow ? "focus" : "full");
  const [focusStart, setFocusStart] = useState(48);
  const [zoom, setZoom] = useState<number | null>(null);
  const whiteKeyWidth = zoom ?? (narrow ? 38 : prefs.keyboardSize === 88 ? 30 : 40);
  const [keyLabels, setKeyLabels] = useState<KeyLabels>("white");
  const [mode, setMode] = useState<"free" | "exercises">("free");
  const [nonce, setNonce] = useState(0);
  const [focusMidi, setFocusMidi] = useState(60);
  const [flashMiddleC, setFlashMiddleC] = useState(false);
  const flashTimer = useRef<number | undefined>(undefined);
  const [virtualHeld, setVirtualHeld] = useState<Set<number>>(new Set());
  const listeners = useRef(new Set<MidiListener>());
  const { ping } = usePracticeLog("Piano Lab", { instrument: "piano" });

  const range = view === "full" ? { low: preset.low, high: preset.high } : focusWindow(focusStart, preset.low, preset.high);

  const midi = useMidi((e) => {
    if (e.type === "on") {
      void pianoAttack(e.midi, Math.max(0.15, e.velocity));
      ping();
    } else pianoRelease(e.midi);
    listeners.current.forEach((l) => l({ type: e.type, midi: e.midi }));
  });

  const subscribeMidi = useCallback((fn: MidiListener) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const onVirtualHeld = useCallback((m: number, down: boolean) => {
    setVirtualHeld((h) => {
      const n = new Set(h);
      if (down) n.add(m);
      else n.delete(m);
      return n;
    });
  }, []);

  const ensureVisible = (m: number) => {
    if (view === "focus" && (m < range.low || m > range.high)) setFocusStart(Math.max(preset.low, m - mod12(m) - 12));
  };

  const findMiddleC = () => {
    ensureVisible(60);
    setFocusMidi(60);
    setNonce((n) => n + 1);
    setFlashMiddleC(true);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashMiddleC(false), 3000);
  };

  const ctx: PianoLabContextValue = {
    low: range.low,
    high: range.high,
    whiteKeyWidth,
    labels: keyLabels,
    remountKey: `${range.low}-${range.high}-${nonce}`,
    focusMidi,
    midiHeld: midi.held,
    subscribeMidi,
    onVirtualHeld,
    ping,
    flashHighlight: flashMiddleC ? ({ 60: "root" } as Partial<Record<number, KeyTone>>) : {},
  };

  const keyCount = range.high - range.low + 1;
  const presetLabel = `${midiToName(preset.low)}–${midiToName(preset.high)}`;

  return (
    <PianoLabContext.Provider value={ctx}>
      <PageHeader
        eyebrow={t("nav./piano-lab")}
        title={t("pianoLab.title")}
        description="Play with your mouse, fingers, computer keyboard or a MIDI keyboard. Every key makes real sound and shows its name."
        actions={
          <>
            <Button variant="secondary" onClick={findMiddleC} data-testid="find-middle-c">
              <Crosshair className="h-4 w-4" /> Find middle C
            </Button>
            <Segmented
              label="Lab mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: "free", label: "Free play", icon: <Piano className="h-4 w-4" />, testId: "piano-mode-free" },
                { value: "exercises", label: "Guided exercises", icon: <Music2 className="h-4 w-4" />, testId: "piano-mode-exercises" },
              ]}
            />
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* On phones the keyboard comes first; the keyboard settings card moves below it. */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* Range / view toolbar */}
          <Card className="order-2 sm:order-none">
            <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Keyboard size</span>
                <Segmented<KeyboardSize>
                  label="Keyboard size"
                  size="sm"
                  value={prefs.keyboardSize}
                  onChange={(keyboardSize) => {
                    setPrefs({ keyboardSize: keyboardSize as 49 | 61 | 88 });
                    setFocusMidi(60);
                  }}
                  options={SELECTABLE_SIZES.map((s) => ({ value: s, label: String(s), testId: `size-${s}` }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">View</span>
                <Segmented
                  label="Keyboard view"
                  size="sm"
                  value={view}
                  onChange={(v) => setViewChoice(v)}
                  options={[
                    { value: "full", label: "Full range" },
                    { value: "focus", label: "2-octave focus" },
                  ]}
                />
              </div>
              {view === "focus" && (
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-10 w-10 sm:h-8 sm:w-8" aria-label="Move view down an octave" disabled={range.low <= preset.low} onClick={() => setFocusStart(Math.max(preset.low, range.low - 12))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm tabular-nums text-muted">
                    {midiToName(range.low)}–{midiToName(range.high)}
                  </span>
                  <Button size="icon" variant="ghost" className="h-10 w-10 sm:h-8 sm:w-8" aria-label="Move view up an octave" disabled={range.high >= preset.high} onClick={() => setFocusStart(range.low + 12)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex min-w-48 flex-1 items-center gap-2">
                <ZoomIn className="h-4 w-4 text-muted" aria-hidden />
                <Slider className="flex-1" label="Key width" value={whiteKeyWidth} min={22} max={64} step={2} onChange={setZoom} format={(v) => `${v}px`} />
              </div>
              <p className="w-full text-xs text-muted" data-testid="key-count">
                Showing <strong className="text-text">{keyCount} keys</strong> ({midiToName(range.low)}–{midiToName(range.high)}) of the {prefs.keyboardSize}-key layout ({presetLabel}). Scroll sideways to see more.
              </p>
            </CardBody>
          </Card>

          {mode === "free" ? <FreePlay virtualHeld={virtualHeld} midiHeld={midi.held} /> : <ExercisePanel range={range} ensureVisible={ensureVisible} />}

          <MetronomeWidget initialBpm={72} />
        </div>

        <aside className="space-y-6">
          <DisplaySettings keyLabels={keyLabels} setKeyLabels={setKeyLabels} />
          <MidiPanel supported={midi.supported} status={midi.status} devices={midi.devices} error={midi.error} held={midi.held} onConnect={midi.connect} onDisconnect={midi.disconnect} />
          <Card>
            <CardHeader icon={<Info className="h-5 w-5" />} title="About keyboard sizes" />
            <CardBody className="space-y-2 text-sm text-muted">
              <p>
                <strong className="text-text">49 keys</strong> (4 octaves, C2–C6) is a compact keyboard, <strong className="text-text">61 keys</strong> (5 octaves, C2–C7) is the most common home keyboard, and <strong className="text-text">88 keys</strong> (A0–C8) is a full piano.
              </p>
              <p>Pick the size that matches your real instrument so lessons line up with what you see at home. Beginner lessons only use the middle few octaves, so any size works.</p>
              <p>
                This app calls middle C <strong className="text-text">C4</strong> (MIDI note 60). Some brands, like Yamaha, label the same key <strong className="text-text">C3</strong> — it&apos;s the same physical key, just a different naming habit.
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </PianoLabContext.Provider>
  );
}

/* ---------------- Free play ---------------- */

function FreePlay({ virtualHeld, midiHeld }: { virtualHeld: Set<number>; midiHeld: Set<number> }) {
  const [prefs] = usePrefs();
  const held = [...new Set([...virtualHeld, ...midiHeld])].sort((a, b) => a - b);
  const pcs = [...new Set(held.map(mod12))];
  const best = pcs.length >= 2 ? identifyChord(pcs, prefs.spelling)[0] : undefined;
  const chord = best && best.missing.length === 0 && best.extra.length === 0 ? best.symbol : null;

  return (
    <div className="space-y-4">
      <LabKeyboard ariaLabel="Piano keyboard — free play" />
      <Card>
        <CardBody className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-5" aria-live="polite">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-subtle">Now playing</p>
            <p className="mt-1 min-h-8 text-2xl font-semibold" data-testid="now-playing">
              {held.length
                ? held
                    .map((m) => {
                      const l = labelNote(m, { mode: prefs.labelMode, tonicPc: prefs.tonicPc, spelling: prefs.spelling, withOctave: true });
                      return prefs.labelMode === "western" ? midiToName(m, prefs.spelling) : prefs.labelMode === "sargam" ? `${l.swara.full} (${l.saptak})` : `${midiToName(m, prefs.spelling)} · ${l.swara.full}`;
                    })
                    .join("  ")
                : <span className="text-muted">—</span>}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-subtle">Chord</p>
            <p className="mt-1 min-h-8 text-2xl font-semibold">{chord ?? <span className="text-muted">{held.length >= 2 ? "not a basic chord" : "—"}</span>}</p>
          </div>
          <p className="basis-full text-xs text-muted">Hold several keys at once (computer keys or MIDI) to see chord names. Try A + D + G on your computer keyboard.</p>
        </CardBody>
      </Card>
    </div>
  );
}

/* ---------------- Display settings ---------------- */

function DisplaySettings({ keyLabels, setKeyLabels }: { keyLabels: KeyLabels; setKeyLabels: (l: KeyLabels) => void }) {
  const [prefs, setPrefs] = usePrefs();
  return (
    <Card>
      <CardHeader icon={<SlidersHorizontal className="h-5 w-5" />} title="Labels" description="Western names, Indian sargam, or both." />
      <CardBody className="space-y-4">
        <Segmented<LabelMode>
          label="Note label system"
          size="sm"
          className="w-full"
          value={prefs.labelMode}
          onChange={(labelMode) => setPrefs({ labelMode })}
          options={[
            { value: "western", label: "Western", testId: "labels-western" },
            { value: "sargam", label: "Sargam", testId: "labels-sargam" },
            { value: "both", label: "Both", testId: "labels-both" },
          ]}
        />
        {prefs.labelMode !== "western" && (
          <div className="space-y-1.5">
            <label htmlFor="sa-select" className="text-sm font-medium">
              Sa (tonic) is
            </label>
            <Select id="sa-select" className="w-full" value={prefs.tonicPc} onChange={(e) => setPrefs({ tonicPc: Number(e.target.value) })}>
              {Array.from({ length: 12 }, (_, pc) => (
                <option key={pc} value={pc}>
                  {pcDualName(pc)}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted">Sa moves with the key you sing or play in — it isn&apos;t always C. Labels assume equal temperament; real Hindustani intonation can differ slightly.</p>
          </div>
        )}
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Key labels</span>
          <Segmented<KeyLabels>
            label="Which keys show labels"
            size="sm"
            className="w-full"
            value={keyLabels}
            onChange={setKeyLabels}
            options={[
              { value: "white", label: "Show" },
              { value: "c-only", label: "C only" },
              { value: "none", label: "Off" },
            ]}
          />
        </div>
        <Switch checked={prefs.showBlackKeyLabels} onChange={(showBlackKeyLabels) => setPrefs({ showBlackKeyLabels })} label="Label black keys" />
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Black keys as</span>
          <Segmented
            label="Sharp or flat names"
            size="sm"
            value={prefs.spelling}
            onChange={(spelling) => setPrefs({ spelling })}
            options={[
              { value: "sharp", label: "C♯" },
              { value: "flat", label: "D♭" },
            ]}
          />
        </div>
      </CardBody>
    </Card>
  );
}

/* ---------------- Exercises ---------------- */

function ExercisePanel({ range, ensureVisible }: { range: { low: number; high: number }; ensureVisible: (m: number) => void }) {
  const [prefs, setPrefs] = usePrefs();
  const [selectedId, setSelectedId] = useState(PIANO_EXERCISES[0].id);
  const [hand, setHand] = useState<HandT>("right");
  const [alankarId, setAlankarId] = useState(ALANKARS[0].id);
  const def = PIANO_EXERCISES.find((e) => e.id === selectedId)!;
  const hands = def.kind === "sequence" ? (Object.keys(def.variants) as HandT[]) : [];
  const activeHand: HandT = hands.includes(hand) ? hand : "right";

  const res = useMemo(() => resolveExercise(def, { low: range.low, high: range.high, hand: activeHand, tonicPc: prefs.tonicPc, alankarId }), [def, range.low, range.high, activeHand, prefs.tonicPc, alankarId]);
  const runKey = `${def.id}-${activeHand}-${alankarId}-${res.targets.join(".")}-${res.pool?.join(".")}`;

  const select = (d: PianoExerciseDef) => {
    setSelectedId(d.id);
    if (d.kind === "sequence" && d.exact) ensureVisible(d.variants.right!.notes[0]);
  };

  const outOfRange = def.kind === "sequence" && def.exact && res.targets.some((m) => m < range.low || m > range.high);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader icon={<KeyboardMusic className="h-5 w-5" />} title="Choose an exercise" description="Results are measured from your key presses (on-screen or MIDI) and saved to your progress." />
        <CardBody className="space-y-4">
          {EXERCISE_GROUPS.map((g) => {
            const items = PIANO_EXERCISES.filter((e) => e.group === g);
            return (
              <div key={g}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-subtle">{g}</p>
                <div className="flex flex-wrap gap-2">
                  {items.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => select(e)}
                      aria-pressed={e.id === selectedId}
                      data-testid={`exercise-${e.id}`}
                      className={cn(
                        "rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors",
                        e.id === selectedId ? "border-piano bg-piano-soft text-piano" : "border-border bg-surface hover:bg-surface-2",
                      )}
                    >
                      {e.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={def.title}
          description={def.description}
          action={res.shift !== 0 ? <Badge tone="neutral">Moved {res.shift > 0 ? "up" : "down"} {Math.abs(res.shift) / 12} octave{Math.abs(res.shift) > 12 ? "s" : ""} to fit</Badge> : undefined}
        />
        <CardBody className="space-y-4">
          {(hands.length > 1 || def.kind === "sargam") && (
            <div className="flex flex-wrap items-center gap-4">
              {hands.length > 1 && (
                <Segmented<HandT>
                  label="Which hand"
                  size="sm"
                  value={activeHand}
                  onChange={setHand}
                  options={[
                    { value: "right", label: "Right hand", icon: <Hand className="h-3.5 w-3.5 -scale-x-100" /> },
                    { value: "left", label: "Left hand", icon: <Hand className="h-3.5 w-3.5" /> },
                  ]}
                />
              )}
              {def.kind === "sargam" && (
                <>
                  <Select aria-label="Alankar pattern" value={alankarId} onChange={(e) => setAlankarId(e.target.value)}>
                    {ALANKARS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                  <Select aria-label="Sa (tonic)" value={prefs.tonicPc} onChange={(e) => setPrefs({ tonicPc: Number(e.target.value) })}>
                    {Array.from({ length: 12 }, (_, pc) => (
                      <option key={pc} value={pc}>
                        Sa = {pcDualName(pc)}
                      </option>
                    ))}
                  </Select>
                </>
              )}
            </div>
          )}
          {def.kind === "sargam" && (
            <p className="text-sm text-muted">
              {ALANKARS.find((a) => a.id === alankarId)?.description}. All swaras here are shuddha (natural) — the same pattern as a Western major scale starting on Sa.
            </p>
          )}
          {outOfRange ? (
            <Callout tone="warn">Middle C isn&apos;t in the current view. Use “Find middle C” or switch to the full range.</Callout>
          ) : def.kind === "find-all" ? (
            <FindAllRunner key={runKey} def={def} low={range.low} high={range.high} />
          ) : def.kind === "chords" ? (
            <ChordRunner key={runKey} def={def} res={res} />
          ) : def.kind === "ear" ? (
            <EarRunner key={runKey} def={def} res={res} />
          ) : (
            <SequenceRunner
              key={runKey}
              def={def}
              res={res}
              suffix={def.kind === "sequence" && hands.length > 1 ? `-${activeHand}` : def.kind === "sargam" ? `-${alankarId}` : ""}
              hideLabels={def.kind === "sequence" && def.hideLabels}
              showStaff={def.kind === "sequence" && def.staff}
              chipMode={def.kind === "sargam" ? "both" : undefined}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/** Exported for tests / other screens that need to know the visible key count. */
export function visibleKeyCount(low: number, high: number) {
  return keysInRange(low, high).length;
}
