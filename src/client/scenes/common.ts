// Shared scene helpers: cinematic camera rig, animated pixel water, chalkboard with chalk writing.

import * as THREE from 'three';
import { chalkboardCanvas } from '../art/textures';

export interface Shot {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov?: number;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Smooth camera with timed cinematic moves, gentle handheld sway and screen shake. */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private from: Shot | null = null;
  private to: Shot;
  private t = 1;
  private dur = 1;
  private shake = 0;
  private time = 0;
  sway = 0.012;
  private curPos = new THREE.Vector3();
  private curTarget = new THREE.Vector3();
  private curFov = 40;

  constructor(fov = 40) {
    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);
    this.to = { pos: new THREE.Vector3(0, 5, 10), target: new THREE.Vector3(), fov };
    this.curPos.copy(this.to.pos);
    this.curFov = fov;
  }

  cut(shot: Shot): void {
    this.to = { pos: shot.pos.clone(), target: shot.target.clone(), fov: shot.fov ?? this.curFov };
    this.from = null;
    this.t = 1;
    this.curPos.copy(this.to.pos);
    this.curTarget.copy(this.to.target);
    this.curFov = this.to.fov!;
  }

  go(shot: Shot, dur = 1.2): void {
    this.from = { pos: this.curPos.clone(), target: this.curTarget.clone(), fov: this.curFov };
    this.to = { pos: shot.pos.clone(), target: shot.target.clone(), fov: shot.fov ?? this.curFov };
    this.t = 0;
    this.dur = Math.max(0.01, dur);
  }

  get moving(): boolean {
    return this.t < 1;
  }

  addShake(amount: number): void {
    this.shake = Math.min(0.6, this.shake + amount);
  }

  update(dt: number): void {
    this.time += dt;
    if (this.from && this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.dur);
      const e = easeInOut(this.t);
      this.curPos.lerpVectors(this.from.pos, this.to.pos, e);
      this.curTarget.lerpVectors(this.from.target, this.to.target, e);
      this.curFov = THREE.MathUtils.lerp(this.from.fov!, this.to.fov!, e);
      // Arc the path slightly upward for a crane-shot feel.
      this.curPos.y += Math.sin(e * Math.PI) * 0.35 * this.from.pos.distanceTo(this.to.pos) * 0.08;
    } else {
      this.curPos.copy(this.to.pos);
      this.curTarget.copy(this.to.target);
      this.curFov = this.to.fov!;
    }
    const cam = this.camera;
    cam.position.copy(this.curPos);
    cam.position.x += Math.sin(this.time * 0.7) * this.sway;
    cam.position.y += Math.sin(this.time * 0.9 + 1) * this.sway * 0.6;
    if (this.shake > 0.001) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.3;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.3;
      this.shake *= Math.pow(0.02, dt);
    }
    cam.lookAt(this.curTarget);
    if (Math.abs(cam.fov - this.curFov) > 0.01) {
      cam.fov = this.curFov;
      cam.updateProjectionMatrix();
    }
  }

  get target(): THREE.Vector3 {
    return this.curTarget;
  }
}

/** Low-res animated water texture with drifting sparkles and expanding ripples. */
export class WaterTexture {
  readonly canvas = document.createElement('canvas');
  readonly texture: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private acc = 0;
  private t = 0;
  ripples: { x: number; y: number; r: number }[] = [];

  constructor(private base = '#2f6fa0', private light = '#5fa8d8', private size = 64) {
    this.canvas.width = this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.wrapS = this.texture.wrapT = THREE.RepeatWrapping;
    this.draw();
  }

  ripple(x: number, y: number): void {
    this.ripples.push({ x: x * this.size, y: y * this.size, r: 0 });
  }

  update(dt: number): void {
    this.acc += dt;
    this.t += dt;
    if (this.acc < 0.1) return;
    this.acc = 0;
    if (Math.random() < 0.08) this.ripple(Math.random(), Math.random());
    this.draw();
  }

  private draw(): void {
    const { ctx, size: s } = this;
    ctx.fillStyle = this.base;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = this.light;
    for (let i = 0; i < 26; i++) {
      const x = Math.floor((i * 37 + this.t * (4 + (i % 3) * 2)) % s);
      const y = Math.floor((i * 23 + Math.sin(this.t * 0.8 + i) * 3 + s) % s);
      ctx.fillRect(x, y, 2 + (i % 2), 1);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (const r of this.ripples) {
      r.r += 1.2;
      for (let a = 0; a < Math.PI * 2; a += 0.35) ctx.fillRect(Math.round(r.x + Math.cos(a) * r.r), Math.round(r.y + Math.sin(a) * r.r * 0.8), 1, 1);
    }
    this.ripples = this.ripples.filter((r) => r.r < 14);
    this.texture.needsUpdate = true;
  }
}

interface ChalkLine {
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  align: CanvasTextAlign;
  start: number;
  speed: number;
}

/** A canvas chalkboard that "writes" lines of text letter by letter. */
export class Chalkboard {
  readonly texture: THREE.CanvasTexture;
  private base: HTMLCanvasElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lines: ChalkLine[] = [];
  private time = 0;
  private dirty = true;
  onScratch?: () => void;

  constructor(readonly w = 512, readonly h = 272) {
    this.base = chalkboardCanvas(w, h);
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
  }

  clear(): void {
    this.lines = [];
    this.dirty = true;
  }

  write(text: string, x: number, y: number, opts: { size?: number; color?: string; align?: CanvasTextAlign; delay?: number; speed?: number; instant?: boolean } = {}): void {
    this.lines.push({
      text, x, y, size: opts.size ?? 24, color: opts.color ?? '#f4f1e8', align: opts.align ?? 'left',
      start: opts.instant ? -999 : this.time + (opts.delay ?? 0), speed: opts.speed ?? 28,
    });
    this.dirty = true;
  }

  get writing(): boolean {
    return this.lines.some((l) => this.time - l.start < l.text.length / l.speed);
  }

  update(dt: number): void {
    this.time += dt;
    const writing = this.writing;
    if (!writing && !this.dirty) return;
    this.dirty = false;
    const ctx = this.ctx;
    ctx.drawImage(this.base, 0, 0);
    let scratching = false;
    for (const l of this.lines) {
      const n = Math.floor((this.time - l.start) * l.speed);
      if (n <= 0) continue;
      const shown = l.text.slice(0, Math.min(l.text.length, n));
      if (n < l.text.length) scratching = true;
      ctx.font = `${l.size}px "Pixelify Sans", monospace`;
      ctx.textAlign = l.align;
      ctx.textBaseline = 'middle';
      // Chalk look: a soft base pass + jittered bright pass.
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = l.color;
      ctx.fillText(shown, l.x + 1, l.y + 1);
      ctx.globalAlpha = 0.9;
      ctx.fillText(shown, l.x, l.y);
      ctx.globalAlpha = 1;
    }
    // Chalk dust speckle erosion.
    ctx.fillStyle = 'rgba(35,56,44,0.35)';
    for (let i = 0; i < 260; i++) {
      const x = (i * 131 + Math.floor(i / 7) * 17) % this.w;
      const y = (i * 71 + Math.floor(i / 5) * 29) % this.h;
      ctx.fillRect(x, y, 1, 1);
    }
    if (scratching) this.onScratch?.();
    this.texture.needsUpdate = true;
  }
}
