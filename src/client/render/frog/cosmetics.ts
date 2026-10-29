// Voxel designs for every wearable cosmetic. Original designs — no real-world logos or mascots.

import { COSMETIC_BY_ID } from '../../../shared/cosmetics';
import { shade } from '../../art/painter';
import { Vox } from '../voxel';
import { BODY, EYE, frontZ, inBody, MOUTH_Y, skinColors } from './parts';

/** Hats are modelled with y=0 at their base; they sit at this point on the head. */
export const HAT_ANCHOR: [number, number, number] = [0, 14.6, -2.2];

const col = (id: string, which: 1 | 2 = 1, fallback = '#ffffff') => (which === 1 ? COSMETIC_BY_ID[id]?.color : COSMETIC_BY_ID[id]?.color2) ?? fallback;

export function buildHat(id: string): { main: Vox; spinner?: Vox; float?: boolean } | null {
  const v = new Vox();
  const c = col(id);
  const c2 = col(id, 2, '#ffffff');
  switch (id) {
    case 'hat_party':
      for (let y = 0; y < 9; y++) {
        const r = 3.4 * (1 - y / 9);
        for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) if (x * x + z * z <= r * r + 0.4) v.set(x, y, z, Math.floor(y / 2) % 2 ? c2 : c);
      }
      v.sphere(0, 9.5, 0, 1.4, '#ffffff');
      break;
    case 'hat_beanie':
      v.ellipsoid(0, 0, 0, 7.5, 5, 6.5, (x, y) => (y < 0 ? null : y <= 1 ? c2 : (x + y) % 3 === 0 ? shade(c, -0.1) : c));
      v.sphere(0, 6, 0, 1.8, c2);
      break;
    case 'hat_bucket':
      v.cylinder(0, 0, 0, 7.5, 1, shade(c, -0.08), 7);
      v.cylinder(0, 1, 0, 5, 3, c, 4.5);
      v.cylinder(0, 4, 0, 4.5, 1, shade(c, 0.08), 4);
      break;
    case 'hat_backcap':
      v.ellipsoid(0, 0, 0, 6.5, 4.5, 6, (x, y) => (y < 0 ? null : y >= 4 ? c2 : c));
      v.box(-4, 0, -7, 4, 0, -11, shade(c, -0.15));
      v.box(-2, 1, 4, 2, 3, 6, c2);
      break;
    case 'hat_lilypad':
      v.cylinder(0, 0, 0, 9, 1, (x, _y, z) => (Math.abs(Math.atan2(z, x) - 0.5) < 0.3 ? null : x * x + z * z < 30 ? shade(c, 0.1) : c), 8.5);
      v.sphere(3, 2, 2, 1.8, c2).set(3, 3, 2, '#ffd23a');
      break;
    case 'hat_chef':
      v.cylinder(0, 0, 0, 5, 3, '#ffffff', 4.5);
      v.ellipsoid(0, 6, 0, 6.5, 4, 6, (x, y, z) => (((x + z + y) % 4 === 0) ? '#eeeef4' : '#ffffff'));
      v.cylinder(0, 0, 0, 5.2, 1, '#e8e8f0', 4.7);
      break;
    case 'hat_cowboy':
      v.ellipsoid(0, 0, 0, 10, 1, 8, (x, _y, z) => (Math.abs(x) > 8 && Math.abs(z) < 5 ? shade(c, 0.1) : c));
      for (const s of [-1, 1]) v.box(s * 9, 1, -3, s * 10, 1, 3, c);
      v.ellipsoid(0, 3, 0, 5, 4, 4.5, (_x, y) => (y < 1 ? null : y === 1 || y === 2 ? c2 : c));
      v.carve((x, y) => y >= 6 && Math.abs(x) <= 1);
      break;
    case 'hat_propeller':
      v.ellipsoid(0, 0, 0, 6.5, 4.5, 6, (x, y, z) => (y < 0 ? null : Math.atan2(z, x) > 0 ? c : c2));
      v.box(-4, 0, 5, 4, 0, 8, c2);
      v.box(0, 4, 0, 0, 6, 0, '#5d6178');
      return { main: v, spinner: new Vox().box(-6, 0, -1, 6, 0, 0, '#ff5d5d').box(-1, 0, -6, 0, 0, 6, '#4aa3ff') };
    case 'hat_tophat':
      v.cylinder(0, 0, 0, 6.5, 1, c, 6);
      v.cylinder(0, 1, 0, 4, 2, c2, 3.8);
      v.cylinder(0, 3, 0, 4, 7, c, 3.8);
      v.cylinder(0, 10, 0, 4.2, 1, shade(c, 0.1), 4);
      break;
    case 'hat_headphones':
      for (let a = 0; a <= Math.PI; a += 0.08) {
        const x = Math.round(Math.cos(a) * 10), y = Math.round(Math.sin(a) * 5) - 2;
        v.box(x, y, -1, x, y, 0, c);
      }
      for (const s of [-1, 1]) {
        v.ellipsoid(s * 10, -4, 0, 2, 3.5, 3.5, c2);
        v.ellipsoid(s * 11, -4, 0, 1, 2.5, 2.5, c);
      }
      break;
    case 'hat_viking':
      v.ellipsoid(0, 0, 0, 7, 5.5, 6.5, (x, y) => (y < 0 ? null : y <= 1 ? '#ffd23a' : (x % 3 === 0 && y === 3) ? '#a8a8b8' : c));
      for (const s of [-1, 1]) {
        for (let i = 0; i < 7; i++) v.sphere(s * (6 + i * 0.7), 2 + i * 1.1 - (i > 4 ? (i - 4) * 0.4 : 0), 0, 1.6 - i * 0.12, c2);
      }
      break;
    case 'hat_vinyl': {
      const disc = new Vox();
      disc.cylinder(0, 0, 0, 9, 1, (x, _y, z) => {
        const d = Math.sqrt(x * x + z * z);
        if (d < 1) return null;
        if (d < 3.4) return c2;
        return Math.round(d) % 2 ? '#26262c' : c;
      }, 9);
      v.add(disc, 0, 1, 0);
      v.cylinder(0, 0, 0, 1, 1, '#c8c8d8', 1);
      break;
    }
    case 'hat_mohawk':
      for (let z = -7; z <= 5; z++) {
        const h = 6 - Math.abs(z + 1) * 0.35 + ((z & 1) ? 1.5 : 0);
        for (let y = 0; y < h; y++) v.set(0, y, z, y > h - 2 ? shade(c, 0.2) : c).set(y < 2 ? 1 : 0, y, z, c).set(y < 2 ? -1 : 0, y, z, c);
      }
      break;
    case 'hat_grad_bear':
      v.ellipsoid(0, 0, 0, 7, 4.5, 6.5, (x, y, z) => (y < 0 ? null : (x + y + z) % 2 ? c : shade(c, 0.06)));
      for (const s of [-1, 1]) { v.sphere(s * 5.5, 4, -1, 2.3, c); v.sphere(s * 5.5, 4, 0.6, 1.2, '#e8b88a'); }
      v.box(-6, 5, -6, 6, 5, 6, c2);
      v.box(-2, 4, -2, 2, 4, 2, c2);
      v.set(0, 6, 0, '#ffd23a');
      for (let i = 0; i < 5; i++) v.set(6, 5 - i, 6, '#ffd23a');
      v.box(5, 0, 5, 7, 0, 7, '#ffd23a');
      break;
    case 'hat_wizard':
      v.cylinder(0, 0, 0, 8, 1, c, 7.5);
      for (let y = 1; y < 13; y++) {
        const r = 4.5 * (1 - y / 13) + 0.6;
        const bend = y > 8 ? (y - 8) * 0.7 : 0;
        for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) if ((x - 0) ** 2 + (z + bend) ** 2 <= r * r) v.set(x, y, Math.round(z - bend), (x * 7 + y * 3 + z * 5) % 11 === 0 ? c2 : c);
      }
      v.set(3, 4, 3, c2).set(-2, 7, 2, c2).set(0, 2, 4, c2);
      break;
    case 'hat_mushroom':
      v.ellipsoid(0, 1, 0, 8, 5.5, 7.5, (x, y, z) => {
        if (y < 1) return null;
        const spots = [[3, 5, 3], [-4, 4, 2], [0, 6, -3], [5, 3, -3], [-3, 5, -4], [-6, 2, 3]];
        return spots.some(([sx, sy, sz]) => (x - sx) ** 2 + (y - sy) ** 2 + (z - sz) ** 2 < 3) ? '#ffffff' : c;
      });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const x = Math.round(Math.cos(a) * 7), z = Math.round(Math.sin(a) * 6.5);
        v.box(x, 0, z, x, i % 2 ? 2 : 3, z, c2);
      }
      break;
    case 'hat_halo':
      for (let a = 0; a < Math.PI * 2; a += 0.12) v.set(Math.round(Math.cos(a) * 6), 0, Math.round(Math.sin(a) * 5.5), c);
      return { main: v, float: true };
    case 'hat_crown':
      v.cylinder(0, 0, 0, 5, 2, c, 4.5);
      v.carve((x, y, z) => x * x + z * z < 10 && y >= 0);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
        const x = Math.round(Math.cos(a) * 4.5), z = Math.round(Math.sin(a) * 4);
        v.box(x, 2, z, x, 4, z, c);
        v.set(x, 5, z, c2);
      }
      v.set(0, 1, 5, c2);
      break;
    case 'hat_sprout':
      v.box(0, 0, 0, 0, 4, 0, '#3f8f3f');
      v.box(1, 4, 0, 3, 5, 0, c).box(-3, 5, 0, -1, 6, 0, c).set(2, 6, 0, c).set(-2, 7, 0, c);
      break;
    default:
      return null;
  }
  return { main: v };
}

// ───────────────────────── clothes ─────────────────────────

/** Clothing region: the lower body, staying below the mouth at the front so the face stays visible. */
const torso = (_x: number, y: number, z: number) => y >= 1 && y <= (z > 3.5 ? 6 : z > 0 ? 8 : 10);

function shellOf(pred: (x: number, y: number, z: number) => boolean, color: (x: number, y: number, z: number) => string | null): Vox {
  const body = new Vox();
  body.ellipsoid(BODY.cx, BODY.cy, BODY.cz, BODY.rx, BODY.ry, BODY.rz, '#000');
  return body.shell((x, y, z) => pred(x, y, z), (x, y, z) => color(x, y, z));
}

export function buildClothes(id: string, skin: string): { vox: Vox | null; sleeve: string | null } {
  const c = col(id);
  const c2 = col(id, 2, '#ffffff');
  const { body } = skinColors(skin);
  switch (id) {
    case 'clothes_tee': {
      const v = shellOf(torso, (x, y, z) => (z > 4 && y >= 2 && y <= 3 && Math.abs(x) <= 1 ? c2 : z > 4 && y === 4 && Math.abs(x) <= 2 ? c2 : c));
      return { vox: v, sleeve: c };
    }
    case 'clothes_hoodie': {
      const v = shellOf(torso, (x, y, z) => (z > 5 && y === 3 && Math.abs(x) <= 3 ? shade(c, -0.15) : c));
      for (let x = -6; x <= 6; x++) for (let y = 9; y <= 12; y++) if (inBody(x, y - 1, -6) || Math.abs(x) < 6) v.set(x, y, -7 + (y > 10 ? 1 : 0), c2);
      v.set(-2, 4, frontZ(-2, 4) + 2, '#f4f4f4').set(-2, 3, frontZ(-2, 3) + 2, '#f4f4f4').set(2, 4, frontZ(2, 4) + 2, '#f4f4f4').set(2, 3, frontZ(2, 3) + 2, '#f4f4f4');
      return { vox: v, sleeve: c };
    }
    case 'clothes_sweater':
      return { vox: shellOf(torso, (_x, y) => (y % 3 === 0 ? c2 : y === 9 ? shade(c, -0.12) : c)), sleeve: c };
    case 'clothes_hawaiian': {
      const v = shellOf(torso, (x, y, z) => ((x * 5 + y * 7 + z * 3) % 9 === 0 ? c2 : (x * 3 + y * 5 + z * 7) % 13 === 0 ? '#ff6fbf' : c));
      v.paint((x, y, z) => z > 3 && y >= 3 && Math.abs(x) <= y - 2 && Math.abs(x) <= 2, body);
      return { vox: v, sleeve: c };
    }
    case 'clothes_overalls': {
      const v = shellOf((x, y, z) => y >= 1 && (y <= 3.5 || (z > 3 && Math.abs(x) <= 3 && y <= 5) || ((Math.abs(x) === 3 || Math.abs(x) === 4) && z <= 3 && y <= 9)), () => c);
      v.set(-3, 5, frontZ(-3, 5) + 1, c2).set(3, 5, frontZ(3, 5) + 1, c2);
      v.paint((x, y, z) => z > 4 && y === 3 && Math.abs(x) <= 2, shade(c, -0.15));
      return { vox: v, sleeve: null };
    }
    case 'clothes_tracksuit': {
      const v = shellOf(torso, (x, _y, z) => (Math.abs(x) >= 8 && z > -2 ? c2 : z > 5 && x === 0 ? shade(c, 0.25) : c));
      return { vox: v, sleeve: c };
    }
    case 'clothes_flannel': {
      const v = shellOf(torso, (x, y, z) => {
        const a = Math.floor((x + 20) / 2) % 2, b = Math.floor((y + 20) / 2) % 2;
        if (z > 5 && x === 0) return '#2b2b38';
        return a && b ? shade(c, -0.25) : a || b ? c : c2;
      });
      return { vox: v, sleeve: c };
    }
    case 'clothes_raincoat': {
      const v = shellOf(torso, (x, y, z) => (z > 5 && x === 1 && y % 2 === 0 ? '#8a6a1f' : c));
      for (let x = -6; x <= 6; x++) for (let y = 9; y <= 12; y++) v.set(x, y, -7 + (y > 10 ? 1 : 0), c2);
      return { vox: v, sleeve: c };
    }
    case 'clothes_cape': {
      const v = new Vox();
      for (let x = -7; x <= 7; x++) for (let y = 1; y <= 10; y++) v.set(x, y, -9 + Math.round(Math.abs(x) * 0.25) + (y < 3 ? -1 : 0), y >= 9 ? c2 : (x + y) % 5 === 0 ? shade(c, -0.1) : c);
      for (let x = -6; x <= 6; x++) v.set(x, 10, frontZ(x, 10) - 1 > -8 ? -7 : -7, c2);
      return { vox: v, sleeve: null };
    }
    case 'clothes_suit':
    case 'clothes_tux': {
      const v = shellOf(torso, (x, y, z) => {
        if (z > 3 && Math.abs(x) <= Math.max(0, y - 1) / 1.5) return '#ffffff';
        return c;
      });
      // Bow tie / tie.
      const z5 = frontZ(0, 5) + 2;
      if (id === 'clothes_tux') v.box(-2, 5, z5, 2, 5, z5, '#141418').set(-2, 6, z5, '#141418').set(2, 6, z5, '#141418').set(-2, 4, z5, '#141418').set(2, 4, z5, '#141418');
      else v.box(0, 1, frontZ(0, 2) + 2, 0, 5, frontZ(0, 2) + 2, '#c0392b').set(-1, 5, z5, '#c0392b').set(1, 5, z5, '#c0392b');
      if (id === 'clothes_tux') for (const s of [-1, 1]) v.box(s * 3, -1, -8, s * 5, 2, -8, c);
      v.set(4, 4, frontZ(4, 4) + 1, '#ff6fbf');
      return { vox: v, sleeve: c };
    }
    case 'clothes_punk': {
      const v = shellOf(torso, (x, y, z) => (z > 3 && x === y - 3 ? '#c8c8d8' : (x === -5 && y === 3 && z > 3) ? '#ff2fa0' : c));
      for (let a = -Math.PI * 0.9; a <= -0.1; a += 0.32) {
        for (const s of [-1, 1]) {
          const x = s * Math.round(7 + Math.cos(a) * 1.5), z = Math.round(Math.sin(a) * 4);
          v.set(x, 9, z - 1, c2).set(x, 10, z - 1, '#ffffff');
        }
      }
      return { vox: v, sleeve: c };
    }
    case 'clothes_dino': {
      const v = shellOf((x, y, z) => y >= 1 && y <= 13 && !(z > 3 && y > 8.5 && Math.abs(x) < 6) && !(z > 0 && y > 10), (x, y, z) => (z > 4 && y < 8 && Math.abs(x) < 5 ? c2 : c));
      for (let i = 0; i < 7; i++) {
        const y = 14 - i * 1.8, z = -2 - i * 1.1;
        v.set(0, Math.round(y) + 1, Math.round(z) - 1, c2).set(0, Math.round(y) + 2, Math.round(z) - 1, c2);
      }
      v.box(-1, 2, -9, 1, 4, -11, c).box(0, 2, -12, 0, 3, -13, c);
      return { vox: v, sleeve: c };
    }
    case 'clothes_banana': {
      const v = shellOf((x, y, z) => y >= 0 && !(z > 3 && y > 4 && y < 12 && Math.abs(x) < 6) && !(Math.abs(x) > 1 && y > 12 && z > -1), (x, y) => (y >= 15 ? c2 : (x + y) % 9 === 0 ? shade(c, -0.12) : c));
      v.box(0, 16, -1, 0, 18, -1, c2).box(0, 18, 0, 0, 19, 0, c2);
      return { vox: v, sleeve: c };
    }
    case 'clothes_varsity': {
      const v = shellOf(torso, (x, y, z) => (z > 4 && x >= 2 && x <= 4 && y >= 1 && y <= 4 && !(x > 2 && y > 1) ? c2 : y <= 1 ? c2 : c));
      return { vox: v, sleeve: c2 };
    }
    default:
      return { vox: null, sleeve: null };
  }
}

// ───────────────────────── neck & face ─────────────────────────

export function buildNeck(id: string): Vox | null {
  const v = new Vox();
  const c = col(id);
  const c2 = col(id, 2, '#ffffff');
  const fz = (x: number, y: number) => frontZ(x, y) + 1;
  switch (id) {
    case 'neck_bowtie':
      v.box(-3, 3, fz(0, 4) + 1, -1, 5, fz(0, 4) + 1, c).box(1, 3, fz(0, 4) + 1, 3, 5, fz(0, 4) + 1, c).box(0, 4, fz(0, 4) + 1, 0, 4, fz(0, 4) + 1, shade(c, -0.2));
      return v;
    case 'neck_scarf':
      for (let x = -10; x <= 10; x++) for (const y of [4, 5]) for (let z = -9; z <= 9; z++) {
        const r = ((x / 9.6) ** 2 + (z / 8.1) ** 2);
        if (r > 0.86 && r < 1.12) v.set(x, y, z, y === 4 ? c : c2);
      }
      v.box(3, 0, fz(3, 3) + 1, 4, 4, fz(3, 3) + 1, c).box(3, 0, fz(3, 1) + 1, 4, 0, fz(3, 1) + 1, c2);
      return v;
    case 'neck_bandana':
      for (let y = 0; y <= 5; y++) for (let x = -y; x <= y; x++) v.set(x, y, fz(x, y), (x + y) % 3 === 0 ? '#ffffff' : c);
      return v;
    case 'neck_bell':
      for (let x = -6; x <= 6; x++) v.set(x, 5, fz(x, 5), '#8a3a2e');
      v.box(-1, 2, fz(0, 3) + 1, 1, 4, fz(0, 3) + 2, c).set(0, 1, fz(0, 2) + 2, shade(c, -0.3));
      return v;
    case 'neck_flowers':
      for (let a = 0; a < Math.PI * 2; a += 0.35) {
        const x = Math.round(Math.cos(a) * 9.6), z = Math.round(Math.sin(a) * 8.2);
        v.set(x, 5, z, Math.round(a * 3) % 2 ? c : c2).set(x, 4, z, '#6fe05a');
      }
      return v;
    case 'neck_headphones':
      for (let a = -0.2; a <= Math.PI + 0.2; a += 0.1) v.set(Math.round(Math.cos(a) * 9.8), 5, -Math.round(Math.sin(a) * 8.4), c);
      for (const s of [-1, 1]) v.box(s * 9, 3, 1, s * 10, 6, 4, c2);
      return v;
    case 'neck_guitar':
      for (let i = 0; i < 14; i++) v.set(-6 + i, 1 + i * 0.9, -10, '#5a3a1f');
      v.ellipsoid(-4, 3, -10, 4, 3.5, 1, c).set(-4, 3, -11, '#141418').box(-5, 3, -11, -3, 3, -11, '#141418');
      v.box(7, 13, -10, 9, 15, -10, '#2b2b38');
      v.box(-7, 5, -10, -6, 5, -10, c2);
      return v;
    case 'neck_chain':
      for (let a = 0.15; a < Math.PI - 0.15; a += 0.18) {
        const x = Math.round(Math.cos(a) * 6), y = Math.round(5 - Math.sin(a) * 3.5);
        v.set(x, y, fz(x, y), (Math.round(a * 10) % 2) ? c : shade(c, -0.15));
      }
      v.sphere(0, 1, fz(0, 2) + 1, 2, (x) => (x === 0 ? c : c2));
      return v;
    case 'neck_medal':
      v.box(-1, 3, fz(0, 4), -1, 5, fz(0, 4), c2).box(1, 3, fz(0, 4), 1, 5, fz(0, 4), c2);
      v.sphere(0, 1.5, fz(0, 2) + 1, 1.8, c);
      return v;
    default:
      return null;
  }
}

export function buildFace(id: string): Vox | null {
  const v = new Vox();
  const c = col(id);
  const c2 = col(id, 2, '#ffffff');
  const ez = Math.round(EYE.z + EYE.r) + 1;
  const ey = Math.round(EYE.y);
  const ex = Math.round(EYE.x);
  switch (id) {
    case 'face_round':
      for (const s of [-1, 1]) for (let a = 0; a < Math.PI * 2; a += 0.3) v.set(s * ex + Math.round(Math.cos(a) * 3), ey + Math.round(Math.sin(a) * 3), ez, c);
      v.box(-1, ey, ez, 1, ey, ez, c);
      return v;
    case 'face_shades':
      for (const s of [-1, 1]) v.box(s * ex - 3, ey - 2, ez, s * ex + 3, ey + 1, ez, '#141418').box(s * ex - 3, ey + 2, ez, s * ex + 3, ey + 2, ez, c2);
      v.box(-1, ey + 1, ez, 1, ey + 1, ez, c2);
      v.set(-ex - 1, ey, ez + 1, '#5d6178').set(ex - 1, ey, ez + 1, '#5d6178');
      return v;
    case 'face_star':
      for (const s of [-1, 1]) {
        const x0 = s * ex;
        v.box(x0 - 1, ey - 2, ez, x0 + 1, ey + 2, ez, c).box(x0 - 3, ey, ez, x0 + 3, ey, ez, c).box(x0 - 2, ey - 1, ez, x0 + 2, ey + 1, ez, c);
        v.set(x0 - 2, ey - 3, ez, c).set(x0 + 2, ey - 3, ez, c);
      }
      v.box(-1, ey + 1, ez, 1, ey + 1, ez, c);
      return v;
    case 'face_visor':
      v.box(-8, ey - 1, ez, 8, ey + 1, ez, c).box(-8, ey + 2, ez - 1, 8, ey + 2, ez - 1, '#2b2b38');
      return v;
    case 'face_monocle':
      for (let a = 0; a < Math.PI * 2; a += 0.3) v.set(ex + Math.round(Math.cos(a) * 3), ey + Math.round(Math.sin(a) * 3), ez, c);
      for (let i = 0; i < 6; i++) v.set(ex + 3, ey - 3 - i, ez - Math.floor(i / 2), c);
      return v;
    case 'face_mustache': {
      const y = MOUTH_Y + 2;
      for (let x = -5; x <= 5; x++) {
        const yy = y + (Math.abs(x) >= 4 ? 1 : 0) - (Math.abs(x) === 5 ? -1 : 0);
        v.set(x, yy, frontZ(x, yy) + 1, c);
        if (Math.abs(x) <= 3) v.set(x, yy - 1, frontZ(x, yy - 1) + 1, c);
      }
      return v;
    }
    case 'face_eyepatch':
      v.box(-ex - 2, ey - 2, ez, -ex + 2, ey + 2, ez, c);
      for (let x = -8; x <= 8; x++) if (Math.abs(x + ex) > 2) v.set(x, ey + 3 - Math.round(Math.abs(x) * 0.15), ez - 2 - Math.round((x * x) / 18), c);
      return v;
    case 'face_3d':
      v.box(-8, ey - 2, ez, 8, ey + 2, ez, c);
      v.box(-ex - 2, ey - 1, ez + 1, -ex + 2, ey + 1, ez + 1, '#ff3f3f').box(ex - 2, ey - 1, ez + 1, ex + 2, ey + 1, ez + 1, '#3f7fff');
      return v;
    case 'face_pixel':
      for (const s of [-1, 1]) {
        const x0 = s * ex;
        v.box(x0 - 3, ey, ez + 1, x0 + 3, ey + 1, ez + 1, c).box(x0 - 2, ey - 1, ez + 1, x0 + 2, ey - 1, ez + 1, c).box(x0 - 1, ey - 2, ez + 1, x0 + 1, ey - 2, ez + 1, c);
        v.set(x0 - 2, ey, ez + 2, '#ffffff').set(x0 - 1, ey - 1, ez + 2, '#ffffff');
      }
      v.box(-8, ey + 1, ez + 1, 8, ey + 1, ez + 1, c);
      return v;
    default:
      return null;
  }
}
