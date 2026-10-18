"use client";
import { useT } from "@/lib/i18n";

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
  const tr = useT();
  const [prefs, setPrefs] = usePrefs();
  const [last, setLast] = useState<{ string: number; fret: number; midi: number } | null>(null);
  const [showAll, setShowAll] = useState(true);
  const { ping } = usePracticeLog("Guitar Lab: fretboard", { instrument: "guitar" });

  return (
    <Card>
      <CardHeader
        icon={<Music2 className="h-5 w-5" />}
        title={tr("ui.fretboard_explorer")}
        description={tr("ui.tap_any_string_and_fret_to_hear_it_top_line_1st")}
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <LabelControls />
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">{tr("ui.frets")}</span>
            <Select aria-label={tr("ui.number_of_frets")} className="h-8 py-0" value={prefs.fretCount} onChange={(e) => setPrefs({ fretCount: Number(e.target.value) })}>
              {[12, 15, 19, 22, 24].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </Select>
          </label>
          <div className="w-48"><Switch label={tr("ui.show_all_note_names")} checked={showAll} onChange={setShowAll} /></div>
          <div className="w-44"><Switch label={tr("ui.left_handed")} checked={prefs.leftHanded} onChange={(leftHanded) => setPrefs({ leftHanded })} /></div>
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
            <span className="text-muted">{tr("ui.nothing_played_yet_tap_a_position_on_the_neck")}</span>
          )}
        </div>
        <div className="grid gap-2 text-sm text-muted sm:grid-cols-2">
          <p>
            <strong className="text-text">{tr("ui.standard_tuning")}</strong>{tr("ui.std_tuning_line", { notes: STANDARD_TUNING.map((m) => midiToName(m)).join(" · ") })} <em>Eddie Ate Dynamite, Good Bye Eddie</em>.
          </p>
          <p>{tr("ui.each_fret_raises_the_pitch_by_one_semitone_fret")}</p>
        </div>
      </CardBody>
    </Card>
  );
}
