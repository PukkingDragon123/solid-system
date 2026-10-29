// Small HUD widgets: lily-pad timer, QR code, emote bar, speech bubbles, title cards.

import QRCode from 'qrcode';
import { EMOTE_BY_ID } from '../../shared/catalog';
import { Painter } from '../art/painter';
import { h } from '../ui/dom';

export class LilyTimer {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private label: HTMLElement;
  private p = new Painter(24);
  private lastSec = -1;
  onTick?: (secondsLeft: number) => void;

  constructor() {
    this.canvas = this.p.canvas;
    this.label = h('span', null, '');
    this.el = h('div', { class: 'timer' }, this.canvas, this.label);
  }

  set(remainingMs: number, totalMs: number): void {
    const frac = Math.max(0, Math.min(1, remainingMs / Math.max(1, totalMs)));
    const sec = Math.ceil(remainingMs / 1000);
    const p = this.p;
    p.clear();
    p.circle(12, 12, 11.5, '#1f4a22');
    p.circle(12, 12, 10.5, '#2f7f3f');
    // Pie of remaining time.
    const ctx = p.ctx;
    ctx.fillStyle = frac < 0.25 ? '#ff6f5f' : frac < 0.5 ? '#ffd23a' : '#7fd65f';
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 24; x++) {
        const dx = x - 11.5, dy = y - 11.5;
        if (dx * dx + dy * dy > 90) continue;
        const a = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
        if (a <= frac * Math.PI * 2) ctx.fillRect(x, y, 1, 1);
      }
    p.ring(12, 12, 11.5, 1, '#1b1420');
    this.label.textContent = remainingMs > 0 ? String(sec) : '0';
    this.el.classList.toggle('hurry', sec <= 5 && remainingMs > 0);
    if (sec !== this.lastSec) {
      this.lastSec = sec;
      if (remainingMs > 0) this.onTick?.(sec);
    }
  }
}

export async function qrCanvas(text: string): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas');
  await QRCode.toCanvas(c, text, { margin: 1, scale: 4, color: { dark: '#1b1420', light: '#ffffff' }, errorCorrectionLevel: 'M' });
  c.className = 'qr';
  return c;
}

export function emoteBar(emotes: string[], onEmote: (id: string) => void): HTMLElement {
  const bar = h('div', { class: 'emote-bar wood dark' });
  for (const id of emotes.slice(0, 8)) {
    const e = EMOTE_BY_ID[id];
    if (!e) continue;
    bar.appendChild(h('button', { title: e.name, onclick: (ev: Event) => { ev.stopPropagation(); onEmote(id); } }, e.icon));
  }
  return bar;
}

export function titleCard(big: string, mid?: string, extra?: HTMLElement): HTMLElement {
  return h('div', { class: 'overlay passthrough' }, h('div', { class: 'titlecard card-pop' }, h('div', { class: 'big' }, big), mid ? h('div', { class: 'mid' }, mid) : null, extra ?? null));
}

export function typewriter(el: HTMLElement, text: string, cps = 45): () => void {
  let i = 0;
  el.textContent = '';
  const id = window.setInterval(() => {
    i += 2;
    el.textContent = text.slice(0, i);
    if (i >= text.length) window.clearInterval(id);
  }, 1000 / (cps / 2));
  return () => { window.clearInterval(id); el.textContent = text; };
}
