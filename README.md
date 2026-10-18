# Melody Masters

A guitar and piano academy for absolute beginners through to advanced players. It has structured lessons, playable instruments, a real microphone tuner, a practice toolkit, a song lab and an honest listening coach.

**It works with no setup.** Clone it, install, run. The first screen asks for your name and saves your progress under it — no password. Add a free Supabase database (optional) and you can pick your name on any device to continue where you left off.

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
| `/songs/sheet` | **Song sheets:** paste any song's lyrics with chords, then sing along. Chords appear above the words, the sheet follows your voice (or auto-scrolls), and the song's YouTube video plays alongside |
| `/songs` | Bollywood chord charts (29 songs), a searchable list of 165 Hindi songs, Hindi-style practice pieces, your own charts, and a small English classics tab |
| `/videos` | Curated, verified YouTube lessons with search, filters, favourites and watched state |
| `/ai-coach` | Listening teacher (explain → demo → listen → feedback → adapt) and chat |
| `/progress` | Completion vs mastery, per-track progress, drill history, quiz history, weekly report |
| `/settings` | Your profile & sync, theme, Western/Sargam labels and Sa, keyboard size, goals, backup/import |

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
    onboarding/ songs/ videos/ coach/ learner/
  content/             Curriculum (levels 0–7), songs, curated videos — pure data
  hooks/               usePrefs, useData, useMic, useMidi, useNoteInput, useMetronome, usePracticeLog
  lib/
    music/             Theory core (tested)
    audio/             Tone.js output, drift-free beat scheduler, mic pitch/chroma analysis, Web MIDI
    exercises/         Pure exercise checkers
    progress/          Completion/mastery rules, unlocking, streaks, practice plans
    storage/           Storage adapters, zod schemas, repositories, export/import
    coach/             Rule-based coach + listening-session state machine
    server/            Server-only code (auth, database)
supabase/schema.sql    Table for learner profiles (optional cross-device sync)
e2e/                   Playwright tests (microphone mocked with a synthetic oscillator)
```

### Persistence (local-first)
UI components never touch storage directly. They call **repositories** (`src/lib/storage/repositories.ts`). The repositories use a `StorageAdapter` interface with `get`, `set`, `update`, `remove`, `list` and `clear`.

1. **IndexedDB** stores progress, history and saved items. It is chosen automatically, falls back to localStorage, and then to memory if storage is blocked.
2. **localStorage** stores small preferences: instrument, theme, label mode, Sa, keyboard size and so on. These are read synchronously so the first paint is correct.
3. **Supabase (optional)** stores one row per learner name with their full progress. The browser talks only to the app's own `/api/learners` routes; the Supabase secret key stays on the server. See [Profiles & Supabase](#profiles--supabase-optional).

Every stored record is validated with zod. Malformed rows are skipped rather than crashing the app. Storage failures and full-quota errors fall back to memory with a warning toast. A schema version number plus a migration hook (`src/lib/storage/db.ts`) handle future changes. **Settings → Your data** lets you download and import JSON backups.

### Audio and honesty rules
- Sound uses Tone.js and only starts after a click or tap. The piano is a recorded grand piano (Salamander Grand Piano by Alexander Holm, CC BY 3.0; 30 samples, 2 MB in `public/samples/piano/`, downloaded on the first note) and falls back to a light synth while loading, if loading fails, or when chosen in Settings.
- The metronome uses a look-ahead scheduler on the audio clock. Each beat's time is calculated from its index rather than added up from intervals, so timing errors don't build up over time. This is unit-tested with a jittery fake clock.
- **Single notes.** Pitch is found with the McLeod pitch method (`pitchy`). An event counts only when the pitch is clear and stable for several frames.
- **Chords.** Chords from the microphone are a *best-effort* estimate from a chromagram, shown with a confidence level. If the estimate is ambiguous, the app asks you to play again. A MIDI keyboard gives exact notes and is labelled "measured (MIDI)".
- **Technique.** Posture, finger pressure and fingering cannot be heard. These are guided self-checks and are always labelled as self-assessment.
- Results show **Measured**, **Self-reported** or **Coaching tip** tags.
- **Microphone privacy.** The microphone is used only after you press a button. A red indicator with a Stop button is shown while it's on. Tracks are stopped when you finish, and no audio is ever recorded or uploaded.

### Completion vs mastery
- **Opening a lesson** only marks it as *in progress*.
- **Completed** means every step is done and the quiz is passed (score of at least `passScore`).
- **Mastered** means completed, plus every exercise marked `mastery` has been passed with measured input (virtual instrument, MIDI or microphone).
- **Unlocking.** The next lessons unlock when their prerequisites are completed, or when the diagnostic placement puts you above that level. You can always go back and revise.

---

## Configuration (all optional)

Copy `.env.example` to `.env.local` and fill in only the features you want.

### Coach
The coach is built in and runs entirely in your browser. It needs no API key and works offline. It answers common beginner questions, using the app's own music-theory code for things like scale notes, chord notes and capo suggestions, and it gives feedback from your measured exercise results.

### Profiles & Supabase (optional)

**How it works**
- **First visit:** the site asks *"What's your name?"*. Your progress is saved under that name.
- **Another device:** open the site and it lists the saved names. Click yours and your progress is downloaded, then kept in sync.
- **While you practise:** changes upload about 2 seconds later, and also when you close or hide the tab. Opening the site pulls the newest copy.
- **Two devices changed while offline:** the copies are merged. Records only on one side are added, and where both changed the same record, the device that's uploading keeps its version. Practice sessions and drills are never lost.
- **Typing a name that already exists:** the site asks *"Is that you?"* rather than overwriting.
- **Switch learner:** in the name menu (top right) or Settings. It uploads your progress, then clears this device for the next person.
- **Without Supabase:** the name is still asked and saved, but progress stays in that browser. If you add Supabase later, an existing learner is uploaded automatically the next time they open the site.

**Setup (about 5 minutes)**
1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and click **Run**.
3. Go to **Project Settings → API Keys** and copy the **secret** key (`sb_secret_…`). On older projects, copy the `service_role` key instead. Copy the **Project URL** too.
4. Create `.env.local` in the project folder:
   ```bash
   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_...
   ```
5. Restart `npm run dev`. The name screen now says progress can be continued on any device.

When you deploy (e.g. Vercel), add the same two variables in the host's environment settings.

**Optional PIN per profile**
- In **Settings → Your profile & sync**, tap **Protect with a PIN** (4 digits). New profiles are also offered a PIN right after you type your name.
- On another device, picking a protected name asks for the PIN before any progress loads. After 5 wrong tries the profile is locked for 5 minutes.
- Only a salted hash of the PIN is stored, and it's checked by your server. Each device keeps a token that stops working if the PIN is changed; that device then asks for the new PIN, and its local progress is kept.
- **Already set up Supabase before PINs existed?** Run `supabase/migrations/002_learner_pin.sql` once in the SQL Editor. Until then everything works, just without PINs.
- Optional: set `AUTH_SECRET` (any long random string) to sign PIN tokens; otherwise a key is derived from `SUPABASE_SECRET_KEY`.

**Privacy note:** the list of names is visible to anyone who can open your site. Without a PIN, anyone can continue as that learner. The table has Row Level Security enabled with no policies, so the public Supabase keys can't read it. Only your server can, using the secret key, which is never sent to the browser.

---

### Reminders (optional)

A daily "time to practise" notification at the time each learner picks in **Settings → Daily practice reminder**. It works on Android and desktop Chrome, and on iPhone once the app is added to the Home Screen (iOS 16.4+). Reminders are sent by the server, so they only start working once the site is deployed.

**Setup (after deploying, about 5 minutes)**
1. In the project folder run `node scripts/generate-vapid-keys.mjs`. It prints `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and `CRON_SECRET`. Change `VAPID_SUBJECT` to your email (`mailto:you@example.com`).
2. Add those four variables to your host's environment variables (Vercel → Project → Settings → Environment Variables) and redeploy.
3. In Supabase → SQL Editor, run `supabase/migrations/003_push_subscriptions.sql`.
4. Open the deployed site, go to Settings, turn on the reminder and tap **Send a test notification**.

**How often it checks.** `vercel.json` asks Vercel Cron to call `/api/push/cron` every hour. On Vercel's free Hobby plan, cron jobs may run only once a day, so reminders could arrive late. Two fixes: upgrade to a paid plan, or use a free external scheduler such as [cron-job.org](https://cron-job.org) to call `https://YOUR-SITE/api/push/cron` every 15 minutes with the header `Authorization: Bearer YOUR_CRON_SECRET`. Each device gets at most one reminder per local day, however often the route is called.

**Privacy.** Only the browser's push address, the reminder time and the time zone are stored (in the server-only `push_subscriptions` table). Turning the reminder off deletes it.

## Testing the microphone and MIDI
- **Microphone.** Open `/tuner` on `localhost` or over HTTPS, since browsers block the mic on insecure origins. Press **Listen to me**, allow access, and pluck one string at a time. For best results, turn off noise suppression in your OS, keep the room quiet and hold the phone or laptop near the guitar's sound hole. A piano works the same way at `/practice/note-detector`. Very low notes (below about A1) are unreliable.
- **MIDI.** Use Chrome, Edge or Opera on desktop (Safari doesn't support Web MIDI). Plug the keyboard in *before* opening `/piano-lab`, then click **Connect MIDI keyboard**. Notes light up the keys and are checked exactly in exercises.
- **Automated tests** never use real hardware. Playwright replaces `getUserMedia` with an oscillator-based MediaStream (`e2e/helpers.ts`), so the real pitch-detection code runs on a known frequency.

---

## Deploying
- **Vercel or any Node host.** Run `npm run build`, then `npm start`. With no env vars the app runs in local-first mode. Every user's progress stays in their own browser.
- **With cross-device profiles.** Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` to your host's environment variables (after running `supabase/schema.sql` once).
- **HTTPS is required** for the microphone, MIDI and the service worker in production.
- **Offline support.** The service worker (`public/sw.js`) caches the app shell and pages you have visited for offline use. Video embeds and profile sync still need a connection (sync catches up automatically when you're back online).

---

## Browser support
| | Chrome / Edge | Firefox | Safari |
| --- | --- | --- | --- |
| Virtual instruments, lessons | ✅ | ✅ | ✅ |
| Microphone tuner / feedback | ✅ | ✅ | ✅ (needs a click to start audio) |
| Web MIDI | ✅ | ✅ (108+) | ❌ |

---

## Content and copyright
- **Songs.** Bollywood songs are **chords only** (no lyrics or melody, which are copyrighted). Each chord chart was cross-checked against at least two independent chord sources, which are listed on the song page; where sources disagreed, the disputed section was left out or flagged. Timing is approximate, so play along with the original recording. The 165-song Hindi list has singer, film, year and composer details checked against Wikipedia or official credits, plus links to official audio, a chord web search, and the add-your-own-chords editor. Original practice pieces and public-domain classics include melodies.
- **Videos** are only ones whose IDs were confirmed through YouTube's oEmbed endpoint, each with a `verifiedAt` date in `src/content/videos.ts`. Categories without verified videos show clearly labelled YouTube search links instead.

## Known limitations
See [`docs/STATUS.md`](docs/STATUS.md) for the full list of implemented features and known limitations.
