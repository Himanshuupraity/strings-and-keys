import Link from "next/link";
import { ArrowRight, AudioLines, Bot, Gauge, Guitar, HardDrive, Languages, ListMusic, Music4, Piano, ShieldCheck, Sparkles, Timer } from "lucide-react";
import { BRAND } from "@/config/brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LandingLearnerPanel } from "@/components/learner/landing-panel";

const FEATURES = [
  { icon: Sparkles, title: "From absolute zero", text: "Eight levels, from “what is a note?” to improvisation and songwriting. Every lesson explains, demonstrates, lets you try, and checks." },
  { icon: Piano, title: "Playable piano", text: "49, 61 or full 88 keys. Mouse, touch, computer keyboard and MIDI keyboards. Finger numbers and guided exercises." },
  { icon: Guitar, title: "Real fretboard", text: "Correct note maps, chord and scale explorers, a capo simulator and an easy-chord transposer that keeps your song in key." },
  { icon: Gauge, title: "Microphone tuner", text: "A real pitch-detecting tuner with cents and a live needle — audio never leaves your device." },
  { icon: Bot, title: "Patient listening coach", text: "Explains, plays an example, listens to your attempt and tells you exactly what was higher, lower, early or missing." },
  { icon: Languages, title: "Western & Sargam", text: "See C D E… or Sa Re Ga… (or both) with a movable Sa you choose — on every keyboard, fretboard and lesson." },
  { icon: Timer, title: "Practice toolkit", text: "Metronome, rhythm, ear training, scale & chord trainers, a 1-minute chord change drill and a practice timer." },
  { icon: ListMusic, title: "Song Lab", text: "Public-domain melodies, original Bollywood- and pop-style practice pieces, and your own songs with play-along tools." },
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
          <Link href="/learn" className="hidden rounded-lg px-3 py-2 text-sm text-muted hover:text-text sm:block">Curriculum</Link>
          <Link href="/tuner" className="hidden rounded-lg px-3 py-2 text-sm text-muted hover:text-text sm:block">Tuner</Link>
          <ThemeToggle />
          <Link href="/dashboard" className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover">Open app</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-8 lg:grid-cols-2 lg:pt-16">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
              <AudioLines className="h-3.5 w-3.5 text-accent" /> Guitar & piano · beginner to advanced
            </p>
            <h1 className="font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
              Learn music like you have a <em className="text-accent">patient teacher</em>{" "}beside you.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">{BRAND.description} Just enter your name — no password, no setup — and your progress is saved under it.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/learn" className="inline-flex h-12 items-center gap-2 rounded-xl border border-border-strong px-6 font-medium hover:bg-surface-2">
                See the curriculum <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-success" /> Audio processed locally</span>
              <span className="flex items-center gap-1.5"><HardDrive className="h-4 w-4 text-success" /> Just your name — no password</span>
            </div>
          </div>
          <div className="order-first lg:order-none">
            <LandingLearnerPanel />
          </div>
        </section>

        <section className="border-y border-border bg-surface/60">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <h2 className="font-display text-3xl sm:text-4xl">Everything a beginner needs, in one studio</h2>
              <div className="mx-auto w-full max-w-md"><HeroArt /></div>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-border bg-surface p-5 shadow-card">
                  <Icon className="h-6 w-6 text-accent" aria-hidden />
                  <h3 className="mt-3 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl">How every lesson works</h2>
              <ol className="mt-6 space-y-4">
                {["Explain the idea in plain words (Hinglish too, if you like).", "Demonstrate the sound and show it on the instrument.", "You try it — on the virtual instrument, a MIDI keyboard, or your real instrument through the mic.", "Get specific feedback, then repeat until it's comfortable."].map((t, i) => (
                  <li key={t} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">{i + 1}</span>
                    <p className="pt-1">{t}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
              <h3 className="font-semibold">Honest feedback, always</h3>
              <p className="mt-2 text-sm text-muted">A microphone can hear the pitch of a clear single note very well. It struggles with chords in a noisy room, and it can&apos;t see your fingers. So we:</p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>• Mark results as <strong>measured</strong> only when they really were.</li>
                <li>• Show a confidence level for chord guesses, and ask you to replay when unsure.</li>
                <li>• Use guided self-checks for posture and technique — clearly labelled.</li>
                <li>• Never count opening a lesson as mastering it.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-gradient-to-br from-guitar to-piano p-8 text-white sm:flex-row sm:items-center sm:p-10">
            <div>
              <h2 className="font-display text-3xl">Ready for your first note?</h2>
              <p className="mt-2 text-white/85">Five minutes from now you&apos;ll know what a note is — and you&apos;ll have played one.</p>
            </div>
            <Link href="/onboarding" className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 font-medium text-black hover:bg-white/90">
              Begin <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-sm text-muted sm:flex-row sm:justify-between">
          <span>© {BRAND.name}</span>
          <span>Song content is public domain, original, or user-provided. Videos link to their creators on YouTube.</span>
        </div>
      </footer>
    </div>
  );
}
