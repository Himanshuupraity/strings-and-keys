"use client";

import { useT, type MessageKey } from "@/lib/i18n";

/** Translated text for server-rendered pages that can't call useT() themselves. */
export function T({ k, vars }: { k: MessageKey; vars?: Record<string, string | number> }) {
  const t = useT();
  return <>{t(k, vars)}</>;
}
