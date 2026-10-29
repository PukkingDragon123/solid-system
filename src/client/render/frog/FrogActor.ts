// Procedural animation brain for a frog: idles (blink, catch flies, scratch, burp, dance, sleep,
// fall off the chair), emotes, moods, nervousness and cinematic moves.

import * as THREE from 'three';
import type { Outfit } from '../../../shared/cosmetics';
import { FrogModel, VOX } from './FrogModel';

export type FxKind = 'sweat' | 'tear' | 'heart' | 'zzz' | 'bubble' | 'steam' | 'confetti' | 'stars' | 'note' | 'question' | 'dust' | 'fly' | 'spark' | 'poof';

export interface ActorHooks {
  fx?(kind: FxKind, pos: THREE.Vector3, count?: number): void;
  sfx?(name: string, pos?: THREE.Vector3): void;
}

interface Action {
  name: string;
  t: number;
  dur: number;
  data?: Record<string, number>;
}

const ease = {
  out: (t: number) => 1 - (1 - t) ** 3,
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  back: (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2,
};

const ACTION_DUR: Record<string, number> = {
  wave: 1.6, laugh: 2.2, hop: 0.8, clap: 1.6, shock: 1.4, cry: 2.4, love: 2, angry: 1.8, dance: 3, burp: 1.8,
  flex: 1.8, facepalm: 1.8, faint: 3.2, shrug: 1.5, think: 2.4, party: 2.2, bow: 1.4, sleep: 3.5, sus: 2.2,
  airguitar: 2.6, backflip: 1.1, catchFly: 2.2, scratch: 1.8, fallChair: 3.2, gasp: 1.6, point: 2.2,
  celebrate: 3, bonked: 1.2, nod: 0.8, cheer: 1.6, pointLaugh: 3, swing: 0.32,
};

export class FrogActor {
  readonly model: FrogModel;
  readonly root: THREE.Group;
  hooks: ActorHooks;
  idleStyle = 'idle_chill';
  nervous = 0;
  mood: 'neutral' | 'happy' | 'sad' | 'shocked' | 'smug' | 'sleepy' = 'neutral';
  seated = true;
  asleep = false;
  enableIdles = true;
  private action: Action | null = null;
  private queue: string[] = [];
  private t = Math.random() * 100;
  private nextBlink = 1 + Math.random() * 3;
  private nextIdle = 4 + Math.random() * 6;
  private nextLook = 1;
  private lookTarget = new THREE.Vector2();
  private look = new THREE.Vector2();
  private worldLook: THREE.Vector3 | null = null;
  private move: { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; hop: number; onDone?: () => void } | null = null;
  private fxTimer = 0;
  private fly: THREE.Mesh | null = null;
  baseRotY = 0;
  basePos = new THREE.Vector3();
  extraLean = 0;

  constructor(outfit: Outfit, hooks: ActorHooks = {}, opts: { toad?: boolean } = {}) {
    this.model = new FrogModel(outfit, opts);
    this.root = this.model.root;
    this.hooks = hooks;
    this.idleStyle = outfit.idle;
  }

  setOutfit(outfit: Outfit): void {
    this.model.build(outfit, this.model.isToad);
    this.idleStyle = outfit.idle;
  }

  toToad(on: boolean): void {
    this.model.build(this.model.outfit, on);
  }

  place(pos: THREE.Vector3, rotY: number): void {
    this.basePos.copy(pos);
    this.baseRotY = rotY;
    this.root.position.copy(pos);
    this.root.rotation.y = rotY;
  }

  play(name: string, force = false): void {
    if (!ACTION_DUR[name]) return;
    if (this.action && !force) {
      if (this.queue.length < 2) this.queue.push(name);
      return;
    }
    this.startAction(name);
  }

  private startAction(name: string): void {
    this.resetPose();
    this.action = { name, t: 0, dur: ACTION_DUR[name] };
    const p = this.headPos();
    switch (name) {
      case 'laugh': this.hooks.sfx?.('laugh', p); break;
      case 'shock': case 'gasp': this.hooks.sfx?.('gasp', p); break;
      case 'burp': break;
      case 'party': this.hooks.fx?.('confetti', p, 30); this.hooks.sfx?.('party', p); break;
      case 'love': this.hooks.fx?.('heart', p, 5); break;
      case 'think': this.hooks.fx?.('question', p, 1); break;
      case 'catchFly': this.spawnFly(); break;
      case 'fallChair': this.hooks.sfx?.('thud', p); break;
      case 'bonked': this.hooks.fx?.('stars', p, 6); this.hooks.sfx?.('bonk', p); break;
      default: break;
    }
  }

  get busy(): boolean {
    return this.action !== null || this.move !== null;
  }

  headPos(): THREE.Vector3 {
    return this.model.headTop.getWorldPosition(new THREE.Vector3());
  }

  lookAt(world: THREE.Vector3 | null): void {
    this.worldLook = world;
  }

  /** Hop/glide to a position over `dur` seconds. */
  moveTo(to: THREE.Vector3, dur = 1, hop = 0.6, onDone?: () => void): void {
    this.move = { from: this.root.position.clone(), to: to.clone(), t: 0, dur, hop, onDone };
  }

  private resetPose(): void {
    const m = this.model;
    m.rig.position.set(0, 0, 0);
    m.rig.rotation.set(0, 0, 0);
    m.rig.scale.set(1, 1, 1);
    m.armL.rotation.set(0, 0, -0.25);
    m.armR.rotation.set(0, 0, 0.25);
    m.legL.rotation.set(0, -0.35, 0);
    m.legR.rotation.set(0, 0.35, 0);
    m.tongue.visible = false;
    m.setBrows(false);
    m.setPupilScale(1);
    m.setMouth('base');
  }

  private spawnFly(): void {
    if (this.fly) return;
    const g = new THREE.BoxGeometry(VOX * 1.2, VOX * 1.2, VOX * 1.2);
    this.fly = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x1b1420 }));
    this.root.add(this.fly);
    this.hooks.sfx?.('buzz', this.headPos());
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t;
    const m = this.model;

    // Movement (cinematic hops).
    if (this.move) {
      const mv = this.move;
      mv.t += dt;
      const k = Math.min(1, mv.t / mv.dur);
      const e = ease.inOut(k);
      this.root.position.lerpVectors(mv.from, mv.to, e);
      this.root.position.y += Math.sin(k * Math.PI) * mv.hop;
      m.rig.scale.y = 1 + Math.sin(k * Math.PI) * 0.15;
      if (k >= 1) {
        this.move = null;
        this.basePos.copy(mv.to);
        m.rig.scale.set(1, 1, 1);
        this.hooks.fx?.('dust', this.root.position.clone(), 6);
        mv.onDone?.();
      }
    } else {
      this.root.position.copy(this.basePos);
    }
    this.root.rotation.y = this.baseRotY;

    // Breathing + idle sway.
    const breath = Math.sin(t * 2.2) * 0.018;
    if (!this.action) {
      this.resetPose();
      m.rig.scale.set(1 - breath * 0.6, 1 + breath, 1 - breath * 0.6);
      if (this.idleStyle === 'idle_groovy') {
        m.rig.position.y = Math.abs(Math.sin(t * 4.2)) * 0.03;
        m.rig.rotation.z = Math.sin(t * 4.2) * 0.06;
        m.armL.rotation.z = -0.4 - Math.abs(Math.sin(t * 4.2)) * 0.4;
        m.armR.rotation.z = 0.4 + Math.abs(Math.cos(t * 4.2)) * 0.4;
      } else if (this.idleStyle === 'idle_hyper') {
        m.rig.position.y = Math.abs(Math.sin(t * 9)) * 0.02;
      }
      m.rig.rotation.x = this.extraLean;
    }

    // Nervousness: trembling, sweat, darting eyes, wavy mouth.
    if (this.nervous > 0.05 && !this.action) {
      const n = this.nervous;
      m.rig.position.x = Math.sin(t * 47) * 0.006 * n;
      m.rig.rotation.z += Math.sin(t * 31) * 0.02 * n;
      if (n > 0.45) { m.setMouth('wavy'); m.setBrows(true, -0.35); }
      this.fxTimer -= dt;
      if (this.fxTimer <= 0) {
        this.fxTimer = 2.2 - n * 1.6 + Math.random();
        this.hooks.fx?.('sweat', this.headPos(), 1 + Math.round(n * 2));
      }
    }

    // Eyes: blink + wandering gaze.
    this.nextBlink -= dt;
    let lid = this.idleStyle === 'idle_sleepy' || m.outfit.eyes === 'eyes_sleepy' ? 0.5 : this.mood === 'sleepy' ? 0.75 : 0;
    if (this.nervous > 0.6) lid = 0;
    if (this.nextBlink < 0) {
      lid = 1;
      if (this.nextBlink < -0.13) this.nextBlink = 1.5 + Math.random() * 4;
    }
    this.nextLook -= dt;
    if (this.worldLook) {
      const local = this.root.worldToLocal(this.worldLook.clone());
      this.lookTarget.set(THREE.MathUtils.clamp(local.x * 1.6, -1.2, 1.2), THREE.MathUtils.clamp((local.y - 0.9) * 1.6, -1.2, 1.2));
    } else if (this.nextLook < 0) {
      const dart = this.nervous > 0.4;
      this.nextLook = dart ? 0.25 + Math.random() * 0.4 : 1 + Math.random() * 3;
      this.lookTarget.set((Math.random() - 0.5) * (dart ? 2.4 : 1.6), (Math.random() - 0.4) * 1.2);
    }
    this.look.lerp(this.lookTarget, Math.min(1, dt * (this.nervous > 0.4 ? 18 : 8)));
    m.look(this.look.x, this.look.y);
    if (m.spinner) m.spinner.rotation.y += dt * 14;
    if (m.hatFloats) m.hat.position.y = (14.6 + 4 + Math.sin(t * 2) * 0.6) * VOX;

    // Actions.
    if (this.action) {
      const a = this.action;
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      lid = this.animate(a, k, dt, lid);
      if (a.t >= a.dur) {
        this.action = null;
        this.resetPose();
        if (this.fly) { this.fly.removeFromParent(); this.fly = null; }
        const next = this.queue.shift();
        if (next) this.startAction(next);
      }
    } else if (this.enableIdles) {
      this.nextIdle -= dt;
      if (this.nextIdle < 0) {
        this.nextIdle = (this.idleStyle === 'idle_hyper' ? 3 : 6) + Math.random() * 8;
        this.randomIdle();
      }
    }
    m.setLid(lid);
  }

  private randomIdle(): void {
    const style = this.idleStyle;
    const pool: string[] = ['catchFly', 'scratch', 'catchFly', 'nod'];
    if (style === 'idle_groovy') pool.push('dance', 'dance', 'airguitar');
    if (style === 'idle_sleepy') pool.push('sleep', 'sleep', 'sleep');
    if (style === 'idle_hyper') pool.push('hop', 'hop', 'backflip', 'party');
    if (style === 'idle_dramatic') pool.push('fallChair', 'faint', 'gasp');
    pool.push(Math.random() < 0.3 ? 'burp' : 'nod', Math.random() < 0.12 ? 'fallChair' : 'scratch', Math.random() < 0.2 ? 'sleep' : 'nod');
    if (this.nervous > 0.5) { this.play('gasp'); return; }
    this.play(pool[Math.floor(Math.random() * pool.length)]);
  }

  /** Returns the eyelid level for this frame. */
  private animate(a: Action, k: number, dt: number, lid: number): number {
    const m = this.model;
    const t = a.t;
    const s = Math.sin;
    switch (a.name) {
      case 'wave':
        m.armR.rotation.z = 2.6 + s(t * 14) * 0.45;
        m.rig.rotation.z = -0.08;
        m.setMouth('grin');
        return 0.25;
      case 'nod':
        m.rig.rotation.x = s(k * Math.PI * 2) * 0.12;
        return lid;
      case 'laugh':
        m.rig.position.y = Math.abs(s(t * 22)) * 0.05;
        m.rig.rotation.x = -0.25;
        m.armL.rotation.set(-0.9, 0, -0.6);
        m.armR.rotation.set(-0.9, 0, 0.6);
        m.setMouth('open');
        return 0.75;
      case 'pointLaugh':
        m.rig.position.y = Math.abs(s(t * 20)) * 0.04;
        m.rig.rotation.x = -0.15 + s(t * 20) * 0.05;
        m.armR.rotation.set(-1.4, 0, 0.1);
        m.armL.rotation.set(-0.9, 0, -0.6);
        m.setMouth('open');
        return 0.75;
      case 'hop':
      case 'cheer': {
        const h = s(k * Math.PI);
        m.rig.position.y = h * 0.45;
        m.rig.scale.set(1 - h * 0.08, 1 + h * 0.15, 1 - h * 0.08);
        m.armL.rotation.z = -0.4 - h * 2.2;
        m.armR.rotation.z = 0.4 + h * 2.2;
        if (a.name === 'cheer') m.setMouth('grin');
        if (k > 0.95 && !a.data) { a.data = { landed: 1 }; this.hooks.fx?.('dust', this.root.position.clone(), 4); }
        return lid;
      }
      case 'clap': {
        const c = Math.abs(s(t * 16));
        m.armL.rotation.set(-1.2, 0.6 * c, -0.2);
        m.armR.rotation.set(-1.2, -0.6 * c, 0.2);
        m.setMouth('grin');
        if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) this.hooks.sfx?.('clap', this.headPos());
        return 0.25;
      }
      case 'shock':
      case 'gasp': {
        const h = k < 0.2 ? ease.out(k / 0.2) : 1;
        m.rig.position.y = h * 0.08 * (k < 0.3 ? 1 : 0.5);
        m.rig.rotation.x = -0.25 * h;
        m.armL.rotation.z = -1.2 * h;
        m.armR.rotation.z = 1.2 * h;
        m.setMouth('o');
        m.setPupilScale(0.5);
        return 0;
      }
      case 'cry':
        m.rig.position.y = Math.abs(s(t * 18)) * 0.015;
        m.setMouth('frown');
        m.setBrows(true, -0.4);
        m.armL.rotation.set(-1.8, 0, -0.3);
        if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) this.hooks.fx?.('tear', this.headPos(), 2);
        return 0.5;
      case 'love':
        m.rig.rotation.z = s(t * 4) * 0.12;
        m.setMouth('grin');
        m.armL.rotation.set(-1.1, 0.5, -0.4);
        m.armR.rotation.set(-1.1, -0.5, 0.4);
        return 0.5;
      case 'angry':
        m.rig.position.x = s(t * 50) * 0.01;
        m.setBrows(true, 0.45);
        m.setMouth('frown');
        m.armL.rotation.z = -0.9;
        m.armR.rotation.z = 0.9;
        if (Math.floor(t * 3) !== Math.floor((t - dt) * 3)) this.hooks.fx?.('steam', this.headPos(), 3);
        return 0.25;
      case 'dance':
        m.rig.position.y = Math.abs(s(t * 8)) * 0.06;
        m.rig.rotation.z = s(t * 4) * 0.2;
        m.rig.rotation.y = s(t * 2) * 0.4;
        m.armL.rotation.z = -1 - s(t * 8) * 1.2;
        m.armR.rotation.z = 1 - s(t * 8) * 1.2;
        m.setMouth('grin');
        if (Math.floor(t * 2) !== Math.floor((t - dt) * 2)) this.hooks.fx?.('note', this.headPos(), 1);
        return 0.25;
      case 'burp': {
        const inflate = k < 0.55 ? ease.out(k / 0.55) : 1 - ease.out((k - 0.55) / 0.45);
        m.rig.scale.set(1 + inflate * 0.2, 1 + inflate * 0.08, 1 + inflate * 0.2);
        if (k > 0.55) {
          m.setMouth('open');
          if (!a.data) { a.data = { done: 1 }; this.hooks.sfx?.('burp', this.headPos()); this.hooks.fx?.('bubble', this.headPos(), 6); }
        }
        return k > 0.55 ? 0.5 : 0;
      }
      case 'flex':
        m.armL.rotation.set(0, 0, -2.2 + s(t * 10) * 0.1);
        m.armR.rotation.set(0, 0, 2.2 - s(t * 10) * 0.1);
        m.rig.scale.set(1.08, 1, 1.08);
        m.setMouth('mouth_smug');
        return 0.25;
      case 'facepalm':
        m.armR.rotation.set(-2.3, 0, 0.9);
        m.rig.rotation.x = 0.25;
        m.setMouth('flat');
        return 1;
      case 'faint': {
        const f = k < 0.25 ? ease.back(k / 0.25) : k < 0.75 ? 1 : 1 - ease.inOut((k - 0.75) / 0.25);
        m.rig.rotation.x = -1.3 * f;
        m.rig.position.y = -0.1 * f;
        m.rig.position.z = -0.25 * f;
        m.setMouth('o');
        if (k > 0.25 && k < 0.3) this.hooks.sfx?.('thud', this.headPos());
        return f > 0.5 ? 1 : 0;
      }
      case 'shrug':
        m.armL.rotation.set(0, 0, -1.6);
        m.armR.rotation.set(0, 0, 1.6);
        m.rig.rotation.z = 0.12;
        m.setMouth('flat');
        return 0.25;
      case 'think':
        m.armR.rotation.set(-2, 0, 0.6);
        m.look(0.8, 1.1);
        m.setMouth('flat');
        return 0;
      case 'party': {
        const h = Math.abs(s(t * 7));
        m.rig.position.y = h * 0.25;
        m.armL.rotation.z = -2.6;
        m.armR.rotation.z = 2.6;
        m.setMouth('open');
        return 0.25;
      }
      case 'bow':
        m.rig.rotation.x = s(k * Math.PI) * 0.6;
        m.armR.rotation.set(-0.8, 0, 0.5);
        return 0.5;
      case 'sleep':
        if (!this.asleep && Math.floor(t * 1.2) !== Math.floor((t - dt) * 1.2)) this.hooks.fx?.('zzz', this.headPos(), 1);
        m.rig.rotation.x = 0.2 + s(t * 1.5) * 0.04;
        m.rig.rotation.z = 0.15;
        m.setMouth('o');
        return 1;
      case 'sus':
        m.look(1.3, 0);
        m.rig.rotation.y = s(t * 1.5) * 0.25;
        m.setMouth('mouth_smug');
        return 0.5;
      case 'airguitar':
        m.rig.rotation.x = Math.abs(s(t * 9)) * 0.3;
        m.armL.rotation.set(-1, 0.8, -0.5);
        m.armR.rotation.set(-0.6 + s(t * 24) * 0.5, 0, 0.6);
        m.setMouth('open');
        return 0.75;
      case 'backflip': {
        m.rig.position.y = s(k * Math.PI) * 0.7;
        m.rig.rotation.x = -k * Math.PI * 2;
        m.armL.rotation.z = -2.2;
        m.armR.rotation.z = 2.2;
        return 0.25;
      }
      case 'catchFly': {
        if (this.fly) {
          // Fly buzzes in an arc in front of the frog, then gets yoinked at 70%.
          const fa = t * 6;
          const fp = new THREE.Vector3(Math.cos(fa) * 0.25, 1 + Math.sin(fa * 1.7) * 0.12, 0.45 + Math.sin(fa) * 0.08);
          if (k < 0.62) this.fly.position.copy(fp);
          const local = fp.clone();
          this.look.set(THREE.MathUtils.clamp(local.x * 5, -1.2, 1.2), THREE.MathUtils.clamp((local.y - 0.85) * 5, -1.2, 1.2));
          m.look(this.look.x, this.look.y);
          if (k > 0.6 && k < 0.78) {
            const tk = (k - 0.6) / 0.18;
            m.tongue.visible = true;
            m.tongue.scale.z = s(tk * Math.PI) * 1.1;
            m.tongue.lookAt(this.fly.getWorldPosition(new THREE.Vector3()));
            if (tk > 0.5) this.fly.visible = false;
            if (!a.data) { a.data = { slurp: 1 }; this.hooks.sfx?.('slurp', this.headPos()); }
          } else {
            m.tongue.visible = false;
          }
          if (k > 0.8) { m.setMouth('mouth_smug'); m.rig.scale.set(1.04, 0.98, 1.04); return 0.75; }
        }
        return 0;
      }
      case 'scratch':
        m.armR.rotation.set(-2.6, 0, 1.4 + s(t * 30) * 0.2);
        m.rig.rotation.z = 0.12;
        m.setMouth('flat');
        return 0.5;
      case 'fallChair': {
        const f = k < 0.2 ? ease.back(k / 0.2) : k < 0.6 ? 1 : 1 - ease.inOut((k - 0.6) / 0.4);
        m.rig.rotation.z = 1.5 * f;
        m.rig.position.x = 0.35 * f;
        m.rig.position.y = -0.35 * f;
        m.legL.rotation.x = -1 * f;
        m.legR.rotation.x = -1.3 * f;
        m.setMouth(f > 0.5 ? 'o' : 'base');
        if (k > 0.18 && !a.data) { a.data = { hit: 1 }; this.hooks.fx?.('stars', this.headPos(), 4); this.hooks.fx?.('dust', this.root.position.clone(), 6); }
        return f > 0.5 ? 0.25 : 0;
      }
      case 'swing':
        m.armR.rotation.set(-2.8 + ease.out(k) * 2.4, 0, 0.2);
        m.rig.rotation.x = 0.15 * k;
        return 0.25;
      case 'point':
        m.armR.rotation.set(-1.45, 0, 0.15);
        m.rig.rotation.x = -0.05;
        m.setMouth('o');
        return 0;
      case 'celebrate': {
        const h = Math.abs(s(t * 6));
        m.rig.position.y = h * 0.35;
        m.armL.rotation.z = -2.5 - s(t * 12) * 0.3;
        m.armR.rotation.z = 2.5 + s(t * 12) * 0.3;
        m.setMouth('grin');
        if (Math.floor(t * 2) !== Math.floor((t - dt) * 2)) this.hooks.fx?.('confetti', this.headPos(), 10);
        return 0.25;
      }
      case 'bonked': {
        const sq = k < 0.15 ? k / 0.15 : 1 - ease.out((k - 0.15) / 0.85);
        m.rig.scale.set(1 + sq * 0.5, 1 - sq * 0.55, 1 + sq * 0.5);
        m.setPupilScale(0.5);
        m.setMouth('o');
        return 0.5;
      }
      default:
        return lid;
    }
  }
}
