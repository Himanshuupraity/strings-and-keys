import type { CuratedVideo, VideoCategory } from "@/content/videos";

/** Lesson topic tags → video categories / topics they relate to. */
const TOPIC_MAP: Record<string, { categories?: VideoCategory[]; topics?: string[] }> = {
  "absolute-beginner": { categories: ["guitar-beginners", "piano-beginners"] },
  "guitar-beginner": { categories: ["guitar-beginners"], topics: ["first-chords"] },
  "piano-beginner": { categories: ["piano-beginners"] },
  "piano-basics": { categories: ["piano-beginners"], topics: ["keyboard"] },
  "music-theory": { categories: ["theory"] },
  "theory-basics": { categories: ["theory"], topics: ["theory-basics", "notes"] },
  "notes-and-scales": { categories: ["notes-scales"], topics: ["scales", "notes"] },
  notes: { topics: ["notes", "keyboard"] },
  scales: { categories: ["notes-scales"], topics: ["scales", "pentatonic"] },
  chords: { categories: ["chords"], topics: ["chords", "open-chords", "piano-chords"] },
  rhythm: { categories: ["rhythm"], topics: ["rhythm", "counting"] },
  "rhythm-and-timing": { categories: ["rhythm"], topics: ["rhythm", "counting"] },
  strumming: { topics: ["strumming"] },
  "finger-exercises": { categories: ["finger-exercises"], topics: ["technique", "finger-independence"] },
  "piano-technique": { categories: ["finger-exercises"], topics: ["technique", "sustain-pedal"] },
  sargam: { topics: ["sargam"] },
  "indian-music": { categories: ["bollywood"], topics: ["sargam", "hindi"] },
  bollywood: { categories: ["bollywood"] },
  songs: { topics: ["songs"] },
  "ear-training": { topics: ["ear-training", "intervals"] },
  "lead-guitar": { topics: ["pentatonic", "lead"] },
  "reading-music": { topics: ["reading", "treble-clef", "bass-clef"] },
  tuning: { topics: ["tuning"] },
  improvisation: { topics: ["pentatonic", "lead"] },
  advanced: { categories: ["intermediate-advanced"] },
};

export interface RecommendContext {
  instrument: "guitar" | "piano";
  topics: string[];
  /** Words from the lesson title / skills, used as a weak signal. */
  keywords?: string[];
  watched?: Set<string>;
}

export function scoreVideo(v: CuratedVideo, ctx: RecommendContext): number {
  if (v.instrument !== "both" && v.instrument !== ctx.instrument) return -1;
  let score = 0;
  for (const t of ctx.topics) {
    const m = TOPIC_MAP[t];
    if (v.topics.includes(t)) score += 3;
    if (m?.categories?.includes(v.category)) score += 2;
    if (m?.topics) score += m.topics.filter((x) => v.topics.includes(x)).length * 2;
  }
  const hay = `${v.title} ${v.topics.join(" ")}`.toLowerCase();
  for (const k of ctx.keywords ?? []) if (k.length > 3 && hay.includes(k.toLowerCase())) score += 1;
  if (v.level === "beginner") score += 0.5;
  if (ctx.watched?.has(v.id)) score -= 2.5;
  return score;
}

export function recommendVideos(videos: CuratedVideo[], ctx: RecommendContext, n = 3): CuratedVideo[] {
  return videos
    .map((v) => ({ v, s: scoreVideo(v, ctx) }))
    .filter((x) => x.s > 0.5)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.v);
}
