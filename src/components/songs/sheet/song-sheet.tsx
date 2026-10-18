"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Hand, Mic, Minus, Pause, Play, PlayCircle as Youtube, Plus, Timer, Type } from "lucide-react";
import { Badge, Button, Callout, Card, CardBody, Segmented, Slider, cn } from "@/components/ui";
import { ChordDiagram } from "@/components/instruments/chord-diagram";
import { MicButton } from "@/components/instruments/mic-button";
import { RecorderPanel } from "@/components/recordings/recorder-panel";
import { RecordingsList } from "@/components/recordings/recordings-list";
import { useMic } from "@/hooks/use-mic";
import { usePrefs } from "@/hooks/use-prefs";
import { useT } from "@/lib/i18n";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { chordNoteNames } from "@/lib/music/chords";
import { transposeKey } from "@/lib/music/transpose";
import { guessKey, isNoChord, lyricSegments, parseSheet, transposeSheet, uniqueChords, youtubeId, type SheetLine } from "@/lib/sheet/parse";
import { advanceOn, DEFAULT_FOLLOWER, firstStop, nextStop, PhraseFollower, prevStop } from "@/lib/sheet/follow";

type Mode = "voice" | "auto" | "manual";
type Layout = "sheet" | "flow";

const LAYOUT_KEY = "mm:sheet-layout";

/** Lyrics + chords sheet with follow-my-voice, auto-scroll and manual navigation. */
export function SongSheet({ title, artist, sheet, youtube, onLineChange, onPasteLyrics, findLyricsHref, sheetId }: { title: string; artist?: string; sheet: string; youtube?: string; onLineChange?: () => void; onPasteLyrics?: (text: string) => Promise<void>; findLyricsHref?: string; sheetId?: string }) {
  const t = useT();
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
  const [threshold, setThreshold] = useState(0);
  const [noPause, setNoPause] = useState(false);
  const [dbInfo, setDbInfo] = useState<{ above: number; need: number } | null>(null);
  const frameCount = useRef(0);
  const [showVideo, setShowVideo] = useState(false);
  // Phones: sheet settings are tucked away so the lyrics get the screen.
  const [showSettings, setShowSettings] = useState(false);
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
  useEffect(() => {
    follower.current.setOptions({ sensitivity });
    if (follower.current.isCalibrated) setThreshold(follower.current.threshold);
  }, [sensitivity]);
  const mic = useMic({
    a4: prefs.a4,
    mode: "pitch",
    // Voice processing: boosts quiet voices and cancels the video playing from this page.
    voice: true,
    onPitch: (f) => {
      const now = performance.now();
      const ev = follower.current.push(f.level, f.clarity, now);
      if (ev === "calibrated") {
        setVoiceState("ready");
        setThreshold(follower.current.threshold);
      }
      if (ev === "phrase-start") {
        setVoiceState("singing");
        setNoPause(false);
      }
      if (ev === "phrase-end") setVoiceState("ready");
      if (follower.current.phraseLength(now) > 12000) setNoPause(true);
      if (++frameCount.current % 6 === 0 && follower.current.isCalibrated) {
        setDbInfo({ above: follower.current.aboveFloorDb, need: follower.current.marginDb });
        setThreshold(follower.current.threshold);
      }
      if (ev === "phrase-start" || ev === "phrase-end") {
        const next = advanceOn(parsed.lines, currentRef.current, ev);
        if (next !== currentRef.current) go(next);
      }
    },
  });
  const startVoice = () => {
    follower.current = new PhraseFollower({ ...DEFAULT_FOLLOWER, sensitivity });
    setVoiceState("calibrating");
    setNoPause(false);
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
                label={t("ui.scrolling")}
                size="sm"
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  setAutoRunning(false);
                  if (m !== "voice" && mic.listening) mic.stop();
                }}
                options={[
                  { value: "voice", label: t("sheet.followVoice"), icon: <Mic className="h-3.5 w-3.5" />, testId: "mode-voice" },
                  { value: "auto", label: t("sheet.autoScroll"), icon: <Timer className="h-3.5 w-3.5" />, testId: "mode-auto" },
                  { value: "manual", label: t("sheet.manual"), icon: <Hand className="h-3.5 w-3.5" />, testId: "mode-manual" },
                ]}
              />
              <div className="ml-auto flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-10 w-10 sm:h-8 sm:w-8" aria-label={t("ui.previous_line")} onClick={() => go(prevStop(parsed.lines, current))}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-10 w-10 sm:h-8 sm:w-8" aria-label={t("ui.next_line")} onClick={() => go(nextStop(parsed.lines, current))} data-testid="sheet-next">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {mode === "voice" && (
              <div className="space-y-2">
                <MicButton status={mic.status} error={mic.error} onStart={startVoice} onStop={mic.stop} label={t("sheet.startVoice")} showPrivacy={false} />
                {mic.listening && (
                  <div className="flex flex-wrap items-center gap-3 text-sm" role="status" aria-live="polite" data-testid="voice-status">
                    <span className={cn("font-medium", voiceState === "singing" ? "text-success" : "text-muted")}>
                      {voiceState === "calibrating" ? t("sheet.calibrating") : voiceState === "singing" ? t("sheet.singing") : t("sheet.ready")}
                    </span>
                    {dbInfo && (
                      <span className="tabular-nums text-xs text-muted" data-testid="voice-db">
                        {t("ui.voice_db", { above: `${dbInfo.above >= 0 ? "+" : ""}${Math.round(dbInfo.above)}`, need: Math.round(dbInfo.need) })}
                      </span>
                    )}
                    <span className="relative h-2.5 w-40 overflow-hidden rounded-full bg-surface-3" aria-hidden title="Your voice level; the white line is how loud it needs to be">
                      <span className={cn("block h-full rounded-full transition-[width] duration-75", voiceState === "singing" ? "bg-success" : level > threshold && threshold > 0 ? "bg-accent" : "bg-subtle")} style={{ width: `${meter(level)}%` }} />
                      {threshold > 0 && <span className="absolute inset-y-0 w-0.5 bg-text" style={{ left: `${meter(threshold)}%` }} />}
                    </span>
                  </div>
                )}
                {noPause && (
                  <Callout tone="warn" title={t("ui.i_can_t_hear_any_pauses")}>
                    {t("ui.is_the_video_or_other_music_playing_out_loud_use")}
                  </Callout>
                )}
                <p className="text-xs text-muted">
                  <span className="sm:hidden">{t("sheet.shortHelp")}</span>
                  <span className="hidden sm:inline">{t("ui.sheet_long_help")}</span>
                </p>
                <Slider className={cn(showSettings ? "block" : "hidden", "sm:block")} label={t("sheet.voiceSensitivity")} min={1.5} max={6} step={0.5} value={7.5 - sensitivity} onChange={(v) => setSensitivity(7.5 - v)} format={(v) => (v < 3 ? "Low" : v < 4.5 ? "Medium" : "High")} />
              </div>
            )}
            {mode === "auto" && (
              <div className="flex flex-wrap items-end gap-3">
                <Button size="sm" onClick={() => setAutoRunning((r) => !r)} data-testid="auto-toggle">
                  {autoRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {autoRunning ? t("sheet.pause") : t("sheet.start")}
                </Button>
                <Slider className="min-w-48 flex-1" label={t("sheet.secondsPerLine")} min={2} max={12} step={0.5} value={secondsPerLine} onChange={setSecondsPerLine} format={(v) => `${v}s`} />
              </div>
            )}
            {mode === "manual" && <p className="text-xs text-muted">{t("sheet.manualHelp")}</p>}

            <RecorderPanel compact sheetId={sheetId} songTitle={title} className="border-t border-border pt-3" />
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              aria-expanded={showSettings}
              className="flex min-h-10 w-full items-center justify-between border-t border-border pt-3 text-sm font-medium text-muted sm:hidden"
              data-testid="sheet-settings-toggle"
            >
              {t("sheet.settings")} · {soundingKey}{capo ? ` · capo ${capo}` : ""}
              <ChevronDown className={cn("h-4 w-4 transition-transform", showSettings && "rotate-180")} />
            </button>
            <div className={cn(showSettings ? "flex" : "hidden", "flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-sm sm:flex")}>
              <div className="flex items-center gap-1">
                <span className="text-muted">{t("sheet.transpose")}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={t("ui.transpose_down")} onClick={() => setTranspose((t) => t - 1)}><Minus className="h-3.5 w-3.5" /></Button>
                <span className="w-16 text-center tabular-nums">{transpose > 0 ? `+${transpose}` : transpose} · {soundingKey}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={t("ui.transpose_up")} onClick={() => setTranspose((t) => t + 1)}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              {prefs.instrument === "guitar" && (
                <div className="flex items-center gap-1">
                  <span className="text-muted">{t("sheet.capo")}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={t("ui.capo_down")} onClick={() => setCapo((c) => Math.max(0, c - 1))}><Minus className="h-3.5 w-3.5" /></Button>
                  <span className="w-6 text-center tabular-nums">{capo}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={t("ui.capo_up")} onClick={() => setCapo((c) => Math.min(9, c + 1))}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Type className="h-4 w-4 text-muted" aria-hidden />
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={t("ui.smaller_text")} onClick={() => setFontSize((f) => Math.max(14, f - 2))}><Minus className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={t("ui.larger_text")} onClick={() => setFontSize((f) => Math.min(36, f + 2))}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              <Segmented<Layout>
                label={t("ui.layout")}
                size="sm"
                value={layout}
                onChange={setLayout}
                options={[
                  { value: "sheet", label: t("sheet.chordSheet"), testId: "layout-sheet" },
                  { value: "flow", label: t("sheet.flowing"), testId: "layout-flow" },
                ]}
              />
              {capo > 0 && <Badge tone="guitar">{t("ui.showing_capo_shapes", { n: capo, k: soundingKey })}</Badge>}
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
        {sheetId && (
          <Card>
            <CardBody className="pt-5">
              <p className="mb-3 font-semibold">{t("ui.your_recordings_of_this_song")}</p>
              <RecordingsList sheetId={sheetId} showUsage={false} emptyHint={t("ui.rec_empty_hint_sheet")} />
            </CardBody>
          </Card>
        )}
      </div>

      {/* Side panel: video + chords */}
      <aside className="space-y-4 lg:sticky lg:top-[72px] lg:self-start">
        {vid ? (
          <Card className="overflow-hidden">
            {showVideo ? (
              <iframe
                className="aspect-video w-full"
                src={`https://www.youtube-nocookie.com/embed/${vid}?rel=0`}
                title={t("ui.x_youtube_video", { title })}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <button type="button" onClick={() => setShowVideo(true)} className="relative block aspect-video w-full bg-black" aria-label={t("ui.load_the_youtube_video")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://i.ytimg.com/vi/${vid}/hqdefault.jpg`} alt="" className="h-full w-full object-cover opacity-80" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex items-center gap-2 rounded-full bg-danger px-4 py-2 text-sm font-semibold text-white"><Youtube className="h-4 w-4" /> {t("ui.play_video")}</span>
                </span>
              </button>
            )}
            <p className="px-4 py-2 text-xs text-muted">{t("ui.video_loads_from_youtube_only_when_you_press_pla")}</p>
          </Card>
        ) : (
          <Callout tone="neutral" icon={<Youtube className="h-4 w-4 text-danger" />} title={t("ui.listen_while_you_sing")}>{t("ui.add_youtube_link")}</Callout>
        )}
        <Card>
          <CardBody className="pt-4">
            <p className="mb-3 text-sm font-semibold">{t("sheet.chordsInSong")} {capo > 0 && <span className="font-normal text-muted">(capo {capo})</span>}</p>
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

/** Level → meter percentage on a dB scale (−60 dB … 0 dB), so quiet voices still move the bar. */
function meter(level: number) {
  if (level <= 0) return 0;
  return Math.max(0, Math.min(100, ((20 * Math.log10(level) + 60) / 60) * 100));
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
  const t = useT();
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
      <p className="font-semibold">{t("sheet.noLyrics")}</p>
      <ol className="mt-1 list-inside list-decimal text-sm text-muted">
        <li>{t(findHref ? "ui.open_lyrics_page_btn" : "ui.open_lyrics_page")}</li>
        <li>{t("ui.press_paste_from_clipboard_or_paste_into_the_box")}</li>
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        {findHref && (
          <a href={findHref} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2">
            {t("ui.find_on_ultimate_guitar")}
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
          {t("sheet.pasteClipboard")}
        </Button>
      </div>
      <textarea
        aria-label={t("ui.paste_lyrics_with_chords")}
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
        placeholder={t("ui.or_click_here_and_press_ctrl_v_v")}
        className="mt-3 w-full rounded-xl border border-border bg-surface p-3 font-mono text-sm focus:border-accent focus:outline-none"
        data-testid="inline-paste-text"
      />
      {text.trim() && (
        <Button size="sm" className="mt-2" onClick={() => void save(text)} loading={busy}>
          {t("sheet.addLyrics")}
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
  const t = useT();
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
        <span className="ml-2 text-[0.6em] text-muted">{t("ui.instrumental")}</span>
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
