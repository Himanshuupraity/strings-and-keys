"use client";
import { useT } from "@/lib/i18n";

import { ArrowRight, Minus, Plus, X } from "lucide-react";
import { Fretboard } from "@/components/instruments/fretboard";
import { NoteText } from "@/components/instruments/note-label";
import { Button, Card, CardBody, CardHeader } from "@/components/ui";
import { usePrefs } from "@/hooks/use-prefs";
import { openStringsWithCapo, STANDARD_TUNING, stringNumber } from "@/lib/music/guitar";
import { soundingName } from "./transpose-helpers";
import { Grip } from "lucide-react";

export function CapoSimulator() {
  const tl = useT();
  const [prefs, setPrefs] = usePrefs();
  const capo = prefs.capo;
  const setCapo = (c: number) => setPrefs({ capo: Math.max(0, Math.min(12, c)) });
  const after = openStringsWithCapo(capo);

  return (
    <Card>
      <CardHeader
        icon={<Grip className="h-5 w-5" />}
        title={tl("ui.capo_simulator")}
        description={tl("ui.a_capo_is_a_clamp_that_presses_all_six_strings_a")}
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="icon" variant="secondary" aria-label={tl("ui.move_capo_down_one_fret")} onClick={() => setCapo(capo - 1)} disabled={capo === 0}><Minus className="h-4 w-4" /></Button>
          <div className="min-w-56 flex-1">
            <label htmlFor="capo-range" className="mb-1 block text-sm font-medium">
              {tl("ui.capo_position")} <span className="tabular-nums text-accent">{capo === 0 ? "no capo" : `fret ${capo}`}</span>
            </label>
            <input id="capo-range" type="range" min={0} max={12} value={capo} onChange={(e) => setCapo(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-valuetext={capo === 0 ? tl("ui.no_capo") : tl("ui.fret_n", { n: capo })} />
          </div>
          <Button size="icon" variant="secondary" aria-label={tl("ui.move_capo_up_one_fret")} onClick={() => setCapo(capo + 1)} disabled={capo === 12}><Plus className="h-4 w-4" /></Button>
          <Button variant="ghost" onClick={() => setCapo(0)} disabled={capo === 0}><X className="h-4 w-4" /> {tl("ui.remove_capo")}</Button>
        </div>

        <Fretboard capo={capo} showAllNotes frets={Math.max(prefs.fretCount, 12)} />

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">{tl("ui.open_string_pitches_with_and_without_the_capo")}</caption>
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-3 py-2">{tl("ui.string")}</th><th className="px-3 py-2">{tl("ui.without_capo")}</th><th className="px-3 py-2" /><th className="px-3 py-2">{tl("ui.with_capo_n", { n: capo || "—" })}</th></tr>
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
            <p className="font-medium">{tl("ui.what_you_finger_vs_what_people_hear")}</p>
            <p className="text-muted">{tl(capo === 1 ? "ui.capo_explain_one" : "ui.capo_explain_n", { n: capo })}</p>
            <ul className="space-y-1">
              {["G", "C", "D", "Em", "Am"].map((shape) => (
                <li key={shape} className="flex items-center gap-2">
                  <span className="w-28 text-muted">{tl("ui.shape_suffix", { chord: shape })}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-subtle" aria-hidden />
                  <span className="font-semibold">{soundingName(shape, capo)}</span>
                  <span className="text-xs text-muted">{tl("ui.sounds")}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">{tl("ui.frets_behind_the_capo_can_t_be_played_so_they_re")}</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
