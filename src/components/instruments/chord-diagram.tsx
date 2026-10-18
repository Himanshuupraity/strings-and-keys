"use client";

import { easiestShape, shapeMidi, type GuitarShape } from "@/lib/music/chords";
import { strum } from "@/lib/audio/engine";
import { cn } from "@/components/ui";

/**
 * Vertical chord box: strings low E (left) → high E (right), nut at the top.
 * Shows finger numbers, open (○) and muted (×) strings, barres and the starting fret.
 */
export function ChordDiagram({
  chord,
  shape: shapeProp,
  capo = 0,
  title,
  subtitle,
  size = "md",
  playable = true,
  className,
  highlight,
}: {
  chord?: string;
  shape?: GuitarShape;
  capo?: number;
  title?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
  playable?: boolean;
  className?: string;
  highlight?: boolean;
}) {
  const shape = shapeProp ?? (chord ? easiestShape(chord) : undefined);
  const scale = size === "sm" ? 0.75 : size === "lg" ? 1.25 : 1;
  const name = title ?? shape?.chord ?? chord ?? "";

  if (!shape) {
    return (
      <div className={cn("flex w-32 flex-col items-center rounded-xl border border-dashed border-border-strong p-3 text-center text-xs text-muted", className)}>
        <span className="text-base font-semibold text-text">{name}</span>
        No diagram available
      </div>
    );
  }

  const fretted = shape.frets.filter((f) => f > 0);
  const maxF = fretted.length ? Math.max(...fretted) : 1;
  const minF = fretted.length ? Math.min(...fretted) : 1;
  const startFret = maxF <= 4 ? 1 : minF;
  const rows = Math.max(4, maxF - startFret + 1);
  const sx = 18;
  const fy = 22;
  const left = 22;
  const topY = 30;
  const W = left + sx * 5 + 22;
  const H = topY + fy * rows + 14;
  const xOf = (s: number) => left + s * sx;
  const yOf = (f: number) => topY + (f - startFret + 0.5) * fy;

  const label = `${name} chord: ${shape.frets.map((f, i) => `string ${6 - i} ${f < 0 ? "muted" : f === 0 ? "open" : "fret " + f}${shape.fingers[i] > 0 ? " finger " + shape.fingers[i] : ""}`).join(", ")}${capo ? `, with capo on fret ${capo}` : ""}`;

  const content = (
    <svg viewBox={`0 0 ${W} ${H}`} width={W * scale} height={H * scale} role="img" aria-label={label}>
      {/* Nut or start fret */}
      {startFret === 1 ? <rect x={xOf(0) - 1} y={topY - 4} width={sx * 5 + 2} height={4} fill="var(--text)" /> : <text x={xOf(0) - 8} y={yOf(startFret) + 4} fontSize={10} textAnchor="end" fill="var(--muted)">{startFret}fr</text>}
      {Array.from({ length: rows + 1 }, (_, i) => (
        <line key={i} x1={xOf(0)} x2={xOf(5)} y1={topY + i * fy} y2={topY + i * fy} stroke="var(--border-strong)" strokeWidth={1} />
      ))}
      {Array.from({ length: 6 }, (_, s) => (
        <line key={s} x1={xOf(s)} x2={xOf(s)} y1={topY} y2={topY + rows * fy} stroke="var(--muted)" strokeWidth={1 + (5 - s) * 0.18} />
      ))}
      {/* Open / muted markers */}
      {shape.frets.map((f, s) =>
        f < 0 ? (
          <text key={s} x={xOf(s)} y={topY - 10} fontSize={12} textAnchor="middle" fill="var(--danger)" fontWeight={700}>×</text>
        ) : f === 0 ? (
          <circle key={s} cx={xOf(s)} cy={topY - 14} r={4.5} fill="none" stroke="var(--text)" strokeWidth={1.4} />
        ) : null,
      )}
      {/* Barre */}
      {shape.barre && (
        <rect x={xOf(shape.barre.fromString) - 8} y={yOf(shape.barre.fret) - 8} width={xOf(shape.barre.toString) - xOf(shape.barre.fromString) + 16} height={16} rx={8} fill="var(--accent)" opacity={0.9} />
      )}
      {/* Dots */}
      {shape.frets.map((f, s) => {
        if (f <= 0) return null;
        const onBarre = shape.barre && f === shape.barre.fret && s >= shape.barre.fromString && s <= shape.barre.toString && shape.fingers[s] === 1;
        return (
          <g key={s}>
            {!onBarre && <circle cx={xOf(s)} cy={yOf(f)} r={7.5} fill="var(--accent)" />}
            {shape.fingers[s] > 0 && (!onBarre || s === shape.barre!.toString) && (
              <text x={xOf(s)} y={yOf(f) + 3.5} fontSize={9.5} textAnchor="middle" fill="var(--accent-fg)" fontWeight={700}>
                {shape.fingers[s]}
              </text>
            )}
          </g>
        );
      })}
      {/* String names under the box */}
      {["E", "A", "D", "G", "B", "e"].map((n, s) => (
        <text key={n + s} x={xOf(s)} y={H - 2} fontSize={8} textAnchor="middle" fill="var(--subtle)">{n}</text>
      ))}
    </svg>
  );

  return (
    <div className={cn("inline-flex flex-col items-center rounded-xl border bg-surface p-2 transition-colors", highlight ? "border-accent ring-2 ring-accent/40" : "border-border", className)}>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("font-semibold", size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg")}>{name}</span>
        {capo > 0 && <span className="text-[11px] text-muted">capo {capo}</span>}
      </div>
      {subtitle && <span className="text-[11px] text-muted">{subtitle}</span>}
      {playable ? (
        <button type="button" className="rounded-lg hover:bg-surface-2" onClick={() => void strum(shapeMidi(shape, capo))} aria-label={`Play ${name}${capo ? ` with capo ${capo}` : ""}`} title="Click to hear it">
          {content}
        </button>
      ) : (
        content
      )}
    </div>
  );
}
