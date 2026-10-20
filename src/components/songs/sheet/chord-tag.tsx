import { cn } from "@/components/ui";
import { isNoChord } from "@/lib/sheet/parse";

/** A chord name in a small grey box, as on printed chord sheets. N.C. = no chord. */
export function ChordTag({ chord }: { chord: string }) {
  return (
    <span className={cn("rounded-[3px] px-[0.2ch] font-bold leading-[1.25]", isNoChord(chord) ? "text-muted" : "bg-surface-3 text-text")} data-chord={chord}>
      {chord}
    </span>
  );
}
