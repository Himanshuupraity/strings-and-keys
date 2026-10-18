/** Timestamp-based stopwatch state: correct across tab switches, sleeps and throttled timers. */
export interface TimerState {
  status: "idle" | "running" | "paused";
  startedAt: number | null;
  /** ms accumulated before the current running segment */
  accumulated: number;
  runningSince: number | null;
}

export const IDLE_TIMER: TimerState = { status: "idle", startedAt: null, accumulated: 0, runningSince: null };

export function elapsedMs(s: TimerState, now: number): number {
  return s.accumulated + (s.runningSince !== null ? now - s.runningSince : 0);
}
export function startTimer(now: number): TimerState {
  return { status: "running", startedAt: now, accumulated: 0, runningSince: now };
}
export function pauseTimer(s: TimerState, now: number): TimerState {
  if (s.status !== "running") return s;
  return { ...s, status: "paused", accumulated: elapsedMs(s, now), runningSince: null };
}
export function resumeTimer(s: TimerState, now: number): TimerState {
  if (s.status !== "paused") return s;
  return { ...s, status: "running", runningSince: now };
}
export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h ? h + ":" : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
}
