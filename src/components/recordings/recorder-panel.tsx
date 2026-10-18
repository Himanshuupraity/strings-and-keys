"use client";
import { useT, useTx } from "@/lib/i18n";

import { useEffect, useRef, useState } from "react";
import { Circle, Mic, ShieldCheck, Square } from "lucide-react";
import { toast } from "sonner";
import { Button, Callout, Segmented, Switch, cn } from "@/components/ui";
import { useMetronome } from "@/hooks/use-metronome";
import { describeMicError } from "@/lib/audio/microphone";
import { defaultTitle, formatDuration, MAX_RECORDING_SEC } from "@/lib/recordings/format";
import { Recorder, recordingSupported, type RecordMode } from "@/lib/recordings/recorder";
import { recordingsRepo } from "@/lib/recordings/repo";
import { uid } from "@/lib/storage/db";

/**
 * Record button + live status. `compact` renders a single button row for the song sheet.
 * Recordings are saved to on-device storage only.
 */
export function RecorderPanel({ sheetId, songTitle, compact = false, className }: { sheetId?: string; songTitle?: string; compact?: boolean; className?: string }) {
  const tr = useT();
  const tx = useTx();
  const rec = useRef<Recorder | null>(null);
  const [state, setState] = useState<"idle" | "countin" | "starting" | "recording" | "saving">("idle");
  const [mode, setMode] = useState<RecordMode>("instrument");
  const [countIn, setCountIn] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const beatsLeft = useRef(0);
  const [countLeft, setCountLeft] = useState(0);
  // Called after each count-in click; reads the latest functions through a ref.
  const afterCountIn = useRef<() => void>(() => {});
  const metro = useMetronome({ bpm: 80, beatsPerBar: 4 }, () => {
    beatsLeft.current -= 1;
    setCountLeft(beatsLeft.current);
    if (beatsLeft.current <= 0) afterCountIn.current();
  });

  // Live timer + level meter while recording.
  useEffect(() => {
    if (state !== "recording") return;
    let raf = 0;
    const tick = () => {
      setElapsed(rec.current?.elapsed() ?? 0);
      setLevel(rec.current?.level() ?? 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  // Leaving the page discards an unfinished recording and releases the microphone.
  useEffect(() => () => rec.current?.cancel(), []);

  const begin = async () => {
    setState("starting");
    setError(null);
    const r = new Recorder();
    try {
      await r.start(mode, () => toast.message(tr("ui.stopped_at_limit", { n: MAX_RECORDING_SEC / 60 })));
    } catch (e) {
      setError(describeMicError(e).message);
      setState("idle");
      return;
    }
    rec.current = r;
    setState("recording");
  };

  useEffect(() => {
    afterCountIn.current = () => {
      metro.stop();
      void begin();
    };
  });

  const start = () => {
    if (!recordingSupported()) {
      setError(tr("ui.this_browser_can_t_record_audio_try_the_latest_c"));
      return;
    }
    if (countIn) {
      beatsLeft.current = 4;
      setCountLeft(4);
      setState("countin");
      void metro.start();
      return;
    }
    void begin();
  };

  const stop = async () => {
    const r = rec.current;
    if (!r) return;
    setState("saving");
    const result = await r.stop();
    rec.current = null;
    if (!result) {
      setState("idle");
      toast.error(tr("ui.nothing_was_recorded"));
      return;
    }
    try {
      await recordingsRepo.save(
        { id: uid("rec_"), title: defaultTitle(songTitle, new Date()), sheetId, songTitle, createdAt: new Date().toISOString(), durationSec: result.durationSec, mimeType: result.mimeType, size: result.blob.size },
        result.blob,
      );
      toast.success(tr("ui.recording_saved_on_this_device"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("ui.couldn_t_save_the_recording"));
    }
    setState("idle");
    setElapsed(0);
  };

  const recording = state === "recording";
  const meter = Math.max(0, Math.min(100, ((20 * Math.log10(Math.max(level, 1e-5)) + 60) / 60) * 100));

  return (
    <div className={cn("space-y-3", className)} data-testid="recorder-panel">
      <div className="flex flex-wrap items-center gap-2">
        {recording || state === "saving" ? (
          <Button variant="danger" onClick={() => void stop()} loading={state === "saving"} className="mic-live" data-testid="record-stop">
            <Square className="h-4 w-4 fill-current" /> Stop &amp; save
          </Button>
        ) : (
          <Button variant={compact ? "secondary" : "primary"} onClick={start} loading={state === "starting"} disabled={state === "countin"} data-testid="record-start">
            <Circle className="h-4 w-4 fill-danger text-danger" /> {state === "countin" ? `Count-in… ${Math.max(1, countLeft)}` : "Record"}
          </Button>
        )}
        {recording && (
          <span className="inline-flex items-center gap-2 text-sm font-medium text-danger" role="status" data-testid="recording-status">
            <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
            {formatDuration(elapsed)} · audio stays on this device
            <span className="h-2 w-16 overflow-hidden rounded-full bg-surface-3" aria-hidden>
              <span className="block h-full bg-danger transition-[width] duration-75" style={{ width: `${meter}%` }} />
            </span>
          </span>
        )}
      </div>
      {!compact && !recording && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Segmented<RecordMode>
            label={tr("ui.recording_style")}
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: "instrument", label: tr("ui.instrument_natural"), icon: <Mic className="h-3.5 w-3.5" /> },
              { value: "voice", label: tr("ui.voice_cleaner") },
            ]}
          />
          <div className="min-w-48">
            <Switch checked={countIn} onChange={setCountIn} label={tr("ui.count_me_in")} description={tr("ui.one_bar_of_clicks_at_80_bpm_before_recording_sta")} />
          </div>
        </div>
      )}
      {!compact && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck className="h-3.5 w-3.5" /> {tr("ui.rec_local_only", { n: MAX_RECORDING_SEC / 60 })}
        </p>
      )}
      {error && <Callout tone="warn" title={tr("ui.couldn_t_start_recording")}>{tx(error)}</Callout>}
    </div>
  );
}
