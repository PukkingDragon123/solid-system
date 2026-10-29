import { describe, expect, it } from 'vitest';
import { HOUSE_BAND_SONGS } from '../../src/content/songs/houseBand';
import { PUBLIC_DOMAIN_SONGS } from '../../src/content/songs/publicDomain';
import { isPlayable } from '../../src/shared/content';
import { compileScore, extractClip, noteToMidi, parseLine } from '../../src/shared/music';

const ALL = [...PUBLIC_DOMAIN_SONGS, ...HOUSE_BAND_SONGS];

describe('music notation', () => {
  it('parses notes, sticky durations, chords and repeats', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('Bb3')).toBe(58);
    const ev = parseLine('C4:0.5 D4 (E4 F4)x2 G4+B4:2 r:1 A4', false);
    expect(ev.map((e) => e[0])).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3, 6]);
    expect(ev[ev.length - 1][1]).toBe(1);
  });

  it('extracts clips relative to their start', () => {
    const c = compileScore({ bpm: 120, parts: [{ inst: 'piano', notes: 'C4:1 D4 E4 F4' }] });
    const clip = extractClip(c, 1, 3);
    expect(clip.events.map((e) => e[0])).toEqual([0, 1]);
    expect(clip.len).toBe(2);
  });
});

describe('song library', () => {
  it('has unique ids', () => {
    const ids = ALL.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const song of ALL) {
    it(`${song.id} compiles, is playable and has consistent timing`, () => {
      expect(isPlayable(song)).toBe(true);
      const c = compileScore(song.score!);
      expect(c.events.length).toBeGreaterThan(8);
      // Every part should end close to the song's end (catches sticky-duration mistakes).
      const ends = song.score!.parts.map((_, i) => Math.max(0, ...c.events.filter((e) => e[4] === i).map((e) => e[0] + e[1])));
      for (const end of ends) if (end > 16) expect(end, `part ending at ${end} vs ${c.lengthBeats}`).toBeGreaterThan(c.lengthBeats * 0.45);
      expect(c.lengthBeats).toBeLessThan(200);
      // Melodies stay in a sane range.
      for (const e of c.events) if (song.score!.parts[e[4]].inst !== 'drums') expect(e[2]).toBeGreaterThan(20), expect(e[2]).toBeLessThan(100);
      if (song.lyrics) {
        for (let i = 1; i < song.lyrics.length; i++) expect(song.lyrics[i].beat).toBeGreaterThan(song.lyrics[i - 1].beat);
        for (const g of song.gaps ?? []) {
          const line = song.lyrics[g.line];
          expect(line, `gap line ${g.line}`).toBeTruthy();
          expect(line.text.toLowerCase()).toContain(g.answer.toLowerCase());
          const next = song.lyrics[g.line + 1]?.beat ?? c.lengthBeats;
          expect(g.cut).toBeGreaterThanOrEqual(line.beat);
          expect(g.cut).toBeLessThan(next);
          expect(g.decoys.length).toBeGreaterThanOrEqual(3);
          expect(g.decoys.map((d) => d.toLowerCase())).not.toContain(g.answer.toLowerCase());
        }
      }
      if (song.hook) expect(song.hook[0]).toBeLessThan(c.lengthBeats);
    });
  }
});
