// DJ Lilypadd's Frog School: a real (short) game against practice bots, run entirely in the browser by
// the same Room engine the server uses. Explanation phases wait for "Next" so nobody gets rushed.

import { HOUSE_BAND_SONGS } from '../../content/songs/houseBand';
import { PUBLIC_DOMAIN_SONGS } from '../../content/songs/publicDomain';
import { MINIGAME_BY_ID } from '../../shared/catalog';
import type { Outfit } from '../../shared/cosmetics';
import { Room } from '../../shared/game/Room';
import { ContentDB } from '../../shared/game/questions';
import type { C2S, Phase, RoomSnapshot, S2C } from '../../shared/protocol';
import { mulberry32 } from '../../shared/rng';
import { audio } from '../audio/AudioEngine';
import type { Transport } from '../net/Net';
import { h } from '../ui/dom';
import type { Hud } from '../ui/Hud';

type Handler = (m: S2C) => void;

/** In-browser stand-in for the WebSocket connection. */
export class LocalNet implements Transport {
  private handlers = new Map<string, Set<Handler>>();
  room: Room | null = null;
  me = '';
  readonly online = true;

  send(msg: C2S): void {
    if (msg.t === 'leave') { this.emit({ t: 'left', reason: 'tutorial' }); return; }
    if (msg.t === 'ping' || !this.room || !this.me) return;
    this.room.handle(this.me, msg);
  }

  on<T extends S2C['t']>(t: T, fn: (msg: Extract<S2C, { t: T }>) => void): () => void {
    const set = this.handlers.get(t) ?? new Set();
    set.add(fn as Handler);
    this.handlers.set(t, set);
    return () => set.delete(fn as Handler);
  }

  emit(msg: S2C): void {
    for (const fn of this.handlers.get(msg.t) ?? []) {
      try { fn(msg); } catch (err) { console.error(err); }
    }
  }

  serverNow(): number {
    return Date.now();
  }
}

let db: ContentDB | null = null;

function tutorialContent(): ContentDB {
  db ??= new ContentDB({ songs: [...HOUSE_BAND_SONGS, ...PUBLIC_DOMAIN_SONGS], releases: [], pop: [], trivia: [], characters: [], quotes: [] });
  return db;
}

/** What DJ Lilypadd says in each phase. `wait` phases hold until the player taps Next. */
function lesson(ph: Phase, step: { voted: boolean }): { text: string; wait: boolean } | null {
  switch (ph.id) {
    case 'intro': return { text: 'Yo yo yo! Welcome to Frog School. I\'m DJ Lilypadd. This is a real mini-game against three practice bots — let\'s learn by playing!', wait: true };
    case 'map_vote': return { text: 'First, everyone votes for a map. Move your glove cursor over the table and click a map. Everyone\'s cursors are visible — you can change your vote until the timer runs out.', wait: false };
    case 'map_reveal': return { text: 'Ties are settled by spinning the bottle. Each map has its own lighting, music and my outfit changes too. 😎', wait: true };
    case 'round_intro': return { text: ph.final ? 'FINAL ROUND! Points are doubled, so last place can still climb out of the toad zone.' : 'Every round, the table votes a category, then I pick a minigame to fit it.', wait: true };
    case 'final_intro': return { text: 'FINAL ROUND! Points are doubled, so last place can still climb out of the toad zone.', wait: true };
    case 'category_vote': return { text: 'Vote for a category with your glove. Popular picks win; the bottle breaks ties.', wait: false };
    case 'category_reveal': return { text: 'The category is set! Every song you hear in a game goes onto the record shelf in your cabin.', wait: true };
    case 'minigame_intro': {
      const mg = MINIGAME_BY_ID[ph.minigame];
      return { text: `This round is ${mg?.name ?? 'a minigame'}. ${mg?.howTo ?? ''}`, wait: true };
    }
    case 'question': return step.voted
      ? { text: 'Locked in! You can still change your mind until the timer ends.', wait: false }
      : { text: 'Listen and click the right answer. Faster correct answers score more, and streaks give bonus points. Music is played live by my synth — every song is public domain or our own CC0 original.', wait: false };
    case 'question_reveal': return { text: 'Green = correct. Points fly up next to each frog. Speed, streaks and comeback bonuses all count.', wait: true };
    case 'scoreboard': return { text: 'The chalkboard keeps score after every round. Notice the frog in last place sweating? They\'re in danger of being LARPED ONE OUT…', wait: true };
    case 'finale': return { text: 'At the end, the lights go out and the last-place frog is exposed as an ugly toad. The winner takes the golden lily-pad throne!', wait: true };
    case 'rewards': return { text: 'Every game earns coins and XP — spend coins at Mossy\'s stall on hats, chains, jackets and more. No real money, ever.', wait: true };
    case 'rematch_vote': return { text: 'That\'s it — class dismissed! 🎓 Host a party from the table in your cabin and send the code or QR to your friends.', wait: false };
    default: return null;
  }
}

export class Tutorial {
  readonly net = new LocalNet();
  private room: Room;
  private box: HTMLElement;
  private text: HTMLElement;
  private next: HTMLButtonElement;
  private unsub: (() => void)[] = [];
  private phaseKey = '';
  private finished = false;
  private stopped = false;
  private step = { voted: false };

  constructor(private hud: Hud, private opts: { name: string; outfit: Outfit; level: number; onDone(): void; onExit(): void }) {
    const net = this.net;
    const timers = new Set<number>();
    this.room = new Room('FROG', {
      now: () => Date.now(),
      setTimer: (fn, ms) => { const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; },
      clearTimer: (id) => { window.clearTimeout(id as number); timers.delete(id as number); },
      rng: mulberry32((Math.random() * 2 ** 31) | 0),
      content: tutorialContent(),
      send: (pid, msg) => { if (pid === net.me) queueMicrotask(() => net.emit(msg)); },
      onGameEnd: (report) => {
        // Real coins for the tutorial are granted by the server when the tutorial is reported done.
        const me = report.players.find((p) => p.id === net.me);
        return me ? [{ playerId: me.id, coins: 0, xp: 0, levelBefore: opts.level, levelAfter: opts.level, achievements: [], unlocked: [], records: [] }] : [];
      },
    }, {
      rounds: 2, questionsPerRound: 2, timer: 20, difficulty: 'easy',
      categories: ['classical', 'singalong', 'house_band'], minigames: ['guess_song', 'finish_lyrics'],
      socialRounds: false, randomEvents: false, typedAnswers: false, comeback: true, finalDouble: true,
      map: 'vote', isPublic: false, maxPlayers: 4,
    });
    this.room.holdPhases = true;
    this.text = h('div', { class: 'tut-text' });
    this.next = h('button', { class: 'btn gold small', onclick: () => this.advance() }, 'Next ▶') as HTMLButtonElement;
    this.box = h('div', { class: 'tutorial-box chalk card-pop' },
      h('div', { class: 'tut-dj', 'aria-hidden': 'true' }, '🎧🐸'),
      h('div', { class: 'grow' }, h('div', { class: 'tut-name' }, 'DJ LILYPADD · FROG SCHOOL'), this.text),
      h('div', { class: 'col', style: { gap: '4px' } }, this.next, h('button', { class: 'btn wood small', onclick: () => this.exit() }, 'Quit')));
    this.unsub.push(net.on('room', (m) => this.onRoom(m.s)));
  }

  start(): void {
    const p = this.room.addPlayer({ name: this.opts.name, outfit: this.opts.outfit, level: this.opts.level });
    if (!p) return;
    this.net.room = this.room;
    this.net.me = p.id;
    for (let i = 0; i < 3; i++) this.room.addBot();
    this.hud.topLayer.appendChild(this.box);
    this.room.startGame();
  }

  private onRoom(s: RoomSnapshot): void {
    const key = `${s.phase.id}:${s.phaseStart}`;
    const ph = s.phase;
    if (ph.id === 'question') this.step.voted = Boolean(s.you.answer);
    const changed = key !== this.phaseKey;
    this.phaseKey = key;
    if (changed && ph.id === 'question') this.step.voted = false;
    const l = lesson(ph, this.step);
    if (!l) return;
    if (changed || ph.id === 'question') {
      if (this.text.textContent !== l.text) {
        this.text.textContent = l.text;
        if (changed) audio.babble(l.text.slice(0, 40), 1.3);
      }
    }
    const done = ph.id === 'rematch_vote';
    this.next.style.display = l.wait || done ? '' : 'none';
    this.next.textContent = done ? '🎓 Finish' : 'Next ▶';
    this.next.classList.toggle('pulse', l.wait);
    if ((ph.id === 'rewards' || done) && !this.finished) {
      this.finished = true;
      this.opts.onDone();
    }
  }

  private advance(): void {
    audio.sfx('click');
    if (this.room.phase.id === 'rematch_vote') { this.exit(); return; }
    this.room.resume();
  }

  exit(): void {
    if (this.stopped) return;
    this.stop();
    this.opts.onExit();
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const u of this.unsub) u();
    this.unsub = [];
    this.box.remove();
    this.room.destroy();
    this.net.room = null;
  }
}
