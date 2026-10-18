"use client";

import { useCallback } from "react";
import { useHydrated, usePrefs } from "@/hooks/use-prefs";
import { loadPrefs } from "@/lib/storage/prefs";
import { LESSON_HI } from "@/content/i18n/lessons-hi";
import { EN, type MessageKey } from "./en";
import { HI } from "./hi";
import { formatWith, interpolate, type I18nMessage } from "./messages";

export type UiLanguage = "en" | "hi";
export type { MessageKey, I18nMessage };
export { interpolate, enText } from "./messages";
export type { MessageVar } from "./messages";

const DICTS: Record<UiLanguage, Record<MessageKey, string>> = { en: EN, hi: HI };

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

/** English text → key, for data-driven labels (level names, pattern names…) that live in data files. */
const EN_TO_KEY: Map<string, MessageKey> = (() => {
  const m = new Map<string, MessageKey>();
  for (const [k, v] of Object.entries(EN) as [MessageKey, string][]) if (!m.has(v)) m.set(v, k);
  return m;
})();

/** Translate a known English string (exact match); unknown strings are returned unchanged. */
export function translateText(lang: UiLanguage, text: string): string {
  if (lang === "en") return text;
  const key = EN_TO_KEY.get(text);
  return key ? DICTS[lang][key] : text;
}

/** Hook form of translateText for data-driven labels. */
export function useTx() {
  const lang = useLang();
  return useCallback((text: string) => translateText(lang, text), [lang]);
}


/** Lesson title/summary in the interface language (Hindi when available, else English). */
export function lessonText(lesson: { id: string; title: string; summary: string }, lang: UiLanguage): { title: string; summary: string } {
  if (lang === "hi") {
    const hi = LESSON_HI[lesson.id];
    if (hi) return { title: hi.title || lesson.title, summary: hi.summary || lesson.summary };
  }
  return { title: lesson.title, summary: lesson.summary };
}

/**
 * Translate at event time (toasts, confirms) from code outside React render. Only call it in
 * handlers/effects — on the server it falls back to English.
 */
export function tNow(key: MessageKey, vars?: Record<string, string | number>): string {
  const lang: UiLanguage = typeof window === "undefined" ? "en" : loadPrefs().uiLanguage;
  return translate(lang, key, vars);
}

/** Event-time form of translateText. */
export function txNow(text: string): string {
  return typeof window === "undefined" ? text : translateText(loadPrefs().uiLanguage, text);
}

/** Format a message in a language; string vars that are known English UI text are translated too. */
export function formatMessage(lang: UiLanguage, msg: I18nMessage): string {
  return formatWith(DICTS[lang], msg, (s) => translateText(lang, s));
}

/** Hook form of formatMessage. */
export function useTm() {
  const lang = useLang();
  return useCallback((msg: I18nMessage) => formatMessage(lang, msg), [lang]);
}

/** Event-time form of formatMessage (handlers/effects only). */
export function tmNow(msg: I18nMessage): string {
  return formatMessage(typeof window === "undefined" ? "en" : loadPrefs().uiLanguage, msg);
}
