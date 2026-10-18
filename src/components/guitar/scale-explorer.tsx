"use client";
import { useT, useTx } from "@/lib/i18n";

import { useState } from "react";
import { Play, Waves } from "lucide-react";
import { Fretboard } from "@/components/instruments/fretboard";
import { Badge, Button, Card, CardBody, CardHeader, Select } from "@/components/ui";
import { playSequence } from "@/lib/audio/engine";
import { parseNote } from "@/lib/music/notes";
import { SCALE_TYPES, scaleMidi, scaleNoteNames, scalePitchClasses, type ScaleTypeId } from "@/lib/music/scales";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { ROOT_NAMES } from "./chord-explorer";
import { LabelControls } from "./label-controls";

export function ScaleExplorer() {
  const tr = useT();
  const tx = useTx();
  const [tonic, setTonic] = useState("A");
  const [type, setType] = useState<ScaleTypeId>("minorPentatonic");
  const { ping } = usePracticeLog("Guitar Lab: scales", { instrument: "guitar" });
  const names = scaleNoteNames(tonic, type);
  const pcs = scalePitchClasses(tonic, type);
  const rootPc = parseNote(tonic)!.pc;
  // Play in a comfortable guitar register (around octave 3).
  const play = () => {
    ping();
    void playSequence("guitar", scaleMidi(tonic, type, rootPc >= 4 ? 2 : 3), 0.32);
  };

  return (
    <Card>
      <CardHeader icon={<Waves className="h-5 w-5" />} title={tr("ui.scale_explorer")} description={tr("ui.every_note_of_the_scale_lights_up_across_the_nec")} />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="block font-medium">{tr("ui.tonic")}</span>
            <Select aria-label={tr("ui.scale_tonic")} value={tonic} onChange={(e) => setTonic(e.target.value)}>
              {ROOT_NAMES.map((r) => <option key={r}>{r}</option>)}
            </Select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="block font-medium">{tr("ui.scale")}</span>
            <Select aria-label={tr("ui.scale_type")} value={type} onChange={(e) => setType(e.target.value as ScaleTypeId)}>
              {Object.entries(SCALE_TYPES).map(([id, s]) => <option key={id} value={id}>{tx(s.name)}</option>)}
            </Select>
          </label>
          <Button variant="secondary" onClick={play}><Play className="h-4 w-4" /> {tr("ui.play_ascending")}</Button>
          <LabelControls compact />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {names.map((n, i) => <Badge key={n + i} tone={i === 0 ? "accent" : "piano"}>{i + 1}. {n}</Badge>)}
        </div>
        <p className="text-sm text-muted">{tx(SCALE_TYPES[type].description)}</p>
        <Fretboard highlightPitchClasses={pcs} rootPc={rootPc} onPlay={ping} />
      </CardBody>
    </Card>
  );
}
