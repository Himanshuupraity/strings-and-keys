# Implementation status

Verified on 2026-10-18 with: `npm run typecheck` (clean), `npm run lint` (clean), `npm test` (545 unit tests passing), `npm run build` (190 pages), and `npm run test:e2e` (15 Playwright tests passing, with the microphone and Supabase API mocked).

## Implemented

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

**Song Lab**
- 7 public-domain songs and 5 original practice pieces.
- A catalogue of 12 popular songs that links to official and licensed sources only.
- A custom song editor.
- Play-along with tempo control, looping, metronome, capo helper, simplified chords and measured note feedback.

**Video Hub**
- 48 YouTube lessons, each verified through oEmbed.
- Search and filters, click-to-load privacy embeds, favourites, watched state and lesson-based recommendations.

**Progress**
- Dashboard with today's plan, streak, a weekly chart (sample data clearly labelled), skills, drill goal, songs and achievements.
- Progress page with per-track completion vs mastery, drill history, exercise results and quiz history.

**Persistence**
- Local-first storage: IndexedDB, falling back to localStorage, then memory.
- zod validation, schema versioning, and quota/failure fallback.
- Backup export and import with a conflict review.
- Name-based learner profiles: the first visit asks your name. With Supabase configured, progress syncs automatically and you can pick your name on any device to continue. Concurrent changes are merged, never silently overwritten.

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
- **Missing songs.** Some traditional songs (Greensleeves, Scarborough Fair and others) were left out because their exact rhythms couldn't be verified with confidence.
- **Popular songs** never include chords. You add your own through the custom editor.
- **Videos** were verified on 2026-10-18 and may later be removed by their owners. Each one still has a "Watch on YouTube" fallback link.
- **Audio quality.** Piano and guitar sounds are synthesised with Tone.js (FM synth and Karplus-Strong pluck) rather than sampled, so they work offline with no downloads.
