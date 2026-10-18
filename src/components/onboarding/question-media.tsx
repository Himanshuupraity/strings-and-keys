"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";
import type { AudioExample, Visual } from "@/content/types";
import { ensureAudio, getAudioContext, playPianoChord, playSequence, scheduleClick, strum } from "@/lib/audio/engine";
import { chordMidi, easiestShape, shapeMidi } from "@/lib/music/chords";
import { nameToMidi } from "@/lib/music/notes";
import { Button } from "@/components/ui";
import { PianoKeyboard } from "@/components/instruments/piano-keyboard";
import { Staff } from "@/components/instruments/staff";
import { ChordDiagram } from "@/components/instruments/chord-diagram";

const toMidi = (n: number | string) => (typeof n === "number" ? n : nameToMidi(n));
const wait = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

/** Plays any AudioExample. Resolves when playback is (approximately) finished. */
export async function playAudioExample(a: AudioExample, fallback: "piano" | "guitar" = "piano") {
  await ensureAudio();
  switch (a.type) {
    case "notes": {
      const d = await playSequence(a.instrument ?? fallback, a.notes, a.step ?? 0.5);
      return wait(d);
    }
    case "chord": {
      const inst = a.instrument ?? fallback;
      if (inst === "guitar") await strum(shapeMidi(easiestShape(a.chord) ?? { frets: [] }));
      else await playPianoChord(chordMidi(a.chord, 4), 1.5);
      return wait(1.5);
    }
    case "chords": {
      const sec = ((a.beatsEach ?? 4) * 60) / (a.bpm ?? 80);
      for (const c of a.chords) {
        if ((a.instrument ?? fallback) === "guitar" && easiestShape(c)) await strum(shapeMidi(easiestShape(c)!));
        else await playPianoChord(chordMidi(c, 3), sec * 0.95);
        await wait(sec);
      }
      return;
    }
    case "rhythm": {
      const ctx = getAudioContext();
      if (!ctx) return;
      const beat = 60 / a.bpm;
      const t0 = ctx.currentTime + 0.1;
      a.pattern.forEach((p) => scheduleClick(ctx, t0 + p * beat, Number.isInteger(p) && p % (a.beatsPerBar ?? 4) === 0));
      return wait((Math.max(...a.pattern) + 1) * beat);
    }
    case "compare": {
      await wait(await playSequence(fallback, a.a, 0.6));
      await wait(0.5);
      await wait(await playSequence(fallback, a.b, 0.6));
    }
  }
}

export function AudioButton({ audio, label = "Play sound", fallback }: { audio: AudioExample; label?: string; fallback?: "piano" | "guitar" }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await playAudioExample(audio, fallback);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Volume2 className="h-4 w-4" /> {label}
    </Button>
  );
}

/** Minimal visual renderer for diagnostic questions (labels hidden so answers aren't given away). */
export function QuestionVisual({ visual }: { visual: Visual }) {
  if (visual.type === "keyboard") {
    const hl = Object.fromEntries((visual.highlight ?? []).map((n) => [toMidi(n), "target" as const]));
    return <PianoKeyboard low={visual.low ?? 48} high={visual.high ?? 72} highlight={hl} labels={visual.showLabels === false ? "none" : "white"} whiteKeyWidth={34} height={130} />;
  }
  if (visual.type === "staff") return <Staff clef={visual.clef} notes={visual.notes} className="max-w-xs" />;
  if (visual.type === "chord-diagram") return <div className="flex gap-2">{visual.chords.map((c) => <ChordDiagram key={c} chord={c} title="?" playable={false} />)}</div>;
  return null;
}
