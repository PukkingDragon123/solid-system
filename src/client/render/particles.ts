// 2D pixel particles rendered as point sprites from a tiny hand-drawn atlas.

import * as THREE from 'three';
import { Painter } from '../art/painter';
import { FX_LAYER } from './PixelRenderer';

export type ParticleKind = 'square' | 'heart' | 'star' | 'note' | 'zzz' | 'drop' | 'bubble' | 'question' | 'puff' | 'spark' | 'confetti' | 'firefly' | 'rain' | 'leaf' | 'smoke' | 'petal';

const SPRITES: ParticleKind[] = ['square', 'heart', 'star', 'note', 'zzz', 'drop', 'bubble', 'question', 'puff', 'spark', 'confetti', 'firefly', 'rain', 'leaf', 'smoke', 'petal'];

function atlas(): THREE.Texture {
  const p = new Painter(32, 32);
  const W = '#ffffff';
  const cell = (i: number, draw: (x: number, y: number) => void) => draw((i % 4) * 8, Math.floor(i / 4) * 8);
  cell(0, (x, y) => p.rect(x + 2, y + 2, 4, 4, W));
  cell(1, (x, y) => { p.rect(x + 1, y + 2, 2, 2, W); p.rect(x + 5, y + 2, 2, 2, W); p.rect(x + 1, y + 3, 6, 2, W); p.rect(x + 2, y + 5, 4, 1, W); p.rect(x + 3, y + 6, 2, 1, W); });
  cell(2, (x, y) => { p.rect(x + 3, y + 0, 2, 8, W); p.rect(x + 0, y + 3, 8, 2, W); p.rect(x + 2, y + 2, 4, 4, W); });
  cell(3, (x, y) => { p.rect(x + 4, y + 0, 1, 6, W); p.rect(x + 4, y + 0, 3, 1, W); p.rect(x + 2, y + 5, 3, 2, W); });
  cell(4, (x, y) => { p.rect(x + 1, y + 1, 6, 1, W); p.rect(x + 5, y + 2, 1, 1, W); p.rect(x + 4, y + 3, 1, 1, W); p.rect(x + 3, y + 4, 1, 1, W); p.rect(x + 2, y + 5, 1, 1, W); p.rect(x + 1, y + 6, 6, 1, W); });
  cell(5, (x, y) => { p.rect(x + 3, y + 1, 2, 2, W); p.rect(x + 2, y + 3, 4, 3, W); p.rect(x + 3, y + 6, 2, 1, W); });
  cell(6, (x, y) => { p.ring(x + 4, y + 4, 3.6, 1, W); p.px(x + 2, y + 2, W); });
  cell(7, (x, y) => { p.rect(x + 2, y + 0, 4, 1, W); p.rect(x + 5, y + 1, 1, 2, W); p.rect(x + 3, y + 3, 2, 1, W); p.rect(x + 3, y + 4, 1, 1, W); p.rect(x + 3, y + 6, 1, 1, W); });
  cell(8, (x, y) => p.circle(x + 4, y + 4, 3.5, W));
  cell(9, (x, y) => { p.rect(x + 3, y + 2, 2, 4, W); p.rect(x + 2, y + 3, 4, 2, W); });
  cell(10, (x, y) => p.rect(x + 2, y + 3, 4, 2, W));
  cell(11, (x, y) => { p.rect(x + 3, y + 3, 2, 2, W); p.px(x + 2, y + 4, 'rgba(255,255,255,0.5)'); p.px(x + 5, y + 3, 'rgba(255,255,255,0.5)'); });
  cell(12, (x, y) => p.rect(x + 4, y + 0, 1, 7, W));
  cell(13, (x, y) => { p.rect(x + 2, y + 2, 3, 3, W); p.rect(x + 4, y + 4, 2, 2, W); });
  cell(14, (x, y) => { p.circle(x + 4, y + 4, 3.5, 'rgba(255,255,255,0.6)'); p.circle(x + 3, y + 3, 2, W); });
  cell(15, (x, y) => { p.rect(x + 2, y + 3, 4, 2, W); p.rect(x + 3, y + 2, 2, 4, W); });
  const t = p.texture();
  t.flipY = false;
  return t;
}

interface Opts {
  color?: THREE.ColorRepresentation | THREE.ColorRepresentation[];
  speed?: number;
  spread?: number;
  up?: number;
  gravity?: number;
  life?: number;
  size?: number;
  drag?: number;
  wobble?: number;
}

const MAX = 2500;

export class Particles {
  readonly points: THREE.Points;
  private geo = new THREE.BufferGeometry();
  private pos = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 4);
  private size = new Float32Array(MAX);
  private sprite = new Float32Array(MAX);
  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX);
  private grav = new Float32Array(MAX);
  private drag = new Float32Array(MAX);
  private wob = new Float32Array(MAX);
  private next = 0;
  private time = 0;
  readonly material: THREE.ShaderMaterial;

  constructor() {
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    this.geo.setAttribute('psize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('sprite', new THREE.BufferAttribute(this.sprite, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: { atlas: { value: atlas() }, scale: { value: 400 } },
      vertexShader: /* glsl */ `
        attribute vec4 color;
        attribute float psize;
        attribute float sprite;
        uniform float scale;
        varying vec4 vColor;
        varying float vSprite;
        void main() {
          vColor = color;
          vSprite = sprite;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = psize * scale / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D atlas;
        varying vec4 vColor;
        varying float vSprite;
        void main() {
          vec2 cell = vec2(mod(vSprite, 4.0), floor(vSprite / 4.0));
          vec2 uv = (cell * 8.0 + floor(gl_PointCoord * 8.0) + 0.5) / 32.0;
          vec4 tex = texture2D(atlas, uv);
          if (tex.a * vColor.a < 0.1) discard;
          gl_FragColor = vec4(vColor.rgb * tex.rgb, tex.a * vColor.a);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, this.material);
    this.points.frustumCulled = false;
    this.points.layers.set(FX_LAYER);
    this.points.renderOrder = 10;
    for (let i = 0; i < MAX; i++) this.col[i * 4 + 3] = 0;
  }

  setViewport(heightPx: number, fovDeg: number): void {
    this.material.uniforms.scale.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
  }

  emit(kind: ParticleKind, at: THREE.Vector3, count = 1, o: Opts = {}): void {
    const colors = Array.isArray(o.color) ? o.color : [o.color ?? '#ffffff'];
    const c = new THREE.Color();
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      const sp = o.speed ?? 1;
      const spread = o.spread ?? 1;
      const theta = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      this.pos[i * 3] = at.x + (Math.random() - 0.5) * 0.1;
      this.pos[i * 3 + 1] = at.y + (Math.random() - 0.5) * 0.1;
      this.pos[i * 3 + 2] = at.z + (Math.random() - 0.5) * 0.1;
      this.vel[i * 3] = Math.cos(theta) * r * sp;
      this.vel[i * 3 + 1] = (o.up ?? 1) * sp * (0.6 + Math.random() * 0.8);
      this.vel[i * 3 + 2] = Math.sin(theta) * r * sp;
      c.set(colors[Math.floor(Math.random() * colors.length)]);
      this.col[i * 4] = c.r; this.col[i * 4 + 1] = c.g; this.col[i * 4 + 2] = c.b; this.col[i * 4 + 3] = 1;
      this.size[i] = (o.size ?? 0.12) * (0.8 + Math.random() * 0.4);
      this.sprite[i] = SPRITES.indexOf(kind);
      this.life[i] = this.maxLife[i] = (o.life ?? 1.2) * (0.75 + Math.random() * 0.5);
      this.grav[i] = o.gravity ?? -2;
      this.drag[i] = o.drag ?? 1.5;
      this.wob[i] = o.wobble ?? 0;
    }
  }

  update(dt: number): void {
    this.time += dt;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.col[i * 4 + 3] = 0; continue; }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 2] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d + this.grav[i] * dt;
      const w = this.wob[i] ? Math.sin(this.time * 6 + i) * this.wob[i] * dt : 0;
      this.pos[i * 3] += this.vel[i * 3] * dt + w;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const k = this.life[i] / this.maxLife[i];
      this.col[i * 4 + 3] = Math.min(1, k * 3);
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.psize as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.sprite as THREE.BufferAttribute).needsUpdate = true;
  }

  /** Convenience presets for frog FX. */
  frogFx(kind: string, at: THREE.Vector3, count = 1): void {
    switch (kind) {
      case 'sweat': this.emit('drop', at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, -0.2, 0.2)), count, { color: '#9fe3ff', speed: 0.6, gravity: -3, life: 0.9, size: 0.09, spread: 0.6 }); break;
      case 'tear': this.emit('drop', at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, -0.35, 0.35)), count, { color: '#7fd0ff', speed: 0.8, gravity: -4, life: 0.8, size: 0.08, spread: 1.2 }); break;
      case 'heart': this.emit('heart', at, count, { color: ['#ff5d9e', '#ff8ac0'], speed: 0.5, gravity: 0.6, life: 1.6, size: 0.14, wobble: 0.6 }); break;
      case 'zzz': this.emit('zzz', at.clone().add(new THREE.Vector3(0.2, 0, 0)), count, { color: '#e8eeff', speed: 0.35, gravity: 0.3, life: 2, size: 0.13, wobble: 0.8 }); break;
      case 'bubble': this.emit('bubble', at.clone().add(new THREE.Vector3(0, -0.4, 0.4)), count, { color: '#c8f0ff', speed: 0.5, gravity: 0.5, life: 1.8, size: 0.1, wobble: 1 }); break;
      case 'steam': this.emit('smoke', at, count, { color: '#ffffff', speed: 0.6, gravity: 0.8, life: 1, size: 0.14 }); break;
      case 'confetti': this.emit('confetti', at, count, { color: ['#ff5d5d', '#ffe245', '#6fe05a', '#4aa3ff', '#ff7ad1', '#ffffff'], speed: 2.2, gravity: -3, life: 1.8, size: 0.1, spread: 1.4, wobble: 1 }); break;
      case 'stars': this.emit('star', at, count, { color: ['#ffe245', '#ffffff'], speed: 1.2, gravity: 0, life: 1.1, size: 0.13, spread: 1.4, drag: 2.5 }); break;
      case 'note': this.emit('note', at, count, { color: ['#ffe245', '#7ee05a', '#5ae3ff'], speed: 0.6, gravity: 0.4, life: 1.6, size: 0.13, wobble: 0.8 }); break;
      case 'question': this.emit('question', at.clone().add(new THREE.Vector3(0.25, 0.1, 0)), count, { color: '#ffffff', speed: 0.2, gravity: 0.15, life: 2, size: 0.18 }); break;
      case 'dust': this.emit('puff', at, count, { color: ['#d8c8a8', '#b8a888'], speed: 1.2, gravity: 0.2, life: 0.7, size: 0.16, spread: 1.6, drag: 3 }); break;
      case 'spark': this.emit('spark', at, count, { color: ['#fff6a0', '#7fe8ff'], speed: 2.5, gravity: -2, life: 0.5, size: 0.08, spread: 1.6 }); break;
      case 'poof': this.emit('puff', at, count, { color: ['#ffffff', '#e0f0ff', '#c8ffd0'], speed: 2.4, gravity: 0, life: 0.9, size: 0.3, spread: 1.6, drag: 3 }); break;
      default: break;
    }
  }
}
