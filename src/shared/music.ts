// Compact music notation used for every playable track in the game.
//
// All playable audio in LARPED ONE OUT is either an original composition or a public-domain
// composition, performed live in the browser by our own Web Audio synth band. The score format:
//
//   notes:  "E5:0.5 D#5 E5 | B4:1 r:0.5 C4+E4+G4:2"
//           pitch[:beats] — the duration is sticky (reused until changed). `r` = rest.
//           `+` joins notes into a chord. Suffix `!` accents, `?` softens.
//           `(...)x3` repeats a group. Bar lines `|` are ignored.
//   drums:  same, with names k s h o c t x (kick, snare, hat, open hat, clap, tom, crash)
//   chords: "C:4 G/B:4 Am:4 F:4" + a style; expanded into accompaniment by `expandChords`.

export type InstrumentId =
  | 'piano' | 'epiano' | 'organ' | 'strings' | 'brass' | 'flute' | 'bell' | 'celesta' | 'marimba'
  | 'pluck' | 'dist' | 'bass' | 'synthbass' | 'lead' | 'saw' | 'chip' | 'pad' | 'harpsichord'
  | 'voice' | 'whistle' | 'drums' | 'timpani';

export type ChordStyle = 'block' | 'sustain' | 'arp' | 'arp8' | 'alberti' | 'waltz' | 'oompah' | 'strum' | 'pop' | 'rock' | 'lofi' | 'bass' | 'bass8' | 'octave' | 'walking' | 'stabs';

export interface PartDef {
  inst: InstrumentId;
  notes?: string;
  chords?: string;
  style?: ChordStyle;
  /** Octave for chord voicings (default 4) / bass (default 2). */
  oct?: number;
  vol?: number;
  pan?: number;
  /** Shift the part by N semitones. */
  transpose?: number;
}

export interface SongScore {
  bpm: number;
  /** Beats per bar (for chord styles). */
  beats?: number;
  /** 0..0.5 swing on eighth notes. */
  swing?: number;
  parts: PartDef[];
}

/** [startBeat, durationBeats, midi (or drum id), velocity 0..1, partIndex] */
export type NoteEvent = [number, number, number, number, number];

export interface CompiledScore {
  bpm: number;
  lengthBeats: number;
  insts: InstrumentId[];
  vols: number[];
  pans: number[];
  events: NoteEvent[];
}

export const DRUM_IDS: Record<string, number> = { k: 1, s: 2, h: 3, o: 4, c: 5, t: 6, x: 7, l: 8 /* low tom */, b: 9 /* rim/block */ };

const NOTE_BASE: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

export function noteToMidi(name: string): number {
  const m = /^([a-gA-G])(#|b|##|bb)?(-?\d)$/.exec(name.trim());
  if (!m) throw new Error(`Bad note "${name}"`);
  let n = NOTE_BASE[m[1].toLowerCase()];
  if (m[2] === '#') n += 1;
  else if (m[2] === 'b') n -= 1;
  else if (m[2] === '##') n += 2;
  else if (m[2] === 'bb') n -= 2;
  return n + (parseInt(m[3], 10) + 1) * 12;
}

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function parseDur(s: string): number {
  if (s.includes('/')) {
    const [a, b] = s.split('/').map(Number);
    return a / b;
  }
  return Number(s);
}

function expandRepeats(src: string): string {
  // Expand innermost (...)xN groups repeatedly.
  let s = src;
  for (let guard = 0; guard < 50; guard++) {
    const next = s.replace(/\(([^()]*)\)x(\d+)/g, (_, body: string, n: string) => Array(parseInt(n, 10)).fill(body).join(' '));
    if (next === s) break;
    s = next;
  }
  return s;
}

/** Parses a melodic or drum line into [start, dur, pitch, vel] tuples. */
export function parseLine(line: string, isDrums: boolean, transpose = 0): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const tokens = expandRepeats(line).replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
  let t = 0;
  let dur = 1;
  for (const raw of tokens) {
    let tok = raw;
    let vel = 0.8;
    if (tok.endsWith('!')) { vel = 1; tok = tok.slice(0, -1); }
    else if (tok.endsWith('?')) { vel = 0.5; tok = tok.slice(0, -1); }
    const [pitchPart, durPart] = tok.split(':');
    if (durPart !== undefined && durPart !== '') dur = parseDur(durPart);
    if (!Number.isFinite(dur) || dur <= 0) throw new Error(`Bad duration in "${raw}"`);
    if (pitchPart !== 'r' && pitchPart !== '-') {
      for (const p of pitchPart.split('+')) {
        if (isDrums) {
          const id = DRUM_IDS[p];
          if (!id) throw new Error(`Bad drum "${p}"`);
          out.push([t, dur, id, vel]);
        } else {
          out.push([t, dur, noteToMidi(p) + transpose, vel]);
        }
      }
    }
    t += dur;
  }
  return out;
}

const QUALITIES: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  aug: [0, 4, 8],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '9': [0, 4, 7, 10, 14],
  add9: [0, 4, 7, 14],
  '5': [0, 7],
};

export function parseChord(sym: string): { root: number; tones: number[]; bass: number } {
  const m = /^([A-G])(#|b)?([a-z0-9]*)(?:\/([A-G])(#|b)?)?$/.exec(sym);
  if (!m) throw new Error(`Bad chord "${sym}"`);
  let root = NOTE_BASE[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  root = ((root % 12) + 12) % 12;
  const q = QUALITIES[m[3]];
  if (!q) throw new Error(`Unknown chord quality "${m[3]}" in "${sym}"`);
  let bass = root;
  if (m[4]) bass = (((NOTE_BASE[m[4].toLowerCase()] + (m[5] === '#' ? 1 : m[5] === 'b' ? -1 : 0)) % 12) + 12) % 12;
  return { root, tones: q, bass };
}

/** Expands a chord chart into note events following an accompaniment style. */
export function expandChords(chart: string, style: ChordStyle, oct: number, beatsPerBar: number, transpose = 0): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const tokens = expandRepeats(chart).replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
  let t = 0;
  let dur = beatsPerBar;
  for (const tok of tokens) {
    const [sym, d] = tok.split(':');
    if (d) dur = parseDur(d);
    if (sym === 'r' || sym === 'N') { t += dur; continue; }
    const ch = parseChord(sym);
    const base = (oct + 1) * 12 + ch.root + transpose;
    const voicing = ch.tones.map((x) => base + x);
    const bassNote = (Math.min(oct, 2) + 1) * 12 + ch.bass + transpose; // octave 2 (or lower)
    const push = (start: number, len: number, pitch: number, vel: number) => {
      if (start < t + dur - 1e-6) out.push([start, Math.min(len, t + dur - start), pitch, vel]);
    };
    switch (style) {
      case 'block':
        for (let b = 0; b < dur; b += 1) for (const p of voicing) push(t + b, 0.9, p, b % beatsPerBar === 0 ? 0.7 : 0.5);
        break;
      case 'sustain':
        for (const p of voicing) push(t, dur, p, 0.55);
        break;
      case 'stabs':
        for (let b = 0.5; b < dur; b += 1) for (const p of voicing) push(t + b, 0.3, p, 0.6);
        break;
      case 'arp': {
        const seq = [voicing[0], voicing[1], voicing[2], voicing[1]];
        let i = 0;
        for (let b = 0; b < dur; b += 0.5) push(t + b, 0.5, seq[i++ % seq.length], 0.5);
        break;
      }
      case 'arp8': {
        const up = [voicing[0], voicing[1], voicing[2], voicing[0] + 12, voicing[2], voicing[1]];
        let i = 0;
        for (let b = 0; b < dur; b += 0.5) push(t + b, 0.45, up[i++ % up.length], 0.45);
        break;
      }
      case 'alberti': {
        const seq = [voicing[0], voicing[2], voicing[1], voicing[2]];
        let i = 0;
        for (let b = 0; b < dur; b += 0.5) push(t + b, 0.5, seq[i++ % 4] - 12, 0.4);
        break;
      }
      case 'waltz':
        for (let b = 0; b < dur; b += 3) {
          push(t + b, 1, bassNote, 0.7);
          for (const p of voicing) { push(t + b + 1, 0.8, p, 0.4); push(t + b + 2, 0.8, p, 0.4); }
        }
        break;
      case 'oompah':
        for (let b = 0; b < dur; b += 2) {
          push(t + b, 1, bassNote, 0.7);
          for (const p of voicing) push(t + b + 1, 0.8, p, 0.45);
        }
        break;
      case 'strum':
        for (let b = 0; b < dur; b += 1) voicing.forEach((p, i) => push(t + b + i * 0.03, 0.9, p, b % 2 ? 0.45 : 0.6));
        break;
      case 'pop': {
        const pattern = [0, 0.75, 1.5, 2, 2.75, 3.5];
        for (let bar = 0; bar < dur; bar += 4) for (const o of pattern) for (const p of voicing) push(t + bar + o, 0.4, p, 0.45);
        break;
      }
      case 'rock':
        for (let b = 0; b < dur; b += 0.5) { push(t + b, 0.45, base, 0.8); push(t + b, 0.45, base + 7, 0.8); push(t + b, 0.45, base + 12, 0.6); }
        break;
      case 'lofi':
        for (let b = 0; b < dur; b += 2) voicing.forEach((p, i) => push(t + b + i * 0.06, 1.8, p, 0.35));
        break;
      case 'bass':
        for (let b = 0; b < dur; b += 1) push(t + b, 0.9, bassNote, b % 2 ? 0.6 : 0.8);
        break;
      case 'bass8':
        for (let b = 0; b < dur; b += 0.5) push(t + b, 0.45, bassNote, 0.7);
        break;
      case 'octave':
        for (let b = 0; b < dur; b += 0.5) push(t + b, 0.4, bassNote + ((b * 2) % 2 ? 12 : 0), 0.75);
        break;
      case 'walking': {
        const steps = [0, 4, 7, 9];
        let i = 0;
        for (let b = 0; b < dur; b += 1) push(t + b, 0.9, bassNote + steps[i++ % 4], 0.7);
        break;
      }
    }
    t += dur;
  }
  return out;
}

export function compileScore(score: SongScore): CompiledScore {
  const beats = score.beats ?? 4;
  const events: NoteEvent[] = [];
  const insts: InstrumentId[] = [];
  const vols: number[] = [];
  const pans: number[] = [];
  score.parts.forEach((part, idx) => {
    insts.push(part.inst);
    vols.push(part.vol ?? 0.7);
    pans.push(part.pan ?? 0);
    const isDrums = part.inst === 'drums';
    const notes = part.notes ? parseLine(part.notes, isDrums, part.transpose ?? 0) : [];
    const chords = part.chords ? expandChords(part.chords, part.style ?? 'block', part.oct ?? (part.style?.startsWith('bass') || part.style === 'walking' || part.style === 'octave' ? 2 : 4), beats, part.transpose ?? 0) : [];
    for (const [s, d, p, v] of [...notes, ...chords]) events.push([s, d, p, v, idx]);
  });
  if (score.swing) {
    for (const e of events) {
      const frac = e[0] % 1;
      if (Math.abs(frac - 0.5) < 1e-6) e[0] += score.swing * 0.5;
    }
  }
  events.sort((a, b) => a[0] - b[0]);
  let lengthBeats = 0;
  for (const e of events) lengthBeats = Math.max(lengthBeats, e[0] + e[1]);
  return { bpm: score.bpm, lengthBeats, insts, vols, pans, events };
}

/** A self-contained snippet of a score that clients can play without knowing which song it is. */
export interface ClipPayload {
  bpm: number;
  insts: InstrumentId[];
  vols: number[];
  pans: number[];
  events: NoteEvent[];
  /** Clip length in beats. */
  len: number;
  /** Playback rate multiplier (speed-up rounds). */
  rate?: number;
  reverse?: boolean;
}

export function extractClip(c: CompiledScore, startBeat: number, endBeat: number, opts: { rate?: number; reverse?: boolean } = {}): ClipPayload {
  const events: NoteEvent[] = [];
  for (const e of c.events) {
    const s = e[0];
    const end = s + e[1];
    if (end <= startBeat + 1e-6 || s >= endBeat - 1e-6) continue;
    const ns = Math.max(s, startBeat);
    const ne = Math.min(end, endBeat);
    events.push([+(ns - startBeat).toFixed(4), +(ne - ns).toFixed(4), e[2], e[3], e[4]]);
  }
  return { bpm: c.bpm, insts: c.insts, vols: c.vols, pans: c.pans, events, len: endBeat - startBeat, ...opts };
}

export function beatsToSec(beats: number, bpm: number): number {
  return (beats * 60) / bpm;
}

export function secToBeats(sec: number, bpm: number): number {
  return (sec * bpm) / 60;
}

export interface LyricLine {
  beat: number;
  text: string;
}
