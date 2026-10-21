"use client";
import { useT } from "@/lib/i18n";

import Link from "next/link";
import { Gauge, Volume2 } from "lucide-react";
import { Button, Card, CardBody, CardHeader } from "@/components/ui";
import { usePrefs } from "@/hooks/use-prefs";
import { STANDARD_TUNING, stringNumber } from "@/lib/music/guitar";
import { midiToFrequency, midiToName } from "@/lib/music/notes";
import { playReferenceTone } from "./reference-tone";

/** String-by-string reference tones. Uses the A4 calibration from Settings. */
export function TuningReference() {
  const tr = useT();
  const [prefs, setPrefs] = usePrefs();
  return (
    <Card>
      <CardHeader icon={<Gauge className="h-5 w-5" />} title={tr("ui.tuning_reference")} description={tr("ui.play_each_reference_note_then_turn_the_tuning_pe")} action={<Link href="/tuner"><Button size="sm">{tr("ui.open_tuner")}</Button></Link>} />
      <CardBody className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((s) => {
            const m = STANDARD_TUNING[s];
            const f = midiToFrequency(m, prefs.a4);
            return (
              <div key={s} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-guitar-soft text-lg font-bold text-guitar">{stringNumber(s)}</div>
                <div className="flex-1">
                  <p className="font-semibold">{midiToName(m)} <span className="text-sm font-normal text-muted">{s === 0 ? "low E (thickest)" : s === 5 ? "high E (thinnest)" : ""}</span></p>
                  <p className="text-xs tabular-nums text-muted">{f.toFixed(2)} Hz</p>
                </div>
                <Button size="icon" variant="secondary" aria-label={`Play reference ${midiToName(m)}`} onClick={() => void playReferenceTone(f, 2.5)}>
                  <Volume2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label htmlFor="a4-ref" className="font-medium">{tr("ui.reference_a4")}</label>
          <input id="a4-ref" type="number" min={415} max={466} value={prefs.a4} onChange={(e) => { const v = Number(e.target.value); if (v >= 415 && v <= 466) setPrefs({ a4: v }); }} className="h-9 w-24 rounded-xl border border-border bg-surface px-3" />
          <span className="text-muted">{tr("ui.hz_standard_is_440_change_only_if_you_re_playing")}</span>
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>{tr("ui.tune_the_low_e_string_6_first_then_go_string_by")}</li>
          <li>{tr("ui.if_your_string_sounds_lower_than_the_reference_t")}</li>
          <li>{tr("ui.always_tune")} <em>{tr("ui.up")}</em> {tr("ui.to_the_note_if_you_go_past_it_loosen_below_and_c")}</li>
        </ol>
      </CardBody>
    </Card>
  );
}
