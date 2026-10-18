"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Hand, Mic, Minus, Pause, Play, PlayCircle as Youtube, Plus, Timer, Type } from "lucide-react";
import { Badge, Button, Callout, Card, CardBody, Segmented, Slider, cn } from "@/components/ui";
import { ChordDiagram } from "@/components/instruments/chord-diagram";
import { MicButton } from "@/components/instruments/mic-button";
import { useMic } from "@/hooks/use-mic";
import { usePrefs } from "@/hooks/use-prefs";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { chordNoteNames } from "@/lib/music/chords";
import { transposeKey } from "@/lib/music/transpose";
import { guessKey, isNoChord, lyricSegments, parseSheet, transposeSheet, uniqueChords, youtubeId, type SheetLine } from "@/lib/sheet/parse";
import { advanceOn, DEFAULT_FOLLOWER, firstStop, nextStop, PhraseFollower, prevStop } from "@/lib/sheet/follow";

type Mode = "voice" | "auto" | "manual";
type Layout = "sheet" | "flow";

const LAYOUT_KEY = "mm:sheet-layout";

/** Lyrics + chords sheet with follow-my-voice, auto-scroll and manual navigation. */
export function SongSheet({ title, artist, sheet, youtube, onLineChange, onPasteLyrics, findLyricsHref }: { title: string; artist?: string; sheet: string; youtube?: string; onLineChange?: () => void; onPasteLyrics?: (text: string) => Promise<void>; findLyricsHref?: string }) {
  const [prefs] = usePrefs();
  const parsed = useMemo(() => parseSheet(sheet), [sheet]);
  const baseKey = useMemo(() => guessKey(parsed.lines), [parsed]);
  const [transpose, setTranspose] = useState(0);
  const [capo, setCapo] = useState(0);
  // Smaller default text on phones so typical chord-sheet lines fit without scrolling sideways.
  const [fontSize, setFontSize] = useState(() => (typeof window !== "undefined" && window.innerWidth < 640 ? 15 : 19));
  const [layout, setLayoutState] = useState<Layout>(() => {
    try {
      return (typeof window !== "undefined" && (localStorage.getItem(LAYOUT_KEY) as Layout)) || "sheet";
    } catch {
      return "sheet";
    }
  });
  const setLayout = (l: Layout) => {
    setLayoutState(l);
    try {
      localStorage.setItem(LAYOUT_KEY, l);
    } catch {
      /* storage blocked */
    }
  };
  const [mode, setMode] = useState<Mode>("voice");
  const [secondsPerLine, setSecondsPerLine] = useState(5);
  const [autoRunning, setAutoRunning] = useState(false);
  const [sensitivity, setSensitivity] = useState(DEFAULT_FOLLOWER.sensitivity);
  const [current, setCurrent] = useState(() => firstStop(parsed.lines));
  const [voiceState, setVoiceState] = useState<"calibrating" | "ready" | "singing">("calibrating");
  const [showVideo, setShowVideo] = useState(false);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const log = usePracticeLog(`Song sheet: ${title}`);

  const soundingKey = transposeKey(baseKey, transpose);
  const sounding = useMemo(() => transposeSheet(parsed.lines, transpose, soundingKey), [parsed, transpose, soundingKey]);
  const shapeKey = transposeKey(soundingKey, -capo);
  const shown = useMemo(() => (capo ? transposeSheet(sounding, -capo, shapeKey) : sounding), [sounding, capo, shapeKey]);
  const chords = uniqueChords(shown);
  const vid = youtube ? youtubeId(youtube) : null;

  const go = useCallback(
    (i: number) => {
      setCurrent(i);
      log.ping();
      onLineChange?.();
    },
    [log, onLineChange],
  );

  // Keep the current line centred.
  useEffect(() => {
    lineRefs.current[current]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [current]);

  // Keyboard / Bluetooth page-turner pedals (they send arrow / page keys).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      if (["ArrowDown", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        go(nextStop(parsed.lines, current));
      } else if (["ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        go(prevStop(parsed.lines, current));
      } else if (e.key === "Home") {
        go(firstStop(parsed.lines));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, parsed, go]);

  // Auto-scroll: one line every N seconds.
  useEffect(() => {
    if (mode !== "auto" || !autoRunning) return;
    const id = window.setInterval(() => setCurrent((c) => nextStop(parsed.lines, c)), secondsPerLine * 1000);
    return () => window.clearInterval(id);
  }, [mode, autoRunning, secondsPerLine, parsed]);

  // Follow my voice.
  const follower = useRef(new PhraseFollower());
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  useEffect(() => follower.current.setOptions({ sensitivity }), [sensitivity]);
  const mic = useMic({
    a4: prefs.a4,
    mode: "pitch",
    onPitch: (f) => {
      const ev = follower.current.push(f.level, f.frequency !== null, performance.now());
      if (ev === "calibrated") setVoiceState("ready");
      if (ev === "phrase-start") setVoiceState("singing");
      if (ev === "phrase-end") setVoiceState("ready");
      if (ev === "phrase-start" || ev === "phrase-end") {
        const next = advanceOn(parsed.lines, currentRef.current, ev);
        if (next !== currentRef.current) go(next);
      }
    },
  });
  const startVoice = () => {
    follower.current = new PhraseFollower({ ...DEFAULT_FOLLOWER, sensitivity });
    setVoiceState("calibrating");
    void mic.start();
  };

  const level = mic.pitch?.level ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        {/* Controls */}
        <Card className="lg:sticky lg:top-[72px] lg:z-10">
          <CardBody className="space-y-3 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Segmented<Mode>
                label="Scrolling"
                size="sm"
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  setAutoRunning(false);
                  if (m !== "voice" && mic.listening) mic.stop();
                }}
                options={[
                  { value: "voice", label: "Follow my voice", icon: <Mic className="h-3.5 w-3.5" />, testId: "mode-voice" },
                  { value: "auto", label: "Auto-scroll", icon: <Timer className="h-3.5 w-3.5" />, testId: "mode-auto" },
                  { value: "manual", label: "Manual", icon: <Hand className="h-3.5 w-3.5" />, testId: "mode-manual" },
                ]}
              />
              <div className="ml-auto flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Previous line" onClick={() => go(prevStop(parsed.lines, current))}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Next line" onClick={() => go(nextStop(parsed.lines, current))} data-testid="sheet-next">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {mode === "voice" && (
              <div className="space-y-2">
                <MicButton status={mic.status} error={mic.error} onStart={startVoice} onStop={mic.stop} label="Start following my voice" showPrivacy={false} />
                {mic.listening && (
                  <div className="flex flex-wrap items-center gap-3 text-sm" role="status" aria-live="polite" data-testid="voice-status">
                    <span className={cn("font-medium", voiceState === "singing" ? "text-success" : "text-muted")}>
                      {voiceState === "calibrating" ? "Stay quiet for a second — measuring the room…" : voiceState === "singing" ? "Singing — keep going" : "Ready — start singing the highlighted line"}
                    </span>
                    <span className="h-2 w-28 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                      <span className={cn("block h-full rounded-full transition-[width]", voiceState === "singing" ? "bg-success" : "bg-accent")} style={{ width: `${Math.min(100, level * 600)}%` }} />
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted">
                  Each time you finish a line and pause, the sheet moves on. It listens to your phrasing, not the words, and audio never leaves your device. Loud strumming can confuse it — use the arrows, a tap or a page-turner pedal to correct.
                </p>
                <Slider label="Voice sensitivity" min={1.5} max={6} step={0.5} value={7.5 - sensitivity} onChange={(v) => setSensitivity(7.5 - v)} format={(v) => (v < 3 ? "Low" : v < 4.5 ? "Medium" : "High")} />
              </div>
            )}
            {mode === "auto" && (
              <div className="flex flex-wrap items-end gap-3">
                <Button size="sm" onClick={() => setAutoRunning((r) => !r)} data-testid="auto-toggle">
                  {autoRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {autoRunning ? "Pause" : "Start"}
                </Button>
                <Slider className="min-w-48 flex-1" label="Seconds per line" min={2} max={12} step={0.5} value={secondsPerLine} onChange={setSecondsPerLine} format={(v) => `${v}s`} />
              </div>
            )}
            {mode === "manual" && <p className="text-xs text-muted">Tap a line, use the arrow keys / space bar, or a Bluetooth page-turner pedal.</p>}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-muted">Transpose</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Transpose down" onClick={() => setTranspose((t) => t - 1)}><Minus className="h-3.5 w-3.5" /></Button>
                <span className="w-16 text-center tabular-nums">{transpose > 0 ? `+${transpose}` : transpose} · {soundingKey}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Transpose up" onClick={() => setTranspose((t) => t + 1)}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              {prefs.instrument === "guitar" && (
                <div className="flex items-center gap-1">
                  <span className="text-muted">Capo</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Capo down" onClick={() => setCapo((c) => Math.max(0, c - 1))}><Minus className="h-3.5 w-3.5" /></Button>
                  <span className="w-6 text-center tabular-nums">{capo}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Capo up" onClick={() => setCapo((c) => Math.min(9, c + 1))}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Type className="h-4 w-4 text-muted" aria-hidden />
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Smaller text" onClick={() => setFontSize((f) => Math.max(14, f - 2))}><Minus className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Larger text" onClick={() => setFontSize((f) => Math.min(36, f + 2))}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              <Segmented<Layout>
                label="Layout"
                size="sm"
                value={layout}
                onChange={setLayout}
                options={[
                  { value: "sheet", label: "Chord sheet", testId: "layout-sheet" },
                  { value: "flow", label: "Flowing", testId: "layout-flow" },
                ]}
              />
              {capo > 0 && <Badge tone="guitar">Showing shapes for capo {capo} · sounds in {soundingKey}</Badge>}
            </div>
          </CardBody>
        </Card>

        {/* The sheet */}
        <Card>
          <CardBody className="pt-6" >
            <h2 className="font-display text-3xl">{title}</h2>
            {artist && <p className="mb-6 text-muted">{artist}</p>}
            {onPasteLyrics && !parsed.lines.some((l) => l.kind === "lyric" && l.text.trim()) && <InlinePaste onPaste={onPasteLyrics} findHref={findLyricsHref} />}
            <div style={{ fontSize }} data-testid="song-sheet" data-layout={layout} className={cn(layout === "sheet" && "scrollbar-thin overflow-x-auto")}>
              <div className={cn(layout === "sheet" && "w-max min-w-full")}>
                {shown.map((l, i) => {
                  const props = { line: l, active: i === current, past: i < current, onClick: () => (l.kind === "lyric" || l.kind === "chords") && go(i), refCb: (el: HTMLDivElement | null) => void (lineRefs.current[i] = el) };
                  return layout === "sheet" ? <SheetRowMono key={i} {...props} /> : <SheetRow key={i} {...props} />;
                })}
              </div>
            </div>
            <div className="h-[40vh]" aria-hidden />
          </CardBody>
        </Card>
      </div>

      {/* Side panel: video + chords */}
      <aside className="space-y-4 lg:sticky lg:top-[72px] lg:self-start">
        {vid ? (
          <Card className="overflow-hidden">
            {showVideo ? (
              <iframe
                className="aspect-video w-full"
                src={`https://www.youtube-nocookie.com/embed/${vid}?rel=0`}
                title={`${title} — YouTube video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <button type="button" onClick={() => setShowVideo(true)} className="relative block aspect-video w-full bg-black" aria-label="Load the YouTube video">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://i.ytimg.com/vi/${vid}/hqdefault.jpg`} alt="" className="h-full w-full object-cover opacity-80" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex items-center gap-2 rounded-full bg-danger px-4 py-2 text-sm font-semibold text-white"><Youtube className="h-4 w-4" /> Play video</span>
                </span>
              </button>
            )}
            <p className="px-4 py-2 text-xs text-muted">Video loads from YouTube only when you press play.</p>
          </Card>
        ) : (
          <Callout tone="neutral" icon={<Youtube className="h-4 w-4 text-danger" />} title="Listen while you sing">Add the song&apos;s YouTube link (Edit) to play it right here.</Callout>
        )}
        <Card>
          <CardBody className="pt-4">
            <p className="mb-3 text-sm font-semibold">Chords in this song {capo > 0 && <span className="font-normal text-muted">(capo {capo})</span>}</p>
            {prefs.instrument === "guitar" ? (
              <div className="flex flex-wrap gap-2">
                {chords.map((c) => (
                  <ChordDiagram key={c} chord={c} size="sm" capo={capo} />
                ))}
              </div>
            ) : (
              <ul className="space-y-1 text-sm">
                {chords.map((c) => (
                  <li key={c} className="flex justify-between gap-2"><span className="font-semibold">{c}</span><span className="text-muted">{safeNotes(c)}</span></li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}

function safeNotes(c: string) {
  try {
    return chordNoteNames(c).join(" · ");
  } catch {
    return "";
  }
}

/** Shown inside the sheet when it has chords but no words yet: paste the lyrics right here. */
function InlinePaste({ onPaste, findHref }: { onPaste: (text: string) => Promise<void>; findHref?: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (t: string) => {
    if (!t.trim()) return;
    setBusy(true);
    try {
      await onPaste(t);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mb-8 rounded-2xl border-2 border-dashed border-accent/50 bg-accent-soft/40 p-4 sm:p-5" data-testid="inline-paste">
      <p className="font-semibold">No lyrics yet — add them here</p>
      <ol className="mt-1 list-inside list-decimal text-sm text-muted">
        <li>Open a lyrics-with-chords page for this song{findHref ? " (button below)" : ""} and copy it.</li>
        <li>Press “Paste from clipboard” — or paste into the box — and the lyrics appear with chords above the words.</li>
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        {findHref && (
          <a href={findHref} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2">
            Find lyrics with chords ↗
          </a>
        )}
        <Button
          size="sm"
          className="h-9"
          loading={busy}
          data-testid="inline-paste-clipboard"
          onClick={async () => {
            try {
              const clip = await navigator.clipboard.readText();
              if (!clip.trim()) return;
              await save(clip);
            } catch {
              /* clipboard blocked: the textarea below still works */
            }
          }}
        >
          Paste from clipboard
        </Button>
      </div>
      <textarea
        aria-label="Paste lyrics with chords"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={(e) => {
          const t = e.clipboardData.getData("text");
          if (t.trim()) {
            e.preventDefault();
            void save(t);
          }
        }}
        rows={4}
        placeholder="…or click here and press Ctrl+V / ⌘V"
        className="mt-3 w-full rounded-xl border border-border bg-surface p-3 font-mono text-sm focus:border-accent focus:outline-none"
        data-testid="inline-paste-text"
      />
      {text.trim() && (
        <Button size="sm" className="mt-2" onClick={() => void save(text)} loading={busy}>
          Add these lyrics
        </Button>
      )}
    </div>
  );
}

/** A chord name in a small grey box, as on printed chord sheets. N.C. = no chord. */
function ChordTag({ chord }: { chord: string }) {
  return (
    <span className={cn("rounded-[3px] px-[0.2ch] font-bold leading-[1.25]", isNoChord(chord) ? "text-muted" : "bg-surface-3 text-text")} data-chord={chord}>
      {chord}
    </span>
  );
}

type RowProps = { line: SheetLine; active: boolean; past: boolean; onClick: () => void; refCb: (el: HTMLDivElement | null) => void };

/**
 * Chord-sheet layout: monospaced text so every chord sits above the exact letter where it was
 * placed on the original sheet (including chords placed after the last word).
 */
function SheetRowMono({ line, active, past, onClick, refCb }: RowProps) {
  if (line.kind === "blank") return <div className="h-[1.2em]" ref={refCb} />;
  if (line.kind === "section") {
    return (
      <div ref={refCb} className="mb-1 mt-4 font-mono text-[0.85em] text-muted">
        [{line.name}]
      </div>
    );
  }
  const base = cn("-mx-2 cursor-pointer rounded-lg px-2 font-mono transition-colors", active ? "bg-accent-soft ring-1 ring-accent/40" : past ? "opacity-55 hover:opacity-80" : "hover:bg-surface-2");
  const chordRow = (items: { chord: string; col: number }[]) => {
    const width = Math.max(...items.map((c) => c.col + c.chord.length + 1));
    return (
      <div className="relative h-[1.45em] whitespace-pre text-[0.92em]" style={{ minWidth: `${width}ch` }} aria-hidden>
        {items.map((c, i) => (
          <span key={i} className="absolute top-0 -ml-[0.2ch]" style={{ left: `${c.col}ch` }}>
            <ChordTag chord={c.chord} />
          </span>
        ))}
      </div>
    );
  };
  if (line.kind === "chords") {
    const cols = line.cols ?? line.chords.map((_, i) => i * 6);
    return (
      <div ref={refCb} onClick={onClick} className={cn(base, "py-0.5")} data-active={active || undefined} aria-label={`Chords: ${line.chords.join(", ")}`}>
        {chordRow(line.chords.map((c, i) => ({ chord: c, col: cols[i] ?? i * 6 })))}
      </div>
    );
  }
  return (
    <div ref={refCb} onClick={onClick} className={cn(base, "py-0.5")} data-active={active || undefined} data-line-text={line.text.trim()}>
      {line.chords.length > 0 && chordRow(line.chords.map((c) => ({ chord: c.chord, col: c.col ?? c.at })))}
      <p className="whitespace-pre leading-[1.45]" aria-label={`${line.text.trim()}${line.chords.length ? ` (chords: ${line.chords.map((c) => c.chord).join(", ")})` : ""}`}>
        {line.text || " "}
      </p>
    </div>
  );
}

function SheetRow({ line, active, past, onClick, refCb }: { line: SheetLine; active: boolean; past: boolean; onClick: () => void; refCb: (el: HTMLDivElement | null) => void }) {
  if (line.kind === "blank") return <div className="h-4" ref={refCb} />;
  if (line.kind === "section") {
    return (
      <div ref={refCb} className="mb-1 mt-5 text-[0.7em] font-semibold uppercase tracking-wider text-accent">
        {line.name}
      </div>
    );
  }
  const base = cn(
    "-mx-3 cursor-pointer rounded-xl px-3 transition-colors",
    active ? "bg-accent-soft ring-1 ring-accent/40" : past ? "opacity-55 hover:opacity-80" : "hover:bg-surface-2",
  );
  if (line.kind === "chords") {
    return (
      <div ref={refCb} onClick={onClick} className={cn(base, "py-1.5")} data-active={active || undefined}>
        <span className="font-mono text-[0.85em] font-semibold text-guitar">{line.chords.join("   ")}</span>
        <span className="ml-2 text-[0.6em] text-muted">instrumental</span>
      </div>
    );
  }
  return (
    <div ref={refCb} onClick={onClick} className={cn(base, line.chords.length ? "pb-0.5 pt-1" : "py-1")} data-active={active || undefined} data-line-text={line.text.trim()}>
      {/* Tall line-height leaves room above EVERY wrapped line for its chords. */}
      <p className={cn("whitespace-pre-wrap", line.chords.length ? "leading-[2.5]" : "leading-[1.6]")} aria-label={`${line.text.trim()}${line.chords.length ? ` (chords: ${line.chords.map((c) => c.chord).join(", ")})` : ""}`}>
        {lyricSegments(line).map((seg, i) => (
          <span key={i} className="relative">
            {seg.chord && (
              <span className="absolute bottom-full left-0 mb-[0.05em] whitespace-nowrap font-mono text-[0.72em] font-bold leading-none text-guitar" aria-hidden data-chord={seg.chord}>
                {seg.chord}
              </span>
            )}
            {seg.text || (seg.chord ? " " : "")}
          </span>
        ))}
      </p>
    </div>
  );
}
