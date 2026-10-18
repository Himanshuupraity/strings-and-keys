"use client";

import { usePrefs } from "@/hooks/use-prefs";
import { labelNote, type LabelMode } from "@/lib/music/sargam";
import { cn } from "@/components/ui";

/** Uses the student's Western/Sargam preference and selected Sa. */
export function useNoteLabeler(override?: { mode?: LabelMode; tonicPc?: number }) {
  const [prefs] = usePrefs();
  const mode = override?.mode ?? prefs.labelMode;
  const tonicPc = override?.tonicPc ?? prefs.tonicPc;
  return (midi: number, withOctave = false) => labelNote(midi, { mode, tonicPc, spelling: prefs.spelling, withOctave });
}

/** Renders a swara with Bhatkhande-style marks: komal underlined, tivra Ma with ′. */
export function SwaraText({ midi, tonicPc, short = false, className }: { midi: number; tonicPc: number; short?: boolean; className?: string }) {
  const l = labelNote(midi, { mode: "sargam", tonicPc });
  const s = l.swara;
  if (short) {
    return (
      <span className={cn(s.variant === "komal" && "komal", className)} title={s.full}>
        {s.compact}
      </span>
    );
  }
  return <span className={className}>{s.full}</span>;
}

/** Note text in the current label mode, e.g. "C", "Sa" or "C · Sa". */
export function NoteText({ midi, withOctave = false, short = true, className, mode: modeOverride }: { midi: number; withOctave?: boolean; short?: boolean; className?: string; mode?: LabelMode }) {
  const [prefs] = usePrefs();
  const mode = modeOverride ?? prefs.labelMode;
  const l = labelNote(midi, { mode, tonicPc: prefs.tonicPc, spelling: prefs.spelling, withOctave });
  if (mode === "western") return <span className={className}>{l.western}</span>;
  if (mode === "sargam") return <SwaraText midi={midi} tonicPc={prefs.tonicPc} short={short} className={className} />;
  return (
    <span className={className}>
      {l.western}
      <span className="opacity-60"> · </span>
      <SwaraText midi={midi} tonicPc={prefs.tonicPc} short={short} />
    </span>
  );
}
