import { ORIGINAL_SONGS } from "./originals";
import { BOLLYWOOD_CHARTS } from "./bollywood";
import { PUBLIC_DOMAIN_SONGS } from "./public-domain";
import { CATALOGUE_SONGS } from "./catalogue";
import type { CatalogueSong, Song } from "./types";

export const BUILT_IN_SONGS: Song[] = [...BOLLYWOOD_CHARTS, ...ORIGINAL_SONGS, ...PUBLIC_DOMAIN_SONGS];
export { CATALOGUE_SONGS };

const SONGS = new Map(BUILT_IN_SONGS.map((s) => [s.id, s]));
const CATALOGUE = new Map(CATALOGUE_SONGS.map((s) => [s.id, s]));

export function getSong(id: string): Song | undefined {
  return SONGS.get(id);
}

export function getCatalogueSong(id: string): CatalogueSong | undefined {
  return CATALOGUE.get(id);
}

export * from "./types";
