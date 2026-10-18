import type { CatalogueSong } from "./types";
import { BOLLYWOOD_CATALOGUE } from "./bollywood-catalogue";

/**
 * Song catalogue: well-known songs WITHOUT chords. Song details (singers, film, year, composer)
 * were fact-checked against Wikipedia / official credits. We link to the official audio
 * (a YouTube search, labelled as such), a web search for chords (third-party, unverified), and the
 * "add with my own chords" editor.
 */
export const yt = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q + " official audio")}`;
export const sheets = (q: string) => `https://www.musicnotes.com/search/go?w=${encodeURIComponent(q)}`;
export const chordsSearch = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q + " guitar chords")}`;

export interface CatalogueRow {
  title: string;
  singers: string;
  film: string;
  year: number;
  composer: string;
}

export function slug(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function fromRow(r: CatalogueRow): CatalogueSong {
  const isFilm = !/^(single|album|ep)\b/i.test(r.film) && !/\((album|EP)\)$/i.test(r.film);
  return {
    id: `bw-${slug(r.title)}-${r.year}`,
    title: r.title,
    artist: r.singers,
    region: "bollywood",
    film: r.film,
    year: r.year,
    composer: r.composer,
    credit: `Music: ${r.composer} · ${isFilm ? `Film: ${r.film}` : r.film} (${r.year})`,
    officialAudioSearch: yt(`${r.title} ${r.film === "single" ? r.singers.split(/[,&]/)[0] : r.film}`),
    licensedSheetSearch: sheets(`${r.title} ${r.singers.split(/[,&]/)[0]}`),
    chordSearch: chordsSearch(`${r.title} ${isFilm ? r.film : r.singers.split(/[,&]/)[0]}`),
  };
}

export const CATALOGUE_SONGS: CatalogueSong[] = BOLLYWOOD_CATALOGUE.map(fromRow);
