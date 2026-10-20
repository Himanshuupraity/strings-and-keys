"use client";
import { useT } from "@/lib/i18n";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table2, BarChart3 } from "lucide-react";
import { cn } from "@/components/ui";

export interface WeeklyRow {
  day: string;
  label: string;
  guitar: number;
  piano: number;
}

const SERIES = [
  { key: "guitar", name: "Guitar", color: "var(--chart-guitar)" },
  { key: "piano", name: "Piano", color: "var(--chart-piano)" },
] as const;

/** Minutes to one decimal place (3.6999… → 3.7). */
const mins = (v: number) => Math.round(v * 10) / 10;

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  const tl = useT();
  if (!active || !payload?.length) return null;
  const total = payload.reduce((a, p) => a + (p.value || 0), 0);
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-card">
      <p className="mb-1 font-semibold">{label}</p>
      {SERIES.map((s) => {
        const v = payload.find((p) => p.dataKey === s.key)?.value ?? 0;
        return (
          <p key={s.key} className="flex items-center gap-2 text-muted">
            <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
            {s.name}: <span className="font-medium text-text tabular-nums">{mins(v)} min</span>
          </p>
        );
      })}
      <p className="mt-1 border-t border-border pt-1 text-muted">{tl("ui.total")} <span className="font-medium text-text">{mins(total)} min</span></p>
    </div>
  );
}

/** Stacked weekly practice minutes, guitar vs piano, with a table view for accessibility. */
export function WeeklyChart({ data, height = 220 }: { data: WeeklyRow[]; height?: number }) {
  const tl = useT();
  const [table, setTable] = useState(false);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-xs text-muted" aria-hidden={table}>
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} /> {s.name}
            </span>
          ))}
        </div>
        <button type="button" onClick={() => setTable((t) => !t)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-2" aria-pressed={table}>
          {table ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />} {table ? "Chart" : "Table"}
        </button>
      </div>
      {table ? (
        <table className="w-full text-sm">
          <caption className="sr-only">{tl("ui.practice_minutes_per_day_last_7_days")}</caption>
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 font-medium">{tl("ui.day")}</th>
              <th className="py-1 text-right font-medium">{tl("shell.guitar")}</th>
              <th className="py-1 text-right font-medium">{tl("shell.piano")}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.day} className="border-t border-border">
                <td className="py-1">{r.label}</td>
                <td className="py-1 text-right tabular-nums">{mins(r.guitar)} min</td>
                <td className="py-1 text-right tabular-nums">{mins(r.piano)} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className={cn("w-full")} style={{ height }} role="img" aria-label={`Practice minutes for the last 7 days: ${data.map((r) => `${r.label} ${mins(r.guitar + r.piano)} minutes`).join(", ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} width={44} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-2)" }} />
              <Bar dataKey="guitar" stackId="m" fill="var(--chart-guitar)" stroke="var(--surface)" strokeWidth={2} name={tl("shell.guitar")} />
              <Bar dataKey="piano" stackId="m" fill="var(--chart-piano)" stroke="var(--surface)" strokeWidth={2} radius={[4, 4, 0, 0]} name={tl("shell.piano")} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
