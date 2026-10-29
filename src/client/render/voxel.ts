// Tiny voxel modelling kit: build shapes in code, then mesh them into a single BufferGeometry with
// per-vertex colours and baked ambient occlusion (the soft "toy" shading of voxel art).

import * as THREE from 'three';

export type ColorSrc = number | string | ((x: number, y: number, z: number) => number | string | null);

const OFF = 64;
const key = (x: number, y: number, z: number) => ((x + OFF) << 14) | ((y + OFF) << 7) | (z + OFF);
const unkey = (k: number): [number, number, number] => [((k >> 14) & 127) - OFF, ((k >> 7) & 127) - OFF, (k & 127) - OFF];

const colorCache = new Map<string, number>();
export function toHex(c: number | string): number {
  if (typeof c === 'number') return c;
  let v = colorCache.get(c);
  if (v === undefined) {
    v = new THREE.Color(c).getHex();
    colorCache.set(c, v);
  }
  return v;
}

/** Deterministic per-voxel jitter so flat colours get a hand-painted texture. */
export function jitter(hex: number, x: number, y: number, z: number, amount = 0.06): number {
  const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  const n = (h - Math.floor(h) - 0.5) * 2 * amount;
  const r = Math.min(255, Math.max(0, ((hex >> 16) & 255) * (1 + n)));
  const g = Math.min(255, Math.max(0, ((hex >> 8) & 255) * (1 + n)));
  const b = Math.min(255, Math.max(0, (hex & 255) * (1 + n)));
  return (r << 16) | (g << 8) | b;
}

export class Vox {
  readonly map = new Map<number, number>();

  set(x: number, y: number, z: number, c: ColorSrc): this {
    x = Math.round(x); y = Math.round(y); z = Math.round(z);
    if (x < -63 || x > 63 || y < -63 || y > 63 || z < -63 || z > 63) return this;
    const col = typeof c === 'function' ? c(x, y, z) : c;
    if (col === null) return this;
    this.map.set(key(x, y, z), toHex(col));
    return this;
  }

  get(x: number, y: number, z: number): number | undefined {
    return this.map.get(key(x, y, z));
  }

  has(x: number, y: number, z: number): boolean {
    return this.map.has(key(x, y, z));
  }

  del(x: number, y: number, z: number): this {
    this.map.delete(key(x, y, z));
    return this;
  }

  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: ColorSrc): this {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.set(x, y, z, c);
    return this;
  }

  ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, c: ColorSrc, filter?: (x: number, y: number, z: number) => boolean): this {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
          const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
          if (d <= 1 && (!filter || filter(x, y, z))) this.set(x, y, z, c);
        }
    return this;
  }

  sphere(cx: number, cy: number, cz: number, r: number, c: ColorSrc, filter?: (x: number, y: number, z: number) => boolean): this {
    return this.ellipsoid(cx, cy, cz, r, r, r, c, filter);
  }

  cylinder(cx: number, y0: number, cz: number, r: number, h: number, c: ColorSrc, rz = r): this {
    for (let y = y0; y < y0 + h; y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
          if (((x - cx) / r) ** 2 + ((z - cz) / rz) ** 2 <= 1) this.set(x, y, z, c);
    return this;
  }

  /** Cylinder lying along the X axis. */
  cylinderX(x0: number, cy: number, cz: number, r: number, len: number, c: ColorSrc): this {
    for (let x = x0; x < x0 + len; x++)
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
        for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
          if ((y - cy) ** 2 + (z - cz) ** 2 <= r * r) this.set(x, y, z, c);
    return this;
  }

  /** Cylinder lying along the Z axis. */
  cylinderZ(z0: number, cx: number, cy: number, r: number, len: number, c: ColorSrc): this {
    for (let z = z0; z < z0 + len; z++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, z, c);
    return this;
  }

  cone(cx: number, y0: number, cz: number, r: number, h: number, c: ColorSrc): this {
    for (let y = 0; y < h; y++) {
      const rr = r * (1 - y / h);
      for (let x = Math.floor(cx - rr); x <= Math.ceil(cx + rr); x++)
        for (let z = Math.floor(cz - rr); z <= Math.ceil(cz + rr); z++)
          if ((x - cx) ** 2 + (z - cz) ** 2 <= rr * rr + 0.3) this.set(x, y0 + y, z, c);
    }
    return this;
  }

  /** Recolours existing voxels that satisfy a predicate. */
  paint(pred: (x: number, y: number, z: number) => boolean, c: ColorSrc): this {
    for (const k of this.map.keys()) {
      const [x, y, z] = unkey(k);
      if (pred(x, y, z)) {
        const col = typeof c === 'function' ? c(x, y, z) : c;
        if (col !== null) this.map.set(k, toHex(col));
      }
    }
    return this;
  }

  carve(pred: (x: number, y: number, z: number) => boolean): this {
    for (const k of [...this.map.keys()]) {
      const [x, y, z] = unkey(k);
      if (pred(x, y, z)) this.map.delete(k);
    }
    return this;
  }

  /** Mirrors every voxel with x > 0 onto x < 0 (models are drawn on one side). */
  mirrorX(): this {
    for (const [k, c] of [...this.map]) {
      const [x, y, z] = unkey(k);
      if (x !== 0) this.map.set(key(-x, y, z), c);
    }
    return this;
  }

  add(other: Vox, dx = 0, dy = 0, dz = 0): this {
    for (const [k, c] of other.map) {
      const [x, y, z] = unkey(k);
      this.map.set(key(x + dx, y + dy, z + dz), c);
    }
    return this;
  }

  forEach(fn: (x: number, y: number, z: number, c: number) => void): void {
    for (const [k, c] of this.map) {
      const [x, y, z] = unkey(k);
      fn(x, y, z, c);
    }
  }

  /** Outward surface shell: empty cells adjacent to the model (used for clothes). */
  shell(pred: (x: number, y: number, z: number) => boolean, c: ColorSrc): Vox {
    const out = new Vox();
    const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    this.forEach((x, y, z) => {
      for (const [dx, dy, dz] of dirs) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (!this.has(nx, ny, nz) && pred(nx, ny, nz)) out.set(nx, ny, nz, c);
      }
    });
    return out;
  }

  bounds(): { min: THREE.Vector3; max: THREE.Vector3 } {
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    this.forEach((x, y, z) => {
      min.min(new THREE.Vector3(x, y, z));
      max.max(new THREE.Vector3(x, y, z));
    });
    return { min, max };
  }

  get size(): number {
    return this.map.size;
  }

  /**
   * Meshes visible faces. `scale` = world size of one voxel. Voxel (0,0,0) is centred on the
   * origin unless an origin offset is given. AO darkens concave corners for a soft, toy-like look.
   */
  build(scale = 1 / 16, opts: { origin?: [number, number, number]; jitter?: number; ao?: number; emissive?: boolean } = {}): THREE.BufferGeometry {
    const [ox, oy, oz] = opts.origin ?? [0, 0, 0];
    const jit = opts.jitter ?? 0.05;
    const aoStrength = opts.ao ?? 0.22;
    const pos: number[] = [];
    const nor: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const solid = (x: number, y: number, z: number) => this.map.has(key(x, y, z));
    // face definitions: normal, 4 corners (as unit offsets), and the two tangent axes for AO
    const faces: { n: [number, number, number]; c: [number, number, number][] }[] = [
      { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
      { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
      { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
      { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
      { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
      { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
    ];
    const tmp = new THREE.Color();
    for (const [k, hex] of this.map) {
      const [x, y, z] = unkey(k);
      const base = jit ? jitter(hex, x, y, z, jit) : hex;
      for (const f of faces) {
        const [nx, ny, nz] = f.n;
        if (solid(x + nx, y + ny, z + nz)) continue;
        const start = pos.length / 3;
        const aos: number[] = [];
        for (const [cx, cy, cz] of f.c) {
          pos.push((x + cx - 0.5 - ox) * scale, (y + cy - 0.5 - oy) * scale, (z + cz - 0.5 - oz) * scale);
          nor.push(nx, ny, nz);
          // AO: look at the 3 voxels touching this corner on the face's outer side.
          const sx = cx === 0 ? -1 : 1, sy = cy === 0 ? -1 : 1, sz = cz === 0 ? -1 : 1;
          let s1: boolean, s2: boolean, cr: boolean;
          if (nx !== 0) {
            s1 = solid(x + nx, y + sy, z); s2 = solid(x + nx, y, z + sz); cr = solid(x + nx, y + sy, z + sz);
          } else if (ny !== 0) {
            s1 = solid(x + sx, y + ny, z); s2 = solid(x, y + ny, z + sz); cr = solid(x + sx, y + ny, z + sz);
          } else {
            s1 = solid(x + sx, y, z + nz); s2 = solid(x, y + sy, z + nz); cr = solid(x + sx, y + sy, z + nz);
          }
          const occ = s1 && s2 ? 3 : (s1 ? 1 : 0) + (s2 ? 1 : 0) + (cr ? 1 : 0);
          const ao = 1 - occ * aoStrength * 0.34;
          aos.push(ao);
          tmp.setHex(base).convertSRGBToLinear();
          col.push(tmp.r * ao, tmp.g * ao, tmp.b * ao);
        }
        // Flip the quad diagonal to avoid AO artefacts.
        if (aos[0] + aos[2] < aos[1] + aos[3]) idx.push(start + 1, start + 2, start + 3, start + 1, start + 3, start);
        else idx.push(start, start + 1, start + 2, start, start + 2, start + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }
}

/** Shared voxel material (vertex colours, slightly rough). */
export const voxMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.0 });

export function voxMesh(v: Vox, scale = 1 / 16, opts: Parameters<Vox['build']>[1] & { material?: THREE.Material; shadows?: boolean } = {}): THREE.Mesh {
  const m = new THREE.Mesh(v.build(scale, opts), opts.material ?? voxMaterial);
  m.castShadow = opts.shadows ?? true;
  m.receiveShadow = true;
  return m;
}

/** Unlit vertex-coloured material for glowing things (mushrooms, screens, lanterns). Values > 1 bloom under tone mapping. */
export function glowMaterial(intensity = 1.4): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(intensity, intensity, intensity), toneMapped: true });
}
