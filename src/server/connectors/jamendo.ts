// Jamendo API (needs JAMENDO_CLIENT_ID). Only tracks whose own licence URL is CC BY or CC BY-SA are kept;
// NC/ND tracks (most of Jamendo) are rejected because rounds modify and redistribute clips.

import { LICENSE_LABEL, PLAYABLE_LICENSES, type Song } from '../../shared/content';
import { getJson } from './http';
import { licenseFromCcUrl } from './licenses';

const CLIENT_ID = process.env.JAMENDO_CLIENT_ID ?? '';

export function jamendoConfigured(): boolean {
  return Boolean(CLIENT_ID);
}

export interface JamendoTrack {
  id: string;
  name: string;
  artist_name: string;
  album_name?: string;
  releasedate?: string;
  duration?: number;
  audio: string;
  license_ccurl?: string;
  shareurl?: string;
  musicinfo?: { tags?: { genres?: string[] } };
}

export function jamendoToSongs(tracks: JamendoTrack[]): Song[] {
  const out: Song[] = [];
  for (const t of tracks) {
    const lic = licenseFromCcUrl(t.license_ccurl);
    if (!PLAYABLE_LICENSES.has(lic) || !t.audio) continue;
    const year = Number((t.releasedate ?? '').slice(0, 4)) || undefined;
    out.push({
      id: `jm_${t.id}`,
      title: t.name.slice(0, 80),
      artist: t.artist_name.slice(0, 60),
      year,
      album: t.album_name,
      categories: ['playlist'],
      difficulty: 2,
      genre: t.musicinfo?.tags?.genres?.[0],
      file: { url: t.audio, duration: t.duration ?? 30 },
      rights: {
        composition: lic,
        recording: lic,
        basis: `${LICENSE_LABEL[lic]} per Jamendo track licence`,
        attribution: `“${t.name}” by ${t.artist_name} (${LICENSE_LABEL[lic]}) via Jamendo`,
        sourceUrl: t.shareurl ?? `https://www.jamendo.com/track/${t.id}`,
        verifiedAt: new Date().toISOString(),
      },
      hook: [Math.min(20, (t.duration ?? 30) * 0.25), Math.min(20, (t.duration ?? 30) * 0.25) + 8],
    });
  }
  return out;
}

export async function searchJamendo(query: string): Promise<Song[]> {
  if (!CLIENT_ID) return [];
  const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${CLIENT_ID}&format=json&limit=30&search=${encodeURIComponent(query)}&include=licenses+musicinfo&audioformat=mp32`;
  const r = await getJson<{ results: JamendoTrack[] }>(url);
  return jamendoToSongs(r.results ?? []);
}
