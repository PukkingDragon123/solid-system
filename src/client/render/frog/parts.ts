// Voxel part builders for the chibi frog: body, eyes, lids, pupils, mouths, limbs and skins.
// Coordinates are in voxels (1 voxel = 1/16 world unit); the frog faces +Z.

import { COSMETIC_BY_ID } from '../../../shared/cosmetics';
import { Vox } from '../voxel';
import { shade } from '../../art/painter';

export const BODY = { cx: 0, cy: 7, cz: 0, rx: 9.5, ry: 6.6, rz: 8 };
export const EYE = { x: 4.9, y: 13.2, z: 3, r: 4.2 };
export const MOUTH_Y = 7.5;

export function skinColors(skinId: string): { body: string; belly: string; special?: 'glass' | 'gold' | 'rainbow' } {
  const def = COSMETIC_BY_ID[skinId] ?? COSMETIC_BY_ID.skin_classic;
  const special = skinId === 'skin_glass' ? 'glass' : skinId === 'skin_gold' ? 'gold' : skinId === 'skin_rainbow' ? 'rainbow' : undefined;
  return { body: def.color ?? '#5fbf3f', belly: def.color2 ?? '#d9f2a6', special };
}

const RAINBOW = ['#ff5d5d', '#ffb13b', '#ffe245', '#6fe05a', '#33d6c3', '#4aa3ff', '#a37bff'];

export function inBody(x: number, y: number, z: number): boolean {
  const { cx, cy, cz, rx, ry, rz } = BODY;
  return y >= 1 && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1;
}

/** Frontmost body voxel z at (x, y) — used to stick decals (mouths, mustaches) to the face. */
export function frontZ(x: number, y: number): number {
  for (let z = 12; z > -12; z--) if (inBody(x, y, z)) return z;
  return 0;
}

function patternColor(pattern: string, body: string, x: number, y: number, z: number): string | null {
  const dark = shade(body, -0.22);
  switch (pattern) {
    case 'pat_spots': {
      const spots = [[-4, 11, -3], [3, 12, -4], [6, 7, -3], [-6, 6, -4], [0, 9, -7], [-2, 4, -6], [5, 3, -4], [-7, 10, 1], [7, 11, 0]];
      return spots.some(([sx, sy, sz]) => (x - sx) ** 2 + (y - sy) ** 2 + (z - sz) ** 2 <= 2.3) ? dark : null;
    }
    case 'pat_stripes':
      return z < 2 && (y + Math.round(Math.abs(x) / 3)) % 4 === 0 ? dark : null;
    case 'pat_camo': {
      const n = Math.sin(x * 0.9 + y * 0.4) + Math.sin(z * 0.8 - y * 0.7) + Math.sin((x + z) * 0.5);
      return n > 1.1 ? shade(body, -0.28) : n < -1.2 ? '#6a5a2f' : null;
    }
    case 'pat_dart': {
      const n = Math.sin(x * 0.7 + 1) * Math.cos(y * 0.8) + Math.sin(z * 0.6 + y * 0.3);
      return n > 0.9 ? '#141418' : null;
    }
    case 'pat_hearts': {
      const hearts = [[-4, 11, -4], [4, 9, -5], [0, 5, -7], [-6, 6, -2], [6, 12, -1]];
      for (const [hx, hy, hz] of hearts) {
        const dx = x - hx, dy = y - hy;
        if (Math.abs(z - hz) > 3) continue;
        if ((dy === 1 && (Math.abs(dx) === 1)) || (dy === 0 && Math.abs(dx) <= 1) || (dy === -1 && dx === 0)) return '#ff5d9e';
      }
      return null;
    }
    case 'pat_galaxy': {
      const h = Math.sin(x * 12.9 + y * 78.2 + z * 37.7) * 43758.5;
      const f = h - Math.floor(h);
      return f > 0.93 ? '#ffffff' : f > 0.86 ? '#c9a2ff' : f < 0.25 ? shade(body, -0.35) : null;
    }
    default:
      return null;
  }
}

export function buildBody(skinId: string, pattern: string): Vox {
  const { body, belly, special } = skinColors(skinId);
  const v = new Vox();
  const { cx, cy, cz, rx, ry, rz } = BODY;
  v.ellipsoid(cx, cy, cz, rx, ry, rz, (x, y, z) => {
    if (y < 1) return null;
    const isBelly = z > 3 && y < 7 && Math.abs(x) < 6.5 - Math.max(0, 5 - y) * 0.4;
    if (isBelly) return belly;
    if (special === 'rainbow') return RAINBOW[(y + 70) % RAINBOW.length];
    return patternColor(pattern, body, x, y, z) ?? body;
  });
  // Eye mounds (the eyeballs themselves are separate meshes).
  for (const s of [-1, 1]) v.sphere(s * EYE.x, EYE.y - 0.9, EYE.z - 1.8, 3.9, special === 'rainbow' ? RAINBOW[3] : body);
  // Cheeks.
  for (const s of [-1, 1]) {
    const x = s * 6.5;
    v.set(x, 6, frontZ(x, 6), '#ff9ec9').set(x + s, 6, frontZ(x + s, 6), '#ff9ec9').set(x, 7, frontZ(x, 7), '#ff9ec9');
  }
  // Nostrils.
  v.set(-1, 10, frontZ(-1, 10), shade(body, -0.35)).set(1, 10, frontZ(1, 10), shade(body, -0.35));
  return v;
}

export function buildEyeWhite(style: string): Vox {
  const v = new Vox();
  const r = style === 'eyes_googly' ? 4.2 : EYE.r;
  v.sphere(0, 0, 0, r, '#fbfaf4');
  if (style === 'eyes_sparkle') v.paint((_x, _y, z) => z < -1, '#e8eef8');
  return v;
}

/** Pupil decal centred at the origin, facing +Z. */
export function buildPupil(style: string): Vox {
  const v = new Vox();
  const K = '#141418';
  const W = '#ffffff';
  switch (style) {
    case 'eyes_tiny':
      v.set(0, 0, 0, K);
      break;
    case 'eyes_star':
      v.set(0, 1, 0, '#ffd23a').box(-1, 0, 0, 1, 0, 0, '#ffd23a').set(0, -1, 0, '#ffd23a').set(-1, -1, 0, '#ffb13b').set(1, -1, 0, '#ffb13b');
      break;
    case 'eyes_heart':
      v.set(-1, 1, 0, '#ff3f8f').set(1, 1, 0, '#ff3f8f').box(-1, 0, 0, 1, 0, 0, '#ff3f8f').set(0, -1, 0, '#ff3f8f');
      break;
    case 'eyes_sparkle':
      v.box(-1, -1, 0, 1, 1, 0, '#2f6fff').set(0, 0, 0, K).set(-1, 1, 1, W).set(1, -1, 1, W);
      break;
    case 'eyes_googly':
      v.box(-1, -1, 0, 1, 1, 0, K).set(-1, 1, 1, W);
      break;
    default:
      v.box(-2, -2, 0, 1, 1, 0, K).box(-2, 0, 1, -1, 1, 1, W).set(1, -2, 1, '#8a90a8');
  }
  return v;
}

/** Upper eyelid covering the top `closure` fraction of the eye (0 = open, 1 = shut). */
export function buildLid(color: string, closure: number, r = EYE.r): Vox {
  const v = new Vox();
  const R = r + 0.75;
  const cut = R - closure * 2 * R;
  for (let x = -6; x <= 6; x++)
    for (let y = -6; y <= 6; y++)
      for (let z = -6; z <= 6; z++) {
        const d = Math.sqrt(x * x + y * y + z * z);
        if (d <= R && d > r - 0.4 && y >= cut && z > -2) v.set(x, y, z, y >= cut + 0.5 || closure === 0 ? color : shade(color, -0.25));
      }
  // Lash/edge line at the lid bottom for readability.
  if (closure > 0.05) v.paint((_x, y) => y <= cut + 0.5, shade(color, -0.3));
  return v;
}

export function buildBrow(): Vox {
  return new Vox().box(-2, 0, 0, 2, 0, 0, '#2a2018');
}

/** Mouth decals stuck onto the face front. */
export function buildMouth(kind: string): Vox {
  const v = new Vox();
  const K = '#3a1a20';
  const T = '#ff7a9a';
  const W = '#ffffff';
  const put = (x: number, y: number, c = K) => v.set(x, y, frontZ(x, y) + 1, c);
  switch (kind) {
    case 'mouth_grin':
    case 'grin':
      for (let x = -4; x <= 4; x++) put(x, MOUTH_Y);
      for (let x = -3; x <= 3; x++) put(x, MOUTH_Y - 1, Math.abs(x) <= 2 ? T : K);
      for (let x = -2; x <= 2; x++) put(x, MOUTH_Y - 2);
      for (let x = -3; x <= 3; x++) put(x, MOUTH_Y, W);
      put(-4, MOUTH_Y + 1); put(4, MOUTH_Y + 1);
      break;
    case 'mouth_o':
    case 'o':
      put(-1, MOUTH_Y); put(0, MOUTH_Y); put(1, MOUTH_Y); put(-1, MOUTH_Y - 2); put(0, MOUTH_Y - 2); put(1, MOUTH_Y - 2);
      put(-2, MOUTH_Y - 1); put(2, MOUTH_Y - 1); put(-1, MOUTH_Y - 1, '#1a0a10'); put(0, MOUTH_Y - 1, '#1a0a10'); put(1, MOUTH_Y - 1, '#1a0a10');
      break;
    case 'mouth_smug':
      for (let x = -3; x <= 2; x++) put(x, MOUTH_Y);
      put(3, MOUTH_Y + 1); put(4, MOUTH_Y + 2);
      break;
    case 'mouth_tongue':
      for (let x = -3; x <= 3; x++) put(x, MOUTH_Y + (Math.abs(x) === 3 ? 1 : 0));
      put(1, MOUTH_Y - 1, T); put(2, MOUTH_Y - 1, T); put(1, MOUTH_Y - 2, T);
      break;
    case 'mouth_tooth':
      for (let x = -4; x <= 4; x++) put(x, MOUTH_Y + (Math.abs(x) >= 3 ? 1 : 0));
      put(-1, MOUTH_Y - 1, W); put(0, MOUTH_Y - 1, W);
      break;
    case 'mouth_derp':
      for (let x = -4; x <= 4; x++) put(x, MOUTH_Y + (x % 2 === 0 ? 0 : 1) - (x > 2 ? 1 : 0));
      put(-2, MOUTH_Y - 1, T); put(-3, MOUTH_Y - 1, T); put(-2, MOUTH_Y - 2, T);
      break;
    case 'mouth_fangs':
      for (let x = -4; x <= 4; x++) put(x, MOUTH_Y + (Math.abs(x) >= 3 ? 1 : 0));
      put(-2, MOUTH_Y - 1, W); put(2, MOUTH_Y - 1, W);
      break;
    case 'open':
      for (let x = -4; x <= 4; x++) put(x, MOUTH_Y + 1);
      for (let y = MOUTH_Y - 3; y <= MOUTH_Y; y++) for (let x = -4 + (MOUTH_Y - y); x <= 4 - (MOUTH_Y - y); x++) put(x, y, y === MOUTH_Y - 3 || y === MOUTH_Y - 2 ? T : '#2a0a12');
      break;
    case 'frown':
      for (let x = -3; x <= 3; x++) put(x, MOUTH_Y - (Math.abs(x) >= 2 ? 1 : 0));
      break;
    case 'wavy':
      for (let x = -4; x <= 4; x++) put(x, MOUTH_Y + (x % 2 === 0 ? 0 : -1));
      break;
    case 'flat':
      for (let x = -2; x <= 2; x++) put(x, MOUTH_Y);
      break;
    case 'mouth_smile':
    default:
      for (let x = -5; x <= 5; x++) put(x, MOUTH_Y + (Math.abs(x) >= 4 ? 1 : 0));
      put(-6, MOUTH_Y + 2); put(6, MOUTH_Y + 2);
  }
  return v;
}

export function buildArm(skin: string, sleeve: string | null): Vox {
  const { body, belly } = skinColors(skin);
  const v = new Vox();
  const c = sleeve ?? body;
  // Hangs down from the shoulder pivot at the origin.
  v.box(-1, -4, -1, 0, 0, 0, c);
  v.box(-1, -6, -1, 1, -5, 1, belly).set(-2, -6, 1, belly).set(1, -6, 1, belly);
  return v;
}

export function buildLeg(skin: string): Vox {
  const { body, belly } = skinColors(skin);
  const v = new Vox();
  v.box(-1, 0, -2, 1, 2, 2, body);
  v.box(-2, -1, 1, 2, -1, 5, belly);
  v.set(-2, -1, 6, belly).set(0, -1, 6, belly).set(2, -1, 6, belly);
  return v;
}

export function buildTongue(): Vox {
  return new Vox().box(0, 0, 0, 0, 0, 7, '#ff6f8f').box(-1, -1, 7, 1, 0, 8, '#ff4f7f');
}

// ───────────────────────── the toad ─────────────────────────

export const TOAD_BODY = { cx: 0, cy: 6.5, cz: 0, rx: 10.5, ry: 6.5, rz: 8.5 };

export function buildToadBody(): Vox {
  const v = new Vox();
  const base = '#7d7a3a';
  const belly = '#c9b98a';
  const { cx, cy, cz, rx, ry, rz } = TOAD_BODY;
  v.ellipsoid(cx, cy, cz, rx, ry, rz, (x, y, z) => {
    if (y < 1) return null;
    if (z > 3 && y < 7 && Math.abs(x) < 7) return belly;
    const h = Math.sin(x * 3.1 + y * 7.7 + z * 5.3);
    return h > 0.85 ? '#5e5a2a' : h < -0.9 ? '#9a9a55' : base;
  });
  // Warts: lumpy bumps all over the back.
  const warts = [[-6, 11, -2], [5, 12, -3], [0, 12, -5], [-8, 8, -4], [8, 7, -3], [-3, 9, -8], [4, 6, -8], [-9, 5, 1], [9, 4, 2], [2, 13, -1], [-4, 13, 0], [7, 10, 3], [-7, 11, 3]];
  for (const [x, y, z] of warts) v.sphere(x, y, z, 1.4, (xx, yy, zz) => ((xx + yy + zz) % 2 ? '#a3a35a' : '#5e5a2a'));
  // Mismatched eye mounds.
  v.sphere(-5, 12, 1, 3.8, base);
  v.sphere(5.5, 11, 1.5, 2.8, base);
  // Big goofy mouth line with a buck tooth.
  for (let x = -7; x <= 7; x++) {
    const y = 5 + (Math.abs(x) > 5 ? 1 : 0);
    let z = 12;
    while (z > -12 && !((x / rx) ** 2 + ((y - cy) / ry) ** 2 + (z / rz) ** 2 <= 1)) z--;
    v.set(x, y, z + 1, '#2a0a12');
  }
  for (let z = 6; z <= 9; z++) if (v.has(1, 5, z)) { v.set(1, 4, z + 1, '#fff6c9'); v.set(2, 4, z + 1, '#fff6c9'); v.set(1, 3, z + 1, '#fff6c9'); break; }
  // Drool bubble + tongue tip.
  v.set(-3, 4, 9, '#ff6f8f').set(-3, 3, 9, '#ff6f8f');
  return v;
}
