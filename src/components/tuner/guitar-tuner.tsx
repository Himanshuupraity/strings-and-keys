"use client";
import { useT } from "@/lib/i18n";

import { useEffect, useMemo, useRef, useState } from "react";
import { Info, Volume2, Wand2 } from "lucide-react";
import { useMic } from "@/hooks/use-mic";
import { usePrefs } from "@/hooks/use-prefs";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { MicButton } from "@/components/instruments/mic-button";
import { Badge, Button, Callout, Card, CardBody, CardHeader, Select, Slider, cn } from "@/components/ui";
import { TUNINGS, stringNumber } from "@/lib/music/guitar";
import { midiToFrequency, midiToName } from "@/lib/music/notes";
import { playGuitarNote } from "@/lib/audio/engine";
import { centsFromTarget, classifyCents, nearestString, tuningAdviceMessage } from "@/components/practice/logic/tuner";
import { TunerGauge } from "./tuner-gauge";

export function GuitarTuner() {
  const tr = useT();
  const [prefs, setPrefs] = usePrefs();
  const [tuningId, setTuningId] = useState<keyof typeof TUNINGS>("standard");
  const tuning = TUNINGS[tuningId].notes;
  const [auto, setAuto] = useState(true);
  const [manual, setManual] = useState(0);
  const { ping } = usePracticeLog("Tuning");
  const mic = useMic({ a4: prefs.a4, mode: "pitch" });
  const pitch = mic.pitch;
  const freq = pitch?.frequency ?? null;
  const inTuneSince = useRef<number | null>(null);
  const [tuned, setTuned] = useState<Set<number>>(new Set());

  const target = useMemo(() => (auto && freq ? nearestString(freq, tuning, prefs.a4) : manual), [auto, freq, manual, tuning, prefs.a4]);
  const cents = freq ? centsFromTarget(freq, tuning[target], prefs.a4) : null;
  const state = cents === null ? null : classifyCents(cents);

  // Mark a string tuned after ~0.8 s continuously in tune.
  useEffect(() => {
    if (state === "in-tune" && pitch?.stable) {
      inTuneSince.current ??= Date.now();
      if (Date.now() - inTuneSince.current > 800 && !tuned.has(target)) {
        setTuned((t) => new Set(t).add(target));
        ping();
      }
    } else inTuneSince.current = null;
  }, [state, pitch?.stable, target, tuned, ping]);

  const listening = mic.listening;
  const silent = listening && !freq && (pitch?.level ?? 0) <= 0.02;
  const unclear = listening && !freq && (pitch?.level ?? 0) > 0.02;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardBody className="flex flex-col items-center gap-4 pt-6">
          <MicButton status={mic.status} error={mic.error} onStart={() => void mic.start()} onStop={mic.stop} label={tr("ui.start_tuner")} className="self-stretch" />
          <div className="text-center" aria-live="polite">
            <div className="text-sm text-muted">{tr("ui.tuner_target", { n: stringNumber(target), note: midiToName(tuning[target]), hz: midiToFrequency(tuning[target], prefs.a4).toFixed(1) })}</div>
            <div data-testid="tuner-note" className={cn("font-display text-7xl leading-tight", state === "in-tune" ? "text-success" : state ? "text-warn" : "text-subtle")}>
              {pitch?.note ? pitch.note.name : "—"}
            </div>
            <div className="text-sm tabular-nums text-muted">
              {freq ? `${freq.toFixed(1)} Hz` : listening ? tr("ui.waiting_for_a_clear_note") : tr("ui.tuner_is_off")}
              {cents !== null && (
                <>
                  {" · "}
                  <span data-testid="tuner-cents" className="font-semibold text-text">
                    {cents > 0 ? "+" : ""}
                    {Math.round(cents)} cents
                  </span>
                </>
              )}
            </div>
          </div>
          <TunerGauge cents={cents} active={!!freq} />
          <div className="min-h-12 text-center" aria-live="polite">
            {cents !== null && (
              <p className={cn("text-base font-medium", state === "in-tune" ? "text-success" : "text-text")} data-testid="tuner-advice">
                {(() => { const m = tuningAdviceMessage(cents); return tr(m.key, { amount: m.amountKey ? tr(m.amountKey) : "" }); })()}
              </p>
            )}
            {(silent || unclear) && <p className="text-sm text-muted">{unclear ? tr("ui.the_sound_is_unclear_mute_the_other_strings_and") : tr("ui.pluck_one_string_clearly_and_let_it_ring")}</p>}
          </div>

          <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-6" role="radiogroup" aria-label={tr("ui.string_to_tune")}>
            {tuning.map((m, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={target === i}
                onClick={() => {
                  setAuto(false);
                  setManual(i);
                }}
                className={cn(
                  "relative flex flex-col items-center rounded-xl border px-2 py-2.5 transition-colors",
                  target === i ? "border-accent bg-accent-soft" : "border-border bg-surface-2 hover:border-border-strong",
                )}
              >
                <span className="text-lg font-semibold">{midiToName(m)}</span>
                <span className="text-[11px] text-muted">{tr("ui.string_n", { n: stringNumber(i) })}</span>
                {tuned.has(i) && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-success" aria-label={tr("ui.tuned")} />}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" variant={auto ? "primary" : "secondary"} onClick={() => setAuto(!auto)} aria-pressed={auto}>
              <Wand2 className="h-4 w-4" /> {tr(auto ? "ui.auto_detect_on" : "ui.auto_detect_off")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void playGuitarNote(tuning[target], 0, 2.5)}>
              <Volume2 className="h-4 w-4" /> {tr("ui.play_reference_note", { note: midiToName(tuning[target]) })}
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader title={tr("ui.tuning_settings")} />
          <CardBody className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="tuning-select" className="text-sm font-medium">{tr("ui.tuning")}</label>
              <Select id="tuning-select" className="w-full" value={tuningId} onChange={(e) => { setTuningId(e.target.value as keyof typeof TUNINGS); setTuned(new Set()); }}>
                {Object.entries(TUNINGS).map(([id, t]) => <option key={id} value={id}>{t.name}</option>)}
              </Select>
            </div>
            <Slider label={tr("ui.reference_pitch_a4")} value={prefs.a4} min={432} max={446} onChange={(a4) => setPrefs({ a4 })} format={(v) => `${v} Hz`} />
            {prefs.a4 !== 440 && <Button size="sm" variant="ghost" onClick={() => setPrefs({ a4: 440 })}>{tr("ui.reset_to_440_hz_standard")}</Button>}
            <div className="flex items-center gap-2 text-sm text-muted">
              {tr("ui.tuned_this_session")} <Badge tone={tuned.size === 6 ? "success" : "neutral"}>{tuned.size}/6</Badge>
            </div>
          </CardBody>
        </Card>
        <Callout tone="info" icon={<Info className="h-4 w-4" />} title={tr("ui.tips_for_accurate_tuning")}>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>{tr("ui.tune_in_a_quiet_room_turn_off_fans_and_music")}</li>
            <li>{tr("ui.pluck_one_string_at_a_time_with_medium_strength")}</li>
            <li>{tr("ui.always_tune")} <em>{tr("ui.up")}</em> {tr("ui.to_the_note_if_you_are_sharp_go_a_little_below_a")}</li>
            <li>{tr("ui.hold_the_guitar_close_to_your_microphone_laptop")}</li>
            <li>{tr("ui.lowest_string_6th_thick_e2_highest_1st_thin_e4")}</li>
          </ul>
        </Callout>
      </div>
    </div>
  );
}
