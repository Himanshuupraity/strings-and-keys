"use client";
import { useT, useTx } from "@/lib/i18n";

import { Mic, MicOff, ShieldCheck } from "lucide-react";
import { Button, Callout, cn } from "@/components/ui";
import type { MicStatus } from "@/hooks/use-mic";
import type { MicErrorKind } from "@/lib/audio/microphone";

/**
 * Standard "Listen to me" control: asks for permission only on click, shows a live indicator and a
 * stop button, and explains errors (denied / no device / unsupported) without blocking the page.
 */
export function MicButton({
  status,
  error,
  onStart,
  onStop,
  label,
  className,
  showPrivacy = true,
}: {
  status: MicStatus;
  error: { kind: MicErrorKind; message: string } | null;
  onStart: () => void;
  onStop: () => void;
  label?: string;
  className?: string;
  showPrivacy?: boolean;
}) {
  const tr = useT();
  const tx = useTx();
  const listening = status === "listening";
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {listening ? (
          <Button variant="danger" onClick={onStop} className="mic-live" data-testid="mic-stop">
            <MicOff className="h-4 w-4" /> {tr("ui.stop_listening")}
          </Button>
        ) : (
          <Button onClick={onStart} loading={status === "starting"} data-testid="mic-start">
            <Mic className="h-4 w-4" /> {label ?? tr("ui.listen_to_me")}
          </Button>
        )}
        {listening && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-danger" role="status">
            <span className="h-2 w-2 animate-pulse rounded-full bg-danger" /> {tr("ui.microphone_on")}
          </span>
        )}
      </div>
      {showPrivacy && !error && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck className="h-3.5 w-3.5" /> {tr("ui.audio_is_analysed_on_your_device_and_never_recor")}
        </p>
      )}
      {error && (
        <Callout tone={error.kind === "denied" ? "warn" : "danger"} title={error.kind === "denied" ? tr("ui.microphone_blocked") : tr("ui.microphone_unavailable")} className="max-w-xl" >
          <span data-testid="mic-error">{tx(error.message)}</span>
        </Callout>
      )}
    </div>
  );
}
