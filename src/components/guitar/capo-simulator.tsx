"use client";

import { ArrowRight, Minus, Plus, X } from "lucide-react";
import { Fretboard } from "@/components/instruments/fretboard";
import { NoteText } from "@/components/instruments/note-label";
import { Button, Card, CardBody, CardHeader } from "@/components/ui";
import { usePrefs } from "@/hooks/use-prefs";
import { openStringsWithCapo, STANDARD_TUNING, stringNumber } from "@/lib/music/guitar";
import { soundingName } from "./transpose-helpers";
import { Grip } from "lucide-react";

export function CapoSimulator() {
  const [prefs, setPrefs] = usePrefs();
  const capo = prefs.capo;
  const setCapo = (c: number) => setPrefs({ capo: Math.max(0, Math.min(12, c)) });
  const after = openStringsWithCapo(capo);

  return (
    <Card>
      <CardHeader
        icon={<Grip className="h-5 w-5" />}
        title="Capo simulator"
        description="A capo is a clamp that presses all six strings at one fret — like a movable nut. Every fret it moves up raises every open string by one semitone."
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="icon" variant="secondary" aria-label="Move capo down one fret" onClick={() => setCapo(capo - 1)} disabled={capo === 0}><Minus className="h-4 w-4" /></Button>
          <div className="min-w-56 flex-1">
            <label htmlFor="capo-range" className="mb-1 block text-sm font-medium">
              Capo position: <span className="tabular-nums text-accent">{capo === 0 ? "no capo" : `fret ${capo}`}</span>
            </label>
            <input id="capo-range" type="range" min={0} max={12} value={capo} onChange={(e) => setCapo(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-valuetext={capo === 0 ? "No capo" : `Fret ${capo}`} />
          </div>
          <Button size="icon" variant="secondary" aria-label="Move capo up one fret" onClick={() => setCapo(capo + 1)} disabled={capo === 12}><Plus className="h-4 w-4" /></Button>
          <Button variant="ghost" onClick={() => setCapo(0)} disabled={capo === 0}><X className="h-4 w-4" /> Remove capo</Button>
        </div>

        <Fretboard capo={capo} showAllNotes frets={Math.max(prefs.fretCount, 12)} />

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Open string pitches with and without the capo</caption>
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-3 py-2">String</th><th className="px-3 py-2">Without capo</th><th className="px-3 py-2" /><th className="px-3 py-2">With capo {capo || "—"}</th></tr>
              </thead>
              <tbody>
                {[5, 4, 3, 2, 1, 0].map((s) => (
                  <tr key={s} className="border-t border-border">
                    <td className="px-3 py-1.5 text-muted">{stringNumber(s)}</td>
                    <td className="px-3 py-1.5"><NoteText midi={STANDARD_TUNING[s]} withOctave /></td>
                    <td className="px-1 text-subtle"><ArrowRight className="h-3.5 w-3.5" aria-hidden /></td>
                    <td className={capo ? "px-3 py-1.5 font-semibold text-accent" : "px-3 py-1.5"}><NoteText midi={after[s]} withOctave /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 rounded-xl bg-surface-2 p-4 text-sm">
            <p className="font-medium">What you finger vs. what people hear</p>
            <p className="text-muted">With the capo on, you still use your normal chord <em>shapes</em>, counting frets from the capo. The <em>sounding</em> chord is the shape moved up by {capo} semitone{capo === 1 ? "" : "s"}.</p>
            <ul className="space-y-1">
              {["G", "C", "D", "Em", "Am"].map((shape) => (
                <li key={shape} className="flex items-center gap-2">
                  <span className="w-28 text-muted">{shape} shape</span>
                  <ArrowRight className="h-3.5 w-3.5 text-subtle" aria-hidden />
                  <span className="font-semibold">{soundingName(shape, capo)}</span>
                  <span className="text-xs text-muted">sounds</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">Frets behind the capo can&apos;t be played, so they&apos;re greyed out on the neck.</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
