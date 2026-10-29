import { describe, expect, it } from 'vitest';
import { HOUSE_BAND_SONGS } from '../../src/content/songs/houseBand';
import { PUBLIC_DOMAIN_SONGS } from '../../src/content/songs/publicDomain';
import { ContentDB } from '../../src/shared/game/questions';
import type { ContentPack } from '../../src/shared/content';
import type { PhaseId, RoomSnapshot } from '../../src/shared/protocol';
import { makeRoom } from './helpers';

const PACK: ContentPack = {
  songs: [...PUBLIC_DOMAIN_SONGS, ...HOUSE_BAND_SONGS],
  releases: [
    { id: 'r1', title: 'Album One', artist: 'Band A', year: 1991, kind: 'album', categories: ['rock'], difficulty: 1, tracks: ['T1', 'T2', 'T3', 'T4'], emoji: '1️⃣💿' },
    { id: 'r2', title: 'Album Two', artist: 'Band B', year: 2004, kind: 'album', categories: ['rock'], difficulty: 1, tracks: ['U1', 'U2', 'U3', 'U4'] },
    { id: 'r3', title: 'Album Three', artist: 'Band C', year: 2015, kind: 'album', categories: ['pop'], difficulty: 1, tracks: ['V1', 'V2', 'V3', 'V4'] },
    { id: 'r4', title: 'Single Four', artist: 'Band D', year: 2021, kind: 'single', categories: ['pop'], difficulty: 1 },
    { id: 'r5', title: 'Album Five', artist: 'Band E', year: 1977, kind: 'album', categories: ['rock'], difficulty: 2, tracks: ['W1', 'W2', 'W3', 'W4'] },
  ],
  pop: [
    { id: 'p1', title: 'Movie One', year: 1999, kind: 'movie', categories: ['movies'], difficulty: 1, emoji: '🎬1️⃣' },
    { id: 'p2', title: 'Movie Two', year: 2010, kind: 'movie', categories: ['movies'], difficulty: 1 },
  ],
  trivia: [
    { id: 't1', categories: ['games'], difficulty: 1, prompt: 'Q1?', answer: 'A', decoys: ['B', 'C', 'D'] },
    { id: 't2', categories: ['tv'], difficulty: 1, prompt: 'Q2?', answer: 'A2', decoys: ['B2', 'C2', 'D2'], as: 'tv_theme' },
  ],
  characters: [{ id: 'c1', name: 'Hero', from: 'Game', categories: ['games'], difficulty: 1, clues: ['hard', 'mid', 'easy'], decoys: ['X', 'Y', 'Z'] }],
  quotes: [{ id: 'q1', text: 'To be or ___', answer: 'not to be', decoys: ['to see', 'free', 'a bee'], source: 'Shakespeare', categories: ['mixed'], difficulty: 1 }],
};

function lastSnap(inbox: Map<string, { t: string }[]>, id: string): RoomSnapshot | undefined {
  const msgs = inbox.get(id) ?? [];
  for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].t === 'room') return (msgs[i] as unknown as { s: RoomSnapshot }).s;
  return undefined;
}

describe('Room game loop', () => {
  it('plays a full game with humans and bots, from lobby to rematch', () => {
    const db = new ContentDB(PACK);
    const { room, clock, inbox, reports } = makeRoom(db, { rounds: 4, questionsPerRound: 2, timer: 12 });
    const host = room.addPlayer({ name: 'Hosty', profileId: 'prof1' })!;
    const guest = room.addPlayer({ name: 'Guesty', profileId: 'prof2' })!;
    room.addBot();
    room.addBot();
    expect(room.hostId).toBe(host.id);
    expect(room.active.length).toBe(4);

    // Only the host may start.
    room.handle(guest.id, { t: 'start' });
    expect(room.phase.id).toBe('lobby');
    room.handle(host.id, { t: 'start' });
    expect(room.phase.id).toBe('intro');

    const seen = new Set<PhaseId>();
    const questionKinds = new Set<string>();
    for (let step = 0; step < 4000 && !(seen.has('rematch_vote')); step++) {
      seen.add(room.phase.id);
      const ph = room.phase;
      // Humans act like players: vote and answer when they can.
      if (ph.id === 'category_vote' || ph.id === 'map_vote') {
        room.handle(host.id, { t: 'vote', target: ph.options[0].id });
        room.handle(guest.id, { t: 'vote', target: ph.options[ph.options.length - 1].id });
      }
      if (ph.id === 'question') {
        questionKinds.add(ph.q.minigame);
        // The public question must never leak the answer.
        const snap = JSON.stringify(room.snapshotFor(host.id));
        expect(snap).not.toContain('correctLabel');
        expect(snap).not.toContain('correctId');
        if (clock.now() >= ph.q.startAt) {
          for (const p of [host, guest]) {
            if (ph.q.input === 'choice') room.handle(p.id, { t: 'answer', q: ph.q.id, choice: ph.q.choices![0].id });
            else if (ph.q.input === 'year') room.handle(p.id, { t: 'answer', q: ph.q.id, year: 2000 });
            else room.handle(p.id, { t: 'answer', q: ph.q.id, text: 'twinkle' });
          }
        }
      }
      if (ph.id === 'social_setup') {
        const other = ph.targets.find((t) => t !== host.id)!;
        room.handle(host.id, { t: 'social', target: other, wager: 0 });
        room.handle(guest.id, { t: 'social', target: host.id, wager: 0 });
      }
      clock.advance(500);
    }
    for (const p of ['intro', 'map_vote', 'map_reveal', 'final_intro', 'category_vote', 'category_reveal', 'minigame_intro', 'question', 'question_reveal', 'scoreboard', 'finale', 'rewards', 'rematch_vote'] as PhaseId[]) {
      expect(seen.has(p), `phase ${p}`).toBe(true);
    }
    expect(seen.has('social_setup')).toBe(true);
    expect(reports.length).toBe(1);
    const rep = reports[0];
    expect(rep.players.length).toBe(4);
    expect(rep.players[0].isWinner).toBe(true);
    expect(rep.players[3].isToad).toBe(true);
    for (const p of room.active) expect(p.score).toBeGreaterThanOrEqual(0);
    expect(questionKinds.size).toBeGreaterThan(1);

    // Everyone votes to go back to the lobby.
    for (const p of [host, guest]) room.handle(p.id, { t: 'vote', target: 'lobby' });
    clock.advance(20000);
    expect(room.phase.id).toBe('lobby');
    expect(room.active.every((p) => p.score === 0)).toBe(true);
    expect(lastSnap(inbox, host.id)?.phase.id).toBe('lobby');
  });

  it('reconnects a dropped player to their seat and migrates the host', () => {
    const db = new ContentDB(PACK);
    const { room, clock } = makeRoom(db, { rounds: 3, questionsPerRound: 1 });
    const a = room.addPlayer({ name: 'Alpha' })!;
    const b = room.addPlayer({ name: 'Bravo' })!;
    room.handle(a.id, { t: 'start' });
    clock.advance(30000);
    const scoreBefore = room.getPlayer(b.id)!.score;
    room.disconnect(b.id);
    expect(room.getPlayer(b.id)!.connected).toBe(false);
    const back = room.reconnect(b.session);
    expect(back?.id).toBe(b.id);
    expect(back?.score).toBe(scoreBefore);

    room.disconnect(a.id);
    clock.advance(9000);
    expect(room.hostId).toBe(b.id);
    expect(room.getPlayer(b.id)!.isHost).toBe(true);
  });

  it('scores speed, streaks and rejects late or duplicate answers', () => {
    const db = new ContentDB({ ...PACK, songs: [], quotes: [], characters: [], releases: [], pop: [], trivia: Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, categories: ['games' as const], difficulty: 1 as const, prompt: `Q${i}?`, answer: 'RIGHT', decoys: ['W1', 'W2', 'W3'] })) });
    const { room, clock } = makeRoom(db, { rounds: 3, questionsPerRound: 2, categories: ['games'], minigames: ['trivia'], socialRounds: false, randomEvents: false, map: 'swamp_clubhouse' });
    const a = room.addPlayer({ name: 'Fast' })!;
    const b = room.addPlayer({ name: 'Slow' })!;
    room.handle(a.id, { t: 'start' });
    let answered = 0;
    for (let i = 0; i < 2000 && room.phase.id !== 'finale'; i++) {
      const ph = room.phase;
      if (ph.id === 'question' && clock.now() >= ph.q.startAt) {
        const right = ph.q.choices!.find((c) => c.label === 'RIGHT')!.id;
        if (!room.getPlayer(a.id)!.locked && !(room.snapshotFor(a.id).you.answer)) {
          room.handle(a.id, { t: 'answer', q: ph.q.id, choice: right });
          // A second answer is ignored.
          room.handle(a.id, { t: 'answer', q: ph.q.id, choice: ph.q.choices!.find((c) => c.label !== 'RIGHT')!.id });
          answered++;
        }
        if (clock.now() > ph.q.startAt + 6000) room.handle(b.id, { t: 'answer', q: ph.q.id, choice: right });
      }
      clock.advance(250);
    }
    const A = room.getPlayer(a.id)!;
    const B = room.getPlayer(b.id)!;
    expect(answered).toBe(6);
    expect(A.stats.correct).toBe(6);
    expect(A.stats.bestStreak).toBe(6);
    expect(A.score).toBeGreaterThan(B.score);
    expect(room.phase.id).toBe('finale');
  });
});
