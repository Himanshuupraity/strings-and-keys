import type { Lesson } from "../types";
import { chordMidi, shapeMidi, easiestShape } from "@/lib/music/chords";
import { scaleMidi } from "@/lib/music/scales";
import { explain, lesson, listen, practice, q, selfCheck, show } from "./advanced-builders";

/**
 * Level 6 — Intermediate playing. Guitar (g6-), piano (p6-) and shared skills (t6-).
 * Guitar string indexes: 0 = low E (6th string) … 5 = high E (1st string).
 */

// A minor pentatonic, box 1 at the 5th fret (string index, fret).
const PENTA_BOX: { string: number; fret: number }[] = [
  { string: 0, fret: 5 }, { string: 0, fret: 8 },
  { string: 1, fret: 5 }, { string: 1, fret: 7 },
  { string: 2, fret: 5 }, { string: 2, fret: 7 },
  { string: 3, fret: 5 }, { string: 3, fret: 7 },
  { string: 4, fret: 5 }, { string: 4, fret: 8 },
  { string: 5, fret: 5 }, { string: 5, fret: 8 },
];
const STD = [40, 45, 50, 55, 59, 64];
const PENTA_BOX_MIDI = PENTA_BOX.map((p) => STD[p.string] + p.fret);

/** Open C chord, strings 5→1, as an arpeggio (C3 E3 G3 C4 E4). */
const C_ARPEGGIO = shapeMidi(easiestShape("C")!);

export const LEVEL_6: Lesson[] = [
  /* ---------------- Guitar ---------------- */
  lesson({
    id: "g6-barre-chords",
    track: "guitar",
    level: 6,
    order: 1,
    title: "Barre chords",
    summary: "One finger across all strings: the E-shape and A-shape barres.",
    minutes: 15,
    skills: ["barre-chords"],
    prerequisites: ["g3-riffs-melodies"],
    topics: ["guitar-chords", "guitar-intermediate"],
    glossary: [{ term: "Barre", meaning: "Pressing several strings at once with one flat finger (usually the index)." }],
    steps: [
      explain("idea", "A movable capo made of your finger", "A barre chord uses your index finger like a capo across the strings, with the other fingers making an open-chord shape above it. Because nothing is open, you can slide the same shape anywhere: the root note on the 6th or 5th string names the chord.", { hinglish: "Index finger se saare strings dabao — jaise ungli hi capo ban gayi ho." }),
      show("f-barre", "F major (E-shape at fret 1) and Bm (A-shape at fret 2)", "F: 1-3-3-2-1-1. Bm: x-2-4-4-3-2.", { type: "chord-diagram", chords: ["F", "Bm"] }),
      explain("tips", "Making it ring", "Roll the index finger slightly onto its bony side. Keep your thumb behind the neck, around the middle. Use arm weight (pull back gently) rather than squeezing hard. Expect buzzing for a couple of weeks — that's normal.", {}),
      practice("play-f", "Play F barre", "Strum F barre and let it ring.", { type: "play-chord", instrument: "guitar", chord: "F", prompt: "Play the F barre chord (1-3-3-2-1-1)." }, { mastery: true }),
      practice("play-bm", "Play Bm barre", "A-shape minor at fret 2.", { type: "play-chord", instrument: "guitar", chord: "Bm", prompt: "Play Bm (x-2-4-4-3-2)." }),
      selfCheck("barre-check", "String-by-string check", "Pick each string one at a time while holding the barre. The microphone can't tell which finger is muting a string, so check by ear.", ["All six strings ring for F.", "No string is muted by the underside of another finger.", "My thumb is relaxed behind the neck.", "I rest when my hand gets tired."]),
    ],
    quiz: [
      q("q1", "In an E-shape barre at fret 3, the chord is…", ["G", "A", "F"], 0, "The 6th string at fret 3 is G."),
      q("q2", "Bm A-shape: where's the barre?", ["Fret 1", "Fret 2", "Fret 4"], 1, "The 5th string at fret 2 is B."),
      q("q3", "Best way to press a barre?", ["Squeeze as hard as possible", "Use arm weight and roll the finger slightly"], 1, "Arm weight and finger angle beat raw squeezing."),
    ],
  }),

  lesson({
    id: "g6-strumming-variations",
    track: "guitar",
    level: 6,
    order: 2,
    title: "Strumming variations",
    summary: "Down-down-up-up-down-up, syncopation and palm muting.",
    minutes: 12,
    skills: ["strumming-patterns"],
    prerequisites: ["g6-barre-chords"],
    topics: ["rhythm", "strumming"],
    steps: [
      explain("pattern", "The 'campfire' pattern", "Count '1 & 2 & 3 & 4 &'. Your hand always moves down on numbers and up on '&'. Play: D (1), D (2), U (2&), [miss 3], U (3&), D (4), U (4&). Missing the strings on beat 3 creates the bounce.", {}),
      listen("hear", "Hear the rhythm", "D D U _ U D U at 80 BPM.", { type: "rhythm", pattern: [0, 1, 1.5, 2.5, 3, 3.5], bpm: 80, beatsPerBar: 4 }),
      practice("tap", "Tap the strum pattern", "Tap each strum (down or up) in time.", { type: "tap-rhythm", prompt: "Tap: 1, 2, &, (skip 3), &, 4, &", pattern: [0, 1, 1.5, 2.5, 3, 3.5], bpm: 70, beatsPerBar: 4, bars: 2 }, { mastery: true, passAccuracy: 0.75 }),
      explain("palm", "Palm muting", "Rest the side of your picking hand lightly on the strings right next to the bridge. Strums become short and chunky — great for rock and pop verses.", {}),
      selfCheck("strum-check", "Strumming self-check", "", ["My strumming hand never stops moving, even on missed strums.", "Down strums are on the numbers, up strums on '&'.", "I can play the pattern on G–C–D without stopping."]),
    ],
    quiz: [
      q("q1", "Up strums usually fall on…", ["The numbers", "The '&'s"], 1, "Down on beats, up on the off-beats."),
      q("q2", "What makes the pattern 'bounce'?", ["Missing beat 3", "Strumming harder"], 0, "Skipping the strings on 3 (while the hand keeps moving) creates syncopation."),
      q("q3", "Palm muting is done with…", ["The fretting hand", "The side of the picking hand near the bridge"], 1, "Rest the picking-hand edge near the bridge."),
    ],
  }),

  lesson({
    id: "g6-fingerstyle",
    track: "guitar",
    level: 6,
    order: 3,
    title: "Fingerstyle basics (p-i-m-a)",
    summary: "Pick strings with thumb and fingers instead of a pick.",
    minutes: 14,
    skills: ["fingerstyle"],
    prerequisites: ["g6-barre-chords"],
    topics: ["fingerstyle", "guitar-intermediate"],
    glossary: [{ term: "p i m a", meaning: "Picking-hand fingers (Spanish names): p = thumb, i = index, m = middle, a = ring." }],
    steps: [
      explain("pima", "Assign fingers to strings", "Thumb (p) plays the bass strings 6, 5 and 4. Index (i) plays string 3, middle (m) string 2, ring (a) string 1. Hold a chord and play p–i–m–a, one string at a time.", {}),
      listen("pattern", "C chord: p-i-m-a-m-i", "Bass C on the 5th string, then G, C, E, C, G.", { type: "notes", notes: [48, 55, 60, 64, 60, 55], step: 0.3, instrument: "guitar" }),
      show("tab", "The pattern in tab", "Hold C and play this pattern.", { type: "tab", lines: ["e|-------0-------|", "B|-----1---1-----|", "G|---0-------0---|", "D|---------------|", "A|-3-------------|", "E|---------------|"] }),
      practice("play", "Play p-i-m-a-m-i on C", "C3, G3, C4, E4, C4, G3.", { type: "play-sequence", instrument: "guitar", notes: [48, 55, 60, 64, 60, 55], prompt: "Play the fingerstyle pattern on C." }, { mastery: true }),
      selfCheck("finger-check", "Technique check (self-assessment)", "Audio can tell which notes sounded, not which finger played them.", ["My thumb plays the bass strings.", "Each finger stays assigned to its string.", "My picking-hand wrist is relaxed and slightly arched."]),
    ],
    quiz: [
      q("q1", "'p' stands for…", ["Pinky", "Thumb (pulgar)", "Pick"], 1, "p = pulgar = thumb."),
      q("q2", "Which finger usually plays string 2?", ["i", "m", "a"], 1, "m (middle) plays string 2."),
      q("q3", "The thumb usually plays…", ["The bass strings", "Only the high E"], 0, "Thumb covers strings 6, 5 and 4."),
    ],
  }),

  lesson({
    id: "g6-arpeggios",
    track: "guitar",
    level: 6,
    order: 4,
    title: "Arpeggios on guitar",
    summary: "Play chord notes one at a time, low to high.",
    minutes: 12,
    skills: ["guitar-arpeggios"],
    prerequisites: ["g6-fingerstyle"],
    topics: ["fingerstyle", "chords"],
    glossary: [{ term: "Arpeggio", meaning: "The notes of a chord played one after another instead of together." }],
    steps: [
      explain("what", "Broken chords", "An arpeggio plays the notes of a chord separately. Hold the full chord shape so each note rings into the next.", {}),
      listen("c-arp", "C arpeggio", "C (5th string, fret 3), E, G, C, E.", { type: "notes", notes: C_ARPEGGIO, step: 0.3, instrument: "guitar" }),
      practice("play-c-arp", "Play the C arpeggio", "Strings 5 to 1 while holding C.", { type: "play-sequence", instrument: "guitar", notes: C_ARPEGGIO, prompt: "Arpeggiate the open C chord, low to high." }, { mastery: true }),
      practice("play-am-arp", "Play the Am arpeggio", "Hold Am and pick strings 5 to 1.", { type: "play-sequence", instrument: "guitar", notes: shapeMidi(easiestShape("Am")!), prompt: "Arpeggiate Am, low to high." }),
    ],
    quiz: [
      q("q1", "An arpeggio is…", ["A chord played note by note", "A scale", "A strumming pattern"], 0, "Notes of a chord one at a time."),
      q("q2", "Notes of a C arpeggio?", ["C E G", "C D E", "C F A"], 0, "C major chord tones."),
      q("q3", "Why hold the whole chord shape?", ["So notes ring into each other", "It's required by law"], 0, "Holding the shape lets notes sustain."),
    ],
  }),

  lesson({
    id: "g6-pentatonic",
    track: "guitar",
    level: 6,
    order: 5,
    title: "The minor pentatonic scale (box 1)",
    summary: "The most-used lead guitar shape, at the 5th fret in A.",
    minutes: 14,
    skills: ["pentatonic-guitar"],
    prerequisites: ["g6-barre-chords"],
    topics: ["scales", "lead-guitar"],
    steps: [
      explain("box", "Two notes per string", "A minor pentatonic (A C D E G) at the 5th fret: index finger on fret 5 of every string; ring finger on fret 7 (strings 5, 4, 3); little finger on fret 8 (strings 6, 2, 1).", {
        visual: { type: "fretboard", frets: 9, highlight: PENTA_BOX.map((p) => ({ ...p })), caption: "A minor pentatonic, box 1" },
      }),
      listen("hear", "Hear it", "Low to high.", { type: "notes", notes: PENTA_BOX_MIDI, step: 0.28, instrument: "guitar" }),
      practice("play-up", "Play the box going up", "Alternate picking: down-up on each string.", { type: "play-sequence", instrument: "guitar", notes: PENTA_BOX_MIDI, prompt: "Play A minor pentatonic box 1, low to high." }, { mastery: true, passAccuracy: 0.8 }),
      practice("play-down", "Play it going down", "From the top back to the low A.", { type: "play-sequence", instrument: "guitar", notes: [...PENTA_BOX_MIDI].reverse(), prompt: "Play the box from high to low." }),
    ],
    quiz: [
      q("q1", "Notes of A minor pentatonic?", ["A C D E G", "A B C D E", "A C# E"], 0, "1 ♭3 4 5 ♭7 of A."),
      q("q2", "Which fret has the root A on the 6th string in box 1?", ["3", "5", "7"], 1, "6th string, fret 5 = A."),
      q("q3", "Move the same box to fret 7 and it becomes…", ["B minor pentatonic", "G minor pentatonic", "A major"], 0, "Two frets higher: A → B."),
    ],
  }),

  lesson({
    id: "g6-lead-basics",
    track: "guitar",
    level: 6,
    order: 6,
    title: "Basic lead guitar",
    summary: "Phrases, repetition and target notes using the pentatonic box.",
    minutes: 12,
    skills: ["lead-basics"],
    prerequisites: ["g6-pentatonic"],
    topics: ["lead-guitar", "improvisation"],
    steps: [
      explain("phrases", "Talk, don't scroll", "Running up and down the scale isn't a solo. Play short phrases (3–5 notes), pause, and answer them. Land on A (the root) or other chord tones at the end of a phrase.", {}),
      listen("lick", "A simple lick", "High E fret 8 (C), high E fret 5 (A), B fret 8 (G), B fret 5 (E), back to high E fret 5 (A).", { type: "notes", notes: [72, 69, 67, 64, 69], step: 0.35, instrument: "guitar" }),
      show("lick-tab", "The lick in tab", "High E fret 8 → 5, B string 8 → 5, high E 5.", { type: "tab", lines: ["e|-8-5-------5-|", "B|-----8-5-----|", "G|-------------|", "D|-------------|", "A|-------------|", "E|-------------|"] }),
      practice("play-lick", "Play the lick", "C5, A4, G4, E4, A4.", { type: "play-sequence", instrument: "guitar", notes: [72, 69, 67, 64, 69], prompt: "Play the lick: e8, e5, B8, B5, e5." }, { mastery: true }),
      selfCheck("lead-check", "Improvise for 2 minutes", "Play over an Am chord (use the backing in the Song Lab or the metronome).", ["I played short phrases with gaps.", "I ended phrases on A.", "I repeated an idea before changing it."]),
    ],
    quiz: [
      q("q1", "A good solo phrase is usually…", ["Short, with space after it", "Every note of the scale as fast as possible"], 0, "Phrasing with space sounds musical."),
      q("q2", "Which note sounds most 'resolved' over Am?", ["A", "D", "G"], 0, "The root of the chord."),
      q("q3", "e|-8- in tab means…", ["High E string, fret 8", "Low E, fret 8", "8th string"], 0, "The top line of tab is the high E string."),
    ],
  }),

  lesson({
    id: "g6-techniques",
    track: "guitar",
    level: 6,
    order: 7,
    title: "Bends, slides, hammer-ons & pull-offs",
    summary: "Expressive techniques — and how they're written in tab.",
    minutes: 15,
    skills: ["guitar-articulations"],
    prerequisites: ["g6-lead-basics"],
    topics: ["lead-guitar", "guitar-technique"],
    glossary: [
      { term: "Hammer-on (h)", meaning: "Pick one note, then 'hammer' another finger down on a higher fret without picking." },
      { term: "Pull-off (p)", meaning: "Pick a fretted note, then pull the finger off sideways to sound a lower note." },
      { term: "Slide (/ or \\)", meaning: "Pick a note and slide the same finger up or down to another fret." },
      { term: "Bend (b)", meaning: "Push the string sideways to raise its pitch. A full bend = 2 semitones." },
    ],
    steps: [
      show("tab", "How they look in tab", "5h7 = hammer-on 5 to 7. 7p5 = pull-off. 5/7 = slide up. 7b9 = bend fret 7 up to the pitch of fret 9 (full bend).", { type: "tab", lines: ["e|---------------|", "B|---------------|", "G|-5h7--7p5--5/7--7b(9)-|", "D|---------------|", "A|---------------|", "E|---------------|"] }),
      listen("hammer", "Hammer-on sound", "G string fret 5 → 7: C4 → D4, smoothly, with only one pick stroke.", { type: "notes", notes: [62, 64], step: 0.25, instrument: "guitar" }),
      practice("hammer-play", "Hammer-on and pull-off", "Play G-string fret 5 → 7 → 5 (C4, D4, C4). Pick only the first note on a real guitar.", { type: "play-sequence", instrument: "guitar", notes: [60, 62, 60], prompt: "Play C4 → D4 → C4 on the G string (5h7p5)." }, { mastery: true }),
      practice("bend-target", "Bend to pitch", "With your real guitar and the microphone: bend G-string fret 7 (D4) up a full step to E4 — the pitch of fret 9. The app checks the pitch you reach.", { type: "mic-note", instrument: "guitar", note: "E4", prompt: "Bend G-string fret 7 up to E4 and hold it." }),
      selfCheck("tech-check", "Technique self-check", "Audio shows pitch, but can't see your fingers.", ["Hammer-ons are loud enough without picking.", "Pull-offs flick slightly sideways, not straight up.", "Bends reach the target pitch (check the tuner).", "I use 2–3 fingers together to bend."]),
    ],
    quiz: [
      q("q1", "A full bend raises the pitch by…", ["1 semitone", "2 semitones", "12 semitones"], 1, "A full (whole-step) bend = 2 semitones."),
      q("q2", "'5h7' means…", ["Hammer-on from fret 5 to 7", "Bend fret 5", "Slide down"], 0, "h = hammer-on."),
      q("q3", "In a pull-off, the second note is…", ["Higher", "Lower"], 1, "You pull off to a lower fret (or open string)."),
    ],
  }),

  lesson({
    id: "g6-backing-tracks",
    track: "guitar",
    level: 6,
    order: 8,
    title: "Playing with a backing track",
    summary: "Lock in with chords and a click — rhythm and lead.",
    minutes: 12,
    skills: ["playing-with-backing"],
    prerequisites: ["g6-strumming-variations", "g6-lead-basics"],
    topics: ["rhythm", "improvisation"],
    steps: [
      listen("track", "Am – G – F – E backing", "Four beats each at 90 BPM. Strum along, then try the pentatonic box (use A harmonic minor's G♯ over E!).", { type: "chords", chords: ["Am", "G", "F", "E"], beatsEach: 4, bpm: 90, instrument: "guitar" }),
      explain("listen-first", "Listen before you play", "Count bars in your head. Notice where each chord changes. Start by playing ONE note on beat 1 of each bar, then add more.", {}),
      practice("roots", "Play the roots", "A, G, F, E — one per bar.", { type: "play-sequence", instrument: "guitar", notes: [45, 43, 41, 40], anyOctave: true, prompt: "Play the roots A, G, F, E." }, { mastery: true }),
      practice("chord-e", "Play the E chord", "The last chord of the loop.", { type: "play-chord", instrument: "guitar", chord: "E", prompt: "Play E major." }),
      selfCheck("band-check", "Band check", "", ["I stayed in time with the backing.", "I changed chords on beat 1.", "I kept going after a mistake instead of stopping."]),
    ],
    quiz: [
      q("q1", "Most important thing when playing with others?", ["Playing fast", "Staying in time", "Playing loud"], 1, "Timing holds a band together."),
      q("q2", "If you make a mistake, you should…", ["Stop and restart", "Keep going and rejoin on the next beat"], 1, "Keep the music flowing."),
      q("q3", "The chord change usually happens on…", ["Beat 1 of a bar", "Random beats"], 0, "Chords usually change on the downbeat."),
    ],
  }),

  /* ---------------- Piano ---------------- */
  lesson({
    id: "p6-two-hands",
    track: "piano",
    level: 6,
    order: 1,
    title: "Two-hand coordination: melody + chords",
    summary: "Right-hand melody over left-hand block chords.",
    minutes: 14,
    skills: ["two-hand-intermediate"],
    prerequisites: ["p4-two-hands"],
    topics: ["piano-intermediate", "piano-technique"],
    steps: [
      explain("layers", "Melody on top, harmony below", "Most pop and film piano parts are a melody in the right hand and chords in the left. Practise the left hand chords alone until they're automatic, then add the melody.", {}),
      listen("demo", "C – F – G – C left hand", "Block chords, one per bar.", { type: "chords", chords: ["C", "F", "G", "C"], beatsEach: 4, bpm: 80, instrument: "piano" }),
      practice("lh-c", "Left hand: C chord", "C3 E3 G3 together.", { type: "play-chord", instrument: "piano", chord: "C", prompt: "Play C major with the left hand." }),
      practice("lh-f", "Left hand: F chord", "Try C3 F3 A3 (second inversion) to stay close to C.", { type: "play-chord", instrument: "piano", chord: "F", prompt: "Play F major (C F A) with the left hand." }, { mastery: true }),
      practice("rh-melody", "Right hand melody", "E D C D E E E over the chords.", { type: "play-sequence", instrument: "piano", notes: ["E4", "D4", "C4", "D4", "E4", "E4", "E4"], prompt: "Play the melody with the right hand." }),
      selfCheck("check", "Hands together check", "", ["I played LH alone first.", "Both hands started each bar together.", "I slowed down to stay accurate."]),
    ],
    quiz: [
      q("q1", "In most accompaniments, the left hand plays…", ["Chords or bass", "The melody"], 0, "LH supplies harmony and bass."),
      q("q2", "C F A is which chord?", ["F major (2nd inversion)", "A minor", "C major"], 0, "F A C rearranged as C F A = F in second inversion."),
      q("q3", "When hands together is hard, you should…", ["Speed up", "Slow down and loop a short section"], 1, "Slow, small loops build coordination."),
    ],
  }),

  lesson({
    id: "p6-inversions",
    track: "piano",
    level: 6,
    order: 2,
    title: "Smooth voice leading with inversions",
    summary: "C – F – G with minimal hand movement.",
    minutes: 12,
    skills: ["inversions-piano"],
    prerequisites: ["p6-two-hands", "t5-inversions"],
    topics: ["chords", "piano-intermediate"],
    steps: [
      explain("close", "Move as little as possible", "Instead of jumping your whole hand from C to F to G, use inversions: C (C E G) → F second inversion (C F A) → G first inversion (B D G). The thumb barely moves!", {}),
      listen("hear", "Hear smooth chords", "C (C E G), F (C F A), G (B D G), C.", { type: "notes", notes: [60, 64, 67, 60, 65, 69, 59, 62, 67, 60, 64, 67], step: 0.22, instrument: "piano" }),
      show("kbd", "F in second inversion", "C4 F4 A4.", { type: "keyboard", low: 55, high: 72, highlight: ["C4", "F4", "A4"], caption: "F/C" }),
      practice("play-seq", "Play C – F/C – G/B", "Play each chord's notes from bottom to top.", { type: "play-sequence", instrument: "piano", notes: [60, 64, 67, 60, 65, 69, 59, 62, 67], prompt: "C E G, C F A, B D G." }, { mastery: true }),
    ],
    quiz: [
      q("q1", "G with B in the bass is…", ["Root position", "First inversion", "Second inversion"], 1, "B is the 3rd of G: first inversion."),
      q("q2", "Why use inversions in accompaniment?", ["Smoother, closer hand movement", "To change the chord"], 0, "Less movement = smoother sound."),
      q("q3", "C F A contains which chord?", ["F major", "C major", "A minor"], 0, "F A C = F major."),
    ],
  }),

  lesson({
    id: "p6-arpeggios",
    track: "piano",
    level: 6,
    order: 3,
    title: "Piano arpeggios",
    summary: "Chord notes spread across octaves with a thumb crossing.",
    minutes: 14,
    skills: ["piano-arpeggios"],
    prerequisites: ["p6-two-hands"],
    topics: ["piano-technique"],
    steps: [
      explain("fingering", "Fingering", "C major arpeggio, right hand, two octaves: C E G C E G C with fingers 1 2 3 1 2 3 5. After G (finger 3), the thumb passes under to the next C.", {}),
      listen("hear", "C major arpeggio", "Two octaves up.", { type: "notes", notes: [60, 64, 67, 72, 76, 79, 84], step: 0.25, instrument: "piano" }),
      practice("play", "Play the C arpeggio", "Smooth thumb crossing, even rhythm.", { type: "play-sequence", instrument: "piano", notes: [60, 64, 67, 72, 76, 79, 84], fingers: [1, 2, 3, 1, 2, 3, 5], prompt: "Play the two-octave C arpeggio." }, { mastery: true }),
      practice("play-am", "A minor arpeggio", "A C E A (one octave): fingers 1 2 3 5.", { type: "play-sequence", instrument: "piano", notes: [57, 60, 64, 69], fingers: [1, 2, 3, 5], prompt: "Play A C E A." }),
    ],
    quiz: [
      q("q1", "Notes in a C major arpeggio?", ["C E G", "C D E", "C F A"], 0, "C major chord tones."),
      q("q2", "Where does the thumb cross under (RH, C arpeggio)?", ["After G, to C", "After C, to E"], 0, "1-2-3 on C-E-G, then thumb under to C."),
      q("q3", "Notes of A minor arpeggio?", ["A C E", "A C# E", "A D E"], 0, "A minor triad."),
    ],
  }),

  lesson({
    id: "p6-broken-chords",
    track: "piano",
    level: 6,
    order: 4,
    title: "Broken chords & Alberti bass",
    summary: "Low–high–middle–high: the classic left-hand pattern.",
    minutes: 12,
    skills: ["alberti-bass", "broken-chords"],
    prerequisites: ["p6-arpeggios"],
    topics: ["piano-accompaniment"],
    glossary: [{ term: "Alberti bass", meaning: "A broken-chord pattern: lowest, highest, middle, highest (e.g. C–G–E–G)." }],
    steps: [
      explain("pattern", "Low – high – middle – high", "Take a C chord C E G. Alberti bass plays C (low) – G (high) – E (middle) – G (high), repeating. Mozart and Haydn used it constantly — and you'll hear similar ideas in many film songs.", {}),
      listen("hear", "Alberti bass on C and G7", "C–G–E–G, then B–F–D–F.", { type: "notes", notes: ["C3", "G3", "E3", "G3", "C3", "G3", "E3", "G3", "B2", "F3", "D3", "F3", "C3", "G3", "E3", "G3"], step: 0.2, instrument: "piano" }),
      practice("play-alberti", "Play Alberti bass on C", "Left hand fingers 5-1-3-1.", { type: "play-sequence", instrument: "piano", notes: ["C3", "G3", "E3", "G3", "C3", "G3", "E3", "G3"], fingers: [5, 1, 3, 1, 5, 1, 3, 1], prompt: "Play C–G–E–G twice with the left hand." }, { mastery: true }),
      practice("play-broken", "Broken chord up", "C3 E3 G3 C4 — one note at a time.", { type: "play-sequence", instrument: "piano", notes: ["C3", "E3", "G3", "C4"], prompt: "Play a broken C chord upward." }),
    ],
    quiz: [
      q("q1", "Alberti bass order?", ["Low–high–middle–high", "Low–middle–high–middle", "High–low–high–low"], 0, "E.g. C–G–E–G."),
      q("q2", "Alberti bass on G7 (B D F) is…", ["B–F–D–F", "B–D–F–D", "G–B–D–F"], 0, "Low B, high F, middle D, high F."),
      q("q3", "Which hand usually plays Alberti bass?", ["Left", "Right"], 0, "It's an accompaniment figure for the left hand."),
    ],
  }),

  lesson({
    id: "p6-accompaniment",
    track: "piano",
    level: 6,
    order: 5,
    title: "Accompaniment patterns",
    summary: "Ballad, pop and waltz patterns for any chord progression.",
    minutes: 14,
    skills: ["piano-accompaniment"],
    prerequisites: ["p6-broken-chords", "t5-progressions"],
    topics: ["piano-accompaniment", "songs"],
    steps: [
      explain("patterns", "Three go-to patterns", "Ballad: LH holds the root as a whole note, RH plays the chord on each beat. Pop: LH root on 1 and 3, RH chord on 2 and 4 (or a steady rhythm). Waltz (3/4): LH root on 1, RH chord on 2 and 3 ('oom-pah-pah').", {}),
      listen("pop", "I–V–vi–IV ballad in C", "C – G – Am – F.", { type: "chords", chords: ["C", "G", "Am", "F"], beatsEach: 4, bpm: 76, instrument: "piano" }),
      practice("waltz", "Waltz rhythm", "Tap 'oom-pah-pah': three even beats per bar.", { type: "tap-rhythm", prompt: "Tap each beat of 3/4: 1, 2, 3.", pattern: [0, 1, 2, 3, 4, 5], bpm: 90, beatsPerBar: 3, bars: 2 }),
      practice("am-chord", "Play the vi chord", "Am in C major: A C E.", { type: "play-chord", instrument: "piano", chord: "Am", prompt: "Play A minor." }, { mastery: true }),
      selfCheck("acc-check", "Accompaniment check", "", ["I can play I–V–vi–IV in C with a steady pattern.", "The left hand plays the root of each chord.", "I can sing or hum the melody over my accompaniment."]),
    ],
    quiz: [
      q("q1", "A waltz is usually in…", ["4/4", "3/4", "6/8"], 1, "Waltzes have three beats per bar."),
      q("q2", "In a basic ballad pattern the LH plays…", ["The root of each chord", "The melody"], 0, "Root in the bass grounds the harmony."),
      q("q3", "I–V–vi–IV in C is…", ["C G Am F", "C F G C", "C Am F G"], 0, "I=C, V=G, vi=Am, IV=F."),
    ],
  }),

  lesson({
    id: "p6-dynamics",
    track: "piano",
    level: 6,
    order: 6,
    title: "Dynamic control",
    summary: "pp to ff, crescendo and diminuendo.",
    minutes: 10,
    skills: ["dynamics"],
    prerequisites: ["p6-two-hands"],
    topics: ["piano-technique", "expression"],
    glossary: [
      { term: "Dynamics", meaning: "How loud or soft: pp (very soft), p, mp, mf, f, ff (very loud)." },
      { term: "Crescendo / diminuendo", meaning: "Gradually louder / gradually softer." },
    ],
    steps: [
      explain("speed", "Volume = key speed", "On a piano (and touch-sensitive keyboards), volume depends on how FAST the key goes down, not how hard you push after. Drop arm weight quickly for forte; move the key gently for piano.", {}),
      listen("compare", "A phrase to shape", "Listen to this phrase, then play it on your instrument twice: once very softly (p) and once loudly (f).", { type: "notes", notes: ["C4", "E4", "G4", "C5"], step: 0.4, instrument: "piano" }),
      practice("phrase", "Crescendo phrase", "Play C D E F G getting louder. With a velocity-sensitive MIDI keyboard you'll see the velocity; on the virtual keyboard, volume isn't measured.", { type: "play-sequence", instrument: "piano", notes: ["C4", "D4", "E4", "F4", "G4"], prompt: "Play C D E F G with a crescendo." }),
      selfCheck("dyn-check", "Dynamics self-check", "Record yourself on your phone and listen back.", ["I can play clearly soft (p) and clearly loud (f).", "My crescendo grows evenly, not suddenly.", "I relax after loud notes."]),
    ],
    quiz: [
      q("q1", "'mf' means…", ["Moderately loud", "Very soft", "Very loud"], 0, "mezzo-forte = moderately loud."),
      q("q2", "Piano volume depends mostly on…", ["Key speed", "Pressing after the key is down"], 0, "Faster key descent = louder."),
      q("q3", "A diminuendo means…", ["Getting louder", "Getting softer"], 1, "Diminuendo = gradually softer."),
    ],
  }),

  lesson({
    id: "p6-pedal",
    track: "piano",
    level: 6,
    order: 7,
    title: "Pedal coordination",
    summary: "Legato pedalling through a progression.",
    minutes: 10,
    skills: ["pedal-coordination"],
    prerequisites: ["p6-accompaniment", "p4-sustain-pedal"],
    topics: ["piano-technique"],
    steps: [
      explain("syncopated", "Syncopated (legato) pedal", "Play chord → pedal down → play next chord AND lift the pedal at the same time → pedal down again. The foot is always a little behind the hands.", {}),
      listen("hear", "C – Am – F – G with legato pedal", "Connected chords, no blur.", { type: "chords", chords: ["C", "Am", "F", "G"], beatsEach: 4, bpm: 70, instrument: "piano" }),
      practice("chord", "Play the progression's G chord", "Then practise the pedal on your own instrument.", { type: "play-chord", instrument: "piano", chord: "G", prompt: "Play G major." }),
      selfCheck("pedal", "Pedal self-check", "The app can't hear or see your pedal reliably.", ["The pedal lifts exactly when the next chord sounds.", "There's no gap of silence between chords.", "There's no blur of two chords."]),
    ],
    quiz: [
      q("q1", "In legato pedalling, when do you lift?", ["Before playing the next chord", "As you play the next chord", "Never"], 1, "Lift as the new chord sounds, then press again."),
      q("q2", "Too-late lifting causes…", ["Silence", "Blurring"], 1, "Old notes overlap new ones."),
      q("q3", "Too-early pressing (before the new chord) causes…", ["The old chord to blur in", "Nothing"], 0, "The pedal catches the old chord too."),
    ],
  }),

  lesson({
    id: "p6-multiple-keys",
    track: "piano",
    level: 6,
    order: 8,
    title: "Playing in multiple keys",
    summary: "G major and F major scales with correct fingering.",
    minutes: 14,
    skills: ["scales-multiple-keys"],
    prerequisites: ["p6-arpeggios", "t5-key-signatures"],
    topics: ["scales", "piano-technique"],
    steps: [
      explain("g", "G major (one sharp)", "RH fingering 1 2 3 1 2 3 4 5: G A B (1 2 3), thumb under to C, then D E F♯ G (2 3 4 5).", { visual: { type: "keyboard", low: 67, high: 79, highlight: scaleMidi("G", "major"), caption: "G major" } }),
      practice("play-g", "Play G major (RH)", "Watch the F♯.", { type: "play-sequence", instrument: "piano", notes: scaleMidi("G", "major"), fingers: [1, 2, 3, 1, 2, 3, 4, 5], prompt: "Play G major, right hand." }, { mastery: true }),
      explain("f", "F major (one flat)", "RH fingering is different: 1 2 3 4 1 2 3 4 — F G A B♭ (1 2 3 4), thumb under to C, D E F (2 3 4). Finger 4 lands on B♭ so the thumb avoids the black key.", { visual: { type: "keyboard", low: 65, high: 77, highlight: scaleMidi("F", "major"), caption: "F major" } }),
      practice("play-f", "Play F major (RH)", "Finger 4 on B♭.", { type: "play-sequence", instrument: "piano", notes: scaleMidi("F", "major"), fingers: [1, 2, 3, 4, 1, 2, 3, 4], prompt: "Play F major, right hand." }, { mastery: true }),
    ],
    quiz: [
      q("q1", "RH fingering for F major?", ["1 2 3 1 2 3 4 5", "1 2 3 4 1 2 3 4"], 1, "Finger 4 on B♭, then thumb under to C."),
      q("q2", "Which note is sharp in G major?", ["F♯", "C♯", "G♯"], 0, "G major has F♯."),
      q("q3", "Why avoid the thumb on black keys in scales?", ["It's shorter and awkward there", "It makes notes louder"], 0, "Thumb on white keys keeps the hand comfortable."),
    ],
  }),

  /* ---------------- Shared ---------------- */
  lesson({
    id: "t6-playing-in-time",
    track: "theory",
    level: 6,
    order: 1,
    title: "Playing in time: subdivisions",
    summary: "Eighth notes, counting '1 & 2 &' and feeling the pulse.",
    minutes: 12,
    skills: ["timing", "subdivisions"],
    prerequisites: ["t5-progressions", "l1-tempo-metronome"],
    topics: ["rhythm"],
    glossary: [{ term: "Subdivision", meaning: "Splitting each beat into smaller equal parts (e.g. two eighth notes)." }],
    steps: [
      explain("subdivide", "Count the in-betweens", "Steady timing comes from feeling the subdivisions. Count '1 & 2 & 3 & 4 &' even when you only play on the numbers. Eighth notes fall on every number and every '&'.", {}),
      listen("eighths", "Eighth notes at 80 BPM", "Two notes per beat.", { type: "rhythm", pattern: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], bpm: 80, beatsPerBar: 4 }),
      practice("tap-eighths", "Tap eighth notes", "Tap twice per click, evenly.", { type: "tap-rhythm", prompt: "Tap 1 & 2 & 3 & 4 &", pattern: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], bpm: 70, beatsPerBar: 4, bars: 2 }, { mastery: true, passAccuracy: 0.75 }),
      practice("tap-offbeats", "Off-beats only", "Tap only on the '&'s. Harder than it sounds!", { type: "tap-rhythm", prompt: "Tap only on the &s.", pattern: [0.5, 1.5, 2.5, 3.5], bpm: 70, beatsPerBar: 4, bars: 2 }),
    ],
    quiz: [
      q("q1", "How many eighth notes fit in one beat of 4/4?", ["1", "2", "4"], 1, "Two eighths per quarter-note beat."),
      q("q2", "'&' means…", ["Halfway between beats", "The first beat"], 0, "The '&' is the off-beat."),
      q("q3", "Best way to improve timing?", ["Practise with a metronome, slowly", "Never use a metronome"], 0, "A metronome gives you honest feedback."),
    ],
  }),

  lesson({
    id: "t6-complex-notation",
    track: "theory",
    level: 6,
    order: 2,
    title: "Reading more complex notation",
    summary: "Dotted notes, ties, eighth-note groups and 6/8 time.",
    minutes: 14,
    skills: ["notation-intermediate"],
    prerequisites: ["t6-playing-in-time", "l1-treble-bass-clef"],
    topics: ["reading-music", "rhythm"],
    glossary: [
      { term: "Dot", meaning: "A dot after a note adds half its value: dotted half = 3 beats." },
      { term: "Tie", meaning: "A curved line joining two notes of the same pitch — hold for both values." },
      { term: "6/8", meaning: "Six eighth notes per bar, felt in two groups of three." },
    ],
    steps: [
      explain("dots", "Dots and ties", "A dot adds half the note's value: dotted half note = 2 + 1 = 3 beats; dotted quarter = 1 + ½ = 1½ beats. A tie joins two same-pitch notes into one longer sound.", {}),
      show("dotted", "A dotted rhythm", "Dotted half (3 beats) then a quarter (1 beat).", { type: "staff", clef: "treble", notes: [{ note: "C4", duration: "h" }, { note: "E4", duration: "q" }, { note: "G4", duration: "8" }, { note: "G4", duration: "8" }, { note: "E4", duration: "q" }] }),
      listen("six-eight", "Feel 6/8", "ONE two three FOUR five six — two big beats per bar.", { type: "rhythm", pattern: [0, 1, 2, 3, 4, 5], bpm: 150, beatsPerBar: 6 }),
      practice("tap-dotted", "Tap a dotted rhythm", "Dotted quarter + eighth, twice: 1 (2&)… taps on 0, 1.5, 2, 3.5.", { type: "tap-rhythm", prompt: "Tap: long-short, long-short.", pattern: [0, 1.5, 2, 3.5], bpm: 70, beatsPerBar: 4, bars: 2 }, { mastery: true, passAccuracy: 0.7 }),
      practice("name", "Name these notes", "Mixed treble notes including ledger lines.", { type: "name-note", prompt: "Name the note.", on: "staff-treble", notes: ["A5", "C6", "B3", "G5", "D4"] }),
    ],
    quiz: [
      q("q1", "A dotted half note lasts…", ["2 beats", "3 beats", "4 beats"], 1, "2 + half of 2 = 3."),
      q("q2", "A dotted quarter lasts…", ["1 beat", "1½ beats", "2 beats"], 1, "1 + ½ = 1½."),
      q("q3", "6/8 is usually felt in…", ["Six even beats", "Two groups of three"], 1, "6/8 is compound duple: two dotted-quarter beats."),
      q("q4", "Two tied quarter notes sound like…", ["Two separate notes", "One note lasting 2 beats"], 1, "A tie joins them into one sound."),
    ],
  }),

  lesson({
    id: "t6-learning-by-ear",
    track: "theory",
    level: 6,
    order: 3,
    title: "Learning songs by ear",
    summary: "Find the key note, the bass line, then the chords.",
    minutes: 14,
    skills: ["by-ear"],
    prerequisites: ["t5-ear-training", "t5-progressions"],
    topics: ["ear-training", "songs"],
    steps: [
      explain("method", "A step-by-step method", "1) Find the 'home' note: hum the note the song feels like it ends on, then find it on your instrument. 2) Find the bass notes — they usually match chord roots. 3) Try the likely chords of that key (I, IV, V, vi). 4) Loop short sections at a slower speed. Our Song Lab can slow things down for practice.", {}),
      listen("mystery", "Mystery progression", "Which chords are these? (Hint: key of G.)", { type: "chords", chords: ["G", "C", "D", "G"], beatsEach: 4, bpm: 90 }),
      practice("bass", "Play the bass notes", "Play the roots you heard: G, C, D, G.", { type: "play-sequence", instrument: "either", notes: ["G3", "C4", "D4", "G3"], anyOctave: true, prompt: "Play the roots of the mystery progression." }, { mastery: true }),
      practice("ear-q", "Major or minor?", "Practise chord-quality recognition.", { type: "ear-choice", prompt: "Major or minor chord?", rounds: 8, mode: "major-minor" }),
    ],
    quiz: [
      q("q1", "First step to learning a song by ear?", ["Find the home (key) note", "Guess the most complex chord"], 0, "Knowing the key narrows down the chords."),
      q("q2", "Bass notes usually match…", ["Chord roots", "Random notes"], 0, "The bass usually plays chord roots."),
      q("q3", "The mystery progression was I–IV–V–I in G: …", ["G C D G", "G Em C D", "G D Em C"], 0, "I=G, IV=C, V=D."),
    ],
  }),

  lesson({
    id: "t6-backing-tracks",
    track: "theory",
    level: 6,
    order: 4,
    title: "Playing along with backing tracks",
    summary: "Count-ins, form, and recovering from mistakes.",
    minutes: 10,
    skills: ["playing-with-backing"],
    prerequisites: ["t6-playing-in-time"],
    topics: ["rhythm", "songs"],
    steps: [
      explain("form", "Know the form", "Songs repeat sections: intro, verse, chorus, bridge. Count bars (often 4 or 8 per section). A count-in ('1, 2, 3, 4') tells you when to start.", {}),
      listen("loop", "8-bar loop: C – Am – F – G (twice)", "Count the bars as you listen.", { type: "chords", chords: ["C", "Am", "F", "G", "C", "Am", "F", "G"], beatsEach: 4, bpm: 96 }),
      practice("tap-beat1", "Tap beat 1 of each bar", "Show you know where each bar starts.", { type: "tap-rhythm", prompt: "Tap only on beat 1 of each bar.", pattern: [0, 4, 8, 12], bpm: 96, beatsPerBar: 4, bars: 4 }, { mastery: true, passAccuracy: 0.75 }),
      selfCheck("check", "Play-along self-check", "", ["I counted myself in.", "I knew when the section repeated.", "When I got lost, I jumped back in on beat 1."]),
    ],
    quiz: [
      q("q1", "A common section length is…", ["3 bars", "8 bars", "13 bars"], 1, "Sections are often 4 or 8 bars."),
      q("q2", "If you get lost, rejoin on…", ["Beat 1 of the next bar", "Any random beat"], 0, "Beat 1 is the easiest place to re-enter."),
      q("q3", "A count-in tells you…", ["The key", "When to start and the tempo"], 1, "It sets tempo and the starting point."),
    ],
  }),
];

/** Exported for tests. */
export const LEVEL_6_FACTS = { PENTA_BOX_MIDI, C_ARPEGGIO, C_TRIAD: chordMidi("C", 4) };
