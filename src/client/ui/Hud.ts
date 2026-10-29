// HUD manager: screen-space layers over the 3D canvas, 3D-anchored labels, toasts and iris wipes.

import * as THREE from 'three';
import { h } from './dom';

export interface Anchor {
  el: HTMLElement;
  pos: () => THREE.Vector3 | null;
  offset?: [number, number];
  hideOffscreen?: boolean;
}

export class Hud {
  readonly root: HTMLElement;
  readonly anchorsLayer: HTMLElement;
  readonly cursorLayer: HTMLElement;
  readonly phaseLayer: HTMLElement;
  readonly topLayer: HTMLElement;
  readonly toasts: HTMLElement;
  private anchors = new Set<Anchor>();
  private tmp = new THREE.Vector3();

  constructor(container: HTMLElement) {
    this.root = h('div', { id: 'hud' });
    this.anchorsLayer = h('div', { class: 'layer passive' });
    this.phaseLayer = h('div', { class: 'layer' });
    this.cursorLayer = h('div', { class: 'layer passive' });
    this.topLayer = h('div', { class: 'layer' });
    this.toasts = h('div', { class: 'toasts' });
    this.root.append(this.anchorsLayer, this.phaseLayer, this.cursorLayer, this.topLayer, this.toasts);
    container.appendChild(this.root);
  }

  anchor(el: HTMLElement, pos: () => THREE.Vector3 | null, offset: [number, number] = [0, 0], hideOffscreen = true): Anchor {
    el.classList.add('anchor');
    this.anchorsLayer.appendChild(el);
    const a: Anchor = { el, pos, offset, hideOffscreen };
    this.anchors.add(a);
    return a;
  }

  unanchor(a: Anchor | null | undefined): void {
    if (!a) return;
    a.el.remove();
    this.anchors.delete(a);
  }

  clearAnchors(filter?: (a: Anchor) => boolean): void {
    for (const a of [...this.anchors]) if (!filter || filter(a)) this.unanchor(a);
  }

  project(world: THREE.Vector3, camera: THREE.Camera): { x: number; y: number; visible: boolean } {
    this.tmp.copy(world).project(camera);
    const w = this.root.clientWidth;
    const hh = this.root.clientHeight;
    return { x: (this.tmp.x * 0.5 + 0.5) * w, y: (-this.tmp.y * 0.5 + 0.5) * hh, visible: this.tmp.z < 1 && this.tmp.z > -1 };
  }

  update(camera: THREE.Camera): void {
    for (const a of this.anchors) {
      const p = a.pos();
      if (!p) { a.el.style.display = 'none'; continue; }
      const s = this.project(p, camera);
      if (!s.visible && a.hideOffscreen) { a.el.style.display = 'none'; continue; }
      a.el.style.display = '';
      a.el.style.transform = `translate(${Math.round(s.x + (a.offset?.[0] ?? 0))}px, ${Math.round(s.y + (a.offset?.[1] ?? 0))}px)`;
    }
  }

  toast(text: string, kind: 'wood' | 'chalk' | 'paper' = 'paper', ms = 3600): void {
    const el = h('div', { class: `toast ${kind}` }, text);
    this.toasts.appendChild(el);
    window.setTimeout(() => el.remove(), ms);
    while (this.toasts.children.length > 4) this.toasts.firstChild?.remove();
  }

  /** Mario-Party-style iris wipe: closes, runs `mid`, then opens. */
  iris(mid: () => void | Promise<void>, ms = 900): Promise<void> {
    const el = h('div', { class: 'iris' });
    this.root.appendChild(el);
    const half = ms / 2;
    return new Promise((resolve) => {
      el.animate([{ clipPath: 'circle(150% at 50% 50%)' }, { clipPath: 'circle(0% at 50% 50%)' }], { duration: half, easing: 'steps(10)', fill: 'forwards' }).onfinish = async () => {
        await mid();
        el.animate([{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(150% at 50% 50%)' }], { duration: half, easing: 'steps(10)', fill: 'forwards' }).onfinish = () => {
          el.remove();
          resolve();
        };
      };
    });
  }
}
