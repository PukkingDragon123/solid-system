// Web Audio instruments for the in-browser synth band. Works on realtime and offline contexts so
// clips can be pre-rendered (for reversing / speeding up) and still sound identical.

import { midiToFreq, type InstrumentId } from '../../shared/music';

export interface Voices {
  ctx: BaseAudioContext;
  noise: AudioBuffer;
  pulse25: PeriodicWave;
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
const pulseCache = new WeakMap<BaseAudioContext, PeriodicWave>();

export function voicesFor(ctx: BaseAudioContext): Voices {
  let noise = noiseCache.get(ctx);
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, noise);
  }
  let pulse = pulseCache.get(ctx);
  if (!pulse) {
    const n = 32;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
    pulse = ctx.createPeriodicWave(real, imag);
    pulseCache.set(ctx, pulse);
  }
  return { ctx, noise, pulse25: pulse };
}

function env(g: GainNode, t: number, peak: number, a: number, d: number, s: number, dur: number, r: number) {
  const gp = g.gain;
  gp.setValueAtTime(0.0001, t);
  gp.linearRampToValueAtTime(peak, t + a);
  gp.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t + a + d);
  const end = t + Math.max(a + d, dur);
  gp.setValueAtTime(Math.max(0.0001, peak * s), end);
  gp.exponentialRampToValueAtTime(0.0001, end + r);
  return end + r;
}

function osc(ctx: BaseAudioContext, type: OscillatorType, f: number, t: number, stop: number, detune = 0): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.detune.value = detune;
  o.start(t);
  o.stop(stop + 0.05);
  return o;
}

function noiseSrc(v: Voices, t: number, stop: number): AudioBufferSourceNode {
  const n = v.ctx.createBufferSource();
  n.buffer = v.noise;
  n.loop = true;
  n.start(t, Math.random() * 0.5);
  n.stop(stop + 0.05);
  return n;
}

function vibrato(ctx: BaseAudioContext, target: AudioParam, t: number, stop: number, rate = 5.5, depth = 6) {
  const lfo = osc(ctx, 'sine', rate, t + 0.15, stop);
  const g = ctx.createGain();
  g.gain.value = depth;
  lfo.connect(g).connect(target);
}

let distCurve: Float32Array | null = null;
function dist(ctx: BaseAudioContext): WaveShaperNode {
  if (!distCurve) {
    distCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; distCurve[i] = Math.tanh(x * 4); }
  }
  const w = ctx.createWaveShaper();
  w.curve = distCurve as unknown as Float32Array<ArrayBuffer>;
  return w;
}

/** Plays one note. `dur` is in seconds. Returns the time the voice fully ends. */
export function playNote(v: Voices, inst: InstrumentId, midi: number, t: number, dur: number, vel: number, dest: AudioNode): number {
  const ctx = v.ctx;
  if (inst === 'drums') return playDrum(v, midi, t, vel, dest);
  if (inst === 'timpani') return playTimpani(v, midi, t, dur, vel, dest);
  const f = midiToFreq(midi);
  const out = ctx.createGain();
  out.connect(dest);
  const vv = vel * 0.32;
  switch (inst) {
    case 'piano': {
      const end = env(out, t, vv, 0.004, 0.9, 0.25, dur, 0.35);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(Math.min(9000, f * 9), t);
      lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2), t + 1.2);
      lp.connect(out);
      osc(ctx, 'triangle', f, t, end).connect(lp);
      const o2 = osc(ctx, 'sine', f * 2, t, end, 4);
      const g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2).connect(lp);
      return end;
    }
    case 'epiano': {
      const end = env(out, t, vv * 0.9, 0.006, 1.4, 0.3, dur, 0.5);
      osc(ctx, 'sine', f, t, end).connect(out);
      const bell = ctx.createGain();
      env(bell, t, vv * 0.18, 0.002, 0.25, 0.05, 0.1, 0.1);
      osc(ctx, 'sine', f * 4.01, t, end).connect(bell).connect(out);
      return end;
    }
    case 'organ': {
      const end = env(out, t, vv * 0.55, 0.01, 0.05, 0.9, dur, 0.08);
      for (const [m, g] of [[1, 0.6], [2, 0.35], [3, 0.2], [4, 0.12], [0.5, 0.3]]) {
        const gg = ctx.createGain(); gg.gain.value = g;
        osc(ctx, 'sine', f * m, t, end).connect(gg).connect(out);
      }
      return end;
    }
    case 'strings':
    case 'pad': {
      const slow = inst === 'pad';
      const end = env(out, t, vv * (slow ? 0.35 : 0.5), slow ? 0.35 : 0.07, 0.2, 0.85, dur, slow ? 0.8 : 0.25);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = slow ? 1100 : Math.min(5000, f * 5);
      lp.Q.value = 0.6;
      lp.connect(out);
      for (const d of [-8, 8]) {
        const o = osc(ctx, 'sawtooth', f, t, end, d);
        if (!slow) vibrato(ctx, o.frequency, t, end, 5.2, f * 0.006);
        o.connect(lp);
      }
      return end;
    }
    case 'brass': {
      const end = env(out, t, vv * 0.5, 0.03, 0.15, 0.75, dur, 0.12);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(f * 1.5, t);
      lp.frequency.linearRampToValueAtTime(Math.min(6000, f * 7), t + 0.06);
      lp.frequency.exponentialRampToValueAtTime(Math.min(4000, f * 4), t + 0.3);
      lp.connect(out);
      const o = osc(ctx, 'sawtooth', f, t, end);
      vibrato(ctx, o.frequency, t, end, 5, f * 0.004);
      o.connect(lp);
      osc(ctx, 'square', f * 0.5, t, end).connect(lp);
      return end;
    }
    case 'flute':
    case 'whistle': {
      const end = env(out, t, vv * (inst === 'whistle' ? 0.55 : 0.6), 0.03, 0.1, 0.85, dur, 0.1);
      const o = osc(ctx, 'sine', inst === 'whistle' ? f * 2 : f, t, end);
      vibrato(ctx, o.frequency, t, end, 5.5, f * (inst === 'whistle' ? 0.015 : 0.008));
      o.connect(out);
      if (inst === 'flute') {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 2;
        const ng = ctx.createGain(); ng.gain.value = 0.05;
        noiseSrc(v, t, end).connect(bp).connect(ng).connect(out);
      }
      return end;
    }
    case 'bell':
    case 'celesta': {
      const isBell = inst === 'bell';
      const end = env(out, t, vv * 0.7, 0.002, isBell ? 1.6 : 0.8, 0.0001, 0.01, 0.2);
      const car = osc(ctx, 'sine', f * (isBell ? 1 : 2), t, end);
      const mod = osc(ctx, 'sine', f * (isBell ? 3.5 : 4), t, end);
      const mg = ctx.createGain();
      mg.gain.setValueAtTime(f * (isBell ? 2.5 : 1.2), t);
      mg.gain.exponentialRampToValueAtTime(1, t + 0.8);
      mod.connect(mg).connect(car.frequency);
      car.connect(out);
      return end;
    }
    case 'marimba': {
      const end = env(out, t, vv * 0.9, 0.002, 0.45, 0.0001, 0.01, 0.1);
      osc(ctx, 'sine', f, t, end).connect(out);
      const g4 = ctx.createGain();
      env(g4, t, 0.3, 0.001, 0.06, 0.0001, 0.01, 0.02);
      osc(ctx, 'sine', f * 4, t, end).connect(g4).connect(out);
      return end;
    }
    case 'pluck':
    case 'harpsichord': {
      const hc = inst === 'harpsichord';
      const end = env(out, t, vv * (hc ? 0.45 : 0.7), 0.002, hc ? 0.6 : 0.9, 0.0001, 0.01, 0.15);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(Math.min(10000, f * (hc ? 14 : 8)), t);
      lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.2), t + 0.5);
      lp.connect(out);
      osc(ctx, 'sawtooth', f, t, end).connect(lp);
      if (hc) osc(ctx, 'square', f * 2, t, end).connect(lp);
      else osc(ctx, 'triangle', f, t, end, 7).connect(lp);
      return end;
    }
    case 'dist': {
      const end = env(out, t, vv * 0.35, 0.005, 0.2, 0.7, dur, 0.08);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2800;
      const w = dist(ctx);
      w.connect(lp).connect(out);
      osc(ctx, 'sawtooth', f, t, end, -6).connect(w);
      osc(ctx, 'sawtooth', f, t, end, 6).connect(w);
      return end;
    }
    case 'bass': {
      const end = env(out, t, vv * 0.9, 0.006, 0.3, 0.6, dur * 0.95, 0.06);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      lp.connect(out);
      osc(ctx, 'triangle', f, t, end).connect(lp);
      osc(ctx, 'sine', f, t, end).connect(lp);
      return end;
    }
    case 'synthbass': {
      const end = env(out, t, vv * 0.6, 0.004, 0.18, 0.5, dur * 0.9, 0.05);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 6;
      lp.frequency.setValueAtTime(f * 8, t);
      lp.frequency.exponentialRampToValueAtTime(f * 2, t + 0.2);
      lp.connect(out);
      osc(ctx, 'square', f, t, end).connect(lp);
      return end;
    }
    case 'lead':
    case 'chip': {
      const chip = inst === 'chip';
      const end = env(out, t, vv * (chip ? 0.35 : 0.4), 0.004, 0.1, chip ? 0.7 : 0.8, dur * (chip ? 0.92 : 1), chip ? 0.02 : 0.1);
      const o = ctx.createOscillator();
      if (chip) o.setPeriodicWave(v.pulse25); else o.type = 'square';
      o.frequency.setValueAtTime(f, t);
      o.start(t);
      o.stop(end + 0.05);
      if (!chip) {
        vibrato(ctx, o.frequency, t, end, 6, f * 0.007);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(6000, f * 6);
        o.connect(lp).connect(out);
      } else o.connect(out);
      return end;
    }
    case 'saw': {
      const end = env(out, t, vv * 0.3, 0.01, 0.2, 0.7, dur, 0.15);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(7000, f * 8); lp.connect(out);
      for (const d of [-14, 0, 14]) osc(ctx, 'sawtooth', f, t, end, d).connect(lp);
      return end;
    }
    case 'voice': {
      // A little "aah" choir: sawtooth through two formant filters with vibrato.
      const end = env(out, t, vv * 1.4, 0.04, 0.1, 0.85, dur, 0.12);
      const src = osc(ctx, 'sawtooth', f, t, end);
      vibrato(ctx, src.frequency, t, end, 5.2, f * 0.012);
      const sum = ctx.createGain();
      sum.gain.value = 0.6;
      for (const [fq, q, g] of [[750, 7, 1], [1200, 9, 0.5], [2600, 12, 0.18]]) {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = q;
        const gg = ctx.createGain(); gg.gain.value = g;
        src.connect(bp).connect(gg).connect(sum);
      }
      sum.connect(out);
      return end;
    }
    default: {
      const end = env(out, t, vv * 0.5, 0.01, 0.2, 0.6, dur, 0.1);
      osc(ctx, 'triangle', f, t, end).connect(out);
      return end;
    }
  }
}

function playTimpani(v: Voices, midi: number, t: number, dur: number, vel: number, dest: AudioNode): number {
  const ctx = v.ctx;
  const f = midiToFreq(midi);
  const out = ctx.createGain();
  out.connect(dest);
  const end = env(out, t, vel * 0.9, 0.003, Math.max(0.6, dur), 0.0001, 0.01, 0.3);
  const o = osc(ctx, 'sine', f * 1.6, t, end);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
  o.connect(out);
  const ng = ctx.createGain();
  env(ng, t, vel * 0.2, 0.001, 0.08, 0.0001, 0.01, 0.02);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
  noiseSrc(v, t, t + 0.2).connect(lp).connect(ng).connect(dest);
  return end;
}

export function playDrum(v: Voices, id: number, t: number, vel: number, dest: AudioNode): number {
  const ctx = v.ctx;
  const out = ctx.createGain();
  out.connect(dest);
  const vv = vel * 0.9;
  const noise = (type: BiquadFilterType, fq: number, q: number, a: number, d: number, g: number) => {
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = fq; f.Q.value = q;
    const gg = ctx.createGain();
    const end = env(gg, t, g, a, d, 0.0001, 0.001, 0.02);
    noiseSrc(v, t, end).connect(f).connect(gg).connect(out);
    return end;
  };
  switch (id) {
    case 1: { // kick
      const g = ctx.createGain();
      const end = env(g, t, vv * 1.1, 0.002, 0.28, 0.0001, 0.01, 0.05);
      const o = osc(ctx, 'sine', 150, t, end);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      o.connect(g).connect(out);
      return end;
    }
    case 2: { // snare
      const g = ctx.createGain();
      env(g, t, vv * 0.4, 0.001, 0.08, 0.0001, 0.01, 0.02);
      osc(ctx, 'triangle', 190, t, t + 0.12).connect(g).connect(out);
      return noise('highpass', 1500, 0.7, 0.001, 0.16, vv * 0.5);
    }
    case 3: return noise('highpass', 7500, 0.8, 0.001, 0.04, vv * 0.22);
    case 4: return noise('highpass', 6500, 0.8, 0.002, 0.25, vv * 0.2);
    case 5: { // clap
      let end = t;
      for (let i = 0; i < 3; i++) {
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 1.5;
        const gg = ctx.createGain();
        const tt = t + i * 0.012;
        gg.gain.setValueAtTime(0.0001, tt);
        gg.gain.linearRampToValueAtTime(vv * 0.5, tt + 0.002);
        gg.gain.exponentialRampToValueAtTime(0.0001, tt + (i === 2 ? 0.14 : 0.02));
        end = tt + 0.16;
        noiseSrc(v, tt, end).connect(f).connect(gg).connect(out);
      }
      return end;
    }
    case 6:
    case 8: { // toms
      const g = ctx.createGain();
      const end = env(g, t, vv * 0.8, 0.002, 0.3, 0.0001, 0.01, 0.05);
      const o = osc(ctx, 'sine', id === 6 ? 180 : 110, t, end);
      o.frequency.exponentialRampToValueAtTime(id === 6 ? 110 : 70, t + 0.2);
      o.connect(g).connect(out);
      return end;
    }
    case 7: return noise('highpass', 4000, 0.5, 0.002, 1.2, vv * 0.28);
    case 9: { // woodblock
      const g = ctx.createGain();
      const end = env(g, t, vv * 0.5, 0.001, 0.05, 0.0001, 0.01, 0.02);
      osc(ctx, 'square', 820, t, end).connect(g).connect(out);
      return end;
    }
    default:
      return t;
  }
}
