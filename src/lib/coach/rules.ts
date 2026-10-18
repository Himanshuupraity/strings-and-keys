import { chordNoteNames, easiestShape, parseChord } from "@/lib/music/chords";
import { pcName, parseNote } from "@/lib/music/notes";
import { SWARAS } from "@/lib/music/sargam";
import { scaleNoteNames, relativeMinor } from "@/lib/music/scales";
import { bestCapoArrangement } from "@/lib/music/transpose";
import type { CoachContext, LastExercise } from "./schema";

/**
 * Rule-based coach. Works offline with no API key. Answers are grounded in the app's own music
 * theory functions, so facts like "notes in G major" are computed, not memorised.
 */

export interface RuleReply {
  text: string;
  intent: string;
  /** 'measured' when the reply is purely a report of measured exercise data. */
  source: "rules" | "measured";
}

type Ctx = Partial<CoachContext> & { tonicPc?: number };

const NOTE = "([A-Ga-g](?:#|b|♯|♭|-sharp|-flat| sharp| flat)?)";

function normNote(raw: string): string {
  const s = raw.trim().replace(/[-\s]?sharp/i, "#").replace(/[-\s]?flat/i, "b").replace("♯", "#").replace("♭", "b");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface Rule {
  intent: string;
  test: RegExp;
  reply: (m: RegExpMatchArray, ctx: Ctx, q: string) => string | null;
}

const RULES: Rule[] = [
  // ---- Computed answers first (most specific) ----
  {
    intent: "capo",
    test: /\bcapo\b/i,
    reply: (_m, _ctx, q) => {
      // Read chords after "for"/":" when present, so a leading "A capo…" isn't taken as an A chord.
      const tail = q.split(/\bfor\b|:/i).slice(1).join(" ") || q;
      const prog = (tail.match(/\b[A-G](?:#|b)?(?:maj7|m7|m|7|sus2|sus4|dim|aug)?(?![a-z#])/g) ?? []).filter((c) => !!parseChord(c));
      if (prog.length >= 2) {
        const best = bestCapoArrangement(prog);
        if (best.capo === 0) return `Good news: ${prog.join(" – ")} is already playable without a capo using open/easy shapes (${best.shapes.join(" – ")}).`;
        return `Put the capo on fret ${best.capo} and play the shapes ${best.shapes.join(" – ")}. They will SOUND as ${prog.join(" – ")} — the same key as the original. ${best.allOpen ? "All of those are open chords — no barres needed." : best.notes.join(" ")} Try it in the Guitar Lab's capo tool to compare other positions.`;
      }
      return "A capo is a clamp across all strings at one fret. It raises every open string by that many semitones (capo 2 = 2 semitones higher), so easy open chord shapes sound in a higher key. Tell me a progression, like “capo for F Bb C”, and I'll calculate the easiest capo position for it.";
    },
  },
  {
    intent: "scale-notes",
    test: new RegExp(`\\b${NOTE}\\s*(major|minor|natural minor|harmonic minor|pentatonic|minor pentatonic|major pentatonic)?\\s+scale\\b|\\bscale of ${NOTE}\\s*(major|minor)?`, "i"),
    reply: (m) => {
      const tonicRaw = m[1] ?? m[3];
      const kindRaw = (m[2] ?? m[4] ?? "major").toLowerCase();
      if (!tonicRaw || !parseNote(normNote(tonicRaw))) return null;
      const tonic = normNote(tonicRaw);
      const type = kindRaw.includes("harmonic") ? "harmonicMinor" : kindRaw.includes("minor pentatonic") ? "minorPentatonic" : kindRaw.includes("pentatonic") ? "majorPentatonic" : kindRaw.includes("minor") ? "naturalMinor" : "major";
      const notes = scaleNoteNames(tonic, type);
      const label = { major: "major", naturalMinor: "natural minor", harmonicMinor: "harmonic minor", majorPentatonic: "major pentatonic", minorPentatonic: "minor pentatonic" }[type];
      const extra = type === "major" ? ` Its relative minor is ${relativeMinor(tonic)} minor — same notes, starting on a different note.` : "";
      return `The ${tonic} ${label} scale: ${notes.join(" – ")} – ${notes[0]}.${extra}`;
    },
  },
  {
    // "notes in A minor" / "notes of D major" (no word "scale") → scale, not chord
    intent: "scale-notes",
    test: new RegExp(`\\bnotes? (?:are )?(?:in|of) (?:the )?(?:key of )?${NOTE}\\s+(major|minor)\\b`, "i"),
    reply: (m) => {
      if (!parseNote(normNote(m[1]))) return null;
      const tonic = normNote(m[1]);
      const minor = m[2].toLowerCase() === "minor";
      const notes = scaleNoteNames(tonic, minor ? "naturalMinor" : "major");
      return `${tonic} ${minor ? "natural minor" : "major"} uses these notes: ${notes.join(" – ")}. ${minor ? `It shares them with its relative major.` : `Its relative minor is ${relativeMinor(tonic)} minor.`} Want the chord instead? Ask “notes in ${tonic}${minor ? "m" : ""} chord”.`;
    },
  },
  {
    intent: "chord-notes",
    test: /\b(?:notes? (?:are )?(?:in|of)|what(?:'s| is) in|spell)\s+(?:an?\s+|the\s+)?([A-G](?:#|b)?(?:maj7|m7b5|m7|maj|min|m|7|sus2|sus4|dim7|dim|aug|add9|6|9|5)?)\s*(?:chord)?/i,
    reply: (m) => {
      const sym = m[1].charAt(0).toUpperCase() + m[1].slice(1).replace(/maj$/i, "").replace(/min$/i, "m");
      if (!parseChord(sym)) return null;
      const notes = chordNoteNames(sym);
      const shape = easiestShape(sym);
      return `${sym} contains ${notes.join(", ")}.${shape ? ` On guitar, the easiest shape is frets ${shape.frets.map((f) => (f < 0 ? "x" : f)).join("")} (low E → high E).` : ""} On piano, play those keys together — e.g. ${notes.join("–")} from the root upwards.`;
    },
  },
  {
    intent: "sargam",
    test: /\b(sargam|swara|swar|sa re ga|komal|tivra|shuddha|raga|raag|hindustani)\b|\bwhat is sa\b/i,
    reply: (_m, ctx) => {
      const tonic = ctx.tonicPc ?? 0;
      const map = SWARAS.filter((s) => s.variant === "shuddha").map((s) => `${s.base} = ${pcName(tonic + s.degree, "sharp")}`).join(", ");
      return `Sargam names notes relative to Sa, the home note — and Sa is movable: you choose which Western note it sits on. With your current Sa of ${pcName(tonic)}: ${map}. 'Komal' means a semitone lower (Re, Ga, Dha, Ni can be komal); 'tivra' Ma is a semitone higher. Change Sa in Settings. Note: the app uses equal-tempered pitches; Hindustani intonation (shruti) can differ slightly.`;
    },
  },
  // ---- Concepts ----
  { intent: "what-chord", test: /\bwhat(?:'s| is| are) (?:a |an )?chords?\b/i, reply: () => "A chord is three or more notes played together. The simplest kind, a triad, stacks a root, a third and a fifth — C major is C + E + G. Major chords sound bright; minor chords sound darker. On guitar you strum several strings while holding a shape; on piano you press the keys together." },
  { intent: "what-scale", test: /\bwhat(?:'s| is| are) (?:a )?scales?\b/i, reply: () => "A scale is a set of notes in order, like a ladder. The major scale uses the pattern whole–whole–half–whole–whole–whole–half steps. C major is all the white keys from C to C. Scales are the building blocks of melodies and chords." },
  { intent: "sharp-flat", test: /\b(sharp|flat|black keys?|accidental)s?\b/i, reply: () => "A sharp (♯) raises a note by one semitone; a flat (♭) lowers it by one. On a piano, the black key between C and D is both C♯ and D♭ — the same sound with two names (enharmonics). On guitar, one fret = one semitone." },
  { intent: "octave", test: /\boctaves?\b/i, reply: () => "An octave is the distance from one note to the next note with the same name — C to the next C. The higher one vibrates exactly twice as fast, which is why they sound 'the same but higher'. There are 12 semitones in an octave." },
  { intent: "semitone", test: /\b(semitone|half step|whole step|whole tone|interval)s?\b/i, reply: () => "A semitone (half step) is the smallest step in Western music: the next key on a piano (black or white) or one fret on a guitar. Two semitones make a whole tone. An interval is just the distance between two notes, counted in these steps." },
  { intent: "tempo", test: /\b(tempo|bpm|beats per minute|metronome)\b/i, reply: () => "Tempo is the speed of the beat, measured in BPM (beats per minute). 60 BPM = one beat per second. Practise new things slowly with the metronome — around 60–70 BPM — and only speed up by about 5 BPM once you can play it cleanly three times in a row." },
  { intent: "rhythm", test: /\b(rhythm|time signature|4\/4|3\/4|quarter note|eighth note|counting)\b/i, reply: () => "Rhythm is how long notes last and when they happen. In 4/4 time each bar has 4 beats: count “1 2 3 4” steadily. A quarter note = 1 beat, a half note = 2, a whole note = 4, eighth notes = half a beat (count “1 & 2 &”). Try the Rhythm trainer in Practice." },
  // ---- Practical guitar problems ----
  { intent: "tuning", test: /\btun(e|ing)\b/i, reply: (_m, ctx) => ctx.instrument === "piano" ? "Acoustic pianos need a professional tuner; digital keyboards stay in tune. If notes in the app read slightly off, check the A4 reference (normally 440 Hz) in Settings." : "Open the Tuner page, allow the microphone, and pick one string at a time. Standard tuning from thickest to thinnest is E A D G B E. If the needle is left (flat), tighten the string slightly; if it's right (sharp), loosen it. Always tune UP to the note — loosen a little below, then tighten up." },
  { intent: "buzzing", test: /\b(buzz|buzzing|muted|muffled|dead note|rattl)/i, reply: () => "Buzzing usually comes from: 1) pressing too far from the fret — move your fingertip just behind the metal fret wire; 2) not enough pressure — press a little firmer, but no more than needed; 3) a neighbouring finger touching the string — arch your fingers and use the very tips. Check string by string: pick each one slowly while holding the shape. (I can't see your hand — this is guidance, not a measurement.)" },
  { intent: "sore-fingers", test: /\b(sore|hurt|pain|painful|ache|blister|fingertips?)\b/i, reply: () => "Sore fingertips are normal for the first 2–4 weeks on guitar — calluses are forming. Practise in short sessions (10–15 minutes), a few times a day, and stop if it's sharp pain. Pain in the wrist, hand or arm is NOT normal: stop, rest, check your posture, and see a professional if it continues." },
  { intent: "first-chord", test: /\b(first|easiest|which|beginner) chords?\b|\bchords? (?:first|to start)\b/i, reply: (_m, ctx) => ctx.instrument === "piano" ? "Start with C major (C–E–G), then F major (F–A–C) and G major (G–B–D). Those three chords play hundreds of songs." : "Start with E minor (two fingers!), then A minor, then C and G. Em ↔ Am is the gentlest first chord change. Try the 1-minute chord change drill in Practice once each shape rings clearly." },
  { intent: "barre", test: /\b(barre|bar chord|f chord|f major)\b/i, reply: () => "Barre chords (like full F) are hard for everyone at first. Use the 'easy F' (xx3211) or a capo to avoid them for now. When you're ready: roll your index finger slightly onto its bony side, keep it close to the fret, and pull back with your arm rather than squeezing with the thumb." },
  { intent: "strumming", test: /\b(strum|strumming|pick|plectrum)\b/i, reply: () => "Strum from the wrist, not the whole arm, like shaking water off your hand. Start with 4 down-strums per bar with a metronome at 60 BPM. Then try 'down, down-up, up-down-up' (D DU UDU). Keep your hand moving even when you don't hit the strings." },
  { intent: "middle-c", test: /\bmiddle c\b|\bfind (?:the )?c\b/i, reply: () => "Find the groups of two black keys. The white key just to the left of any pair is a C. Middle C is the C closest to the centre of the keyboard (often under the brand name). In this app it's called C4 and is marked with a dot." },
  { intent: "practice-time", test: /\b(how long|how often|how many minutes|how much) .*(practi[cs]e|play)|\bpractice (?:plan|routine|schedule)\b/i, reply: (_m, ctx) => `Short and regular beats long and rare. For a beginner, 15–30 minutes a day is great — split into warm-up, one new idea, an exercise and something musical. Take a break every 25 minutes and stop if anything hurts. ${ctx.instrument === "guitar" ? "Guitar fingertips need time to toughen up, so several short sessions are better than one long one." : "Rest your hands and shoulders between sections."}` },
  { intent: "transpose", test: /\b(transpos|change (?:the )?key|key change|different key)\b/i, reply: () => "Transposing moves every note and chord up or down by the same number of semitones — the song keeps its shape but sounds higher or lower. On guitar a capo transposes for you. The Song Lab and Guitar Lab can calculate it, keeping correct sharp/flat spelling." },
  { intent: "read-music", test: /\b(read|reading) (?:sheet )?music\b|\b(treble|bass) clef\b|\bstaff\b|\btab(lature|s)?\b/i, reply: () => "Sheet music uses 5 lines (the staff). In the treble clef the lines are E G B D F ('Every Good Boy Does Fine') and the spaces F A C E. Guitar tab is simpler: 6 lines = 6 strings (top line = high E) and numbers tell you which fret to press." },
  // ---- Social ----
  { intent: "greeting", test: /^\s*(hi|hello|hey|namaste|good (morning|evening|afternoon))\b/i, reply: (_m, ctx) => `Hello! I'm your practice coach. Ask me anything about ${ctx.instrument ?? "music"} — chords, scales, tuning, rhythm — or use the Lesson coach on the left and I'll listen while you play.` },
  { intent: "thanks", test: /\b(thank|thanks|thx|shukriya|dhanyavaad)\b/i, reply: () => "You're welcome! Keep it slow and steady — small daily steps add up fast." },
];

/** Report on the last measured exercise — clearly labelled as measured data. */
export function feedbackFromExercise(ex: LastExercise): string {
  const pct = Math.round(ex.accuracy * 100);
  const how = ex.input === "mic" ? "through the microphone" : ex.input === "midi" ? "from your MIDI keyboard" : ex.input === "virtual" ? "on the virtual instrument" : ex.input === "tap" ? "from your taps" : "by your own report";
  const verdict = pct >= 90 ? "Excellent" : pct >= 70 ? "Good progress" : "Keep going";
  const lines = [`${verdict}: your last exercise scored ${pct}% (${ex.measured ? "measured" : "self-reported"} ${how}).`];
  if (ex.mistakes) lines.push(ex.mistakes);
  if (pct < 70) lines.push("Slow it right down and repeat the hardest part 3 times before playing the whole thing.");
  else if (pct < 90) lines.push("Repeat it once more at the same speed; when it's clean twice in a row, move on.");
  else lines.push("You're ready for the next step — try 'Make it harder'.");
  return lines.join(" ");
}

export function ruleReply(question: string, ctx: Ctx = {}): RuleReply {
  const q = question.trim();
  if (/\b(how did i do|my (score|result)|last exercise|feedback)\b/i.test(q) && ctx.lastExercise) {
    return { text: feedbackFromExercise(ctx.lastExercise), intent: "exercise-feedback", source: "measured" };
  }
  for (const r of RULES) {
    const m = q.match(r.test);
    if (!m) continue;
    const text = r.reply(m, ctx, q);
    if (text) return { text, intent: r.intent, source: "rules" };
  }
  const weak = ctx.skillsWeak?.length ? ` Based on your saved results, ${ctx.skillsWeak.slice(0, 2).join(" and ")} could use some revision.` : "";
  const lesson = ctx.lessonTitle ? ` You're working on “${ctx.lessonTitle}” — want a tip on that?` : "";
  return {
    intent: "unknown",
    source: "rules",
    text: `I'm not sure about that one (I'm in offline mode, so I only know common beginner topics). Try asking about: chords and their notes (“notes in Am”), scales (“G major scale”), capo positions (“capo for F Bb C”), tuning, buzzing strings, sore fingers, strumming, rhythm, middle C, sargam, or how long to practise.${lesson}${weak}`,
  };
}

export const RULE_INTENTS = RULES.map((r) => r.intent);
