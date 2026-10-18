"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Circle, ExternalLink, Heart, Play, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Switch, cn } from "@/components/ui";
import { useData } from "@/hooks/use-data";
import { usePrefs } from "@/hooks/use-prefs";
import { profileRepo, progressRepo, videoRepo } from "@/lib/storage/repositories";
import { nextLesson } from "@/lib/progress/engine";
import { LESSONS } from "@/content/curriculum";
import {
  VIDEO_CATEGORIES,
  VIDEO_SEARCHES,
  VIDEOS,
  youtubeEmbedUrl,
  youtubeSearchUrl,
  youtubeThumbnail,
  youtubeWatchUrl,
  type CuratedVideo,
  type VideoCategory,
  type VideoLevel,
  type VideoLanguage,
  videoLanguage,
} from "@/content/videos";
import { recommendVideos } from "./recommend";

type InstrumentFilter = "all" | "guitar" | "piano";

export function VideoHub() {
  const [prefs] = usePrefs();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<VideoCategory | "all">("all");
  const [inst, setInst] = useState<InstrumentFilter>("all");
  const [level, setLevel] = useState<VideoLevel | "all">("all");
  const [lang, setLang] = useState<VideoLanguage | "all">("all");
  const [favOnly, setFavOnly] = useState(false);
  const [hideWatched, setHideWatched] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);

  const states = useData(() => videoRepo.list(), ["videoState"], []);
  const ctx = useData(
    async () => {
      const [progress, profile] = await Promise.all([progressRepo.all(), profileRepo.get()]);
      return nextLesson(LESSONS, progress, ["theory", prefs.instrument], profile?.placement) ?? null;
    },
    ["lessonProgress", "profile"],
    null,
  );

  const stateOf = (id: string) => states.data.find((s) => s.videoId === id);
  const watched = useMemo(() => new Set(states.data.filter((s) => s.watched).map((s) => s.videoId)), [states.data]);

  const lesson = ctx.data;
  const recommended = useMemo(
    () =>
      recommendVideos(lang === "all" ? VIDEOS : VIDEOS.filter((v) => videoLanguage(v) === lang), {
        instrument: prefs.instrument,
        topics: lesson?.topics.length ? lesson.topics : [prefs.instrument === "guitar" ? "guitar-beginner" : "piano-beginner"],
        keywords: lesson ? [...lesson.title.split(/\W+/), ...lesson.skills] : [],
        watched,
      }),
    [lesson, prefs.instrument, watched, lang],
  );

  const filtered = VIDEOS.filter((v) => {
    if (category !== "all" && v.category !== category) return false;
    if (inst !== "all" && v.instrument !== inst && v.instrument !== "both") return false;
    if (level !== "all" && v.level !== level) return false;
    if (lang !== "all" && videoLanguage(v) !== lang) return false;
    if (favOnly && !stateOf(v.id)?.favorite) return false;
    if (hideWatched && stateOf(v.id)?.watched) return false;
    if (q) {
      const hay = `${v.title} ${v.creator} ${v.description} ${v.topics.join(" ")}`.toLowerCase();
      if (!q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  }).sort((a, b) => Number(videoLanguage(b) === "hindi") - Number(videoLanguage(a) === "hindi")); // Hindi lessons first
  const searches = VIDEO_SEARCHES.filter((s) => (category === "all" || s.category === category) && (inst === "all" || s.instrument === inst || s.instrument === "both"));
  const categoryLabel = (c: VideoCategory) => VIDEO_CATEGORIES.find((x) => x.id === c)?.label ?? c;

  const card = (v: CuratedVideo) => (
    <VideoCard
      key={v.id}
      video={v}
      category={categoryLabel(v.category)}
      favorite={!!stateOf(v.id)?.favorite}
      watched={!!stateOf(v.id)?.watched}
      playing={playing === v.id}
      onPlay={() => {
        setPlaying(v.id);
        void videoRepo.set(v.id, { watched: true });
      }}
      onClose={() => setPlaying(null)}
    />
  );

  return (
    <div>
      <PageHeader
        eyebrow="Video Hub"
        title="Learn from great teachers"
        description={`${VIDEOS.length} hand-picked free lessons from YouTube creators, organised by instrument, level and topic.`}
      />

      <p className="mb-6 flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-xs text-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        Every video was checked on YouTube on {VIDEOS[0]?.verifiedAt} (it existed and allowed embedding); titles and creators are as YouTube reported them. Creators can remove videos later, so each one also has a “Watch on YouTube” link. Videos load from youtube-nocookie.com only when you press play.
      </p>

      {recommended.length > 0 && (
        <section className="mb-8" aria-labelledby="rec-h">
          <h2 id="rec-h" className="mb-1 flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4 text-accent" /> Recommended for you
          </h2>
          <p className="mb-3 text-sm text-muted">{lesson ? <>Based on your next lesson: <strong className="text-text">{lesson.title}</strong> ({prefs.instrument} mode)</> : `Beginner picks for ${prefs.instrument} mode`}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{recommended.map(card)}</div>
        </section>
      )}

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input aria-label="Search videos" placeholder="Search by topic, creator or title" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select aria-label="Instrument" value={inst} onChange={(e) => setInst(e.target.value as InstrumentFilter)}>
            <option value="all">All instruments</option>
            <option value="guitar">Guitar</option>
            <option value="piano">Piano</option>
          </Select>
          <Select aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value as VideoLanguage | "all")} data-testid="video-language">
            <option value="all">Hindi &amp; English</option>
            <option value="hindi">Hindi only</option>
            <option value="english">English only</option>
          </Select>
          <Select aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value as VideoLevel | "all")}>
            <option value="all">All levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </Select>
        </div>
        <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Category">
          {[{ id: "all" as const, label: "All topics" }, ...VIDEO_CATEGORIES].map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
              className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors", category === c.id ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-text")}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-6">
          <Switch label="Favourites only" checked={favOnly} onChange={setFavOnly} />
          <Switch label="Hide watched" checked={hideWatched} onChange={setHideWatched} />
        </div>
      </div>

      {filtered.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(card)}</div>
      ) : (
        <EmptyState title="No videos match" description="Try clearing a filter or searching for something broader." />
      )}

      {searches.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-1 font-semibold">More on YouTube</h2>
          <p className="mb-3 text-sm text-muted">These are YouTube searches — not verified videos. Check the creator before you follow along.</p>
          <div className="flex flex-wrap gap-2">
            {searches.map((s) => (
              <a key={s.query} href={youtubeSearchUrl(s.query)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border-strong px-3 py-1.5 text-sm hover:bg-surface-2">
                <Search className="h-3.5 w-3.5" /> {s.label} <Badge>search</Badge>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function VideoCard({ video: v, category, favorite, watched, playing, onPlay, onClose }: { video: CuratedVideo; category: string; favorite: boolean; watched: boolean; playing: boolean; onPlay: () => void; onClose: () => void }) {
  return (
    <Card className="flex flex-col overflow-hidden" data-testid={`video-${v.id}`}>
      <div className="relative aspect-video bg-surface-3">
        {playing ? (
          <>
            <iframe
              src={youtubeEmbedUrl(v.id)}
              title={v.title}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
            <button type="button" onClick={onClose} className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white" aria-label="Close video">
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button type="button" onClick={onPlay} className="group absolute inset-0" aria-label={`Play “${v.title}” by ${v.creator}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={youtubeThumbnail(v.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/30">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/70 text-white">
                <Play className="ml-0.5 h-6 w-6" />
              </span>
            </span>
            {watched && <span className="absolute left-2 top-2"><Badge tone="success" className="bg-success-soft/90">Watched</Badge></span>}
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="line-clamp-2 font-semibold leading-snug">{v.title}</p>
        <p className="mt-0.5 text-sm text-muted">{v.creator}</p>
        <p className="mt-2 text-sm text-muted">{v.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone={v.instrument === "guitar" ? "guitar" : v.instrument === "piano" ? "piano" : "theory"}>{v.instrument === "both" ? "Guitar & piano" : v.instrument}</Badge>
          {videoLanguage(v) === "hindi" && <Badge tone="accent">Hindi</Badge>}
          <Badge>{v.level}</Badge>
          <Badge>{category}</Badge>
        </div>
        <div className="mt-auto flex items-center gap-1 pt-3">
          <Button size="sm" variant="ghost" aria-pressed={favorite} onClick={() => void videoRepo.set(v.id, { favorite: !favorite })} aria-label={favorite ? "Remove from favourites" : "Add to favourites"}>
            <Heart className={cn("h-4 w-4", favorite && "fill-danger text-danger")} /> {favorite ? "Saved" : "Save"}
          </Button>
          <Button size="sm" variant="ghost" aria-pressed={watched} onClick={() => void videoRepo.set(v.id, { watched: !watched })}>
            {watched ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4" />} {watched ? "Watched" : "Mark watched"}
          </Button>
          <a href={youtubeWatchUrl(v.id)} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:text-text">
            YouTube <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </Card>
  );
}
