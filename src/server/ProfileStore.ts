// Persistent player profiles. Uses Node's built-in SQLite (node:sqlite) so there are no native
// dependencies to compile; falls back to an in-memory map if SQLite is unavailable.

import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_OUTFIT, STARTER_ITEMS } from '../shared/cosmetics';
import { STARTING_COINS } from '../shared/progression';
import type { ProfilePrivate } from '../shared/protocol';

interface Backend {
  get(tokenHash: string): string | undefined;
  getById(id: string): { data: string; hash: string } | undefined;
  put(id: string, tokenHash: string, data: string): void;
}

function sha(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

async function sqliteBackend(file: string): Promise<Backend | null> {
  try {
    const { DatabaseSync } = await import('node:sqlite');
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    const db = new DatabaseSync(file);
    db.exec(`PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        token_hash TEXT UNIQUE NOT NULL,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );`);
    const get = db.prepare('SELECT data FROM profiles WHERE token_hash = ?');
    const getById = db.prepare('SELECT data, token_hash FROM profiles WHERE id = ?');
    const put = db.prepare(`INSERT INTO profiles (id, token_hash, data, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`);
    return {
      get: (h) => (get.get(h) as { data: string } | undefined)?.data,
      getById: (id) => { const r = getById.get(id) as { data: string; token_hash: string } | undefined; return r ? { data: r.data, hash: r.token_hash } : undefined; },
      put: (id, h, data) => { put.run(id, h, data, Date.now()); },
    };
  } catch (err) {
    console.warn('[profiles] SQLite unavailable, using in-memory profiles:', (err as Error).message);
    return null;
  }
}

function memoryBackend(): Backend {
  const byHash = new Map<string, string>();
  const byId = new Map<string, { hash: string; data: string }>();
  return {
    get: (h) => { const id = byHash.get(h); return id ? byId.get(id)?.data : undefined; },
    getById: (id) => byId.get(id),
    put: (id, h, data) => { byHash.set(h, id); byId.set(id, { hash: h, data }); },
  };
}

export function newProfile(name = 'Froggo'): ProfilePrivate {
  return {
    id: randomBytes(8).toString('hex'),
    name,
    coins: STARTING_COINS,
    xp: 0,
    level: 1,
    outfit: { ...DEFAULT_OUTFIT, emotes: DEFAULT_OUTFIT.emotes.slice() },
    owned: STARTER_ITEMS.slice(),
    title: 'title_rookie',
    banner: 'banner_swamp',
    stats: { games: 0, wins: 0, toads: 0, podiums: 0, answered: 0, correct: 0, bestStreak: 0, lyricsCorrect: 0, categories: {}, mapsPlayed: [], fastestMs: null },
    achievements: {},
    records: [],
    artists: [],
    trophies: [],
    scrapbook: [
      { sticker: 'stk_lily', x: 0.18, y: 0.78, r: -12 },
      { sticker: 'stk_note', x: 0.82, y: 0.2, r: 10 },
    ],
    tutorialDone: false,
    createdAt: Date.now(),
  };
}

/** Fills in fields added after a profile was first saved. */
function migrate(p: ProfilePrivate): ProfilePrivate {
  const base = newProfile(p.name);
  return {
    ...base,
    ...p,
    outfit: { ...base.outfit, ...p.outfit },
    stats: { ...base.stats, ...p.stats },
    owned: [...new Set([...STARTER_ITEMS, ...(p.owned ?? [])])],
  };
}

export class ProfileStore {
  private backend: Backend = memoryBackend();
  private tokenHashById = new Map<string, string>();
  private cache = new Map<string, ProfilePrivate>();

  async init(file: string): Promise<void> {
    this.backend = (await sqliteBackend(file)) ?? memoryBackend();
  }

  /** Returns the profile for a token, creating a fresh one (and token) when needed. */
  login(token: string | undefined, name?: string): { token: string; profile: ProfilePrivate } {
    if (token && typeof token === 'string' && token.length >= 20 && token.length <= 100) {
      const hash = sha(token);
      const raw = this.backend.get(hash);
      if (raw) {
        const profile = migrate(JSON.parse(raw) as ProfilePrivate);
        this.cache.set(profile.id, profile);
        this.tokenHashById.set(profile.id, hash);
        return { token, profile };
      }
    }
    const fresh = randomBytes(24).toString('base64url');
    const profile = newProfile(name);
    const hash = sha(fresh);
    this.tokenHashById.set(profile.id, hash);
    this.cache.set(profile.id, profile);
    this.backend.put(profile.id, hash, JSON.stringify(profile));
    return { token: fresh, profile };
  }

  get(id: string): ProfilePrivate | undefined {
    const cached = this.cache.get(id);
    if (cached) return cached;
    const raw = this.backend.getById(id);
    if (!raw) return undefined;
    const p = migrate(JSON.parse(raw.data) as ProfilePrivate);
    this.cache.set(id, p);
    this.tokenHashById.set(id, raw.hash);
    return p;
  }

  save(p: ProfilePrivate): void {
    this.cache.set(p.id, p);
    const hash = this.tokenHashById.get(p.id);
    if (hash) this.backend.put(p.id, hash, JSON.stringify(p));
  }
}
