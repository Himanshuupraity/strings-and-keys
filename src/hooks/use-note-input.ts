"use client";

import { useRef } from "react";
import { useMic } from "./use-mic";
import { useMidi } from "./use-midi";
import { usePrefs } from "./use-prefs";
import type { DetectedNote } from "@/lib/music/notes";

export type NoteSource = "virtual" | "midi" | "mic";

/**
 * Combines MIDI and microphone input into discrete "note played" events.
 * Mic events fire only for STABLE pitches (several consistent frames with high clarity) and only
 * once per new onset — so a sustained note isn't counted repeatedly and unclear sound is ignored.
 * Virtual instrument clicks are passed straight to `onNote` by the caller.
 */
export function useNoteInput(onNote: (midi: number, source: NoteSource, detail?: { note?: DetectedNote; velocity?: number }) => void) {
  const [prefs] = usePrefs();
  const cb = useRef(onNote);
  cb.current = onNote;
  const lastMic = useRef<{ midi: number | null; silentFrames: number }>({ midi: null, silentFrames: 0 });

  const midi = useMidi((e) => {
    if (e.type === "on") cb.current(e.midi, "midi", { velocity: e.velocity });
  });

  const mic = useMic({
    a4: prefs.a4,
    mode: "pitch",
    onPitch: (f) => {
      const st = lastMic.current;
      if (!f.note || !f.stable) {
        if (f.level < 0.012) {
          st.silentFrames++;
          if (st.silentFrames > 6) st.midi = null;
        }
        return;
      }
      st.silentFrames = 0;
      if (st.midi === f.note.midi) return;
      st.midi = f.note.midi;
      cb.current(f.note.midi, "mic", { note: f.note });
    },
  });

  return { midi, mic };
}
