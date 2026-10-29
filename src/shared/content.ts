// Content model + licensing policy. The database itself lives server-side (src/content) so answers
// never ship to clients; this module only defines shapes and the rules for what may be played.

import type { CategoryId } from './catalog';
import type { LyricLine, SongScore } from './music';

/**
 * Licence identifiers we understand. Only the "playable" subset may ever be used for audio rounds:
 * public domain or open licences that allow commercial use, modification (we clip, reverse and
 * speed tracks up) and redistribution. NC and ND licences are deliberately excluded.
 */
export type LicenseId =
  | 'PD' // public domain (expired copyright)
  | 'PDM' // Creative Commons Public Domain Mark
  | 'CC0'
  | 'ORIGINAL-CC0' // composed for this game, dedicated to the public domain
  | 'CC-BY-3.0' | 'CC-BY-4.0'
  | 'CC-BY-SA-3.0' | 'CC-BY-SA-4.0'
  | 'CC-BY-NC' | 'CC-BY-ND' | 'CC-BY-NC-SA' | 'CC-BY-NC-ND'
  | 'ARR' // all rights reserved
  | 'UNKNOWN';

export const PLAYABLE_LICENSES: ReadonlySet<LicenseId> = new Set<LicenseId>([
  'PD', 'PDM', 'CC0', 'ORIGINAL-CC0', 'CC-BY-3.0', 'CC-BY-4.0', 'CC-BY-SA-3.0', 'CC-BY-SA-4.0',
]);

export const LICENSE_NEEDS_ATTRIBUTION: ReadonlySet<LicenseId> = new Set<LicenseId>(['CC-BY-3.0', 'CC-BY-4.0', 'CC-BY-SA-3.0', 'CC-BY-SA-4.0']);

export const LICENSE_LABEL: Record<LicenseId, string> = {
  PD: 'Public domain',
  PDM: 'Public Domain Mark 1.0',
  CC0: 'CC0 1.0',
  'ORIGINAL-CC0': 'Original composition · CC0',
  'CC-BY-3.0': 'CC BY 3.0',
  'CC-BY-4.0': 'CC BY 4.0',
  'CC-BY-SA-3.0': 'CC BY-SA 3.0',
  'CC-BY-SA-4.0': 'CC BY-SA 4.0',
  'CC-BY-NC': 'CC BY-NC (not playable here)',
  'CC-BY-ND': 'CC BY-ND (not playable here)',
  'CC-BY-NC-SA': 'CC BY-NC-SA (not playable here)',
  'CC-BY-NC-ND': 'CC BY-NC-ND (not playable here)',
  ARR: 'All rights reserved',
  UNKNOWN: 'Unknown licence',
};

/** Rights record for a playable piece. Both the composition and the recording must be clear. */
export interface Rights {
  composition: LicenseId;
  /** How the recording is produced. `synth` = performed live by our Web Audio band from a score. */
  recording: LicenseId;
  /** Human-readable justification, e.g. "Composed 1810; Beethoven died 1827". */
  basis: string;
  attribution?: string;
  sourceUrl?: string;
  /** ISO date when a human verified the licence of an external file. Required for file audio. */
  verifiedAt?: string;
}

export interface LicensedAudioFile {
  url: string;
  /** Seconds. */
  duration: number;
}

export interface CoverSpec {
  /** Procedural pixel-art motif for original album covers. */
  motif: string;
  bg: string;
  fg: string;
  accent: string;
}

export interface Song {
  id: string;
  title: string;
  /** Composer, band or performer shown to players. */
  artist: string;
  /** Year written/published/released. */
  year?: number;
  album?: string;
  categories: CategoryId[];
  difficulty: 1 | 2 | 3;
  aliases?: string[];
  genre?: string;
  score?: SongScore;
  file?: LicensedAudioFile;
  rights: Rights;
  lyrics?: LyricLine[];
  /** Lyric gaps for Finish the Lyrics: index into `lyrics`, the missing words, decoys, and the beat where the missing words start. */
  gaps?: { line: number; answer: string; decoys: string[]; cut: number }[];
  /** Beat range of a recognisable section used for Guess the Song. Defaults to the start. */
  hook?: [number, number];
  /** Beat range of the ending for Guess the Outro. */
  outro?: [number, number];
  /** Film/TV associations for Movie Sound / TV Theme rounds: [title, year, kind]. */
  screen?: { title: string; year: number; kind: 'movie' | 'tv'; note: string }[];
  emoji?: string;
  cover?: CoverSpec;
  fact?: string;
}

/** Real-world release metadata (facts only, never audio or artwork). */
export interface Release {
  id: string;
  title: string;
  artist: string;
  year: number;
  kind: 'album' | 'single';
  categories: CategoryId[];
  difficulty: 1 | 2 | 3;
  /** Notable tracks for the album sleeve reveal (album only). */
  tracks?: string[];
  emoji?: string;
  fact?: string;
  /** Optional external identifiers for enrichment. */
  mbid?: string;
  spotifyUrl?: string;
}

export interface PopItem {
  id: string;
  title: string;
  year: number;
  kind: 'movie' | 'tv' | 'game' | 'anime';
  categories: CategoryId[];
  difficulty: 1 | 2 | 3;
  emoji?: string;
  fact?: string;
}

export interface TriviaQ {
  id: string;
  categories: CategoryId[];
  difficulty: 1 | 2 | 3;
  prompt: string;
  answer: string;
  decoys: string[];
  fact?: string;
  /** Minigame flavour to present this question with. */
  as?: 'trivia' | 'tv_theme' | 'movie_sound' | 'guess_artist';
}

export interface CharacterItem {
  id: string;
  name: string;
  from: string;
  categories: CategoryId[];
  difficulty: 1 | 2 | 3;
  /** Three clues, hardest first. */
  clues: [string, string, string];
  decoys: string[];
}

export interface QuoteItem {
  id: string;
  /** Quote with the missing part replaced by "___". */
  text: string;
  answer: string;
  decoys: string[];
  source: string;
  categories: CategoryId[];
  difficulty: 1 | 2 | 3;
}

export interface ContentPack {
  songs: Song[];
  releases: Release[];
  pop: PopItem[];
  trivia: TriviaQ[];
  characters: CharacterItem[];
  quotes: QuoteItem[];
}

export function isPlayable(song: Song): boolean {
  if (!PLAYABLE_LICENSES.has(song.rights.composition)) return false;
  if (!PLAYABLE_LICENSES.has(song.rights.recording)) return false;
  if (LICENSE_NEEDS_ATTRIBUTION.has(song.rights.recording) || LICENSE_NEEDS_ATTRIBUTION.has(song.rights.composition)) {
    if (!song.rights.attribution) return false;
  }
  if (song.score) return true;
  if (song.file) return Boolean(song.rights.verifiedAt && song.rights.sourceUrl && song.file.url);
  return false;
}

export function playbackNote(song: Song | undefined): { playable: boolean; label: string; detail: string } {
  if (!song) return { playable: false, label: 'Liner notes round', detail: 'This question uses facts only — no audio is needed.' };
  if (!isPlayable(song)) {
    return {
      playable: false,
      label: 'Liner notes round',
      detail: 'This recording isn\'t openly licensed, so the DJ reads the liner notes instead of playing it.',
    };
  }
  if (song.score) {
    const comp = song.rights.composition === 'ORIGINAL-CC0' ? 'Original LARPED house band composition (CC0)' : `Public-domain composition (${song.rights.basis})`;
    return { playable: true, label: 'Playing live', detail: `${comp}, performed live by the in-browser synth band.` };
  }
  return { playable: true, label: 'Licensed audio', detail: `${LICENSE_LABEL[song.rights.recording]} — ${song.rights.attribution ?? ''}` };
}
