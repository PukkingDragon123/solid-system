// Deterministic fake clock + harness for driving Room instances in tests.

import { mulberry32 } from '../../src/shared/rng';
import { Room, type RoomHooks, type GameReport } from '../../src/shared/game/Room';
import type { ContentDB } from '../../src/shared/game/questions';
import type { RoomSettings, S2C } from '../../src/shared/protocol';

export class FakeClock {
  t = 1_000_000;
  private seq = 0;
  private timers = new Map<number, { at: number; fn: () => void }>();

  now = () => this.t;
  setTimer = (fn: () => void, ms: number) => {
    const id = ++this.seq;
    this.timers.set(id, { at: this.t + Math.max(0, ms), fn });
    return id;
  };
  clearTimer = (h: unknown) => {
    this.timers.delete(h as number);
  };

  /** Advances time, firing due timers in order. */
  advance(ms: number): void {
    const end = this.t + ms;
    for (let guard = 0; guard < 200000; guard++) {
      let next: [number, { at: number; fn: () => void }] | null = null;
      for (const e of this.timers) if (e[1].at <= end && (!next || e[1].at < next[1].at || (e[1].at === next[1].at && e[0] < next[0]))) next = e;
      if (!next) break;
      this.timers.delete(next[0]);
      this.t = Math.max(this.t, next[1].at);
      next[1].fn();
    }
    this.t = end;
  }
}

export function makeRoom(content: ContentDB, settings?: Partial<RoomSettings>, seed = 42) {
  const clock = new FakeClock();
  const inbox = new Map<string, S2C[]>();
  const reports: GameReport[] = [];
  const hooks: RoomHooks = {
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    rng: mulberry32(seed),
    content,
    send: (id, msg) => {
      if (!inbox.has(id)) inbox.set(id, []);
      inbox.get(id)!.push(msg);
    },
    onGameEnd: (r) => {
      reports.push(r);
      return [];
    },
  };
  const room = new Room('TEST', hooks, settings);
  return { room, clock, inbox, reports };
}
