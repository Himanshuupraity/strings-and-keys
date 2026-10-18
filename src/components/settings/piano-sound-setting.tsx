"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2, Loader2, Music, Play, TriangleAlert } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Segmented, cn } from "@/components/ui";
import { usePrefs } from "@/hooks/use-prefs";
import { PIANO_SAMPLES_MB, ensureAudio, pianoSamplesStatus, playPianoChord, subscribePianoSamples, type PianoSamplesStatus } from "@/lib/audio/engine";
import type { Prefs } from "@/lib/storage/schemas";

const STATUS: Record<PianoSamplesStatus, { text: string; tone: string }> = {
  idle: { text: `Downloads (${PIANO_SAMPLES_MB} MB, once) the first time you play a note`, tone: "text-muted" },
  loading: { text: "Loading piano… the light synth plays meanwhile", tone: "text-muted" },
  ready: { text: "Grand piano ready — saved for offline use", tone: "text-success" },
  error: { text: "Couldn't load the recordings — using the light synth", tone: "text-warn" },
  off: { text: "Light synth — no download", tone: "text-muted" },
};

/** Settings card: recorded grand piano vs. light synth, with load status and a test chord. */
export function PianoSoundSetting() {
  const [prefs, setPrefs] = usePrefs();
  const status = useSyncExternalStore(subscribePianoSamples, pianoSamplesStatus, () => "idle" as PianoSamplesStatus);
  const s = STATUS[status];
  const Icon = status === "loading" ? Loader2 : status === "ready" ? CheckCircle2 : status === "error" ? TriangleAlert : Music;

  return (
    <Card id="piano-sound" className="scroll-mt-24">
      <CardHeader icon={<Music className="h-5 w-5" />} title="Piano sound" description="Used by the Piano Lab, lessons, songs and every piano example." />
      <CardBody className="space-y-4">
        <Segmented<Prefs["pianoSound"]>
          label="Piano sound"
          className="w-full sm:w-auto"
          value={prefs.pianoSound}
          onChange={(pianoSound) => setPrefs({ pianoSound })}
          options={[
            { value: "sampled", label: "Grand piano (recorded)", testId: "piano-sound-sampled" },
            { value: "synth", label: "Light synth", testId: "piano-sound-synth" },
          ]}
        />
        <p className={cn("flex items-center gap-2 text-sm", s.tone)} role="status" aria-live="polite" data-testid="piano-sound-status">
          <Icon className={cn("h-4 w-4 shrink-0", status === "loading" && "animate-spin")} aria-hidden /> {s.text}
        </p>
        <Button
          variant="secondary"
          onClick={async () => {
            await ensureAudio();
            void playPianoChord([60, 64, 67, 72], 1.6);
          }}
          data-testid="piano-test-chord"
        >
          <Play className="h-4 w-4" /> Play test chord
        </Button>
        <p className="text-xs text-muted">
          Recorded piano: Salamander Grand Piano by Alexander Holm, licensed{" "}
          <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-text">
            CC BY 3.0
          </a>
          . The light synth uses no download and works on any device.
        </p>
      </CardBody>
    </Card>
  );
}
