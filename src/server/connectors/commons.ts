// Wikimedia Commons audio search via the MediaWiki API. Licences are read from each file's
// extmetadata (LicenseShortName); anything not clearly CC0 / PD / CC BY / CC BY-SA is skipped.

import { LICENSE_LABEL, PLAYABLE_LICENSES, type Song } from '../../shared/content';
import { getJson } from './http';
import { licenseFromShortName } from './licenses';

interface CommonsPage {
  title: string;
  imageinfo?: {
    url: string;
    descriptionurl?: string;
    mediatype?: string;
    duration?: number;
    extmetadata?: Record<string, { value?: string } | undefined>;
  }[];
}

const strip = (html: string | undefined) => (html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export function commonsToSongs(pages: CommonsPage[]): Song[] {
  const out: Song[] = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || (ii.mediatype && ii.mediatype !== 'AUDIO')) continue;
    const md = ii.extmetadata ?? {};
    const lic = licenseFromShortName(md.LicenseShortName?.value);
    if (!PLAYABLE_LICENSES.has(lic)) continue;
    const title = strip(md.ObjectName?.value) || p.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '');
    const artist = strip(md.Artist?.value) || 'Unknown artist';
    out.push({
      id: `wc_${p.title.replace(/[^A-Za-z0-9]+/g, '_').slice(0, 60)}`,
      title: title.slice(0, 80),
      artist: artist.slice(0, 60),
      categories: ['playlist'],
      difficulty: 2,
      file: { url: ii.url, duration: ii.duration ?? 30 },
      rights: {
        composition: lic,
        recording: lic,
        basis: `${LICENSE_LABEL[lic]} per Wikimedia Commons file page`,
        attribution: `${title} by ${artist} (${LICENSE_LABEL[lic]}), Wikimedia Commons`,
        sourceUrl: ii.descriptionurl ?? ii.url,
        verifiedAt: new Date().toISOString(),
      },
    });
  }
  return out;
}

export async function searchCommons(query: string): Promise<Song[]> {
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', generator: 'search', gsrnamespace: '6',
    gsrsearch: `${query} filetype:audio`, gsrlimit: '20', prop: 'imageinfo',
    iiprop: 'url|extmetadata|mediatype', iiextmetadatafilter: 'LicenseShortName|Artist|ObjectName',
  });
  const r = await getJson<{ query?: { pages?: CommonsPage[] } }>(`https://commons.wikimedia.org/w/api.php?${params}`);
  return commonsToSongs(r.query?.pages ?? []);
}
