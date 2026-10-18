"use client";

import { needleAngle, classifyCents } from "@/components/practice/logic/tuner";
import { cn } from "@/components/ui";

/** Semicircular cents gauge with a smoothly animated needle. */
export function TunerGauge({ cents, active, className }: { cents: number | null; active: boolean; className?: string }) {
  const angle = cents === null ? 0 : needleAngle(cents);
  const state = cents === null ? null : classifyCents(cents);
  const color = state === "in-tune" ? "var(--success)" : state ? "var(--warn)" : "var(--subtle)";
  const cx = 150;
  const cy = 150;
  const r = 120;
  const pt = (deg: number, rad: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    // Rounded so server and browser produce identical SVG (avoids hydration mismatches).
    return [Math.round((cx + rad * Math.cos(a)) * 100) / 100, Math.round((cy + rad * Math.sin(a)) * 100) / 100];
  };
  const ticks = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];
  const [zx1, zy1] = pt(-6, r);
  const [zx2, zy2] = pt(6, r);
  return (
    <svg viewBox="0 0 300 180" className={cn("w-full max-w-md", className)} role="img" aria-label={cents === null ? "Tuning gauge, no pitch" : `Tuning gauge: ${Math.round(cents)} cents ${state}`}>
      <path d={`M ${pt(-60, r).join(" ")} A ${r} ${r} 0 0 1 ${pt(60, r).join(" ")}`} fill="none" stroke="var(--surface-3)" strokeWidth={14} strokeLinecap="round" />
      <path d={`M ${zx1} ${zy1} A ${r} ${r} 0 0 1 ${zx2} ${zy2}`} fill="none" stroke="var(--success)" strokeWidth={14} opacity={0.6} />
      {ticks.map((t) => {
        const [x1, y1] = pt(needleAngle(t), r - 14);
        const [x2, y2] = pt(needleAngle(t), r - (t % 50 === 0 || t === 0 ? 30 : 22));
        const [lx, ly] = pt(needleAngle(t), r - 42);
        return (
          <g key={t}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeWidth={t === 0 ? 2.5 : 1.2} />
            {(t === -50 || t === 0 || t === 50) && (
              <text x={lx} y={ly + 4} textAnchor="middle" fontSize={11} fill="var(--muted)">
                {t > 0 ? `+${t}` : t}
              </text>
            )}
          </g>
        );
      })}
      <text x={pt(-60, r + 2)[0] - 4} y={170} fontSize={12} fill="var(--muted)" textAnchor="middle">♭ flat</text>
      <text x={pt(60, r + 2)[0] + 4} y={170} fontSize={12} fill="var(--muted)" textAnchor="middle">sharp ♯</text>
      <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: "transform 140ms ease-out" }} opacity={active ? 1 : 0.35}>
        <line x1={cx} y1={cy} x2={cx} y2={cy - r + 8} stroke={color} strokeWidth={4} strokeLinecap="round" />
      </g>
      <circle cx={cx} cy={cy} r={9} fill={color} />
    </svg>
  );
}
