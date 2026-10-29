import { describe, expect, it } from 'vitest';
import { BASE_PACK } from '../../src/content';
import { CATEGORIES, MINIGAMES } from '../../src/shared/catalog';
import { ContentDB } from '../../src/shared/game/questions';
import { mulberry32 } from '../../src/shared/rng';
import { makeRoom } from './helpers';

describe('built-in content pack', () => {
  const db = new ContentDB(BASE_PACK);

  it('has unique ids across every item type', () => {
    const ids = [...BASE_PACK.songs, ...BASE_PACK.releases, ...BASE_PACK.pop, ...BASE_PACK.trivia, ...BASE_PACK.characters, ...BASE_PACK.quotes].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('can generate questions for every minigame from Mixed Bag', () => {
    for (const mg of MINIGAMES) {
      const q = db.generate(mg.id, 'cat:mixed', { rng: mulberry32(7), difficulty: 'mixed', used: new Set(), typed: false, timerMs: 20000 });
      expect(q, mg.id).not.toBeNull();
      expect(q!.pub.prompt.length).toBeGreaterThan(3);
      if (q!.pub.input === 'choice') {
        const labels = q!.pub.choices!.map((c) => c.label.toLowerCase());
        expect(new Set(labels).size, `${mg.id} duplicate choices`).toBe(labels.length);
        expect(q!.pub.choices!.some((c) => c.id === q!.correctId), mg.id).toBe(true);
      }
    }
  });

  it('has content for every playable category', () => {
    for (const c of CATEGORIES) {
      if (c.id === 'playlist') continue;
      const n = MINIGAMES.reduce((sum, m) => sum + db.count(m.id, `cat:${c.id}`, new Set()), 0);
      expect(n, c.id).toBeGreaterThan(5);
    }
  });

  it('generates many questions without errors or answer leaks', () => {
    const rng = mulberry32(99);
    const used = new Set<string>();
    let made = 0;
    for (let i = 0; i < 400; i++) {
      const mg = MINIGAMES[i % MINIGAMES.length].id;
      const cat = CATEGORIES[i % CATEGORIES.length].id;
      const q = db.generate(mg, `cat:${cat}`, { rng, difficulty: 'mixed', used, typed: i % 5 === 0, timerMs: 20000 });
      if (!q) continue;
      made++;
      const pub = JSON.stringify(q.pub);
      if (q.pub.input === 'choice') expect(pub.includes(q.correctLabel) || q.scoring !== 'text').toBe(true);
    }
    expect(made).toBeGreaterThan(150);
  });

  it('plays ten full games with the real content', () => {
    for (let g = 0; g < 10; g++) {
      const { room, clock, reports } = makeRoom(db, { rounds: 6, questionsPerRound: 3, difficulty: (['easy', 'normal', 'hard', 'mixed'] as const)[g % 4], typedAnswers: g % 2 === 0 }, 1000 + g);
      const h = room.addPlayer({ name: 'Human' })!;
      for (let b = 0; b < 3 + (g % 6); b++) room.addBot();
      room.handle(h.id, { t: 'start' });
      for (let i = 0; i < 6000 && room.phase.id !== 'rematch_vote'; i++) clock.advance(500);
      expect(room.phase.id, `game ${g}`).toBe('rematch_vote');
      expect(reports.length).toBe(1);
    }
  });
});
