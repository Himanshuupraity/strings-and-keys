"use client";
import { useT, type MessageKey } from "@/lib/i18n";

import { useSyncExternalStore } from "react";
import { CheckCircle2, Loader2, Music, Play, TriangleAlert } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Segmented, cn } from "@/components/ui";
import { usePrefs } from "@/hooks/use-prefs";
import { PIANO_SAMPLES_MB, ensureAudio, pianoSamplesStatus, playPianoChord, subscribePianoSamples, type PianoSamplesStatus } from "@/lib/audio/engine";
import type { Prefs } from "@/lib/storage/schemas";

const STATUS: Record<PianoSamplesStatus, { key: MessageKey; tone: string }> = {
  idle: { key: "ui.piano_downloads_first_note", tone: "text-muted" },
  loading: { key: "ui.loading_piano_the_light_synth_plays_meanwhile", tone: "text-muted" },
  ready: { key: "ui.grand_piano_ready_saved_for_offline_use", tone: "text-success" },
  error: { key: "ui.couldn_t_load_the_recordings_using_the_light_syn", tone: "text-warn" },
  off: { key: "ui.light_synth_no_download", tone: "text-muted" },
};

/** Settings card: recorded grand piano vs. light synth, with load status and a test chord. */
export function PianoSoundSetting() {
  const tr = useT();
  const [prefs, setPrefs] = usePrefs();
  const status = useSyncExternalStore(subscribePianoSamples, pianoSamplesStatus, () => "idle" as PianoSamplesStatus);
  const s = STATUS[status];
  const Icon = status === "loading" ? Loader2 : status === "ready" ? CheckCircle2 : status === "error" ? TriangleAlert : Music;

  return (
    <Card id="piano-sound" className="scroll-mt-24">
      <CardHeader icon={<Music className="h-5 w-5" />} title={tr("ui.piano_sound")} description={tr("ui.used_by_the_piano_lab_lessons_songs_and_every_pi")} />
      <CardBody className="space-y-4">
        <Segmented<Prefs["pianoSound"]>
          label={tr("ui.piano_sound")}
          className="w-full sm:w-auto"
          value={prefs.pianoSound}
          onChange={(pianoSound) => setPrefs({ pianoSound })}
          options={[
            { value: "sampled", label: tr("ui.grand_piano_recorded"), testId: "piano-sound-sampled" },
            { value: "synth", label: tr("ui.light_synth"), testId: "piano-sound-synth" },
          ]}
        />
        <p className={cn("flex items-center gap-2 text-sm", s.tone)} role="status" aria-live="polite" data-testid="piano-sound-status">
          <Icon className={cn("h-4 w-4 shrink-0", status === "loading" && "animate-spin")} aria-hidden /> {tr(s.key, { mb: PIANO_SAMPLES_MB })}
        </p>
        <Button
          variant="secondary"
          onClick={async () => {
            await ensureAudio();
            void playPianoChord([60, 64, 67, 72], 1.6);
          }}
          data-testid="piano-test-chord"
        >
          <Play className="h-4 w-4" /> {tr("ui.play_test_chord")}
        </Button>
        <p className="text-xs text-muted">
          {tr("ui.salamander_credit")}{" "}
          <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-text">
            CC BY 3.0
          </a>
          {tr("ui.the_light_synth_uses_no_download_and_works_on_an")}
        </p>
      </CardBody>
    </Card>
  );
}
