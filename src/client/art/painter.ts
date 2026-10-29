// Pixel-art painter: draws on tiny canvases with hard pixels, auto-outlines and dithering, then
// hands out textures / data URLs. All game art is generated here at runtime — original and CC0.

import * as THREE from 'three';

export class Painter {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  constructor(readonly w: number, readonly h = w) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.ctx.imageSmoothingEnabled = false;
  }

  clear(c?: string): this {
    if (c) { this.ctx.fillStyle = c; this.ctx.fillRect(0, 0, this.w, this.h); } else this.ctx.clearRect(0, 0, this.w, this.h);
    return this;
  }

  px(x: number, y: number, c: string): this {
    this.ctx.fillStyle = c;
    this.ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: string): this {
    this.ctx.fillStyle = c;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    return this;
  }

  circle(cx: number, cy: number, r: number, c: string): this {
    this.ctx.fillStyle = c;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2 <= r * r) this.ctx.fillRect(x, y, 1, 1);
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: string): this {
    this.ctx.fillStyle = c;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        if (((x - cx + 0.5) / rx) ** 2 + ((y - cy + 0.5) / ry) ** 2 <= 1) this.ctx.fillRect(x, y, 1, 1);
    return this;
  }

  ring(cx: number, cy: number, r: number, t: number, c: string): this {
    this.ctx.fillStyle = c;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.sqrt((x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2);
        if (d <= r && d >= r - t) this.ctx.fillRect(x, y, 1, 1);
      }
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string, w = 1): this {
    this.ctx.fillStyle = c;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      this.ctx.fillRect(x - Math.floor(w / 2), y - Math.floor(w / 2), w, w);
    }
    return this;
  }

  poly(points: [number, number][], c: string): this {
    const ctx = this.ctx;
    // Scanline fill for crisp edges.
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of points) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    ctx.fillStyle = c;
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[(i + 1) % points.length];
        if ((y0 <= y + 0.5 && y1 > y + 0.5) || (y1 <= y + 0.5 && y0 > y + 0.5)) xs.push(x0 + ((y + 0.5 - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) ctx.fillRect(Math.round(xs[i]), y, Math.round(xs[i + 1]) - Math.round(xs[i]), 1);
    }
    return this;
  }

  /** Checkerboard dither of a colour over a region (cheap shading). */
  dither(x: number, y: number, w: number, h: number, c: string, density = 0.5): this {
    this.ctx.fillStyle = c;
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const t = ((i + j) & 1) === 0 ? 0.25 : 0.75;
        const bayer = (((i & 1) * 2 + (j & 1)) / 4 + t) / 2;
        if (bayer < density) this.ctx.fillRect(x + i, y + j, 1, 1);
      }
    return this;
  }

  noise(x: number, y: number, w: number, h: number, c: string, chance: number, seed = 1): this {
    let s = seed * 9301 + 49297;
    this.ctx.fillStyle = c;
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        s = (s * 9301 + 49297) % 233280;
        if (s / 233280 < chance) this.ctx.fillRect(x + i, y + j, 1, 1);
      }
    return this;
  }

  /** Draws a 1px outline around every opaque pixel (classic sprite outline). */
  outline(c = '#1b1420', alphaMin = 20): this {
    const img = this.ctx.getImageData(0, 0, this.w, this.h);
    const d = img.data;
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < this.w && y < this.h && d[(y * this.w + x) * 4 + 3] > alphaMin;
    const marks: [number, number][] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (!solid(x, y) && (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1))) marks.push([x, y]);
    this.ctx.fillStyle = c;
    for (const [x, y] of marks) this.ctx.fillRect(x, y, 1, 1);
    return this;
  }

  /** Tiny 3x5 pixel font for numbers/letters drawn inside art. */
  text(str: string, x: number, y: number, c: string, scale = 1): this {
    let cx = x;
    for (const ch of str.toUpperCase()) {
      const g = GLYPHS[ch];
      if (g) for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j][i] === '#') this.rect(cx + i * scale, y + j * scale, scale, scale, c);
      cx += 4 * scale;
    }
    return this;
  }

  texture(repeat?: [number, number]): THREE.CanvasTexture {
    const t = new THREE.CanvasTexture(this.canvas);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
    }
    return t;
  }

  /** Upscaled crisp data URL for use in DOM <img> / CSS. */
  dataUrl(scale = 1): string {
    if (scale === 1) return this.canvas.toDataURL();
    const big = document.createElement('canvas');
    big.width = this.w * scale;
    big.height = this.h * scale;
    const ctx = big.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.canvas, 0, 0, big.width, big.height);
    return big.toDataURL();
  }
}

const GLYPHS: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'], A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'], G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], J: ['..#', '..#', '..#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'], M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'], Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'], Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'], '?': ['##.', '..#', '.#.', '...', '.#.'], '-': ['...', '...', '###', '...', '...'],
  '.': ['...', '...', '...', '...', '.#.'], ':': ['...', '.#.', '...', '.#.', '...'], ' ': ['...', '...', '...', '...', '...'],
  "'": ['.#.', '.#.', '...', '...', '...'], '+': ['...', '.#.', '###', '.#.', '...'], '/': ['..#', '..#', '.#.', '#..', '#..'],
};

export function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s * (amt < 0 ? 1.05 : 0.95)), Math.max(0, Math.min(1, hsl.l + amt)));
  return `#${c.getHexString()}`;
}

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
