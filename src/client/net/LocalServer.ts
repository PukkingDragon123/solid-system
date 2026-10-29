// Offline build: stands in for the game server inside the browser. Runs real Room games against bots,
// keeps the profile in localStorage and runs the same economy as the server. No multiplayer.

import { COSMETIC_BY_ID, DEFAULT_OUTFIT, STARTER_ITEMS } from '../../shared/cosmetics';
import { Room } from '../../shared/game/Room';
import { STARTING_COINS } from '../../shared/progression';
import type { C2S, ProfilePrivate, S2C } from '../../shared/protocol';
import { mulberry32 } from '../../shared/rng';
import { buyItem, computeRewards, editProfile, grantAchievement, shopState } from '../../server/economy';
import { buildContent, recordsFor } from '../../server/content';
import { Net, storage } from './Net';

const KEY = 'loo_offline_profile';
const FEATURES = { spotify: false, tmdb: false, musicbrainz: false, openverse: false, jamendo: false, commons: false };

function freshProfile(name: string): ProfilePrivate {
  return {
    id: 'local', name, coins: STARTING_COINS, xp: 0, level: 1,
    outfit: { ...DEFAULT_OUTFIT, emotes: DEFAULT_OUTFIT.emotes.slice() },
    owned: STARTER_ITEMS.slice(), title: 'title_rookie', banner: 'banner_swamp',
    stats: { games: 0, wins: 0, toads: 0, podiums: 0, answered: 0, correct: 0, bestStreak: 0, lyricsCorrect: 0, categories: {}, mapsPlayed: [], fastestMs: null },
    achievements: {}, records: [], artists: [], trophies: [],
    scrapbook: [{ sticker: 'stk_lily', x: 0.18, y: 0.78, r: -12 }, { sticker: 'stk_note', x: 0.82, y: 0.2, r: 10 }],
    tutorialDone: false, createdAt: Date.now(),
  };
}

export class LocalServer extends Net {
  private profile: ProfilePrivate;
  private content = buildContent();
  private room: Room | null = null;
  private me = '';

  constructor() {
    super('local');
    let p: ProfilePrivate | null = null;
    try { const raw = storage()?.getItem(KEY); if (raw) p = JSON.parse(raw); } catch { /* fresh */ }
    const base = freshProfile(p?.name ?? 'Froggo');
    this.profile = p ? { ...base, ...p, outfit: { ...base.outfit, ...p.outfit }, stats: { ...base.stats, ...p.stats }, owned: [...new Set([...STARTER_ITEMS, ...(p.owned ?? [])])] } : base;
  }

  override get online(): boolean { return true; }
  override serverNow(): number { return Date.now(); }
  override close(): void { this.room?.destroy(); this.room = null; }

  override connect(): void {
    this.status = 'open';
    queueMicrotask(() => {
      if (this.name && this.profile.stats.games === 0) this.profile.name = this.name;
      this.reply({ t: 'welcome', token: 'local', profile: this.profile, serverTime: Date.now(), features: FEATURES });
    });
  }

  private save(): void {
    try { storage()?.setItem(KEY, JSON.stringify(this.profile)); } catch { /* ignore */ }
  }

  private reply(m: S2C): void {
    queueMicrotask(() => this.emit(m));
  }

  private pushProfile(achievements: string[] = []): void {
    this.save();
    this.reply({ t: 'profile', profile: this.profile });
    for (const id of achievements) this.reply({ t: 'achievement', id });
  }

  override send(msg: C2S): void {
    const p = this.profile;
    switch (msg.t) {
      case 'hello': case 'ping': case 'cur':
        if (msg.t === 'cur' && this.room) this.room.handle(this.me, msg);
        return;
      case 'profile_update': {
        const a = editProfile(p, msg);
        this.pushProfile(a);
        if (this.room) this.room.applyOutfit(this.me, p.outfit, new Set(p.owned), p.level, COSMETIC_BY_ID[p.title]?.name, p.name);
        return;
      }
      case 'buy': {
        const r = buyItem(p, String(msg.item));
        this.pushProfile(r.achievements);
        if (!r.ok) this.reply({ t: 'error', code: 'buy_failed', msg: r.msg });
        return;
      }
      case 'shop': this.reply({ t: 'shop', shop: shopState() }); return;
      case 'records': this.reply({ t: 'records', records: recordsFor(this.content, p.records) }); return;
      case 'tutorial_done':
        if (!p.tutorialDone) { p.tutorialDone = true; this.pushProfile(grantAchievement(p, 'tutorial') ? ['tutorial'] : []); }
        return;
      case 'rooms': this.reply({ t: 'rooms', rooms: [] }); return;
      case 'import_playlist': this.reply({ t: 'playlist', ok: false, msg: 'Playlist import needs the online server.' }); return;
      case 'create': case 'quick': this.createRoom(); return;
      case 'join': this.reply({ t: 'error', code: 'offline', msg: 'Joining friends needs the online server. Play against bots here!' }); return;
      case 'leave':
        this.room?.destroy();
        this.room = null;
        this.reply({ t: 'left', reason: 'left' });
        return;
      default:
        if (this.room) this.room.handle(this.me, msg);
    }
  }

  private createRoom(): void {
    this.room?.destroy();
    const p = this.profile;
    const room = new Room('BOTS', {
      now: () => Date.now(),
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (h) => window.clearTimeout(h as number),
      rng: mulberry32((Math.random() * 2 ** 31) | 0),
      content: this.content,
      send: (pid, m) => { if (pid === this.me) this.reply(m); },
      onGameEnd: (report) => {
        const rewards = computeRewards(report, (id) => (id === p.id ? p : undefined), () => this.save());
        const mine = rewards.find((r) => r.playerId === this.me);
        this.pushProfile(mine?.achievements ?? []);
        return rewards;
      },
    }, { isPublic: false });
    const pl = room.addPlayer({ name: p.name, outfit: p.outfit, level: p.level, title: COSMETIC_BY_ID[p.title]?.name, profileId: p.id });
    if (!pl) return;
    this.room = room;
    this.me = pl.id;
    for (let i = 0; i < 3; i++) room.addBot();
  }
}

export const OFFLINE = import.meta.env.VITE_OFFLINE === '1';
