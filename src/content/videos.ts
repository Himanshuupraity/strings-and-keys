/**
 * Curated video library.
 *
 * Every entry below was checked on 2026-10-18 against YouTube's public oEmbed endpoint
 * (https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json), which only
 * answers for videos that exist and allow embedding. `title` and `creator` are copied verbatim
 * from that response. Descriptions are our own short summaries. Videos can be removed or made
 * private later — the player always offers a "Watch on YouTube" fallback.
 *
 * Search entries are NOT videos: they're YouTube search links, clearly labelled in the UI.
 */
export const VERIFIED_AT = "2026-10-18";

export type VideoCategory =
  | "guitar-beginners"
  | "piano-beginners"
  | "theory"
  | "notes-scales"
  | "chords"
  | "rhythm"
  | "finger-exercises"
  | "bollywood"
  | "pop"
  | "intermediate-advanced";

export type VideoLevel = "beginner" | "intermediate" | "advanced";

export interface CuratedVideo {
  id: string;
  title: string;
  creator: string;
  category: VideoCategory;
  instrument: "guitar" | "piano" | "both";
  level: VideoLevel;
  topics: string[];
  description: string;
  verifiedAt: string;
}

export interface VideoSearchLink {
  label: string;
  query: string;
  category: VideoCategory;
  instrument: "guitar" | "piano" | "both";
}

export const VIDEO_CATEGORIES: { id: VideoCategory; label: string }[] = [
  { id: "guitar-beginners", label: "Guitar for absolute beginners" },
  { id: "piano-beginners", label: "Piano for absolute beginners" },
  { id: "theory", label: "Music theory" },
  { id: "notes-scales", label: "Notes & scales" },
  { id: "chords", label: "Chords & chord transitions" },
  { id: "rhythm", label: "Rhythm & timing" },
  { id: "finger-exercises", label: "Finger exercises" },
  { id: "bollywood", label: "Bollywood & Hindi" },
  { id: "pop", label: "Pop songs" },
  { id: "intermediate-advanced", label: "Intermediate & advanced" },
];

export const VIDEOS: CuratedVideo[] = [
  { id: "BBz-Jyr23M4", title: "Guitar Lesson 1 - Absolute Beginner? Start Here! [Free 10 Day Starter Course]", creator: "Andy Guitar", category: "guitar-beginners", instrument: "guitar", level: "beginner", topics: ["posture", "first-chords", "guitar-basics"], description: "Day one of a free 10-day starter course for complete beginners.", verifiedAt: VERIFIED_AT },
  { id: "yh6sPqDEZCY", title: "Super Easy First Guitar Lesson - Guitar Lessons For Beginners - Stage 1 - The D Chord", creator: "JustinGuitar", category: "guitar-beginners", instrument: "guitar", level: "beginner", topics: ["first-chords", "chords", "guitar-basics"], description: "A gentle first lesson built around the D chord.", verifiedAt: VERIFIED_AT },
  { id: "X2EmpWr9vUc", title: "How to Tune Your Guitar For Beginners", creator: "JustinGuitar", category: "guitar-beginners", instrument: "guitar", level: "beginner", topics: ["tuning", "guitar-basics"], description: "How to get your guitar in tune before you play.", verifiedAt: VERIFIED_AT },
  { id: "LlN2yrFQKzY", title: "How to Read Guitar Chord Charts", creator: "JustinGuitar", category: "guitar-beginners", instrument: "guitar", level: "beginner", topics: ["chord-diagrams", "reading", "chords"], description: "How to read the chord boxes used throughout this app.", verifiedAt: VERIFIED_AT },
  { id: "R_qmvyUDvEc", title: "First 7 Chords To Learn on Guitar", creator: "Andy Guitar", category: "chords", instrument: "guitar", level: "beginner", topics: ["first-chords", "chords", "open-chords"], description: "A tour of the first seven open chords most beginners learn.", verifiedAt: VERIFIED_AT },
  { id: "HtJ08n97X2c", title: "Play TEN songs with three EASY Minor Chords - Em, Am, and Dm - Easy beginner guitar lesson", creator: "Andy Guitar", category: "chords", instrument: "guitar", level: "beginner", topics: ["open-chords", "minor-chords", "songs"], description: "Em, Am and Dm with simple songs to apply them.", verifiedAt: VERIFIED_AT },
  { id: "1X2rW5ATdLQ", title: "How to Play the A Chord | Guitar for Beginners", creator: "JustinGuitar", category: "chords", instrument: "guitar", level: "beginner", topics: ["open-chords", "chords"], description: "Step-by-step help for the open A major chord.", verifiedAt: VERIFIED_AT },
  { id: "uxzhPg5sRhM", title: "How To Play Piano | Your First Piano Lesson (2025 Edition)", creator: "Pianote", category: "piano-beginners", instrument: "piano", level: "beginner", topics: ["keyboard", "middle-c", "piano-basics"], description: "A complete first piano lesson for absolute beginners.", verifiedAt: VERIFIED_AT },
  { id: "QBH6IpRkVDs", title: "How To Play Piano for Beginners, Lesson 1 || The Piano Keyboard", creator: "Bill Hilton", category: "piano-beginners", instrument: "piano", level: "beginner", topics: ["keyboard", "notes", "piano-basics"], description: "Getting to know the layout of the piano keyboard.", verifiedAt: VERIFIED_AT },
  { id: "tEtukfFv3Wk", title: "How To Play Piano (Beginner Piano Lesson)", creator: "Pianote", category: "piano-beginners", instrument: "piano", level: "beginner", topics: ["keyboard", "piano-basics", "reading"], description: "A beginner lesson covering the keyboard, a first scale and simple reading.", verifiedAt: VERIFIED_AT },
  { id: "xTOOWe_yLwY", title: "Building Blocks: What's A Note?", creator: "12tone", category: "theory", instrument: "both", level: "beginner", topics: ["notes", "pitch", "theory-basics"], description: "A short, friendly explanation of what a musical note is.", verifiedAt: VERIFIED_AT },
  { id: "heRleAas0lY", title: "Building Blocks: How Notes Relate", creator: "12tone", category: "theory", instrument: "both", level: "beginner", topics: ["notes", "semitones", "octaves", "theory-basics"], description: "How notes relate to each other: steps, half steps and octaves.", verifiedAt: VERIFIED_AT },
  { id: "5qAZKER0u10", title: "Building Blocks: What's A Scale?", creator: "12tone", category: "notes-scales", instrument: "both", level: "beginner", topics: ["scales", "major-scale", "theory-basics"], description: "What a scale is and why it matters.", verifiedAt: VERIFIED_AT },
  { id: "m9GlB8tanNE", title: "Explaining Musical Intervals As CLEARLY As I Possibly Can [MUSIC THEORY FUNDAMENTALS]", creator: "Signals Music Studio", category: "theory", instrument: "both", level: "intermediate", topics: ["intervals", "theory"], description: "A clear walkthrough of musical intervals.", verifiedAt: VERIFIED_AT },
  { id: "tojM1qapHSU", title: "Learn Scale Degrees- Music Theory for Guitar Players", creator: "Signals Music Studio", category: "notes-scales", instrument: "guitar", level: "intermediate", topics: ["scale-degrees", "scales", "theory"], description: "Scale degrees explained with guitar examples.", verifiedAt: VERIFIED_AT },
  { id: "O43EBVnwNvo", title: "Circle of Fifths: Everything You Need to Know", creator: "Brad Harrison Music", category: "theory", instrument: "both", level: "intermediate", topics: ["circle-of-fifths", "keys", "key-signatures"], description: "The circle of fifths and how keys connect.", verifiedAt: VERIFIED_AT },
  { id: "PyOKefHURsg", title: "How to Read Notes The EASY Way You Weren’t Taught", creator: "Pianote", category: "theory", instrument: "piano", level: "beginner", topics: ["reading", "treble-clef", "bass-clef", "notation"], description: "An approachable method for reading notes on the staff.", verifiedAt: VERIFIED_AT },
  { id: "MdjJc9WXKhk", title: "Grade 1 Piano Sight Reading - Bass Clef Reading Exercises", creator: "Music Matters", category: "theory", instrument: "piano", level: "beginner", topics: ["reading", "bass-clef", "sight-reading"], description: "Bass clef reading exercises at a beginner level.", verifiedAt: VERIFIED_AT },
  { id: "eEJpypexUDg", title: "SUPER EASY Scale for Beginners | E Minor Pentatonic Scale", creator: "JustinGuitar", category: "notes-scales", instrument: "guitar", level: "beginner", topics: ["pentatonic", "scales", "lead"], description: "An easy first scale for guitar: E minor pentatonic.", verifiedAt: VERIFIED_AT },
  { id: "G-X1RemAzks", title: "Minor Pentatonic Scale - Stage 7 Guitar Lesson - Guitar For Beginners [BC-176]", creator: "JustinGuitar", category: "notes-scales", instrument: "guitar", level: "intermediate", topics: ["pentatonic", "scales", "lead"], description: "The minor pentatonic pattern as part of a structured course.", verifiedAt: VERIFIED_AT },
  { id: "mAgc7hr44WM", title: "Get FASTER Chord Changes On Guitar!", creator: "JustinGuitar", category: "chords", instrument: "guitar", level: "beginner", topics: ["chord-changes", "chords", "practice"], description: "Tips for switching between chords more quickly and cleanly.", verifiedAt: VERIFIED_AT },
  { id: "p_zzSYEtY-U", title: "One minute Changes (Guitar Lesson BC-144) Guitar for beginners Stage 4", creator: "JustinGuitar", category: "chords", instrument: "guitar", level: "beginner", topics: ["chord-changes", "one-minute-changes", "practice"], description: "The classic one-minute chord change exercise, explained.", verifiedAt: VERIFIED_AT },
  { id: "4cR1sa1_d_8", title: "The Easiest F Chord Guitar Lesson You'll Find :)", creator: "JustinGuitar", category: "chords", instrument: "guitar", level: "intermediate", topics: ["f-chord", "barre", "chords"], description: "An easy route into the dreaded F chord.", verifiedAt: VERIFIED_AT },
  { id: "ZYbxYoG6Mo0", title: "Easy Barre Chords For Beginners", creator: "JustinGuitar", category: "intermediate-advanced", instrument: "guitar", level: "intermediate", topics: ["barre", "chords"], description: "A beginner-friendly approach to barre chords.", verifiedAt: VERIFIED_AT },
  { id: "gmvwZRwn-j0", title: "Piano chords for beginners: learn four chords to play hundreds of songs", creator: "Bill Hilton", category: "chords", instrument: "piano", level: "beginner", topics: ["piano-chords", "chords", "songs"], description: "Four piano chords that cover a huge number of songs.", verifiedAt: VERIFIED_AT },
  { id: "8knTeb2JFzk", title: "Major vs. Minor Piano Chords - What's the Difference?", creator: "Pianote", category: "chords", instrument: "piano", level: "beginner", topics: ["major-minor", "triads", "chords"], description: "The difference between major and minor chords on piano.", verifiedAt: VERIFIED_AT },
  { id: "Xuuq8DtUy_g", title: "Piano Chord Inversions", creator: "Pianote", category: "intermediate-advanced", instrument: "piano", level: "intermediate", topics: ["inversions", "chords"], description: "What chord inversions are and how to play them.", verifiedAt: VERIFIED_AT },
  { id: "ely9LaJJJr4", title: "Beginner Strumming Patterns For Acoustic Guitar Pattern 1 - Beginner Guitar Lessons", creator: "Marty Music", category: "rhythm", instrument: "guitar", level: "beginner", topics: ["strumming", "rhythm"], description: "A first strumming pattern for acoustic guitar.", verifiedAt: VERIFIED_AT },
  { id: "NCV9IgeSYuU", title: "Beginner Guitar Strumming Patterns You MUST Know!", creator: "Marty Music", category: "rhythm", instrument: "guitar", level: "beginner", topics: ["strumming", "rhythm", "patterns"], description: "Essential beginner strumming patterns.", verifiedAt: VERIFIED_AT },
  { id: "YfT0irsgB3Q", title: "How to Count Basic Rhythms (Part 1)", creator: "The Mento Zone", category: "rhythm", instrument: "both", level: "beginner", topics: ["rhythm", "counting", "note-durations"], description: "How to count basic rhythms.", verifiedAt: VERIFIED_AT },
  { id: "SxNh6gKD3aU", title: "How To Count Rhythm on Guitar for Beginners", creator: "Lauren Bateman", category: "rhythm", instrument: "guitar", level: "beginner", topics: ["rhythm", "counting", "strumming"], description: "Counting rhythm while you play guitar.", verifiedAt: VERIFIED_AT },
  { id: "g4G8VQ194sc", title: "Piano Exercises For Beginners (Speed, Dexterity, Hand Independence, Control)", creator: "Pianote", category: "finger-exercises", instrument: "piano", level: "beginner", topics: ["finger-independence", "technique", "exercises"], description: "Piano exercises for dexterity, control and hand independence.", verifiedAt: VERIFIED_AT },
  { id: "jT1daGH32k8", title: "Quick Hammer Ons Pull Offs Exercise - Guitar Technique Lesson", creator: "Andy Guitar", category: "finger-exercises", instrument: "guitar", level: "intermediate", topics: ["hammer-ons", "pull-offs", "technique"], description: "A quick hammer-on and pull-off workout.", verifiedAt: VERIFIED_AT },
  { id: "7hDdZAjKBjY", title: "Hammer-Ons Explained + Exercise For Beginners", creator: "JustinGuitar", category: "finger-exercises", instrument: "guitar", level: "beginner", topics: ["hammer-ons", "technique"], description: "Hammer-ons explained with a beginner exercise.", verifiedAt: VERIFIED_AT },
  { id: "w-Zt5Kbf3TM", title: "Guitar Lesson 1 - Playing 2 Most Easiest Chords 🎸| Guitar Lessons for Beginners | FrontRow", creator: "SIFF Guitar", category: "guitar-beginners", instrument: "guitar", level: "beginner", topics: ["first-chords", "hindi", "guitar-basics"], description: "A first lesson playing the two easiest chords (Hindi/English teacher).", verifiedAt: VERIFIED_AT },
  { id: "fOKragFnmKU", title: "Guitar Lesson 1 | Free 10 Day Guitar Course For Beginners ", creator: "Guitar With Aman", category: "guitar-beginners", instrument: "guitar", level: "beginner", topics: ["guitar-basics", "hindi"], description: "Day one of a free 10-day beginner course, taught in Hindi.", verifiedAt: VERIFIED_AT },
  { id: "PD4qZ3qxhYI", title: "Guitar Hammer on Pull off and slides - Basic Beginner's Lesson | Learn KKHH Theme", creator: "Sagar Roy", category: "bollywood", instrument: "guitar", level: "intermediate", topics: ["hammer-ons", "slides", "bollywood"], description: "Hammer-ons, pull-offs and slides, applied to a Bollywood theme.", verifiedAt: VERIFIED_AT },
  { id: "sTYa8O4pXkc", title: "LIVE Lesson 2 : Playing Sa Re Ga Ma | Introduction to Musical Alphabet  🎸#guitar  #siffyoungartiste", creator: "SIFF Guitar", category: "bollywood", instrument: "guitar", level: "beginner", topics: ["sargam", "notes", "hindi"], description: "Playing Sa Re Ga Ma on guitar \u2014 an intro to the musical alphabet in Hindi.", verifiedAt: VERIFIED_AT },
  { id: "C7p19R26SxI", title: "Easy Bollywood Songs On Guitar with 2 Chords | Guitar Lessons For Beginners | @Siffguitar", creator: "SIFF Guitar", category: "bollywood", instrument: "guitar", level: "beginner", topics: ["songs", "bollywood", "chords"], description: "Easy Bollywood songs using only two chords.", verifiedAt: VERIFIED_AT },
  { id: "q1DtEVmte9Y", title: "Tum Se Hi Guitar Lesson | Play Your First Song | Easy For Beginners", creator: "Guitar With Aman", category: "bollywood", instrument: "guitar", level: "beginner", topics: ["songs", "bollywood", "first-song"], description: "A first Bollywood song lesson for beginners.", verifiedAt: VERIFIED_AT },
  { id: "AY2q8CJKqZY", title: "10 Effortless Songs Any Beginner Can Master", creator: "Piano Superhuman Tutorials - Learn Piano Easy", category: "pop", instrument: "piano", level: "beginner", topics: ["songs", "pop"], description: "Ten simple songs that beginner pianists can learn.", verifiedAt: VERIFIED_AT },
  { id: "Jg-BRpn38L8", title: "Play TEN guitar songs with two EASY chords | Beginners first guitar lesson", creator: "Andy Guitar", category: "pop", instrument: "guitar", level: "beginner", topics: ["songs", "pop", "chords"], description: "Ten songs you can play with two easy chords.", verifiedAt: VERIFIED_AT },
  { id: "2WB8otOcz78", title: "Finger Style For Beginners. Start Here.", creator: "JustinGuitar", category: "intermediate-advanced", instrument: "guitar", level: "intermediate", topics: ["fingerstyle", "technique"], description: "Where to start with fingerstyle guitar.", verifiedAt: VERIFIED_AT },
  { id: "jF0RduFSyHg", title: "5 Fingerstyle Patterns You Need to Know", creator: "JustinGuitar", category: "intermediate-advanced", instrument: "guitar", level: "intermediate", topics: ["fingerstyle", "patterns"], description: "Five fingerstyle patterns worth knowing.", verifiedAt: VERIFIED_AT },
  { id: "koJVelJdnZE", title: "How To Use A Sustain Pedal - Piano Lesson (Pianote)", creator: "Pianote", category: "intermediate-advanced", instrument: "piano", level: "beginner", topics: ["sustain-pedal", "pedal", "technique"], description: "A short guide to using the sustain pedal.", verifiedAt: VERIFIED_AT },
  { id: "ZHBomQaAvQo", title: "Minor Pentatonic Five Positions (Guitar Lesson SC-024) How to play", creator: "JustinGuitar", category: "intermediate-advanced", instrument: "guitar", level: "advanced", topics: ["pentatonic", "scales", "lead"], description: "All five positions of the minor pentatonic scale.", verifiedAt: VERIFIED_AT },
  { id: "6GSEYxrTSlU", title: "How To Practice Chord Inversions On The Piano", creator: "Pianote", category: "intermediate-advanced", instrument: "piano", level: "intermediate", topics: ["inversions", "practice"], description: "How to practise chord inversions.", verifiedAt: VERIFIED_AT },
  { id: "7bXuewvJ1wg", title: "Ultimate Intervals 1 - Musical Ear Training for Beginners - 1sts, 5ths, and Octaves", creator: "Joe Luegers Music Academy", category: "theory", instrument: "both", level: "beginner", topics: ["ear-training", "intervals"], description: "Beginner ear training: unisons, fifths and octaves.", verifiedAt: VERIFIED_AT },
];

/** Fallback searches — opened on YouTube, never presented as verified videos. */
export const VIDEO_SEARCHES: VideoSearchLink[] = [
  { label: "Piano finger exercises for beginners", query: "piano finger exercises beginners", category: "finger-exercises", instrument: "piano" },
  { label: "Bollywood songs on piano (easy)", query: "easy bollywood song piano tutorial beginners", category: "bollywood", instrument: "piano" },
  { label: "Hindi keyboard lessons for beginners", query: "keyboard lesson hindi beginners", category: "piano-beginners", instrument: "piano" },
  { label: "Easy pop songs on guitar", query: "easy pop songs guitar beginners lesson", category: "pop", instrument: "guitar" },
  { label: "Harmonium / keyboard sargam practice", query: "sargam practice keyboard sa re ga ma beginners", category: "bollywood", instrument: "piano" },
  { label: "Guitar alternate picking exercises", query: "alternate picking exercise beginners guitar", category: "finger-exercises", instrument: "guitar" },
  { label: "Jazz piano voicings", query: "jazz piano voicings lesson", category: "intermediate-advanced", instrument: "piano" },
  { label: "Lead guitar phrasing", query: "lead guitar phrasing lesson", category: "intermediate-advanced", instrument: "guitar" },
];

export function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** Privacy-enhanced embed (no cookies until playback). */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
}

export function youtubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
