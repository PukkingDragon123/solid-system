// Owns every live room: short join codes, public matchmaking, socket ↔ player routing and rewards.

import { randomInt } from 'node:crypto';
import type { WebSocket } from 'ws';
import { mulberry32 } from '../shared/rng';
import { COSMETIC_BY_ID } from '../shared/cosmetics';
import type { C2S, ProfilePrivate, PublicRoomInfo, RoomSettings, S2C } from '../shared/protocol';
import { Room } from '../shared/game/Room';
import type { ContentDB } from '../shared/game/questions';
import { computeRewards } from './economy';
import type { ProfileStore } from './ProfileStore';

const CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';
const MAX_ROOMS = 2000;

export interface Client {
  ws: WebSocket;
  profile: ProfilePrivate | null;
  token: string | null;
  room: Room | null;
  playerId: string | null;
  send(msg: S2C): void;
}

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  private clientsByPlayer = new Map<string, Client>();

  constructor(private content: () => ContentDB, private profiles: ProfileStore) {}

  private newCode(): string {
    for (let attempt = 0; attempt < 200; attempt++) {
      let code = '';
      for (let i = 0; i < 4; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Could not allocate a room code');
  }

  private makeRoom(settings?: Partial<RoomSettings>): Room {
    if (this.rooms.size >= MAX_ROOMS) throw new Error('Server is full — try again in a minute.');
    const code = this.newCode();
    const rng = mulberry32(randomInt(2 ** 31));
    const room: Room = new Room(code, {
      now: () => Date.now(),
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as NodeJS.Timeout),
      rng,
      content: this.content(),
      send: (playerId, msg) => this.clientsByPlayer.get(playerId)?.send(msg),
      onGameEnd: (report) => {
        const rewards = computeRewards(report, (id) => this.profiles.get(id), (p) => this.profiles.save(p));
        // Push refreshed profiles + achievement toasts to everyone who played.
        for (const r of rewards) {
          const c = this.clientsByPlayer.get(r.playerId);
          if (c?.profile) {
            const fresh = this.profiles.get(c.profile.id);
            if (fresh) { c.profile = fresh; c.send({ t: 'profile', profile: fresh }); }
            for (const a of r.achievements) c.send({ t: 'achievement', id: a });
          }
        }
        return rewards;
      },
      onEmpty: () => this.destroy(code),
    }, settings);
    this.rooms.set(code, room);
    return room;
  }

  destroy(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    room.destroy();
    for (const p of room.players) {
      const c = this.clientsByPlayer.get(p.id);
      if (c && c.room === room) { c.room = null; c.playerId = null; }
      this.clientsByPlayer.delete(p.id);
    }
    this.rooms.delete(code);
  }

  private seat(c: Client, room: Room): boolean {
    const p = c.profile!;
    const player = room.addPlayer({
      name: p.name,
      outfit: p.outfit,
      level: p.level,
      title: COSMETIC_BY_ID[p.title]?.name,
      profileId: p.id,
    });
    if (!player) {
      c.send({ t: 'error', code: 'room_full', msg: 'That party is full (12 frogs max).' });
      return false;
    }
    c.room = room;
    c.playerId = player.id;
    this.clientsByPlayer.set(player.id, c);
    room.sendSnapshot(player.id, true);
    return true;
  }

  leave(c: Client): void {
    if (c.room && c.playerId) {
      c.room.removePlayer(c.playerId);
      this.clientsByPlayer.delete(c.playerId);
    }
    c.room = null;
    c.playerId = null;
  }

  onClose(c: Client): void {
    if (c.room && c.playerId) {
      if (this.clientsByPlayer.get(c.playerId) === c) {
        c.room.disconnect(c.playerId);
      }
    }
  }

  create(c: Client, settings?: Partial<RoomSettings>): void {
    this.leave(c);
    try {
      const room = this.makeRoom(settings);
      this.seat(c, room);
    } catch (err) {
      c.send({ t: 'error', code: 'create_failed', msg: (err as Error).message });
    }
  }

  join(c: Client, rawCode: string, session?: string): void {
    const code = String(rawCode ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    const room = this.rooms.get(code);
    if (!room) {
      c.send({ t: 'error', code: 'no_room', msg: `No party with code ${code || '????'}. Check the code and try again!` });
      return;
    }
    // Reconnect to an existing seat (page refresh, flaky phone signal...).
    if (session) {
      const existing = room.findBySession(session);
      if (existing) {
        const old = this.clientsByPlayer.get(existing.id);
        if (old && old !== c) { old.room = null; old.playerId = null; }
        if (c.room && c.room !== room) this.leave(c);
        c.room = room;
        c.playerId = existing.id;
        this.clientsByPlayer.set(existing.id, c);
        room.reconnect(session);
        if (c.profile) room.applyOutfit(existing.id, c.profile.outfit, new Set(c.profile.owned), c.profile.level, COSMETIC_BY_ID[c.profile.title]?.name);
        room.sendSnapshot(existing.id, true);
        return;
      }
    }
    if (c.room === room && c.playerId) { room.sendSnapshot(c.playerId, true); return; }
    this.leave(c);
    if (room.inGame()) {
      c.send({ t: 'error', code: 'in_progress', msg: 'That game already started — wait for the rematch lobby or start your own party!' });
      return;
    }
    this.seat(c, room);
  }

  quick(c: Client): void {
    const open = [...this.rooms.values()].filter((r) => r.settings.isPublic && !r.inGame() && !r.isFull() && r.humans.length > 0);
    open.sort((a, b) => b.humans.length - a.humans.length);
    if (open.length) { this.join(c, open[0].code); return; }
    this.create(c, { isPublic: true });
  }

  publicRooms(): PublicRoomInfo[] {
    return [...this.rooms.values()]
      .filter((r) => r.settings.isPublic && r.humans.length > 0)
      .map((r) => r.info())
      .slice(0, 30);
  }

  route(c: Client, msg: C2S): void {
    if (!c.room || !c.playerId) return;
    c.room.handle(c.playerId, msg);
  }

  /** Re-sync a player's look after they change outfit/name in the cabin. */
  refreshPlayer(c: Client): void {
    if (c.room && c.playerId && c.profile) {
      c.room.applyOutfit(c.playerId, c.profile.outfit, new Set(c.profile.owned), c.profile.level, COSMETIC_BY_ID[c.profile.title]?.name, c.profile.name);
    }
  }

  stats() {
    let players = 0;
    for (const r of this.rooms.values()) players += r.humans.length;
    return { rooms: this.rooms.size, players };
  }
}
