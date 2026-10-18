"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";
import type { AudioExample } from "@/content/types";
import { Button } from "@/components/ui";
import { playExample, type Inst } from "./utils";

/** "Play an example" control. Compare examples get A / B / both buttons. */
export function PlayExample({ audio, instrument, label = "Play an example", onPlay }: { audio: AudioExample; instrument: Inst; label?: string; onPlay?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (which: "a" | "b" | "both") => {
    setBusy(which);
    onPlay?.();
    try {
      const d = await playExample(audio, instrument, which);
      setTimeout(() => setBusy(null), Math.min(8000, d * 1000 + 200));
    } catch {
      setBusy(null);
    }
  };
  if (audio.type === "compare") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => run("a")} loading={busy === "a"}>
          <Volume2 className="h-4 w-4" /> {audio.labelA}
        </Button>
        <Button variant="secondary" onClick={() => run("b")} loading={busy === "b"}>
          <Volume2 className="h-4 w-4" /> {audio.labelB}
        </Button>
        <Button variant="ghost" onClick={() => run("both")} loading={busy === "both"}>
          Play both
        </Button>
      </div>
    );
  }
  return (
    <Button variant="secondary" onClick={() => run("both")} loading={busy !== null} data-testid="play-example">
      <Volume2 className="h-4 w-4" /> {label}
    </Button>
  );
}
