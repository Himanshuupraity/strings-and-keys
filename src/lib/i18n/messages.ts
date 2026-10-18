import { EN, type MessageKey } from "./en";

/** A placeholder value: plain text/number, or a nested message (e.g. a pluralised unit). */
export type MessageVar = string | number | I18nMessage;

/** A translatable message produced by pure logic (recommender reasons, feedback…); format it in the UI. */
export type I18nMessage = { key: MessageKey; vars?: Record<string, MessageVar> };

/** Replace {name}-style placeholders. Unknown placeholders are left as-is. */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Format a message with a dictionary; nested messages are formatted too, strings pass through `mapText`. */
export function formatWith(dict: Record<MessageKey, string>, msg: I18nMessage, mapText: (s: string) => string = (s) => s): string {
  const vars = msg.vars && Object.fromEntries(Object.entries(msg.vars).map(([k, v]) => [k, typeof v === "object" ? formatWith(dict, v, mapText) : typeof v === "string" ? mapText(v) : v]));
  return interpolate(dict[msg.key] ?? EN[msg.key] ?? msg.key, vars);
}

/** English text of a message — for logic that still exposes plain strings (and its tests). */
export function enText(msg: I18nMessage): string {
  return formatWith(EN, msg);
}
