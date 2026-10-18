"use client";

import { Guitar, Piano } from "lucide-react";
import { usePrefs } from "@/hooks/use-prefs";
import { useT } from "@/lib/i18n";
import { Segmented } from "@/components/ui";
import type { Instrument } from "@/lib/storage/schemas";

/** The global Guitar | Piano mode switch. Progress for each instrument is tracked independently. */
export function InstrumentToggle({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const [prefs, setPrefs] = usePrefs();
  const t = useT();
  return (
    <Segmented<Instrument>
      label={t("shell.instrumentMode")}
      size={size}
      className={className}
      value={prefs.instrument}
      onChange={(instrument) => setPrefs({ instrument })}
      options={[
        { value: "guitar", label: <><span className="sm:hidden">{t("shell.guitar")}</span><span className="hidden sm:inline">{t("shell.guitarMode")}</span></>, icon: <Guitar className="h-4 w-4" aria-hidden />, activeClass: "!bg-guitar !text-white dark:!text-black", testId: "mode-guitar" },
        { value: "piano", label: <><span className="sm:hidden">{t("shell.piano")}</span><span className="hidden sm:inline">{t("shell.pianoMode")}</span></>, icon: <Piano className="h-4 w-4" aria-hidden />, activeClass: "!bg-piano !text-white dark:!text-black", testId: "mode-piano" },
      ]}
    />
  );
}
