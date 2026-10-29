// Spotify Web API (official) — imports *metadata only* from a public playlist using the Client
// Credentials flow. Spotify audio is never streamed, downloaded or cached: imported tracks become
// release-year / which-came-first / guess-the-artist questions, each linking back to Spotify.

import type { Release } from '../../shared/content';
import { getJson } from './http';

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET ?? '';

let cached: { token: string; exp: number } | null = null;

export function spotifyConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

export function parsePlaylistId(input: string): string | null {
  const m = /playlist[/:]([A-Za-z0-9]{22})/.exec(input);
  return m ? m[1] : null;
}

async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 30000) return cached.token;
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const r = await getJson<{ access_token: string; expires_in: number }>('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { authorization: `Basic ${auth}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  cached = { token: r.access_token, exp: Date.now() + r.expires_in * 1000 };
  return cached.token;
}

interface SpotifyTrack {
  id: string | null;
  name: string;
  artists: { name: string }[];
  album: { name: string; release_date?: string };
  external_urls?: { spotify?: string };
  is_local?: boolean;
}

export function tracksToReleases(items: { track: SpotifyTrack | null }[]): Release[] {
  const out: Release[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const t = it.track;
    if (!t || !t.id || t.is_local) continue;
    const year = Number((t.album?.release_date ?? '').slice(0, 4));
    if (!Number.isFinite(year) || year < 1900) continue;
    const key = `${t.name}|${t.artists[0]?.name}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `sp_${t.id}`,
      title: t.name,
      artist: t.artists.map((a) => a.name).slice(0, 2).join(' & '),
      year,
      kind: 'single',
      categories: ['playlist'],
      difficulty: 2,
      fact: `From the album “${t.album.name}” (${year}). Imported from Spotify.`,
      spotifyUrl: t.external_urls?.spotify,
    });
  }
  return out;
}

export async function importSpotifyPlaylist(input: string): Promise<Release[]> {
  const id = parsePlaylistId(input);
  if (!id) throw new Error('That doesn\'t look like a Spotify playlist link.');
  const token = await accessToken();
  const fields = 'items(track(id,name,is_local,artists(name),album(name,release_date),external_urls)),next';
  let url: string | null = `https://api.spotify.com/v1/playlists/${id}/tracks?limit=100&fields=${encodeURIComponent(fields)}`;
  const items: { track: SpotifyTrack | null }[] = [];
  for (let page = 0; url && page < 3; page++) {
    const r: { items: { track: SpotifyTrack | null }[]; next: string | null } = await getJson(url, { headers: { authorization: `Bearer ${token}` } });
    items.push(...r.items);
    url = r.next;
  }
  return tracksToReleases(items);
}
