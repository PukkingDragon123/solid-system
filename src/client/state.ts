// Client-side state container with tiny pub/sub.

import type { ProfilePrivate, RecordInfo, RoomSnapshot, ServerFeatures, ShopState } from '../shared/protocol';
import type { Transport } from './net/Net';
import { storage } from './net/Net';

export interface Settings {
  music: number;
  sfx: number;
  quality: 'low' | 'medium' | 'high';
  reduceMotion: boolean;
  name: string;
}

const SETTINGS_KEY = 'loo_settings';

function loadSettings(): Settings {
  const def: Settings = { music: 0.7, sfx: 0.8, quality: 'medium', reduceMotion: false, name: '' };
  try {
    const raw = storage()?.getItem(SETTINGS_KEY);
    if (raw) return { ...def, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) def.reduceMotion = true;
  if (/Mobi|Android/i.test(navigator.userAgent)) def.quality = 'low';
  return def;
}

type Key = 'profile' | 'room' | 'shop' | 'records' | 'settings' | 'features' | 'net';

class Store {
  profile: ProfilePrivate | null = null;
  room: RoomSnapshot | null = null;
  prevRoom: RoomSnapshot | null = null;
  shop: ShopState | null = null;
  records: RecordInfo[] = [];
  features: ServerFeatures | null = null;
  settings: Settings = loadSettings();
  net!: Transport;
  private subs = new Map<Key, Set<() => void>>();

  on(key: Key, fn: () => void): () => void {
    const set = this.subs.get(key) ?? new Set();
    set.add(fn);
    this.subs.set(key, set);
    return () => set.delete(fn);
  }

  emit(key: Key): void {
    for (const fn of this.subs.get(key) ?? []) {
      try { fn(); } catch (err) { console.error(err); }
    }
  }

  saveSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    try { storage()?.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* ignore */ }
    this.emit('settings');
  }

  get me() {
    return this.room?.players.find((p) => p.id === this.room?.you.id) ?? null;
  }

  get isHost(): boolean {
    return Boolean(this.room && this.room.hostId === this.room.you.id);
  }
}

export const store = new Store();
