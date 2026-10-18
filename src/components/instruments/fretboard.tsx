"use client";

import { useMemo } from "react";
import { DOUBLE_INLAY_FRETS, INLAY_FRETS, STANDARD_TUNING, stringNumber } from "@/lib/music/guitar";
import { midiToName, mod12, pcName } from "@/lib/music/notes";
import { labelNote, type LabelMode } from "@/lib/music/sargam";
import { playGuitarNote } from "@/lib/audio/engine";
import { usePrefs } from "@/hooks/use-prefs";
import { cn } from "@/components/ui";

export type FretTone = "target" | "correct" | "wrong" | "root" | "scale" | "chord" | "hint";

export interface FretMark {
  string: number;
  fret: number;
  tone?: FretTone;
  label?: string;
  finger?: number;
}

export interface FretboardProps {
  frets?: number;
  capo?: number;
  tuning?: number[];
  marks?: FretMark[];
  /** Highlight every position of these pitch classes (e.g. a scale). */
  highlightPitchClasses?: number[];
  rootPc?: number;
  /** Show the note name on every position. */
  showAllNotes?: boolean;
  /** Strings to draw as "muted" (x) at the nut. */
  mutedStrings?: number[];
  onPlay?: (pos: { string: number; fret: number; midi: number }) => void;
  playSound?: boolean;
  labelMode?: LabelMode;
  leftHanded?: boolean;
  className?: string;
  ariaLabel?: string;
  /** Visually emphasise one string (e.g. "play the high E string"). */
  activeString?: number;
}

const TONE_FILL: Record<FretTone, string> = {
  target: "var(--accent)",
  correct: "var(--success)",
  wrong: "var(--danger)",
  root: "var(--accent)",
  scale: "var(--piano)",
  chord: "var(--theory)",
  hint: "var(--subtle)",
};

/**
 * Horizontal fretboard: high E string on top (like tablature), nut on the left
 * (right in left-handed mode). Every position is a focusable button that plays its note.
 */
export function Fretboard({
  frets: fretsProp,
  capo = 0,
  tuning = STANDARD_TUNING,
  marks = [],
  highlightPitchClasses,
  rootPc,
  showAllNotes = false,
  mutedStrings = [],
  onPlay,
  playSound = true,
  labelMode,
  leftHanded: lhProp,
  className,
  ariaLabel = "Guitar fretboard",
  activeString,
}: FretboardProps) {
  const [prefs] = usePrefs();
  const frets = fretsProp ?? prefs.fretCount;
  const leftHanded = lhProp ?? prefs.leftHanded;
  const mode = labelMode ?? prefs.labelMode;

  // Geometry (SVG user units). Fret widths taper gently, like a real neck, but stay tappable.
  const openW = 46;
  const widths = useMemo(() => Array.from({ length: frets }, (_, i) => 74 * Math.pow(0.972, i)), [frets]);
  const xs = useMemo(() => {
    const out = [openW];
    widths.forEach((w) => out.push(out[out.length - 1] + w));
    return out;
  }, [widths]);
  const W = xs[xs.length - 1] + 12;
  const top = 26;
  const gap = 30;
  const H = top + gap * 5 + 34;
  const yOf = (s: number) => top + (5 - s) * gap; // string 5 (high E) at top
  const cx = (f: number) => (f === 0 ? openW / 2 : (xs[f - 1] + xs[f]) / 2);
  const flipX = (x: number) => (leftHanded ? W - x : x);

  const markMap = new Map(marks.map((m) => [`${m.string}:${m.fret}`, m]));
  const pcs = highlightPitchClasses ? new Set(highlightPitchClasses.map(mod12)) : null;

  const play = (s: number, f: number) => {
    const fret = f === 0 ? capo : f;
    if (fret < capo) return;
    const midi = tuning[s] + fret;
    if (playSound) void playGuitarNote(midi);
    onPlay?.({ string: s, fret: f, midi });
  };

  const labelFor = (midi: number) => {
    const l = labelNote(midi, { mode, tonicPc: prefs.tonicPc, spelling: prefs.spelling });
    return mode === "western" ? l.western : mode === "sargam" ? l.swara.compact : `${l.western}·${l.swara.compact}`;
  };

  return (
    <div className={cn("scrollbar-thin overflow-x-auto rounded-2xl border border-border bg-surface-2 p-2 shadow-card", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={ariaLabel} className="block h-auto min-w-[720px] w-full select-none" style={{ touchAction: "manipulation" }}>
        <defs>
          <linearGradient id="fb-wood" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--fret-wood)" />
            <stop offset="1" stopColor="var(--fret-wood-2)" />
          </linearGradient>
        </defs>
        {/* Neck */}
        <rect x={flipX(leftHanded ? xs[xs.length - 1] : openW)} y={top - 12} width={xs[xs.length - 1] - openW} height={gap * 5 + 24} rx={4} fill="url(#fb-wood)" />
        {/* Inlays */}
        {INLAY_FRETS.filter((f) => f <= frets).map((f) =>
          DOUBLE_INLAY_FRETS.includes(f) ? (
            <g key={f}>
              <circle cx={flipX(cx(f))} cy={top + gap * 1.5} r={5} fill="var(--inlay)" opacity={0.7} />
              <circle cx={flipX(cx(f))} cy={top + gap * 3.5} r={5} fill="var(--inlay)" opacity={0.7} />
            </g>
          ) : (
            <circle key={f} cx={flipX(cx(f))} cy={top + gap * 2.5} r={5} fill="var(--inlay)" opacity={0.7} />
          ),
        )}
        {/* Nut and frets */}
        <rect x={flipX(openW) - (leftHanded ? 0 : 5)} y={top - 12} width={5} height={gap * 5 + 24} fill="var(--inlay)" />
        {xs.slice(1).map((x, i) => (
          <rect key={i} x={flipX(x) - 1.5} y={top - 12} width={3} height={gap * 5 + 24} fill="var(--fret-wire)" />
        ))}
        {/* Fret numbers */}
        {Array.from({ length: frets }, (_, i) => i + 1).map((f) => (
          <text key={f} x={flipX(cx(f))} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)" className={cn(INLAY_FRETS.includes(f) && "font-semibold")}>
            {f}
          </text>
        ))}
        {/* Strings */}
        {tuning.map((open, s) => (
          <g key={s}>
            <line
              x1={flipX(openW)}
              x2={flipX(xs[xs.length - 1])}
              y1={yOf(s)}
              y2={yOf(s)}
              stroke={activeString === s ? "var(--accent)" : "var(--string)"}
              strokeWidth={activeString === s ? 3.5 : 1 + (5 - s) * 0.35}
            />
            <text x={flipX(12)} y={yOf(s) + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill={activeString === s ? "var(--accent)" : "var(--muted)"}>
              {mutedStrings.includes(s) ? "×" : pcName(open + capo, prefs.spelling)}
            </text>
            <text x={flipX(31)} y={yOf(s) + 4} textAnchor="middle" fontSize={9} fill="var(--subtle)">
              {stringNumber(s)}
            </text>
          </g>
        ))}
        {/* Capo */}
        {capo > 0 && capo <= frets && (
          <g aria-label={`Capo on fret ${capo}`}>
            <rect x={flipX(xs[capo - 1] + (xs[capo] - xs[capo - 1]) * 0.55) - 7} y={top - 16} width={14} height={gap * 5 + 32} rx={6} fill="var(--text)" opacity={0.85} />
          </g>
        )}
        {/* Positions */}
        {tuning.map((open, s) =>
          Array.from({ length: frets + 1 }, (_, f) => {
            const blocked = f > 0 && f < capo;
            const soundingFret = f === 0 ? capo : f;
            const midi = open + soundingFret;
            const mark = markMap.get(`${s}:${f}`);
            const inSet = pcs?.has(mod12(midi));
            const isRoot = rootPc !== undefined && mod12(midi) === mod12(rootPc) && inSet;
            const tone: FretTone | undefined = mark?.tone ?? (isRoot ? "root" : inSet ? "scale" : undefined);
            const show = !!mark || !!inSet || showAllNotes;
            const x = flipX(cx(f));
            const y = yOf(s);
            const fill = tone ? TONE_FILL[tone] : "var(--surface)";
            const label = mark?.finger !== undefined ? String(mark.finger) : mark?.label ?? labelFor(midi);
            return (
              <g
                key={`${s}-${f}`}
                role="button"
                tabIndex={blocked ? -1 : 0}
                aria-disabled={blocked || undefined}
                aria-label={`String ${stringNumber(s)}, ${f === 0 ? (capo ? "open at capo" : "open") : `fret ${f}`}: ${midiToName(midi, prefs.spelling)}`}
                data-string={s}
                data-fret={f}
                data-midi={midi}
                className={cn("cursor-pointer outline-none [&:focus-visible>circle]:stroke-[var(--ring)] [&:focus-visible>circle]:stroke-[3]", blocked && "cursor-not-allowed opacity-30")}
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (!blocked) play(s, f);
                }}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !blocked) {
                    e.preventDefault();
                    play(s, f);
                  }
                }}
              >
                <rect x={x - (f === 0 ? openW / 2 : widths[f - 1] / 2)} y={y - gap / 2} width={f === 0 ? openW : widths[f - 1]} height={gap} fill="transparent" />
                {show && (
                  <>
                    <circle cx={x} cy={y} r={11.5} fill={fill} stroke={tone ? "none" : "var(--border-strong)"} opacity={tone ? 1 : 0.92} />
                    <text x={x} y={y + 3.8} textAnchor="middle" fontSize={label.length > 3 ? 7.5 : 10} fontWeight={600} fill={tone ? "#fff" : "var(--text)"} pointerEvents="none">
                      {label}
                    </text>
                  </>
                )}
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}
