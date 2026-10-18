"use client";

import { Guitar, Piano } from "lucide-react";
import { usePrefs } from "@/hooks/use-prefs";
import { Segmented } from "@/components/ui";
import type { Instrument } from "@/lib/storage/schemas";

/** The global Guitar | Piano mode switch. Progress for each instrument is tracked independently. */
export function InstrumentToggle({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const [prefs, setPrefs] = usePrefs();
  return (
    <Segmented<Instrument>
      label="Instrument mode"
      size={size}
      className={className}
      value={prefs.instrument}
      onChange={(instrument) => setPrefs({ instrument })}
      options={[
        { value: "guitar", label: <><span className="sm:hidden">Guitar</span><span className="hidden sm:inline">Guitar Mode</span></>, icon: <Guitar className="h-4 w-4" aria-hidden />, activeClass: "!bg-guitar !text-white dark:!text-black", testId: "mode-guitar" },
        { value: "piano", label: <><span className="sm:hidden">Piano</span><span className="hidden sm:inline">Piano/Keyboard Mode</span></>, icon: <Piano className="h-4 w-4" aria-hidden />, activeClass: "!bg-piano !text-white dark:!text-black", testId: "mode-piano" },
      ]}
    />
  );
}
