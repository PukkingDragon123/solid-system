// Openverse (WordPress) audio search, restricted server-side to CC0 / PDM / CC BY / CC BY-SA.
// Licence data comes from Openverse's per-item metadata (sourced from the original provider).

import { LICENSE_LABEL, PLAYABLE_LICENSES, type Song } from '../../shared/content';
import { getJson } from './http';
import { licenseFromCode } from './licenses';

export interface OpenverseAudio {
  id: string;
  title: string;
  creator?: string;
  license: string;
  license_version?: string;
  url: string;
  foreign_landing_url?: string;
  attribution?: string;
  duration?: number; // ms
  genres?: string[];
  provider?: string;
}

const COVER_HINT = /\b(cover|karaoke|tribute|remix of|originally by|instrumental version of|parody)\b/i;

export function openverseToSongs(results: OpenverseAudio[]): Song[] {
  const out: Song[] = [];
  for (const r of results) {
    const lic = licenseFromCode(r.license, r.license_version);
    if (!PLAYABLE_LICENSES.has(lic) || !r.url || !r.title) continue;
    // A licensed recording of someone else's song doesn't license the composition — skip likely covers.
    if (COVER_HINT.test(r.title)) continue;
    const dur = (r.duration ?? 0) / 1000;
    if (dur && dur < 12) continue;
    out.push({
      id: `ov_${r.id}`,
      title: r.title.slice(0, 80),
      artist: (r.creator ?? 'Unknown artist').slice(0, 60),
      categories: ['playlist'],
      difficulty: 2,
      genre: r.genres?.[0],
      file: { url: r.url, duration: dur || 30 },
      rights: {
        composition: lic,
        recording: lic,
        basis: `${LICENSE_LABEL[lic]} per Openverse/${r.provider ?? 'provider'} metadata`,
        attribution: r.attribution ?? `“${r.title}” by ${r.creator ?? 'unknown'} (${LICENSE_LABEL[lic]})`,
        sourceUrl: r.foreign_landing_url ?? r.url,
        verifiedAt: new Date().toISOString(),
      },
      hook: [Math.min(20, (dur || 30) * 0.25), Math.min(30, (dur || 30) * 0.25) + 8],
    });
  }
  return out;
}

export async function searchOpenverse(query: string): Promise<Song[]> {
  const url = `https://api.openverse.org/v1/audio/?q=${encodeURIComponent(query)}&license=cc0,pdm,by,by-sa&page_size=20&mature=false`;
  const r = await getJson<{ results: OpenverseAudio[] }>(url);
  return openverseToSongs(r.results ?? []);
}
