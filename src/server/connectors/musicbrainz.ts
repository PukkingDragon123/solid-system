// MusicBrainz (open data, CC0 core data) — real artist discographies for "artist spotlight" imports.
// Respects the 1 request/second rate limit and sends an identifying User-Agent as MusicBrainz requires.

import type { Release } from '../../shared/content';
import { getJson } from './http';

const MB = 'https://musicbrainz.org/ws/2';
const GAP = 1100;

interface MbReleaseGroup {
  id: string;
  title: string;
  'first-release-date'?: string;
  'primary-type'?: string;
  'secondary-types'?: string[];
}

export function releaseGroupsToReleases(artist: string, groups: MbReleaseGroup[]): Release[] {
  const out: Release[] = [];
  for (const g of groups) {
    if (g['primary-type'] !== 'Album' || (g['secondary-types'] ?? []).length) continue;
    const year = Number((g['first-release-date'] ?? '').slice(0, 4));
    if (!Number.isFinite(year) || year < 1900) continue;
    out.push({ id: `mb_${g.id}`, title: g.title, artist, year, kind: 'album', categories: ['playlist'], difficulty: 2, mbid: g.id, fact: `${g.title} (${year}) — data from MusicBrainz.` });
  }
  return out;
}

export async function artistDiscography(name: string): Promise<Release[]> {
  const q = encodeURIComponent(`artist:"${name.replace(/"/g, '')}"`);
  const a = await getJson<{ artists: { id: string; name: string; score: number }[] }>(`${MB}/artist?query=${q}&fmt=json&limit=1`, { minGapMs: GAP });
  const artist = a.artists?.[0];
  if (!artist || artist.score < 80) throw new Error(`MusicBrainz couldn't find an artist called “${name}”.`);
  const rg = await getJson<{ 'release-groups': MbReleaseGroup[] }>(`${MB}/release-group?artist=${artist.id}&type=album&fmt=json&limit=50`, { minGapMs: GAP });
  const releases = releaseGroupsToReleases(artist.name, rg['release-groups'] ?? []);
  // Add track lists for a handful of albums so "Guess the Album" works too.
  for (const r of releases.slice(0, 8)) {
    try {
      const rel = await getJson<{ releases: { media?: { tracks?: { title: string }[] }[] }[] }>(`${MB}/release?release-group=${r.mbid}&inc=recordings&fmt=json&limit=1`, { minGapMs: GAP });
      const tracks = (rel.releases?.[0]?.media ?? []).flatMap((m) => (m.tracks ?? []).map((t) => t.title));
      if (tracks.length >= 4) r.tracks = tracks.slice(0, 8);
    } catch {
      /* track lists are optional */
    }
  }
  return releases;
}
