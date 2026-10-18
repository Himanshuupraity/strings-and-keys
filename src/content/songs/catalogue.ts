import type { CatalogueSong } from "./types";

/**
 * Popular songs — catalogue entries only. We deliberately include NO chords, keys, tempos,
 * lyrics or melodies for these copyrighted songs: chords on unofficial sites are often wrong and
 * full arrangements are licensed. We link to the official audio (a YouTube search, labelled as
 * such) and to a licensed sheet-music retailer search. Students can add their own chords from a
 * source they trust with "Add with my own chords".
 */
const yt = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q + " official audio")}`;
const sheets = (q: string) => `https://www.musicnotes.com/search/go?w=${encodeURIComponent(q)}`;

function entry(id: string, title: string, artist: string, region: CatalogueSong["region"], credit?: string): CatalogueSong {
  return { id, title, artist, credit, region, officialAudioSearch: yt(`${title} ${artist}`), licensedSheetSearch: sheets(`${title} ${artist}`) };
}

export const CATALOGUE_SONGS: CatalogueSong[] = [
  entry("pop-tum-hi-ho", "Tum Hi Ho", "Arijit Singh", "bollywood", "Music: Mithoon · Film: Aashiqui 2 (2013)"),
  entry("pop-kal-ho-naa-ho", "Kal Ho Naa Ho", "Sonu Nigam", "bollywood", "Music: Shankar–Ehsaan–Loy · Film: Kal Ho Naa Ho (2003)"),
  entry("pop-tujhe-dekha-to", "Tujhe Dekha To", "Lata Mangeshkar & Kumar Sanu", "bollywood", "Music: Jatin–Lalit · Film: Dilwale Dulhania Le Jayenge (1995)"),
  entry("pop-channa-mereya", "Channa Mereya", "Arijit Singh", "bollywood", "Music: Pritam · Film: Ae Dil Hai Mushkil (2016)"),
  entry("pop-kesariya", "Kesariya", "Arijit Singh", "bollywood", "Music: Pritam · Film: Brahmāstra: Part One – Shiva (2022)"),
  entry("pop-lag-jaa-gale", "Lag Jaa Gale", "Lata Mangeshkar", "bollywood", "Music: Madan Mohan · Film: Woh Kaun Thi? (1964)"),
  entry("pop-let-it-be", "Let It Be", "The Beatles", "international", "Lennon–McCartney (1970)"),
  entry("pop-perfect", "Perfect", "Ed Sheeran", "international", "Album: ÷ (2017)"),
  entry("pop-someone-like-you", "Someone Like You", "Adele", "international", "Album: 21 (2011)"),
  entry("pop-stand-by-me", "Stand By Me", "Ben E. King", "international", "1961"),
  entry("pop-imagine", "Imagine", "John Lennon", "international", "1971"),
  entry("pop-shape-of-you", "Shape of You", "Ed Sheeran", "international", "Album: ÷ (2017)"),
];
