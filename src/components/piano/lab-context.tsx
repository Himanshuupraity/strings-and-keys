"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { PianoKeyboard, type KeyTone } from "@/components/instruments/piano-keyboard";

export type MidiListener = (e: { type: "on" | "off"; midi: number }) => void;
export type KeyLabels = "white" | "c-only" | "none";

export interface PianoLabContextValue {
  low: number;
  high: number;
  whiteKeyWidth: number;
  labels: KeyLabels;
  /** Changing this remounts the keyboard so it re-centres on `focusMidi`. */
  remountKey: string;
  focusMidi: number;
  midiHeld: Set<number>;
  subscribeMidi: (fn: MidiListener) => () => void;
  onVirtualHeld: (midi: number, down: boolean) => void;
  ping: () => void;
  flashHighlight: Partial<Record<number, KeyTone>>;
}

export const PianoLabContext = createContext<PianoLabContextValue | null>(null);

export function usePianoLab(): PianoLabContextValue {
  const ctx = useContext(PianoLabContext);
  if (!ctx) throw new Error("usePianoLab must be used inside the Piano Lab");
  return ctx;
}

/** Subscribe to MIDI note events from the lab's single MIDI connection. */
export function useLabMidi(fn: MidiListener) {
  const { subscribeMidi } = usePianoLab();
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => subscribeMidi((e) => ref.current(e)), [subscribeMidi]);
}

/** The lab's keyboard, configured from the shared display settings. */
export function LabKeyboard({
  highlight,
  fingers,
  onNoteOn,
  onNoteOff,
  hideLabels,
  ariaLabel,
}: {
  highlight?: Partial<Record<number, KeyTone>>;
  fingers?: Partial<Record<number, number>>;
  onNoteOn?: (midi: number) => void;
  onNoteOff?: (midi: number) => void;
  hideLabels?: boolean;
  ariaLabel?: string;
}) {
  const ctx = usePianoLab();
  return (
    <PianoKeyboard
      key={ctx.remountKey}
      low={ctx.low}
      high={ctx.high}
      pressed={ctx.midiHeld}
      highlight={{ ...ctx.flashHighlight, ...highlight }}
      fingers={fingers}
      labels={hideLabels ? "none" : ctx.labels}
      whiteKeyWidth={ctx.whiteKeyWidth}
      focusMidi={ctx.focusMidi}
      computerKeyboard
      ariaLabel={ariaLabel}
      onNoteOn={(m) => {
        ctx.onVirtualHeld(m, true);
        ctx.ping();
        onNoteOn?.(m);
      }}
      onNoteOff={(m) => {
        ctx.onVirtualHeld(m, false);
        onNoteOff?.(m);
      }}
    />
  );
}
