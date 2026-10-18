import type { Lesson } from "../types";
import { GUITAR_STRUMS, TAALS, leftHandOffset, PIANO_LEFT_HAND } from "@/lib/music/taal";
import { explain, lesson, listen, practice, q, selfCheck } from "./advanced-builders";

/** Indian rhythm (taal) lessons — Dadra, Keherwa and the strumming feels used in Hindi songs. */

const ALL = (n: number) => Array.from({ length: n }, (_, i) => i);
const DADRA_STRUM = GUITAR_STRUMS.dadra![0];
const KEHERWA_STRUM = GUITAR_STRUMS.keherwa![0];
const bols = (id: keyof typeof TAALS) => TAALS[id].bols.join(" ");

/** Keherwa left hand on C (root C3): C – G – C4 pattern from the shared definition. */
const KEHERWA_LH = PIANO_LEFT_HAND.keherwa!.steps.flatMap((s) => {
  const off = leftHandOffset(s);
  return off === null ? [] : [48 + off];
});
const DADRA_LH = PIANO_LEFT_HAND.dadra!.steps.flatMap((s) => {
  const off = leftHandOffset(s);
  return off === null ? [] : [48 + off];
});

export const TAAL_LESSONS: Lesson[] = [
  lesson({
    id: "t5-taal-intro",
    track: "theory",
    level: 5,
    order: 101,
    title: "What is taal?",
    summary: "The Indian way of counting rhythm: matras, vibhags, sam and khali.",
    minutes: 8,
    skills: ["taal-basics"],
    prerequisites: ["l1-bars-time-signatures"],
    topics: ["rhythm", "indian-music"],
    glossary: [
      { term: "Taal", meaning: "A repeating cycle of beats in Indian music — like a bar or time signature, but often longer." },
      { term: "Matra", meaning: "One beat of the taal." },
      { term: "Vibhag", meaning: "A section of the taal, like a group of beats." },
      { term: "Sam", meaning: "The first beat of the cycle — the strongest, 'home' beat. Written X." },
      { term: "Khali", meaning: "The 'empty' section, shown with a wave of the hand instead of a clap. Written 0." },
      { term: "Theka", meaning: "The basic pattern of tabla syllables (bols) that defines the taal." },
    ],
    steps: [
      explain("cycle", "Rhythm as a cycle", "Western music counts bars: 1 2 3 4, 1 2 3 4. Indian music thinks of rhythm as a circle called a taal. Each beat is a matra. The beats are grouped into sections called vibhags, and the cycle always comes back to the first beat — the sam.", {
        hinglish: "Taal ek chakra hai. Har beat ek matra hai. Matras ke group ko vibhag kehte hain. Pehla beat 'sam' hai — sabse zaroori beat.",
      }),
      explain("clap", "Clap and wave", "Musicians keep taal with their hands: a clap (tali) at the start of most vibhags, and a wave (khali) at the 'empty' one. In notation, X marks the sam, 0 marks khali, and 2, 3 mark the other claps.", {
        hinglish: "Tali matlab taali bajana, khali matlab haath hilana (bina taali). X = sam, 0 = khali.",
      }),
      listen("hear-keherwa", "Hear a taal cycle", `Keherwa: 8 matras in two groups of four. The tabla bols are ${bols("keherwa")}.`, { type: "rhythm", pattern: ALL(8), bpm: 140, beatsPerBar: 8 }),
      practice("tap-cycle", "Tap the cycle", "Tap every matra of Keherwa. Feel the first beat as 'home'.", { type: "tap-rhythm", prompt: "Tap all 8 matras: 1 2 3 4 | 5 6 7 8", pattern: ALL(8), bpm: 120, beatsPerBar: 8, bars: 2 }, { mastery: true, passAccuracy: 0.7 }),
      selfCheck("clap-check", "Clap the taal", "Try keeping Keherwa with your hands while counting aloud.", ["I clap on 1 (sam) and wave on 5 (khali).", "I can count 8 matras without speeding up.", "I can find the sam again after a few cycles."]),
    ],
    quiz: [
      q("q1", "What is one beat of a taal called?", ["Vibhag", "Matra", "Bol", "Sam"], 1, "A matra is one beat. A vibhag is a group of matras."),
      q("q2", "What does X mean in taal notation?", ["Khali (wave)", "Sam — the first, strongest beat", "A rest", "Repeat"], 1, "X marks the sam, where the cycle starts and resolves."),
      q("q3", "What does 0 mean?", ["Sam", "Khali — the 'empty' section, shown with a wave", "Silence", "The end of the song"], 1, "0 is khali: a lighter, 'empty' section marked by a wave of the hand."),
      q("q4", "What are bols?", ["Guitar chords", "Spoken tabla syllables like Dha and Na", "Song lyrics", "Piano fingerings"], 1, "Bols are the syllables tabla players use to name each stroke."),
    ],
  }),

  lesson({
    id: "t5-taal-dadra",
    track: "theory",
    level: 5,
    order: 102,
    title: "Dadra: the 6-beat sway",
    summary: "Six matras in two groups of three — the gentle swing of many romantic and ghazal-style songs.",
    minutes: 9,
    skills: ["dadra"],
    prerequisites: ["t5-taal-intro"],
    topics: ["rhythm", "indian-music"],
    steps: [
      explain("structure", "Dadra in one line", `Dadra has 6 matras, split 3 + 3. Sam (X) is on 1, khali (0) is on 4. Theka: ${bols("dadra")}. It feels like Western 6/8: ONE two three, FOUR five six.`, {
        hinglish: "Dadra = 6 matra, 3+3. 1 par sam (X), 4 par khali (0). Bol: Dha Dhi Na | Dha Ti Na.",
      }),
      listen("hear", "Hear Dadra", "Two cycles of Dadra. Notice the gentle lilt.", { type: "rhythm", pattern: ALL(6), bpm: 120, beatsPerBar: 6 }),
      practice("tap-theka", "Tap the theka", "Tap all six matras. Lean a little on 1, lighter on 4.", { type: "tap-rhythm", prompt: "Tap 1 2 3 | 4 5 6", pattern: ALL(6), bpm: 110, beatsPerBar: 6, bars: 2 }, { mastery: true, passAccuracy: 0.7 }),
      practice("tap-strum", "Tap the Dadra strum", `Guitarists strum Dadra as ${DADRA_STRUM.pattern.join(" ")} (— means let the strings ring).`, { type: "tap-rhythm", prompt: "Tap: 1, (2), 3, 4, 5, 6", pattern: DADRA_STRUM.hits, bpm: 110, beatsPerBar: 6, bars: 2 }),
    ],
    quiz: [
      q("q1", "How many matras does Dadra have?", ["4", "6", "7", "8"], 1, "Dadra has 6 matras."),
      q("q2", "How are they grouped?", ["2+2+2", "3+3", "4+2", "3+2+2"], 1, "Two vibhags of three: 3 + 3."),
      q("q3", "Where is khali in Dadra?", ["Matra 1", "Matra 3", "Matra 4", "Matra 6"], 2, "Khali (0) is on the 4th matra, the start of the second vibhag."),
      q("q4", "Which Western time feels closest to Dadra?", ["4/4", "6/8", "5/4", "2/4"], 1, "Two groups of three pulses — like 6/8."),
    ],
  }),

  lesson({
    id: "t5-taal-keherwa",
    track: "theory",
    level: 5,
    order: 103,
    title: "Keherwa: the everyday groove",
    summary: "Eight matras, 4 + 4 — the rhythm behind a huge number of film, folk and pop songs.",
    minutes: 9,
    skills: ["keherwa"],
    prerequisites: ["t5-taal-intro"],
    topics: ["rhythm", "indian-music"],
    steps: [
      explain("structure", "Keherwa in one line", `Keherwa has 8 matras, split 4 + 4. Sam (X) on 1, khali (0) on 5. Theka: ${bols("keherwa")}. Western musicians would count it as one bar of 4/4 in eighth notes.`, {
        hinglish: "Keherwa = 8 matra, 4+4. 1 par sam, 5 par khali. Bol: Dha Ge Na Ti | Na Ka Dhi Na. Bahut saare filmi gaane isi mein hote hain.",
      }),
      listen("hear", "Hear Keherwa", "Two cycles at a relaxed tempo.", { type: "rhythm", pattern: ALL(8), bpm: 140, beatsPerBar: 8 }),
      practice("tap-theka", "Tap the theka", "Tap all eight matras evenly.", { type: "tap-rhythm", prompt: "Tap 1 2 3 4 | 5 6 7 8", pattern: ALL(8), bpm: 130, beatsPerBar: 8, bars: 2 }, { mastery: true, passAccuracy: 0.7 }),
      practice("tap-strum", "Tap the Keherwa strum", `The everyday strum: ${KEHERWA_STRUM.pattern.join(" ")}.`, { type: "tap-rhythm", prompt: "Tap: 1, (2), 3, 4, (5), 6, 7, 8", pattern: KEHERWA_STRUM.hits, bpm: 130, beatsPerBar: 8, bars: 2 }),
    ],
    quiz: [
      q("q1", "How many matras does Keherwa have?", ["6", "7", "8", "16"], 2, "Keherwa has 8 matras."),
      q("q2", "Where is khali in Keherwa?", ["Matra 1", "Matra 4", "Matra 5", "Matra 8"], 2, "Khali (0) is on the 5th matra."),
      q("q3", "Which theka is Keherwa?", ["Dha Dhi Na | Dha Ti Na", "Dha Ge Na Ti | Na Ka Dhi Na", "Ti Ti Na | Dhi Na | Dhi Na", "Dha Dhin Dhin Dha ×4"], 1, "Dha Ge Na Ti | Na Ka Dhi Na is the Keherwa theka."),
    ],
  }),

  lesson({
    id: "g6-taal-strumming",
    track: "guitar",
    level: 6,
    order: 101,
    title: "Bollywood strumming: Dadra & Keherwa",
    summary: "Turn the two most common taals into guitar strums for Hindi songs.",
    minutes: 12,
    skills: ["taal-strumming"],
    prerequisites: ["t5-taal-keherwa", "g3-strumming-patterns"],
    topics: ["strumming", "bollywood", "rhythm"],
    steps: [
      explain("why", "Why two strums are enough to start", "Many Hindi film and pop songs sit on a Keherwa feel (8 beats) or a Dadra feel (6 beats). Learn one strum for each and you can accompany a large share of songs. Listen first: if you can count 1-2-3 1-2-3 it's probably Dadra; if it's 1-2-3-4 1-2-3-4 it's probably Keherwa.", {
        hinglish: "Gaana suno: 1-2-3 count ho raha hai toh Dadra, 1-2-3-4 ho raha hai toh Keherwa.",
      }),
      listen("keherwa-strum", "Keherwa strum on G–C–D", `${KEHERWA_STRUM.pattern.join(" ")} — one stroke per matra.`, { type: "chords", chords: ["G", "C", "D", "G"], beatsEach: 4, bpm: 90, instrument: "guitar" }),
      practice("tap-keherwa", "Tap the Keherwa strum", "Keep your hand moving down on odd matras, up on even ones — only touch the strings on the strokes shown.", { type: "tap-rhythm", prompt: KEHERWA_STRUM.pattern.join(" "), pattern: KEHERWA_STRUM.hits, bpm: 130, beatsPerBar: 8, bars: 2 }, { mastery: true, passAccuracy: 0.75 }),
      practice("tap-dadra", "Tap the Dadra strum", "Down on 1, let it ring, then down-up down-up.", { type: "tap-rhythm", prompt: DADRA_STRUM.pattern.join(" "), pattern: DADRA_STRUM.hits, bpm: 110, beatsPerBar: 6, bars: 2 }, { mastery: true, passAccuracy: 0.75 }),
      selfCheck("strum-check", "Strumming self-check", "Play each strum on G – C – D – G, two cycles per chord.", ["My hand keeps moving even when I skip a stroke.", "The first stroke (sam) is the strongest.", "I can switch between Dadra and Keherwa strums without stopping."]),
    ],
    quiz: [
      q("q1", "You count a song as 1-2-3, 1-2-3. Which strum fits?", ["Keherwa", "Dadra", "Teentaal", "None"], 1, "Groups of three suggest Dadra (6 matras = 3+3)."),
      q("q2", "In the Keherwa strum D - D U - U D U, what does '-' mean?", ["A down stroke", "Skip the strings but keep the hand moving", "Stop playing", "Mute with the left hand"], 1, "The hand keeps moving; you just miss the strings."),
      q("q3", "Which stroke should be strongest?", ["The last one", "The sam (first matra)", "Every up stroke", "Khali"], 1, "Lean on sam so the cycle feels anchored."),
    ],
  }),

  lesson({
    id: "p6-taal-left-hand",
    track: "piano",
    level: 6,
    order: 101,
    title: "Bollywood left hand: Keherwa & Dadra",
    summary: "Simple left-hand patterns that give your piano accompaniment a filmi groove.",
    minutes: 12,
    skills: ["taal-left-hand"],
    prerequisites: ["t5-taal-keherwa", "p4-left-hand"],
    topics: ["accompaniment", "bollywood", "rhythm"],
    steps: [
      explain("idea", "Let the left hand play the taal", `${PIANO_LEFT_HAND.keherwa!.description} For Dadra: ${PIANO_LEFT_HAND.dadra!.description}`, {
        hinglish: "Left hand taal bajata hai, right hand chord. Keherwa mein: root, fifth, octave. Dadra mein: oom-pah-pah.",
      }),
      listen("hear-keherwa", "Keherwa left hand on C", "Root – fifth – octave, twice per cycle.", { type: "notes", notes: KEHERWA_LH, step: 0.3, instrument: "piano" }),
      practice("play-keherwa", "Play the Keherwa left hand", "Use fingers 5 (C), 2 (G) and 1 (high C).", { type: "play-sequence", instrument: "piano", notes: KEHERWA_LH, prompt: "Play C3 G3 C4, C3 G3 C4 with your left hand." }, { mastery: true, passAccuracy: 0.8 }),
      practice("play-dadra", "Play the Dadra left hand", "Root on 1, fifth on 4 — the right hand fills the other matras with the chord.", { type: "play-sequence", instrument: "piano", notes: DADRA_LH, prompt: "Play C3, then G3." }),
      practice("tap-keherwa", "Feel it before playing it", "Tap the left-hand rhythm: matras 1, 3, 4, 5, 7, 8.", { type: "tap-rhythm", prompt: "1 (2) 3 4 | 5 (6) 7 8", pattern: [0, 2, 3, 4, 6, 7], bpm: 120, beatsPerBar: 8, bars: 2 }),
      selfCheck("lh-check", "Left-hand self-check", "Play the pattern under C – G – Am – F, one cycle per chord.", ["My left hand stays steady while the right hand changes chords.", "Sam (matra 1) is the strongest note.", "I can play it at 100 matras per minute without rushing."]),
    ],
    quiz: [
      q("q1", "In the Keherwa left hand, which notes do you play on C?", ["C E G", "C G and the C above", "C D E", "Only C"], 1, "Root (C), fifth (G) and octave (high C)."),
      q("q2", "In a Dadra 'oom-pah-pah', what does the left hand play on matra 1?", ["The chord", "The root", "Nothing", "The fifth"], 1, "The root lands on sam; the right hand fills in the 'pah'."),
    ],
  }),

  lesson({
    id: "t5-taal-rupak-teentaal",
    track: "theory",
    level: 5,
    order: 104,
    title: "Rupak and Teentaal",
    summary: "A 7-beat taal that starts on khali, and the 16-beat cycle at the heart of classical music.",
    minutes: 8,
    skills: ["rupak", "teentaal"],
    prerequisites: ["t5-taal-dadra", "t5-taal-keherwa"],
    topics: ["rhythm", "indian-music"],
    steps: [
      explain("rupak", "Rupak: 7 matras, 3 + 2 + 2", `Rupak has 7 matras grouped 3 + 2 + 2. Unusually, the sam falls on khali, so the cycle begins with a wave, not a clap (claps on 4 and 6). Theka: ${bols("rupak")}.`, {
        hinglish: "Rupak = 7 matra (3+2+2). Sam khali par aata hai — taali 4 aur 6 par.",
      }),
      listen("hear-rupak", "Hear Rupak", "Count 1 2 3 | 4 5 | 6 7.", { type: "rhythm", pattern: ALL(7), bpm: 120, beatsPerBar: 7 }),
      practice("tap-rupak", "Tap Rupak", "Tap all seven matras evenly.", { type: "tap-rhythm", prompt: "1 2 3 | 4 5 | 6 7", pattern: ALL(7), bpm: 110, beatsPerBar: 7, bars: 2 }, { mastery: true, passAccuracy: 0.7 }),
      explain("teentaal", "Teentaal: 16 matras, 4 × 4", `Teentaal (16 matras) is the most important taal in Hindustani classical music: claps on 1 (X), 5 (2) and 13 (3), khali on 9 (0). Theka: ${bols("teentaal")}.`),
    ],
    quiz: [
      q("q1", "How is Rupak grouped?", ["3+3", "4+4", "3+2+2", "4×4"], 2, "Rupak is 3 + 2 + 2 = 7 matras."),
      q("q2", "What is unusual about Rupak's sam?", ["It has no sam", "The sam falls on khali (a wave)", "The sam is on beat 4", "It changes every cycle"], 1, "Rupak begins on khali, so you wave on the first beat."),
      q("q3", "How many matras in Teentaal?", ["8", "12", "14", "16"], 3, "Teentaal has 16 matras in four vibhags of four."),
      q("q4", "Where is khali in Teentaal?", ["Matra 1", "Matra 5", "Matra 9", "Matra 13"], 2, "Khali (0) is on the 9th matra."),
    ],
  }),
];
