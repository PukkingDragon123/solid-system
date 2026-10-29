// The built-in content pack. Server-only: it contains answers, so it must never be bundled into the client.

import type { ContentPack } from '../shared/content';
import { HOUSE_BAND_SONGS } from './songs/houseBand';
import { PUBLIC_DOMAIN_SONGS } from './songs/publicDomain';
import { CHARACTERS } from './trivia/characters';
import { POP } from './trivia/pop';
import { QUOTES } from './trivia/quotes';
import { RELEASES } from './trivia/releases';
import { TRIVIA } from './trivia/trivia';

export const BASE_PACK: ContentPack = {
  songs: [...PUBLIC_DOMAIN_SONGS, ...HOUSE_BAND_SONGS],
  releases: RELEASES,
  pop: POP,
  trivia: TRIVIA,
  characters: CHARACTERS,
  quotes: QUOTES,
};
