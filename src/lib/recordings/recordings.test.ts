import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { defaultTitle, extensionFor, formatBytes, formatDuration, pickMimeType, safeFileName } from "./format";
import { __resetRecordingsDb, isQuotaError, recordingsRepo, RecordingStorageError, type RecordingMeta } from "./repo";

describe("format helpers", () => {
  it("picks the first supported mime type (Chrome → webm/opus, iOS Safari → mp4)", () => {
    expect(pickMimeType((t) => t.startsWith("audio/webm"))).toBe("audio/webm;codecs=opus");
    expect(pickMimeType((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(pickMimeType(() => false)).toBeNull();
    expect(pickMimeType(() => { throw new Error("weird browser"); })).toBeNull();
  });
  it("maps mime types to file extensions and safe names", () => {
    expect(extensionFor("audio/mp4")).toBe("m4a");
    expect(extensionFor("audio/webm;codecs=opus")).toBe("webm");
    expect(extensionFor("audio/ogg;codecs=opus")).toBe("ogg");
    expect(safeFileName("Tum Hi Ho · 18 Oct, 19:30", "audio/mp4")).toBe("Tum-Hi-Ho-18-Oct-1930.m4a");
    expect(safeFileName("!!!", "audio/webm")).toBe("recording.webm");
  });
  it("formats durations and sizes", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65.4)).toBe("1:05");
    expect(formatDuration(600)).toBe("10:00");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
  it("titles recordings after the song when there is one", () => {
    expect(defaultTitle("Kesariya", new Date(2026, 9, 18, 19, 30))).toMatch(/^Kesariya · /);
    expect(defaultTitle(undefined, new Date())).toMatch(/^Practice · /);
  });
});

const meta = (id: string, extra: Partial<RecordingMeta> = {}): RecordingMeta => ({
  id, title: `Take ${id}`, createdAt: new Date(2026, 9, 18, 10, Number(id.replace(/\D/g, "")) || 0).toISOString(), durationSec: 12, mimeType: "audio/webm", size: 1000, ...extra,
});

describe("recordings repository (separate IndexedDB)", () => {
  beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    __resetRecordingsDb();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("saves, lists (newest first), filters by sheet, renames and deletes", async () => {
    await recordingsRepo.save(meta("r1", { sheetId: "s1" }), new Blob(["aaa"], { type: "audio/webm" }));
    await recordingsRepo.save(meta("r2"), new Blob(["bbbb"], { type: "audio/webm" }));
    expect((await recordingsRepo.list()).map((r) => r.id)).toEqual(["r2", "r1"]);
    expect((await recordingsRepo.list("s1")).map((r) => r.id)).toEqual(["r1"]);
    const blob = await recordingsRepo.getBlob("r1");
    expect(blob?.size).toBe(3);
    await recordingsRepo.rename("r1", "  Best take  ");
    expect((await recordingsRepo.list("s1"))[0].title).toBe("Best take");
    expect(await recordingsRepo.usage()).toEqual({ count: 2, bytes: 2000 });
    await recordingsRepo.remove("r1");
    expect(await recordingsRepo.getBlob("r1")).toBeUndefined();
    await recordingsRepo.clear();
    expect(await recordingsRepo.list()).toEqual([]);
  });

  it("notifies subscribers on change", async () => {
    const fn = vi.fn();
    const off = recordingsRepo.subscribe(fn);
    await recordingsRepo.save(meta("r3"), new Blob(["x"]));
    expect(fn).toHaveBeenCalled();
    off();
  });

  it("turns a full-storage error into a friendly quota error", async () => {
    const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    await expect(recordingsRepo.save(meta("r4"), new Blob(["x"]))).rejects.toMatchObject({ name: "RecordingStorageError", quota: true });
    spy.mockRestore();
    expect(isQuotaError(new DOMException("x", "QuotaExceededError"))).toBe(true);
    expect(isQuotaError(new Error("other"))).toBe(false);
  });

  it("reports when storage is unavailable instead of crashing", async () => {
    vi.stubGlobal("indexedDB", undefined);
    __resetRecordingsDb();
    await expect(recordingsRepo.list()).rejects.toBeInstanceOf(RecordingStorageError);
  });
});
