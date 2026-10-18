"use client";
import { useT } from "@/lib/i18n";

import { Monitor, Moon, Sun } from "lucide-react";
import { usePrefs } from "@/hooks/use-prefs";
import { Button } from "@/components/ui";

const ORDER = ["light", "dark", "system"] as const;

export function ThemeToggle() {
  const tr = useT();
  const [prefs, setPrefs] = usePrefs();
  const next = ORDER[(ORDER.indexOf(prefs.theme) + 1) % ORDER.length];
  const Icon = prefs.theme === "dark" ? Moon : prefs.theme === "light" ? Sun : Monitor;
  return (
    <Button variant="ghost" size="icon" aria-label={tr("ui.theme_switch", { cur: tr(`theme.${prefs.theme}`), next: tr(`theme.${next}`) })} title={tr("ui.theme_cur", { cur: tr(`theme.${prefs.theme}`) })} data-testid="theme-toggle" onClick={() => setPrefs({ theme: next })}>
      <Icon className="h-5 w-5" aria-hidden />
    </Button>
  );
}
