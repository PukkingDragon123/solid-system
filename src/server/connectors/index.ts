// Optional external content connectors. Everything here is off unless the network allows it and,
// where a service requires one, an API key is configured. The game never depends on them.

import type { ContentPack } from '../../shared/content';
import type { ServerFeatures } from '../../shared/protocol';
import { registerAudio } from './audioProxy';
import { searchCommons } from './commons';
import { jamendoConfigured, searchJamendo } from './jamendo';
import { artistDiscography } from './musicbrainz';
import { searchOpenverse } from './openverse';
import { importSpotifyPlaylist, parsePlaylistId, spotifyConfigured } from './spotify';
import { tmdbConfigured, tmdbPopular } from './tmdb';

const OFFLINE = process.env.LOO_OFFLINE === '1';

export function connectorFeatures(): ServerFeatures {
  return {
    spotify: !OFFLINE && spotifyConfigured(),
    tmdb: !OFFLINE && tmdbConfigured(),
    musicbrainz: !OFFLINE,
    openverse: !OFFLINE,
    jamendo: !OFFLINE && jamendoConfigured(),
    commons: !OFFLINE,
  };
}

const empty = (): ContentPack => ({ songs: [], releases: [], pop: [], trivia: [], characters: [], quotes: [] });

export interface ImportResult {
  ok: boolean;
  msg: string;
  count?: number;
  pack?: ContentPack;
}

/**
 * Host-supplied import. Accepted inputs:
 *  - a Spotify playlist link            → metadata questions (needs SPOTIFY_CLIENT_ID/SECRET)
 *  - "audio: <search words>"            → openly licensed audio from Openverse, Jamendo, Wikimedia Commons
 *  - "tmdb: movies" / "tmdb: tv"        → popular titles and years from TMDB (needs a TMDB key)
 *  - any other text                     → that artist's albums from MusicBrainz
 */
export async function importPlaylist(raw: string): Promise<ImportResult> {
  const input = raw.trim().slice(0, 200);
  if (!input) return { ok: false, msg: 'Paste a Spotify playlist link, an artist name, or "audio: <words>".' };
  if (OFFLINE) return { ok: false, msg: 'This server is running offline (LOO_OFFLINE=1), so imports are disabled. Built-in content still works!' };
  try {
    if (parsePlaylistId(input)) {
      if (!spotifyConfigured()) return { ok: false, msg: 'Spotify import needs SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET on the server. Built-in rounds still work!' };
      const releases = await importSpotifyPlaylist(input);
      if (!releases.length) return { ok: false, msg: 'That playlist had no usable tracks.' };
      return { ok: true, msg: `Imported ${releases.length} tracks from Spotify as metadata rounds (Spotify audio is never played in-game).`, count: releases.length, pack: { ...empty(), releases } };
    }
    const audioMatch = /^audio\s*:\s*(.+)$/i.exec(input);
    if (audioMatch) {
      const q = audioMatch[1];
      const results = await Promise.allSettled([searchOpenverse(q), searchJamendo(q), searchCommons(q)]);
      const songs = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
      for (const s of songs) if (s.file) s.file = { ...s.file, url: registerAudio(s.file.url) };
      if (songs.length < 4) return { ok: false, msg: `Only found ${songs.length} openly licensed recordings for “${q}”. Try broader words.` };
      return { ok: true, msg: `Found ${songs.length} openly licensed recordings (CC0 / CC BY / CC BY-SA only). Attribution shows on every reveal.`, count: songs.length, pack: { ...empty(), songs } };
    }
    const tmdbMatch = /^tmdb\s*:\s*(movies?|tv)$/i.exec(input);
    if (tmdbMatch) {
      if (!tmdbConfigured()) return { ok: false, msg: 'TMDB import needs TMDB_READ_TOKEN or TMDB_API_KEY on the server.' };
      const pop = await tmdbPopular(tmdbMatch[1].toLowerCase().startsWith('movie') ? 'movie' : 'tv');
      return { ok: true, msg: `Imported ${pop.length} popular titles from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.`, count: pop.length, pack: { ...empty(), pop } };
    }
    const releases = await artistDiscography(input);
    if (releases.length < 3) return { ok: false, msg: `MusicBrainz only has ${releases.length} studio albums for that artist — try another!` };
    return { ok: true, msg: `Imported ${releases.length} albums by ${releases[0].artist} from MusicBrainz.`, count: releases.length, pack: { ...empty(), releases } };
  } catch (err) {
    return { ok: false, msg: `Import failed: ${(err as Error).message}` };
  }
}
