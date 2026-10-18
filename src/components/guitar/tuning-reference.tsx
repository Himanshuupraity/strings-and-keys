"use client";

import Link from "next/link";
import { Gauge, Volume2 } from "lucide-react";
import { Button, Card, CardBody, CardHeader } from "@/components/ui";
import { usePrefs } from "@/hooks/use-prefs";
import { STANDARD_TUNING, stringNumber } from "@/lib/music/guitar";
import { midiToFrequency, midiToName } from "@/lib/music/notes";
import { playReferenceTone } from "./reference-tone";

/** String-by-string reference tones. Uses the A4 calibration from Settings. */
export function TuningReference() {
  const [prefs, setPrefs] = usePrefs();
  return (
    <Card>
      <CardHeader icon={<Gauge className="h-5 w-5" />} title="Tuning reference" description="Play each reference note, then turn the tuning peg until your string matches. For a needle that listens to your guitar, use the tuner." action={<Link href="/tuner"><Button size="sm">Open tuner</Button></Link>} />
      <CardBody className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[5, 4, 3, 2, 1, 0].map((s) => {
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
          <label htmlFor="a4-ref" className="font-medium">Reference A4</label>
          <input id="a4-ref" type="number" min={415} max={466} value={prefs.a4} onChange={(e) => { const v = Number(e.target.value); if (v >= 415 && v <= 466) setPrefs({ a4: v }); }} className="h-9 w-24 rounded-xl border border-border bg-surface px-3" />
          <span className="text-muted">Hz (standard is 440). Change only if you&apos;re playing with an instrument tuned differently.</span>
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Tune the low E (string 6) first, then go string by string towards the high E.</li>
          <li>If your string sounds lower than the reference, tighten the peg a little; higher — loosen it.</li>
          <li>Always tune <em>up</em> to the note: if you go past it, loosen below and come back up. The string holds better.</li>
        </ol>
      </CardBody>
    </Card>
  );
}
