"use client";

import { useState } from "react";
import { Fretboard } from "@/components/instruments/fretboard";
import { NoteText } from "@/components/instruments/note-label";
import { Card, CardBody, CardHeader, Select, Switch } from "@/components/ui";
import { usePrefs } from "@/hooks/use-prefs";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { STANDARD_TUNING, stringLabel } from "@/lib/music/guitar";
import { midiToFrequency, midiToName } from "@/lib/music/notes";
import { Music2 } from "lucide-react";
import { LabelControls } from "./label-controls";

export function FretboardExplorer() {
  const [prefs, setPrefs] = usePrefs();
  const [last, setLast] = useState<{ string: number; fret: number; midi: number } | null>(null);
  const [showAll, setShowAll] = useState(true);
  const { ping } = usePracticeLog("Guitar Lab: fretboard", { instrument: "guitar" });

  return (
    <Card>
      <CardHeader
        icon={<Music2 className="h-5 w-5" />}
        title="Fretboard explorer"
        description="Tap any string and fret to hear it. Top line = 1st string (high E), like guitar tab."
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <LabelControls />
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Frets</span>
            <Select aria-label="Number of frets" className="h-8 py-0" value={prefs.fretCount} onChange={(e) => setPrefs({ fretCount: Number(e.target.value) })}>
              {[12, 15, 19, 22, 24].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </Select>
          </label>
          <div className="w-48"><Switch label="Show all note names" checked={showAll} onChange={setShowAll} /></div>
          <div className="w-44"><Switch label="Left-handed" checked={prefs.leftHanded} onChange={(leftHanded) => setPrefs({ leftHanded })} /></div>
        </div>
        <Fretboard
          showAllNotes={showAll}
          capo={0}
          marks={last ? [{ string: last.string, fret: last.fret, tone: "target" }] : []}
          onPlay={(p) => {
            setLast(p);
            ping();
          }}
        />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-surface-2 px-4 py-3 text-sm" aria-live="polite">
          {last ? (
            <>
              <span className="text-2xl font-semibold"><NoteText midi={last.midi} withOctave /></span>
              <span className="text-muted">{stringLabel(last.string)}, {last.fret === 0 ? "open" : `fret ${last.fret}`}</span>
              <span className="text-muted">{midiToFrequency(last.midi, prefs.a4).toFixed(1)} Hz</span>
            </>
          ) : (
            <span className="text-muted">Nothing played yet — tap a position on the neck.</span>
          )}
        </div>
        <div className="grid gap-2 text-sm text-muted sm:grid-cols-2">
          <p>
            <strong className="text-text">Standard tuning</strong>, thickest to thinnest: {STANDARD_TUNING.map((m) => midiToName(m)).join(" · ")}. A memory trick: <em>Eddie Ate Dynamite, Good Bye Eddie</em>.
          </p>
          <p>Each fret raises the pitch by one semitone. Fret 12 is the same note as the open string, one octave higher — that&apos;s why it has two dots.</p>
        </div>
      </CardBody>
    </Card>
  );
}
