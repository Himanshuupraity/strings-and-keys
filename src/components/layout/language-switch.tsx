"use client";

import { Languages } from "lucide-react";
import { Segmented } from "@/components/ui";
import { usePrefs } from "@/hooks/use-prefs";
import { useT } from "@/lib/i18n";

/** English / हिंदी interface switch (saved in prefs, which sync with the learner's profile). */
export function LanguageSwitch({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  const [prefs, setPrefs] = usePrefs();
  const t = useT();
  return (
    <div className={className}>
      {showLabel && (
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-subtle">
          <Languages className="h-3.5 w-3.5" aria-hidden /> {t("shell.language")}
        </p>
      )}
      <Segmented<"en" | "hi">
        label={t("shell.language")}
        value={prefs.uiLanguage}
        onChange={(uiLanguage) => setPrefs({ uiLanguage })}
        options={[
          { value: "en", label: "English", testId: "lang-en" },
          { value: "hi", label: "हिंदी", testId: "lang-hi" },
        ]}
      />
    </div>
  );
}
