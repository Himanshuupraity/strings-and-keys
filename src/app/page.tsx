import Link from "next/link";
import { ArrowRight, AudioLines, Bot, Gauge, Guitar, HardDrive, Languages, ListMusic, Music4, Piano, ShieldCheck, Sparkles, Timer } from "lucide-react";
import { BRAND } from "@/config/brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LandingLearnerPanel } from "@/components/learner/landing-panel";
import { T } from "@/components/ui/t";
import type { MessageKey } from "@/lib/i18n";

const FEATURES = [
  { icon: Sparkles, title: "landing.f.absoluteZero.title" as MessageKey, text: "landing.f.absoluteZero.text" as MessageKey },
  { icon: Piano, title: "landing.f.piano.title" as MessageKey, text: "landing.f.piano.text" as MessageKey },
  { icon: Guitar, title: "landing.f.fretboard.title" as MessageKey, text: "landing.f.fretboard.text" as MessageKey },
  { icon: Gauge, title: "landing.f.tuner.title" as MessageKey, text: "landing.f.tuner.text" as MessageKey },
  { icon: Bot, title: "landing.f.coach.title" as MessageKey, text: "landing.f.coach.text" as MessageKey },
  { icon: Languages, title: "landing.f.sargam.title" as MessageKey, text: "landing.f.sargam.text" as MessageKey },
  { icon: Timer, title: "landing.f.toolkit.title" as MessageKey, text: "landing.f.toolkit.text" as MessageKey },
  { icon: ListMusic, title: "landing.f.songlab.title" as MessageKey, text: "landing.f.songlab.text" as MessageKey },
];

function HeroArt() {
  const whites = Array.from({ length: 14 });
  const blacks = [0, 1, 3, 4, 5, 7, 8, 10, 11, 12];
  return (
    <svg viewBox="0 0 560 360" className="h-auto w-full" role="img" aria-label="Illustration of a piano keyboard and a guitar fretboard">
      <defs>
        <linearGradient id="hero-wood" x1="0" x2="1">
          <stop offset="0" stopColor="var(--fret-wood)" />
          <stop offset="1" stopColor="var(--fret-wood-2)" />
        </linearGradient>
        <linearGradient id="hero-glow" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="var(--guitar)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--piano)" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <rect x="20" y="20" width="520" height="320" rx="28" fill="url(#hero-glow)" />
      {/* Fretboard */}
      <g transform="translate(48 52)">
        <rect width="464" height="110" rx="8" fill="url(#hero-wood)" />
        <rect x="0" width="8" height="110" fill="var(--inlay)" />
        {Array.from({ length: 9 }, (_, i) => <rect key={i} x={8 + (i + 1) * 50} width="3" height="110" fill="var(--fret-wire)" />)}
        {[2, 4, 6].map((f) => <circle key={f} cx={8 + f * 50 + 25} cy="55" r="6" fill="var(--inlay)" opacity="0.7" />)}
        {Array.from({ length: 6 }, (_, s) => <line key={s} x1="0" x2="464" y1={10 + s * 18} y2={10 + s * 18} stroke="var(--string)" strokeWidth={1 + s * 0.35} />)}
        {/* C major open shape (rows from the top: high E, B, G, D, A, low E): C on B fret 1, E on D fret 2, C on A fret 3 */}
        {[
          [1, 1, "C"], [2, 3, "E"], [3, 4, "C"],
        ].map(([f, s, n]) => (
          <g key={`${f}-${s}`}>
            <circle cx={8 + Number(f) * 50 - 22} cy={10 + Number(s) * 18} r="11" fill="var(--accent)" />
            <text x={8 + Number(f) * 50 - 22} y={14 + Number(s) * 18} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--accent-fg)">{n}</text>
          </g>
        ))}
      </g>
      {/* Keyboard */}
      <g transform="translate(48 190)">
        <rect width="464" height="128" rx="10" fill="var(--key-black)" />
        {whites.map((_, i) => (
          <rect key={i} x={6 + i * 32.3} y="8" width="31" height="112" rx="4" fill={[0, 2, 4].includes(i) ? "color-mix(in oklab, var(--piano) 35%, var(--key-white))" : "var(--key-white)"} />
        ))}
        {blacks.map((i) => <rect key={i} x={6 + (i + 1) * 32.3 - 10} y="8" width="20" height="70" rx="3" fill="var(--key-black-top)" />)}
        {["Sa", "Re", "Ga"].map((t, i) => (
          <text key={t} x={6 + i * 2 * 32.3 + 15.5} y="110" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1d1b18">{t}</text>
        ))}
      </g>
    </svg>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-guitar to-piano text-white">
            <Music4 className="h-5 w-5" aria-hidden />
          </span>
          <span className="font-display text-xl">{BRAND.name}</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/learn" className="hidden rounded-lg px-3 py-2 text-sm text-muted hover:text-text sm:block"><T k="landing.curriculum" /></Link>
          <Link href="/tuner" className="hidden rounded-lg px-3 py-2 text-sm text-muted hover:text-text sm:block"><T k="landing.tuner" /></Link>
          <ThemeToggle />
          <Link href="/dashboard" className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover"><T k="landing.openApp" /></Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-8 lg:grid-cols-2 lg:pt-16">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
              <AudioLines className="h-3.5 w-3.5 text-accent" /> <T k="landing.badge" />
            </p>
            <h1 className="font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
              <T k="landing.h1a" /> <em className="text-accent"><T k="landing.h1b" /></em>{" "}<T k="landing.h1c" />
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted"><T k="brand.description" /> <T k="landing.sub2" /></p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/learn" className="inline-flex h-12 items-center gap-2 rounded-xl border border-border-strong px-6 font-medium hover:bg-surface-2">
                <T k="landing.seeCurriculum" /> <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-success" /> <T k="landing.local" /></span>
              <span className="flex items-center gap-1.5"><HardDrive className="h-4 w-4 text-success" /> <T k="landing.nameOnly" /></span>
            </div>
          </div>
          <div className="order-first lg:order-none">
            <LandingLearnerPanel />
          </div>
        </section>

        <section className="border-y border-border bg-surface/60">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <h2 className="font-display text-3xl sm:text-4xl"><T k="landing.everything" /></h2>
              <div className="mx-auto w-full max-w-md"><HeroArt /></div>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-border bg-surface p-5 shadow-card">
                  <Icon className="h-6 w-6 text-accent" aria-hidden />
                  <h3 className="mt-3 font-semibold"><T k={title} /></h3>
                  <p className="mt-1.5 text-sm text-muted"><T k={text} /></p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl"><T k="landing.how" /></h2>
              <ol className="mt-6 space-y-4">
                {(["landing.step.0", "landing.step.1", "landing.step.2", "landing.step.3"] as const).map((t, i) => (
                  <li key={t} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">{i + 1}</span>
                    <p className="pt-1"><T k={t} /></p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
              <h3 className="font-semibold"><T k="landing.honest" /></h3>
              <p className="mt-2 text-sm text-muted"><T k="landing.micIntro" /></p>
              <ul className="mt-4 space-y-2 text-sm">
                <li><T k="landing.b1" /></li>
                <li><T k="landing.b2" /></li>
                <li><T k="landing.b3" /></li>
                <li><T k="landing.b4" /></li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-gradient-to-br from-guitar to-piano p-8 text-white sm:flex-row sm:items-center sm:p-10">
            <div>
              <h2 className="font-display text-3xl"><T k="landing.ready" /></h2>
              <p className="mt-2 text-white/85"><T k="landing.fiveMin" /></p>
            </div>
            <Link href="/onboarding" className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 font-medium text-black hover:bg-white/90">
              <T k="landing.begin" /> <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-sm text-muted sm:flex-row sm:justify-between">
          <span>© {BRAND.name}</span>
          <span><T k="landing.footer" /></span>
        </div>
      </footer>
    </div>
  );
}
