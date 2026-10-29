// TMDB (needs TMDB_READ_TOKEN or TMDB_API_KEY). Uses only titles and release years for
// movie/TV trivia. Required notice: "This product uses the TMDB API but is not endorsed or certified by TMDB."

import type { PopItem } from '../../shared/content';
import { getJson } from './http';

const READ_TOKEN = process.env.TMDB_READ_TOKEN ?? '';
const API_KEY = process.env.TMDB_API_KEY ?? '';

export function tmdbConfigured(): boolean {
  return Boolean(READ_TOKEN || API_KEY);
}

export const TMDB_NOTICE = 'This product uses the TMDB API but is not endorsed or certified by TMDB.';

interface TmdbItem { id: number; title?: string; name?: string; release_date?: string; first_air_date?: string; popularity?: number }

export function tmdbToPop(items: TmdbItem[], kind: 'movie' | 'tv'): PopItem[] {
  const out: PopItem[] = [];
  for (const it of items) {
    const title = kind === 'movie' ? it.title : it.name;
    const year = Number((kind === 'movie' ? it.release_date : it.first_air_date)?.slice(0, 4));
    if (!title || !Number.isFinite(year) || year < 1900) continue;
    out.push({ id: `tmdb_${kind}_${it.id}`, title, year, kind, categories: ['playlist', kind === 'movie' ? 'movies' : 'tv'], difficulty: 2, fact: `${title} (${year}). ${TMDB_NOTICE}` });
  }
  return out;
}

export async function tmdbPopular(kind: 'movie' | 'tv'): Promise<PopItem[]> {
  const out: PopItem[] = [];
  for (let page = 1; page <= 3; page++) {
    const url = `https://api.themoviedb.org/3/${kind}/popular?language=en-US&page=${page}${READ_TOKEN ? '' : `&api_key=${API_KEY}`}`;
    const r = await getJson<{ results: TmdbItem[] }>(url, READ_TOKEN ? { headers: { authorization: `Bearer ${READ_TOKEN}` } } : {});
    out.push(...tmdbToPop(r.results ?? [], kind));
  }
  return out;
}
