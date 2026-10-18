"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, Pause, Pencil, Play, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Callout, EmptyState, Input, Skeleton, cn } from "@/components/ui";
import { formatBytes, formatDuration, safeFileName, STORAGE_WARN_BYTES } from "@/lib/recordings/format";
import { recordingsRepo, type RecordingMeta } from "@/lib/recordings/repo";

function useRecordings(sheetId?: string) {
  const [state, setState] = useState<{ loading: boolean; items: RecordingMeta[]; bytes: number; error?: string }>({ loading: true, items: [], bytes: 0 });
  useEffect(() => {
    let alive = true;
    const load = () =>
      Promise.all([recordingsRepo.list(sheetId), recordingsRepo.usage()]).then(
        ([items, u]) => alive && setState({ loading: false, items, bytes: u.bytes }),
        (e: unknown) => alive && setState({ loading: false, items: [], bytes: 0, error: e instanceof Error ? e.message : "Recordings are unavailable." }),
      );
    void load();
    const unsub = recordingsRepo.subscribe(() => void load());
    return () => {
      alive = false;
      unsub();
    };
  }, [sheetId]);
  return state;
}

/** List of recordings (all, or only those made with one song sheet). */
export function RecordingsList({ sheetId, showUsage = true, emptyHint }: { sheetId?: string; showUsage?: boolean; emptyHint?: string }) {
  const { loading, items, bytes, error } = useRecordings(sheetId);
  if (loading) return <Skeleton className="h-24" />;
  if (error) return <Callout tone="warn" title="Recordings unavailable">{error}</Callout>;
  return (
    <div className="space-y-3" data-testid="recordings-list">
      {showUsage && items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <span>
            {items.length} recording{items.length === 1 ? "" : "s"} · {formatBytes(bytes)} on this device
          </span>
          {!sheetId && (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                if (!window.confirm("Delete all recordings on this device? This can't be undone.")) return;
                await recordingsRepo.clear();
                toast.success("All recordings deleted");
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete all
            </Button>
          )}
        </div>
      )}
      {showUsage && bytes > STORAGE_WARN_BYTES && (
        <Callout tone="warn" title="Recordings are using a lot of space">Over {formatBytes(STORAGE_WARN_BYTES)} on this device. Download the ones you want to keep and delete the rest.</Callout>
      )}
      {items.length === 0 ? (
        <EmptyState title="No recordings yet" description={emptyHint ?? "Tap Record, play or sing, then Stop. Listening back is one of the fastest ways to improve."} />
      ) : (
        <ul className="space-y-2">
          {items.map((r) => (
            <RecordingRow key={r.id} rec={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

const SPEEDS = [0.75, 1, 1.25] as const;

function RecordingRow({ rec }: { rec: RecordingMeta }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(rec.durationSec);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(rec.title);

  // Object URLs are created lazily and revoked on unmount.
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  const ensureUrl = async (): Promise<string | null> => {
    if (url) return url;
    const blob = await recordingsRepo.getBlob(rec.id);
    if (!blob) {
      toast.error("This recording's audio is missing.");
      return null;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return u;
  };

  const toggle = async () => {
    const u = await ensureUrl();
    if (!u || !audio.current) return;
    if (audio.current.src !== u) audio.current.src = u;
    audio.current.playbackRate = speed;
    (audio.current as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    if (audio.current.paused) await audio.current.play().catch(() => toast.error("Couldn't play this recording."));
    else audio.current.pause();
  };

  const share = async () => {
    const blob = await recordingsRepo.getBlob(rec.id);
    if (!blob) return;
    const file = new File([blob], safeFileName(rec.title, rec.mimeType), { type: rec.mimeType });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: rec.title });
        return;
      } catch {
        /* cancelled or failed — fall back to download */
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <li className="rounded-xl border border-border bg-surface p-3" data-testid="recording-row">
      <audio
        ref={audio}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
      />
      <div className="flex items-start gap-3">
        <Button size="icon" variant={playing ? "secondary" : "primary"} aria-label={playing ? `Pause ${rec.title}` : `Play ${rec.title}`} onClick={() => void toggle()}>
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                await recordingsRepo.rename(rec.id, title);
                setEditing(false);
              }}
            >
              <Input aria-label="Recording name" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} autoFocus />
              <Button type="submit" size="icon" aria-label="Save name">
                <Check className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <p className="truncate font-medium">{rec.title}</p>
          )}
          <p className="text-xs text-muted">
            {formatDuration(duration)} · {formatBytes(rec.size)} · {new Date(rec.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
          </p>
          <input
            type="range"
            min={0}
            max={Math.max(duration, 0.1)}
            step={0.1}
            value={Math.min(time, duration)}
            onChange={async (e) => {
              const v = Number(e.target.value);
              const u = await ensureUrl();
              if (!u || !audio.current) return;
              if (audio.current.src !== u) audio.current.src = u;
              audio.current.currentTime = v;
              setTime(v);
            }}
            aria-label={`Position in ${rec.title}`}
            className="mt-1 w-full accent-[var(--accent)]"
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <div className="mr-auto flex gap-1" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={speed === s}
              onClick={() => {
                setSpeed(s);
                if (audio.current) audio.current.playbackRate = s;
              }}
              className={cn("min-h-9 rounded-lg px-2.5 text-xs font-medium sm:min-h-7", speed === s ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2")}
            >
              {s}×
            </button>
          ))}
        </div>
        {rec.songTitle && <Badge className="mr-1 hidden sm:inline-flex">{rec.songTitle}</Badge>}
        <Button size="icon" variant="ghost" aria-label={`Rename ${rec.title}`} onClick={() => setEditing((v) => !v)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" aria-label={`Share or download ${rec.title}`} onClick={() => void share()}>
          {"share" in navigator ? <Share2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Delete ${rec.title}`}
          onClick={async () => {
            if (!window.confirm(`Delete “${rec.title}”?`)) return;
            audio.current?.pause();
            await recordingsRepo.remove(rec.id);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}
