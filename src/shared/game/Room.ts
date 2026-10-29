// The authoritative game room. Environment-agnostic: the Node server runs it for real multiplayer
// and the browser runs it locally for the tutorial / offline practice against bots.

import { gridSlots, ringSlots, type BoardSlot } from '../board';
import { CATEGORIES, CATEGORY_BY_ID, EMOTE_BY_ID, MAPS, MAP_BY_ID, MINIGAMES, MINIGAME_BY_ID, RANDOM_EVENTS, SOCIAL_ROUNDS, type CategoryId, type MapId, type MinigameId, type SocialId } from '../catalog';
import { DEFAULT_OUTFIT, sanitizeOutfit, type Outfit } from '../cosmetics';
import type { AnswerResult, C2S, Phase, PlayerPublic, PublicQuestion, RewardSummary, RoomSettings, RoomSnapshot, S2C, Standing, VoteOption } from '../protocol';
import { MAX_PLAYERS, MIN_PLAYERS } from '../protocol';
import { pick, randInt, shuffle, weightedPick, type Rng } from '../rng';
import { answersMatch, clampInt, sanitizeName } from '../text';
import { randomBotOutfit, randomBrain, BOT_NAMES, type BotBrain } from './bots';
import { ContentDB, topicLabel, type SecretQuestion } from './questions';
import { BASE_POINTS, CLUE_MULT, duelSteal, PREDICT_BONUS, SABOTAGE_BONUS, speedFactor, STAGE_MULT, streakBonus, UNSHAKEN_BONUS, underdogFactor, wagerOptions, yearScore } from './scoring';

export interface RoomHooks {
  now(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  rng: Rng;
  content: ContentDB;
  send(playerId: string, msg: S2C): void;
  onGameEnd?(report: GameReport): RewardSummary[];
  onEmpty?(): void;
  onChange?(): void;
}

export interface GameStats {
  answered: number;
  correct: number;
  bestStreak: number;
  fastestMs: number | null;
  ear: boolean;
  yearExact: boolean;
  lyricsCorrect: number;
  perfectRounds: number;
  duelWins: number;
  bigWager: boolean;
  sabotageHit: boolean;
  categories: Record<string, number>;
  songs: string[];
  artists: string[];
  lastAtHalf: boolean;
  roundCorrect: number;
  roundAsked: number;
}

export interface GameReport {
  code: string;
  map: MapId;
  playerCount: number;
  players: { id: string; profileId?: string; isBot: boolean; name: string; score: number; place: number; isToad: boolean; isWinner: boolean; stats: GameStats }[];
}

interface Player extends PlayerPublic {
  session: string;
  profileId?: string;
  brain?: BotBrain;
  joinedAt: number;
  left: boolean;
  disconnectedAt: number | null;
  cursor: { u: number; v: number; d: number; dirty: boolean; tu: number; tv: number };
  vote?: string;
  answer?: { value: string | number; at: number };
  socialPick?: string;
  wager?: number;
  stats: GameStats;
  lastEmote: number;
  bucket: number;
  bucketAt: number;
  correctOrder: number[];
}

export const DEFAULT_SETTINGS: RoomSettings = {
  rounds: 6,
  questionsPerRound: 3,
  timer: 20,
  difficulty: 'mixed',
  categories: CATEGORIES.map((c) => c.id),
  minigames: MINIGAMES.map((m) => m.id),
  socialRounds: true,
  randomEvents: true,
  typedAnswers: false,
  comeback: true,
  finalDouble: true,
  map: 'vote',
  isPublic: false,
  maxPlayers: MAX_PLAYERS,
};

export function sanitizeSettings(raw: Partial<RoomSettings> | undefined, base: RoomSettings = DEFAULT_SETTINGS): RoomSettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  const s: RoomSettings = { ...base, categories: base.categories.slice(), minigames: base.minigames.slice() };
  if ('rounds' in r) s.rounds = clampInt(r.rounds, 3, 12, base.rounds);
  if ('questionsPerRound' in r) s.questionsPerRound = clampInt(r.questionsPerRound, 1, 5, base.questionsPerRound);
  if ('timer' in r) s.timer = clampInt(r.timer, 10, 30, base.timer);
  if ('difficulty' in r && ['easy', 'normal', 'hard', 'mixed'].includes(String(r.difficulty))) s.difficulty = r.difficulty as RoomSettings['difficulty'];
  if (Array.isArray(r.categories)) {
    const cats = r.categories.filter((c): c is CategoryId => typeof c === 'string' && c in CATEGORY_BY_ID);
    if (cats.length) s.categories = [...new Set(cats)];
  }
  if (Array.isArray(r.minigames)) {
    const mgs = r.minigames.filter((m): m is MinigameId => typeof m === 'string' && m in MINIGAME_BY_ID);
    if (mgs.length) s.minigames = [...new Set(mgs)];
  }
  for (const k of ['socialRounds', 'randomEvents', 'typedAnswers', 'comeback', 'finalDouble', 'isPublic'] as const) {
    if (k in r && typeof r[k] === 'boolean') s[k] = r[k] as boolean;
  }
  if ('map' in r && (r.map === 'vote' || (typeof r.map === 'string' && r.map in MAP_BY_ID))) s.map = r.map as RoomSettings['map'];
  if ('maxPlayers' in r) s.maxPlayers = clampInt(r.maxPlayers, MIN_PLAYERS, MAX_PLAYERS, base.maxPlayers);
  return s;
}

const T = {
  intro: 4500,
  mapVote: 12000,
  mapReveal: 6500,
  roundIntro: 3000,
  finalIntro: 4500,
  catVote: 11000,
  catReveal: 4000,
  mgIntro: 4800,
  social: 10000,
  qLead: 700,
  reveal: 5500,
  scoreboard: 6500,
  finale: 27000,
  rewards: 11000,
  rematch: 15000,
};

const DJ_INTROS = [
  'Welcome to the swamp, my slimy superstars! Lowest score tonight gets... TOADIFIED.',
  'Is everybody hydrated? Good. Frogs need that. Let\'s play!',
  'DJ Lilypadd in the house! Remember: one of you is leaving as a toad.',
  'Fresh flies, fresh beats, fresh humiliation. Let\'s gooo!',
];

function emptyStats(): GameStats {
  return {
    answered: 0, correct: 0, bestStreak: 0, fastestMs: null, ear: false, yearExact: false, lyricsCorrect: 0, perfectRounds: 0,
    duelWins: 0, bigWager: false, sabotageHit: false, categories: {}, songs: [], artists: [], lastAtHalf: false, roundCorrect: 0, roundAsked: 0,
  };
}

function token(rng: Rng, len = 20): string {
  const a = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += a[Math.floor(rng() * a.length)];
  return s;
}

export class Room {
  readonly code: string;
  settings: RoomSettings;
  hostId = '';
  map: MapId = 'swamp_clubhouse';
  phase: Phase = { id: 'lobby' };
  phaseStart = 0;
  phaseEnd = 0;
  round = 0;
  players: Player[] = [];
  readonly createdAt: number;
  /** Set for tutorial rooms: phases wait for `resume()` instead of timing out. */
  holdPhases = false;

  private hooks: RoomHooks;
  private phaseTimer: unknown = null;
  private extraTimers: unknown[] = [];
  private cursorTimer: unknown = null;
  private dirtyTimer: unknown = null;
  private hostTimer: unknown = null;
  private emptyTimer: unknown = null;
  private used = new Set<string>();
  private roundPlan: { social: SocialId | null; final: boolean }[] = [];
  private topic = 'cat:mixed';
  private minigame: MinigameId = 'trivia';
  private qIndex = 0;
  private qTotal = 0;
  private current: (SecretQuestion & { pub: PublicQuestion }) | null = null;
  private lastMinigames: MinigameId[] = [];
  private lastRanks = new Map<string, number>();
  private duel: { a: string; b: string } | null = null;
  private seq = 0;
  private gameOverReported = false;
  private lastScore = new Map<string, number>();
  private lobbyDropTimers = new Map<string, unknown>();
  private nextMapMode: 'vote' | 'keep' | null = null;

  constructor(code: string, hooks: RoomHooks, settings?: Partial<RoomSettings>) {
    this.code = code;
    this.hooks = hooks;
    this.settings = sanitizeSettings(settings);
    this.createdAt = hooks.now();
    this.phaseStart = hooks.now();
    if (this.settings.map !== 'vote') this.map = this.settings.map;
    this.cursorTimer = this.hooks.setTimer(() => this.cursorTick(), 66);
  }

  // ───────────────────────── players ─────────────────────────

  get humans(): Player[] {
    return this.players.filter((p) => !p.isBot && !p.left);
  }

  get active(): Player[] {
    return this.players.filter((p) => !p.left);
  }

  isFull(): boolean {
    return this.active.length >= this.settings.maxPlayers;
  }

  inGame(): boolean {
    return this.phase.id !== 'lobby';
  }

  addPlayer(opts: { name: string; outfit?: Outfit; level?: number; title?: string; profileId?: string; isBot?: boolean }): Player | null {
    if (this.isFull()) return null;
    const used = new Set(this.active.map((p) => p.seat));
    let seat = 0;
    while (used.has(seat)) seat++;
    const usedColors = new Set(this.active.map((p) => p.color));
    let color = seat % 12;
    for (let c = 0; c < 12; c++) if (!usedColors.has((seat + c) % 12)) { color = (seat + c) % 12; break; }
    let name = sanitizeName(opts.name);
    const taken = new Set(this.active.map((p) => p.name.toLowerCase()));
    if (taken.has(name.toLowerCase())) {
      for (let i = 2; i < 99; i++) if (!taken.has(`${name} ${i}`.toLowerCase())) { name = `${name.slice(0, 13)} ${i}`; break; }
    }
    const p: Player = {
      id: `p${++this.seq}${token(this.hooks.rng, 6)}`,
      name,
      color,
      outfit: opts.outfit ?? DEFAULT_OUTFIT,
      seat,
      isHost: false,
      isBot: Boolean(opts.isBot),
      connected: true,
      ready: Boolean(opts.isBot),
      score: 0,
      streak: 0,
      rank: 1,
      level: opts.level ?? 1,
      title: opts.title ?? 'Pond Rookie',
      nervous: 0,
      locked: false,
      session: token(this.hooks.rng, 24),
      profileId: opts.profileId,
      brain: opts.isBot ? randomBrain(this.hooks.rng) : undefined,
      joinedAt: this.hooks.now(),
      left: false,
      disconnectedAt: null,
      cursor: { u: 0.5, v: 0.5, d: 0, dirty: true, tu: 0.5, tv: 0.5 },
      stats: emptyStats(),
      lastEmote: 0,
      bucket: 40,
      bucketAt: this.hooks.now(),
      correctOrder: [],
    };
    this.players.push(p);
    if (!this.hostId || !this.players.find((x) => x.id === this.hostId && !x.left && !x.isBot)) {
      if (!p.isBot) this.setHost(p.id);
    }
    this.fx({ k: 'join', p: p.id });
    this.recomputeRanks();
    this.clearEmptyTimer();
    this.markDirty();
    return p;
  }

  addBot(): Player | null {
    const names = BOT_NAMES.filter((n) => !this.active.some((p) => p.name === `${n} 🤖` || p.name === n));
    const name = names.length ? pick(this.hooks.rng, names) : `Bot ${this.seq}`;
    return this.addPlayer({ name, outfit: randomBotOutfit(this.hooks.rng), isBot: true, level: randInt(this.hooks.rng, 1, 30), title: 'Bot Frog' });
  }

  removeBot(): void {
    const bots = this.active.filter((p) => p.isBot);
    if (bots.length) this.removePlayer(bots[bots.length - 1].id);
  }

  findBySession(session: string): Player | undefined {
    return this.players.find((p) => p.session === session && !p.left && !p.isBot);
  }

  getPlayer(id: string): Player | undefined {
    return this.players.find((p) => p.id === id);
  }

  reconnect(session: string): Player | null {
    const p = this.findBySession(session);
    if (!p) return null;
    p.connected = true;
    p.disconnectedAt = null;
    const drop = this.lobbyDropTimers.get(p.id);
    if (drop) { this.hooks.clearTimer(drop); this.lobbyDropTimers.delete(p.id); }
    this.clearEmptyTimer();
    if (this.hostId === p.id && this.hostTimer) { this.hooks.clearTimer(this.hostTimer); this.hostTimer = null; }
    this.fx({ k: 'join', p: p.id });
    this.markDirty();
    return p;
  }

  disconnect(id: string): void {
    const p = this.getPlayer(id);
    if (!p || p.isBot) return;
    p.connected = false;
    p.disconnectedAt = this.hooks.now();
    if (this.phase.id === 'lobby') {
      // In the lobby a dropped player keeps their seat briefly so a page refresh is seamless.
      this.lobbyDropTimers.set(p.id, this.hooks.setTimer(() => {
        this.lobbyDropTimers.delete(p.id);
        if (!p.connected && this.phase.id === 'lobby') this.removePlayer(p.id);
      }, 30000));
    }
    if (this.hostId === id) {
      if (this.hostTimer) this.hooks.clearTimer(this.hostTimer);
      this.hostTimer = this.hooks.setTimer(() => { this.hostTimer = null; this.migrateHost(); }, 8000);
    }
    this.checkEmpty();
    this.checkAllDone();
    this.markDirty();
  }

  removePlayer(id: string): void {
    const p = this.getPlayer(id);
    if (!p) return;
    if (this.phase.id === 'lobby') {
      this.players = this.players.filter((x) => x.id !== id);
    } else {
      p.left = true;
      p.connected = false;
    }
    this.fx({ k: 'leave', p: id });
    if (this.hostId === id) this.migrateHost();
    this.recomputeRanks();
    this.checkEmpty();
    this.checkAllDone();
    this.markDirty();
  }

  private setHost(id: string) {
    for (const p of this.players) p.isHost = p.id === id;
    this.hostId = id;
    this.fx({ k: 'host', p: id });
  }

  private migrateHost(): void {
    const candidates = this.players.filter((p) => !p.isBot && !p.left && p.connected).sort((a, b) => a.joinedAt - b.joinedAt);
    if (candidates.length) {
      if (candidates[0].id !== this.hostId) this.setHost(candidates[0].id);
    } else {
      const any = this.players.filter((p) => !p.isBot && !p.left).sort((a, b) => a.joinedAt - b.joinedAt)[0];
      if (any) this.setHost(any.id);
    }
    this.markDirty();
  }

  private checkEmpty(): void {
    const connectedHumans = this.players.filter((p) => !p.isBot && !p.left && p.connected);
    if (connectedHumans.length === 0 && !this.emptyTimer) {
      const delay = this.humans.length === 0 ? 2000 : 120000;
      this.emptyTimer = this.hooks.setTimer(() => { this.emptyTimer = null; this.hooks.onEmpty?.(); }, delay);
    }
  }

  private clearEmptyTimer(): void {
    if (this.emptyTimer) { this.hooks.clearTimer(this.emptyTimer); this.emptyTimer = null; }
  }

  destroy(): void {
    this.clearPhaseTimers();
    for (const t of [this.cursorTimer, this.dirtyTimer, this.hostTimer, this.emptyTimer, ...this.lobbyDropTimers.values()]) if (t) this.hooks.clearTimer(t);
    this.lobbyDropTimers.clear();
    this.cursorTimer = this.dirtyTimer = this.hostTimer = this.emptyTimer = null;
  }

  // ───────────────────────── networking ─────────────────────────

  private fx(fx: Extract<S2C, { t: 'fx' }>['fx'], only?: string): void {
    for (const p of this.players) if (!p.isBot && !p.left && p.connected && (!only || p.id === only)) this.hooks.send(p.id, { t: 'fx', fx });
  }

  markDirty(): void {
    if (this.dirtyTimer) return;
    this.dirtyTimer = this.hooks.setTimer(() => { this.dirtyTimer = null; this.broadcast(); }, 25);
  }

  broadcast(): void {
    for (const p of this.players) if (!p.isBot && !p.left && p.connected) this.hooks.send(p.id, { t: 'room', s: this.snapshotFor(p.id) });
    this.hooks.onChange?.();
  }

  sendSnapshot(id: string, withSession = false): void {
    const p = this.getPlayer(id);
    if (!p) return;
    this.hooks.send(id, { t: 'room', s: this.snapshotFor(id), ...(withSession ? { session: p.session } : {}) });
  }

  snapshotFor(id: string): RoomSnapshot {
    const me = this.getPlayer(id);
    const you: RoomSnapshot['you'] = { id };
    if (me) {
      if (me.answer && this.phase.id === 'question') you.answer = me.answer.value;
      if (me.wager !== undefined) you.wager = me.wager;
      if (me.socialPick) you.socialPick = me.socialPick;
      if (this.phase.id === 'question' && this.phase.sabotaged.includes(id)) you.sabotagedBy = true;
    }
    return {
      code: this.code,
      hostId: this.hostId,
      settings: this.settings,
      players: this.active.map((p) => this.publicPlayer(p)),
      map: this.map,
      phase: this.publicPhase(id),
      phaseStart: this.phaseStart,
      phaseEnd: this.phaseEnd,
      round: this.round,
      totalRounds: this.settings.rounds,
      you,
      serverTime: this.hooks.now(),
    };
  }

  private publicPlayer(p: Player): PlayerPublic {
    return {
      id: p.id, name: p.name, color: p.color, outfit: p.outfit, seat: p.seat, isHost: p.isHost, isBot: p.isBot,
      connected: p.connected, ready: p.ready, score: p.score, streak: p.streak, rank: p.rank, level: p.level,
      title: p.title, nervous: p.nervous, locked: this.phase.id === 'question' && Boolean(p.answer),
    };
  }

  private publicPhase(viewer: string): Phase {
    const ph = this.phase;
    if (ph.id === 'social_setup') {
      // Picks are secret during setup (except the duel challenger's public challenge).
      const picks: Record<string, string> = {};
      if (ph.social === 'duel') Object.assign(picks, ph.picks);
      else if (ph.picks[viewer]) picks[viewer] = ph.picks[viewer];
      return { ...ph, picks };
    }
    return ph;
  }

  // ───────────────────────── message handling ─────────────────────────

  handle(id: string, msg: C2S): void {
    const p = this.getPlayer(id);
    if (!p || p.left) return;
    const now = this.hooks.now();
    if (msg.t !== 'cur') {
      // Token bucket: 20 msgs/sec sustained, burst of 40.
      p.bucket = Math.min(40, p.bucket + ((now - p.bucketAt) / 1000) * 20);
      p.bucketAt = now;
      if (p.bucket < 1) return;
      p.bucket -= 1;
    }
    switch (msg.t) {
      case 'cur': {
        const u = Number(msg.u), v = Number(msg.v);
        if (!Number.isFinite(u) || !Number.isFinite(v)) return;
        p.cursor.u = Math.max(-0.2, Math.min(1.2, u));
        p.cursor.v = Math.max(-0.2, Math.min(1.2, v));
        p.cursor.d = msg.d ? 1 : 0;
        p.cursor.dirty = true;
        return;
      }
      case 'ready':
        if (this.phase.id === 'lobby') { p.ready = Boolean(msg.v); this.markDirty(); }
        return;
      case 'settings':
        if (id === this.hostId && this.phase.id === 'lobby') {
          this.settings = sanitizeSettings(msg.settings, this.settings);
          if (this.settings.map !== 'vote') this.map = this.settings.map;
          while (this.active.length > this.settings.maxPlayers) {
            const bot = this.active.filter((x) => x.isBot).pop();
            if (!bot) break;
            this.removePlayer(bot.id);
          }
          if (this.settings.maxPlayers < this.active.length) this.settings.maxPlayers = this.active.length;
          this.markDirty();
        }
        return;
      case 'start':
        if (id === this.hostId && this.phase.id === 'lobby') this.startGame();
        return;
      case 'skip':
        if (id === this.hostId && this.phase.id !== 'lobby' && this.phase.id !== 'question' && this.phase.id !== 'finale') this.endPhaseSoon(150);
        return;
      case 'kick':
        if (id === this.hostId && msg.id !== id) {
          const target = this.getPlayer(String(msg.id));
          if (target) {
            if (!target.isBot) this.hooks.send(target.id, { t: 'left', reason: 'You were removed by the host.' });
            this.removePlayer(target.id);
          }
        }
        return;
      case 'bot_add':
        if (id === this.hostId && this.phase.id === 'lobby') this.addBot();
        return;
      case 'bot_remove':
        if (id === this.hostId && this.phase.id === 'lobby') this.removeBot();
        return;
      case 'vote':
        this.castVote(p, String(msg.target));
        return;
      case 'answer':
        this.submitAnswer(p, msg);
        return;
      case 'social':
        this.socialPick(p, msg.target, msg.wager);
        return;
      case 'emote': {
        const e = EMOTE_BY_ID[String(msg.id)];
        if (!e || now - p.lastEmote < 1100) return;
        if (!p.isBot && !p.outfit.emotes.includes(e.id)) return;
        p.lastEmote = now;
        this.fx({ k: 'emote', p: p.id, e: e.id });
        return;
      }
      default:
        return;
    }
  }

  // ───────────────────────── phase engine ─────────────────────────

  private clearPhaseTimers(): void {
    if (this.phaseTimer) this.hooks.clearTimer(this.phaseTimer);
    this.phaseTimer = null;
    for (const t of this.extraTimers) this.hooks.clearTimer(t);
    this.extraTimers = [];
  }

  private later(ms: number, fn: () => void): void {
    this.extraTimers.push(this.hooks.setTimer(fn, Math.max(0, ms)));
  }

  private setPhase(phase: Phase, durationMs: number): void {
    this.clearPhaseTimers();
    this.phase = phase;
    const now = this.hooks.now();
    this.phaseStart = now;
    this.phaseEnd = now + durationMs;
    for (const p of this.players) p.vote = undefined;
    if (!this.holdPhases || phase.id === 'question' || phase.id === 'social_setup' || phase.id.endsWith('vote')) {
      this.phaseTimer = this.hooks.setTimer(() => this.onPhaseEnd(), durationMs);
    } else {
      this.phaseEnd = now + 3600_000;
    }
    this.runBots();
    this.markDirty();
  }

  /** Tutorial helper: continue from a held phase. */
  resume(): void {
    if (this.phase.id === 'lobby') return;
    this.endPhaseSoon(50);
  }

  private endPhaseSoon(ms: number): void {
    if (this.phaseTimer) this.hooks.clearTimer(this.phaseTimer);
    this.phaseEnd = this.hooks.now() + ms;
    this.phaseTimer = this.hooks.setTimer(() => this.onPhaseEnd(), ms);
    this.markDirty();
  }

  private onPhaseEnd(): void {
    this.phaseTimer = null;
    const ph = this.phase;
    switch (ph.id) {
      case 'intro': {
        const vote = this.nextMapMode ? this.nextMapMode === 'vote' : this.settings.map === 'vote';
        this.nextMapMode = null;
        if (vote) this.startMapVote();
        else this.startRound(1);
        break;
      }
      case 'map_vote':
        this.revealMap();
        break;
      case 'map_reveal':
        this.startRound(1);
        break;
      case 'final_intro':
      case 'round_intro':
        this.startCategoryVote();
        break;
      case 'category_vote':
        this.revealCategory();
        break;
      case 'category_reveal':
        this.startMinigameIntro();
        break;
      case 'minigame_intro':
        if (this.roundPlan[this.round - 1]?.social && this.canRunSocial(this.roundPlan[this.round - 1].social!)) this.startSocial(this.roundPlan[this.round - 1].social!);
        else this.startQuestion();
        break;
      case 'social_setup':
        this.finishSocialSetup();
        this.startQuestion();
        break;
      case 'question':
        this.finishQuestion();
        break;
      case 'question_reveal':
        if (this.qIndex < this.qTotal) this.startQuestion();
        else this.startScoreboard();
        break;
      case 'scoreboard':
        if (this.round >= this.settings.rounds) this.startFinale();
        else this.startRound(this.round + 1);
        break;
      case 'finale':
        this.startRewards();
        break;
      case 'rewards':
        this.startRematchVote();
        break;
      case 'rematch_vote':
        this.resolveRematch();
        break;
      default:
        break;
    }
  }

  // ───────────────────────── game flow ─────────────────────────

  startGame(): boolean {
    if (this.active.length < MIN_PLAYERS) {
      this.hooks.send(this.hostId, { t: 'error', code: 'need_players', msg: 'You need at least 2 frogs. Invite a friend or add a bot!' });
      return false;
    }
    this.resetScores();
    this.used.clear();
    this.lastMinigames = [];
    this.gameOverReported = false;
    const rng = this.hooks.rng;
    const socialOrder = shuffle(rng, SOCIAL_ROUNDS.map((s) => s.id));
    let si = 0;
    this.roundPlan = [];
    for (let r = 1; r <= this.settings.rounds; r++) {
      const final = r === this.settings.rounds;
      const social = this.settings.socialRounds && !final && r % 3 === 0 ? socialOrder[si++ % socialOrder.length] : null;
      this.roundPlan.push({ social, final });
    }
    this.setPhase({ id: 'intro', line: pick(rng, DJ_INTROS) }, T.intro);
    return true;
  }

  private resetScores(): void {
    for (const p of this.players) {
      p.score = 0; p.streak = 0; p.nervous = 0; p.answer = undefined; p.wager = undefined; p.socialPick = undefined;
      p.stats = emptyStats(); p.correctOrder = [];
    }
    this.players = this.players.filter((p) => !p.left);
    this.round = 0;
    this.recomputeRanks();
  }

  private startMapVote(): void {
    const options: VoteOption[] = MAPS.map((m) => ({ id: m.id, label: m.name, sub: m.blurb, color: m.color, art: m.id }));
    this.setPhase({ id: 'map_vote', options, votes: {} }, T.mapVote);
  }

  private revealMap(): void {
    if (this.phase.id !== 'map_vote') return;
    const { options, votes } = this.phase;
    const winner = this.tally(options.map((o) => o.id), votes, true);
    this.map = winner as MapId;
    for (const p of this.active) if (!p.stats.categories[`map:${this.map}`]) p.stats.categories[`map:${this.map}`] = 1;
    this.setPhase({ id: 'map_reveal', options, votes, winner, spins: 3 + Math.floor(this.hooks.rng() * 3) }, T.mapReveal);
  }

  private startRound(r: number): void {
    this.round = r;
    for (const p of this.players) { p.stats.roundCorrect = 0; p.stats.roundAsked = 0; }
    const plan = this.roundPlan[r - 1] ?? { social: null, final: false };
    if (r === Math.ceil(this.settings.rounds / 2) + 1) {
      // Halfway checkpoint for the Comeback Kid achievement.
      const ranked = this.ranked();
      const last = ranked[ranked.length - 1];
      if (last && ranked.length > 1) last.stats.lastAtHalf = true;
    }
    this.updateNervous();
    if (plan.final) this.setPhase({ id: 'final_intro' }, T.finalIntro);
    else this.setPhase({ id: 'round_intro', round: r, total: this.settings.rounds, final: false, social: plan.social }, T.roundIntro);
    this.maybeRandomEvent(0.3);
  }

  private topicHasContent(topic: string): number {
    let n = 0;
    for (const mg of this.settings.minigames) n += Math.min(this.settings.questionsPerRound, this.hooks.content.count(mg, topic, this.used));
    return n;
  }

  private startCategoryVote(): void {
    const rng = this.hooks.rng;
    const need = Math.min(2, this.settings.questionsPerRound);
    const cats = shuffle(rng, this.settings.categories.filter((c) => c !== 'mixed')).filter((c) => this.topicHasContent(`cat:${c}`) >= need);
    const options: VoteOption[] = cats.slice(0, 3).map((c) => {
      const def = CATEGORY_BY_ID[c];
      return { id: `cat:${c}`, label: def.name, sub: def.blurb, color: def.color, art: def.art };
    });
    // Sometimes offer an artist spotlight (vote for a specific artist).
    if (rng() < 0.35) {
      const artists = this.hooks.content.spotlightArtists(this.settings.questionsPerRound, this.settings.minigames, this.used);
      if (artists.length) {
        const a = pick(rng, artists);
        const opt = { id: `artist:${a}`, label: a, sub: 'Artist spotlight', color: '#ffd04c', art: 'spotlight' };
        if (options.length >= 3) options[2] = opt; else options.push(opt);
      }
    }
    if (this.settings.categories.includes('mixed') || options.length < 2) {
      options.push({ id: 'cat:mixed', label: 'Mixed Bag', sub: 'A little bit of everything', color: '#ffffff', art: 'dice' });
    }
    this.setPhase({ id: 'category_vote', round: this.round, options: options.slice(0, 4), votes: {} }, T.catVote);
  }

  private revealCategory(): void {
    if (this.phase.id !== 'category_vote') return;
    const { options, votes } = this.phase;
    const counts = new Map<string, number>();
    for (const v of Object.values(votes)) counts.set(v, (counts.get(v) ?? 0) + 1);
    const max = Math.max(0, ...counts.values());
    const tie = [...counts.values()].filter((c) => c === max).length > 1;
    const winner = this.tally(options.map((o) => o.id), votes, false);
    this.topic = winner;
    this.setPhase({ id: 'category_reveal', round: this.round, options, votes, winner, tie }, T.catReveal);
  }

  /** Majority vote; ties (or no votes) are settled randomly among the leaders. */
  private tally(ids: string[], votes: Record<string, string>, weighted: boolean): string {
    const counts = new Map<string, number>(ids.map((i) => [i, 0]));
    for (const v of Object.values(votes)) if (counts.has(v)) counts.set(v, counts.get(v)! + 1);
    if (weighted) {
      // Bottle spin: every vote is a weight, unvoted options keep a tiny chance for drama.
      const total = [...counts.values()].reduce((a, b) => a + b, 0);
      if (total === 0) return pick(this.hooks.rng, ids);
      return weightedPick(this.hooks.rng, ids, (i) => counts.get(i)! * counts.get(i)! + 0.02)!;
    }
    const max = Math.max(...counts.values());
    return pick(this.hooks.rng, ids.filter((i) => counts.get(i) === max));
  }

  private chooseMinigame(): { mg: MinigameId; audio: boolean; note: string } {
    const rng = this.hooks.rng;
    const allowed = this.settings.minigames;
    const qpr = this.settings.questionsPerRound;
    const final = this.roundPlan[this.round - 1]?.final;
    const cands = allowed.filter((mg) => this.hooks.content.count(mg, this.topic, this.used) >= 1);
    const audioWanted = allowed.some((m) => MINIGAME_BY_ID[m].audio === 'required');
    let note = '';
    if (!cands.length) {
      this.topic = 'cat:mixed';
      note = 'This topic is all played out — switching to a Mixed Bag!';
      const mixed = allowed.filter((mg) => this.hooks.content.count(mg, this.topic, this.used) >= 1);
      const mg = mixed.length ? pick(rng, mixed) : 'trivia';
      return { mg, audio: MINIGAME_BY_ID[mg].audio === 'required', note };
    }
    const mg = weightedPick(rng, cands, (m) => {
      const n = Math.min(qpr, this.hooks.content.count(m, this.topic, this.used));
      let w = n / qpr;
      if (MINIGAME_BY_ID[m].audio === 'required') w *= 1.6;
      if (final && (m === 'guess_song' || m === 'finish_lyrics')) w *= 2;
      const recent = this.lastMinigames.lastIndexOf(m);
      if (recent >= 0) w *= recent === this.lastMinigames.length - 1 ? 0.05 : 0.35;
      return w;
    })!;
    const hasAudio = cands.some((m) => MINIGAME_BY_ID[m].audio === 'required');
    if (audioWanted && !hasAudio) {
      note = `No openly licensed recordings for ${topicLabel(this.topic)}, so the DJ switches to liner-notes rounds — facts, years and trivia instead of audio.`;
    }
    return { mg, audio: MINIGAME_BY_ID[mg].audio === 'required', note };
  }

  private startMinigameIntro(): void {
    const plan = this.roundPlan[this.round - 1] ?? { social: null, final: false };
    const { mg, audio, note } = this.chooseMinigame();
    this.minigame = mg;
    this.lastMinigames.push(mg);
    this.qIndex = 0;
    this.qTotal = this.settings.questionsPerRound;
    const social = plan.social && this.canRunSocial(plan.social) ? plan.social : null;
    this.setPhase({ id: 'minigame_intro', round: this.round, minigame: mg, topic: topicLabel(this.topic), social, audio, note }, T.mgIntro);
  }

  // ───────────────────────── social rounds ─────────────────────────

  private canRunSocial(s: SocialId): boolean {
    const n = this.active.filter((p) => p.connected || p.isBot).length;
    return s === 'predict' ? n >= 3 : n >= 2;
  }

  private startSocial(social: SocialId): void {
    for (const p of this.players) { p.socialPick = undefined; p.wager = undefined; }
    const eligible = this.active.filter((p) => p.connected || p.isBot);
    let chooser: string | null = null;
    if (social === 'duel') {
      // The frog in last place gets to throw down the gauntlet — a fair comeback chance.
      const ranked = this.ranked().filter((p) => eligible.includes(p));
      chooser = ranked[ranked.length - 1]?.id ?? null;
    }
    this.setPhase({ id: 'social_setup', social, chooser, targets: eligible.map((p) => p.id), picks: {}, doneIds: [] }, T.social);
  }

  private socialPick(p: Player, target: unknown, wager: unknown): void {
    if (this.phase.id !== 'social_setup') return;
    const ph = this.phase;
    if (ph.social === 'wager') {
      const opts = wagerOptions(p.score);
      const w = typeof wager === 'number' ? wager : -1;
      if (!opts.includes(w)) return;
      p.wager = w;
      if (!ph.doneIds.includes(p.id)) ph.doneIds.push(p.id);
    } else {
      const t = String(target ?? '');
      if (t === p.id || !ph.targets.includes(t)) {
        if (!(ph.social === 'sabotage' && t === 'none')) return;
      }
      if (ph.social === 'duel' && ph.chooser !== p.id) return;
      p.socialPick = t;
      ph.picks[p.id] = t;
      if (!ph.doneIds.includes(p.id)) ph.doneIds.push(p.id);
    }
    this.markDirty();
    const needed = ph.social === 'duel' ? [ph.chooser] : this.active.filter((x) => x.connected || x.isBot).map((x) => x.id);
    if (needed.every((id) => id && ph.doneIds.includes(id)) && this.phaseEnd - this.hooks.now() > 1500) this.endPhaseSoon(1200);
  }

  private finishSocialSetup(): void {
    if (this.phase.id !== 'social_setup') return;
    const ph = this.phase;
    const rng = this.hooks.rng;
    this.duel = null;
    if (ph.social === 'duel' && ph.chooser) {
      let target = ph.picks[ph.chooser];
      if (!target) {
        const others = ph.targets.filter((t) => t !== ph.chooser);
        // Default challenge: the current leader.
        target = this.ranked().find((p) => others.includes(p.id))?.id ?? pick(rng, others);
        ph.picks[ph.chooser] = target;
      }
      this.duel = { a: ph.chooser, b: target };
    }
    if (ph.social === 'wager') for (const p of this.active) if (p.wager === undefined) p.wager = 0;
  }

  // ───────────────────────── questions ─────────────────────────

  private startQuestion(): void {
    const rng = this.hooks.rng;
    const timerMs = this.settings.timer * 1000;
    const ctx = { rng, difficulty: this.settings.difficulty, used: this.used, typed: this.settings.typedAnswers, timerMs };
    let q = this.hooks.content.generate(this.minigame, this.topic, ctx);
    if (!q) {
      const alts = shuffle(rng, this.settings.minigames).filter((m) => m !== this.minigame);
      for (const mg of alts) { q = this.hooks.content.generate(mg, this.topic, ctx); if (q) break; }
    }
    if (!q) for (const mg of shuffle(rng, this.settings.minigames)) { q = this.hooks.content.generate(mg, 'cat:mixed', ctx); if (q) break; }
    if (!q) {
      // Content exhausted: wrap up the round.
      this.qIndex = this.qTotal;
      this.startScoreboard();
      return;
    }
    this.qIndex++;
    const final = this.roundPlan[this.round - 1]?.final && this.settings.finalDouble;
    const now = this.hooks.now();
    const startAt = now + T.qLead;
    const duration = timerMs + q.extraMs;
    const pub: PublicQuestion = {
      ...q.pub,
      id: `q${++this.seq}`,
      index: this.qIndex,
      total: this.qTotal,
      multiplier: final ? 2 : 1,
      startAt,
      deadline: startAt + duration,
    };
    this.current = { ...q, pub };
    for (const p of this.players) p.answer = undefined;
    const sabotaged: string[] = [];
    if (this.qIndex === 1 && this.roundPlan[this.round - 1]?.social === 'sabotage') {
      for (const p of this.active) if (p.socialPick && p.socialPick !== 'none' && !sabotaged.includes(p.socialPick)) sabotaged.push(p.socialPick);
    }
    this.setPhase({ id: 'question', q: pub, sabotaged }, T.qLead + duration + 250);
    // Progressive hints.
    if (q.hintsAll && q.hintAt) {
      q.hintAt.forEach((ms, i) => {
        if (i === 0) return;
        this.later(T.qLead + ms, () => {
          if (this.phase.id !== 'question' || this.phase.q.id !== pub.id) return;
          pub.hints = q!.hintsAll!.slice(0, i + 1);
          this.fx({ k: 'hint', i });
          this.markDirty();
        });
      });
    }
  }

  private submitAnswer(p: Player, msg: Extract<C2S, { t: 'answer' }>): void {
    if (this.phase.id !== 'question' || !this.current) return;
    const q = this.current;
    if (msg.q !== q.pub.id || p.answer) return;
    const now = this.hooks.now();
    if (now < q.pub.startAt - 100 || now > q.pub.deadline + 400) return;
    let value: string | number | undefined;
    if (q.pub.input === 'choice' && typeof msg.choice === 'string' && q.pub.choices?.some((c) => c.id === msg.choice)) value = msg.choice;
    else if (q.pub.input === 'text' && typeof msg.text === 'string') value = msg.text.slice(0, 80);
    else if (q.pub.input === 'year' && typeof msg.year === 'number' && Number.isFinite(msg.year)) value = Math.round(msg.year);
    if (value === undefined) return;
    p.answer = { value, at: Math.max(now, q.pub.startAt) };
    this.fx({ k: 'locked', p: p.id });
    this.markDirty();
    this.checkAllDone();
  }

  private checkAllDone(): void {
    if (this.phase.id === 'question') {
      const waiting = this.active.filter((p) => (p.connected || p.isBot) && !p.answer);
      if (!waiting.length && this.phaseEnd - this.hooks.now() > 900) this.endPhaseSoon(800);
    } else if (this.phase.id === 'category_vote' || this.phase.id === 'map_vote' || this.phase.id === 'rematch_vote') {
      const voters = this.active.filter((p) => p.connected || p.isBot);
      const votes = this.phase.votes;
      if (voters.length && voters.every((p) => votes[p.id]) && this.phaseEnd - this.hooks.now() > 2500) this.endPhaseSoon(2200);
    }
  }

  private castVote(p: Player, target: string): void {
    const ph = this.phase;
    if (ph.id !== 'category_vote' && ph.id !== 'map_vote' && ph.id !== 'rematch_vote') return;
    if (!ph.options.some((o) => o.id === target)) return;
    ph.votes[p.id] = target;
    p.vote = target;
    this.markDirty();
    this.checkAllDone();
  }

  private judge(p: Player, q: SecretQuestion & { pub: PublicQuestion }): { correct: boolean; factor: number; ms: number | null; label: string | null; exactYear?: boolean } {
    if (!p.answer) return { correct: false, factor: 0, ms: null, label: null };
    const ms = Math.max(0, p.answer.at - q.pub.startAt);
    const limit = q.pub.deadline - q.pub.startAt;
    const v = p.answer.value;
    switch (q.scoring) {
      case 'year': {
        const ys = yearScore(Number(v), q.year!);
        return { correct: ys >= 0.5, factor: ys * (0.85 + 0.15 * speedFactor(ms, limit)), ms, label: String(v), exactYear: ys === 1 };
      }
      case 'text': {
        const ok = answersMatch(String(v), q.correctLabel.split(' — ')[0], q.aliases);
        return { correct: ok, factor: ok ? speedFactor(ms, limit) : 0, ms, label: String(v) };
      }
      case 'stages': {
        const ok = v === q.correctId;
        let stage = 0;
        q.stageAt!.forEach((t, i) => { if (ms >= t + 50) stage = i; });
        const label = q.pub.choices?.find((c) => c.id === v)?.label ?? null;
        return { correct: ok, factor: ok ? STAGE_MULT[stage] : 0, ms, label };
      }
      case 'clues': {
        const ok = v === q.correctId;
        let shown = 1;
        q.hintAt?.forEach((t, i) => { if (ms >= t) shown = i + 1; });
        const label = q.pub.choices?.find((c) => c.id === v)?.label ?? null;
        return { correct: ok, factor: ok ? CLUE_MULT[Math.min(CLUE_MULT.length - 1, shown - 1)] * (0.85 + 0.15 * speedFactor(ms, limit)) : 0, ms, label };
      }
      default: {
        const ok = v === q.correctId;
        const label = q.pub.choices?.find((c) => c.id === v)?.label ?? null;
        return { correct: ok, factor: ok ? speedFactor(ms, limit) : 0, ms, label };
      }
    }
  }

  private finishQuestion(): void {
    const q = this.current;
    if (!q || this.phase.id !== 'question') return;
    const plan = this.roundPlan[this.round - 1];
    const social = this.qIndex === 1 ? plan?.social ?? null : null;
    const ranksBefore = new Map(this.ranked().map((p, i) => [p.id, i + 1]));
    const playerCount = this.active.length;
    const results: AnswerResult[] = [];
    const judged = new Map<string, ReturnType<Room['judge']>>();
    const catKey = this.topic.startsWith('cat:') ? this.topic.slice(4) : 'spotlight';

    for (const p of this.active) {
      const j = this.judge(p, q);
      judged.set(p.id, j);
      const base = Math.round((BASE_POINTS * q.pub.multiplier * j.factor) / 10) * 10;
      if (p.answer) p.stats.answered++;
      p.stats.roundAsked++;
      if (j.correct) {
        p.streak++;
        p.stats.correct++;
        p.stats.roundCorrect++;
        p.stats.bestStreak = Math.max(p.stats.bestStreak, p.streak);
        p.stats.categories[catKey] = (p.stats.categories[catKey] ?? 0) + 1;
        if (j.ms !== null && (p.stats.fastestMs === null || j.ms < p.stats.fastestMs)) p.stats.fastestMs = j.ms;
        if (q.scoring === 'stages' && j.factor === STAGE_MULT[0]) p.stats.ear = true;
        if (q.pub.minigame === 'finish_lyrics') p.stats.lyricsCorrect++;
      } else {
        p.streak = 0;
      }
      if (j.exactYear) p.stats.yearExact = true;
      const sb = j.correct ? streakBonus(p.streak) : 0;
      const ud = j.correct && this.settings.comeback ? Math.round((base * underdogFactor(ranksBefore.get(p.id) ?? 1, playerCount, this.round)) / 10) * 10 : 0;
      const points = base + sb + ud;
      p.score += points;
      if (q.songId && !p.stats.songs.includes(q.songId)) p.stats.songs.push(q.songId);
      if (q.artist && !p.stats.artists.includes(q.artist)) p.stats.artists.push(q.artist);
      results.push({
        playerId: p.id, correct: j.correct, points, base, speedBonus: 0, streakBonus: sb, underdogBonus: ud, social: 0,
        ms: j.ms, answerLabel: j.label, streak: p.streak,
      });
    }

    // Social resolution (first question of a social round only).
    const socialLines: string[] = [];
    const picks: Record<string, string> = {};
    const resultOf = (id: string) => results.find((r) => r.playerId === id)!;
    const name = (id: string) => this.getPlayer(id)?.name ?? '???';
    if (social === 'wager') {
      for (const p of this.active) {
        const w = p.wager ?? 0;
        if (!w) continue;
        const r = resultOf(p.id);
        const delta = r.correct ? w : -Math.min(w, p.score);
        p.score += delta;
        r.social += delta;
        r.points += delta;
        if (r.correct && w >= 500) p.stats.bigWager = true;
        socialLines.push(r.correct ? `🎲 ${p.name} won a ${w}-point wager!` : `💸 ${p.name} lost ${-delta} on a wager...`);
      }
    } else if (social === 'predict') {
      for (const p of this.active) {
        if (!p.socialPick) continue;
        picks[p.id] = p.socialPick;
        const target = resultOf(p.socialPick);
        if (target && !target.correct) {
          p.score += PREDICT_BONUS;
          const r = resultOf(p.id);
          r.social += PREDICT_BONUS;
          r.points += PREDICT_BONUS;
          socialLines.push(`🔮 ${p.name} called it: ${name(p.socialPick)} flopped! +${PREDICT_BONUS}`);
        }
      }
    } else if (social === 'sabotage') {
      const unshaken = new Set<string>();
      for (const p of this.active) {
        if (!p.socialPick || p.socialPick === 'none') continue;
        picks[p.id] = p.socialPick;
        const target = resultOf(p.socialPick);
        if (!target) continue;
        if (!target.correct) {
          p.score += SABOTAGE_BONUS;
          const r = resultOf(p.id);
          r.social += SABOTAGE_BONUS;
          r.points += SABOTAGE_BONUS;
          p.stats.sabotageHit = true;
          socialLines.push(`🪰 ${p.name}'s sabotage on ${name(p.socialPick)} worked! +${SABOTAGE_BONUS}`);
        } else if (!unshaken.has(p.socialPick)) {
          unshaken.add(p.socialPick);
          const tp = this.getPlayer(p.socialPick)!;
          tp.score += UNSHAKEN_BONUS;
          target.social += UNSHAKEN_BONUS;
          target.points += UNSHAKEN_BONUS;
          socialLines.push(`🛡️ ${tp.name} shrugged off the sabotage! +${UNSHAKEN_BONUS}`);
        }
      }
    } else if (social === 'duel' && this.duel) {
      const { a, b } = this.duel;
      picks[a] = b;
      const ra = resultOf(a);
      const rb = resultOf(b);
      const pa = this.getPlayer(a);
      const pb = this.getPlayer(b);
      if (ra && rb && pa && pb) {
        let winner: Player | null = null;
        if (ra.correct && !rb.correct) winner = pa;
        else if (rb.correct && !ra.correct) winner = pb;
        else if (ra.correct && rb.correct) winner = (ra.ms ?? 1e9) <= (rb.ms ?? 1e9) ? pa : pb;
        if (winner) {
          const loser = winner === pa ? pb : pa;
          const steal = duelSteal(loser.score);
          loser.score -= steal;
          winner.score += steal;
          resultOf(winner.id).social += steal;
          resultOf(winner.id).points += steal;
          resultOf(loser.id).social -= steal;
          resultOf(loser.id).points -= steal;
          winner.stats.duelWins++;
          socialLines.push(`⚔️ ${winner.name} won the duel and stole ${steal} from ${loser.name}!`);
        } else {
          socialLines.push(`⚔️ Both duelists flopped. Nobody steals anything. Awkward.`);
        }
      }
    }

    for (const p of this.active) if (p.score < 0) p.score = 0;
    this.recomputeRanks();
    this.updateNervous();
    const pub = q.pub;
    const correctLabel = q.correctLabel;
    this.setPhase({ id: 'question_reveal', q: pub, correct: q.correctId, correctLabel, results, fact: q.fact, socialLines, picks }, T.reveal + (socialLines.length ? 1500 : 0));
  }

  private startScoreboard(): void {
    for (const p of this.active) {
      if (p.stats.roundAsked > 0 && p.stats.roundCorrect === p.stats.roundAsked && p.stats.roundAsked >= 2) p.stats.perfectRounds++;
    }
    const ranked = this.ranked();
    const standings: Standing[] = ranked.map((p, i) => ({
      id: p.id, score: p.score, prevRank: this.lastRanks.get(p.id) ?? i + 1, rank: i + 1,
      delta: p.score - (this.lastScore.get(p.id) ?? 0),
    }));
    this.lastRanks = new Map(ranked.map((p, i) => [p.id, i + 1]));
    this.lastScore = new Map(ranked.map((p) => [p.id, p.score]));
    this.setPhase({ id: 'scoreboard', round: this.round, total: this.settings.rounds, standings }, T.scoreboard);
    this.maybeRandomEvent(0.35);
  }

  /** Sorted best→worst with deterministic tie-breaks (correct answers, then fastest answer, then seat). */
  ranked(): Player[] {
    return this.active.slice().sort((a, b) =>
      b.score - a.score || b.stats.correct - a.stats.correct || (a.stats.fastestMs ?? 1e9) - (b.stats.fastestMs ?? 1e9) || a.seat - b.seat);
  }

  private recomputeRanks(): void {
    const r = this.ranked();
    r.forEach((p, i) => {
      // Equal scores share a rank for display.
      p.rank = i > 0 && r[i - 1].score === p.score ? r[i - 1].rank : i + 1;
    });
  }

  private updateNervous(): void {
    const ranked = this.ranked();
    const total = Math.max(1, this.settings.rounds);
    const progress = this.phase.id === 'lobby' ? 0 : Math.min(1, Math.max(0.15, this.round / total));
    for (const p of ranked) p.nervous = 0;
    if (ranked.length >= 2 && this.round >= 1) {
      ranked[ranked.length - 1].nervous = +(0.25 + 0.75 * progress).toFixed(2);
      if (ranked.length >= 4) ranked[ranked.length - 2].nervous = +(0.3 * progress).toFixed(2);
    }
  }

  private maybeRandomEvent(chance: number): void {
    if (!this.settings.randomEvents || this.hooks.rng() > chance) return;
    const rng = this.hooks.rng;
    const e = pick(rng, RANDOM_EVENTS);
    const target = pick(rng, this.active)?.id;
    this.later(600 + rng() * 1500, () => this.fx({ k: 'event', e, p: target, seed: Math.floor(rng() * 1e9) }));
  }

  // ───────────────────────── finale & rematch ─────────────────────────

  private startFinale(): void {
    const ranked = this.ranked();
    const ranking = ranked.map((p) => p.id);
    const tie = ranked.length > 1 && ranked[0].score === ranked[1].score;
    this.setPhase({ id: 'finale', ranking, loser: ranking[ranking.length - 1], winner: ranking[0], tie }, T.finale);
  }

  private startRewards(): void {
    if (this.phase.id !== 'finale') return;
    const ranking = this.phase.ranking;
    let rewards: RewardSummary[] = [];
    if (!this.gameOverReported) {
      this.gameOverReported = true;
      const report: GameReport = {
        code: this.code,
        map: this.map,
        playerCount: this.active.length,
        players: ranking.map((id, i) => {
          const p = this.getPlayer(id)!;
          return { id, profileId: p.profileId, isBot: p.isBot, name: p.name, score: p.score, place: i + 1, isToad: i === ranking.length - 1, isWinner: i === 0, stats: p.stats };
        }),
      };
      rewards = this.hooks.onGameEnd?.(report) ?? [];
    }
    this.setPhase({ id: 'rewards', ranking, rewards }, T.rewards);
  }

  private startRematchVote(): void {
    const options: VoteOption[] = [
      { id: 'rematch', label: 'Rematch!', sub: 'Same map, fresh scores', color: '#6fe05a', art: 'rematch' },
      { id: 'newmap', label: 'New Map', sub: 'Spin the bottle again', color: '#ffb13b', art: 'bottle' },
      { id: 'lobby', label: 'Back to Lobby', sub: 'Change settings', color: '#4aa3ff', art: 'door' },
    ];
    this.setPhase({ id: 'rematch_vote', options, votes: {} }, T.rematch);
  }

  private resolveRematch(): void {
    if (this.phase.id !== 'rematch_vote') return;
    const votes = Object.values(this.phase.votes);
    const counts = { rematch: 0, newmap: 0, lobby: 0 } as Record<string, number>;
    for (const v of votes) counts[v] = (counts[v] ?? 0) + 1;
    const best = votes.length === 0 ? 'lobby' : (['rematch', 'newmap', 'lobby'] as const).reduce((a, b) => (counts[b] > counts[a] ? b : a));
    if (best === 'lobby' || this.active.length < MIN_PLAYERS) {
      this.resetScores();
      for (const p of this.players) p.ready = p.isBot;
      this.clearPhaseTimers();
      this.phase = { id: 'lobby' };
      this.phaseStart = this.hooks.now();
      this.phaseEnd = this.phaseStart;
      this.markDirty();
      return;
    }
    this.startGame();
    this.nextMapMode = best === 'newmap' ? 'vote' : 'keep';
  }

  // ───────────────────────── cursors & bots ─────────────────────────

  private cursorTick(): void {
    this.cursorTimer = this.hooks.setTimer(() => this.cursorTick(), 66);
    const rng = this.hooks.rng;
    for (const b of this.active) {
      if (!b.isBot) continue;
      const c = b.cursor;
      const du = c.tu - c.u, dv = c.tv - c.v;
      if (Math.abs(du) + Math.abs(dv) > 0.002) {
        c.u += du * 0.22 + (rng() - 0.5) * 0.004;
        c.v += dv * 0.22 + (rng() - 0.5) * 0.004;
        c.dirty = true;
      } else if (rng() < 0.02) {
        c.tu = Math.min(0.95, Math.max(0.05, c.u + (rng() - 0.5) * 0.15));
        c.tv = Math.min(0.95, Math.max(0.05, c.v + (rng() - 0.5) * 0.15));
      }
    }
    const changed = this.active.filter((p) => p.cursor.dirty && (p.connected || p.isBot));
    if (!changed.length) return;
    const c: [string, number, number, number][] = changed.map((p) => {
      p.cursor.dirty = false;
      return [p.id, +p.cursor.u.toFixed(3), +p.cursor.v.toFixed(3), p.cursor.d];
    });
    for (const p of this.players) if (!p.isBot && !p.left && p.connected) this.hooks.send(p.id, { t: 'cur', c });
  }

  private botAimAt(b: Player, slot: BoardSlot | undefined, clickAfter: number, act: () => void): void {
    const rng = this.hooks.rng;
    if (slot) { b.cursor.tu = slot.u + (rng() - 0.5) * slot.w * 0.4; b.cursor.tv = slot.v + (rng() - 0.5) * slot.h * 0.4; }
    this.later(clickAfter, () => {
      b.cursor.d = 1; b.cursor.dirty = true;
      act();
      this.later(180, () => { b.cursor.d = 0; b.cursor.dirty = true; });
    });
  }

  private runBots(): void {
    const rng = this.hooks.rng;
    const bots = this.active.filter((p) => p.isBot);
    if (!bots.length) return;
    const ph = this.phase;
    for (const b of bots) {
      const brain = b.brain!;
      const thinkMs = 900 + (1 - brain.speed) * 3500 + rng() * 1800;
      switch (ph.id) {
        case 'map_vote':
        case 'category_vote':
        case 'rematch_vote': {
          const slots = ph.id === 'map_vote' ? ringSlots(ph.options.length) : gridSlots(ph.options.length);
          const choice = ph.id === 'rematch_vote' ? (rng() < 0.6 ? 0 : Math.floor(rng() * ph.options.length)) : Math.floor(rng() * ph.options.length);
          this.later(thinkMs * 0.4, () => { const s = slots[choice]; if (s) { b.cursor.tu = s.u; b.cursor.tv = s.v; } });
          this.botAimAt(b, slots[choice], thinkMs, () => this.castVote(b, ph.options[choice].id));
          // Occasionally change their mind for the drama.
          if (rng() < 0.25 && ph.options.length > 1) {
            const alt = (choice + 1) % ph.options.length;
            this.botAimAt(b, slots[alt], thinkMs + 2200, () => this.castVote(b, ph.options[alt].id));
          }
          break;
        }
        case 'social_setup': {
          const others = ph.targets.filter((t) => t !== b.id);
          const slots = gridSlots(ph.social === 'wager' ? wagerOptions(b.score).length : others.length);
          if (ph.social === 'wager') {
            const opts = wagerOptions(b.score);
            const i = Math.min(opts.length - 1, Math.floor(rng() * opts.length * (0.5 + brain.chaos * 0.6)));
            this.botAimAt(b, slots[i], thinkMs, () => this.socialPick(b, undefined, opts[i]));
          } else if (ph.social !== 'duel' || ph.chooser === b.id) {
            if (ph.social === 'sabotage' && rng() < 0.2) { this.later(thinkMs, () => this.socialPick(b, 'none', undefined)); break; }
            const ranked = this.ranked().filter((p) => others.includes(p.id));
            const target = ph.social === 'duel' && rng() < 0.6 ? ranked[0]?.id : pick(rng, others);
            const idx = others.indexOf(target ?? '');
            if (target) this.botAimAt(b, slots[idx], thinkMs, () => this.socialPick(b, target, undefined));
          }
          break;
        }
        case 'question': {
          const q = this.current;
          if (!q) break;
          const qid = ph.q.id;
          const diff = this.settings.difficulty === 'hard' ? 0.8 : this.settings.difficulty === 'easy' ? 1.15 : 1;
          const knows = rng() < Math.min(0.92, brain.skill * diff + (q.pub.choices?.length === 2 ? 0.2 : 0));
          const limit = ph.q.deadline - ph.q.startAt;
          let at = T.qLead + 1200 + (1 - brain.speed) * limit * 0.55 + rng() * limit * 0.25;
          if (q.scoring === 'stages' && q.stageAt) {
            const stage = Math.min(4, Math.floor((1 - brain.skill) * 4 + rng() * 2));
            at = T.qLead + q.stageAt[stage] + 500 + rng() * 1200;
          }
          if (q.scoring === 'clues' && q.hintAt) at = T.qLead + q.hintAt[Math.min(q.hintAt.length - 1, Math.floor(rng() * 3))] + 1500 + rng() * 1500;
          at = Math.min(at, T.qLead + limit - 400);
          const choices = q.pub.choices ?? [];
          const slots = gridSlots(choices.length);
          if (q.pub.input === 'choice') {
            const wrong = choices.filter((c) => c.id !== q.correctId);
            const choice = knows || !wrong.length ? q.correctId : pick(rng, wrong).id;
            const idx = choices.findIndex((c) => c.id === choice);
            // Wander between options first (bluffing is part of the fun).
            const decoy = slots[Math.floor(rng() * slots.length)];
            this.later(at * 0.35, () => { if (decoy) { b.cursor.tu = decoy.u; b.cursor.tv = decoy.v; } });
            this.later(at * 0.7, () => { const s = slots[idx]; if (s) { b.cursor.tu = s.u; b.cursor.tv = s.v; } });
            this.botAimAt(b, slots[idx], at, () => { if (this.phase.id === 'question' && this.phase.q.id === qid) this.submitAnswer(b, { t: 'answer', q: qid, choice }); });
          } else if (q.pub.input === 'year') {
            const err = knows ? Math.round((rng() - 0.5) * 3) : Math.round((rng() - 0.5) * 16);
            this.later(at, () => { if (this.phase.id === 'question' && this.phase.q.id === qid) this.submitAnswer(b, { t: 'answer', q: qid, year: q.year! + err }); });
          } else {
            const text = knows ? q.correctLabel.split(' — ')[0] : 'ribbit?';
            this.later(at, () => { if (this.phase.id === 'question' && this.phase.q.id === qid) this.submitAnswer(b, { t: 'answer', q: qid, text }); });
          }
          break;
        }
        case 'question_reveal': {
          const r = ph.results.find((x) => x.playerId === b.id);
          if (r && rng() < 0.3 + brain.chaos * 0.4) {
            const e = r.correct ? pick(rng, ['clap', 'ribbit', 'love', 'laugh']) : pick(rng, ['cry', 'shock', 'angry']);
            this.later(600 + rng() * 2500, () => this.handle(b.id, { t: 'emote', id: e }));
          }
          break;
        }
        case 'finale': {
          if (ph.loser !== b.id && rng() < 0.7) this.later(9000 + rng() * 4000, () => this.handle(b.id, { t: 'emote', id: 'laugh' }));
          break;
        }
        default:
          if (rng() < brain.chaos * 0.15) this.later(500 + rng() * 2000, () => this.handle(b.id, { t: 'emote', id: pick(rng, ['wave', 'ribbit', 'laugh', 'love']) }));
          break;
      }
    }
  }

  /** Public info for the room browser / matchmaking. */
  info() {
    const host = this.getPlayer(this.hostId);
    return { code: this.code, host: host?.name ?? '?', players: this.active.length, max: this.settings.maxPlayers, map: this.map, phase: this.phase.id };
  }

  /** Swap the content database (e.g. after the host imports a playlist). */
  setContent(db: ContentDB): void {
    this.hooks.content = db;
  }

  applyOutfit(id: string, outfit: Outfit, owned?: ReadonlySet<string>, level?: number, title?: string, name?: string): void {
    const p = this.getPlayer(id);
    if (!p) return;
    p.outfit = sanitizeOutfit(outfit, owned);
    if (level) p.level = level;
    if (title) p.title = title;
    if (name && this.phase.id === 'lobby') p.name = sanitizeName(name, p.name);
    this.markDirty();
  }
}
