// Physical choice objects on the table: illustrated cards, lily pads, record sleeves, cassettes,
// glowing mushrooms, arrow signs, map tokens and frog tokens. All laid out in shared board space.

import * as THREE from 'three';
import { gridSlots, ringSlots, slotContains, type BoardSlot } from '../../../shared/board';
import type { BoardStyle } from '../../../shared/catalog';
import type { CoverSpec } from '../../../shared/content';
import { drawCover, drawIcon, drawMap } from '../../art/icons';
import { Painter, shade } from '../../art/painter';
import { FX_LAYER } from '../../render/PixelRenderer';

export const BOARD_SIZE = 5.2;

export interface BoardOption {
  id: string;
  label: string;
  sub?: string;
  color?: string;
  art?: string;
  cover?: CoverSpec;
  map?: string;
}

export type BoardKind = BoardStyle | 'maps' | 'players' | 'categories' | 'wagers';

interface Item {
  opt: BoardOption;
  slot: BoardSlot;
  obj: THREE.Group;
  face: THREE.Mesh;
  lift: number;
  wobble: number;
  glow: THREE.Mesh;
  phase: number;
  hovered: number;
  state: 'idle' | 'correct' | 'wrong' | 'winner' | 'dim';
  appear: number;
}

function artTexture(opt: BoardOption, kind: BoardKind): THREE.Texture {
  if (kind === 'maps' && opt.map) {
    const p = new Painter(48, 32);
    drawMap(p, opt.map);
    return p.texture();
  }
  if (opt.cover) {
    const p = new Painter(32);
    drawCover(p, opt.cover);
    return p.texture();
  }
  const p = new Painter(48, 64);
  const col = opt.color ?? '#6fc2a1';
  // Card face: coloured frame, parchment centre, big icon.
  p.clear(shade(col, -0.25));
  p.rect(2, 2, 44, 60, col);
  p.rect(4, 4, 40, 56, '#f4ead0');
  p.noise(4, 4, 40, 56, '#e8dcbc', 0.15, 7);
  if (opt.art) drawIcon(p, opt.art, col, 8, 10);
  p.rect(4, 46, 40, 14, shade(col, 0.15));
  return p.texture();
}

const coverCache = new Map<string, THREE.Texture>();

export function pixelatedCoverTexture(cover: CoverSpec, level: number): THREE.Texture {
  const key = `${cover.motif}:${cover.bg}:${level}`;
  let t = coverCache.get(key);
  if (t) return t;
  const full = new Painter(32);
  drawCover(full, cover);
  const block = Math.max(1, Math.round(level));
  const p = new Painter(32);
  const img = full.ctx.getImageData(0, 0, 32, 32).data;
  for (let y = 0; y < 32; y += block)
    for (let x = 0; x < 32; x += block) {
      const i = (Math.min(31, y + Math.floor(block / 2)) * 32 + Math.min(31, x + Math.floor(block / 2))) * 4;
      p.rect(x, y, block, block, `rgb(${img[i]},${img[i + 1]},${img[i + 2]})`);
    }
  t = p.texture();
  coverCache.set(key, t);
  return t;
}

export class Board {
  readonly group = new THREE.Group();
  items: Item[] = [];
  kind: BoardKind = 'cards';
  private time = 0;
  private pond: THREE.Mesh | null = null;

  constructor(readonly tableY: number) {
    this.group.position.y = tableY;
  }

  uvToLocal(u: number, v: number): THREE.Vector3 {
    return new THREE.Vector3((u - 0.5) * BOARD_SIZE, 0, (v - 0.5) * BOARD_SIZE);
  }

  uvToWorld(u: number, v: number, lift = 0): THREE.Vector3 {
    return this.uvToLocal(u, v).add(new THREE.Vector3(0, this.tableY + lift, 0));
  }

  worldToUv(p: THREE.Vector3): [number, number] {
    return [p.x / BOARD_SIZE + 0.5, p.z / BOARD_SIZE + 0.5];
  }

  setPond(pond: THREE.Mesh | null): void {
    this.pond = pond;
  }

  clear(): void {
    for (const it of this.items) it.obj.removeFromParent();
    this.items = [];
  }

  set(kind: BoardKind, options: BoardOption[]): void {
    this.clear();
    this.kind = kind;
    const slots = kind === 'maps' ? ringSlots(options.length) : gridSlots(options.length);
    options.forEach((opt, i) => {
      const slot = slots[i];
      const obj = new THREE.Group();
      const { face, glow } = this.buildObject(kind, opt, slot);
      obj.add(face);
      obj.add(glow);
      obj.position.copy(this.uvToLocal(slot.u, slot.v));
      this.group.add(obj);
      this.items.push({ opt, slot, obj, face, lift: 0, wobble: 0, glow, phase: Math.random() * 6, hovered: 0, state: 'idle', appear: -i * 0.08 });
    });
  }

  private buildObject(kind: BoardKind, opt: BoardOption, slot: BoardSlot): { face: THREE.Mesh; glow: THREE.Mesh } {
    const w = slot.w * BOARD_SIZE * 0.92;
    const d = slot.h * BOARD_SIZE * 0.92;
    let face: THREE.Mesh;
    const col = opt.color ?? '#6fc2a1';
    switch (kind) {
      case 'lilypads': {
        const r = Math.min(w, d) * 0.5;
        const pad = new Painter(32);
        pad.circle(16, 16, 15.5, '#3f9f4f');
        pad.circle(16, 16, 12, '#4fbf5f');
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; pad.line(16, 16, 16 + Math.cos(a) * 14, 16 + Math.sin(a) * 14, '#3f9f4f'); }
        pad.ctx.save(); pad.ctx.globalCompositeOperation = 'destination-out'; pad.poly([[16, 16], [32, 10], [32, 20]], '#000'); pad.ctx.restore();
        face = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 20), [
          new THREE.MeshStandardMaterial({ color: '#2f7f3f' }),
          new THREE.MeshStandardMaterial({ map: pad.texture(), transparent: true, alphaTest: 0.5 }),
          new THREE.MeshStandardMaterial({ color: '#2f7f3f' }),
        ]);
        face.position.y = 0.1;
        break;
      }
      case 'sleeves': {
        const s = Math.min(w, d);
        const tex = opt.cover ? artTexture(opt, kind) : sleeveTexture(opt);
        face = new THREE.Mesh(new THREE.BoxGeometry(s * 0.92, 0.07, s * 0.92), [side('#1b1420'), side('#1b1420'), new THREE.MeshStandardMaterial({ map: tex }), side('#1b1420'), side('#1b1420'), side('#1b1420')]);
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.42, s * 0.42, 0.04, 24), new THREE.MeshStandardMaterial({ color: '#16161c', roughness: 0.4 }));
        disc.position.set(0, -0.01, -s * 0.22);
        disc.name = 'disc';
        face.add(disc);
        face.position.y = 0.06;
        break;
      }
      case 'cassettes': {
        const p = new Painter(32, 20);
        p.clear(shade(col, -0.2));
        p.rect(2, 2, 28, 16, col);
        p.rect(4, 4, 24, 7, '#f4f1e8');
        p.circle(10, 14, 2.5, '#1b1420');
        p.circle(22, 14, 2.5, '#1b1420');
        face = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, 0.1, d * 0.62), [side(col), side(col), new THREE.MeshStandardMaterial({ map: p.texture() }), side(col), side(col), side(col)]);
        face.position.y = 0.06;
        break;
      }
      case 'mushrooms': {
        const r = Math.min(w, d) * 0.42;
        face = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, flatShading: true }));
        face.scale.y = 0.7;
        face.position.y = 0.25;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.4, 0.3, 8), new THREE.MeshStandardMaterial({ color: '#efe2c8' }));
        stem.position.y = -0.18;
        face.add(stem);
        break;
      }
      case 'arrows': {
        const up = opt.id === 'higher';
        const p = new Painter(32);
        p.clear(up ? '#3fae6f' : '#e2483d');
        p.rect(1, 1, 30, 30, up ? '#4fcf7f' : '#f25a4f');
        if (up) p.poly([[16, 4], [28, 18], [20, 18], [20, 28], [12, 28], [12, 18], [4, 18]], '#ffffff');
        else p.poly([[16, 28], [28, 14], [20, 14], [20, 4], [12, 4], [12, 14], [4, 14]], '#ffffff');
        face = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.12, d * 0.8), [side('#5a3a1f'), side('#5a3a1f'), new THREE.MeshStandardMaterial({ map: p.texture() }), side('#5a3a1f'), side('#5a3a1f'), side('#5a3a1f')]);
        face.position.y = 0.08;
        break;
      }
      case 'maps': {
        face = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, 0.08, d * 1.05), [side('#6a4428'), side('#6a4428'), new THREE.MeshStandardMaterial({ map: artTexture(opt, kind) }), side('#6a4428'), side('#6a4428'), side('#6a4428')]);
        face.position.y = 0.06;
        break;
      }
      case 'players':
      case 'wagers': {
        const p = new Painter(32, 32);
        p.clear(shade(col, -0.25));
        p.circle(16, 16, 15, col);
        p.circle(16, 16, 11, shade(col, 0.2));
        if (kind === 'wagers') { p.ring(16, 16, 8, 2, '#ffffff'); p.ring(16, 16, 13, 1, '#ffffff'); }
        face = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.42, Math.min(w, d) * 0.42, 0.12, 20), [side(shade(col, -0.25)), new THREE.MeshStandardMaterial({ map: p.texture() }), side(col)]);
        face.position.y = 0.08;
        break;
      }
      case 'tv':
      case 'cards':
      case 'chalk':
      case 'categories':
      default: {
        const tex = artTexture(opt, kind);
        const cw = Math.min(w, d * 0.78);
        face = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.06, cw / 0.75), [side('#e8dcbc'), side('#e8dcbc'), new THREE.MeshStandardMaterial({ map: tex }), side('#e8dcbc'), side('#e8dcbc'), side('#e8dcbc')]);
        if (cw / 0.75 > d) face.scale.setScalar(d / (cw / 0.75));
        face.position.y = 0.05;
      }
    }
    face.castShadow = true;
    face.receiveShadow = true;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.25, d * 1.25), new THREE.MeshBasicMaterial({ color: '#ffffff', map: glowTexture(), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.012;
    glow.layers.set(FX_LAYER);
    return { face, glow };
  }

  hitTest(u: number, v: number): string | null {
    for (const it of this.items) if (slotContains(it.slot, u, v)) return it.opt.id;
    return null;
  }

  itemWorld(id: string, lift = 0.4): THREE.Vector3 | null {
    const it = this.items.find((i) => i.opt.id === id);
    if (!it) return null;
    return this.uvToWorld(it.slot.u, it.slot.v, lift);
  }

  setState(id: string, state: Item['state']): void {
    const it = this.items.find((i) => i.opt.id === id);
    if (it) it.state = state;
  }

  setAllStates(fn: (id: string) => Item['state']): void {
    for (const it of this.items) it.state = fn(it.opt.id);
  }

  /** Visual feedback: hover counts lift cards, contested cards wobble, votes tint the glow. */
  update(dt: number, hoverCounts: Map<string, number>, voteColors: Map<string, string[]>, mine: string | null): void {
    this.time += dt;
    for (const it of this.items) {
      it.appear = Math.min(1, it.appear + dt * 3);
      const a = Math.max(0, it.appear);
      const appearScale = a < 1 ? 0.2 + 0.8 * (1 - (1 - a) ** 3) + Math.sin(a * Math.PI) * 0.15 : 1;
      const hov = hoverCounts.get(it.opt.id) ?? 0;
      it.hovered = THREE.MathUtils.lerp(it.hovered, hov, Math.min(1, dt * 10));
      const votes = voteColors.get(it.opt.id) ?? [];
      const contested = hov >= 2 || votes.length >= 2;
      it.wobble = THREE.MathUtils.lerp(it.wobble, contested ? 1 : 0, Math.min(1, dt * 6));
      const targetLift = (it.state === 'correct' || it.state === 'winner' ? 0.45 : 0) + Math.min(0.25, it.hovered * 0.12) + (mine === it.opt.id ? 0.12 : 0);
      it.lift = THREE.MathUtils.lerp(it.lift, targetLift, Math.min(1, dt * 8));
      const bob = this.kind === 'lilypads' || this.kind === 'mushrooms' ? Math.sin(this.time * 2 + it.phase) * 0.03 : 0;
      it.obj.position.y = it.lift + bob;
      it.obj.rotation.z = Math.sin(this.time * 18 + it.phase) * 0.05 * it.wobble;
      it.obj.rotation.x = Math.cos(this.time * 15 + it.phase) * 0.04 * it.wobble;
      if (this.kind === 'lilypads') it.obj.rotation.y = Math.sin(this.time * 0.5 + it.phase) * 0.3;
      if (this.kind === 'sleeves') {
        const disc = it.face.getObjectByName('disc');
        if (disc) { disc.rotation.y += dt * (2 + it.hovered * 6); disc.position.z = -Math.min(it.face.scale.x, 1) * (0.25 + Math.min(0.3, it.hovered * 0.15)); }
      }
      const dim = it.state === 'dim' || it.state === 'wrong';
      it.obj.scale.setScalar(appearScale * (dim ? 0.85 : 1) * (it.state === 'winner' ? 1.15 + Math.sin(this.time * 6) * 0.03 : 1));
      const gm = it.glow.material as THREE.MeshBasicMaterial;
      if (it.state === 'correct' || it.state === 'winner') { gm.color.set('#ffe86a'); gm.opacity = 0.55 + Math.sin(this.time * 8) * 0.2; }
      else if (it.state === 'wrong') { gm.color.set('#ff4040'); gm.opacity = 0.35; }
      else if (votes.length) { gm.color.set(votes[Math.floor(this.time * 3) % votes.length]); gm.opacity = 0.45; }
      else if (mine === it.opt.id) { gm.color.set('#ffffff'); gm.opacity = 0.4; }
      else { gm.opacity = Math.min(0.45, it.hovered * 0.25); gm.color.set('#fff3b0'); }
      it.face.traverse((o) => {
        const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] | undefined;
        const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
        for (const m of mats) if (m && 'color' in m && m.userData.base === undefined) m.userData.base = m.color.getHex();
        for (const m of mats) if (m && m.userData.base !== undefined) m.color.setHex(m.userData.base).multiplyScalar(dim ? 0.45 : 1);
      });
    }
    void this.pond;
  }
}

function side(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color });
}

function sleeveTexture(opt: BoardOption): THREE.Texture {
  const p = new Painter(32);
  const col = opt.color ?? ['#c9a2ff', '#ff6fb5', '#4cc3ff', '#ffd04c', '#6fc2a1'][Math.abs(hash(opt.label)) % 5];
  p.clear(shade(col, -0.3));
  p.rect(1, 1, 30, 30, col);
  p.ring(16, 16, 13, 2, shade(col, -0.2));
  p.circle(16, 16, 6, '#f4f1e8');
  p.circle(16, 16, 1.5, '#1b1420');
  p.noise(1, 1, 30, 30, shade(col, 0.15), 0.08, hash(opt.label) & 255);
  return p.texture();
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

let glowTex: THREE.Texture | null = null;

/** Soft pixel-stepped halo used under hovered / voted / revealed board items. */
function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      // Rounded-square falloff, quantised into a few bands for a pixel-art look.
      const dx = Math.max(0, Math.abs(x - 15.5) - 8) / 8;
      const dy = Math.max(0, Math.abs(y - 15.5) - 8) / 8;
      const d = Math.min(1, Math.hypot(dx, dy));
      const a = Math.round((1 - d) * 4) / 4;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(x, y, 1, 1);
    }
  glowTex = new THREE.CanvasTexture(c);
  glowTex.magFilter = THREE.NearestFilter;
  glowTex.minFilter = THREE.NearestFilter;
  return glowTex;
}
