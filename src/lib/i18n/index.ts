"use client";

import { useCallback } from "react";
import { useHydrated, usePrefs } from "@/hooks/use-prefs";
import { LESSON_HI } from "@/content/i18n/lessons-hi";
import { EN, type MessageKey } from "./en";
import { HI } from "./hi";

export type UiLanguage = "en" | "hi";
export type { MessageKey };

const DICTS: Record<UiLanguage, Record<MessageKey, string>> = { en: EN, hi: HI };

/** Replace {name}-style placeholders. Unknown placeholders are left as-is. */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function translate(lang: UiLanguage, key: MessageKey, vars?: Record<string, string | number>): string {
  return interpolate(DICTS[lang][key] ?? EN[key] ?? key, vars);
}

/**
 * Current interface language. The server (and the first client render) always use English, so
 * hydration matches; the saved preference applies right after hydration, like other prefs.
 */
export function useLang(): UiLanguage {
  const [prefs] = usePrefs();
  const hydrated = useHydrated();
  return hydrated ? prefs.uiLanguage : "en";
}

export function useT() {
  const lang = useLang();
  return useCallback((key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
}

/** Lesson title/summary in the interface language (Hindi when available, else English). */
export function lessonText(lesson: { id: string; title: string; summary: string }, lang: UiLanguage): { title: string; summary: string } {
  if (lang === "hi") {
    const hi = LESSON_HI[lesson.id];
    if (hi) return { title: hi.title || lesson.title, summary: hi.summary || lesson.summary };
  }
  return { title: lesson.title, summary: lesson.summary };
}
