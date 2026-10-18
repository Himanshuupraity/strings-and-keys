# Implementation status

Verified on 2026-10-18 with: `npm run typecheck` (clean), `npm run lint` (clean), `npm test` (545 unit tests passing), `npm run build` (190 pages), and `npm run test:e2e` (15 Playwright tests passing, with the microphone and Supabase API mocked).

## Implemented

**Mobile (primary target)**
- Every main page is checked at 360px and 390px: no sideways page scrolling (guarded by an end-to-end test), text fields are 16px so iOS doesn't zoom, touch targets are 40–44px on phones, taps fire without the double-tap delay, and safe-area insets are respected (notch and home indicator).
- Phone layouts: compact header (volume and theme move into the menu), equal-width bottom bar, toasts above the bottom bar, piano keyboard shown before its settings, song-sheet settings collapsible, and no duplicate instrument switch on the dashboard.
- Installable: "Add to Home Screen" on iPhone and Android, with PNG and maskable icons, a standalone display mode and the offline service worker.

**Foundation**
- Next.js 16, TypeScript and Tailwind v4.
- Design tokens with light and dark themes. The theme follows the OS on first visit, is remembered after that, and is applied before first paint so there is no flash.
- Sidebar navigation on desktop, a drawer on tablet, and a bottom bar on mobile.
- A persistent Guitar / Piano mode switch.
- Global volume control and a live microphone indicator.
- PWA manifest and an offline service worker.

**Music core** (`src/lib/music`, all tested)
- Note and MIDI mapping across the full 88 keys.
- Frequency ↔ note conversion with cents.
- Fretboard maps, including capo.
- Chord construction with correct spelling, and verified guitar shapes (open and movable barre).
- Scales, the circle of fifths and diatonic chords.
- Key-aware transposition.
- Capo arrangements that keep the original sounding chords, verified from real fret positions.
- Sargam with a movable Sa.

**Curriculum**
- 128 lessons across levels 0–7, covering theory, guitar and piano, each with prerequisites.
- Every lesson has interactive exercises and a quiz.
- Completion and mastery are separate, and lessons unlock based on prerequisites or placement.
- Diagnostic placement quiz and onboarding.

**Lesson player**
- Explain / listen / visual / exercise / self-check steps, with "Explain again", "Play an example" and hints.
- Glossary popovers and optional Hinglish.
- Seven exercise types, checked automatically from the virtual instrument, MIDI or the microphone.

**Piano Lab**
- 49 / 61 / 88-key presets (saved), a 2-octave focus view and zoom.
- Labels in Western, Sargam or both.
- Mouse, touch, computer keyboard and Web MIDI input.
- Chord naming and guided exercises with finger numbers.

**Guitar Lab**
- Fretboard explorer with up to 24 frets and a left-handed view.
- Chord and scale explorers.
- Capo simulator and Easy Chord Transposer.
- Eight guided exercises and a tuning reference.

**Practice toolkit**
- Microphone guitar tuner with a cents needle and adjustable A4.
- Piano note detector.
- Drift-free metronome with tap tempo.
- Chord trainer, scale trainer, rhythm trainer and ear training (including swaras).
- Practice timer.
- 1-Minute Chord Change drill, in self-reported and audio-assisted modes.

**Coach**
- Listening teacher loop: explain → demo → listen → feedback → adapt.
- Chat with saved history.
- Built-in rule-based teacher that runs in the browser: no API key, no network, works offline.

**Song Lab (Bollywood first)**
- 29 Bollywood chord charts, each cross-checked against 2+ independent chord sources (listed on the page). Chords only, with capo help, strumming, chord diagrams, piano accompaniment, looping and slow play-along.
- A searchable list of 165 Bollywood/Hindi songs (singers, film, year and composer checked against a source page), with Listen, Find chords and Add chords buttons, a decade filter and search by song, film, singer or composer.
- Song sheets: paste lyrics + chords (chords-over-lyrics, ChordPro, or Ultimate-Guitar-style [ch]/[tab] markup), then sing along. Each sheet can save its source page link; "Find on Ultimate Guitar" search buttons on charts, catalogue songs and sheets (we link to UG; we never copy its content). Chords are shown above the words; follow-my-voice moves line by line from your sung phrases and pauses (on-device, no speech recognition); auto-scroll and manual/pedal navigation; transpose, capo and chord diagrams; an optional YouTube video beside the sheet. Saved to the learner's profile.
- 5 original Hindi-style practice pieces with melodies; public-domain English classics in a separate tab; a custom song editor.

**Video Hub**
- 112 YouTube lessons (67 taught in Hindi/Hinglish, including 45 Hindi piano/keyboard lessons), each verified through oEmbed; Hindi/English language filter, quick picks for Hindi piano and Hindi guitar, Hindi lessons listed first.
- Search and filters, click-to-load privacy embeds, favourites, watched state and lesson-based recommendations.

**Progress**
- Dashboard with today's plan, streak, a weekly chart (sample data clearly labelled), skills, drill goal, songs and achievements.
- Progress page with per-track completion vs mastery, drill history, exercise results and quiz history.

**Persistence**
- Local-first storage: IndexedDB, falling back to localStorage, then memory.
- zod validation, schema versioning, and quota/failure fallback.
- Backup export and import with a conflict review.
- Name-based learner profiles: the first visit asks your name. With Supabase configured, progress syncs automatically and you can pick your name on any device to continue. Concurrent changes are merged, never silently overwritten.

**Daily practice reminders**
- Web Push reminders at a time each learner picks (Settings). Server routes (`/api/push/*`), a server-only `push_subscriptions` table, an idempotent cron route (at most one reminder per local day, time-zone and DST aware), service-worker push and notification-click handlers, iPhone "Add to Home Screen" guidance, and a test-notification button.

## Known limitations
- **Microphone chord recognition** is a chroma-based estimate with a confidence score. It is not a reliable transcription in noisy rooms. MIDI is exact. Technique such as finger pressure, posture and fingering can't be measured; it is covered by self-checks.
- **Very low notes.** Piano notes below about A1, and very quiet strings, may not be detected reliably.
- **Touch and Bluetooth delay.** Tap-rhythm timing on touch screens or Bluetooth audio includes device latency. The rhythm trainer offers latency calibration.
- **Web MIDI** is unavailable in Safari.
- **Rate limits** on the optional auth endpoints are in-memory, so they apply per server instance.
- **The coach** is rule-based, not a large language model: it handles common beginner questions and measured feedback well, but open-ended questions outside its topics get a general suggestion and a pointer to the right lesson.
- **Profiles are name-only (no password).** Anyone who can open the site can see the list of names and continue as any learner. Fine for personal or family use; not for private data.
- **Sync is whole-profile.** Each sync uploads the learner's full progress bundle (capped at 2 MB, far more than years of practice history). Deleting a record on one device doesn't delete it on another that still has it, so a merge can bring it back.
- **Rename in Supabase mode.** You can't rename a learner from the app; use Switch learner and create a new name, or edit the row in Supabase.
- **Bollywood chord charts are chords only, with approximate timing.** Lyrics and melodies are copyrighted. Chord sources are fan transcriptions; disputed sections were removed (Khairiyat chorus, Kabira verse, Pehla Nasha verse) and caveats are shown on the song page (Dil Diyan Gallan, Tum Se Hi, Zara Sa, Phir Le Aya Dil).
- **Songs in the 165-song list have no chords or lyrics.** Use Find chords, then paste lyrics + chords into a song sheet. The app never ships copyrighted lyrics; sheets contain only what you paste, for your own practice.
- **Follow-my-voice follows phrasing, not words.** It moves on after each sung line and pause. Long held notes or loud strumming can make it early or late; arrows, a tap or a page-turner pedal correct it.
- **Videos** were verified on 2026-10-18 and may later be removed by their owners. Each one still has a "Watch on YouTube" fallback link.
- **Audio quality.** Piano uses recorded Salamander Grand Piano samples (2 MB, downloaded on the first note, CC BY 3.0) with the light synth as a fallback or option; guitar is still synthesised (Karplus-Strong pluck).
- **Reminders need deployment plus setup** (VAPID keys, a SQL migration, a cron schedule). On Vercel Hobby, cron may run only daily; use an external scheduler for timely reminders. On iPhone they work only from the Home Screen app (iOS 16.4+). Not tested end-to-end with a real push service in this environment.
