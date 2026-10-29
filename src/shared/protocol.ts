// Wire protocol between browser clients and the authoritative game server (JSON over WebSocket).

import type { BoardStyle, CategoryId, MapId, MinigameId, RandomEventId, SocialId } from './catalog';
import type { Outfit } from './cosmetics';
import type { ClipPayload } from './music';
import type { CoverSpec } from './content';

export const PROTOCOL_VERSION = 3;
export const MAX_PLAYERS = 12;
export const MIN_PLAYERS = 2;

export type Difficulty = 'easy' | 'normal' | 'hard' | 'mixed';

export interface RoomSettings {
  rounds: number; // 3..12
  questionsPerRound: number; // 1..5
  timer: number; // seconds per question, 10..30
  difficulty: Difficulty;
  categories: CategoryId[];
  minigames: MinigameId[];
  socialRounds: boolean;
  randomEvents: boolean;
  typedAnswers: boolean;
  comeback: boolean;
  finalDouble: boolean;
  map: MapId | 'vote';
  isPublic: boolean;
  maxPlayers: number;
}

export interface PlayerPublic {
  id: string;
  name: string;
  color: number;
  outfit: Outfit;
  seat: number;
  isHost: boolean;
  isBot: boolean;
  connected: boolean;
  ready: boolean;
  score: number;
  streak: number;
  rank: number;
  level: number;
  title: string;
  /** 0..1 — how nervous the frog looks (lowest score late in the game). */
  nervous: number;
  /** Answered the current question (no content revealed). */
  locked: boolean;
}

export interface VoteOption {
  id: string;
  label: string;
  sub?: string;
  color?: string;
  art?: string;
}

export interface PublicChoice {
  id: string;
  label: string;
  sub?: string;
  cover?: CoverSpec;
}

export interface PublicQuestion {
  id: string;
  minigame: MinigameId;
  board: BoardStyle;
  index: number;
  total: number;
  prompt: string;
  sub?: string;
  input: 'choice' | 'text' | 'year';
  choices?: PublicChoice[];
  yearRange?: [number, number];
  /** Progressive hints revealed by the server over time (tracklist, clues). */
  hints?: string[];
  hintTitle?: string;
  emoji?: string;
  lyrics?: string[];
  /** Beat offset (from clip start) at which each lyric line begins. */
  lyricBeats?: number[];
  blank?: string;
  cover?: CoverSpec;
  /** Pixelation reveal: start/end ms relative to question start. */
  pixelate?: boolean;
  audio?: {
    /** Synth score snippet performed live by the client. */
    clip?: ClipPayload;
    /** Openly licensed audio file served through the same-origin proxy. */
    file?: { src: string; offset: number; len: number; rate?: number; reverse?: boolean };
    /** Progressive clip lengths in seconds (Guess the Song). */
    stages?: number[];
    /** Seconds between stage starts. */
    stageGap?: number;
    loop?: boolean;
  };
  availability: { playable: boolean; label: string; detail: string };
  multiplier: number;
  /** Server timestamps (ms). */
  startAt: number;
  deadline: number;
}

export interface AnswerResult {
  playerId: string;
  correct: boolean;
  points: number;
  base: number;
  speedBonus: number;
  streakBonus: number;
  underdogBonus: number;
  social: number;
  ms: number | null;
  answerLabel: string | null;
  streak: number;
  note?: string;
}

export interface Standing {
  id: string;
  score: number;
  prevRank: number;
  rank: number;
  delta: number;
}

export interface RewardSummary {
  playerId: string;
  coins: number;
  xp: number;
  levelBefore: number;
  levelAfter: number;
  achievements: string[];
  unlocked: string[];
  records: string[];
}

export type Phase =
  | { id: 'lobby' }
  | { id: 'intro'; line: string }
  | { id: 'map_vote'; options: VoteOption[]; votes: Record<string, string> }
  | { id: 'map_reveal'; options: VoteOption[]; votes: Record<string, string>; winner: string; spins: number }
  | { id: 'round_intro'; round: number; total: number; final: boolean; social: SocialId | null }
  | { id: 'category_vote'; round: number; options: VoteOption[]; votes: Record<string, string> }
  | { id: 'category_reveal'; round: number; options: VoteOption[]; votes: Record<string, string>; winner: string; tie: boolean }
  | { id: 'minigame_intro'; round: number; minigame: MinigameId; topic: string; social: SocialId | null; audio: boolean; note: string }
  | { id: 'social_setup'; social: SocialId; chooser: string | null; targets: string[]; picks: Record<string, string>; doneIds: string[] }
  | { id: 'question'; q: PublicQuestion; sabotaged: string[] }
  | { id: 'question_reveal'; q: PublicQuestion; correct: string; correctLabel: string; results: AnswerResult[]; fact?: string; socialLines: string[]; picks: Record<string, string> }
  | { id: 'scoreboard'; round: number; total: number; standings: Standing[] }
  | { id: 'final_intro' }
  | { id: 'finale'; ranking: string[]; loser: string; winner: string; tie: boolean }
  | { id: 'rewards'; ranking: string[]; rewards: RewardSummary[] }
  | { id: 'rematch_vote'; options: VoteOption[]; votes: Record<string, string> };

export type PhaseId = Phase['id'];

export interface RoomSnapshot {
  code: string;
  hostId: string;
  settings: RoomSettings;
  players: PlayerPublic[];
  map: MapId;
  phase: Phase;
  phaseStart: number;
  phaseEnd: number;
  round: number;
  totalRounds: number;
  /** Per-recipient private bits. */
  you: {
    id: string;
    answer?: string | number | null;
    wager?: number;
    socialPick?: string;
    sabotagedBy?: boolean;
  };
  serverTime: number;
}

export interface ProfilePublicCard {
  name: string;
  level: number;
  title: string;
  outfit: Outfit;
  banner: string;
}

export interface ProfileStats {
  games: number;
  wins: number;
  toads: number;
  podiums: number;
  answered: number;
  correct: number;
  bestStreak: number;
  lyricsCorrect: number;
  categories: Record<string, number>;
  mapsPlayed: string[];
  fastestMs: number | null;
}

export interface ProfilePrivate {
  id: string;
  name: string;
  coins: number;
  xp: number;
  level: number;
  outfit: Outfit;
  owned: string[];
  title: string;
  banner: string;
  stats: ProfileStats;
  achievements: Record<string, number>; // id -> unlocked timestamp
  records: string[]; // discovered song ids
  artists: string[];
  trophies: { id: string; kind: 'win' | 'podium' | 'toad'; at: number; map: string; players: number }[];
  scrapbook: { sticker: string; x: number; y: number; r: number }[];
  tutorialDone: boolean;
  createdAt: number;
}

export interface ShopState {
  day: string;
  deals: { id: string; price: number; discount: number }[];
  /** ms until the deals rotate. */
  refreshIn: number;
}

export interface PublicRoomInfo {
  code: string;
  host: string;
  players: number;
  max: number;
  map: MapId;
  phase: PhaseId;
}

export interface RecordInfo {
  id: string;
  title: string;
  artist: string;
  year?: number;
  cover?: CoverSpec;
  license: string;
  categories: string[];
}

// ───────────────────────── client → server ─────────────────────────

export type C2S =
  | { t: 'hello'; v: number; token?: string; name?: string }
  | { t: 'profile_update'; name?: string; outfit?: Partial<Outfit>; title?: string; banner?: string; scrapbook?: ProfilePrivate['scrapbook'] }
  | { t: 'buy'; item: string }
  | { t: 'shop' }
  | { t: 'records' }
  | { t: 'create'; settings?: Partial<RoomSettings> }
  | { t: 'join'; code: string; session?: string }
  | { t: 'quick' }
  | { t: 'leave' }
  | { t: 'settings'; settings: Partial<RoomSettings> }
  | { t: 'start' }
  | { t: 'skip' }
  | { t: 'kick'; id: string }
  | { t: 'bot_add' }
  | { t: 'bot_remove' }
  | { t: 'ready'; v: boolean }
  | { t: 'cur'; u: number; v: number; d?: 0 | 1 }
  | { t: 'vote'; target: string }
  | { t: 'answer'; q: string; choice?: string; text?: string; year?: number }
  | { t: 'social'; target?: string; wager?: number }
  | { t: 'emote'; id: string }
  | { t: 'ping'; c: number }
  | { t: 'rooms' }
  | { t: 'tutorial_done' }
  | { t: 'import_playlist'; url: string };

// ───────────────────────── server → client ─────────────────────────

export type RoomFx =
  | { k: 'emote'; p: string; e: string }
  | { k: 'event'; e: RandomEventId; p?: string; seed: number }
  | { k: 'hint'; i: number }
  | { k: 'stage'; i: number }
  | { k: 'join'; p: string }
  | { k: 'leave'; p: string }
  | { k: 'host'; p: string }
  | { k: 'locked'; p: string }
  | { k: 'toast'; text: string };

export type S2C =
  | { t: 'welcome'; token: string; profile: ProfilePrivate; serverTime: number; features: ServerFeatures }
  | { t: 'profile'; profile: ProfilePrivate }
  | { t: 'shop'; shop: ShopState }
  | { t: 'records'; records: RecordInfo[] }
  | { t: 'room'; s: RoomSnapshot; session?: string }
  | { t: 'cur'; c: [string, number, number, number][] }
  | { t: 'fx'; fx: RoomFx }
  | { t: 'left'; reason: string }
  | { t: 'error'; code: string; msg: string }
  | { t: 'pong'; c: number; s: number }
  | { t: 'rooms'; rooms: PublicRoomInfo[] }
  | { t: 'achievement'; id: string }
  | { t: 'playlist'; ok: boolean; msg: string; count?: number };

export interface ServerFeatures {
  spotify: boolean;
  tmdb: boolean;
  musicbrainz: boolean;
  openverse: boolean;
  jamendo: boolean;
  commons: boolean;
}
