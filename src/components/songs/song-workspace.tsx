"use client";
import { useT, useTx } from "@/lib/i18n";

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
import { SongChangeDrill, SongMasteryCard } from "./song-mastery";
import { SongStatusChip } from "./song-status-chip";
import { songStatus } from "@/lib/songs/status";

const SOURCE_TONE = { "public-domain": "theory", original: "accent", user: "piano", "chord-chart": "guitar" } as const;
const SOURCE_LABEL = { "public-domain": "Public domain", original: "Original practice piece", user: "User-provided", "chord-chart": "Bollywood chord chart" } as const;

export function SongWorkspace({ song }: { song: Song }) {
  const tr = useT();
  const tx = useTx();
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
        <ChevronLeft className="h-4 w-4" /> {tr("common.allSongs")}
      </Link>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge tone={SOURCE_TONE[song.source]}>{tx(SOURCE_LABEL[song.source])}</Badge>
            <Badge>{tr("ui.difficulty_cap_n5", { n: song.difficulty })}</Badge>
            <Badge>{tr("ui.key_x", { k: song.key })}</Badge>
            <Badge>{song.tempo} BPM{song.practiceTempo ? " (practice)" : ""} · {song.beatsPerBar}/4</Badge>
            <SongStatusChip status={songStatus(song, progress.data)} />
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
            label={tr("ui.instrument")}
            value={instrument}
            onChange={(v) => setPrefs({ instrument: v })}
            options={[
              { value: "guitar", label: tr("shell.guitar"), icon: <Guitar className="h-4 w-4" /> },
              { value: "piano", label: tr("shell.piano"), icon: <Piano className="h-4 w-4" /> },
            ]}
          />
          <Button variant={saved ? "secondary" : "outline"} onClick={() => void songRepo.upsert(song.id, instrument, (p) => ({ ...p, saved: !p.saved }))} aria-pressed={saved}>
            {saved ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4" />} {saved ? tr("ui.saved") : tr("ui.save_song")}
          </Button>
        </div>
      </header>

      <p className="max-w-3xl text-muted">{song.intro}</p>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {/* Player */}
          <Card>
            <CardHeader title={tr("ui.practice_player")} description={tr("ui.playing_at", { bpm, pct: tempoPct, tempo: song.tempo })} />
            <CardBody className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" onClick={() => { ping(); player.toggle(); }} data-testid="song-play">
                  {player.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />} {player.playing ? "Stop" : "Play"}
                </Button>
                <Select aria-label={tr("ui.section_to_practise")} value={sectionId ?? ""} onChange={(e) => setSectionId(e.target.value || null)}>
                  <option value="">{tr("ui.whole_song")}</option>
                  {song.sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
                <Button variant={loop ? "secondary" : "ghost"} onClick={() => setLoop(!loop)} aria-pressed={loop}>
                  <Repeat className="h-4 w-4" /> {tr(loop ? "ui.loop_on" : "ui.loop_off")}
                </Button>
                {player.passes > 0 && <Badge tone="success">{player.passes} loop{player.passes > 1 ? "s" : ""} played</Badge>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Slider label={tr("ui.speed")} value={tempoPct} min={40} max={100} step={5} onChange={setTempoPct} format={(v) => `${v}% · ${Math.max(40, Math.round((song.tempo * v) / 100))} BPM`} />
                <div className="grid grid-cols-2 gap-3">
                  {hasMelody && <Switch label={tr("ui.melody")} checked={melodyOn} onChange={setMelodyOn} />}
                  <Switch label={tr("ui.chords")} checked={chordsOn} onChange={setChordsOn} />
                  <Switch label={tr("ui.click")} checked={click} onChange={setClick} />
                </div>
              </div>

              {/* Now / next */}
              <div className="grid grid-cols-2 gap-3">
                <div className={cn("rounded-xl border p-4 text-center", player.playing ? "border-accent bg-accent-soft" : "border-border bg-surface-2")}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">{tr("ui.now")}</p>
                  <p className="text-3xl font-semibold" aria-live="polite">{current?.chord ?? "—"}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-2 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">{tr("common.next")}</p>
                  <p className="text-3xl font-semibold text-muted">{next?.chord ?? "—"}</p>
                </div>
              </div>

              <ChordChart chords={timeline.chords} songKey={currentKey} beatsPerBar={song.beatsPerBar} current={current} onSeek={(c) => playChord(c.chord)} />
              <p className="text-xs text-muted">{tr("ui.tap_any_chord_in_the_chart_to_hear_it_roman_nume")}</p>
            </CardBody>
          </Card>

          {/* Play along */}
          <Card>
            <CardHeader title={tr("ui.play_along")} description={tr("ui.your_notes_are_checked_against_the_song_measured")} />
            <CardBody>
              <PlayAlong songId={song.id} timeline={timeline} instrument={instrument} playing={player.playing} beat={player.beat} beatNow={player.beatNow} onPing={ping} />
            </CardBody>
          </Card>
        </div>

        <aside className="min-w-0 space-y-6">
          {/* Chords */}
          <Card>
            <CardHeader title={instrument === "guitar" ? tr("ui.chord_shapes") : tr("ui.chords")} description={instrument === "guitar" ? tr("ui.click_a_diagram_to_hear_it") : tr("ui.tap_to_hear_each_chord")} />
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
                  <Segmented<PianoPattern> label={tr("ui.accompaniment_pattern")} value={pianoPattern} onChange={setPianoPattern} size="sm" options={[{ value: "block", label: tr("ui.block") }, { value: "broken", label: tr("ui.broken") }, { value: "alberti", label: tr("ui.alberti") }]} />
                  <p className="text-muted">
                    {pianoPattern === "block" ? tr("ui.all_chord_notes_together_the_easiest_way_to_star") : pianoPattern === "broken" ? tr("ui.chord_notes_one_after_another_rising_and_falling") : tr("ui.low_high_middle_high_the_classical_alberti_bass")}
                  </p>
                  <p className="text-muted">{song.pianoTip}</p>
                </>
              )}
            </CardBody>
          </Card>

          {/* Difficulty */}
          <Card>
            <CardHeader title={tr("ui.make_it_easier")} icon={<Sparkles className="h-4 w-4" />} />
            <CardBody className="space-y-4">
              <Switch label={tr("ui.simplify_chords")} description={tr("ui.turns_7ths_and_extended_chords_into_plain_triads")} checked={simplify} onChange={setSimplify} />
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="transpose">{tr("ui.change_key")}</label>
                <Select id="transpose" value={transpose} onChange={(e) => setTranspose(Number(e.target.value))} className="w-full">
                  {Array.from({ length: 13 }, (_, i) => i - 6).map((t) => (
                    <option key={t} value={t}>{t === 0 ? tr("ui.original_key_x", { k: song.key }) : tr("ui.semis_arrow", { n: `${t > 0 ? "+" : ""}${t}`, k: transposeKey(song.key, t) })}</option>
                  ))}
                </Select>
                <p className="text-xs text-muted">{tr("ui.changing_key_moves_everything_higher_or_lower_it")}</p>
                {instrument === "guitar" && easiestKey && easiestKey.targetKey !== currentKey && (
                  <Button size="sm" variant="ghost" onClick={() => setTranspose(easiestKey.semitones)}>{tr("ui.try_easiest_key", { k: easiestKey.targetKey, chords: easiestKey.chords.slice(0, 4).join(" ") })}</Button>
                )}
              </div>
              {instrument === "guitar" && (
                <div className="border-t border-border pt-4">
                  <p className="mb-2 text-sm font-medium">{tr("ui.capo_helper_keeps_the_key")}</p>
                  <CapoHelper chords={chordsInUse} songKey={currentKey} preferCapo={transpose === 0 ? song.sourceCapo : undefined} />
                </div>
              )}
            </CardBody>
          </Card>

          {/* Prerequisites & progress */}
          <Card>
            <CardHeader title={tr("ui.before_you_start")} />
            <CardBody className="space-y-2 text-sm">
              {prereqs.length === 0 && <p className="text-muted">{tr("ui.no_specific_prerequisites")}</p>}
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

          <SongMasteryCard song={song} instrument={instrument} progress={progress.data} />
          <SongChangeDrill song={song} instrument={instrument} progress={progress.data} />
          <Card>
            <CardHeader title={tr("progress.title")} action={<SourceTag source="measured" />} />
            <CardBody className="space-y-1.5 text-sm">
              {progress.loading ? (
                <p className="text-muted">{tr("common.loading")}</p>
              ) : progress.data ? (
                <>
                  <p>{tr("ui.practised")} <strong>{progress.data.minutes} min</strong></p>
                  <p>{tr("ui.best_full_pass")} <strong>{progress.data.bestTempo ? `${progress.data.bestTempo} BPM` : "—"}</strong></p>
                  <p>{tr("ui.sections_completed")} <strong>{progress.data.sectionsPracticed.length ? progress.data.sectionsPracticed.map((id) => (id === "full" ? tr("ui.whole_song") : song.sections.find((s) => s.id === id)?.name ?? id)).join(", ") : "—"}</strong></p>
                </>
              ) : (
                <p className="text-muted">{tr(instrument === "guitar" ? "ui.play_section_track_guitar" : "ui.play_section_track_piano")}</p>
              )}
            </CardBody>
          </Card>
          {song.source === "chord-chart" && (
            <Link href={`/songs/sheet?new=1&chart=${song.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent-soft p-4 hover:border-accent" data-testid="sing-along">
              <span>
                <span className="block font-semibold text-accent">{tr("ui.sing_along_with_lyrics")}</span>
                <span className="text-sm text-muted">{tr("ui.paste_the_lyrics_under_these_chords_and_the_shee")}</span>
              </span>
              <span className="shrink-0 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-fg">{tr("ui.add_lyrics")}</span>
            </Link>
          )}
          {song.source === "chord-chart" && (
            <a href={ultimateGuitarSearch(song.title)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text" data-testid="find-ug">
              {tr("ui.find_this_song_on_ultimate_guitar")}
            </a>
          )}
          {song.source === "chord-chart" && (
            <Callout tone="info" title={tr("ui.about_this_chord_chart")}>
              <p>
                {tr("ui.chart_about_1", { n: song.sources?.length ?? 0 })}
                {song.timingApproximate && ` ${tr("ui.chart_about_2")}`}
                {song.sourceCapo ? ` ${tr("ui.chart_about_3", { n: song.sourceCapo })}` : ""}
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
          {song.source === "user" && <Callout tone="info" title={tr("ui.user_provided_chords")}>{tr("ui.these_chords_were_entered_by_you_and_haven_t_bee")}</Callout>}
        </aside>
      </div>
    </div>
  );
}
