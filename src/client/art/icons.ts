// Hand-designed (procedural) pixel art: category icons, map postcards, album covers, stickers.

import type { CoverSpec } from '../../shared/content';
import { hashSeed, Painter, shade } from './painter';

const INK = '#1b1420';
const cache = new Map<string, string>();

function cached(key: string, scale: number, draw: () => Painter): string {
  const k = `${key}@${scale}`;
  let v = cache.get(k);
  if (!v) {
    v = draw().dataUrl(scale);
    cache.set(k, v);
  }
  return v;
}

// ───────────────────────── category icons (32×32) ─────────────────────────

export function drawIcon(p: Painter, art: string, color: string, ox = 0, oy = 0): void {
  const c = color;
  const d = shade(color, -0.18);
  const l = shade(color, 0.18);
  const W = '#f4f1e8';
  const G = '#ffd23a';
  const P = (x: number, y: number, w: number, h: number, col: string) => p.rect(ox + x, oy + y, w, h, col);
  const C = (x: number, y: number, r: number, col: string) => p.circle(ox + x, oy + y, r, col);
  switch (art) {
    case 'mic':
      P(14, 16, 4, 12, '#8a8fa8'); P(13, 26, 6, 2, '#5d6178');
      C(16, 10, 7, '#c8ccd8'); for (let y = 5; y < 16; y += 2) for (let x = 10; x < 23; x += 2) if ((x - 16) ** 2 + (y - 10) ** 2 < 36) P(x, y, 1, 1, '#8a8fa8');
      P(10, 15, 12, 2, c);
      break;
    case 'guitar':
      p.ellipse(ox + 12, oy + 22, 8, 7, c); p.ellipse(ox + 12, oy + 22, 4, 3.5, d); C(12, 22, 2.2, INK);
      p.line(ox + 14, oy + 18, ox + 26, oy + 5, '#8a5a33', 3); P(24, 2, 5, 5, '#5a3a1f'); p.line(ox + 13, oy + 20, ox + 25, oy + 6, W, 1);
      break;
    case 'star':
      p.poly(starPts(ox + 16, oy + 17, 13, 5.5), c); p.poly(starPts(ox + 16, oy + 17, 8, 3.5), l); P(11, 15, 2, 3, INK); P(19, 15, 2, 3, INK);
      break;
    case 'cassette':
      P(3, 8, 26, 17, c); P(6, 11, 20, 8, W); C(11, 15, 3, INK); C(21, 15, 3, INK); C(11, 15, 1.5, '#8a8fa8'); C(21, 15, 1.5, '#8a8fa8'); P(9, 21, 14, 4, d);
      break;
    case 'lightning':
      p.poly([[ox + 18, oy + 2], [ox + 7, oy + 18], [ox + 15, oy + 18], [ox + 12, oy + 30], [ox + 25, oy + 12], [ox + 17, oy + 12], [ox + 21, oy + 2]], c);
      p.poly([[ox + 17, oy + 5], [ox + 11, oy + 15], [ox + 15, oy + 15]], l);
      break;
    case 'boombox':
      P(3, 11, 26, 15, c); P(9, 6, 14, 2, '#5d6178'); P(8, 6, 2, 6, '#5d6178'); P(22, 6, 2, 6, '#5d6178');
      C(9, 19, 5, INK); C(23, 19, 5, INK); C(9, 19, 2.5, '#8a8fa8'); C(23, 19, 2.5, '#8a8fa8'); P(13, 13, 6, 3, G);
      break;
    case 'flipphone':
      P(9, 3, 14, 12, '#c8ccd8'); P(11, 5, 10, 8, c); P(9, 16, 14, 13, '#8a8fa8'); for (let y = 18; y < 28; y += 3) for (let x = 11; x < 21; x += 4) P(x, y, 2, 2, W);
      break;
    case 'phone':
      P(9, 2, 14, 28, INK); P(10, 4, 12, 23, c); P(13, 3, 6, 1, '#5d6178'); P(12, 7, 8, 3, l); P(12, 12, 8, 8, W); P(14, 28, 4, 1, '#5d6178');
      break;
    case 'headphones':
      p.ring(ox + 16, oy + 17, 12, 3, '#2b2b38'); P(2, 16, 8, 11, c); P(22, 16, 8, 11, c); P(4, 18, 4, 7, d); P(24, 18, 4, 7, d); P(0, 0, 32, 12, 'rgba(0,0,0,0)');
      break;
    case 'skull':
      C(16, 13, 10, W); P(10, 20, 12, 7, W); C(12, 13, 3, INK); C(20, 13, 3, INK); P(15, 17, 2, 3, INK); for (let x = 11; x < 22; x += 3) P(x, 24, 1, 3, INK);
      P(5, 26, 6, 3, '#ff8a3d'); P(21, 26, 6, 3, '#ff8a3d');
      break;
    case 'sakura':
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; C(16 + Math.cos(a) * 7, 16 + Math.sin(a) * 7, 5.5, c); }
      C(16, 16, 4, l); C(16, 16, 2, G);
      break;
    case 'clapper':
      P(4, 13, 24, 15, INK); P(6, 15, 20, 11, '#5d6178'); p.poly([[ox + 4, oy + 12], [ox + 26, oy + 5], [ox + 28, oy + 10], [ox + 6, oy + 16]], W);
      for (let i = 0; i < 4; i++) p.line(ox + 8 + i * 5, oy + 13 - i * 1.6, ox + 10 + i * 5, oy + 9 - i * 1.6, INK, 2);
      break;
    case 'tv':
      p.line(ox + 11, oy + 2, ox + 15, oy + 8, INK); p.line(ox + 22, oy + 2, ox + 17, oy + 8, INK);
      P(3, 8, 26, 19, '#8a5a33'); P(5, 10, 17, 15, c); P(7, 12, 6, 3, l); P(24, 12, 3, 3, G); P(24, 17, 3, 3, '#5d6178'); P(6, 27, 3, 3, INK); P(23, 27, 3, 3, INK);
      break;
    case 'violin':
      p.ellipse(ox + 16, oy + 22, 7, 7, '#b5651d'); p.ellipse(ox + 16, oy + 13, 5.5, 5, '#b5651d'); P(15, 2, 2, 12, INK); P(14, 1, 4, 3, '#5a3a1f');
      P(13, 18, 1, 3, INK); P(18, 18, 1, 3, INK); p.line(ox + 3, oy + 28, ox + 29, oy + 8, c, 1);
      break;
    case 'campfire':
      p.poly([[ox + 16, oy + 3], [ox + 24, oy + 20], [ox + 16, oy + 26], [ox + 8, oy + 20]], '#ff8a2a'); p.poly([[ox + 16, oy + 10], [ox + 20, oy + 21], [ox + 12, oy + 21]], G);
      p.line(ox + 5, oy + 27, ox + 27, oy + 23, '#8a5a33', 3); p.line(ox + 5, oy + 23, ox + 27, oy + 27, '#5a3a1f', 3);
      break;
    case 'popcorn':
      p.poly([[ox + 7, oy + 12], [ox + 25, oy + 12], [ox + 22, oy + 30], [ox + 10, oy + 30]], W); for (let x = 9; x < 24; x += 5) P(x, 12, 2, 18, c);
      for (const [x, y] of [[9, 9], [13, 6], [18, 7], [22, 9], [16, 10], [11, 11], [20, 11]]) C(x, y, 3, '#fff6c9');
      break;
    case 'remote':
      P(11, 3, 10, 26, '#2b2b38'); C(16, 8, 2.5, c); for (let y = 13; y < 26; y += 4) { P(13, y, 2, 2, W); P(17, y, 2, 2, W); }
      break;
    case 'scroll':
      P(6, 7, 20, 18, '#f1d9b0'); P(4, 5, 24, 4, '#c8a06a'); P(4, 23, 24, 4, '#c8a06a'); for (let y = 11; y < 22; y += 3) P(9, y, 14, 1, shade('#f1d9b0', -0.3));
      P(14, 11, 4, 4, c);
      break;
    case 'gamepad':
      p.ellipse(ox + 16, oy + 18, 13, 8, c); P(7, 15, 6, 2, INK); P(9, 13, 2, 6, INK); C(22, 15, 1.6, G); C(25, 18, 1.6, '#ff5d5d'); C(19, 18, 1.6, '#4aa3ff'); C(22, 21, 1.6, '#6fe05a');
      break;
    case 'lilypad':
      C(16, 18, 12, c); p.poly([[ox + 16, oy + 18], [ox + 30, oy + 13], [ox + 30, oy + 22]], 'rgba(0,0,0,0)'); clearWedge(p, ox + 16, oy + 18);
      C(16, 18, 7, l); C(13, 12, 4, '#ff9ec9'); C(13, 12, 2, G);
      break;
    case 'dice':
      P(5, 5, 22, 22, W); P(5, 25, 22, 2, '#c8ccd8'); for (const [x, y] of [[9, 9], [21, 9], [15, 15], [9, 21], [21, 21]]) C(x + 1, y + 1, 2.3, INK);
      break;
    case 'vinyl':
      C(16, 16, 14, '#161619'); p.ring(ox + 16, oy + 16, 11, 1, '#2b2b38'); p.ring(ox + 16, oy + 16, 8, 1, '#2b2b38'); C(16, 16, 5, c); C(16, 16, 1.2, INK);
      break;
    case 'spotlight':
      p.poly([[ox + 13, oy + 2], [ox + 19, oy + 2], [ox + 30, oy + 30], [ox + 2, oy + 30]], 'rgba(255,240,180,0.55)'); P(11, 1, 10, 5, '#5d6178'); p.poly(starPts(ox + 16, oy + 22, 6, 2.5), G);
      break;
    case 'rematch':
      p.ring(ox + 16, oy + 16, 12, 4, c); p.poly([[ox + 25, oy + 3], [ox + 31, oy + 12], [ox + 21, oy + 12]], c); P(12, 12, 8, 8, W);
      break;
    case 'bottle':
      P(13, 3, 6, 6, '#3a8a5a'); P(10, 9, 12, 20, '#4fae6f'); P(12, 12, 3, 12, '#9be3b4'); P(11, 1, 10, 3, '#8a5a33');
      break;
    case 'door':
      P(7, 3, 18, 27, '#8a5a33'); P(9, 5, 14, 23, '#b5794a'); C(21, 17, 1.5, G); P(10, 7, 12, 1, '#5a3a1f');
      break;
    default:
      C(16, 16, 10, c); C(16, 16, 5, l);
  }
}

function clearWedge(p: Painter, cx: number, cy: number) {
  p.ctx.save();
  p.ctx.globalCompositeOperation = 'destination-out';
  p.poly([[cx, cy], [cx + 16, cy - 6], [cx + 16, cy + 4]], '#000');
  p.ctx.restore();
}

function starPts(cx: number, cy: number, r: number, ri: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : ri;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}

export function iconUrl(art: string, color: string, scale = 4): string {
  return cached(`icon:${art}:${color}`, scale, () => {
    const p = new Painter(32);
    drawIcon(p, art, color);
    p.outline();
    return p;
  });
}

// ───────────────────────── map postcards (48×32) ─────────────────────────

export function drawMap(p: Painter, id: string): void {
  const sky = (top: string, bottom: string) => {
    for (let y = 0; y < 32; y++) p.rect(0, y, 48, 1, y < 16 ? top : bottom);
  };
  switch (id) {
    case 'swamp_clubhouse':
      sky('#2a3b5c', '#2f5f3a');
      p.noise(0, 0, 48, 14, '#fff1b0', 0.02, 3);
      p.rect(0, 22, 48, 10, '#3f7f52'); p.rect(0, 26, 48, 6, '#2f6fa0'); p.noise(0, 26, 48, 6, '#7fc4ff', 0.08, 5);
      p.poly([[12, 12], [24, 4], [36, 12]], '#8a3a2e'); p.rect(14, 12, 20, 12, '#8a5a33'); p.rect(17, 15, 5, 4, '#ffd23a'); p.rect(26, 15, 5, 9, '#5a3a1f');
      p.ellipse(8, 28, 5, 2, '#4fae3f'); p.ellipse(40, 29, 4, 1.5, '#4fae3f');
      break;
    case 'mushroom_tavern':
      sky('#1c1030', '#2a1d3f');
      p.rect(22, 14, 6, 14, '#e8d9c0'); p.ellipse(25, 13, 16, 8, '#c77dff'); p.rect(9, 13, 32, 3, '#c77dff');
      for (const [x, y] of [[18, 9], [29, 8], [35, 12], [14, 12]]) p.circle(x, y, 2, '#f4f1e8');
      p.rect(23, 21, 4, 7, '#5a3a1f'); p.rect(0, 28, 48, 4, '#3b2a4f'); p.ellipse(7, 26, 4, 3, '#4dffea'); p.rect(6, 26, 2, 4, '#e8d9c0'); p.ellipse(42, 25, 4, 3, '#ff7ad1'); p.rect(41, 25, 2, 5, '#e8d9c0');
      break;
    case 'rainy_cabin':
      sky('#3b4b6a', '#2f4f3f');
      p.rect(0, 24, 48, 8, '#2f5f3a'); p.poly([[10, 14], [24, 5], [38, 14]], '#5a3a1f'); p.rect(12, 14, 24, 11, '#8a5a33'); p.rect(16, 17, 6, 4, '#ffd23a');
      for (let i = 0; i < 40; i++) { const x = (i * 13) % 48, y = (i * 7) % 30; p.rect(x, y, 1, 3, 'rgba(184,198,255,0.7)'); }
      p.line(40, 1, 37, 7, '#fff6c9'); p.line(37, 7, 41, 9, '#fff6c9'); p.line(41, 9, 38, 15, '#fff6c9');
      break;
    case 'lilypad_disco':
      sky('#1a0b2e', '#1a2b5a');
      p.rect(0, 22, 48, 10, '#1a3b6a'); p.ellipse(24, 26, 16, 4, '#4fae3f'); p.circle(24, 8, 6, '#d8d8e8');
      for (let y = 3; y < 14; y += 2) for (let x = 18; x < 31; x += 2) if ((x - 24) ** 2 + (y - 8) ** 2 < 34) p.px(x, y, (x + y) % 4 ? '#8a8fa8' : '#ffffff');
      p.line(20, 12, 8, 30, 'rgba(255,111,216,0.6)', 2); p.line(28, 12, 40, 30, 'rgba(77,255,234,0.6)', 2); p.line(24, 0, 24, 2, '#8a8fa8');
      break;
    case 'frog_arcade':
      sky('#120a24', '#1c1030');
      p.rect(0, 26, 48, 6, '#2b1d4f'); for (let x = 0; x < 48; x += 4) p.rect(x, 26, 2, 6, '#3b2a6f');
      for (const [x, col] of [[6, '#4dffea'], [20, '#ff2fa0'], [34, '#ffd23a']] as const) {
        p.rect(x, 8, 9, 18, '#2b2b38'); p.rect(x + 1, 10, 7, 6, col); p.rect(x + 1, 18, 7, 2, '#5d6178'); p.rect(x + 3, 19, 1, 1, '#ff5d5d'); p.rect(x, 6, 9, 2, col);
      }
      break;
    case 'moonlit_pond':
      sky('#0f1838', '#132a4a');
      p.noise(0, 0, 48, 18, '#ffffff', 0.03, 11); p.circle(34, 10, 7, '#fff6d8'); p.circle(32, 8, 2, '#e8e0b8');
      p.rect(0, 22, 48, 10, '#1a3b6a'); p.ellipse(34, 25, 6, 1, '#fff6d8'); p.ellipse(12, 27, 5, 1.5, '#4fae3f'); p.ellipse(26, 29, 4, 1.2, '#4fae3f');
      for (const x of [3, 5, 44, 46]) { p.rect(x, 12, 1, 12, '#3f7f52'); p.rect(x, 11, 1, 3, '#8a5a33'); }
      break;
    default:
      sky('#2a3b5c', '#2f5f3a');
  }
}

export function mapUrl(id: string, scale = 4): string {
  return cached(`map:${id}`, scale, () => {
    const p = new Painter(48, 32);
    drawMap(p, id);
    return p;
  });
}

// ───────────────────────── album covers (32×32) ─────────────────────────

export function drawCover(p: Painter, c: CoverSpec): void {
  const { bg, fg, accent } = c;
  p.clear(bg);
  const W = '#f4f1e8';
  switch (c.motif) {
    case 'lilypad_moon':
      p.noise(0, 0, 32, 18, W, 0.03, 4); p.circle(22, 9, 6, accent); p.circle(20, 8, 1.5, shade(accent, -0.1));
      p.rect(0, 22, 32, 10, shade(bg, 0.1)); p.ellipse(9, 25, 7, 2.5, fg); p.ellipse(24, 28, 6, 2, fg); p.circle(9, 23, 1.5, '#ff9ec9');
      break;
    case 'lightning_guitar':
      p.ellipse(12, 22, 7, 6, fg); p.circle(12, 22, 2, '#1b1420'); p.line(14, 18, 26, 4, '#8a5a33', 2);
      p.poly([[20, 6], [14, 16], [18, 16], [15, 26], [24, 13], [20, 13], [23, 6]], accent);
      break;
    case 'sun_flies':
      p.circle(16, 14, 8, accent); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; p.line(16 + Math.cos(a) * 10, 14 + Math.sin(a) * 10, 16 + Math.cos(a) * 13, 14 + Math.sin(a) * 13, accent); }
      p.circle(16, 14, 6, fg);
      for (const [x, y] of [[5, 5], [26, 6], [6, 25], [25, 26], [16, 28]]) { p.rect(x, y, 2, 2, '#1b1420'); p.px(x - 1, y - 1, W); p.px(x + 2, y - 1, W); }
      break;
    case 'crown_log':
      p.rect(4, 22, 24, 7, '#8a5a33'); p.circle(4, 25, 3.5, '#b5794a'); p.circle(4, 25, 1.5, '#5a3a1f'); p.rect(4, 22, 24, 1, '#b5794a');
      p.poly([[9, 19], [9, 10], [12, 14], [16, 7], [20, 14], [23, 10], [23, 19]], fg); p.circle(16, 16, 1.5, accent); p.circle(11, 17, 1, accent); p.circle(21, 17, 1, accent);
      break;
    case 'neon_grid':
      p.circle(16, 12, 8, fg); for (let y = 8; y < 20; y += 3) p.rect(8, y, 16, 1, bg);
      p.rect(0, 20, 32, 12, shade(bg, 0.05)); for (let y = 21; y < 32; y += 3) p.rect(0, y, 32, 1, accent); for (let x = -16; x < 48; x += 6) p.line(16, 20, x, 32, accent);
      break;
    case 'skateboard':
      p.rect(3, 15, 26, 4, fg); p.rect(2, 14, 2, 4, fg); p.rect(28, 14, 2, 4, fg); p.rect(5, 15, 22, 1, accent);
      p.circle(8, 21, 2.5, '#1b1420'); p.circle(24, 21, 2.5, '#1b1420'); p.circle(8, 21, 1, W); p.circle(24, 21, 1, W);
      p.noise(0, 0, 32, 10, W, 0.05, 9);
      break;
    case 'gamepad':
      p.ellipse(16, 17, 12, 7, fg); p.rect(7, 15, 5, 2, '#1b1420'); p.rect(8, 14, 2, 5, '#1b1420'); p.circle(22, 15, 1.5, accent); p.circle(25, 18, 1.5, accent);
      p.text('1UP', 9, 4, accent);
      break;
    case 'sakura_frog':
      for (const [x, y] of [[4, 4], [26, 8], [8, 26], [27, 25], [16, 3]]) { p.circle(x, y, 2.5, W); p.circle(x, y, 1, fg); }
      p.ellipse(16, 20, 8, 6, '#5fbf3f'); p.circle(12, 14, 3, '#5fbf3f'); p.circle(20, 14, 3, '#5fbf3f'); p.circle(12, 14, 1.5, W); p.circle(20, 14, 1.5, W); p.px(12, 14, '#1b1420'); p.px(20, 14, '#1b1420');
      p.rect(9, 18, 14, 2, fg);
      break;
    case 'mountain_pond':
      p.poly([[0, 22], [10, 6], [18, 18], [24, 10], [32, 22]], fg); p.poly([[10, 6], [13, 11], [7, 11]], W); p.poly([[24, 10], [26, 14], [22, 14]], W);
      p.rect(0, 22, 32, 10, '#2f6fa0'); p.noise(0, 23, 32, 9, '#7fc4ff', 0.1, 2); p.circle(26, 4, 3, accent);
      break;
    case 'street_sign':
      p.rect(15, 12, 2, 20, '#5d6178'); p.rect(3, 6, 26, 8, fg); p.rect(4, 7, 24, 6, accent); p.text('SWAMP', 6, 8, W);
      p.rect(0, 28, 32, 4, '#3f7f52');
      break;
    case 'moon_window':
      p.rect(5, 4, 22, 22, '#5a3a1f'); p.rect(7, 6, 18, 18, shade(bg, -0.05)); p.circle(19, 11, 4, fg); p.rect(15, 6, 2, 18, '#5a3a1f'); p.rect(7, 14, 18, 2, '#5a3a1f');
      p.rect(3, 26, 26, 3, '#8a5a33'); p.rect(9, 23, 3, 3, accent); p.rect(20, 22, 4, 4, '#3fbf6a');
      break;
    case 'disco_ball':
      p.line(16, 0, 16, 5, '#8a8fa8'); p.circle(16, 14, 9, fg);
      for (let y = 6; y < 23; y += 2) for (let x = 7; x < 26; x += 2) if ((x - 16) ** 2 + (y - 14) ** 2 < 75) p.px(x, y, (x * 3 + y) % 5 ? '#8a8fa8' : W);
      p.line(10, 22, 2, 31, accent); p.line(22, 22, 30, 31, accent);
      break;
    case 'mud_guitar':
      p.ellipse(16, 27, 14, 4, '#5a3a1f'); p.ellipse(13, 18, 6, 6, fg); p.ellipse(13, 11, 4.5, 4, fg); p.circle(13, 16, 1.6, '#1b1420');
      p.line(15, 8, 25, 1, '#5a3a1f', 2); p.ellipse(25, 26, 3, 1, accent);
      break;
    default: {
      // Procedural fallback: seeded abstract shapes.
      let s = hashSeed(c.motif);
      const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
      for (let i = 0; i < 6; i++) p.circle(rnd() * 32, rnd() * 32, 2 + rnd() * 8, i % 2 ? fg : accent);
    }
  }
}

export function coverUrl(c: CoverSpec, scale = 4): string {
  return cached(`cover:${c.motif}:${c.bg}:${c.fg}:${c.accent}`, scale, () => {
    const p = new Painter(32);
    drawCover(p, c);
    return p;
  });
}

/** Deterministic cover for records without designed artwork (e.g. public-domain pieces). */
export function procCover(id: string, title: string): CoverSpec {
  const h = hashSeed(id);
  const palettes = [
    ['#2b2f4f', '#c9a2ff', '#ffe245'], ['#3b2414', '#d98a3d', '#f4f1e8'], ['#14062b', '#4dffea', '#ff2fa0'],
    ['#2f5f3a', '#9be36b', '#fff1b0'], ['#5a2f8a', '#ff7ad1', '#ffffff'], ['#1c2450', '#b8c6ff', '#ffb13b'],
  ];
  const [bg, fg, accent] = palettes[h % palettes.length];
  return { motif: `notes:${title}`, bg, fg, accent };
}

export function recordCoverUrl(id: string, title: string, cover?: CoverSpec, scale = 4): string {
  if (cover) return coverUrl(cover, scale);
  const c = procCover(id, title);
  return cached(`rec:${id}`, scale, () => {
    const p = new Painter(32);
    p.clear(c.bg);
    let s = hashSeed(id);
    const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
    for (let i = 0; i < 5; i++) p.ring(rnd() * 32, rnd() * 32, 4 + rnd() * 10, 1, i % 2 ? c.fg : shade(c.bg, 0.12));
    // A big music note.
    p.rect(17, 7, 2, 15, c.accent); p.rect(17, 7, 7, 2, c.accent); p.rect(22, 7, 2, 11, c.accent);
    p.ellipse(15, 22, 3.5, 2.6, c.accent); p.ellipse(20, 18, 3.5, 2.6, c.accent);
    p.text(title.slice(0, 1), 3, 3, c.fg, 2);
    return p;
  });
}

// ───────────────────────── stickers (16×16) ─────────────────────────

export function stickerUrl(id: string, scale = 4): string {
  return cached(`stk:${id}`, scale, () => {
    const p = new Painter(16);
    const W = '#f4f1e8';
    switch (id) {
      case 'stk_lily': p.circle(8, 9, 6.5, '#4fae3f'); p.circle(8, 9, 3.5, '#6fe05a'); p.circle(6, 5, 2.2, '#ff9ec9'); break;
      case 'stk_fly': p.ellipse(8, 9, 3, 2.5, '#2b2b38'); p.ellipse(5, 6, 3, 2, 'rgba(220,240,255,0.9)'); p.ellipse(11, 6, 3, 2, 'rgba(220,240,255,0.9)'); p.px(9, 8, '#ff5d5d'); break;
      case 'stk_note': p.rect(8, 2, 2, 10, '#ffd23a'); p.rect(8, 2, 5, 2, '#ffd23a'); p.ellipse(6, 12, 3, 2.2, '#ffd23a'); break;
      case 'stk_heart': p.circle(5, 6, 3.2, '#ff5d9e'); p.circle(11, 6, 3.2, '#ff5d9e'); p.poly([[2, 7], [14, 7], [8, 14]], '#ff5d9e'); p.px(4, 4, W); break;
      case 'stk_star': p.poly(starPts(8, 8.5, 7, 3), '#ffd23a'); break;
      case 'stk_mushroom': p.ellipse(8, 7, 7, 4.5, '#e8383d'); p.rect(6, 8, 4, 6, '#f1e3c8'); p.circle(5, 5, 1.2, W); p.circle(10, 4, 1, W); break;
      case 'stk_vinyl': p.circle(8, 8, 7, '#161619'); p.circle(8, 8, 2.5, '#ff5d5d'); p.ring(8, 8, 5, 1, '#2b2b38'); break;
      case 'stk_moon': p.circle(8, 8, 6.5, '#fff1b0'); p.circle(11, 6, 5, 'rgba(0,0,0,0)'); clearCircle(p, 11, 6, 5); break;
      case 'stk_rain': p.circle(5, 6, 3, '#c8ccd8'); p.circle(9, 5, 4, '#c8ccd8'); p.circle(12, 7, 3, '#c8ccd8'); for (const x of [5, 8, 11]) p.rect(x, 11, 1, 3, '#4aa3ff'); break;
      case 'stk_crown': p.poly([[2, 13], [2, 5], [5, 9], [8, 3], [11, 9], [14, 5], [14, 13]], '#ffc531'); p.px(8, 10, '#e8383d'); break;
      case 'stk_dj': p.circle(8, 9, 6, '#5fbf3f'); p.ring(8, 8, 7, 1.5, '#2b2b38'); p.rect(1, 7, 3, 5, '#ff5d5d'); p.rect(12, 7, 3, 5, '#ff5d5d'); p.circle(6, 7, 1.5, W); p.circle(10, 7, 1.5, W); break;
      case 'stk_toad': p.ellipse(8, 10, 7, 5, '#8a7a3f'); p.circle(5, 6, 2.5, '#8a7a3f'); p.circle(11, 6, 2, '#8a7a3f'); p.px(5, 6, '#1b1420'); p.px(11, 6, '#1b1420'); p.px(7, 11, '#5a4a1f'); p.px(10, 9, '#a89a5f'); break;
      default: p.circle(8, 8, 6, '#ffd23a');
    }
    p.outline(W);
    p.outline('#1b1420');
    return p;
  });
}

function clearCircle(p: Painter, cx: number, cy: number, r: number) {
  p.ctx.save();
  p.ctx.globalCompositeOperation = 'destination-out';
  p.circle(cx, cy, r, '#000');
  p.ctx.restore();
}

// ───────────────────────── glove cursor (16×16) ─────────────────────────

export function gloveUrl(color: string, pressed = false, scale = 3): string {
  return cached(`glove:${color}:${pressed}`, scale, () => {
    const p = new Painter(18);
    const W = '#ffffff';
    const sh = '#d8d8e8';
    // Pointing cartoon glove (index finger up-left), cuff in the player's colour.
    const o = pressed ? 1 : 0;
    p.rect(2 + o, 1 + o, 3, 8, W); // index finger
    p.rect(3 + o, 1 + o, 1, 1, sh);
    p.rect(4 + o, 6 + o, 7, 7, W); // palm
    p.rect(5 + o, 5 + o, 2, 3, W);
    p.rect(7 + o, 5 + o, 2, 3, W);
    p.rect(9 + o, 6 + o, 2, 3, W);
    p.rect(2 + o, 8 + o, 3, 3, W); // thumb
    p.rect(5 + o, 12 + o, 6, 1, sh);
    p.rect(5 + o, 13 + o, 7, 3, color); // cuff
    p.rect(5 + o, 13 + o, 7, 1, shade(color, 0.2));
    p.rect(6 + o, 7 + o, 1, 2, sh); p.rect(8 + o, 7 + o, 1, 2, sh);
    p.outline('#1b1420');
    return p;
  });
}
