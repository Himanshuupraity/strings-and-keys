"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, BookmarkCheck, ChevronLeft, Guitar, Pause, Piano, Play, Repeat, Sparkles } from "lucide-react";
import { ChordDiagram } from "@/components/instruments/chord-diagram";
import { Badge, Button, Callout, Card, CardBody, CardHeader, Segmented, Select, Slider, SourceTag, Switch, cn } from "@/components/ui";
import { usePrefs } from "@/hooks/use-prefs";
import { useData } from "@/hooks/use-data";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { songRepo } from "@/lib/storage/repositories";
import { keyChangeOptions, transposeKey } from "@/lib/music/transpose";
import { playPianoChord, strum } from "@/lib/audio/engine";
import { chordDifficulty, chordMidi, easiestShape, shapeMidi } from "@/lib/music/chords";
import { getLesson } from "@/content/curriculum";
import { songChords } from "@/content/songs/parse";
import type { Song } from "@/content/songs/types";
import { adaptChord, buildTimeline, chordAt, type PianoPattern } from "./playback";
import { useSongPlayer } from "./use-song-player";
import { ChordChart } from "./chord-chart";
import { CapoHelper } from "./capo-helper";
import { ultimateGuitarSearch } from "@/content/songs/catalogue";
import { PlayAlong } from "./play-along";

const SOURCE_TONE = { "public-domain": "theory", original: "accent", user: "piano", "chord-chart": "guitar" } as const;
const SOURCE_LABEL = { "public-domain": "Public domain", original: "Original practice piece", user: "User-provided", "chord-chart": "Bollywood chord chart" } as const;

export function SongWorkspace({ song }: { song: Song }) {
  const [prefs, setPrefs] = usePrefs();
  const instrument = prefs.instrument;
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [tempoPct, setTempoPct] = useState(70);
  const [transpose, setTranspose] = useState(0);
  const [simplify, setSimplify] = useState(false);
  const [loop, setLoop] = useState(true);
  const [melodyOn, setMelodyOn] = useState(true);
  const [chordsOn, setChordsOn] = useState(true);
  const [click, setClick] = useState(true);
  const [pianoPattern, setPianoPattern] = useState<PianoPattern>("block");
  const hasMelody = song.sections.some((s) => s.melody);

  const timeline = useMemo(() => buildTimeline(song, { transpose, simplify, sectionId }), [song, transpose, simplify, sectionId]);
  const currentKey = transpose ? transposeKey(song.key, transpose) : song.key;
  const bpm = Math.max(40, Math.round((song.tempo * tempoPct) / 100));

  const progress = useData(() => songRepo.get(song.id, instrument), ["songProgress"], undefined);
  const { ping } = usePracticeLog(`song:${song.id}`);
  const playStart = useRef<number | null>(null);

  const recordPass = (passBpm: number) => {
    void songRepo.upsert(song.id, instrument, (p) => ({
      ...p,
      sectionsPracticed: Array.from(new Set([...p.sectionsPracticed, sectionId ?? "full"])),
      bestTempo: Math.max(p.bestTempo ?? 0, passBpm),
      lastPracticed: new Date().toISOString(),
    }));
  };

  const player = useSongPlayer(timeline, song.beatsPerBar, { bpm, loop, melody: melodyOn && hasMelody, chords: chordsOn, click, instrument, pianoPattern, strumPattern: song.strum.pattern }, { onPass: recordPass, onTick: ping });

  // Track minutes played (only while playback runs).
  useEffect(() => {
    if (player.playing) {
      playStart.current = Date.now();
      return;
    }
    if (playStart.current) {
      const mins = (Date.now() - playStart.current) / 60000;
      playStart.current = null;
      if (mins > 0.05) void songRepo.upsert(song.id, instrument, (p) => ({ ...p, minutes: Math.round((p.minutes + mins) * 10) / 10, lastPracticed: new Date().toISOString() }));
    }
  }, [player.playing, song.id, instrument]);

  const { current, next } = player.beat !== null ? chordAt(timeline, Math.max(0, player.beat)) : { current: undefined, next: timeline.chords[0] };
  const chordsInUse = useMemo(() => Array.from(new Set(songChords(song).map((c) => adaptChord(c, song, { transpose, simplify })))), [song, transpose, simplify]);
  const easiestKey = useMemo(() => {
    if (song.key.endsWith("m")) return null;
    const chords = songChords(song);
    const best = keyChangeOptions(chords, song.key)[0];
    const originalMax = Math.max(...chords.map(chordDifficulty));
    return best && best.maxDifficulty < originalMax ? best : null;
  }, [song]);

  const saved = progress.data?.saved ?? false;
  const prereqs = song.prerequisites.map((p) => ({ ...p, lesson: p.lessonId ? getLesson(p.lessonId) : undefined }));

  const playChord = (c: string) => {
    ping();
    if (instrument === "guitar") {
      const s = easiestShape(c);
      void strum(s ? shapeMidi(s) : chordMidi(c, 3));
    } else void playPianoChord(chordMidi(c, 4));
  };

  return (
    <div className="space-y-6">
      <Link href="/songs" className="-ml-1 inline-flex min-h-10 items-center gap-1 px-1 text-sm text-muted hover:text-text">
        <ChevronLeft className="h-4 w-4" /> All songs
      </Link>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge tone={SOURCE_TONE[song.source]}>{SOURCE_LABEL[song.source]}</Badge>
            <Badge>Difficulty {song.difficulty}/5</Badge>
            <Badge>Key {song.key}</Badge>
            <Badge>{song.tempo} BPM{song.practiceTempo ? " (practice)" : ""} · {song.beatsPerBar}/4</Badge>
          </div>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{song.title}</h1>
          <p className="mt-1 text-muted">{song.artist}</p>
          {(song.film || song.composer) && (
            <p className="mt-0.5 text-sm text-muted">
              {[song.composer && `Music: ${song.composer}`, song.film && `Film: ${song.film}`, song.year].filter(Boolean).join(" · ")}
            </p>
          )}
          {song.styleNote && <p className="mt-1 text-sm font-medium text-accent">{song.styleNote}</p>}
          <p className="mt-1 text-xs text-subtle">{song.licence}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Instrument"
            value={instrument}
            onChange={(v) => setPrefs({ instrument: v })}
            options={[
              { value: "guitar", label: "Guitar", icon: <Guitar className="h-4 w-4" /> },
              { value: "piano", label: "Piano", icon: <Piano className="h-4 w-4" /> },
            ]}
          />
          <Button variant={saved ? "secondary" : "outline"} onClick={() => void songRepo.upsert(song.id, instrument, (p) => ({ ...p, saved: !p.saved }))} aria-pressed={saved}>
            {saved ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4" />} {saved ? "Saved" : "Save song"}
          </Button>
        </div>
      </header>

      <p className="max-w-3xl text-muted">{song.intro}</p>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {/* Player */}
          <Card>
            <CardHeader title="Practice player" description={`Playing at ${bpm} BPM (${tempoPct}% of ${song.tempo}). Start slow — speed comes from accuracy.`} />
            <CardBody className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" onClick={() => { ping(); player.toggle(); }} data-testid="song-play">
                  {player.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />} {player.playing ? "Stop" : "Play"}
                </Button>
                <Select aria-label="Section to practise" value={sectionId ?? ""} onChange={(e) => setSectionId(e.target.value || null)}>
                  <option value="">Whole song</option>
                  {song.sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
                <Button variant={loop ? "secondary" : "ghost"} onClick={() => setLoop(!loop)} aria-pressed={loop}>
                  <Repeat className="h-4 w-4" /> Loop {loop ? "on" : "off"}
                </Button>
                {player.passes > 0 && <Badge tone="success">{player.passes} loop{player.passes > 1 ? "s" : ""} played</Badge>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Slider label="Speed" value={tempoPct} min={40} max={100} step={5} onChange={setTempoPct} format={(v) => `${v}% · ${Math.max(40, Math.round((song.tempo * v) / 100))} BPM`} />
                <div className="grid grid-cols-2 gap-3">
                  {hasMelody && <Switch label="Melody" checked={melodyOn} onChange={setMelodyOn} />}
                  <Switch label="Chords" checked={chordsOn} onChange={setChordsOn} />
                  <Switch label="Click" checked={click} onChange={setClick} />
                </div>
              </div>

              {/* Now / next */}
              <div className="grid grid-cols-2 gap-3">
                <div className={cn("rounded-xl border p-4 text-center", player.playing ? "border-accent bg-accent-soft" : "border-border bg-surface-2")}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Now</p>
                  <p className="text-3xl font-semibold" aria-live="polite">{current?.chord ?? "—"}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-2 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Next</p>
                  <p className="text-3xl font-semibold text-muted">{next?.chord ?? "—"}</p>
                </div>
              </div>

              <ChordChart chords={timeline.chords} songKey={currentKey} beatsPerBar={song.beatsPerBar} current={current} onSeek={(c) => playChord(c.chord)} />
              <p className="text-xs text-muted">Tap any chord in the chart to hear it. Roman numerals show each chord’s role in the key.</p>
            </CardBody>
          </Card>

          {/* Play along */}
          <Card>
            <CardHeader title="Play along" description="Your notes are checked against the song — measured on your input, not guessed." />
            <CardBody>
              <PlayAlong songId={song.id} timeline={timeline} instrument={instrument} playing={player.playing} beat={player.beat} beatNow={player.beatNow} onPing={ping} />
            </CardBody>
          </Card>
        </div>

        <aside className="min-w-0 space-y-6">
          {/* Chords */}
          <Card>
            <CardHeader title={instrument === "guitar" ? "Chord shapes" : "Chords"} description={instrument === "guitar" ? "Click a diagram to hear it." : "Tap to hear each chord."} />
            <CardBody>
              {instrument === "guitar" ? (
                <div className="flex flex-wrap gap-2">
                  {chordsInUse.map((c) => (
                    <ChordDiagram key={c} chord={c} size="sm" highlight={current?.chord === c} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {chordsInUse.map((c) => (
                    <Button key={c} variant={current?.chord === c ? "primary" : "secondary"} size="sm" onClick={() => playChord(c)}>{c}</Button>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Technique */}
          <Card>
            <CardHeader title={instrument === "guitar" ? "Strumming" : "Accompaniment"} />
            <CardBody className="space-y-3 text-sm">
              {instrument === "guitar" ? (
                <>
                  <div className="flex gap-1 font-mono text-lg" aria-label={`Strumming pattern ${song.strum.pattern}`}>
                    {song.strum.pattern.split("").map((s, i) => (
                      <span key={i} className={cn("flex h-9 w-8 items-center justify-center rounded-md", s === "-" ? "text-subtle" : "bg-surface-2 font-semibold")}>{s === "D" ? "↓" : s === "U" ? "↑" : "·"}</span>
                    ))}
                  </div>
                  <p className="text-muted">{song.strum.description}</p>
                </>
              ) : (
                <>
                  <Segmented<PianoPattern> label="Accompaniment pattern" value={pianoPattern} onChange={setPianoPattern} size="sm" options={[{ value: "block", label: "Block" }, { value: "broken", label: "Broken" }, { value: "alberti", label: "Alberti" }]} />
                  <p className="text-muted">
                    {pianoPattern === "block" ? "All chord notes together — the easiest way to start." : pianoPattern === "broken" ? "Chord notes one after another, rising and falling — a flowing ballad sound." : "Low–high–middle–high: the classical Alberti bass."}
                  </p>
                  <p className="text-muted">{song.pianoTip}</p>
                </>
              )}
            </CardBody>
          </Card>

          {/* Difficulty */}
          <Card>
            <CardHeader title="Make it easier" icon={<Sparkles className="h-4 w-4" />} />
            <CardBody className="space-y-4">
              <Switch label="Simplify chords" description="Turns 7ths and extended chords into plain triads (G7 → G)." checked={simplify} onChange={setSimplify} />
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="transpose">Change key</label>
                <Select id="transpose" value={transpose} onChange={(e) => setTranspose(Number(e.target.value))} className="w-full">
                  {Array.from({ length: 13 }, (_, i) => i - 6).map((t) => (
                    <option key={t} value={t}>{t === 0 ? `Original key (${song.key})` : `${t > 0 ? "+" : ""}${t} semitones → ${transposeKey(song.key, t)}`}</option>
                  ))}
                </Select>
                <p className="text-xs text-muted">Changing key moves everything higher or lower — it will no longer match a recording.</p>
                {instrument === "guitar" && easiestKey && easiestKey.targetKey !== currentKey && (
                  <Button size="sm" variant="ghost" onClick={() => setTranspose(easiestKey.semitones)}>Try easiest guitar key: {easiestKey.targetKey} ({easiestKey.chords.slice(0, 4).join(" ")})</Button>
                )}
              </div>
              {instrument === "guitar" && (
                <div className="border-t border-border pt-4">
                  <p className="mb-2 text-sm font-medium">Capo helper (keeps the key)</p>
                  <CapoHelper chords={chordsInUse} songKey={currentKey} preferCapo={transpose === 0 ? song.sourceCapo : undefined} />
                </div>
              )}
            </CardBody>
          </Card>

          {/* Prerequisites & progress */}
          <Card>
            <CardHeader title="Before you start" />
            <CardBody className="space-y-2 text-sm">
              {prereqs.length === 0 && <p className="text-muted">No specific prerequisites.</p>}
              <ul className="space-y-1.5">
                {prereqs.map((p) => (
                  <li key={p.skill}>
                    {p.lesson ? (
                      <Link className="text-accent hover:underline" href={`/lesson/${p.lesson.id}`}>{p.lesson.title.toLowerCase() === p.skill.toLowerCase() ? p.skill : `${p.skill} — ${p.lesson.title}`}</Link>
                    ) : (
                      <span>{p.skill}</span>
                    )}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Your progress" action={<SourceTag source="measured" />} />
            <CardBody className="space-y-1.5 text-sm">
              {progress.loading ? (
                <p className="text-muted">Loading…</p>
              ) : progress.data ? (
                <>
                  <p>Practised: <strong>{progress.data.minutes} min</strong></p>
                  <p>Best full pass: <strong>{progress.data.bestTempo ? `${progress.data.bestTempo} BPM` : "—"}</strong></p>
                  <p>Sections completed: <strong>{progress.data.sectionsPracticed.length ? progress.data.sectionsPracticed.map((id) => (id === "full" ? "Whole song" : song.sections.find((s) => s.id === id)?.name ?? id)).join(", ") : "—"}</strong></p>
                </>
              ) : (
                <p className="text-muted">Play a section all the way through to start tracking your progress on {instrument}.</p>
              )}
            </CardBody>
          </Card>
          {song.source === "chord-chart" && (
            <Link href={`/songs/sheet?new=1&chart=${song.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent-soft p-4 hover:border-accent" data-testid="sing-along">
              <span>
                <span className="block font-semibold text-accent">Sing along with lyrics</span>
                <span className="text-sm text-muted">Paste the lyrics under these chords, and the sheet scrolls as you sing.</span>
              </span>
              <span className="shrink-0 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-fg">Add lyrics</span>
            </Link>
          )}
          {song.source === "chord-chart" && (
            <a href={ultimateGuitarSearch(song.title)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text" data-testid="find-ug">
              Find this song on Ultimate Guitar ↗
            </a>
          )}
          {song.source === "chord-chart" && (
            <Callout tone="info" title="About this chord chart">
              <p>
                Chords only — no lyrics or melody (those are copyrighted). The chord order was cross-checked against {song.sources?.length ?? 0} independent chord sources; it isn&apos;t an official transcription.
                {song.timingApproximate && " How long each chord lasts is approximate, so play along with the original recording and follow the chord changes by ear."}
                {song.sourceCapo ? ` Most guitarists play it with a capo on fret ${song.sourceCapo}.` : ""}
              </p>
              {song.sources && song.sources.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs">
                  {song.sources.map((src) => (
                    <li key={src.url}>
                      <a href={src.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-text">{src.site}</a>
                    </li>
                  ))}
                </ul>
              )}
            </Callout>
          )}
          {song.source === "user" && <Callout tone="info" title="User-provided chords">These chords were entered by you and haven’t been checked against the original recording.</Callout>}
        </aside>
      </div>
    </div>
  );
}
