// Question generation. A ContentDB indexes a content pack and builds questions for every minigame.
// Secret parts (correct answer, aliases, hint schedule) stay on the server; only `pub` is broadcast.

import { CATEGORY_BY_ID, MINIGAME_BY_ID, type CategoryId, type MinigameId } from '../catalog';
import { isPlayable, playbackNote, type CharacterItem, type ContentPack, type PopItem, type QuoteItem, type Release, type Song, type TriviaQ } from '../content';
import { beatsToSec, compileScore, extractClip, secToBeats, type CompiledScore } from '../music';
import type { Difficulty, PublicChoice, PublicQuestion } from '../protocol';
import { pick, sample, shuffle, type Rng } from '../rng';
import { normalizeAnswer } from '../text';

export type ScoringKind = 'choice' | 'stages' | 'year' | 'text' | 'clues';

export interface SecretQuestion {
  pub: Omit<PublicQuestion, 'id' | 'startAt' | 'deadline' | 'index' | 'total' | 'multiplier'>;
  scoring: ScoringKind;
  correctId: string;
  correctLabel: string;
  aliases?: string[];
  year?: number;
  fact?: string;
  /** All hints; revealed over time at hintAt (ms after question start). */
  hintsAll?: string[];
  hintAt?: number[];
  /** ms offsets when each audio stage starts (Guess the Song). */
  stageAt?: number[];
  /** Extra ms the question needs beyond the base timer (for long audio). */
  extraMs: number;
  songId?: string;
  artist?: string;
  itemIds: string[];
}

export interface GenContext {
  rng: Rng;
  difficulty: Difficulty;
  used: Set<string>;
  typed: boolean;
  timerMs: number;
}

const DECADE_RANGES: Partial<Record<CategoryId, [number, number]>> = {
  throwback: [1950, 1999],
  '2000s': [2000, 2009],
  '2010s': [2010, 2019],
  '2020s': [2020, 2029],
};

const LEAD_IN_MS = 900;
const STAGE_GAP_MS = 1100;
export const SONG_STAGES = [0.5, 1, 2, 4, 8];

function diffWeight(d: number, mode: Difficulty): number {
  switch (mode) {
    case 'easy': return d === 1 ? 4 : d === 2 ? 1.5 : 0.25;
    case 'normal': return d === 1 ? 2 : d === 2 ? 2 : 0.8;
    case 'hard': return d === 1 ? 0.4 : d === 2 ? 1.5 : 3;
    default: return 1;
  }
}

function weightedOrder<T extends { difficulty: number }>(rng: Rng, items: T[], mode: Difficulty): T[] {
  // Efraimidis–Spirakis weighted shuffle.
  return items
    .map((it) => ({ it, k: Math.pow(rng(), 1 / diffWeight(it.difficulty, mode)) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.it);
}

export function topicLabel(topic: string): string {
  if (topic.startsWith('cat:')) return CATEGORY_BY_ID[topic.slice(4)]?.name ?? topic.slice(4);
  if (topic.startsWith('artist:')) return `Spotlight: ${topic.slice(7)}`;
  return topic;
}

export class ContentDB {
  readonly songs: Song[];
  readonly playable: Song[];
  readonly releases: Release[];
  readonly pop: PopItem[];
  readonly trivia: TriviaQ[];
  readonly characters: CharacterItem[];
  readonly quotes: QuoteItem[];
  private compiled = new Map<string, CompiledScore>();

  constructor(pack: ContentPack) {
    this.songs = pack.songs;
    this.playable = pack.songs.filter(isPlayable);
    // Auto-tag decades on real-world metadata so decade categories just work.
    const tag = <T extends { year: number; categories: CategoryId[] }>(x: T): T => {
      const cats = new Set(x.categories);
      for (const [cat, [a, b]] of Object.entries(DECADE_RANGES)) if (x.year >= a && x.year <= b) cats.add(cat as CategoryId);
      return { ...x, categories: [...cats] };
    };
    this.releases = pack.releases.map(tag);
    this.pop = pack.pop.map(tag);
    this.trivia = pack.trivia;
    this.characters = pack.characters;
    this.quotes = pack.quotes;
  }

  getSong(id: string): Song | undefined {
    return this.songs.find((s) => s.id === id);
  }

  compile(song: Song): CompiledScore {
    let c = this.compiled.get(song.id);
    if (!c) {
      c = compileScore(song.score!);
      this.compiled.set(song.id, c);
    }
    return c;
  }

  // ───────────── topic matching ─────────────

  private matchCats(cats: CategoryId[], topic: string): boolean {
    if (topic === 'cat:mixed') return true;
    if (topic.startsWith('cat:')) return cats.includes(topic.slice(4) as CategoryId);
    return false;
  }

  private songsFor(topic: string, playableOnly: boolean): Song[] {
    const src = playableOnly ? this.playable : this.songs;
    if (topic.startsWith('artist:')) return src.filter((s) => s.artist === topic.slice(7));
    return src.filter((s) => this.matchCats(s.categories, topic));
  }

  private releasesFor(topic: string): Release[] {
    if (topic.startsWith('artist:')) return this.releases.filter((r) => r.artist === topic.slice(7));
    return this.releases.filter((r) => this.matchCats(r.categories, topic));
  }

  private popFor(topic: string): PopItem[] {
    if (topic.startsWith('artist:')) return [];
    return this.pop.filter((p) => this.matchCats(p.categories, topic));
  }

  private triviaFor(topic: string, as?: TriviaQ['as']): TriviaQ[] {
    if (topic.startsWith('artist:')) return [];
    return this.trivia.filter((t) => this.matchCats(t.categories, topic) && (as ? t.as === as : !t.as || t.as === 'trivia'));
  }

  private charactersFor(topic: string): CharacterItem[] {
    if (topic.startsWith('artist:')) return [];
    return this.characters.filter((c) => this.matchCats(c.categories, topic));
  }

  private quotesFor(topic: string): QuoteItem[] {
    if (topic.startsWith('artist:')) return [];
    return this.quotes.filter((q) => this.matchCats(q.categories, topic));
  }

  /** Candidate items for a minigame + topic, excluding used ones. */
  candidates(mg: MinigameId, topic: string, used: Set<string>): { id: string; difficulty: number }[] {
    const fresh = <T extends { id: string }>(xs: T[]) => xs.filter((x) => !used.has(x.id));
    switch (mg) {
      case 'guess_song':
      case 'reverse_song':
      case 'speed_song':
      case 'guess_intro':
        return fresh(this.songsFor(topic, true).filter((s) => s.difficulty <= 3 && !s.categories.includes('house_band')));
      case 'guess_outro':
        return fresh(this.songsFor(topic, true).filter((s) => s.outro && !s.categories.includes('house_band')));
      case 'finish_lyrics':
        return fresh(this.songsFor(topic, true).filter((s) => s.gaps?.length && s.lyrics?.length));
      case 'guess_genre':
        return fresh(this.songsFor(topic, true).filter((s) => s.genre && s.categories.includes('house_band')));
      case 'guess_artist': {
        const audio = this.songsFor(topic, true).filter((s) => !s.categories.includes('house_band') && this.artistPool(s).length >= 3);
        return [...fresh(audio), ...fresh(this.releasesFor(topic)), ...fresh(this.triviaFor(topic, 'guess_artist'))];
      }
      case 'guess_album':
        return fresh(this.releasesFor(topic).filter((r) => r.kind === 'album' && (r.tracks?.length ?? 0) >= 3));
      case 'album_cover':
        return fresh(this.songsFor(topic, false).filter((s) => s.cover && s.album)).filter((s, i, arr) => arr.findIndex((x) => x.album === s.album) === i);
      case 'emoji_song':
        return [...fresh(this.songsFor(topic, false).filter((s) => s.emoji)), ...fresh(this.releasesFor(topic).filter((r) => r.emoji)), ...fresh(this.popFor(topic).filter((p) => p.emoji))];
      case 'release_year':
        return [...fresh(this.releasesFor(topic)), ...fresh(this.popFor(topic))];
      case 'which_first':
      case 'higher_lower': {
        const pool = [...this.releasesFor(topic), ...this.popFor(topic)];
        return pool.length >= 2 ? fresh(pool) : [];
      }
      case 'finish_quote':
        return fresh(this.quotesFor(topic));
      case 'tv_theme':
        return [...fresh(this.songsFor(topic, true).filter((s) => s.screen?.some((x) => x.kind === 'tv'))), ...fresh(this.triviaFor(topic, 'tv_theme'))];
      case 'movie_sound':
        return [...fresh(this.songsFor(topic, true).filter((s) => s.screen?.some((x) => x.kind === 'movie'))), ...fresh(this.triviaFor(topic, 'movie_sound'))];
      case 'guess_character':
        return fresh(this.charactersFor(topic));
      case 'trivia':
        return fresh(this.triviaFor(topic));
    }
  }

  count(mg: MinigameId, topic: string, used: Set<string>): number {
    return this.candidates(mg, topic, used).length;
  }

  /** Artist spotlights: artists with enough material for a round. */
  spotlightArtists(minPerArtist: number, allowed: MinigameId[], used: Set<string>): string[] {
    const counts = new Map<string, number>();
    const audioOk = allowed.some((m) => MINIGAME_BY_ID[m].audio === 'required' && m !== 'guess_genre' && m !== 'finish_lyrics');
    if (audioOk) for (const s of this.playable) if (!used.has(s.id) && !s.categories.includes('house_band')) counts.set(s.artist, (counts.get(s.artist) ?? 0) + 1);
    if (allowed.includes('guess_album') || allowed.includes('release_year') || allowed.includes('which_first')) {
      for (const r of this.releases) if (!used.has(r.id)) counts.set(r.artist, (counts.get(r.artist) ?? 0) + 1);
    }
    return [...counts.entries()].filter(([, n]) => n >= minPerArtist).map(([a]) => a);
  }

  private artistPool(song: Song): string[] {
    const set = new Set(this.playable.filter((s) => !s.categories.includes('house_band')).map((s) => s.artist));
    set.delete(song.artist);
    return [...set];
  }

  // ───────────── generation ─────────────

  generate(mg: MinigameId, topic: string, ctx: GenContext): SecretQuestion | null {
    const cands = this.candidates(mg, topic, ctx.used);
    if (!cands.length) return null;
    const ordered = weightedOrder(ctx.rng, cands, ctx.difficulty);
    for (const item of ordered.slice(0, 6)) {
      const q = this.build(mg, item, topic, ctx);
      if (q) {
        for (const id of q.itemIds) ctx.used.add(id);
        return q;
      }
    }
    return null;
  }

  private build(mg: MinigameId, item: { id: string }, topic: string, ctx: GenContext): SecretQuestion | null {
    const def = MINIGAME_BY_ID[mg];
    const base = { minigame: mg, board: def.board } as const;
    const song = this.songs.find((s) => s.id === item.id);
    const release = this.releases.find((r) => r.id === item.id);
    const popItem = this.pop.find((p) => p.id === item.id);
    const triv = this.trivia.find((t) => t.id === item.id);

    switch (mg) {
      case 'guess_song':
      case 'reverse_song':
      case 'speed_song':
      case 'guess_intro':
      case 'guess_outro':
        return song ? this.buildAudioTitle(mg, song, topic, ctx) : null;
      case 'finish_lyrics':
        return song ? this.buildLyrics(song, ctx) : null;
      case 'guess_genre':
        return song ? this.buildGenre(song, ctx) : null;
      case 'guess_artist':
        if (song) return this.buildArtistAudio(song, ctx);
        if (release) return this.buildArtistRelease(release, topic, ctx);
        if (triv) return this.buildTrivia(triv, mg, ctx);
        return null;
      case 'guess_album':
        return release ? this.buildAlbum(release, topic, ctx) : null;
      case 'album_cover':
        return song ? this.buildCover(song, ctx) : null;
      case 'emoji_song': {
        const it = song ?? release ?? popItem;
        if (!it || !it.emoji) return null;
        const pool = this.titlePool(it, topic);
        const choices = this.makeChoices(ctx.rng, it.title, pool, 4);
        const what = popItem ? (popItem.kind === 'movie' ? 'movie' : popItem.kind === 'tv' ? 'TV show' : popItem.kind === 'game' ? 'video game' : 'anime') : 'song';
        return {
          pub: { ...base, prompt: `Which ${what} do these emojis spell?`, emoji: it.emoji, input: 'choice', choices: choices.list, availability: playbackNote(undefined) },
          scoring: 'choice', correctId: choices.correctId, correctLabel: it.title, fact: this.factFor(it), extraMs: 0, itemIds: [it.id],
          ...(song ? { songId: song.id } : {}),
        };
      }
      case 'release_year': {
        const it = release ?? popItem;
        if (!it) return null;
        const lo = Math.max(1950, it.year - 20 - Math.floor(ctx.rng() * 8));
        const hi = Math.min(2026, Math.max(it.year + 6, lo + 30));
        const desc = release ? `${release.artist}'s ${release.kind === 'album' ? 'album' : 'song'} “${release.title}”` : `the ${popItem!.kind === 'tv' ? 'TV show' : popItem!.kind === 'game' ? 'video game' : popItem!.kind} “${popItem!.title}”`;
        return {
          pub: { ...base, prompt: `What year did ${desc} come out?`, input: 'year', yearRange: [lo, hi], availability: playbackNote(undefined) },
          scoring: 'year', correctId: String(it.year), correctLabel: String(it.year), year: it.year, fact: it.fact, extraMs: 2000, itemIds: [it.id],
        };
      }
      case 'which_first': {
        const a = release ?? popItem;
        if (!a) return null;
        const pool = [...this.releasesFor(topic), ...this.popFor(topic)].filter((x) => x.id !== a.id && Math.abs(x.year - a.year) >= 2 && !ctx.used.has(x.id));
        if (!pool.length) return null;
        const b = pick(ctx.rng, pool);
        const pair = shuffle(ctx.rng, [a, b]);
        const first = a.year < b.year ? a : b;
        const label = (x: Release | PopItem) => ('artist' in x ? x.title : x.title);
        const sub = (x: Release | PopItem) => ('artist' in x ? x.artist : x.kind === 'tv' ? 'TV show' : x.kind === 'game' ? 'Video game' : x.kind === 'anime' ? 'Anime' : 'Movie');
        return {
          pub: { ...base, prompt: 'Which came out first?', input: 'choice', choices: pair.map((x) => ({ id: x.id, label: label(x), sub: sub(x) })), availability: playbackNote(undefined) },
          scoring: 'choice', correctId: first.id, correctLabel: `${label(first)} (${first.year})`,
          fact: `${label(a)}: ${a.year} · ${label(b)}: ${b.year}`, extraMs: 0, itemIds: [a.id, b.id],
        };
      }
      case 'higher_lower': {
        const target = release ?? popItem;
        if (!target) return null;
        const pool = [...this.releasesFor(topic), ...this.popFor(topic), ...this.releases.filter((r) => r.categories.some((c) => target.categories.includes(c)))]
          .filter((x) => x.id !== target.id && x.year !== target.year && Math.abs(x.year - target.year) <= 25);
        if (!pool.length) return null;
        const ref = pick(ctx.rng, pool);
        const after = target.year > ref.year;
        const refDesc = 'artist' in ref ? `${ref.title} — ${ref.artist}` : ref.title;
        const tDesc = 'artist' in target ? `“${target.title}” by ${target.artist}` : `“${target.title}”`;
        return {
          pub: {
            ...base, prompt: `Was ${tDesc} released BEFORE or AFTER ${ref.year}?`, sub: `Reference: ${refDesc} (${ref.year})`, input: 'choice',
            choices: [{ id: 'lower', label: 'BEFORE', sub: `earlier than ${ref.year}` }, { id: 'higher', label: 'AFTER', sub: `later than ${ref.year}` }],
            availability: playbackNote(undefined),
          },
          scoring: 'choice', correctId: after ? 'higher' : 'lower', correctLabel: `${after ? 'AFTER' : 'BEFORE'} — ${target.year}`, fact: target.fact, extraMs: 0, itemIds: [target.id],
        };
      }
      case 'finish_quote': {
        const q = this.quotes.find((x) => x.id === item.id);
        if (!q) return null;
        const typed = ctx.typed && ctx.difficulty === 'hard';
        const choices = this.makeChoices(ctx.rng, q.answer, q.decoys, 4);
        return {
          pub: { ...base, prompt: q.text, sub: `— ${q.source}`, input: typed ? 'text' : 'choice', choices: typed ? undefined : choices.list, availability: playbackNote(undefined) },
          scoring: typed ? 'text' : 'choice', correctId: choices.correctId, correctLabel: q.answer, extraMs: typed ? 4000 : 0, itemIds: [q.id],
        };
      }
      case 'tv_theme':
      case 'movie_sound':
        if (song) return this.buildScreen(mg, song, ctx);
        if (triv) return this.buildTrivia(triv, mg, ctx);
        return null;
      case 'guess_character': {
        const c = this.characters.find((x) => x.id === item.id);
        if (!c) return null;
        const choices = this.makeChoices(ctx.rng, c.name, c.decoys, 4);
        const step = Math.max(2500, Math.floor(ctx.timerMs / 3.2));
        return {
          pub: { ...base, prompt: 'Who am I?', sub: 'Clues get easier — answer early for more points', input: 'choice', choices: choices.list, hints: [c.clues[0]], hintTitle: 'CLUES', availability: playbackNote(undefined) },
          scoring: 'clues', correctId: choices.correctId, correctLabel: `${c.name} (${c.from})`, hintsAll: [...c.clues, `From: ${c.from}`], hintAt: [0, step, step * 2, step * 3], extraMs: step, itemIds: [c.id],
        };
      }
      case 'trivia':
        return triv ? this.buildTrivia(triv, mg, ctx) : null;
    }
  }

  private makeChoices(rng: Rng, answer: string, decoyPool: string[], n: number): { list: PublicChoice[]; correctId: string } {
    const seen = new Set([normalizeAnswer(answer)]);
    const decoys: string[] = [];
    for (const d of shuffle(rng, decoyPool)) {
      const k = normalizeAnswer(d);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      decoys.push(d);
      if (decoys.length >= n - 1) break;
    }
    const labels = shuffle(rng, [answer, ...decoys]);
    const list = labels.map((label, i) => ({ id: `c${i}`, label }));
    return { list, correctId: list[labels.indexOf(answer)].id };
  }

  private titlePool(it: { id: string; categories: CategoryId[] }, topic: string): string[] {
    const sameCat = (cats: CategoryId[]) => cats.some((c) => it.categories.includes(c));
    const songs = this.songs.filter((s) => s.id !== it.id && sameCat(s.categories)).map((s) => s.title);
    const rel = this.releases.filter((r) => r.id !== it.id && sameCat(r.categories)).map((r) => r.title);
    const pop = this.pop.filter((p) => p.id !== it.id && sameCat(p.categories)).map((p) => p.title);
    const near = [...songs, ...rel, ...pop];
    if (near.length >= 6) return near;
    void topic;
    return [...near, ...this.songs.map((s) => s.title), ...this.releases.map((r) => r.title)].filter((t) => t !== (it as { title?: string }).title);
  }

  private factFor(it: Song | Release | PopItem): string | undefined {
    if ('artist' in it) return it.fact ?? (it.year ? `${it.title} — ${it.artist} (${it.year})` : undefined);
    return it.fact ?? `${it.title} (${it.year})`;
  }

  private songChoicePool(song: Song): string[] {
    const same = this.playable.filter((s) => s.id !== song.id && !s.categories.includes('house_band') && s.categories.some((c) => song.categories.includes(c))).map((s) => s.title);
    const any = this.playable.filter((s) => s.id !== song.id && !s.categories.includes('house_band')).map((s) => s.title);
    return same.length >= 5 ? same : [...same, ...any];
  }

  /** Audio for an externally hosted, openly licensed file (proxied by the server). */
  private fileAudio(song: Song, offset: number, len: number, opts: { rate?: number; reverse?: boolean } = {}) {
    const dur = song.file!.duration;
    const o = Math.max(0, Math.min(offset, Math.max(0, dur - len)));
    return { src: song.file!.url, offset: +o.toFixed(2), len: +Math.min(len, dur).toFixed(2), ...opts };
  }

  private buildFileTitle(mg: MinigameId, song: Song, ctx: GenContext): SecretQuestion | null {
    const def = MINIGAME_BY_ID[mg];
    const choices = this.makeChoices(ctx.rng, song.title, this.songChoicePool(song), 4);
    const common = { minigame: mg, board: def.board, input: 'choice' as const, choices: choices.list, availability: playbackNote(song) };
    const secret = { correctId: choices.correctId, correctLabel: `${song.title} — ${song.artist}`, aliases: song.aliases, fact: song.rights.attribution, songId: song.id, artist: song.artist, itemIds: [song.id] };
    const hook = song.hook?.[0] ?? 0;
    const dur = song.file!.duration;
    if (mg === 'guess_song') {
      const stageAt: number[] = [];
      let t = LEAD_IN_MS;
      for (const st of SONG_STAGES) { stageAt.push(t); t += st * 1000 + STAGE_GAP_MS; }
      return { pub: { ...common, prompt: 'Name that tune!', sub: 'The clip gets longer — answer early for more points', audio: { file: this.fileAudio(song, hook, 8), stages: SONG_STAGES, stageGap: STAGE_GAP_MS / 1000 } }, scoring: 'stages', stageAt, extraMs: Math.max(0, t + 2500 - ctx.timerMs), ...secret };
    }
    if (mg === 'reverse_song') return { pub: { ...common, prompt: 'What song is this... backwards?', sub: 'Played in reverse', audio: { file: this.fileAudio(song, hook, 7, { reverse: true }), loop: true } }, scoring: 'choice', extraMs: 1500, ...secret };
    if (mg === 'speed_song') return { pub: { ...common, prompt: 'What song is this? (Sped up!)', sub: 'Playing at 2× speed', audio: { file: this.fileAudio(song, hook, 14, { rate: 2 }), loop: true } }, scoring: 'choice', extraMs: 1000, ...secret };
    if (mg === 'guess_intro') return { pub: { ...common, prompt: 'Name the song from its intro!', sub: 'Just the first few seconds — it plays twice', audio: { file: this.fileAudio(song, 0, 3.5), stages: [3.5, 3.5], stageGap: 1.5 } }, scoring: 'choice', extraMs: 1000, ...secret };
    return { pub: { ...common, prompt: 'Name the song from its ending!', sub: 'The final notes — it plays twice', audio: { file: this.fileAudio(song, dur - 5, 5), stages: [5, 5], stageGap: 1.5 } }, scoring: 'choice', extraMs: 1500, ...secret };
  }

  private buildAudioTitle(mg: MinigameId, song: Song, topic: string, ctx: GenContext): SecretQuestion | null {
    if (song.file && !song.score) return this.buildFileTitle(mg, song, ctx);
    const comp = this.compile(song);
    const bpm = comp.bpm;
    const def = MINIGAME_BY_ID[mg];
    const choices = this.makeChoices(ctx.rng, song.title, this.songChoicePool(song), 4);
    const typed = ctx.typed && ctx.difficulty === 'hard' && mg !== 'guess_song';
    const common = {
      minigame: mg, board: def.board, input: (typed ? 'text' : 'choice') as 'text' | 'choice',
      choices: typed ? undefined : choices.list, availability: playbackNote(song),
    };
    const secret = { correctId: choices.correctId, correctLabel: `${song.title} — ${song.artist}`, aliases: song.aliases, fact: song.fact, songId: song.id, artist: song.artist, itemIds: [song.id] };
    const hookStart = song.hook?.[0] ?? 0;
    void topic;
    if (mg === 'guess_song') {
      const len = secToBeats(8, bpm);
      const clip = extractClip(comp, hookStart, Math.min(comp.lengthBeats, hookStart + len));
      const stageAt: number[] = [];
      let t = LEAD_IN_MS;
      for (const s of SONG_STAGES) { stageAt.push(t); t += s * 1000 + STAGE_GAP_MS; }
      return {
        pub: { ...common, prompt: 'Name that tune!', sub: 'The clip gets longer — answer early for more points', audio: { clip, stages: SONG_STAGES, stageGap: STAGE_GAP_MS / 1000 } },
        scoring: 'stages', stageAt, extraMs: Math.max(0, t + 2500 - ctx.timerMs), ...secret,
      };
    }
    if (mg === 'reverse_song') {
      const len = secToBeats(7, bpm);
      const clip = extractClip(comp, hookStart, Math.min(comp.lengthBeats, hookStart + len), { reverse: true });
      return { pub: { ...common, prompt: 'What song is this... backwards?', sub: 'Played in reverse — loops until time runs out', audio: { clip, loop: true } }, scoring: 'choice', extraMs: 1500, ...secret };
    }
    if (mg === 'speed_song') {
      const rate = ctx.difficulty === 'hard' ? 2.6 : ctx.difficulty === 'easy' ? 1.7 : 2.1;
      const len = secToBeats(8 * rate, bpm);
      const clip = extractClip(comp, hookStart, Math.min(comp.lengthBeats, hookStart + len), { rate });
      return { pub: { ...common, prompt: 'What song is this? (Sped up!)', sub: `Playing at ${rate}× speed`, audio: { clip, loop: true } }, scoring: 'choice', extraMs: 1000, ...secret };
    }
    if (mg === 'guess_intro') {
      const len = secToBeats(ctx.difficulty === 'hard' ? 2 : 3.5, bpm);
      const clip = extractClip(comp, 0, Math.min(comp.lengthBeats, len));
      return { pub: { ...common, prompt: 'Name the song from its intro!', sub: 'Just the first few seconds — it plays twice', audio: { clip, stages: [beatsToSec(clip.len, bpm), beatsToSec(clip.len, bpm)], stageGap: 1.5 } }, scoring: 'choice', extraMs: 1000, ...secret };
    }
    // outro
    const [os, oe] = song.outro ?? [Math.max(0, comp.lengthBeats - secToBeats(5, bpm)), comp.lengthBeats];
    const clip = extractClip(comp, os, oe);
    return { pub: { ...common, prompt: 'Name the song from its ending!', sub: 'The final notes — it plays twice', audio: { clip, stages: [beatsToSec(clip.len, bpm), beatsToSec(clip.len, bpm)], stageGap: 1.5 } }, scoring: 'choice', extraMs: 1500, ...secret };
  }

  private buildLyrics(song: Song, ctx: GenContext): SecretQuestion | null {
    if (!song.gaps?.length || !song.lyrics?.length) return null;
    const gap = pick(ctx.rng, song.gaps);
    const comp = this.compile(song);
    const line = song.lyrics[gap.line];
    if (!line) return null;
    const prevIdx = Math.max(0, gap.line - 2);
    const startBeat = song.lyrics[prevIdx].beat;
    // Play up to just before the missing words, then blank them out of the line.
    const at = line.text.toLowerCase().indexOf(gap.answer.toLowerCase());
    const underscores = '_'.repeat(Math.max(4, Math.min(14, gap.answer.length)));
    const clip = extractClip(comp, startBeat, Math.max(startBeat + 1, gap.cut - 0.05));
    const lines = song.lyrics.slice(prevIdx, gap.line).map((l) => l.text);
    const lineBeats = song.lyrics.slice(prevIdx, gap.line + 1).map((l) => +(l.beat - startBeat).toFixed(3));
    const blank = at >= 0 ? `${line.text.slice(0, at)}${underscores}${line.text.slice(at + gap.answer.length)}` : `${line.text} ${underscores}`;
    const typed = ctx.typed && ctx.difficulty === 'hard';
    const choices = this.makeChoices(ctx.rng, gap.answer, gap.decoys, 4);
    const clipSec = beatsToSec(clip.len, comp.bpm);
    return {
      pub: {
        minigame: 'finish_lyrics', board: 'lilypads', prompt: `Finish the lyric!`, sub: `“${song.title}” — ${song.artist}`,
        input: typed ? 'text' : 'choice', choices: typed ? undefined : choices.list, lyrics: [...lines, blank], blank,
        audio: { clip, stages: [clipSec], stageGap: 0 }, availability: playbackNote(song),
        lyricBeats: lineBeats,
      },
      scoring: typed ? 'text' : 'choice', correctId: choices.correctId, correctLabel: gap.answer, aliases: [],
      fact: `“${line.text}”`, extraMs: Math.round(clipSec * 1000) + (typed ? 4000 : 1000), songId: song.id, artist: song.artist, itemIds: [song.id + ':' + gap.line],
    };
  }

  private buildGenre(song: Song, ctx: GenContext): SecretQuestion | null {
    if (!song.genre) return null;
    const comp = this.compile(song);
    const start = song.hook?.[0] ?? 0;
    const clip = extractClip(comp, start, Math.min(comp.lengthBeats, start + secToBeats(9, comp.bpm)));
    const genres = [...new Set(this.playable.filter((s) => s.genre).map((s) => s.genre!))];
    const choices = this.makeChoices(ctx.rng, song.genre, genres.filter((g) => g !== song.genre), 4);
    return {
      pub: { minigame: 'guess_genre', board: 'mushrooms', prompt: 'Name that genre!', sub: 'The house band is playing...', input: 'choice', choices: choices.list, audio: { clip, loop: true }, availability: playbackNote(song) },
      scoring: 'choice', correctId: choices.correctId, correctLabel: song.genre, fact: `“${song.title}” by ${song.artist}`, extraMs: 1000, songId: song.id, artist: song.artist, itemIds: [song.id],
    };
  }

  private buildArtistAudio(song: Song, ctx: GenContext): SecretQuestion | null {
    const choices = this.makeChoices(ctx.rng, song.artist, this.artistPool(song), 4);
    let audio: PublicQuestion['audio'];
    if (song.score) {
      const comp = this.compile(song);
      const start = song.hook?.[0] ?? 0;
      audio = { clip: extractClip(comp, start, Math.min(comp.lengthBeats, start + secToBeats(9, comp.bpm))), loop: true };
    } else if (song.file) {
      audio = { file: this.fileAudio(song, song.hook?.[0] ?? 0, 9), loop: true };
    } else return null;
    return {
      pub: { minigame: 'guess_artist', board: 'sleeves', prompt: song.score ? 'Who composed this?' : 'Who made this recording?', sub: 'Listen closely...', input: 'choice', choices: choices.list, audio, availability: playbackNote(song) },
      scoring: 'choice', correctId: choices.correctId, correctLabel: song.artist, fact: `${song.title} — ${song.artist}${song.year ? ` (${song.year})` : ''}`, extraMs: 1000, songId: song.id, artist: song.artist, itemIds: [song.id],
    };
  }

  private buildArtistRelease(r: Release, topic: string, ctx: GenContext): SecretQuestion | null {
    const pool = [...new Set(this.releases.filter((x) => x.artist !== r.artist && x.categories.some((c) => r.categories.includes(c))).map((x) => x.artist))];
    const all = [...new Set(this.releases.filter((x) => x.artist !== r.artist).map((x) => x.artist))];
    const choices = this.makeChoices(ctx.rng, r.artist, pool.length >= 3 ? pool : all, 4);
    void topic;
    return {
      pub: { minigame: 'guess_artist', board: 'sleeves', prompt: `Who released the ${r.kind} “${r.title}”?`, sub: `Released in ${r.year}`, input: 'choice', choices: choices.list, availability: playbackNote(undefined) },
      scoring: 'choice', correctId: choices.correctId, correctLabel: r.artist, fact: r.fact, extraMs: 0, artist: r.artist, itemIds: [r.id],
    };
  }

  private buildAlbum(r: Release, topic: string, ctx: GenContext): SecretQuestion | null {
    const tracks = sample(ctx.rng, r.tracks ?? [], 3);
    const albums = this.releases.filter((x) => x.kind === 'album' && x.id !== r.id);
    const same = albums.filter((x) => x.categories.some((c) => r.categories.includes(c)) || x.artist === r.artist).map((x) => x.title);
    const choices = this.makeChoices(ctx.rng, r.title, same.length >= 3 ? same : albums.map((x) => x.title), 4);
    const step = Math.max(2200, Math.floor(ctx.timerMs / 4));
    void topic;
    return {
      pub: { minigame: 'guess_album', board: 'sleeves', prompt: 'Which album has these tracks?', sub: 'The sleeve slides out one track at a time', input: 'choice', choices: choices.list, hints: [tracks[0]], hintTitle: 'TRACKLIST', availability: playbackNote(undefined) },
      scoring: 'clues', correctId: choices.correctId, correctLabel: `${r.title} — ${r.artist} (${r.year})`, fact: r.fact,
      hintsAll: [...tracks, `Artist: ${r.artist}`], hintAt: [0, step, step * 2, step * 3], extraMs: step, artist: r.artist, itemIds: [r.id],
    };
  }

  private buildCover(song: Song, ctx: GenContext): SecretQuestion | null {
    if (!song.cover || !song.album) return null;
    const albums = [...new Set(this.songs.filter((s) => s.cover && s.album && s.album !== song.album).map((s) => s.album!))];
    const choices = this.makeChoices(ctx.rng, song.album, albums, 4);
    return {
      pub: { minigame: 'album_cover', board: 'sleeves', prompt: 'Which record is hiding in the pixels?', sub: `House band records — match the art to the title`, input: 'choice', choices: choices.list, cover: song.cover, pixelate: true, availability: playbackNote(undefined) },
      scoring: 'choice', correctId: choices.correctId, correctLabel: `${song.album} — ${song.artist}`, fact: song.fact, extraMs: 0, songId: song.id, artist: song.artist, itemIds: [song.id],
    };
  }

  private buildScreen(mg: MinigameId, song: Song, ctx: GenContext): SecretQuestion | null {
    const kind = mg === 'tv_theme' ? 'tv' : 'movie';
    const scr = song.screen?.filter((s) => s.kind === kind) ?? [];
    if (!scr.length) return null;
    const target = pick(ctx.rng, scr);
    const comp = this.compile(song);
    const start = song.hook?.[0] ?? 0;
    const clip = extractClip(comp, start, Math.min(comp.lengthBeats, start + secToBeats(9, comp.bpm)));
    const pool = this.pop.filter((p) => p.kind === kind && p.title !== target.title).map((p) => p.title);
    const otherScreens = this.songs.flatMap((s) => s.screen ?? []).filter((s) => s.kind === kind && s.title !== target.title).map((s) => s.title);
    const choices = this.makeChoices(ctx.rng, target.title, [...otherScreens, ...otherScreens, ...pool], 4);
    return {
      pub: {
        minigame: mg, board: 'tv', input: 'choice', choices: choices.list, audio: { clip, loop: true }, availability: playbackNote(song),
        prompt: kind === 'tv' ? 'Which TV show used this music as its theme?' : 'Which movie made this music famous?',
        sub: `Hint: ${target.year}`,
      },
      scoring: 'choice', correctId: choices.correctId, correctLabel: `${target.title} (${target.year})`, fact: `${target.note} The music: ${song.title} by ${song.artist}.`, extraMs: 1000, songId: song.id, artist: song.artist, itemIds: [song.id + ':' + kind],
    };
  }

  private buildTrivia(t: TriviaQ, mg: MinigameId, ctx: GenContext): SecretQuestion | null {
    const choices = this.makeChoices(ctx.rng, t.answer, t.decoys, 4);
    const def = MINIGAME_BY_ID[mg];
    return {
      pub: { minigame: mg, board: def.board === 'chalk' ? 'cards' : def.board, prompt: t.prompt, input: 'choice', choices: choices.list, availability: playbackNote(undefined) },
      scoring: 'choice', correctId: choices.correctId, correctLabel: t.answer, fact: t.fact, extraMs: 0, itemIds: [t.id],
    };
  }
}
