// The main menu: a cozy swamp cabin. Your frog lounges in an armchair by the fire listening to vinyl.
// Every menu is a physical station in the room — the camera glides between them and your frog hops along.

import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { DEFAULT_OUTFIT, type Outfit } from '../../../shared/cosmetics';
import { Painter, shade } from '../../art/painter';
import { logs, planks, rug } from '../../art/textures';
import { drawIcon } from '../../art/icons';
import { FrogActor, type FxKind } from '../../render/frog/FrogActor';
import { buildClothes, buildFace, buildHat, buildNeck } from '../../render/frog/cosmetics';
import { VOX } from '../../render/frog/FrogModel';
import { Particles } from '../../render/particles';
import { FX_LAYER } from '../../render/PixelRenderer';
import { voxMesh } from '../../render/voxel';
import { CameraRig, type Shot } from '../common';
import * as P from '../props';

export type Station = 'home' | 'play' | 'customize' | 'shop' | 'collection' | 'profile' | 'tutorial';

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

interface StationDef {
  shot: Shot;
  frog: THREE.Vector3;
  frogRot: number;
  sign: THREE.Vector3;
  label: string;
}

export class Cabin {
  readonly scene = new THREE.Scene();
  readonly rig = new CameraRig(42);
  readonly particles = new Particles();
  readonly frog: FrogActor;
  readonly merchant: FrogActor;
  station: Station = 'home';
  readonly clickables: THREE.Object3D[] = [];
  private fire: THREE.Mesh;
  private fireLight: THREE.PointLight;
  private disc: THREE.Object3D;
  private discSpin = 1;
  private shelfRecords = new THREE.Group();
  private shelfTrophies = new THREE.Group();
  private display = new THREE.Group();
  private displayItem: THREE.Object3D | null = null;
  private time = 0;
  private hover: THREE.Object3D | null = null;
  private mirror: Reflector;
  turntableSpin = 0;
  /** Viewport aspect; portrait screens pull every shot back so the station still fits. */
  aspect = 16 / 9;
  readonly stations: Record<Station, StationDef>;
  sfx: (name: string) => void = () => {};

  constructor() {
    const s = this.scene;
    s.background = new THREE.Color('#140d0a');
    s.fog = new THREE.Fog('#140d0a', 18, 32);
    s.add(new THREE.HemisphereLight('#ffd8b0', '#2a1a10', 0.7));
    const key = new THREE.DirectionalLight('#ffe0c0', 0.9);
    key.position.set(-3, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
    key.shadow.bias = -0.0008;
    s.add(key);
    s.add(this.particles.points);

    // Room shell.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(17, 13), new THREE.MeshStandardMaterial({ map: planks('#8a5a33', [8, 6], 'cabinfloor') }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ map: logs('#7a4f2e', [5, 3]) });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(17, 7), wallMat);
    back.position.set(0, 3.5, -6.5);
    back.receiveShadow = true;
    const left = new THREE.Mesh(new THREE.PlaneGeometry(13, 7), wallMat);
    left.position.set(-8.5, 3.5, 0);
    left.rotation.y = Math.PI / 2;
    left.receiveShadow = true;
    const right = left.clone();
    right.position.x = 8.5;
    right.rotation.y = -Math.PI / 2;
    s.add(back, left, right);
    for (const x of [-5, 0, 5]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 13), new THREE.MeshStandardMaterial({ color: '#4a2f1a' }));
      beam.position.set(x, 6.2, 0);
      s.add(beam);
    }
    const rugM = new THREE.Mesh(new THREE.CircleGeometry(2.8, 32), new THREE.MeshStandardMaterial({ map: rug('#b03a2e', '#e8c25a') }));
    rugM.rotation.x = -Math.PI / 2;
    rugM.position.set(0, 0.01, -1.6);
    rugM.receiveShadow = true;
    s.add(rugM);

    // Fireplace + armchair + record player.
    const fp = P.fireplace();
    fp.group.position.set(0, 0, -6.2);
    fp.group.scale.setScalar(2);
    s.add(fp.group);
    this.fire = fp.fire;
    this.fireLight = new THREE.PointLight('#ff9a4a', 9, 9, 1.6);
    this.fireLight.position.set(0, 1, -5.2);
    this.fireLight.castShadow = true;
    this.fireLight.shadow.mapSize.set(512, 512);
    s.add(this.fireLight);
    this.tag(fp.group, 'fire');
    const chair = P.armchair('#a8382e');
    chair.position.set(0.3, 0, -2.6);
    chair.rotation.y = 0.25;
    chair.scale.setScalar(1.5);
    s.add(chair);
    const side = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.9, 12), new THREE.MeshStandardMaterial({ color: '#6a4428' }));
    side.position.set(-1.7, 0.45, -2.4);
    side.castShadow = true;
    s.add(side);
    const rp = P.recordPlayer();
    rp.group.position.set(-1.7, 0.9, -2.4);
    rp.group.scale.setScalar(1.6);
    rp.group.rotation.y = 0.5;
    this.disc = rp.disc;
    s.add(rp.group);
    this.tag(rp.group, 'record');
    const lamp = P.lantern('#ffd08a');
    lamp.position.set(2.2, 0.9, -2.5);
    lamp.scale.setScalar(1.4);
    const lampTable = side.clone();
    lampTable.position.set(2.2, 0.45, -2.5);
    s.add(lamp, lampTable);
    const lampLight = new THREE.PointLight('#ffc070', 3, 6, 1.6);
    lampLight.position.set(2.2, 1.5, -2.5);
    s.add(lampLight);
    this.tag(lamp, 'lamp');
    (lamp as THREE.Object3D).userData.light = lampLight;

    // Window onto the swamp, with a twinkly night outside.
    const view = new Painter(64, 40);
    for (let y = 0; y < 40; y++) view.rect(0, y, 64, 1, y < 24 ? (y < 12 ? '#16213e' : '#1f2f52') : '#1d3b3a');
    view.noise(0, 0, 64, 22, '#ffffff', 0.03, 2);
    view.circle(14, 9, 4, '#fff1b0');
    for (let i = 0; i < 6; i++) view.poly([[i * 12 - 4, 26], [i * 12 + 3, 10 + (i % 3) * 3], [i * 12 + 10, 26]], '#163a2c');
    view.rect(0, 27, 64, 13, '#1f4a6a');
    view.noise(0, 28, 64, 12, '#5fa8d8', 0.06, 9);
    view.ellipse(40, 33, 6, 1.5, '#3f8f3f');
    const win = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), new THREE.MeshBasicMaterial({ map: view.texture(), toneMapped: false }));
    win.position.set(-4.8, 3.1, -6.45);
    const frame = P.window_(3.4, 2.4);
    frame.position.set(-4.8, 1.9, -6.45);
    s.add(win, frame);
    this.tag(win, 'window');

    // Posters.
    const posters: [string, THREE.Vector3, number, string][] = [
      ['LARPED ONE OUT', v3(3.6, 3.3, -6.45), 0, 'poster'],
      ['DJ LILYPADD', v3(-8.45, 3.3, -3.6), Math.PI / 2, 'tutorial'],
      ['FROG ROCK FEST', v3(8.45, 3.6, 1.4), -Math.PI / 2, 'poster'],
    ];
    for (const [title, pos, rot, act] of posters) {
      const m = P.poster(posterTex(title), 1.6, 2.2);
      m.position.copy(pos);
      m.rotation.y = rot;
      s.add(m);
      this.tag(m, act);
    }

    // Cuckoo clock + guitar + fly jar.
    const clock = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.4), new THREE.MeshStandardMaterial({ color: '#6a4428' }));
    clock.position.set(-2.2, 4.4, -6.3);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), new THREE.MeshBasicMaterial({ color: '#f4ead0' }));
    face.position.set(0, 0.05, 0.21);
    clock.add(face);
    s.add(clock);
    this.tag(clock, 'cuckoo');
    const guitar = new THREE.Group();
    const gbody = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.15, 16), new THREE.MeshStandardMaterial({ color: '#c0392b' }));
    gbody.rotation.x = Math.PI / 2;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.08), new THREE.MeshStandardMaterial({ color: '#5a3a1f' }));
    neck.position.y = 0.7;
    guitar.add(gbody, neck);
    guitar.position.set(-8.3, 2.4, 1.2);
    guitar.rotation.set(0, Math.PI / 2, 0.3);
    s.add(guitar);
    this.tag(guitar, 'guitar');
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.45, 12), new THREE.MeshStandardMaterial({ color: '#c8f0ff', transparent: true, opacity: 0.45, roughness: 0.1 }));
    jar.position.set(-1.7, 1.2, -2.0);
    s.add(jar);
    this.tag(jar, 'jar');

    // Plants + bookshelf (collection) with records and trophies.
    for (const [x, z, seed] of [[-7.6, -5.6, 1], [7.6, -5.6, 2], [-7.6, 5.2, 3], [3.6, -5.8, 4]]) {
      const pl = P.plant(seed);
      pl.position.set(x, 0, z);
      pl.scale.setScalar(2);
      s.add(pl);
      this.tag(pl, 'plant');
    }
    const shelf = P.bookshelf();
    shelf.position.set(8.0, 0, -3.8);
    shelf.rotation.y = -Math.PI / 2;
    shelf.scale.setScalar(1.25);
    s.add(shelf);
    this.tag(shelf, 'collection');
    this.shelfRecords.position.set(7.75, 0, -3.8);
    this.shelfTrophies.position.set(7.75, 0, -3.8);
    s.add(this.shelfRecords, this.shelfTrophies);

    // Changing corner with a real mirror.
    this.mirror = new Reflector(new THREE.PlaneGeometry(1.7, 2.9), { textureWidth: 256, textureHeight: 432, color: new THREE.Color('#d8e8f0'), multisample: 0 });
    this.mirror.position.set(-8.35, 1.8, 3.0);
    this.mirror.rotation.y = Math.PI / 2;
    s.add(this.mirror);
    const mf = P.mirrorFrame();
    mf.position.set(-8.3, 0.25, 3.0);
    mf.rotation.y = Math.PI / 2;
    mf.scale.setScalar(1.15);
    s.add(mf);
    this.tag(mf, 'customize');
    this.tag(this.mirror, 'customize');
    const wardrobe = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.2, 2), new THREE.MeshStandardMaterial({ map: planks('#7a4f2e', [1, 2], 'wardrobe') }));
    wardrobe.position.set(-7.9, 1.6, 5.2);
    wardrobe.castShadow = true;
    s.add(wardrobe);
    this.tag(wardrobe, 'customize');

    // Merchant stall with a frog shopkeeper.
    const stall = P.merchantStall();
    stall.position.set(6.6, 0, 2.6);
    stall.rotation.y = -Math.PI / 2;
    stall.scale.setScalar(1.5);
    s.add(stall);
    this.tag(stall, 'shop');
    this.merchant = new FrogActor({ ...DEFAULT_OUTFIT, skin: 'skin_purple', hat: 'hat_tophat', neck: 'neck_bowtie', face: 'face_monocle', mouth: 'mouth_smug', idle: 'idle_chill' }, this.hooks());
    // Mossy stands on a crate so he can see over his own counter.
    const box = P.crate();
    box.position.set(7.5, 0, 2.6);
    box.scale.setScalar(1.3);
    s.add(box);
    this.merchant.place(v3(7.5, 0.82, 2.6), -Math.PI / 2);
    this.merchant.root.scale.setScalar(1.4);
    s.add(this.merchant.root);
    this.display.position.set(5.8, 1.55, 2.6);
    s.add(this.display);
    // Warm lanterns light the stall and the record shelf.
    for (const [x, y, z, power] of [[6.2, 3.6, 2.6, 7], [6.6, 3.9, -3.6, 6], [-6.2, 3.6, 3.2, 5]] as const) {
      const lan = P.lantern();
      lan.position.set(x, y - 0.4, z);
      s.add(lan);
      const l = new THREE.PointLight('#ffc98a', power, 8, 1.4);
      l.position.set(x, y - 0.6, z);
      s.add(l);
    }

    // Scrapbook desk (profile).
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 1.3), new THREE.MeshStandardMaterial({ map: planks('#9a6b3f', [1, 1], 'desk') }));
    desk.position.set(-4.6, 1.0, 4.2);
    desk.castShadow = desk.receiveShadow = true;
    for (const [dx, dz] of [[-1.05, -0.5], [1.05, -0.5], [-1.05, 0.5], [1.05, 0.5]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12), new THREE.MeshStandardMaterial({ color: '#5a3a1f' }));
      leg.position.set(dx, -0.5, dz);
      desk.add(leg);
    }
    s.add(desk);
    const book = P.scrapbook();
    book.position.set(-4.6, 1.08, 4.2);
    book.scale.setScalar(1.7);
    s.add(book);
    this.tag(book, 'profile');
    this.tag(desk, 'profile');

    // Party table (play) by the door.
    const ptable = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.12, 24), new THREE.MeshStandardMaterial({ map: planks('#a8743f', [1, 1], 'ptable') }));
    ptable.position.set(3.8, 0.9, 4.0);
    ptable.castShadow = ptable.receiveShadow = true;
    const pleg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 0.85, 10), new THREE.MeshStandardMaterial({ color: '#5a3a1f' }));
    pleg.position.y = -0.45;
    ptable.add(pleg);
    s.add(ptable);
    const invite = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.6), new THREE.MeshStandardMaterial({ map: inviteTex() }));
    invite.position.set(3.8, 0.98, 4.0);
    invite.rotation.y = 0.3;
    s.add(invite);
    for (let i = 0; i < 3; i++) {
      const mini = P.lilyPad('#4fae3f', 4, i === 0);
      mini.position.set(3.8 + Math.cos(i * 2.1) * 0.7, 0.97, 4 + Math.sin(i * 2.1) * 0.7);
      s.add(mini);
    }
    this.tag(ptable, 'play');
    this.tag(invite, 'play');
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, 1.8), new THREE.MeshStandardMaterial({ map: planks('#6a4428', [1, 2], 'door') }));
    door.position.set(8.4, 1.8, 4.6);
    s.add(door);
    this.tag(door, 'play');

    // Your frog, in the armchair.
    this.frog = new FrogActor(DEFAULT_OUTFIT, this.hooks());
    this.frog.place(v3(0.32, 1.13, -2.45), 0.25);
    s.add(this.frog.root);

    this.stations = {
      home: { shot: { pos: v3(0, 7.4, 13.8), target: v3(0, 1.5, -0.8), fov: 48 }, frog: v3(0.32, 1.13, -2.45), frogRot: 0.25, sign: v3(0, 0, 0), label: '' },
      play: { shot: { pos: v3(1.2, 3.4, 9), target: v3(3.6, 1.1, 3.6), fov: 40 }, frog: v3(3.0, 1.0, 3.6), frogRot: 0.9, sign: v3(3.8, 2.2, 4.0), label: '▶ PLAY' },
      customize: { shot: { pos: v3(-3.6, 2.1, -0.6), target: v3(-6.0, 1.05, 3.4), fov: 40 }, frog: v3(-6.5, 0.05, 3.1), frogRot: 2.45, sign: v3(-8.1, 3.8, 3.0), label: '👕 CUSTOMIZE' },
      shop: { shot: { pos: v3(2.0, 3.2, 6.8), target: v3(6.2, 1.5, 2.6), fov: 40 }, frog: v3(4.2, 0.05, 3.2), frogRot: Math.PI / 2, sign: v3(6.6, 4.8, 2.6), label: '🛒 SHOP' },
      collection: { shot: { pos: v3(1.4, 3.1, 1.6), target: v3(7.0, 2.0, -3.3), fov: 44 }, frog: v3(6.0, 0.05, -1.9), frogRot: -0.7, sign: v3(7.9, 4.6, -3.8), label: '💿 COLLECTION' },
      profile: { shot: { pos: v3(-5.6, 4.4, 7.4), target: v3(-5.4, 1.0, 4.2), fov: 40 }, frog: v3(-3.0, 0.05, 4.6), frogRot: -Math.PI / 2, sign: v3(-4.6, 2.0, 4.2), label: '📒 PROFILE' },
      tutorial: { shot: { pos: v3(-3.0, 3.2, -1.0), target: v3(-8.4, 3.0, -3.6), fov: 40 }, frog: v3(-6.8, 0.05, -2.6), frogRot: -Math.PI / 2 - 0.3, sign: v3(-8.3, 4.8, -3.6), label: '🎓 TUTORIAL' },
    };
    this.rig.cut(this.stations.home.shot);
  }

  fit(shot: Shot): Shot {
    if (this.aspect >= 1.2) return shot;
    // On portrait phones the home view is a close-up of your frog by the fire (the dock does navigation).
    if (shot === this.stations.home.shot) return { pos: v3(0.6, 3.3, 4.6), target: v3(0.2, 1.7, -2.6), fov: 52 };
    const k = 1 + (1.2 - Math.max(0.45, this.aspect)) * 0.85;
    const pos = shot.target.clone().add(shot.pos.clone().sub(shot.target).multiplyScalar(k));
    return { pos, target: shot.target.clone(), fov: shot.fov };
  }

  /** Re-frame the current station (after a resize). */
  reframe(): void {
    this.rig.cut(this.fit(this.stations[this.station].shot));
  }

  private hooks() {
    return {
      fx: (kind: FxKind, pos: THREE.Vector3, count?: number) => this.particles.frogFx(kind, pos, count),
      sfx: (name: string) => this.sfx(name),
    };
  }

  private tag(o: THREE.Object3D, action: string): void {
    o.userData.action = action;
    o.traverse((c) => (c.userData.action = action));
    this.clickables.push(o);
  }

  setOutfit(o: Outfit): void {
    this.frog.setOutfit(o);
  }

  goTo(station: Station, dur = 1.4): void {
    if (station === this.station) return;
    const prev = this.station;
    this.station = station;
    const def = this.stations[station];
    this.rig.go(this.fit(def.shot), dur);
    const from = this.frog.root.position.clone();
    const to = def.frog.clone();
    // Hop off the chair, then hop to the station (two arcs feels livelier than one).
    if (prev === 'home') {
      this.frog.moveTo(v3(from.x + 0.4, 0.05, from.z + 1.6), 0.45, 0.7, () => {
        this.sfx('boing');
        this.frog.moveTo(to, Math.max(0.6, dur - 0.5), 0.9, () => (this.frog.baseRotY = def.frogRot));
      });
    } else if (station === 'home') {
      this.frog.moveTo(v3(0.7, 0.05, -1.0), Math.max(0.6, dur - 0.5), 0.9, () => {
        this.frog.moveTo(to, 0.5, 0.7, () => (this.frog.baseRotY = def.frogRot));
      });
    } else {
      this.frog.moveTo(to, dur, 1.1, () => (this.frog.baseRotY = def.frogRot));
    }
    this.frog.baseRotY = Math.atan2(to.x - from.x, to.z - from.z);
    this.sfx('whoosh');
  }

  /** Spin the frog in front of the mirror. */
  turn(delta: number): void {
    this.frog.baseRotY += delta;
  }

  /** Merchant holds up the item being browsed. */
  present(item: { slot: string; id: string } | null, outfit: Outfit): void {
    if (this.displayItem) this.displayItem.removeFromParent();
    this.displayItem = null;
    if (!item) return;
    let obj: THREE.Object3D | null = null;
    if (item.slot === 'hat') { const h = buildHat(item.id); if (h) obj = voxMesh(h.main, VOX); }
    else if (item.slot === 'neck') { const v = buildNeck(item.id); if (v) obj = voxMesh(v, VOX); }
    else if (item.slot === 'face') { const v = buildFace(item.id); if (v) obj = voxMesh(v, VOX); }
    else if (item.slot === 'clothes') { const c = buildClothes(item.id, outfit.skin); if (c.vox) obj = voxMesh(c.vox, VOX); }
    if (!obj) {
      const mini = new FrogActor({ ...outfit, [item.slot]: item.id } as Outfit);
      mini.enableIdles = false;
      obj = mini.root;
      (obj as THREE.Object3D).userData.actor = mini;
    }
    obj.scale.multiplyScalar(item.slot === 'hat' || item.slot === 'face' || item.slot === 'neck' ? 2.2 : 0.9);
    const g = new THREE.Group();
    g.add(obj);
    if (item.slot === 'hat') obj.position.y = -0.2;
    else if (item.slot === 'face' || item.slot === 'neck') obj.position.y = -0.7;
    else if (item.slot === 'clothes') obj.position.y = -0.4;
    else obj.position.y = -0.45;
    this.display.add(g);
    this.displayItem = g;
    this.merchant.play('wave', true);
    this.particles.frogFx('stars', this.display.position.clone(), 6);
    this.sfx('magic');
  }

  /** Fill the shelf with vinyl sleeves and trophies from the player's collection. */
  setCollection(records: { cover: THREE.Texture }[], trophies: string[]): void {
    this.shelfRecords.clear();
    this.shelfTrophies.clear();
    records.slice(0, 24).forEach((r, i) => {
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.42), [mat('#1b1420'), new THREE.MeshStandardMaterial({ map: r.cover }), mat('#1b1420'), mat('#1b1420'), mat('#1b1420'), mat('#1b1420')]);
      const shelfY = [0.18, 1.68][Math.floor(i / 12)] ?? 0.18;
      sleeve.position.set(-0.05, shelfY + 0.22, -1.6 + (i % 12) * 0.27);
      sleeve.rotation.x = (i % 3 === 0 ? 0.12 : 0) - 0.05;
      this.shelfRecords.add(sleeve);
    });
    trophies.slice(0, 8).forEach((kind, i) => {
      const t = P.trophy(kind === 'win' ? '#ffc531' : kind === 'podium' ? '#c8ccd8' : '#7d7a3a');
      t.scale.setScalar(1.6);
      t.position.set(-0.1, [3.18, 4.68][Math.floor(i / 4)] ?? 3.18, -1.4 + (i % 4) * 0.9);
      t.rotation.y = -Math.PI / 2;
      this.shelfTrophies.add(t);
    });
  }

  pick(ndc: THREE.Vector2): string | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.rig.camera);
    const hits = ray.intersectObjects(this.clickables, true);
    const hit = hits.find((h) => h.object.userData.action);
    const obj = hit?.object ?? null;
    if (obj !== this.hover) {
      this.hover = obj;
    }
    return (hit?.object.userData.action as string) ?? null;
  }

  poke(action: string): void {
    const p = this.frog;
    switch (action) {
      case 'fire': this.sfx('fire'); this.particles.emit('spark', v3(0, 1.2, -5.4), 30, { color: ['#ffd23a', '#ff8a2a'], speed: 1.8, gravity: -1, life: 1, size: 0.08 }); break;
      case 'plant': this.sfx('squeak'); this.particles.emit('leaf', v3(-7.6 + Math.random() * 15, 1.5, -5), 6, { color: ['#4fae3f', '#6fcf4f'], speed: 0.8, gravity: -0.6, life: 2, size: 0.1, wobble: 1 }); break;
      case 'cuckoo': this.sfx('cuckoo'); p.play('shock'); break;
      case 'guitar': this.sfx('strum'); p.play('airguitar'); break;
      case 'jar': this.sfx('buzz'); p.play('catchFly', true); break;
      case 'window': this.sfx('ribbitDeep'); this.particles.emit('firefly', v3(-4.8, 3, -6.2), 8, { color: '#ffe86a', speed: 0.4, gravity: 0.1, life: 3, size: 0.12, wobble: 0.6 }); break;
      case 'poster': this.sfx('swap'); p.play('think'); break;
      default: break;
    }
  }

  toggleRecord(on: boolean): void {
    this.discSpin = on ? 1 : 0;
  }

  update(dt: number): void {
    this.time += dt;
    const t = this.time;
    this.frog.update(dt);
    this.merchant.update(dt);
    this.fireLight.intensity = 8 + Math.sin(t * 9) * 1.4 + Math.sin(t * 23) * 0.7;
    this.fire.scale.y = 1 + Math.sin(t * 12) * 0.08;
    this.fire.scale.x = 1 + Math.sin(t * 9 + 1) * 0.05;
    if (Math.random() < dt * 6) this.particles.emit('spark', v3((Math.random() - 0.5) * 1.2, 0.8, -5.5), 1, { color: ['#ffd23a', '#ff8a2a'], speed: 0.4, up: 1.2, gravity: 0.3, life: 1.2, size: 0.06 });
    if (Math.random() < dt * 0.5) this.particles.emit('smoke', v3(0, 2.6, -5.8), 1, { color: '#8a8a8a', speed: 0.1, up: 0.5, gravity: 0.2, life: 2, size: 0.2 });
    this.disc.rotation.y += dt * 3.2 * this.discSpin;
    if (this.discSpin && Math.random() < dt * 0.8) this.particles.frogFx('note', v3(-1.7, 1.4, -2.4), 1);
    this.display.rotation.y += dt * 1.2;
    this.display.position.y = 1.55 + Math.sin(t * 2) * 0.05;
    if (this.displayItem) this.displayItem.traverse((o) => { const a = o.userData.actor as FrogActor | undefined; if (a) a.update(dt); });
    this.mirror.visible = this.station === 'customize' || this.station === 'home';
    this.particles.update(dt);
    this.rig.update(dt);
    void FX_LAYER;
  }
}

function mat(c: string) {
  return new THREE.MeshStandardMaterial({ color: c });
}

function posterTex(title: string): THREE.Texture {
  const p = new Painter(32, 44);
  const palettes: Record<string, [string, string, string]> = {
    'LARPED ONE OUT': ['#2f5f3a', '#9be36b', '#ffe245'],
    'DJ LILYPADD': ['#3b2a6f', '#ff7ad1', '#4dffea'],
    'FROG ROCK FEST': ['#5a1a1a', '#ff5d5d', '#ffe245'],
  };
  const [bg, fg, ac] = palettes[title] ?? ['#333', '#fff', '#ff0'];
  p.clear(shade(bg, -0.1));
  p.rect(1, 1, 30, 42, bg);
  p.noise(1, 1, 30, 42, shade(bg, 0.06), 0.1, 3);
  if (title === 'DJ LILYPADD') {
    p.circle(16, 18, 9, '#2fb5a4');
    p.ring(16, 16, 11, 2, '#2b2b38');
    p.rect(3, 14, 4, 8, fg); p.rect(25, 14, 4, 8, fg);
    p.circle(12, 13, 2.5, '#fff'); p.circle(20, 13, 2.5, '#fff'); p.px(12, 13, '#000'); p.px(20, 13, '#000');
    p.rect(11, 21, 10, 1, '#1b1420');
    p.text('DJ', 12, 30, ac); p.text('LIVE', 8, 37, fg);
  } else if (title === 'FROG ROCK FEST') {
    drawIcon(p, 'guitar', fg, 0, 0);
    p.text('ROCK', 8, 34, ac); p.text('FEST', 8, 39, fg);
  } else {
    drawIcon(p, 'lilypad', fg, 0, 0);
    p.text('LARPED', 4, 31, ac); p.text('ONE OUT', 2, 37, fg);
  }
  return p.texture();
}

function inviteTex(): THREE.Texture {
  const p = new Painter(32, 22);
  p.clear('#f4ead0');
  p.rect(0, 0, 32, 1, '#c8a06a'); p.rect(0, 21, 32, 1, '#c8a06a');
  p.text('PARTY', 6, 4, '#3fae4f');
  p.text('TONITE', 4, 11, '#e8383d');
  p.circle(27, 17, 2.5, '#ff9ec9');
  return p.texture();
}
