import { z } from "zod";

export const SCHEMA_VERSION = 1;

export const InstrumentSchema = z.enum(["guitar", "piano"]);
export type Instrument = z.infer<typeof InstrumentSchema>;
export const TrackSchema = z.enum(["theory", "guitar", "piano"]);
export type Track = z.infer<typeof TrackSchema>;

/** Small, synchronous preferences (localStorage). Every field has a safe default via .catch(). */
export const PrefsSchema = z.object({
  version: z.number().catch(SCHEMA_VERSION),
  instrument: InstrumentSchema.catch("guitar"),
  theme: z.enum(["system", "light", "dark"]).catch("system"),
  labelMode: z.enum(["western", "sargam", "both"]).catch("western"),
  tonicPc: z.number().int().min(0).max(11).catch(0),
  spelling: z.enum(["sharp", "flat"]).catch("sharp"),
  keyboardSize: z.union([z.literal(49), z.literal(61), z.literal(88)]).catch(61),
  showBlackKeyLabels: z.boolean().catch(true),
  showKeyboardHints: z.boolean().catch(true),
  leftHanded: z.boolean().catch(false),
  fretCount: z.number().int().min(12).max(24).catch(15),
  a4: z.number().min(415).max(466).catch(440),
  volume: z.number().min(0).max(1).catch(0.8),
  hinglish: z.boolean().catch(false),
  capo: z.number().int().min(0).max(12).catch(0),
  onboarded: z.boolean().catch(false),
  coachEnabled: z.boolean().catch(true),
  /** Turn the microphone on by itself wherever a "Listen" button appears, once permission is granted. */
  autoMic: z.boolean().catch(true),
  /** Interface language. */
  uiLanguage: z.enum(["en", "hi"]).catch("en"),
  /** Piano sound: recorded grand-piano samples, or the lightweight synth. */
  pianoSound: z.enum(["sampled", "synth"]).catch("sampled"),
  /** Daily practice reminder (push notifications; works once the site is deployed). */
  reminderEnabled: z.boolean().catch(false),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).catch("19:00"),
});
export type Prefs = z.infer<typeof PrefsSchema>;
export const DEFAULT_PREFS: Prefs = PrefsSchema.parse({});

export const ProfileSchema = z.object({
  name: z.string().max(60).catch(""),
  firstInstrument: InstrumentSchema.catch("guitar"),
  experience: z.enum(["none", "little", "some"]).catch("none"),
  dailyMinutes: z.number().int().min(5).max(120).catch(20),
  genres: z.array(z.string()).catch([]),
  ownsGuitar: z.enum(["yes", "no", "skip"]).catch("skip"),
  ownsKeyboard: z.enum(["yes", "no", "skip"]).catch("skip"),
  hasMidi: z.enum(["yes", "no", "skip"]).catch("skip"),
  hasAudioInterface: z.enum(["yes", "no", "skip"]).catch("skip"),
  /** Starting level per track, decided by the diagnostic quiz (0–7). */
  placement: z.object({ theory: z.number().catch(0), guitar: z.number().catch(0), piano: z.number().catch(0) }).catch({ theory: 0, guitar: 0, piano: 0 }),
  createdAt: z.string().catch(() => new Date().toISOString()),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const LessonStatusSchema = z.enum(["not-started", "in-progress", "completed", "mastered"]);
export type LessonStatus = z.infer<typeof LessonStatusSchema>;

export const LessonProgressSchema = z.object({
  lessonId: z.string(),
  track: TrackSchema,
  status: LessonStatusSchema.catch("not-started"),
  stepsDone: z.array(z.string()).catch([]),
  quizBest: z.number().min(0).max(1).nullable().catch(null),
  quizAttempts: z.number().int().catch(0),
  /** Measured exercise evidence (virtual instrument / MIDI / mic). Distinguishes proficiency from completion. */
  exerciseBest: z.record(z.string(), z.number()).catch({}),
  startedAt: z.string().nullable().catch(null),
  completedAt: z.string().nullable().catch(null),
  masteredAt: z.string().nullable().catch(null),
  updatedAt: z.string().catch(() => new Date().toISOString()),
});
export type LessonProgress = z.infer<typeof LessonProgressSchema>;

export const QuizAttemptSchema = z.object({
  id: z.string(),
  lessonId: z.string(),
  date: z.string(),
  score: z.number(),
  total: z.number(),
  wrongQuestionIds: z.array(z.string()).catch([]),
});
export type QuizAttempt = z.infer<typeof QuizAttemptSchema>;

export const PracticeSessionSchema = z.object({
  id: z.string(),
  instrument: InstrumentSchema,
  activity: z.string(),
  lessonId: z.string().optional(),
  startedAt: z.string(),
  endedAt: z.string(),
  durationSec: z.number().min(0),
  notes: z.string().optional(),
});
export type PracticeSession = z.infer<typeof PracticeSessionSchema>;

export const InputMethodSchema = z.enum(["virtual", "midi", "mic", "self", "tap"]);
export type InputMethod = z.infer<typeof InputMethodSchema>;

export const ExerciseResultSchema = z.object({
  id: z.string(),
  date: z.string(),
  instrument: z.union([InstrumentSchema, z.literal("theory")]),
  exerciseId: z.string(),
  lessonId: z.string().optional(),
  skill: z.string().optional(),
  input: InputMethodSchema,
  correct: z.number(),
  total: z.number(),
  accuracy: z.number().min(0).max(1),
  /** Mean absolute timing error in ms, only when measured reliably. */
  timingErrorMs: z.number().optional(),
  measured: z.boolean(),
  details: z.string().optional(),
});
export type ExerciseResult = z.infer<typeof ExerciseResultSchema>;

export const ChordDrillSchema = z.object({
  id: z.string(),
  date: z.string(),
  pair: z.tuple([z.string(), z.string()]),
  durationSec: z.number(),
  transitions: z.number().int().min(0),
  mode: z.enum(["self", "audio"]),
  /** For audio mode: transitions confirmed by detection vs manually confirmed */
  confirmedByAudio: z.number().int().optional(),
  confirmedManually: z.number().int().optional(),
  cleanRate: z.number().min(0).max(1).optional(),
  untimed: z.boolean().optional(),
});
export type ChordDrillResult = z.infer<typeof ChordDrillSchema>;

export const SongProgressSchema = z.object({
  songId: z.string(),
  instrument: InstrumentSchema,
  saved: z.boolean().catch(false),
  sectionsPracticed: z.array(z.string()).catch([]),
  /** Sections the student marked "I can play this". */
  sectionsMastered: z.array(z.string()).catch([]),
  /** Best chord changes per minute measured while practising this song. */
  bestChangesPerMinute: z.number().optional(),
  bestTempo: z.number().optional(),
  minutes: z.number().catch(0),
  lastPracticed: z.string().optional(),
});
export type SongProgress = z.infer<typeof SongProgressSchema>;

export const VideoStateSchema = z.object({
  videoId: z.string(),
  favorite: z.boolean().catch(false),
  watched: z.boolean().catch(false),
  updatedAt: z.string(),
});
export type VideoState = z.infer<typeof VideoStateSchema>;

export const TranspositionSchema = z.object({
  id: z.string(),
  date: z.string(),
  progression: z.array(z.string()),
  originalKey: z.string(),
  capo: z.number().int(),
  shapes: z.array(z.string()),
  label: z.string().optional(),
});
export type Transposition = z.infer<typeof TranspositionSchema>;

export const GoalsSchema = z.object({
  dailyMinutes: z.number().int().min(5).max(120).catch(20),
  weeklyPracticeDays: z.number().int().min(1).max(7).catch(5),
  weeklyChordDrills: z.number().int().min(0).max(50).catch(5),
});
export type Goals = z.infer<typeof GoalsSchema>;
export const DEFAULT_GOALS: Goals = GoalsSchema.parse({});

/** Spaced-revision item: something answered wrong, scheduled to come back (SM-2 style). */
export const RevisionItemSchema = z.object({
  id: z.string(),
  kind: z.enum(["quiz", "exercise"]),
  lessonId: z.string(),
  /** Quiz question id or exercise step id. */
  refId: z.string(),
  track: TrackSchema,
  ease: z.number().catch(2.5),
  intervalDays: z.number().catch(0),
  reps: z.number().int().catch(0),
  due: z.string(),
  lastResult: z.enum(["wrong", "right"]).catch("wrong"),
  updatedAt: z.string(),
});
export type RevisionItem = z.infer<typeof RevisionItemSchema>;

export const CoachMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  date: z.string(),
  source: z.enum(["llm", "rules", "measured"]).optional(),
});
export type CoachMessage = z.infer<typeof CoachMessageSchema>;

/** Full export format, used for backup and local → account migration. */
export const ExportSchema = z.object({
  app: z.literal("melody-masters"),
  version: z.number(),
  exportedAt: z.string(),
  prefs: z.unknown(),
  collections: z.record(z.string(), z.array(z.object({ key: z.string(), value: z.unknown() }))),
});
export type ExportBundle = z.infer<typeof ExportSchema>;
