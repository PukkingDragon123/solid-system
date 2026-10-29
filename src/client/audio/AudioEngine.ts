// The game's sound system: buses, reverb, synced clip playback, background music, SFX and frog babble.

import { beatsToSec, compileScore, type ClipPayload, type CompiledScore, type InstrumentId } from '../../shared/music';
import { BGM } from './bgm';
import { playDrum, playNote, voicesFor, type Voices } from './instruments';

type Ctx = AudioContext;

export interface ClipHandle {
  stop(): void;
}

function impulse(ctx: BaseAudioContext, seconds = 1.8, decay = 3): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

/** Schedules every event of a compiled score/clip into a destination. */
function scheduleEvents(v: Voices, c: { bpm: number; insts: InstrumentId[]; vols: number[]; pans: number[]; events: [number, number, number, number, number][] }, t0: number, dest: AudioNode, from = 0, to = Infinity): number {
  const ctx = v.ctx;
  const spb = 60 / c.bpm;
  const partOut = c.insts.map((_, i) => {
    const g = ctx.createGain();
    g.gain.value = c.vols[i] ?? 0.7;
    const p = ctx.createStereoPanner();
    p.pan.value = c.pans[i] ?? 0;
    g.connect(p).connect(dest);
    return g;
  });
  let end = t0;
  for (const [s, d, m, vel, pi] of c.events) {
    if (s < from || s >= to) continue;
    const t = t0 + (s - from) * spb;
    const inst = c.insts[pi];
    const e = inst === 'drums' ? playDrum(v, m, t, vel, partOut[pi]) : playNote(v, inst, m, t, d * spb, vel, partOut[pi]);
    end = Math.max(end, e);
  }
  return end;
}

export class AudioEngine {
  ctx: Ctx | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private clipBus!: GainNode;
  private reverb!: ConvolverNode;
  private voices!: Voices;
  private musicVol = 0.7;
  private sfxVol = 0.8;
  private bufferCache = new Map<string, Promise<AudioBuffer>>();
  private current: { key: string; comp: CompiledScore; gain: GainNode; nextBeat: number; startTime: number; loop: boolean } | null = null;
  private scheduler = 0;
  private duckLevel = 1;
  private beatStart = 0;
  private beatSpb = 0.5;
  private analyser: AnalyserNode | null = null;
  unlocked = false;

  /** Must be called from a user gesture (browsers block audio until then). */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC({ latencyHint: 'interactive' });
      this.ctx = ctx;
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3;
      this.master.connect(comp).connect(ctx.destination);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.musicBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.clipBus = ctx.createGain();
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = impulse(ctx);
      const wet = ctx.createGain();
      wet.gain.value = 0.18;
      this.reverb.connect(wet).connect(this.master);
      for (const b of [this.musicBus, this.sfxBus, this.clipBus]) { b.connect(this.master); b.connect(this.reverb); }
      this.musicBus.connect(this.analyser);
      this.clipBus.connect(this.analyser);
      this.voices = voicesFor(ctx);
      this.setVolumes(this.musicVol, this.sfxVol);
      this.scheduler = window.setInterval(() => this.tick(), 90);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.unlocked = true;
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(music * 0.55 * this.duckLevel, t, 0.05);
    this.clipBus.gain.setTargetAtTime(Math.max(music, 0.35) * 0.9, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(sfx * 0.7, t, 0.05);
  }

  /** Lower (or restore) background music while clips play or the DJ talks. */
  duck(level: number): void {
    this.duckLevel = level;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(this.musicVol * 0.55 * level, this.ctx.currentTime, 0.15);
  }

  /** Converts a local wall-clock ms timestamp to AudioContext time. */
  ctxTimeAt(localMs: number): number {
    if (!this.ctx) return 0;
    return this.ctx.currentTime + (localMs - performance.timeOrigin - performance.now()) / 1000;
  }

  // ───────────────────────── background music ─────────────────────────

  playMusic(key: string, loop = true): void {
    if (!this.ctx) return;
    if (this.current?.key === key) return;
    this.stopMusic(0.6);
    const score = BGM[key];
    if (!score) return;
    const comp = compileScore(score);
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(1, this.ctx.currentTime + 0.8);
    gain.connect(this.musicBus);
    const start = this.ctx.currentTime + 0.1;
    this.current = { key, comp, gain, nextBeat: 0, startTime: start, loop };
    this.beatStart = start;
    this.beatSpb = 60 / comp.bpm;
  }

  stopMusic(fade = 0.4): void {
    if (!this.current || !this.ctx) return;
    const g = this.current.gain;
    g.gain.cancelScheduledValues(this.ctx.currentTime);
    g.gain.setValueAtTime(g.gain.value, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + fade);
    window.setTimeout(() => g.disconnect(), fade * 1000 + 200);
    this.current = null;
  }

  get musicKey(): string | null {
    return this.current?.key ?? null;
  }

  private tick(): void {
    const cur = this.current;
    if (!cur || !this.ctx) return;
    const spb = 60 / cur.comp.bpm;
    const horizon = this.ctx.currentTime + 0.35;
    while (cur.startTime + cur.nextBeat * spb < horizon) {
      const from = cur.nextBeat;
      const to = from + 1;
      scheduleEvents(this.voices, cur.comp, cur.startTime + from * spb, cur.gain, from, to);
      cur.nextBeat = to;
      if (cur.nextBeat >= cur.comp.lengthBeats - 1e-6) {
        if (!cur.loop) { this.current = null; return; }
        cur.startTime += Math.ceil(cur.comp.lengthBeats) * spb;
        cur.nextBeat = 0;
      }
    }
  }

  /** 0..1 pulse on each musical beat (for speakers, DJ bobbing, lights). */
  beat(): number {
    if (!this.ctx || !this.current) return 0;
    const t = (this.ctx.currentTime - this.beatStart) / this.beatSpb;
    const f = t - Math.floor(t);
    return Math.max(0, 1 - f * 3) * this.duckLevel;
  }

  level(): number {
    if (!this.analyser) return 0;
    const d = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(d);
    let s = 0;
    for (let i = 0; i < 16; i++) s += d[i];
    return s / (16 * 255);
  }

  // ───────────────────────── question clips ─────────────────────────

  /** Renders a synth clip offline so it can be reversed, sped up and started sample-accurately. */
  renderClip(clip: ClipPayload): Promise<AudioBuffer> {
    const key = JSON.stringify([clip.bpm, clip.len, clip.events.length, clip.events.slice(0, 6), clip.insts]);
    let p = this.bufferCache.get(key);
    if (!p) {
      const sr = 44100;
      const seconds = beatsToSec(clip.len, clip.bpm) + 1.2;
      const off = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr);
      const v = voicesFor(off);
      const out = off.createGain();
      out.gain.value = 0.9;
      out.connect(off.destination);
      scheduleEvents(v, clip, 0.02, out);
      p = off.startRendering().then((buf) => (clip.reverse ? reverseBuffer(buf) : buf));
      this.bufferCache.set(key, p);
      if (this.bufferCache.size > 30) this.bufferCache.delete(this.bufferCache.keys().next().value!);
    }
    return p;
  }

  loadFile(src: string, reverse = false): Promise<AudioBuffer> {
    const key = `file:${src}:${reverse}`;
    let p = this.bufferCache.get(key);
    if (!p) {
      p = fetch(src).then((r) => r.arrayBuffer()).then((ab) => this.ctx!.decodeAudioData(ab)).then((b) => (reverse ? reverseBuffer(b) : b));
      this.bufferCache.set(key, p);
    }
    return p;
  }

  /** Plays [offset, offset+len] of a buffer at ctx time `when` with an optional rate. */
  playBuffer(buf: AudioBuffer, when: number, offset: number, len: number, rate = 1, gain = 1): ClipHandle {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    const t = Math.max(ctx.currentTime, when);
    const late = Math.max(0, ctx.currentTime - when) * rate;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    const dur = Math.max(0.05, len / rate - late / rate);
    g.gain.setValueAtTime(gain, t + Math.max(0.02, dur - 0.04));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(g).connect(this.clipBus);
    src.start(t, Math.max(0, offset + late));
    src.stop(t + dur + 0.05);
    return { stop: () => { try { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.02); src.stop(ctx.currentTime + 0.1); } catch { /* already stopped */ } } };
  }

  // ───────────────────────── sound effects ─────────────────────────

  sfx(name: string, opts: { pan?: number; pitch?: number; vol?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx || !this.unlocked) return;
    const t = ctx.currentTime + 0.005;
    const out = ctx.createGain();
    out.gain.value = opts.vol ?? 1;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, opts.pan ?? 0));
    out.connect(pan).connect(this.sfxBus);
    const p = opts.pitch ?? 1;
    const tone = (type: OscillatorType, f0: number, f1: number, dur: number, vol = 0.3, at = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0 * p, t + at);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * p), t + at + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.linearRampToValueAtTime(vol, t + at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      o.connect(g).connect(out);
      o.start(t + at);
      o.stop(t + at + dur + 0.02);
    };
    const noise = (type: BiquadFilterType, fq: number, dur: number, vol = 0.25, at = 0, q = 1) => {
      const s = ctx.createBufferSource();
      s.buffer = this.voices.noise;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = fq * p;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t + at);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      s.connect(f).connect(g).connect(out);
      s.start(t + at, Math.random() * 0.5);
      s.stop(t + at + dur + 0.02);
    };
    const note = (inst: InstrumentId, midi: number, at: number, dur: number, vel = 0.8) => playNote(this.voices, inst, midi, t + at, dur, vel, out);
    switch (name) {
      case 'click': tone('square', 900, 600, 0.04, 0.12); break;
      case 'hover': tone('sine', 1200, 1400, 0.03, 0.05); break;
      case 'pop': tone('sine', 300, 900, 0.08, 0.35); noise('highpass', 3000, 0.04, 0.1); break;
      case 'lock': tone('square', 660, 660, 0.05, 0.15); tone('square', 990, 990, 0.08, 0.15, 0.05); break;
      case 'ribbit': for (let i = 0; i < 2; i++) { tone('sawtooth', 160, 120, 0.09, 0.25, i * 0.12); noise('bandpass', 600, 0.09, 0.15, i * 0.12, 4); } break;
      case 'ribbitDeep': for (let i = 0; i < 2; i++) { tone('sawtooth', 80, 55, 0.16, 0.35, i * 0.2); noise('bandpass', 300, 0.15, 0.2, i * 0.2, 4); } break;
      case 'laugh': for (let i = 0; i < 6; i++) tone('triangle', 520 - i * 20, 420 - i * 20, 0.07, 0.2, i * 0.09); break;
      case 'gasp': noise('bandpass', 1800, 0.35, 0.25, 0, 2); tone('sine', 600, 900, 0.2, 0.1); break;
      case 'sob': for (let i = 0; i < 3; i++) tone('triangle', 500, 300, 0.22, 0.15, i * 0.25); break;
      case 'aww': tone('triangle', 400, 600, 0.35, 0.2); break;
      case 'grumble': tone('sawtooth', 110, 90, 0.4, 0.2); break;
      case 'beat': note('drums', 1, 0, 0.1); note('drums', 2, 0.25, 0.1); break;
      case 'burp': tone('sawtooth', 120, 70, 0.45, 0.4); noise('lowpass', 400, 0.4, 0.2); break;
      case 'whoosh': noise('bandpass', 800, 0.35, 0.3, 0, 0.8); break;
      case 'slap': noise('highpass', 2000, 0.08, 0.4); break;
      case 'thud': tone('sine', 120, 50, 0.2, 0.5); noise('lowpass', 300, 0.15, 0.3); break;
      case 'boing': tone('sine', 200, 600, 0.25, 0.3); break;
      case 'hmm': tone('triangle', 300, 280, 0.4, 0.15); break;
      case 'party': tone('sawtooth', 440, 880, 0.3, 0.15); noise('highpass', 4000, 0.3, 0.15); break;
      case 'ding': note('bell', 84, 0, 0.6, 0.9); note('bell', 91, 0.08, 0.8, 0.7); break;
      case 'correct': note('marimba', 72, 0, 0.1); note('marimba', 76, 0.08, 0.1); note('marimba', 79, 0.16, 0.1); note('bell', 84, 0.24, 0.6); break;
      case 'wrong': tone('square', 220, 200, 0.18, 0.12); tone('square', 160, 140, 0.3, 0.12, 0.18); break;
      case 'tick': tone('square', 1500, 1500, 0.02, 0.06); break;
      case 'tickHurry': tone('square', 2000, 2000, 0.03, 0.1); break;
      case 'drumroll': for (let i = 0; i < 40; i++) playDrum(this.voices, 2, t + i * 0.05, 0.3 + (i / 40) * 0.6, out); break;
      case 'crash': playDrum(this.voices, 7, t, 1, out); playDrum(this.voices, 1, t, 1, out); break;
      case 'chalk': noise('highpass', 5000, 0.06, 0.05); break;
      case 'coin': note('chip', 88, 0, 0.06, 0.8); note('chip', 95, 0.06, 0.2, 0.8); break;
      case 'levelup': [72, 76, 79, 84, 88].forEach((m, i) => note('chip', m, i * 0.08, 0.15, 0.8)); break;
      case 'spin': for (let i = 0; i < 24; i++) tone('triangle', 300 + i * 10, 280 + i * 10, 0.04, 0.08, i * (0.05 + i * 0.008)); break;
      case 'scratch': noise('bandpass', 1500, 0.25, 0.4, 0, 3); tone('sawtooth', 600, 150, 0.2, 0.2); break;
      case 'zap': for (let i = 0; i < 8; i++) { noise('highpass', 3000, 0.05, 0.3, i * 0.06); tone('square', 900 + Math.random() * 600, 300, 0.05, 0.1, i * 0.06); } break;
      case 'gulp': tone('sine', 300, 90, 0.2, 0.4); break;
      case 'micFeedback': tone('sine', 2200, 2600, 0.8, 0.12); break;
      case 'mosquito': tone('sawtooth', 640, 700, 1.2, 0.05); break;
      case 'buzz': tone('sawtooth', 180, 220, 1.4, 0.06); break;
      case 'slurp': noise('bandpass', 900, 0.25, 0.3, 0, 6); tone('sine', 900, 300, 0.2, 0.2); break;
      case 'clap': noise('bandpass', 1300, 0.06, 0.35, 0, 1.5); break;
      case 'sus': tone('square', 330, 330, 0.12, 0.12); tone('square', 311, 311, 0.3, 0.12, 0.15); break;
      case 'riff': [52, 55, 57, 52, 55, 58, 57].forEach((m, i) => note('dist', m, i * 0.13, 0.12, 0.8)); break;
      case 'snore': noise('lowpass', 300, 0.8, 0.25); break;
      case 'bonk': tone('square', 700, 200, 0.12, 0.3); tone('sine', 1400, 300, 0.2, 0.2); noise('highpass', 2500, 0.06, 0.2); break;
      case 'squeak': tone('sine', 1200, 1800, 0.12, 0.2); break;
      case 'splash': noise('bandpass', 1200, 0.5, 0.4, 0, 0.7); break;
      case 'poof': noise('lowpass', 1200, 0.4, 0.35); tone('sine', 400, 150, 0.3, 0.15); break;
      case 'cheer': for (let i = 0; i < 6; i++) noise('bandpass', 900 + i * 200, 0.9, 0.08, i * 0.05, 1.5); break;
      case 'drama': note('organ', 38, 0, 1.6, 1); note('organ', 50, 0, 1.6, 0.8); note('organ', 53, 0, 1.6, 0.8); note('timpani', 38, 0, 1, 1); break;
      case 'magic': for (let i = 0; i < 10; i++) note('celesta', 72 + ((i * 5) % 24), i * 0.05, 0.2, 0.6); break;
      case 'transform': tone('sine', 200, 1600, 0.8, 0.2); noise('highpass', 2000, 0.8, 0.15); break;
      case 'gong': note('bell', 36, 0, 3, 1); note('bell', 43, 0, 3, 0.6); break;
      case 'chalkwrite': noise('highpass', 6000, 0.1, 0.06); break;
      case 'countdown': tone('square', 880, 880, 0.12, 0.15); break;
      case 'go': tone('square', 1320, 1320, 0.3, 0.18); break;
      case 'buy': note('chip', 76, 0, 0.08); note('chip', 83, 0.08, 0.08); note('chip', 88, 0.16, 0.25); break;
      case 'error': tone('square', 180, 150, 0.25, 0.15); break;
      case 'swap': tone('triangle', 500, 800, 0.08, 0.2); break;
      case 'record': note('epiano', 60, 0, 0.3); note('epiano', 64, 0.1, 0.3); note('epiano', 67, 0.2, 0.5); break;
      case 'fire': noise('lowpass', 800, 0.6, 0.2); for (let i = 0; i < 5; i++) noise('highpass', 4000, 0.03, 0.15, Math.random() * 0.5); break;
      case 'strum': [52, 56, 59, 64, 68].forEach((m, i) => note('pluck', m, i * 0.025, 1.2, 0.8)); break;
      case 'cuckoo': note('flute', 79, 0, 0.25); note('flute', 76, 0.3, 0.4); break;
      case 'squish': tone('sine', 300, 120, 0.15, 0.3); noise('lowpass', 900, 0.15, 0.2); break;
      default: tone('sine', 600, 600, 0.05, 0.1);
    }
  }

  /** Animal-Crossing-style frog babble for DJ lines (one blip per letter-ish). */
  babble(text: string, pitch = 1): number {
    const ctx = this.ctx;
    if (!ctx || !this.unlocked) return 0;
    const t0 = ctx.currentTime + 0.02;
    const chars = text.replace(/[^a-zA-Z]/g, '').slice(0, 60);
    const step = 0.055;
    const out = ctx.createGain();
    out.gain.value = 0.16;
    out.connect(this.sfxBus);
    for (let i = 0; i < chars.length; i += 2) {
      const c = chars.charCodeAt(i) | 32;
      const vowel = 'aeiou'.includes(String.fromCharCode(c));
      const f = (180 + ((c * 37) % 9) * 22) * pitch * (vowel ? 1.25 : 1);
      const o = ctx.createOscillator();
      o.type = 'square';
      const t = t0 + (i / 2) * step;
      o.frequency.setValueAtTime(f, t);
      o.frequency.linearRampToValueAtTime(f * 0.92, t + step * 0.8);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = vowel ? 900 : 1600;
      bp.Q.value = 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(1, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + step * 0.9);
      o.connect(bp).connect(g).connect(out);
      o.start(t);
      o.stop(t + step);
    }
    return (chars.length / 2) * step;
  }
}

function reverseBuffer(buf: AudioBuffer): AudioBuffer {
  const out = new AudioBuffer({ length: buf.length, numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate });
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c);
    const dst = out.getChannelData(c);
    for (let i = 0, n = src.length; i < n; i++) dst[i] = src[n - 1 - i];
  }
  return out;
}

export const audio = new AudioEngine();
