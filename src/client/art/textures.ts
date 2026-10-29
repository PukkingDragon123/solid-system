// Tileable pixel-art surface textures for the 3D environments.

import * as THREE from 'three';
import { Painter, shade } from './painter';

const texCache = new Map<string, THREE.Texture>();

function memo(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = texCache.get(key);
  if (!t) { t = make(); texCache.set(key, t); }
  return t;
}

export function planks(base = '#9a6b3f', repeat: [number, number] = [4, 4], key = 'planks'): THREE.Texture {
  return memo(`${key}:${base}:${repeat}`, () => {
    const p = new Painter(32);
    p.clear(base);
    for (let row = 0; row < 4; row++) {
      const y = row * 8;
      p.rect(0, y, 32, 1, shade(base, -0.16));
      const off = (row * 11) % 32;
      p.rect(off, y, 1, 8, shade(base, -0.14));
      p.rect((off + 16) % 32, y, 1, 8, shade(base, -0.14));
      p.noise(0, y + 1, 32, 7, shade(base, 0.06), 0.12, row + 1);
      p.noise(0, y + 1, 32, 7, shade(base, -0.08), 0.1, row + 7);
      for (let x = 2; x < 30; x += 9) p.rect(x + (row % 2) * 4, y + 3 + (x % 3), 4, 1, shade(base, -0.06));
    }
    return p.texture(repeat);
  });
}

export function logs(base = '#8a5a33', repeat: [number, number] = [3, 3]): THREE.Texture {
  return memo(`logs:${base}:${repeat}`, () => {
    const p = new Painter(32);
    p.clear(base);
    for (let row = 0; row < 4; row++) {
      const y = row * 8;
      p.rect(0, y, 32, 2, shade(base, 0.1));
      p.rect(0, y + 6, 32, 2, shade(base, -0.22));
      p.noise(0, y + 2, 32, 4, shade(base, -0.1), 0.15, row * 3 + 2);
      p.rect(((row * 13) % 28) + 2, y + 3, 3, 2, shade(base, -0.25));
    }
    return p.texture(repeat);
  });
}

export function stone(base = '#6c7088', repeat: [number, number] = [4, 4]): THREE.Texture {
  return memo(`stone:${base}:${repeat}`, () => {
    const p = new Painter(32);
    p.clear(shade(base, -0.2));
    const bricks = [[1, 1, 14, 7], [16, 1, 15, 7], [1, 9, 9, 7], [11, 9, 12, 7], [24, 9, 7, 7], [1, 17, 13, 7], [15, 17, 16, 7], [1, 25, 8, 6], [10, 25, 13, 6], [24, 25, 7, 6]];
    bricks.forEach(([x, y, w, h], i) => {
      const c = shade(base, ((i * 37) % 9) / 100 - 0.03);
      p.rect(x, y, w, h, c);
      p.rect(x, y, w, 1, shade(c, 0.1));
      p.noise(x, y, w, h, shade(c, -0.08), 0.12, i + 3);
    });
    return p.texture(repeat);
  });
}

export function grass(base = '#3f7f52', repeat: [number, number] = [8, 8]): THREE.Texture {
  return memo(`grass:${base}:${repeat}`, () => {
    const p = new Painter(32);
    p.clear(base);
    p.noise(0, 0, 32, 32, shade(base, 0.08), 0.2, 4);
    p.noise(0, 0, 32, 32, shade(base, -0.08), 0.15, 9);
    for (let i = 0; i < 18; i++) {
      const x = (i * 23) % 32, y = (i * 17) % 32;
      p.rect(x, y, 1, 2, shade(base, 0.16));
    }
    return p.texture(repeat);
  });
}

export function rug(c1 = '#b03a2e', c2 = '#e8c25a', repeat: [number, number] = [1, 1]): THREE.Texture {
  return memo(`rug:${c1}:${c2}`, () => {
    const p = new Painter(48);
    p.clear(c1);
    p.ring(24, 24, 23, 3, c2);
    p.ring(24, 24, 16, 2, shade(c1, -0.15));
    p.ring(24, 24, 10, 3, c2);
    p.circle(24, 24, 4, shade(c2, -0.1));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      p.circle(24 + Math.cos(a) * 19.5, 24 + Math.sin(a) * 19.5, 1.5, shade(c2, 0.1));
    }
    p.noise(0, 0, 48, 48, shade(c1, 0.06), 0.06, 3);
    return p.texture(repeat);
  });
}

export function tiles(a = '#2b1d4f', b = '#3b2a6f', repeat: [number, number] = [8, 8]): THREE.Texture {
  return memo(`tiles:${a}:${b}:${repeat}`, () => {
    const p = new Painter(16);
    p.clear(a);
    p.rect(0, 0, 8, 8, b);
    p.rect(8, 8, 8, 8, b);
    p.rect(0, 0, 16, 1, shade(b, 0.1));
    return p.texture(repeat);
  });
}

export function wallpaper(base = '#3f5f4a', accent = '#5f8f62', repeat: [number, number] = [6, 3]): THREE.Texture {
  return memo(`wall:${base}:${accent}:${repeat}`, () => {
    const p = new Painter(16);
    p.clear(base);
    p.rect(3, 0, 1, 16, shade(base, 0.05));
    p.rect(11, 0, 1, 16, shade(base, 0.05));
    for (const [x, y] of [[7, 3], [15, 11]]) { p.px(x, y, accent); p.px(x - 1, y + 1, accent); p.px(x + 1, y + 1, accent); p.px(x, y + 2, accent); }
    return p.texture(repeat);
  });
}

/** Chalkboard surface drawn into a big canvas so text can be chalked on top. */
export function chalkboardCanvas(w = 512, h = 272): HTMLCanvasElement {
  const p = new Painter(w, h);
  p.clear('#23382c');
  p.noise(0, 0, w, h, '#2b4434', 0.25, 5);
  p.noise(0, 0, w, h, '#1d2f25', 0.15, 6);
  // Smudges from old erased chalk.
  p.ctx.globalAlpha = 0.07;
  for (let i = 0; i < 14; i++) p.ellipse((i * 97) % w, (i * 53) % h, 30 + (i % 4) * 14, 8 + (i % 3) * 5, '#ffffff');
  p.ctx.globalAlpha = 1;
  return p.canvas;
}

export function sky(top: string, bottom: string, stars = 0): THREE.Texture {
  return memo(`sky:${top}:${bottom}:${stars}`, () => {
    const p = new Painter(64, 64);
    for (let y = 0; y < 64; y++) {
      const t = y / 63;
      const c = new THREE.Color(top).lerp(new THREE.Color(bottom), t);
      p.rect(0, y, 64, 1, `#${c.getHexString()}`);
    }
    if (stars) p.noise(0, 0, 64, 40, '#ffffff', stars, 7);
    const t = p.texture();
    t.mapping = THREE.EquirectangularReflectionMapping;
    return t;
  });
}
