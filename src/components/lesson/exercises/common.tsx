"use client";
import { useT } from "@/lib/i18n";

import { CheckCircle2, Lightbulb, Plug, RotateCcw, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Button, Callout, cn } from "@/components/ui";
import { MicButton } from "@/components/instruments/mic-button";
import type { useNoteInput } from "@/hooks/use-note-input";
import type { ExerciseOutcome, Inst } from "../utils";

export interface ExerciseProps<E> {
  exercise: E;
  instrument: Inst;
  onComplete: (o: ExerciseOutcome) => void;
  onActivity?: () => void;
  /** Lesson track, for leniency rules (e.g. octave-agnostic humming in theory lessons). */
  track: "theory" | "guitar" | "piano";
}

/** MIDI + microphone controls shared by exercises that accept real-instrument input. */
export function InputSources({ input, allowMic = true, micLabel }: { input: ReturnType<typeof useNoteInput>; allowMic?: boolean; micLabel?: string }) {
  const tr = useT();
  const { midi, mic } = input;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{tr("ui.real_instrument_optional")}</p>
        {midi.supported ? (
          midi.status === "connected" ? (
            <p className="flex items-center gap-1.5 text-sm text-success">
              <Plug className="h-4 w-4" /> MIDI: {midi.devices.length ? midi.devices.join(", ") : "connected — no device found yet"}
            </p>
          ) : (
            <Button size="sm" variant="outline" onClick={midi.connect} loading={midi.status === "connecting"}>
              <Plug className="h-4 w-4" /> {tr("ui.connect_midi_keyboard")}
            </Button>
          )
        ) : (
          <p className="text-xs text-muted">{tr("ui.midi_keyboards_need_chrome_or_edge")}</p>
        )}
        {midi.error && <p className="text-xs text-danger">{midi.error}</p>}
      </div>
      {allowMic && <MicButton status={mic.status} error={mic.error} onStart={mic.start} onStop={mic.stop} label={micLabel ?? tr("ui.listen_to_my_instrument")} />}
    </div>
  );
}

export function HintButton({ hint }: { hint: string | null }) {
  const tr = useT();
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-accent hover:bg-accent-soft">
        <Lightbulb className="h-4 w-4" /> {tr("lesson.hint")}
      </summary>
      <p className="mt-1 rounded-lg bg-accent-soft px-3 py-2 text-sm text-text">{hint ?? tr("ui.you_re_doing_great_keep_going")}</p>
    </details>
  );
}

export function Feedback({ kind, children }: { kind: "correct" | "wrong" | "info" | null; children?: ReactNode }) {
  if (!kind) return <div className="min-h-6" aria-live="polite" />;
  return (
    <div aria-live="polite" className={cn("flex items-center gap-2 text-sm font-medium", kind === "correct" ? "text-success" : kind === "wrong" ? "text-danger" : "text-muted")}>
      {kind === "correct" ? <CheckCircle2 className="h-4 w-4" /> : kind === "wrong" ? <XCircle className="h-4 w-4" /> : null}
      {children}
    </div>
  );
}

export function ResultPanel({ outcome, extra, onRetry, passAccuracy }: { outcome: ExerciseOutcome; extra?: ReactNode; onRetry: () => void; passAccuracy?: number }) {
  const tr = useT();
  const pct = Math.round(outcome.accuracy * 100);
  const passed = passAccuracy === undefined || outcome.accuracy >= passAccuracy;
  return (
    <Callout tone={passed ? "success" : "warn"} title={passed ? `Well done — ${pct}% accuracy` : `${pct}% — almost there`} icon={passed ? <CheckCircle2 className="h-5 w-5 text-success" /> : <RotateCcw className="h-5 w-5 text-warn" />}>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={outcome.measured ? "success" : "warn"}>{outcome.measured ? "Measured" : "Self-reported"}</Badge>
          <Badge>{outcome.input === "mic" ? "Microphone" : outcome.input === "midi" ? "MIDI" : outcome.input === "tap" ? "Tapping" : tr("ui.virtual_instrument")}</Badge>
          <span className="text-xs">
            {outcome.correct}/{outcome.total} correct
          </span>
        </div>
        {extra}
        {!passed && passAccuracy !== undefined && <p>{tr("ui.mastery_need_pct", { pct: Math.round(passAccuracy * 100) })}</p>}
        <Button size="sm" variant="secondary" onClick={onRetry}>
          <RotateCcw className="h-4 w-4" /> {tr("ui.try_again")}
        </Button>
      </div>
    </Callout>
  );
}
