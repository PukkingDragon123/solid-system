// Builds the server-side content database, filtering anything that isn't safely licensed.

import { BASE_PACK } from '../content';
import { isPlayable, LICENSE_LABEL, LICENSE_NEEDS_ATTRIBUTION, PLAYABLE_LICENSES, type ContentPack, type Song } from '../shared/content';
import { ContentDB } from '../shared/game/questions';
import type { RecordInfo } from '../shared/protocol';
import { compileScore } from '../shared/music';

export interface PackReport {
  songs: number;
  playable: number;
  metadataOnly: number;
  rejected: { id: string; reason: string }[];
}

/**
 * Validates songs: a song with audio that isn't clearly licensed keeps its metadata (so it can still
 * appear in trivia) but loses its audio. Broken scores are dropped entirely.
 */
export function sanitizePack(pack: ContentPack, report?: PackReport): ContentPack {
  const songs: Song[] = [];
  for (const s of pack.songs) {
    if (s.score) {
      try {
        compileScore(s.score);
      } catch (err) {
        report?.rejected.push({ id: s.id, reason: `bad score: ${(err as Error).message}` });
        continue;
      }
    }
    if ((s.score || s.file) && !isPlayable(s)) {
      const why = !PLAYABLE_LICENSES.has(s.rights.composition) || !PLAYABLE_LICENSES.has(s.rights.recording)
        ? `licence not playable (${s.rights.composition}/${s.rights.recording})`
        : LICENSE_NEEDS_ATTRIBUTION.has(s.rights.recording) && !s.rights.attribution ? 'missing attribution' : 'unverified external file';
      report?.rejected.push({ id: s.id, reason: `${why} — kept as metadata only` });
      songs.push({ ...s, score: undefined, file: undefined });
      continue;
    }
    songs.push(s);
  }
  if (report) {
    report.songs += songs.length;
    report.playable += songs.filter(isPlayable).length;
    report.metadataOnly += songs.filter((s) => !isPlayable(s)).length;
  }
  return { ...pack, songs };
}

export function mergePacks(...packs: ContentPack[]): ContentPack {
  const seen = new Set<string>();
  const uniq = <T extends { id: string }>(xs: T[]) => xs.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  return {
    songs: uniq(packs.flatMap((p) => p.songs)),
    releases: uniq(packs.flatMap((p) => p.releases)),
    pop: uniq(packs.flatMap((p) => p.pop)),
    trivia: uniq(packs.flatMap((p) => p.trivia)),
    characters: uniq(packs.flatMap((p) => p.characters)),
    quotes: uniq(packs.flatMap((p) => p.quotes)),
  };
}

export const lastReport: PackReport = { songs: 0, playable: 0, metadataOnly: 0, rejected: [] };

export function buildContent(extra: ContentPack[] = []): ContentDB {
  const report: PackReport = { songs: 0, playable: 0, metadataOnly: 0, rejected: [] };
  const pack = sanitizePack(mergePacks(BASE_PACK, ...extra), report);
  Object.assign(lastReport, report);
  if (report.rejected.length) console.warn('[content] filtered:', report.rejected.slice(0, 10));
  return new ContentDB(pack);
}

export function contentSummary(db: ContentDB) {
  return {
    songs: db.songs.length,
    playable: db.playable.length,
    releases: db.releases.length,
    pop: db.pop.length,
    trivia: db.trivia.length,
    characters: db.characters.length,
    quotes: db.quotes.length,
  };
}

export function recordsFor(db: ContentDB, ids: string[]): RecordInfo[] {
  const out: RecordInfo[] = [];
  for (const id of ids) {
    const s = db.getSong(id);
    if (!s) continue;
    out.push({ id: s.id, title: s.title, artist: s.artist, year: s.year, cover: s.cover, license: `${LICENSE_LABEL[s.rights.composition]} · ${s.rights.basis}`, categories: s.categories });
  }
  return out;
}

/** Machine-readable licensing manifest shown on the in-game credits board. */
export function creditsManifest(db: ContentDB) {
  return {
    music: db.playable.map((s) => ({
      title: s.title,
      artist: s.artist,
      composition: LICENSE_LABEL[s.rights.composition],
      recording: s.score ? 'Performed live by the in-game synth (original arrangement, CC0)' : LICENSE_LABEL[s.rights.recording],
      basis: s.rights.basis,
      attribution: s.rights.attribution,
      source: s.rights.sourceUrl,
    })),
    metadataOnly: db.songs.filter((s) => !isPlayable(s)).length,
    facts: 'Release years, track lists, credits and trivia are factual data compiled by hand for this game. No copyrighted audio, artwork or lyrics are included.',
    filtered: lastReport.rejected,
  };
}
