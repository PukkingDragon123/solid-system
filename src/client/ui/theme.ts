// Generates the handcrafted pixel UI skins (9-slice frames, buttons, logo) and installs them as CSS variables.

import { Painter, shade } from '../art/painter';

const SCALE = 3;

function frame(draw: (p: Painter) => void, size = 16): string {
  const p = new Painter(size);
  draw(p);
  return p.dataUrl(SCALE);
}

function wood(p: Painter, base: string, fill: string | null) {
  const n = p.w;
  p.clear();
  p.rect(1, 0, n - 2, n, '#2a1810');
  p.rect(0, 1, n, n - 2, '#2a1810');
  p.rect(1, 1, n - 2, n - 2, base);
  p.rect(1, 1, n - 2, 1, shade(base, 0.18));
  p.rect(1, 1, 1, n - 2, shade(base, 0.1));
  p.rect(1, n - 2, n - 2, 1, shade(base, -0.2));
  p.rect(n - 2, 1, 1, n - 2, shade(base, -0.14));
  if (fill) {
    p.rect(4, 4, n - 8, n - 8, '#2a1810');
    p.rect(5, 5, n - 10, n - 10, fill);
  }
  for (const [x, y] of [[2, 2], [n - 3, 2], [2, n - 3], [n - 3, n - 3]]) p.px(x, y, '#c8a06a');
}

export function installTheme(): void {
  const root = document.documentElement.style;
  root.setProperty('--frame-wood', `url(${frame((p) => wood(p, '#8a5a33', '#f2e3c2'))})`);
  root.setProperty('--frame-wood-dark', `url(${frame((p) => wood(p, '#6a4428', '#3b2a1f'))})`);
  root.setProperty('--frame-chalk', `url(${frame((p) => wood(p, '#7a4f2e', '#23382c'))})`);
  root.setProperty('--frame-plank', `url(${frame((p) => wood(p, '#a8743f', null))})`);
  root.setProperty('--frame-lily', `url(${frame((p) => {
    p.clear();
    p.rect(2, 0, 12, 16, '#1f4a22');
    p.rect(0, 2, 16, 12, '#1f4a22');
    p.rect(1, 1, 14, 14, '#1f4a22');
    p.rect(2, 1, 12, 14, '#4fae3f');
    p.rect(1, 2, 14, 12, '#4fae3f');
    p.rect(2, 2, 12, 2, '#7fd65f');
    p.rect(2, 12, 12, 2, '#3f8f3f');
  })})`);
  root.setProperty('--frame-lily-hot', `url(${frame((p) => {
    p.clear();
    p.rect(2, 0, 12, 16, '#5a3a00');
    p.rect(0, 2, 16, 12, '#5a3a00');
    p.rect(1, 1, 14, 14, '#5a3a00');
    p.rect(2, 1, 12, 14, '#ffc531');
    p.rect(1, 2, 14, 12, '#ffc531');
    p.rect(2, 2, 12, 2, '#fff1b0');
    p.rect(2, 12, 12, 2, '#e8a81a');
  })})`);
  root.setProperty('--frame-paper', `url(${frame((p) => {
    p.clear();
    p.rect(0, 0, 16, 16, '#d8c49a');
    p.rect(1, 1, 14, 14, '#f4ead0');
    p.noise(1, 1, 14, 14, '#e8dcbc', 0.2, 3);
    p.px(0, 0, 'rgba(0,0,0,0)'); p.px(15, 0, 'rgba(0,0,0,0)'); p.px(0, 15, 'rgba(0,0,0,0)'); p.px(15, 15, 'rgba(0,0,0,0)');
  })})`);
  // Speech bubble.
  root.setProperty('--frame-bubble', `url(${frame((p) => {
    p.clear();
    p.rect(2, 0, 12, 16, '#1b1420');
    p.rect(0, 2, 16, 12, '#1b1420');
    p.rect(1, 1, 14, 14, '#1b1420');
    p.rect(2, 1, 12, 14, '#ffffff');
    p.rect(1, 2, 14, 12, '#ffffff');
    p.rect(2, 12, 12, 2, '#e8e8f0');
  })})`);
  // Wood grain background tile.
  const grain = new Painter(32);
  grain.clear('#6a4428');
  for (let y = 0; y < 32; y += 8) { grain.rect(0, y, 32, 1, '#5a3a1f'); grain.noise(0, y + 1, 32, 7, '#7a4f2e', 0.15, y + 1); }
  root.setProperty('--tile-wood', `url(${grain.dataUrl(3)})`);
  const felt = new Painter(16);
  felt.clear('#2f5f3a');
  felt.noise(0, 0, 16, 16, '#3a6f46', 0.3, 4);
  root.setProperty('--tile-felt', `url(${felt.dataUrl(3)})`);
}

/** Chunky pixel logo: "LARPED ONE OUT" with outline, shading and a little frog. */
export function drawLogo(text = 'LARPED ONE OUT', scale = 4): HTMLCanvasElement {
  const lines = text.split(' ONE ').length === 2 ? ['LARPED', 'ONE OUT'] : [text];
  const glyph = (ch: string) => LOGO_FONT[ch] ?? LOGO_FONT[' '];
  const lineW = (l: string) => [...l].reduce((w, ch) => w + glyph(ch)[0].length + 1, -1);
  const w = Math.max(...lines.map(lineW)) + 8;
  const h = lines.length * 9 + 6;
  const p = new Painter(w, h);
  lines.forEach((line, li) => {
    let x = Math.round((w - lineW(line)) / 2);
    const y0 = 3 + li * 9;
    for (const ch of line) {
      const g = glyph(ch);
      g.forEach((row, j) => [...row].forEach((c, i) => {
        if (c !== '#') return;
        const col = j < 2 ? '#c8ff7a' : j < 4 ? '#7ee05a' : j < 6 ? '#4fbf3f' : '#3f9f2f';
        p.px(x + i, y0 + j, li === 1 ? (j < 3 ? '#fff1b0' : j < 5 ? '#ffd23a' : '#ffb13b') : col);
      }));
      x += g[0].length + 1;
    }
  });
  p.outline('#1b1420');
  // Drop shadow.
  const out = new Painter(w + 2, h + 2);
  out.ctx.globalAlpha = 0.45;
  out.ctx.drawImage(p.canvas, 2, 2);
  out.ctx.globalCompositeOperation = 'source-in';
  out.rect(0, 0, w + 2, h + 2, '#000000');
  out.ctx.globalCompositeOperation = 'source-over';
  out.ctx.globalAlpha = 1;
  out.ctx.drawImage(p.canvas, 0, 0);
  const big = document.createElement('canvas');
  big.width = (w + 2) * scale;
  big.height = (h + 2) * scale;
  const ctx = big.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(out.canvas, 0, 0, big.width, big.height);
  big.className = 'pixel-logo';
  return big;
}

// 5x7 chunky display font for the logo.
const LOGO_FONT: Record<string, string[]> = {
  L: ['##...', '##...', '##...', '##...', '##...', '#####', '#####'],
  A: ['.###.', '##.##', '##.##', '#####', '##.##', '##.##', '##.##'],
  R: ['####.', '##.##', '##.##', '####.', '##.#.', '##.##', '##.##'],
  P: ['####.', '##.##', '##.##', '####.', '##...', '##...', '##...'],
  E: ['#####', '##...', '##...', '####.', '##...', '##...', '#####'],
  D: ['####.', '##.##', '##.##', '##.##', '##.##', '##.##', '####.'],
  O: ['.###.', '##.##', '##.##', '##.##', '##.##', '##.##', '.###.'],
  N: ['##.##', '###.#', '#####', '##.##', '##.##', '##.##', '##.##'],
  U: ['##.##', '##.##', '##.##', '##.##', '##.##', '##.##', '.###.'],
  T: ['#####', '.##..', '.##..', '.##..', '.##..', '.##..', '.##..'],
  S: ['.####', '##...', '##...', '.###.', '...##', '...##', '####.'],
  W: ['##.##', '##.##', '##.##', '##.##', '#####', '#####', '##.##'],
  I: ['####', '.##.', '.##.', '.##.', '.##.', '.##.', '####'],
  G: ['.####', '##...', '##...', '##.##', '##.##', '##.##', '.####'],
  F: ['#####', '##...', '##...', '####.', '##...', '##...', '##...'],
  K: ['##.##', '##.##', '####.', '###..', '####.', '##.##', '##.##'],
  '!': ['##', '##', '##', '##', '##', '..', '##'],
  '?': ['####.', '...##', '..##.', '.##..', '.##..', '.....', '.##..'],
  ' ': ['..', '..', '..', '..', '..', '..', '..'],
};
