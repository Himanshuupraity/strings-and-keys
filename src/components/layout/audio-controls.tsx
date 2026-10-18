"use client";

import { useSyncExternalStore } from "react";
import { Mic, Volume2, VolumeX } from "lucide-react";
import { usePrefs } from "@/hooks/use-prefs";
import { micRegistry } from "@/hooks/use-mic";
import { Button } from "@/components/ui";

/** Global audio area: master volume + a clear "microphone is on" indicator with a stop button. */
export function AudioControls() {
  const [prefs, setPrefs] = usePrefs();
  const mics = useSyncExternalStore(micRegistry.subscribe, micRegistry.count, () => 0);
  return (
    <div className="flex items-center gap-1">
      {mics > 0 && (
        <button
          type="button"
          onClick={micRegistry.stopAll}
          className="mic-live mr-1 inline-flex h-8 items-center gap-1.5 rounded-full bg-danger px-3 text-xs font-semibold text-white"
          aria-label="Microphone is on. Stop listening"
          data-testid="mic-indicator"
        >
          <Mic className="h-3.5 w-3.5" aria-hidden /> Listening · Stop
        </button>
      )}
      <Button variant="ghost" size="icon" aria-label={prefs.volume > 0 ? "Mute sound" : "Unmute sound"} onClick={() => setPrefs({ volume: prefs.volume > 0 ? 0 : 0.8 })}>
        {prefs.volume > 0 ? <Volume2 className="h-5 w-5" aria-hidden /> : <VolumeX className="h-5 w-5" aria-hidden />}
      </Button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={prefs.volume}
        onChange={(e) => setPrefs({ volume: Number(e.target.value) })}
        aria-label="Master volume"
        className="hidden w-20 accent-[var(--accent)] lg:block"
      />
    </div>
  );
}
