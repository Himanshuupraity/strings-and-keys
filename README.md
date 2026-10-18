# Melody Masters

An AI-assisted guitar and piano academy for absolute beginners through to advanced players. It has structured lessons, playable instruments, a real microphone tuner, a practice toolkit, a song lab and an honest listening coach.

**It works with no setup.** Clone it, install, run. Your progress is saved in your browser, and you don't need an account, a database or an API key.

> The product name is set in one place, `src/config/brand.ts`. Change it there to rename the app.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Requirements: Node.js 20.9 or newer (tested on Node 26) and a modern browser. Chrome or Edge is recommended for MIDI.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build && npm start` | Production build and server |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright; run `npm run build` first) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

To run the Playwright browsers for the first time: `npx playwright install chromium`.

---

## What's inside

| Route | Feature |
| --- | --- |
| `/` | Landing page |
| `/onboarding` | Short questionnaire that builds a beginner plan |
| `/dashboard` | Guitar / Piano mode switch, today's plan, streak, weekly chart, next lesson, achievements |
| `/learn`, `/learn/guitar`, `/learn/piano`, `/learn/diagnostic` | Curriculum map (levels 0–7) and placement quiz |
| `/lesson/[id]` | Lesson player: explain → listen → see → try (auto-checked) → quiz |
| `/piano-lab` | 49/61/88-key playable piano with mouse, touch, computer keyboard and MIDI; guided exercises |
| `/guitar-lab` | Fretboard, chord and scale explorers, capo simulator, Easy Chord Transposer, exercises |
| `/tuner` | Microphone guitar tuner with cents needle and adjustable A4 |
| `/practice/*` | Metronome, chord trainer, scale trainer, rhythm trainer, ear training, note detector, practice timer, **1-Minute Chord Change drill** |
| `/songs` | Public-domain songs, original practice pieces, and your own chord charts with play-along |
| `/videos` | Curated, verified YouTube lessons with search, filters, favourites and watched state |
| `/ai-coach` | Listening teacher (explain → demo → listen → feedback → adapt) and chat |
| `/progress` | Completion vs mastery, per-track progress, drill history, quiz history, weekly report |
| `/settings` | Theme, Western/Sargam labels and Sa, keyboard size, goals, backup/import, account and sync |

### Music conventions
- Scientific pitch notation: **MIDI 60 = C4 = middle C** and A4 = 440 Hz (adjustable from 430 to 450 Hz). Some keyboard brands call middle C "C3". It is the same physical key.
- Guitar standard tuning, low to high: E2 A2 D3 G3 B3 E4. In code, string index 0 is the low E string (string number 6).
- **Sargam uses a movable Sa.** You choose the tonic and every label is worked out from it, using the equal-tempered approximation. Komal swaras are underlined and tivra Ma is shown as Ma′.

All theory logic is pure TypeScript in `src/lib/music/`, with tests in `music.test.ts`: notes, keyboard ranges, fretboard, chords and guitar shapes, scales, transposition and capo, and sargam. Every lesson, lab and song uses these same utilities.

---

## Architecture

```
src/
  app/                 Next.js routes ((app)/ group shares the sidebar shell; api/ = server routes)
  components/
    ui/                Design-system primitives (Button, Card, Segmented, Slider, …)
    instruments/       PianoKeyboard, Fretboard, ChordDiagram, Staff, MicButton, note labels
    layout/            App shell, instrument toggle, theme toggle, global audio/mic indicator
    dashboard/ progress/ settings/ piano/ guitar/ practice/ tuner/ lesson/ learn/
    onboarding/ songs/ videos/ coach/ account/
  content/             Curriculum (levels 0–7), songs, curated videos — pure data
  hooks/               usePrefs, useData, useMic, useMidi, useNoteInput, useMetronome, usePracticeLog
  lib/
    music/             Theory core (tested)
    audio/             Tone.js output, drift-free beat scheduler, mic pitch/chroma analysis, Web MIDI
    exercises/         Pure exercise checkers
    progress/          Completion/mastery rules, unlocking, streaks, practice plans
    storage/           Storage adapters, zod schemas, repositories, export/import
    coach/             Rule-based coach + listening-session state machine
    server/            Server-only code (AI providers, auth, database)
prisma/                PostgreSQL schema, migrations, seed (optional remote mode)
e2e/                   Playwright tests (microphone mocked with a synthetic oscillator)
```

### Persistence (local-first)
UI components never touch storage directly. They call **repositories** (`src/lib/storage/repositories.ts`). The repositories use a `StorageAdapter` interface with `get`, `set`, `update`, `remove`, `list` and `clear`.

1. **IndexedDB** stores progress, history and saved items. It is chosen automatically, falls back to localStorage, and then to memory if storage is blocked.
2. **localStorage** stores small preferences: instrument, theme, label mode, Sa, keyboard size and so on. These are read synchronously so the first paint is correct.
3. **Remote (optional)** means PostgreSQL through Prisma, used when `DATABASE_URL` is set. You can sign in, upload this device's progress or download from your account. Before anything is overwritten, a dry run shows the conflicts and you choose what to keep. See `docs/persistence.md`.

Every stored record is validated with zod. Malformed rows are skipped rather than crashing the app. Storage failures and full-quota errors fall back to memory with a warning toast. A schema version number plus a migration hook (`src/lib/storage/db.ts`) handle future changes. **Settings → Your data** lets you download and import JSON backups.

### Audio and honesty rules
- Sound uses Tone.js and only starts after a click or tap.
- The metronome uses a look-ahead scheduler on the audio clock. Each beat's time is calculated from its index rather than added up from intervals, so timing errors don't build up over time. This is unit-tested with a jittery fake clock.
- **Single notes.** Pitch is found with the McLeod pitch method (`pitchy`). An event counts only when the pitch is clear and stable for several frames.
- **Chords.** Chords from the microphone are a *best-effort* estimate from a chromagram, shown with a confidence level. If the estimate is ambiguous, the app asks you to play again. A MIDI keyboard gives exact notes and is labelled "measured (MIDI)".
- **Technique.** Posture, finger pressure and fingering cannot be heard. These are guided self-checks and are always labelled as self-assessment.
- Results show **Measured**, **Self-reported**, **AI suggestion** or **Coaching tip** tags.
- **Microphone privacy.** The microphone is used only after you press a button. A red indicator with a Stop button is shown while it's on. Tracks are stopped when you finish, and no audio is ever recorded or uploaded.

### Completion vs mastery
- **Opening a lesson** only marks it as *in progress*.
- **Completed** means every step is done and the quiz is passed (score of at least `passScore`).
- **Mastered** means completed, plus every exercise marked `mastery` has been passed with measured input (virtual instrument, MIDI or microphone).
- **Unlocking.** The next lessons unlock when their prerequisites are completed, or when the diagnostic placement puts you above that level. You can always go back and revise.

---

## Configuration (all optional)

Copy `.env.example` to `.env.local` and fill in only the features you want.

### AI coach
Without a key, the coach uses a built-in rule-based teacher. Lessons, listening feedback and the chat for common questions all still work.

```bash
AI_PROVIDER=anthropic          # anthropic | openai | openai-compatible
AI_API_KEY=sk-...              # or ANTHROPIC_API_KEY / OPENAI_API_KEY
AI_MODEL=                      # optional override
AI_BASE_URL=                   # for openai-compatible providers (e.g. a local server)
```

Keys stay on the server, in `/api/coach`. Requests are validated and rate-limited, and they carry only your question and lesson context, never your name or email.

### Accounts and cloud sync (PostgreSQL)
```bash
DATABASE_URL=postgresql://user:pass@host:5432/melody
npx prisma migrate deploy      # apply migrations
npm run db:seed                # seed lessons into the database (optional)
```
Google sign-in is optional: set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and register `APP_URL/api/auth/google/callback`. See `docs/persistence.md` for SQLite and serverless notes.

---

## Testing the microphone and MIDI
- **Microphone.** Open `/tuner` on `localhost` or over HTTPS, since browsers block the mic on insecure origins. Press **Listen to me**, allow access, and pluck one string at a time. For best results, turn off noise suppression in your OS, keep the room quiet and hold the phone or laptop near the guitar's sound hole. A piano works the same way at `/practice/note-detector`. Very low notes (below about A1) are unreliable.
- **MIDI.** Use Chrome, Edge or Opera on desktop (Safari doesn't support Web MIDI). Plug the keyboard in *before* opening `/piano-lab`, then click **Connect MIDI keyboard**. Notes light up the keys and are checked exactly in exercises.
- **Automated tests** never use real hardware. Playwright replaces `getUserMedia` with an oscillator-based MediaStream (`e2e/helpers.ts`), so the real pitch-detection code runs on a known frequency.

---

## Deploying
- **Vercel or any Node host.** Run `npm run build`, then `npm start`. With no env vars the app runs in local-first mode. Every user's progress stays in their own browser.
- **With accounts.** Point `DATABASE_URL` at a managed Postgres database (Neon, Supabase, RDS and so on) and run `npx prisma migrate deploy` during deployment. A local SQLite file will **not** persist on serverless hosts.
- **HTTPS is required** for the microphone, MIDI and the service worker in production.
- **Offline support.** The service worker (`public/sw.js`) caches the app shell and pages you have visited for offline use. Cloud AI, video embeds and sync still need a connection.

---

## Browser support
| | Chrome / Edge | Firefox | Safari |
| --- | --- | --- | --- |
| Virtual instruments, lessons | ✅ | ✅ | ✅ |
| Microphone tuner / feedback | ✅ | ✅ | ✅ (needs a click to start audio) |
| Web MIDI | ✅ | ✅ (108+) | ❌ |

---

## Content and copyright
- **Songs** are public domain, original practice pieces written for this app (clearly labelled), or charts you enter yourself. For popular songs, the app links to official audio and licensed sheet-music sources. It never reproduces lyrics, chords or arrangements it can't verify.
- **Videos** are only ones whose IDs were confirmed through YouTube's oEmbed endpoint, each with a `verifiedAt` date in `src/content/videos.ts`. Categories without verified videos show clearly labelled YouTube search links instead.

## Known limitations
See [`docs/STATUS.md`](docs/STATUS.md) for the full list of implemented features and known limitations.
