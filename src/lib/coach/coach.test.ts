import { describe, expect, it } from "vitest";
import { ruleReply, feedbackFromExercise } from "./rules";
import { analyzeChord, analyzeNote } from "./analysis";
import { coachReducer, currentExercise, initialSession, GUITAR_LADDER, PIANO_LADDER } from "./session";

describe("rules", () => {
  it("computes scale notes", () => {
    const r = ruleReply("What are the notes in the G major scale?");
    expect(r.intent).toBe("scale-notes");
    expect(r.text).toContain("G – A – B – C – D – E – F#");
    expect(ruleReply("F major scale").text).toContain("Bb");
    expect(ruleReply("A minor scale").text).toContain("A – B – C – D – E – F – G");
  });
  it("computes chord notes", () => {
    const r = ruleReply("what notes are in Am7");
    expect(r.intent).toBe("chord-notes");
    expect(r.text).toContain("A, C, E, G");
    expect(ruleReply("notes of the G chord").text).toContain("G, B, D");
    // "A minor" without "chord" means the key/scale, not an A major chord
    expect(ruleReply("what notes are in A minor?").text).toContain("A – B – C – D – E – F – G");
  });
  it("calculates capo positions preserving the key", () => {
    const r = ruleReply("A capo for F Bb C please");
    expect(r.intent).toBe("capo");
    expect(r.text).toMatch(/fret 3/);
    expect(r.text).toContain("D – G – A");
    expect(r.text).toContain("F – Bb – C");
  });
  it("sargam uses the selected tonic", () => {
    expect(ruleReply("what is sargam?", { tonicPc: 2 }).text).toContain("Sa = D");
    expect(ruleReply("what is sargam?", { tonicPc: 0 }).text).toContain("Sa = C");
  });
  it("matches common beginner problems", () => {
    expect(ruleReply("my strings are buzzing").intent).toBe("buzzing");
    expect(ruleReply("my fingertips are sore").intent).toBe("sore-fingers");
    expect(ruleReply("which chord should I learn first?").intent).toBe("first-chord");
    expect(ruleReply("how do I find middle C").intent).toBe("middle-c");
    expect(ruleReply("how long should I practice each day").intent).toBe("practice-time");
    expect(ruleReply("how do I tune my guitar", { instrument: "guitar" }).text).toContain("E A D G B E");
    expect(ruleReply("what is a chord").intent).toBe("what-chord");
    expect(ruleReply("explain octaves").intent).toBe("octave");
  });
  it("falls back helpfully on unknown questions", () => {
    const r = ruleReply("Who won the cricket match?", { lessonTitle: "Open strings" });
    expect(r.intent).toBe("unknown");
    expect(r.text).toContain("Open strings");
  });
  it("reports measured exercise results", () => {
    const ctx = { lastExercise: { exerciseId: "x", accuracy: 0.5, input: "mic" as const, measured: true } };
    const r = ruleReply("how did I do?", ctx);
    expect(r.source).toBe("measured");
    expect(r.text).toContain("50%");
    expect(feedbackFromExercise({ exerciseId: "x", accuracy: 1, input: "self", measured: false })).toContain("self-reported");
  });
});

describe("analysis feedback", () => {
  it("says higher/lower by semitones", () => {
    const f = analyzeNote(60, 62, { instrument: "piano" });
    expect(f.verdict).toBe("wrong");
    expect(f.detail).toContain("2 semitones higher");
    expect(analyzeNote(60, 59, { instrument: "piano" }).detail).toContain("1 semitone lower");
  });
  it("detects octave errors", () => {
    const f = analyzeNote(60, 72, { instrument: "piano" });
    expect(f.verdict).toBe("octave");
    expect(f.title).toContain("1 octave higher");
  });
  it("names the wrong open string on guitar", () => {
    const f = analyzeNote(64, 59, { instrument: "guitar", source: "mic" });
    expect(f.detail).toContain("open B string (string 2)");
    expect(f.detail).toContain("lower");
  });
  it("flags out-of-tune right notes from the mic and links to the tuner", () => {
    const f = analyzeNote(64, 64, { instrument: "guitar", cents: -28, source: "mic" });
    expect(f.verdict).toBe("close");
    expect(f.title).toContain("flat");
    expect(f.link?.href).toBe("/tuner");
    expect(analyzeNote(64, 64, { instrument: "guitar", cents: 4, source: "mic" }).verdict).toBe("correct");
  });
  it("judges chords and refuses to guess on low mic confidence", () => {
    expect(analyzeChord("C", [0, 4, 7], { source: "midi" }).verdict).toBe("correct");
    const missing = analyzeChord("C", [0, 4], { source: "midi" });
    expect(missing.title).toContain("missing G");
    expect(analyzeChord("C", [0, 4, 7], { source: "mic", confidence: 0.2 }).verdict).toBe("uncertain");
  });
});

describe("coach session state machine", () => {
  it("explain → try → correct note → feedback → next", () => {
    let s = initialSession("guitar");
    expect(s.phase).toBe("explain");
    expect(currentExercise(s).targets).toEqual([64]);
    s = coachReducer(s, { type: "NOTE", midi: 64, source: "mic" });
    expect(s.phase).toBe("explain"); // ignored outside "try"
    s = coachReducer(s, { type: "TRY" });
    s = coachReducer(s, { type: "NOTE", midi: 64, source: "mic", cents: 3 });
    expect(s.phase).toBe("feedback");
    expect(s.feedback?.verdict).toBe("correct");
    expect(s.results).toHaveLength(1);
    expect(s.suggestion).toBe("harder");
    s = coachReducer(s, { type: "NEXT" });
    expect(s.index).toBe(1);
    expect(s.phase).toBe("explain");
    expect(s.results).toHaveLength(1);
  });
  it("uncertain input never produces a result", () => {
    let s = coachReducer(initialSession("piano"), { type: "TRY" });
    s = coachReducer(s, { type: "UNCERTAIN", reason: "unclear" });
    expect(s.phase).toBe("try");
    expect(s.feedback?.verdict).toBe("uncertain");
    expect(s.results).toHaveLength(0);
  });
  it("sequence with live wrong-note feedback and accuracy", () => {
    let s = coachReducer(initialSession("piano", 1), { type: "TRY" }); // C D E
    s = coachReducer(s, { type: "NOTE", midi: 60, source: "virtual" });
    s = coachReducer(s, { type: "NOTE", midi: 63, source: "virtual" });
    expect(s.phase).toBe("try");
    expect(s.feedback?.detail).toContain("1 semitone higher");
    s = coachReducer(s, { type: "NOTE", midi: 62, source: "virtual" });
    s = coachReducer(s, { type: "NOTE", midi: 64, source: "virtual" });
    expect(s.phase).toBe("feedback");
    expect(s.results[0].accuracy).toBeCloseTo(2 / 3);
    expect(s.results[0].success).toBe(false);
  });
  it("suggests easier after repeated failures and adapts", () => {
    let s = initialSession("guitar", 2);
    for (let i = 0; i < 3; i++) {
      s = coachReducer(s, { type: "RETRY" });
      s = coachReducer(s, { type: "NOTE", midi: 40, source: "virtual" });
    }
    // single wrong first note doesn't finish a sequence; finish it with mistakes
    s = initialSession("piano", 2);
    for (let i = 0; i < 3; i++) {
      s = coachReducer(s, { type: "RETRY" });
      for (const m of [61, 60, 63, 62, 66, 64, 70, 65, 67]) s = coachReducer(s, { type: "NOTE", midi: m, source: "virtual" });
    }
    expect(s.failures).toBe(3);
    expect(s.suggestion).toBe("easier");
    s = coachReducer(s, { type: "EASIER" });
    expect(s.index).toBe(1);
  });
  it("chord exercises use pitch classes", () => {
    const chordIdx = PIANO_LADDER.findIndex((e) => e.kind === "chord");
    let s = coachReducer(initialSession("piano", chordIdx), { type: "TRY" });
    s = coachReducer(s, { type: "CHORD", pcs: [0, 4, 7], source: "midi" });
    expect(s.feedback?.verdict).toBe("correct");
  });
  it("completes after the last exercise and switching instrument resets", () => {
    let s = initialSession("guitar", GUITAR_LADDER.length - 1);
    s = coachReducer(s, { type: "NEXT" });
    expect(s.phase).toBe("complete");
    s = coachReducer(s, { type: "SET_INSTRUMENT", instrument: "piano" });
    expect(s.instrument).toBe("piano");
    expect(s.index).toBe(0);
  });
});
