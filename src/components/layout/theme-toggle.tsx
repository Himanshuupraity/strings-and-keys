"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { usePrefs } from "@/hooks/use-prefs";
import { Button } from "@/components/ui";

const ORDER = ["light", "dark", "system"] as const;

export function ThemeToggle() {
  const [prefs, setPrefs] = usePrefs();
  const next = ORDER[(ORDER.indexOf(prefs.theme) + 1) % ORDER.length];
  const Icon = prefs.theme === "dark" ? Moon : prefs.theme === "light" ? Sun : Monitor;
  return (
    <Button variant="ghost" size="icon" aria-label={`Theme: ${prefs.theme}. Switch to ${next}`} title={`Theme: ${prefs.theme}`} data-testid="theme-toggle" onClick={() => setPrefs({ theme: next })}>
      <Icon className="h-5 w-5" aria-hidden />
    </Button>
  );
}
