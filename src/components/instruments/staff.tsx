"use client";

import { nameToMidi, parseNote } from "@/lib/music/notes";
import { cn } from "@/components/ui";

/**
 * Lightweight SVG staff (treble or bass clef) for beginner note reading.
 * Supports whole/half/quarter/eighth notes, rests, accidentals, ledger lines and highlighting.
 */
export type Duration = "w" | "h" | "q" | "8";
export interface StaffNote {
  /** e.g. "C4", "F#5", or "rest" */
  note: string;
  duration?: Duration;
  /** Optional label under the note (finger number, lyric syllable, swara). */
  label?: string;
}

const LETTER_STEP: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

/** Diatonic step number: C4 = 28 (7 * 4). */
export function diatonicStep(note: string): number {
  const p = parseNote(note);
  if (!p || p.octave === undefined) throw new Error(`Bad note ${note}`);
  return p.octave * 7 + LETTER_STEP[p.letter];
}

/** Bottom line of each clef: treble E4, bass G2. */
const BOTTOM_LINE: Record<"treble" | "bass", number> = { treble: diatonicStep("E4"), bass: diatonicStep("G2") };

export function Staff({
  clef = "treble",
  notes,
  highlightIndex,
  states,
  timeSignature,
  className,
  onNoteClick,
  ariaLabel,
}: {
  clef?: "treble" | "bass";
  notes: StaffNote[];
  highlightIndex?: number;
  /** Per-note colouring after an exercise */
  states?: ("correct" | "wrong" | undefined)[];
  timeSignature?: [number, number];
  className?: string;
  onNoteClick?: (i: number, midi: number | null) => void;
  ariaLabel?: string;
}) {
  const lineGap = 10;
  const top = 40;
  const startX = timeSignature ? 92 : 70;
  const noteGap = 46;
  const W = startX + Math.max(1, notes.length) * noteGap + 20;
  const H = top + lineGap * 4 + 50;
  const yForStep = (step: number) => top + lineGap * 4 - (step - BOTTOM_LINE[clef]) * (lineGap / 2);

  const label =
    ariaLabel ??
    `${clef} clef staff: ${notes.map((n) => (n.note === "rest" ? `${n.duration ?? "q"} rest` : n.note)).join(", ")}`;

  return (
    <div className={cn("scrollbar-thin overflow-x-auto rounded-2xl border border-border bg-surface p-2", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" style={{ minWidth: Math.min(W, 640) }} role="img" aria-label={label}>
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={8} x2={W - 8} y1={top + i * lineGap} y2={top + i * lineGap} stroke="var(--muted)" strokeWidth={1} />
        ))}
        <line x1={W - 8} x2={W - 8} y1={top} y2={top + 4 * lineGap} stroke="var(--muted)" strokeWidth={2} />
        {/* Clef glyphs (Unicode musical symbols render in most system fonts; text fallback below) */}
        {clef === "treble" ? (
          <text x={14} y={top + 4 * lineGap + 6} fontSize={58} fill="var(--text)" fontFamily="'Noto Music','Bravura','Segoe UI Symbol',serif">𝄞</text>
        ) : (
          <text x={14} y={top + 3 * lineGap + 3} fontSize={40} fill="var(--text)" fontFamily="'Noto Music','Bravura','Segoe UI Symbol',serif">𝄢</text>
        )}
        {timeSignature && (
          <g fontSize={20} fontWeight={700} fill="var(--text)" textAnchor="middle">
            <text x={66} y={top + lineGap * 2 - 2}>{timeSignature[0]}</text>
            <text x={66} y={top + lineGap * 4 - 2}>{timeSignature[1]}</text>
          </g>
        )}
        {notes.map((n, i) => {
          const x = startX + i * noteGap + noteGap / 2;
          const dur = n.duration ?? "q";
          const color = states?.[i] === "correct" ? "var(--success)" : states?.[i] === "wrong" ? "var(--danger)" : i === highlightIndex ? "var(--accent)" : "var(--text)";
          if (n.note === "rest") {
            const y = top + lineGap * 2;
            return (
              <g key={i} fill={color}>
                {dur === "w" && <rect x={x - 7} y={top + lineGap} width={14} height={5} />}
                {dur === "h" && <rect x={x - 7} y={top + lineGap * 2 - 5} width={14} height={5} />}
                {(dur === "q" || dur === "8") && (
                  <text x={x} y={y + 10} fontSize={30} textAnchor="middle" fontFamily="'Noto Music','Bravura','Segoe UI Symbol',serif">
                    {dur === "q" ? "𝄽" : "𝄾"}
                  </text>
                )}
                {n.label && <text x={x} y={H - 6} fontSize={11} textAnchor="middle" fill="var(--muted)">{n.label}</text>}
              </g>
            );
          }
          const p = parseNote(n.note)!;
          const step = diatonicStep(n.note);
          const y = yForStep(step);
          const rel = step - BOTTOM_LINE[clef];
          const ledgers: number[] = [];
          for (let s = -2; s >= rel; s -= 2) ledgers.push(yForStep(BOTTOM_LINE[clef] + s));
          for (let s = 10; s <= rel; s += 2) ledgers.push(yForStep(BOTTOM_LINE[clef] + s));
          const stemUp = rel < 4;
          const filled = dur === "q" || dur === "8";
          const midi = nameToMidi(n.note);
          return (
            <g
              key={i}
              onClick={onNoteClick ? () => onNoteClick(i, midi) : undefined}
              className={onNoteClick ? "cursor-pointer" : undefined}
              data-note={n.note}
            >
              {ledgers.map((ly) => (
                <line key={ly} x1={x - 11} x2={x + 11} y1={ly} y2={ly} stroke="var(--muted)" strokeWidth={1} />
              ))}
              {p.alter !== 0 && (
                <text x={x - 15} y={y + 5} fontSize={16} textAnchor="middle" fill={color}>
                  {p.alter > 0 ? "♯" : "♭"}
                </text>
              )}
              <ellipse cx={x} cy={y} rx={6.5} ry={4.8} transform={`rotate(-20 ${x} ${y})`} fill={filled ? color : "var(--surface)"} stroke={color} strokeWidth={1.8} />
              {dur !== "w" && (
                <line x1={stemUp ? x + 5.8 : x - 5.8} x2={stemUp ? x + 5.8 : x - 5.8} y1={y} y2={stemUp ? y - 32 : y + 32} stroke={color} strokeWidth={1.5} />
              )}
              {dur === "8" && (
                <path d={stemUp ? `M ${x + 5.8} ${y - 32} q 10 8 6 20` : `M ${x - 5.8} ${y + 32} q 10 -8 6 -20`} fill="none" stroke={color} strokeWidth={2} />
              )}
              {n.label && <text x={x} y={H - 6} fontSize={11} textAnchor="middle" fill="var(--muted)">{n.label}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
