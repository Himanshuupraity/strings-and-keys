"use client";

import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { ChordDiagram } from "@/components/instruments/chord-diagram";
import { MicButton } from "@/components/instruments/mic-button";
import { Badge, Button, Callout, ProgressBar, Select, SourceTag } from "@/components/ui";
import { useMic } from "@/hooks/use-mic";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { compareChordTones, easiestShape } from "@/lib/music/chords";
import { saveGuitarResult } from "./shared";

const OPEN = ["Em", "Am", "E", "A", "D", "G", "C", "Dm", "E7", "A7", "D7", "G7"];
const CHECKLIST = [
  "Every string I should play rings clearly (pluck them one by one)",
  "No buzzing — fingertips are just behind the fret wire",
  "Muted (×) strings are not sounding",
  "Fingers are arched so they don't touch neighbouring strings",
  "My thumb is relaxed behind the neck and nothing hurts",
];

export function ChordCheck() {
  const [chord, setChord] = useState("Em");
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [saved, setSaved] = useState<string | null>(null);
  const mic = useMic({ mode: "chroma" });
  const { ping } = usePracticeLog("Guitar exercise: open chords", { instrument: "guitar" });
  const shape = easiestShape(chord);
  const c = mic.chroma;
  const reliable = !!c && c.confidence >= 0.35 && c.activePcs.length > 0;
  const cmp = reliable ? compareChordTones(chord, c!.activePcs) : null;

  const saveSelf = async () => {
    const n = checked.filter(Boolean).length;
    await saveGuitarResult({ exerciseId: `guitar-chord-${chord}`, skill: "open-chords", input: "self", correct: n, total: CHECKLIST.length, measured: false, details: `self-check ${chord}` });
    setSaved(`Saved your self-check for ${chord} (${n}/${CHECKLIST.length}).`);
    ping();
  };
  const saveAudio = async () => {
    if (!cmp) return;
    await saveGuitarResult({ exerciseId: `guitar-chord-audio-${chord}`, skill: "open-chords", input: "mic", correct: cmp.found.length, total: cmp.expected.length, measured: true, details: `audio estimate, confidence ${Math.round(c!.confidence * 100)}%` });
    setSaved(`Saved the audio estimate for ${chord}: ${cmp.found.length}/${cmp.expected.length} chord tones heard.`);
    ping();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="space-y-2">
          <label className="block space-y-1 text-sm">
            <span className="block font-medium">Chord</span>
            <Select aria-label="Chord to check" value={chord} onChange={(e) => { setChord(e.target.value); setChecked(CHECKLIST.map(() => false)); setSaved(null); }}>
              {OPEN.map((o) => <option key={o}>{o}</option>)}
            </Select>
          </label>
          <ChordDiagram chord={chord} size="lg" />
        </div>
        <div className="min-w-64 flex-1 space-y-3">
          <fieldset className="space-y-2 rounded-xl border border-border p-3">
            <legend className="px-1 text-sm font-medium">Self-check <SourceTag source="self-reported" /></legend>
            {CHECKLIST.map((item, i) => (
              <label key={item} className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={checked[i]} onChange={(e) => setChecked((xs) => xs.map((x, j) => (j === i ? e.target.checked : x)))} />
                {item}
              </label>
            ))}
            <Button size="sm" variant="secondary" onClick={saveSelf}><ClipboardCheck className="h-4 w-4" /> Save self-check</Button>
          </fieldset>
          {shape?.tips && <ul className="list-disc pl-5 text-sm text-muted">{shape.tips.map((t) => <li key={t}>{t}</li>)}</ul>}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border p-3">
        <p className="text-sm font-medium">Optional: let the microphone estimate which notes are sounding</p>
        <MicButton status={mic.status} error={mic.error} onStart={mic.start} onStop={mic.stop} label="Listen to my chord" />
        {mic.listening && (
          <div className="space-y-2" aria-live="polite">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-28 text-muted">Confidence</span>
              <ProgressBar value={c?.confidence ?? 0} className="max-w-xs" label="Detection confidence" tone={reliable ? "success" : "accent"} />
              <span className="tabular-nums text-muted">{Math.round((c?.confidence ?? 0) * 100)}%</span>
            </div>
            {cmp ? (
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="text-muted">Heard chord tones:</span>
                {cmp.expected.map((pc) => <Badge key={pc} tone={cmp.found.includes(pc) ? "success" : "danger"}>{cmp.name(pc)} {cmp.found.includes(pc) ? "✓" : "missing"}</Badge>)}
                {cmp.unwanted.map((pc) => <Badge key={pc} tone="warn">extra {cmp.name(pc)}</Badge>)}
                <Button size="sm" variant="ghost" onClick={saveAudio}>Save estimate</Button>
              </div>
            ) : (
              <p className="text-sm text-muted">Strum the chord firmly and let it ring. If confidence stays low, the sound isn&apos;t clear enough to judge — that&apos;s not a mark against you.</p>
            )}
          </div>
        )}
        <Callout tone="neutral">Chord detection from a microphone is a <strong>best-effort estimate</strong>. Overtones, room noise and quiet strings can fool it, and it can never tell how your fingers are placed. Trust your ears and the self-check too.</Callout>
      </div>
      {saved && <p className="text-sm text-success" role="status">{saved}</p>}
    </div>
  );
}
