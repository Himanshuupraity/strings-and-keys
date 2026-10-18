import type { AudioExample, Lesson } from "@/content/types";
import { chordMidi, easiestShape, shapeMidi } from "@/lib/music/chords";
import { mod12, nameToMidi } from "@/lib/music/notes";
import { ensureAudio, getAudioContext, playPianoChord, playSequence, scheduleClick, strum } from "@/lib/audio/engine";
import type { InputMethod } from "@/lib/storage/schemas";

export type Inst = "piano" | "guitar";

export const toMidi = (n: number | string) => (typeof n === "number" ? n : nameToMidi(n));

/** Which instrument a step should use: explicit, else the lesson's track, else the student's mode. */
export function resolveInstrument(requested: "piano" | "guitar" | "either" | undefined, lesson: Pick<Lesson, "track">, mode: Inst): Inst {
  if (requested === "piano" || requested === "guitar") return requested;
  if (lesson.track === "piano" || lesson.track === "guitar") return lesson.track;
  return mode;
}

/** A keyboard range (C to B/C) that comfortably contains the notes, at least two octaves. */
export function keyboardRange(notes: number[], minSpan = 24): { low: number; high: number } {
  if (!notes.length) return { low: 60, high: 83 };
  const min = Math.min(...notes);
  const max = Math.max(...notes);
  const low = Math.max(21, min - mod12(min));
  let high = Math.max(max, low + minSpan - 1);
  high += (11 - mod12(high) + 12) % 12; // finish on a B
  return { low, high: Math.min(high + 1, 108) }; // …plus the next C
}

export interface ExerciseOutcome {
  accuracy: number;
  correct: number;
  total: number;
  input: InputMethod;
  measured: boolean;
  details?: string;
}

/** Plays an AudioExample. Resolves with its approximate duration (seconds). */
export async function playExample(a: AudioExample, fallback: Inst, which: "a" | "b" | "both" = "both"): Promise<number> {
  const inst = ("instrument" in a && a.instrument) || fallback;
  switch (a.type) {
    case "notes":
      return playSequence(inst, a.notes, a.step ?? 0.5);
    case "chord":
      if (inst === "guitar") {
        const s = easiestShape(a.chord);
        if (s) await strum(shapeMidi(s));
        return 1.5;
      }
      await playPianoChord(chordMidi(a.chord, 4), 1.4);
      return 1.4;
    case "chords": {
      const spb = 60 / (a.bpm ?? 80);
      const each = (a.beatsEach ?? 2) * spb;
      await ensureAudio();
      a.chords.forEach((c, i) => {
        if (inst === "guitar") {
          const s = easiestShape(c);
          if (s) void strum(shapeMidi(s), "down", 0.025, i * each);
        } else void playPianoChord(chordMidi(c, 3), each * 0.95, i * each);
      });
      return a.chords.length * each;
    }
    case "rhythm": {
      await ensureAudio();
      const ctx = getAudioContext();
      if (!ctx) return 0;
      const spb = 60 / a.bpm;
      const per = a.beatsPerBar ?? 4;
      const t0 = ctx.currentTime + 0.1;
      a.pattern.forEach((p) => scheduleClick(ctx, t0 + p * spb, Math.abs(p % per) < 1e-6));
      return (Math.max(...a.pattern) + 1) * spb;
    }
    case "compare": {
      const step = 0.55;
      if (which === "a") return playSequence(inst, a.a, step);
      if (which === "b") return playSequence(inst, a.b, step);
      const da = await playSequence(inst, a.a, step);
      await new Promise((r) => setTimeout(r, (da + 0.6) * 1000));
      const db = await playSequence(inst, a.b, step);
      return da + 0.6 + db;
    }
  }
}
