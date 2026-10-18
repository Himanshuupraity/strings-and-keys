/** Pure helpers for recordings (unit-tested). */

export const MAX_RECORDING_SEC = 10 * 60;
export const STORAGE_WARN_BYTES = 200 * 1024 * 1024;

/** Preferred container/codec order. iOS Safari only records audio/mp4; Chrome/Firefox prefer webm/ogg. */
export const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus", "audio/aac"];

export function pickMimeType(isSupported: (t: string) => boolean): string | null {
  for (const t of MIME_CANDIDATES) {
    try {
      if (isSupported(t)) return t;
    } catch {
      /* isTypeSupported can throw on odd browsers */
    }
  }
  return null;
}

export function extensionFor(mime: string): string {
  if (mime.includes("mp4") || mime.includes("aac")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function safeFileName(title: string, mime: string): string {
  const base = title.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "recording";
  return `${base}.${extensionFor(mime)}`;
}

export function defaultTitle(songTitle: string | undefined, now: Date): string {
  const stamp = now.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return songTitle ? `${songTitle} · ${stamp}` : `Practice · ${stamp}`;
}
