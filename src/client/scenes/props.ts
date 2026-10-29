// Voxel props shared by every map: furniture, DJ gear, plants, lights, cinematic gadgets.

import * as THREE from 'three';
import { shade } from '../art/painter';
import { glowMaterial, Vox, voxMaterial } from '../render/voxel';

const V = 1 / 16;
const cache = new Map<string, THREE.BufferGeometry>();

function cached(key: string, make: () => Vox, opts: Parameters<Vox['build']>[1] = {}): THREE.BufferGeometry {
  let g = cache.get(key);
  if (!g) { g = make().build(V, opts); cache.set(key, g); }
  return g;
}

function mk(key: string, make: () => Vox, opts: { glow?: number; shadows?: boolean; origin?: [number, number, number] } = {}): THREE.Mesh {
  const g = cached(key, make, { origin: opts.origin });
  const m = new THREE.Mesh(g, opts.glow ? glowMaterial(opts.glow) : voxMaterial);
  m.castShadow = opts.shadows ?? !opts.glow;
  m.receiveShadow = true;
  return m;
}

export function stool(color = '#8a5a33'): THREE.Mesh {
  return mk(`stool:${color}`, () => {
    const v = new Vox();
    v.cylinder(0, 7, 0, 4.5, 2, (x, _y, z) => ((x + z) % 3 === 0 ? shade(color, 0.08) : color));
    v.cylinder(0, 8, 0, 4, 1, '#c0392b');
    for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) v.box(x, 0, z, x, 6, z, shade(color, -0.2));
    v.box(-3, 2, -3, 3, 2, -3, shade(color, -0.25)).box(-3, 2, 3, 3, 2, 3, shade(color, -0.25));
    return v;
  });
}

export function lantern(color = '#ffb84d'): THREE.Group {
  const g = new THREE.Group();
  g.add(mk('lantern:frame', () => {
    const v = new Vox();
    v.box(-2, 0, -2, 2, 0, 2, '#3b2a1f').box(-2, 6, -2, 2, 6, 2, '#3b2a1f');
    for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) v.box(x, 1, z, x, 5, z, '#3b2a1f');
    v.box(0, 7, 0, 0, 9, 0, '#5d6178');
    return v;
  }));
  g.add(mk(`lantern:glow:${color}`, () => new Vox().box(-1, 1, -1, 1, 5, 1, color), { glow: 1.8 }));
  return g;
}

export function plant(seed = 1): THREE.Mesh {
  return mk(`plant:${seed}`, () => {
    const v = new Vox();
    v.cylinder(0, 0, 0, 3, 5, (x, y) => (y === 4 ? '#c46a3a' : (x + y) % 2 ? '#a8552a' : '#b5612f'));
    v.cylinder(0, 4, 0, 2.5, 1, '#5a3a1f');
    let s = seed * 9301;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 7; i++) {
      const a = rnd() * Math.PI * 2;
      const len = 4 + Math.floor(rnd() * 6);
      for (let j = 0; j < len; j++) {
        const x = Math.round(Math.cos(a) * j * 0.6), z = Math.round(Math.sin(a) * j * 0.6);
        const y = 5 + Math.round(j * 1.1 - (j * j) / 14);
        v.set(x, y, z, j % 3 === 0 ? '#3f8f3f' : '#4fae3f').set(x + 1, y, z, '#6fcf4f');
      }
    }
    return v;
  });
}

export function mushroom(cap = '#c77dff', glow = true, size = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(mk(`mush:stem:${size}`, () => new Vox().cylinder(0, 0, 0, 1.5 * size, Math.round(6 * size), '#efe2c8')));
  const capMesh = mk(`mush:cap:${cap}:${size}`, () => {
    const v = new Vox();
    v.ellipsoid(0, 6 * size, 0, 5 * size, 3 * size, 5 * size, (x, y, z) => {
      if (y < 6 * size) return null;
      return (x * 3 + z * 5 + y) % 7 === 0 ? '#ffffff' : cap;
    });
    return v;
  }, { glow: glow ? 1.6 : undefined });
  g.add(capMesh);
  return g;
}

export function turntable(): THREE.Group {
  const g = new THREE.Group();
  g.add(mk('tt:base', () => {
    const v = new Vox();
    v.box(-9, 0, -5, 9, 2, 5, '#2b2b38');
    v.box(-9, 2, -5, 9, 2, 5, '#3b3b4f');
    v.box(-1, 3, -3, 1, 3, 3, '#5d6178');
    for (let i = -2; i <= 2; i++) v.set(i * 0.4, 3, -4, '#141418');
    return v;
  }));
  return g;
}

export function record(): THREE.Mesh {
  return mk('record', () => {
    const v = new Vox();
    v.cylinder(0, 0, 0, 3.6, 1, (x, _y, z) => {
      const d = Math.sqrt(x * x + z * z);
      if (d < 1.2) return '#ff5d5d';
      return Math.round(d) % 2 ? '#202028' : '#141418';
    }, 3.6);
    v.set(1, 1, 0, '#ffe245');
    return v;
  });
}

export function speaker(): { group: THREE.Group; cone: THREE.Object3D } {
  const g = new THREE.Group();
  g.add(mk('speaker:box', () => {
    const v = new Vox();
    v.box(-4, 0, -3, 4, 18, 3, '#24222e');
    v.box(-4, 0, 3, 4, 0, 3, '#3b3b4f');
    for (let x = -3; x <= 3; x++) v.set(x, 17, 4, x % 2 ? '#5d6178' : '#3b3b4f');
    return v;
  }));
  const cone = new THREE.Group();
  cone.add(mk('speaker:cone', () => {
    const v = new Vox();
    v.cylinderZ(0, 0, 0, 3.4, 1, '#3b3b4f');
    v.cylinderZ(1, 0, 0, 2, 1, '#5d6178');
    v.cylinderZ(1, 0, 0, 0.8, 2, '#8a8fa8');
    return v;
  }));
  cone.position.set(0, 6 * V, 3.5 * V);
  const cone2 = cone.clone();
  cone2.position.set(0, 12.5 * V, 3.5 * V);
  cone2.scale.setScalar(0.7);
  g.add(cone, cone2);
  return { group: g, cone };
}

export function chalkFrame(w: number, h: number, wood = '#6a4428'): THREE.Mesh {
  return mk(`chalkframe:${w}:${h}:${wood}`, () => {
    const v = new Vox();
    const W = Math.round(w / V / 2), H = Math.round(h / V);
    v.box(-W - 1, -1, -1, W + 1, 0, 1, wood).box(-W - 1, H, -1, W + 1, H + 1, 1, wood);
    v.box(-W - 1, 0, -1, -W, H, 1, wood).box(W, 0, -1, W + 1, H, 1, wood);
    v.box(-W + 4, -3, 0, W - 4, -2, 3, shade(wood, -0.1));
    v.box(-W + 8, -1, 2, -W + 10, -1, 2, '#ffffff').box(-W + 14, -1, 2, -W + 15, -1, 2, '#ffe245').box(W - 12, -1, 2, W - 9, -1, 2, '#c8ccd8');
    v.box(-W - 1, -12, 0, -W, -2, 0, wood).box(W, -12, 0, W + 1, -2, 0, wood);
    return v;
  });
}

export function bottle(): THREE.Mesh {
  return mk('bottle', () => {
    const v = new Vox();
    v.cylinderZ(-6, 0, 0, 2.2, 9, (x, y, z) => (y > 1 && z < 0 ? '#9be3b4' : '#3fae6f'));
    v.cylinderZ(3, 0, 0, 1.1, 4, '#3fae6f');
    v.cylinderZ(7, 0, 0, 1.2, 1, '#c8a06a');
    return v;
  }, { origin: [0, 0, 0] });
}

export function tv(): THREE.Group {
  const g = new THREE.Group();
  g.add(mk('tv:body', () => {
    const v = new Vox();
    v.box(-12, 0, -6, 12, 18, 6, '#8a5a33');
    v.box(-10, 2, 6, 6, 16, 6, '#1b1b22');
    v.box(8, 12, 6, 10, 14, 7, '#ffd23a').box(8, 7, 6, 10, 9, 7, '#c8ccd8');
    for (const s of [-1, 1]) v.box(s * 10, -4, -3, s * 9, -1, -2, '#3b2a1f');
    for (let i = 0; i < 8; i++) { v.set(-4 - i, 19 + i, 0, '#5d6178'); v.set(4 + i * 0.6, 19 + i, 0, '#5d6178'); }
    return v;
  }));
  return g;
}

export function hammer(color = '#ff5d9e'): THREE.Mesh {
  return mk(`hammer:${color}`, () => {
    const v = new Vox();
    v.box(0, 0, 0, 0, 12, 0, '#ffe245').box(-1, 0, -1, 1, 0, 1, '#ffe245');
    v.ellipsoid(0, 15, 0, 5, 3, 3, (x) => (Math.abs(x) >= 4 ? '#ffffff' : color));
    return v;
  }, { origin: [0, 0, 0] });
}

export function lilyPad(color = '#4fae3f', r = 8, flower = false): THREE.Mesh {
  return mk(`lily:${color}:${r}:${flower}`, () => {
    const v = new Vox();
    v.cylinder(0, 0, 0, r, 1, (x, _y, z) => {
      const a = Math.atan2(z, x);
      if (Math.abs(a - 0.4) < 0.28 && x * x + z * z > 4) return null;
      const d = Math.sqrt(x * x + z * z);
      if (Math.abs(Math.atan2(z, x) * 3) % 1.5 < 0.12 && d > 2) return shade(color, -0.12);
      return d > r - 1.2 ? shade(color, -0.08) : color;
    }, r);
    if (flower) {
      v.sphere(-r * 0.4, 2, -r * 0.3, 2, '#ff9ec9');
      v.set(-r * 0.4, 3, -r * 0.3, '#ffe245');
    }
    return v;
  });
}

export function throne(): THREE.Group {
  const g = new THREE.Group();
  g.add(mk('throne', () => {
    const v = new Vox();
    v.cylinder(0, 0, 0, 16, 2, (x, _y, z) => (Math.abs(Math.atan2(z, x) + 1.57) < 0.25 ? null : (x * x + z * z) > 200 ? '#e8a81a' : '#ffc531'), 16);
    v.ellipsoid(0, 2, -9, 12, 16, 4, (x, y) => (y < 2 ? null : (x + y) % 5 === 0 ? '#fff1b0' : '#ffc531'));
    v.cylinder(0, 2, 0, 9, 4, '#e8383d', 9);
    for (let i = 0; i < 5; i++) v.sphere(-10 + i * 5, 17 + (i % 2) * 2, -9, 1.5, i % 2 ? '#4aa3ff' : '#ff5d5d');
    return v;
  }));
  return g;
}

export function fireplace(): { group: THREE.Group; fire: THREE.Mesh } {
  const g = new THREE.Group();
  g.add(mk('fireplace', () => {
    const v = new Vox();
    v.box(-16, 0, -4, 16, 30, 4, (x, y) => ((Math.floor(y / 3) + Math.floor(x / 4)) % 2 ? '#6c7088' : '#5d6178'));
    v.carve((x, y, z) => Math.abs(x) <= 9 && y >= 1 && y <= 13 && z > -3);
    v.box(-18, 30, -5, 18, 32, 6, '#6a4428');
    v.box(-9, 0, -3, 9, 0, 4, '#2b2b38');
    for (let i = -6; i <= 6; i += 4) v.box(i, 1, -1, i + 2, 2, 2, '#5a3a1f');
    return v;
  }));
  const fire = mk('fire', () => {
    const v = new Vox();
    for (let y = 0; y < 9; y++) {
      const r = 5 * (1 - y / 10);
      for (let x = -6; x <= 6; x++) for (let z = -2; z <= 2; z++) if (x * x / (r * r + 0.1) + z * z / 6 <= 1) v.set(x, y + 3, z, y < 2 ? '#fff1b0' : y < 4 ? '#ffd23a' : y < 6 ? '#ff8a2a' : '#e8383d');
    }
    return v;
  }, { glow: 2.2 });
  g.add(fire);
  return { group: g, fire };
}

export function window_(w = 3, h = 2.4, frame = '#6a4428'): THREE.Mesh {
  return mk(`window:${w}:${h}:${frame}`, () => {
    const v = new Vox();
    const W = Math.round(w / V / 2), H = Math.round(h / V);
    v.box(-W, 0, 0, W, 1, 1, frame).box(-W, H - 1, 0, W, H, 1, frame).box(-W, 0, 0, -W + 1, H, 1, frame).box(W - 1, 0, 0, W, H, 1, frame);
    v.box(-1, 0, 0, 0, H, 1, frame).box(-W, Math.round(H / 2), 0, W, Math.round(H / 2) + 1, 1, frame);
    v.box(-W - 1, -2, -1, W + 1, -1, 3, shade(frame, 0.1));
    return v;
  });
}

export function arcadeCabinet(color = '#ff2fa0'): THREE.Group {
  const g = new THREE.Group();
  g.add(mk(`arcade:${color}`, () => {
    const v = new Vox();
    v.box(-6, 0, -5, 6, 34, 5, '#24222e');
    v.box(-6, 30, -5, 6, 34, 5, color);
    v.box(-5, 18, 5, 5, 18, 8, '#3b3b4f');
    v.set(-3, 19, 7, '#ff5d5d').set(2, 19, 7, '#4aa3ff').set(4, 19, 6, '#ffe245');
    for (const s of [-1, 1]) v.box(s * 6, 0, -5, s * 6, 34, 5, shade(color, -0.3));
    return v;
  }));
  return g;
}

export function crate(): THREE.Mesh {
  return mk('crate', () => {
    const v = new Vox();
    v.box(-5, 0, -5, 5, 9, 5, (x, y, z) => ((Math.abs(x) === 5 || Math.abs(z) === 5) && (y === 0 || y === 9 || Math.abs(x) === 5 && Math.abs(z) === 5) ? '#6a4428' : (x + z + y) % 4 === 0 ? '#9a6b3f' : '#b5794a'));
    return v;
  });
}

export function reeds(seed = 1): THREE.Mesh {
  return mk(`reeds:${seed}`, () => {
    const v = new Vox();
    let s = seed * 7919;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 9; i++) {
      const x = Math.round((rnd() - 0.5) * 10), z = Math.round((rnd() - 0.5) * 10);
      const h = 10 + Math.floor(rnd() * 14);
      v.box(x, 0, z, x, h, z, '#3f7f52');
      if (rnd() < 0.6) v.box(x, h - 4, z, x, h - 1, z, '#7a4a2a').set(x + 1, h - 3, z, '#7a4a2a');
    }
    return v;
  });
}

export function rock(seed = 1, color = '#6c7088'): THREE.Mesh {
  return mk(`rock:${seed}:${color}`, () => {
    const v = new Vox();
    v.ellipsoid(0, 0, 0, 5 + (seed % 3), 3 + (seed % 2), 4, (x, y, z) => (y < 0 ? null : (x + y + z) % 4 === 0 ? shade(color, 0.08) : color));
    return v;
  });
}

export function tree(seed = 1, leaf = '#3f8f52'): THREE.Group {
  const g = new THREE.Group();
  g.add(mk(`tree:${seed}:${leaf}`, () => {
    const v = new Vox();
    v.box(-2, 0, -2, 2, 22, 2, (x, y) => ((x + y) % 3 === 0 ? '#5a3a1f' : '#7a4a2a'));
    for (let i = 0; i < 5; i++) {
      const y = 14 + i * 7, r = 15 - i * 2.8;
      v.cone(0, y, 0, r, 9, (x, yy, z) => ((x * 3 + z * 7 + yy) % 6 === 0 ? shade(leaf, 0.12) : yy % 9 === 0 ? shade(leaf, -0.1) : leaf));
    }
    return v;
  }));
  return g;
}

export function armchair(color = '#b03a2e'): THREE.Mesh {
  return mk(`armchair:${color}`, () => {
    const v = new Vox();
    v.box(-12, 3, -10, 12, 9, 10, color);
    v.box(-12, 9, -10, 12, 24, -6, (x, y) => ((x + y) % 5 === 0 ? shade(color, -0.1) : color));
    for (const s of [-1, 1]) v.box(s * 12, 3, -10, s * 9, 15, 10, shade(color, 0.06));
    v.box(-9, 9, -6, 9, 11, 9, shade(color, 0.12));
    for (const [x, z] of [[-11, -9], [11, -9], [-11, 9], [11, 9]]) v.box(x, 0, z, x, 2, z, '#3b2a1f');
    return v;
  });
}

export function bookshelf(): THREE.Mesh {
  return mk('bookshelf', () => {
    const v = new Vox();
    v.box(-16, 0, -5, 16, 48, 5, '#6a4428');
    v.carve((x, y, z) => Math.abs(x) <= 14 && z > -4 && y >= 2 && y <= 46 && y % 12 !== 1);
    const colors = ['#c0392b', '#2f7bff', '#ffd23a', '#3fae6f', '#8f5cff', '#ff8a2a', '#ffffff'];
    for (let shelf = 0; shelf < 4; shelf++) {
      const y0 = 2 + shelf * 12;
      let x = -14;
      let i = shelf * 3;
      while (x < 14) {
        const w = 1 + (i % 3 === 0 ? 1 : 0);
        const h = 6 + (i % 4);
        if (shelf % 2 === 0 || x < 0) v.box(x, y0, -3, x + w - 1, y0 + h, 2, colors[i % colors.length]);
        x += w + (i % 5 === 0 ? 1 : 0);
        i++;
      }
    }
    return v;
  });
}

export function poster(texture: THREE.Texture, w: number, h: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
  m.receiveShadow = true;
  return m;
}

export function mirrorFrame(): THREE.Mesh {
  return mk('mirrorframe', () => {
    const v = new Vox();
    v.box(-12, 0, -1, 12, 1, 1, '#c8a06a').box(-12, 40, -1, 12, 41, 1, '#c8a06a');
    v.box(-12, 0, -1, -11, 41, 1, '#c8a06a').box(11, 0, -1, 12, 41, 1, '#c8a06a');
    v.sphere(0, 43, 0, 2, '#ffd23a');
    for (const s of [-1, 1]) v.box(s * 9, -6, 0, s * 8, -1, 0, '#8a5a33');
    return v;
  });
}

export function merchantStall(): THREE.Group {
  const g = new THREE.Group();
  g.add(mk('stall', () => {
    const v = new Vox();
    v.box(-24, 0, -8, 24, 14, 8, (x, y) => ((Math.floor(x / 4) + y) % 2 ? '#9a6b3f' : '#8a5a33'));
    v.box(-25, 14, -9, 25, 15, 9, '#6a4428');
    for (const s of [-1, 1]) v.box(s * 24, 15, -8, s * 23, 44, -7, '#6a4428');
    for (let x = -26; x <= 26; x++) for (let z = -12; z <= 4; z++) {
      const y = 44 + Math.round((4 - z) * 0.35);
      v.set(x, y, z, Math.floor((x + 26) / 4) % 2 ? '#e8383d' : '#f4f1e8');
    }
    for (let x = -26; x <= 26; x += 2) v.set(x, 49, 5, Math.floor((x + 26) / 4) % 2 ? '#e8383d' : '#f4f1e8').set(x, 48, 5, '#f4f1e8');
    return v;
  }));
  return g;
}

export function trophy(color = '#ffc531'): THREE.Mesh {
  return mk(`trophy:${color}`, () => {
    const v = new Vox();
    v.box(-3, 0, -2, 3, 1, 2, '#6a4428');
    v.box(-1, 2, -1, 1, 4, 1, color);
    v.ellipsoid(0, 8, 0, 4, 4, 3, (x, y) => (y < 6 ? null : x === -2 && y === 9 ? '#ffffff' : color));
    for (const s of [-1, 1]) v.box(s * 5, 7, 0, s * 5, 9, 0, color);
    return v;
  });
}

export function scrapbook(): THREE.Mesh {
  return mk('scrapbook', () => {
    const v = new Vox();
    v.box(-8, 0, -6, 8, 2, 6, '#b03a2e');
    v.box(-7, 3, -5, 7, 3, 5, '#f4ead0');
    v.box(-1, 3, -6, 1, 3, 6, '#8a3a2e');
    v.set(-4, 4, -2, '#ff9ec9').set(3, 4, 2, '#ffd23a').set(4, 4, -3, '#4fae3f');
    return v;
  });
}

export function recordPlayer(): { group: THREE.Group; disc: THREE.Object3D; arm: THREE.Object3D } {
  const g = new THREE.Group();
  g.add(mk('rp:base', () => {
    const v = new Vox();
    v.box(-7, 0, -6, 7, 3, 6, '#8a5a33');
    v.box(-7, 3, -6, 7, 3, 6, '#6a4428');
    v.box(5, 4, 4, 6, 4, 5, '#ffd23a');
    return v;
  }));
  const disc = record();
  disc.position.set(-1 * V, 4 * V, 0);
  disc.scale.setScalar(1.4);
  g.add(disc);
  const arm = new THREE.Group();
  arm.add(mk('rp:arm', () => new Vox().box(0, 0, 0, 0, 0, 7, '#c8ccd8').box(-1, 0, 7, 0, 0, 8, '#5d6178')));
  arm.position.set(5 * V, 5 * V, -4 * V);
  arm.rotation.y = -0.4;
  g.add(arm);
  const horn = mk('rp:horn', () => {
    const v = new Vox();
    for (let i = 0; i < 12; i++) v.cylinder(0, i, 0, 0.6 + i * 0.35, 1, i % 3 === 0 ? '#e8b81a' : '#ffc531', 0.6 + i * 0.35);
    v.carve((x, y, z) => x * x + z * z < (y * 0.35 - 0.6) ** 2 && y > 2);
    return v;
  });
  horn.position.set(-5 * V, 3 * V, -5 * V);
  horn.rotation.set(-0.5, 0.6, 0.3);
  g.add(horn);
  return { group: g, disc, arm };
}

export function fly(): THREE.Mesh {
  return mk('fly', () => new Vox().box(0, 0, 0, 1, 1, 1, '#1b1420').set(-1, 2, 0, '#d8f0ff').set(2, 2, 0, '#d8f0ff').set(0, 1, 2, '#ff5d5d'));
}

export function microphone(): THREE.Mesh {
  return mk('mic', () => new Vox().box(0, 0, 0, 0, 8, 0, '#5d6178').sphere(0, 10, 0, 2, '#c8ccd8'));
}

export function mosquito(): THREE.Mesh {
  return mk('mosquito', () => new Vox().box(0, 0, 0, 1, 0, 2, '#2b2b38').set(0, 0, 3, '#ff5d5d').set(0, 0, 4, '#ff5d5d').set(-1, 1, 1, '#d8f0ff').set(2, 1, 1, '#d8f0ff'));
}

export { V as PROP_VOX };
export const tmpColor = new THREE.Color();
