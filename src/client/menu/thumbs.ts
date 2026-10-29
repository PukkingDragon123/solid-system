// Item thumbnails: every cosmetic is rendered from its real voxel model (worn by a default frog) into a
// tiny pixel image, so the shop and wardrobe show exactly what you get. Rendering is queued a few per frame.

import * as THREE from 'three';
import { EMOTE_BY_ID } from '../../shared/catalog';
import { COSMETIC_BY_ID, DEFAULT_OUTFIT, type CosmeticDef, type Outfit } from '../../shared/cosmetics';
import { Painter, shade } from '../art/painter';
import { stickerUrl } from '../art/icons';
import { FrogModel } from '../render/frog/FrogModel';

const SIZE = 52;
const cache = new Map<string, string>();
const queue: { id: string; base: Outfit; done: (url: string) => void }[] = [];
let renderer: THREE.WebGLRenderer | null = null;
let failed = false;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let frog: FrogModel | null = null;
let pumping = false;

const IDLE_ICON: Record<string, string> = { idle_chill: '😌', idle_sleepy: '😴', idle_groovy: '🕺', idle_hyper: '⚡', idle_dramatic: '🎭' };

function setup(): boolean {
  if (renderer) return true;
  if (failed) return false;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setClearColor(0x000000, 0);
  } catch {
    failed = true;
    return false;
  }
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff6e0', '#4a3a30', 1.6));
  const key = new THREE.DirectionalLight('#ffffff', 2.2);
  key.position.set(2, 4, 5);
  scene.add(key);
  camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
  return true;
}

/** Framing per slot: [camera y, camera distance, look-at y, yaw]. */
function framing(slot: string): [number, number, number, number] {
  switch (slot) {
    case 'hat': return [1.15, 2.2, 0.95, 0.35];
    case 'face': case 'eyes': return [0.9, 1.55, 0.82, 0.25];
    case 'mouth': return [0.6, 1.6, 0.6, 0.15];
    case 'neck': return [0.75, 2.0, 0.45, 0.5];
    case 'clothes': return [0.7, 2.3, 0.45, 0.4];
    default: return [0.85, 2.6, 0.55, 0.4];
  }
}

function renderFrog(def: CosmeticDef, base: Outfit): string {
  const outfit: Outfit = { ...base, [def.slot]: def.id } as Outfit;
  // Show accessories on a plain frog so the item reads clearly.
  if (def.slot !== 'skin' && def.slot !== 'pattern') {
    outfit.skin = base.skin;
    outfit.pattern = 'pat_none';
  }
  if (!frog) {
    frog = new FrogModel(outfit);
    scene.add(frog.root);
  } else {
    frog.build(outfit);
  }
  if (def.slot === 'mouth') frog.setMouth(def.id);
  const [cy, dist, ty, yaw] = framing(def.slot);
  frog.root.rotation.y = yaw;
  camera.position.set(0, cy, dist);
  camera.lookAt(0, ty, 0);
  renderer!.render(scene, camera);
  return renderer!.domElement.toDataURL('image/png');
}

function textTile(lines: string[], bg: string, fg: string): string {
  const p = new Painter(48, 48);
  p.clear(bg);
  p.rect(0, 0, 48, 2, shade(bg, 0.2));
  p.rect(0, 46, 48, 2, shade(bg, -0.25));
  lines.slice(0, 4).forEach((l, i) => p.text(l.slice(0, 11).toUpperCase(), Math.max(1, Math.round(24 - l.slice(0, 11).length * 2)), 10 + i * 8, fg));
  return p.dataUrl(2);
}

function bannerTile(def: CosmeticDef): string {
  const p = new Painter(48, 32);
  const a = def.color ?? '#2f5f3a';
  const b = def.color2 ?? '#9be36b';
  for (let y = 0; y < 32; y++) p.rect(0, y, 48, 1, y < 16 ? shade(a, (16 - y) * -0.01) : a);
  p.circle(36, 12, 6, b);
  for (let x = 0; x < 48; x += 4) p.rect(x, 26 + ((x / 4) % 2), 4, 6, shade(a, -0.3));
  p.dither(0, 18, 48, 8, shade(b, -0.2), 0.25);
  return p.dataUrl(3);
}

function emojiTile(icon: string, bg = '#fffaf0'): string {
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 48, 48);
  ctx.font = '30px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, 24, 27);
  return c.toDataURL();
}

/** Returns a cached thumbnail immediately when possible. */
function immediate(def: CosmeticDef): string | null {
  switch (def.slot) {
    case 'emote': return emojiTile(EMOTE_BY_ID[def.id.replace(/^emote_/, '')]?.icon ?? '🐸');
    case 'idle': return emojiTile(IDLE_ICON[def.id] ?? '🐸');
    case 'title': return textTile(def.name.split(' '), '#3b2a1f', '#ffe245');
    case 'banner': return bannerTile(def);
    case 'sticker': return stickerUrl(def.id);
    default: return null;
  }
}

function pump(): void {
  if (pumping) return;
  pumping = true;
  const step = () => {
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < 8) {
      const job = queue.shift()!;
      const def = COSMETIC_BY_ID[job.id];
      const key = `${job.id}|${job.base.skin}`;
      let url = cache.get(key);
      if (!url) {
        url = setup() ? renderFrog(def, job.base) : emojiTile('🐸');
        cache.set(key, url);
      }
      job.done(url);
    }
    if (queue.length) requestAnimationFrame(step);
    else pumping = false;
  };
  requestAnimationFrame(step);
}

/** Fills `img` with the item's thumbnail (rendered lazily). `base` is the outfit the item is shown on. */
export function thumbInto(img: HTMLImageElement, id: string, base: Outfit = DEFAULT_OUTFIT): void {
  const def = COSMETIC_BY_ID[id];
  if (!def) return;
  const now = immediate(def);
  if (now) { img.src = now; return; }
  const key = `${id}|${base.skin}`;
  const hit = cache.get(key);
  if (hit) { img.src = hit; return; }
  img.src = emojiTile('…', '#e8dcbc');
  queue.push({ id, base, done: (url) => { if (img.isConnected || img.dataset.want === key) img.src = url; } });
  img.dataset.want = key;
  pump();
}

export function cancelThumbs(): void {
  queue.length = 0;
}
