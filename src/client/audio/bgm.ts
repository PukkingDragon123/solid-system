// Original background loops for menus, maps and cinematic moments (all CC0, written for this game).

import type { SongScore } from '../../shared/music';

const LOFI_DRUMS = '(k:1 h:0.5 h:0.5? s:1 h:0.5 k:0.5)';

export const BGM: Record<string, SongScore> = {
  cabin: {
    bpm: 76, swing: 0.18,
    parts: [
      { inst: 'epiano', vol: 0.45, chords: '(Fmaj7:4 Em7:4 Dm7:4 Cmaj7:4)x2', style: 'lofi', oct: 4 },
      { inst: 'bass', vol: 0.45, chords: '(Fmaj7:4 Em7:4 Dm7:4 Cmaj7:4)x2', style: 'oompah', oct: 2 },
      { inst: 'drums', vol: 0.3, notes: `${LOFI_DRUMS}x8` },
      { inst: 'celesta', vol: 0.3, notes: 'r:2 A5:1 G5:0.5 E5:0.5 | C5:2 r:2 | r:2 G5:1 F5:0.5 D5:0.5 | B4:3 r:1 | r:2 A5:1 C6:0.5 A5:0.5 | G5:2 E5:2 | F5:1 E5 D5 C5 | E5:4' },
    ],
  },
  lobby: {
    bpm: 100,
    parts: [
      { inst: 'pluck', vol: 0.4, chords: '(C:4 Am:4 F:4 G:4)x2', style: 'arp8', oct: 4 },
      { inst: 'bass', vol: 0.5, chords: '(C:4 Am:4 F:4 G:4)x2', style: 'walking' },
      { inst: 'drums', vol: 0.3, notes: '(k:1 h:0.5 h s:1 h:0.5 h)x8' },
      { inst: 'marimba', vol: 0.45, notes: 'E5:0.5 G5 C6:1 G5:0.5 E5 | A5:1 G5:0.5 E5 C5:2 | F5:0.5 A5 C6:1 A5:0.5 F5 | G5:1 B5:0.5 G5 D5:2 | E5:0.5 G5 C6:1 D6:0.5 C6 | A5:1 C6:0.5 A5 E5:2 | F5:0.5 E5 D5 C5 A4:1 C5 | B4:1 D5 G5:2' },
    ],
  },
  swamp: {
    bpm: 104,
    parts: [
      { inst: 'pluck', vol: 0.38, chords: '(C:4 Am:4 Dm:4 G:4)x2', style: 'strum', oct: 3 },
      { inst: 'bass', vol: 0.5, chords: '(C:4 Am:4 Dm:4 G:4)x2', style: 'walking' },
      { inst: 'drums', vol: 0.3, notes: '(k:1 b:0.5 b k:1 s:1)x8' },
      { inst: 'marimba', vol: 0.4, notes: 'G5:0.5 E5 C5 E5 G5:1 A5 | G5:0.5 E5 C5 A4 C5:2 | F5:0.5 D5 A4 D5 F5:1 A5 | G5:1 F5:0.5 D5 B4:2 | G5:0.5 E5 C5 E5 G5:1 C6 | B5:0.5 A5 G5 E5 A5:2 | F5:0.5 A5 D6:1 C6:0.5 A5 | G5:1 B5 C6:2' },
    ],
  },
  tavern: {
    bpm: 132, beats: 3,
    parts: [
      { inst: 'pluck', vol: 0.4, chords: '(D:3 D:3 G:3 A:3)x4', style: 'waltz', oct: 3 },
      { inst: 'flute', vol: 0.45, notes: 'A4:1 D5 F#5 | A5:2 F#5:1 | G5:1 B5 G5 | E5:2 C#5:1 | D5:1 F#5 A5 | D6:2 A5:1 | B5:1 G5 E5 | A5:3 | A4:1 D5 F#5 | A5:2 B5:1 | G5:1 E5 G5 | F#5:2 E5:1 | D5:1 E5 F#5 | G5:1 F#5 E5 | C#5:1 E5 A4 | D5:3' },
      { inst: 'drums', vol: 0.25, notes: '(k:1 b b)x16' },
    ],
  },
  rain: {
    bpm: 70,
    parts: [
      { inst: 'piano', vol: 0.45, chords: '(Am:4 F:4 C:4 G:4)x2', style: 'arp8', oct: 3 },
      { inst: 'pad', vol: 0.25, chords: '(Am:4 F:4 C:4 G:4)x2', style: 'sustain', oct: 3 },
      { inst: 'piano', vol: 0.35, notes: 'r:2 E5:1 C5 | A4:3 r:1 | r:2 F5:1 E5 | C5:3 r:1 | r:2 G5:1 E5 | C5:2 D5:2 | B4:1 C5 D5 B4 | G4:4' },
    ],
  },
  disco: {
    bpm: 118,
    parts: [
      { inst: 'synthbass', vol: 0.5, chords: '(Am:4 Dm:4 G:4 C:4)x2', style: 'octave' },
      { inst: 'strings', vol: 0.3, chords: '(Am:4 Dm:4 G:4 C:4)x2', style: 'stabs', oct: 4 },
      { inst: 'drums', vol: 0.42, notes: '(k:0.5 o k+c o k o k+c o)x8' },
      { inst: 'brass', vol: 0.3, notes: 'r:4 A5:0.5 r C6 A5 G5:1 E5 | r:4 F5:0.5 r A5 F5 E5:1 D5 | r:4 G5:0.5 r B5 G5 F5:1 D5 | r:4 E5:0.5 G5 C6:1 B5:0.5 G5 E5:1' },
    ],
  },
  arcade: {
    bpm: 140,
    parts: [
      { inst: 'chip', vol: 0.3, chords: '(Cm:4 Ab:4 Eb:4 Bb:4)x2', style: 'arp8', oct: 4 },
      { inst: 'synthbass', vol: 0.45, chords: '(Cm:4 Ab:4 Eb:4 Bb:4)x2', style: 'octave' },
      { inst: 'drums', vol: 0.35, notes: '(k:0.5 h s h k k s h)x8' },
      { inst: 'chip', vol: 0.32, notes: 'C5:0.5 Eb5 G5 C6 Bb5 G5 Eb5 G5 | Ab5:1 G5 Eb5 C5 | Bb4:0.5 Eb5 G5 Bb5 Ab5 G5 F5 Eb5 | D5:1 F5 Bb5:2 | C5:0.5 Eb5 G5 C6 D6 C6 Bb5 G5 | Ab5:1 C6 Eb6:2 | G5:0.5 F5 Eb5 G5 Bb5:1 Ab5 | G5:4' },
    ],
  },
  moon: {
    bpm: 64,
    parts: [
      { inst: 'pad', vol: 0.3, chords: '(Gmaj7:4 Em7:4 Cmaj7:4 D:4)x2', style: 'sustain', oct: 3 },
      { inst: 'celesta', vol: 0.35, notes: 'B5:1 D6 B5 A5 | G5:2 E5:2 | E5:1 G5 B5 G5 | F#5:4 | B5:1 D6 E6 D6 | B5:2 G5:2 | C6:1 B5 A5 G5 | A5:4' },
      { inst: 'bass', vol: 0.35, chords: '(Gmaj7:4 Em7:4 Cmaj7:4 D:4)x2', style: 'sustain', oct: 2 },
    ],
  },
  think: {
    bpm: 112,
    parts: [
      { inst: 'pluck', vol: 0.28, notes: '(C4:0.5 r G3 r C4 r G3 r Eb4 r C4 r G3 r Bb3 r)x4' },
      { inst: 'bass', vol: 0.35, notes: '(C2:1 r:1 C2:1 r:1 Ab1:1 r:1 G1:1 r:1)x4' },
      { inst: 'drums', vol: 0.2, notes: '(b:1 b:1 b:1 b:0.5 b:0.5)x8' },
    ],
  },
  drama: {
    bpm: 60,
    parts: [
      { inst: 'organ', vol: 0.5, chords: 'Dm:4 Bb:4 Gm:4 A7:4', style: 'sustain', oct: 3 },
      { inst: 'organ', vol: 0.5, notes: 'D5:0.25 C#5 D5:1.5 r:0.5 C5:0.25 Bb4 A4 G4 F#4:0.5 G4:1 | r:4 | D5:0.25 C#5 D5:1.5 r:0.5 C5:0.25 Bb4 A4 G4 F#4:0.5 G4:1 | A4:4' },
      { inst: 'timpani', vol: 0.7, notes: '(D2:0.125)x16 D2:2 r:6 (A1:0.125)x16 A1:2 r:2' },
    ],
  },
  chase: {
    bpm: 168,
    parts: [
      { inst: 'piano', vol: 0.5, notes: 'C5:0.5 E5 G5 E5 C5 E5 G5 A5 | G5 E5 C5 E5 D5:1 G4 | A4:0.5 C5 F5 C5 A4 C5 F5 A5 | G5 F5 E5 D5 C5:1 r | C5:0.5 E5 G5 C6 B5 A5 G5 E5 | F5 A5 C6 A5 G5:1 E5 | D5:0.5 F5 A5 F5 G5 B5 D6 B5 | C6:1 G5 C5:2' },
      { inst: 'piano', vol: 0.4, chords: 'C:4 G:4 F:4 C:4 C:4 F:4 G:4 C:4', style: 'oompah', oct: 3 },
      { inst: 'drums', vol: 0.35, notes: '(k:0.5 b s b)x16' },
    ],
  },
  victory: {
    bpm: 120,
    parts: [
      { inst: 'brass', vol: 0.6, notes: 'G4:0.33 G4 G4 C5:1 E5:0.5 G5:1.5 | E5:0.5 G5 C6:3' },
      { inst: 'strings', vol: 0.4, chords: 'C:2 G:1 C:5', style: 'sustain', oct: 4 },
      { inst: 'timpani', vol: 0.6, notes: 'C2:1 G1:1 C2:2 (C2:0.125)x16 C2:2' },
      { inst: 'drums', vol: 0.4, notes: 'r:4 x:4' },
    ],
  },
  tutorial: {
    bpm: 96,
    parts: [
      { inst: 'marimba', vol: 0.35, chords: '(F:4 C:4 Dm:4 Bb:4)x2', style: 'arp', oct: 4 },
      { inst: 'bass', vol: 0.4, chords: '(F:4 C:4 Dm:4 Bb:4)x2', style: 'bass' },
      { inst: 'drums', vol: 0.25, notes: '(k:1 b k s)x8' },
    ],
  },
};
