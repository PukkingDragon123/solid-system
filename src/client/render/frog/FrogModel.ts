// Assembles a riggable voxel frog (or toad) from an outfit, with cached geometry per part.

import * as THREE from 'three';
import type { Outfit } from '../../../shared/cosmetics';
import { voxMaterial, type Vox } from '../voxel';
import { buildClothes, buildFace, buildHat, buildNeck, HAT_ANCHOR } from './cosmetics';
import { buildArm, buildBody, buildBrow, buildEyeWhite, buildLeg, buildLid, buildMouth, buildPupil, buildToadBody, buildTongue, EYE, skinColors } from './parts';

export const VOX = 1 / 16;
const geoCache = new Map<string, THREE.BufferGeometry>();

function geo(key: string, make: () => Vox | null, opts: { jitter?: number } = {}): THREE.BufferGeometry | null {
  if (geoCache.has(key)) return geoCache.get(key)!;
  const v = make();
  if (!v || !v.size) { geoCache.set(key, null as never); return null; }
  const g = v.build(VOX, { jitter: opts.jitter ?? 0.04 });
  geoCache.set(key, g);
  return g;
}

const goldMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.65 });
const glassMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.0, transparent: true, opacity: 0.72 });

function mesh(g: THREE.BufferGeometry | null, mat: THREE.Material = voxMaterial): THREE.Mesh | null {
  if (!g) return null;
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const at = (x: number, y: number, z: number) => new THREE.Vector3(x * VOX, y * VOX, z * VOX);

export type MouthKind = string;
export const LID_LEVELS = [0, 0.25, 0.5, 0.75, 1];

export interface EyeRig {
  group: THREE.Group;
  pupil: THREE.Group;
  lids: THREE.Mesh[];
  brow: THREE.Mesh;
  baseScale: number;
}

export class FrogModel {
  readonly root = new THREE.Group();
  readonly rig = new THREE.Group();
  readonly bodyGroup = new THREE.Group();
  eyes: EyeRig[] = [];
  mouths = new Map<string, THREE.Mesh>();
  armL = new THREE.Group();
  armR = new THREE.Group();
  legL = new THREE.Group();
  legR = new THREE.Group();
  hat = new THREE.Group();
  spinner: THREE.Object3D | null = null;
  hatFloats = false;
  tongue = new THREE.Group();
  headTop = new THREE.Object3D();
  isToad = false;
  outfit: Outfit;
  private lidLevel = 0;
  private mouthKind = 'mouth_smile';

  constructor(outfit: Outfit, opts: { toad?: boolean } = {}) {
    this.outfit = outfit;
    this.root.add(this.rig);
    this.rig.add(this.bodyGroup);
    this.build(outfit, opts.toad ?? false);
  }

  private clear(): void {
    this.bodyGroup.clear();
    this.eyes = [];
    this.mouths.clear();
    for (const g of [this.armL, this.armR, this.legL, this.legR, this.hat, this.tongue]) g.clear();
    this.spinner = null;
  }

  build(outfit: Outfit, toad = false): void {
    this.clear();
    this.outfit = outfit;
    this.isToad = toad;
    const skin = toad ? 'skin_toad' : outfit.skin;
    const { body } = toad ? { body: '#7d7a3a' } : skinColors(outfit.skin);
    const bodyMat = outfit.skin === 'skin_gold' && !toad ? goldMat : outfit.skin === 'skin_glass' && !toad ? glassMat : voxMaterial;
    const g = this.bodyGroup;

    if (toad) {
      g.add(mesh(geo('toad:body', buildToadBody, { jitter: 0.08 }))!);
    } else {
      g.add(mesh(geo(`body:${outfit.skin}:${outfit.pattern}`, () => buildBody(outfit.skin, outfit.pattern)), bodyMat)!);
    }

    // Eyes (toads get mismatched ones).
    const eyeDefs = toad
      ? [{ x: -5, y: 12.5, z: 3.5, r: 1.2 }, { x: 5.5, y: 11.4, z: 3.3, r: 0.75 }]
      : [{ x: -EYE.x, y: EYE.y, z: EYE.z, r: 1 }, { x: EYE.x, y: EYE.y, z: EYE.z, r: 1 }];
    const eyeStyle = toad ? 'eyes_googly' : outfit.eyes;
    for (const d of eyeDefs) {
      const eg = new THREE.Group();
      eg.position.copy(at(d.x, d.y, d.z));
      eg.scale.setScalar(d.r);
      const white = mesh(geo(`eye:${eyeStyle}`, () => buildEyeWhite(eyeStyle)))!;
      eg.add(white);
      const pupil = new THREE.Group();
      const pr = eyeStyle === 'eyes_googly' ? 4.2 : EYE.r;
      pupil.position.set(0, 0, (pr + 0.4) * VOX);
      pupil.add(mesh(geo(`pupil:${eyeStyle}`, () => buildPupil(eyeStyle), { jitter: 0 }))!);
      if (eyeStyle === 'eyes_side') pupil.position.x = (d.x > 0 ? 1.2 : 1.2) * VOX;
      eg.add(pupil);
      const lids = LID_LEVELS.map((lv) => {
        const m = mesh(geo(`lid:${skin}:${lv}:${pr}`, () => (lv === 0 ? null : buildLid(body, lv, pr)), { jitter: 0.02 }));
        const mm = m ?? new THREE.Mesh();
        mm.visible = false;
        eg.add(mm);
        return mm;
      });
      const brow = mesh(geo('brow', buildBrow, { jitter: 0 }))!;
      brow.position.set(0, (pr + 1.6) * VOX, (pr - 0.6) * VOX);
      brow.visible = false;
      eg.add(brow);
      g.add(eg);
      this.eyes.push({ group: eg, pupil, lids, brow, baseScale: d.r });
    }

    // Mouths: base style + expression set.
    if (!toad) {
      const kinds = [outfit.mouth, 'grin', 'o', 'open', 'frown', 'wavy', 'flat', 'mouth_smug'];
      for (const k of kinds) {
        if (this.mouths.has(k)) continue;
        const m = mesh(geo(`mouth:${k}`, () => buildMouth(k), { jitter: 0 }))!;
        m.visible = false;
        m.castShadow = false;
        g.add(m);
        this.mouths.set(k, m);
      }
      this.mouthKind = outfit.mouth;
      this.setMouth('base');
    }

    // Clothes.
    const clothes = toad ? { vox: null, sleeve: null } : buildClothes(outfit.clothes, outfit.skin);
    if (clothes.vox) g.add(mesh(geo(`clothes:${outfit.clothes}:${outfit.skin}`, () => clothes.vox))!);

    // Limbs.
    const toadScale = toad ? 1.35 : 1;
    const armGeo = geo(`arm:${skin}:${clothes.sleeve}`, () => buildArm(toad ? 'skin_brown' : outfit.skin, clothes.sleeve));
    for (const [grp, s] of [[this.armL, -1], [this.armR, 1]] as const) {
      grp.position.copy(at(s * (toad ? 9.5 : 8.4), toad ? 7 : 7, 2.5));
      const m = mesh(armGeo)!;
      if (s < 0) m.scale.x = -1;
      grp.add(m);
      grp.scale.setScalar(toadScale);
      grp.rotation.z = s * 0.25;
      g.add(grp);
    }
    const legGeo = geo(`leg:${skin}`, () => buildLeg(toad ? 'skin_brown' : outfit.skin));
    for (const [grp, s] of [[this.legL, -1], [this.legR, 1]] as const) {
      grp.position.copy(at(s * (toad ? 7.5 : 6.2), 2, 1.5));
      grp.add(mesh(legGeo)!);
      grp.scale.setScalar(toadScale);
      grp.rotation.y = s * 0.35;
      g.add(grp);
    }

    // Accessories (toads keep their hat for maximum comedy).
    const hatDef = buildHat(outfit.hat);
    this.hatFloats = false;
    if (hatDef) {
      this.hat.position.copy(at(HAT_ANCHOR[0], HAT_ANCHOR[1] - (toad ? 3 : 0), HAT_ANCHOR[2]));
      this.hat.add(mesh(geo(`hat:${outfit.hat}`, () => hatDef.main))!);
      if (hatDef.spinner) {
        const sp = mesh(geo(`hatspin:${outfit.hat}`, () => hatDef.spinner!))!;
        sp.position.y = 7 * VOX;
        this.hat.add(sp);
        this.spinner = sp;
      }
      this.hatFloats = Boolean(hatDef.float);
      if (this.hatFloats) this.hat.position.y += 3 * VOX;
      if (toad) this.hat.rotation.z = 0.35;
      g.add(this.hat);
    }
    if (!toad) {
      const neck = mesh(geo(`neck:${outfit.neck}`, () => buildNeck(outfit.neck)));
      if (neck) g.add(neck);
      const face = mesh(geo(`face:${outfit.face}`, () => buildFace(outfit.face)));
      if (face) g.add(face);
    }

    // Tongue (for catching flies).
    this.tongue.position.copy(at(0, toad ? 5 : 7, toad ? 8 : 7));
    this.tongue.add(mesh(geo('tongue', buildTongue, { jitter: 0 }))!);
    this.tongue.scale.set(1, 1, 0.01);
    this.tongue.visible = false;
    g.add(this.tongue);

    this.headTop.position.copy(at(0, toad ? 16 : 20, 0));
    g.add(this.headTop);
    this.setLid(eyeStyle === 'eyes_sleepy' ? 0.5 : toad ? 0.5 : 0);
    if (toad) this.eyes[1].pupil.position.set(1.5 * VOX, -1.2 * VOX, 4.4 * VOX);
  }

  /** 0 = open … 1 = shut (quantised to the prebuilt lid meshes). */
  setLid(level: number, eye?: number): void {
    const l = Math.max(0, Math.min(1, level));
    const idx = Math.round(l * (LID_LEVELS.length - 1));
    this.eyes.forEach((e, i) => {
      if (eye !== undefined && eye !== i) return;
      e.lids.forEach((m, j) => (m.visible = j === idx && j > 0));
    });
    if (eye === undefined) this.lidLevel = l;
  }

  get lid(): number {
    return this.lidLevel;
  }

  setMouth(kind: string): void {
    const k = kind === 'base' ? this.mouthKind : kind;
    for (const [mk, m] of this.mouths) m.visible = mk === k;
  }

  setBrows(on: boolean, angle = 0.35): void {
    this.eyes.forEach((e, i) => {
      e.brow.visible = on;
      e.brow.rotation.z = (i === 0 ? -1 : 1) * angle;
    });
  }

  /** Pupil offset in voxel units (-1.2..1.2). */
  look(x: number, y: number): void {
    for (const e of this.eyes) {
      e.pupil.position.x = THREE.MathUtils.clamp(x, -1.3, 1.3) * VOX;
      e.pupil.position.y = THREE.MathUtils.clamp(y, -1.3, 1.3) * VOX;
    }
  }

  setPupilScale(s: number): void {
    for (const e of this.eyes) e.pupil.scale.setScalar(s);
  }

  dispose(): void {
    this.root.removeFromParent();
  }
}
