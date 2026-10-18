import { identifyChord } from "@/lib/music/chords";
import type { ChromaFrame } from "@/lib/audio/microphone";

/**
 * Average several chroma frames captured while the student strums, so one noisy frame can't decide
 * the result. Returns null when there wasn't enough usable signal.
 */
export function summarizeChroma(frames: ChromaFrame[], minFrames = 5) {
  const usable = frames.filter((f) => f.best && f.level > 0.02);
  if (usable.length < minFrames) return null;
  const sum = Array(12).fill(0) as number[];
  for (const f of usable) f.chroma.forEach((v, i) => (sum[i] += v));
  const max = Math.max(...sum);
  const chroma = sum.map((v) => (max ? v / max : 0));
  const pcs = chroma.map((v, pc) => [v, pc] as const).filter(([v]) => v > 0.45).map(([, pc]) => pc);
  const confidence = usable.reduce((a, f) => a + f.confidence, 0) / usable.length;
  const best = identifyChord(pcs)[0] ?? null;
  return { chroma, pcs, confidence, best, frames: usable.length };
}
