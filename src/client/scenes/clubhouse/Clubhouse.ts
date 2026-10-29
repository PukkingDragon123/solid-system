// The game world: a round table in a magical clubhouse, frogs on stools, a chalkboard leaderboard,
// the DJ booth, the interactive board, plus every cinematic gadget (bottle, TV, throne, hammers).

import * as THREE from 'three';
import type { MapId, RandomEventId } from '../../../shared/catalog';
import { COSMETIC_BY_ID, DEFAULT_OUTFIT, type Outfit } from '../../../shared/cosmetics';
import type { PlayerPublic } from '../../../shared/protocol';
import { planks } from '../../art/textures';
import { FrogActor, type FxKind } from '../../render/frog/FrogActor';
import { Particles } from '../../render/particles';
import { FX_LAYER } from '../../render/PixelRenderer';
import { CameraRig, Chalkboard, WaterTexture, type Shot } from '../common';
import * as P from '../props';
import { Board, BOARD_SIZE } from './Board';
import { buildMap, type MapEnv } from './maps';

export const TABLE_R = 3.6;
export const TABLE_Y = 0.85;
const SEAT_R = 4.35;
const CHALK_POS = new THREE.Vector3(0, 2.75, -6.7);
const DJ_POS = new THREE.Vector3(6.4, 0, -5.2);

export interface SceneHooks {
  sfx(name: string, pos?: THREE.Vector3): void;
}

interface Seat {
  actor: FrogActor;
  player: PlayerPublic;
  outfitKey: string;
  slot: number;
  stool: THREE.Object3D;
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export class Clubhouse {
  readonly scene = new THREE.Scene();
  readonly rig = new CameraRig(40);
  readonly particles = new Particles();
  readonly board = new Board(TABLE_Y + 0.1);
  readonly chalk = new Chalkboard(512, 272);
  readonly seats = new Map<string, Seat>();
  readonly dj: FrogActor;
  env: MapEnv;
  mapId: MapId = 'swamp_clubhouse';
  beat = 0;
  private hemi = new THREE.HemisphereLight('#ffffff', '#333333', 1);
  private key = new THREE.DirectionalLight('#ffffff', 1.5);
  private spot = new THREE.SpotLight('#fff1c8', 0, 14, 0.35, 0.5, 1);
  private table = new THREE.Group();
  private stools: THREE.Object3D[] = [];
  private pond: THREE.Mesh;
  private pondWater = new WaterTexture('#2f6fa0', '#7fc4ff', 48);
  private pondOpen = 0;
  private pondTarget = 0;
  readonly bottle: THREE.Object3D;
  private bottleSpin: { from: number; to: number; t: number; dur: number } | null = null;
  readonly tv: THREE.Group;
  private tvScreen: THREE.Mesh;
  private tvCanvas = document.createElement('canvas');
  private tvTex: THREE.CanvasTexture;
  private tvState = 0;
  private tvTarget = 0;
  private giant: FrogActor;
  readonly throne: THREE.Group;
  private djGear = new THREE.Group();
  private records: THREE.Object3D[] = [];
  private cones: THREE.Object3D[] = [];
  private leds: THREE.Mesh[] = [];
  private djZap = 0;
  private time = 0;
  private darkness = 0;
  private darkTarget = 0;
  private flies: { mesh: THREE.Object3D; t: number; dur: number; path: (t: number) => THREE.Vector3; target?: string; onEnd?: () => void }[] = [];
  myId = '';
  hooks: SceneHooks;

  constructor(hooks: SceneHooks) {
    this.hooks = hooks;
    const s = this.scene;
    s.add(this.hemi);
    this.key.position.set(5, 11, 7);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    const sc = this.key.shadow.camera;
    sc.left = -11; sc.right = 11; sc.top = 11; sc.bottom = -11; sc.near = 1; sc.far = 40;
    this.key.shadow.bias = -0.0006;
    this.key.shadow.normalBias = 0.02;
    s.add(this.key);
    s.add(this.spot, this.spot.target);
    s.add(this.particles.points);

    // Table.
    const top = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_R, TABLE_R, 0.22, 48), [
      new THREE.MeshStandardMaterial({ color: '#6a4428', roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ map: planks('#a8743f', [3, 3], 'tabletop'), roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: '#6a4428' }),
    ]);
    top.position.y = TABLE_Y - 0.11;
    top.castShadow = top.receiveShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(TABLE_R, 0.09, 6, 48), new THREE.MeshStandardMaterial({ color: '#5a3a1f', roughness: 0.8 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = TABLE_Y;
    rim.castShadow = true;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, TABLE_Y - 0.2, 12), new THREE.MeshStandardMaterial({ color: '#5a3a1f' }));
    leg.position.y = (TABLE_Y - 0.2) / 2;
    leg.castShadow = true;
    this.table.add(top, rim, leg);
    this.pond = new THREE.Mesh(new THREE.CircleGeometry(BOARD_SIZE * 0.58, 40), new THREE.MeshStandardMaterial({ map: this.pondWater.texture, roughness: 0.25, metalness: 0.15 }));
    this.pondWater.texture.repeat.set(2.5, 2.5);
    this.pond.rotation.x = -Math.PI / 2;
    this.pond.position.y = TABLE_Y + 0.012;
    this.pond.scale.setScalar(0.001);
    this.pond.receiveShadow = true;
    this.table.add(this.pond);
    this.table.add(this.board.group);
    this.board.setPond(this.pond);
    s.add(this.table);

    // Chalkboard.
    const board = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 3.5), new THREE.MeshStandardMaterial({ map: this.chalk.texture, roughness: 1 }));
    board.position.copy(CHALK_POS);
    board.receiveShadow = true;
    const frame = P.chalkFrame(6.6, 3.5);
    frame.position.copy(CHALK_POS).add(v3(0, -1.75, -0.02));
    s.add(board, frame);
    this.chalk.onScratch = () => { if (Math.random() < 0.15) this.hooks.sfx('chalk', CHALK_POS); };

    // DJ booth.
    const booth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1, 1.1), new THREE.MeshStandardMaterial({ color: '#2b2b38', roughness: 0.6 }));
    booth.position.y = 0.5;
    booth.castShadow = booth.receiveShadow = true;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.8), new THREE.MeshBasicMaterial({ color: '#141418' }));
    front.position.set(0, 0.5, 0.56);
    this.djGear.add(booth, front);
    for (const x of [-0.7, 0.7]) {
      const tt = P.turntable();
      tt.position.set(x, 1.0, 0);
      tt.scale.setScalar(1.6);
      const rec = P.record();
      rec.position.set(x - 0.1, 1.2, 0);
      rec.scale.setScalar(1.7);
      this.records.push(rec);
      this.djGear.add(tt, rec);
    }
    for (let i = 0; i < 8; i++) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.04), new THREE.MeshBasicMaterial({ color: ['#ff5d5d', '#ffe245', '#6fe05a', '#4aa3ff'][i % 4], toneMapped: false }));
      led.position.set(-0.95 + i * 0.27, 0.75, 0.57);
      led.layers.enable(FX_LAYER);
      this.leds.push(led);
      this.djGear.add(led);
    }
    for (const x of [-2.1, 2.1]) {
      const sp = P.speaker();
      sp.group.position.set(x, 0, -0.2);
      sp.group.scale.setScalar(1.8);
      this.cones.push(...sp.group.children.slice(1));
      this.djGear.add(sp.group);
    }
    this.djGear.position.copy(DJ_POS);
    this.djGear.lookAt(v3(0, 0, 0));
    s.add(this.djGear);
    this.dj = new FrogActor({ ...DEFAULT_OUTFIT, hat: 'hat_headphones', skin: 'skin_teal', eyes: 'eyes_classic', mouth: 'mouth_grin', idle: 'idle_groovy' }, this.actorHooks());
    this.dj.enableIdles = false;
    const djSpot = this.djGear.localToWorld(v3(0, 0, -0.9));
    this.dj.place(djSpot, this.djGear.rotation.y);
    this.dj.root.scale.setScalar(1.25);
    s.add(this.dj.root);

    // Bottle for the map spin (lies on the table).
    this.bottle = new THREE.Group();
    const b = P.bottle();
    b.scale.setScalar(2.4);
    this.bottle.add(b);
    this.bottle.position.set(0, TABLE_Y + 0.2, 0);
    this.bottle.visible = false;
    s.add(this.bottle);

    // TV + giant frog for movie/TV rounds.
    this.tv = P.tv();
    this.tv.scale.setScalar(4);
    this.tvCanvas.width = 160;
    this.tvCanvas.height = 120;
    this.tvTex = new THREE.CanvasTexture(this.tvCanvas);
    this.tvTex.magFilter = THREE.NearestFilter;
    this.tvTex.colorSpace = THREE.SRGBColorSpace;
    this.tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(16 / 16, 14 / 16), new THREE.MeshBasicMaterial({ map: this.tvTex, toneMapped: false }));
    this.tvScreen.position.set(-2 / 16, 9 / 16, 6.05 / 16);
    this.tv.add(this.tvScreen);
    this.tv.visible = false;
    s.add(this.tv);
    this.giant = new FrogActor({ ...DEFAULT_OUTFIT, skin: 'skin_brown', clothes: 'clothes_overalls', hat: 'hat_bucket' }, this.actorHooks());
    this.giant.root.scale.setScalar(3.2);
    this.giant.enableIdles = false;
    this.giant.root.visible = false;
    s.add(this.giant.root);

    // Finale throne.
    this.throne = P.throne();
    this.throne.scale.setScalar(2);
    this.throne.position.set(0, 0, -3.8);
    this.throne.visible = false;
    s.add(this.throne);

    // Stool pool.
    for (let i = 0; i < 12; i++) {
      const st = P.stool();
      st.scale.setScalar(1.15);
      st.visible = false;
      this.stools.push(st);
      s.add(st);
    }

    this.env = buildMap('swamp_clubhouse');
    this.applyEnv(this.env);
    this.rig.cut(this.shot('overview'));
  }

  actorHooks() {
    return {
      fx: (kind: FxKind, pos: THREE.Vector3, count?: number) => this.particles.frogFx(kind, pos, count),
      sfx: (name: string, pos?: THREE.Vector3) => this.hooks.sfx(name, pos),
    };
  }

  // ───────────────────────── maps ─────────────────────────

  setMap(id: MapId): void {
    if (id === this.mapId && this.env) return;
    this.scene.remove(this.env.group);
    this.mapId = id;
    this.env = buildMap(id);
    this.applyEnv(this.env);
  }

  private applyEnv(env: MapEnv): void {
    this.scene.add(env.group);
    this.scene.background = env.background;
    this.scene.fog = env.fog;
    this.hemi.color.set(env.hemi[0]);
    this.hemi.groundColor.set(env.hemi[1]);
    this.hemi.intensity = env.hemi[2];
    this.key.color.set(env.key[0]);
    this.key.intensity = env.key[1];
    this.dj.setOutfit({ ...this.dj.model.outfit, hat: env.djHat, clothes: env.djClothes, face: env.djFace });
  }

  // ───────────────────────── players ─────────────────────────

  seatPose(slot: number, n: number): { pos: THREE.Vector3; rotY: number } {
    const span = Math.min(250, 60 + n * 22) * (Math.PI / 180);
    const a = n === 1 ? 0 : -span / 2 + (span * slot) / (n - 1);
    const pos = v3(Math.sin(a) * SEAT_R, 0, -Math.cos(a) * SEAT_R);
    return { pos, rotY: Math.atan2(-pos.x, -pos.z) };
  }

  syncPlayers(players: PlayerPublic[]): void {
    const ids = new Set(players.map((p) => p.id));
    for (const [id, seat] of this.seats) {
      if (!ids.has(id)) {
        this.particles.frogFx('poof', seat.actor.headPos(), 14);
        seat.actor.root.removeFromParent();
        this.seats.delete(id);
      }
    }
    const sorted = players.slice().sort((a, b) => a.seat - b.seat);
    sorted.forEach((p, slot) => {
      let seat = this.seats.get(p.id);
      const key = JSON.stringify(p.outfit);
      if (!seat) {
        const actor = new FrogActor(p.outfit, this.actorHooks());
        this.scene.add(actor.root);
        seat = { actor, player: p, outfitKey: key, slot: -1, stool: this.stools[slot] };
        this.seats.set(p.id, seat);
        const pose = this.seatPose(slot, sorted.length);
        actor.place(pose.pos.clone().add(v3(0, 0.62, 0)), pose.rotY);
        this.particles.frogFx('poof', pose.pos.clone().add(v3(0, 1, 0)), 12);
        this.hooks.sfx('pop', pose.pos);
      }
      if (seat.outfitKey !== key) {
        seat.actor.setOutfit(p.outfit);
        seat.outfitKey = key;
        this.particles.frogFx('poof', seat.actor.headPos(), 10);
      }
      seat.player = p;
      if (seat.slot !== slot) {
        const pose = this.seatPose(slot, sorted.length);
        const target = pose.pos.clone().add(v3(0, 0.62, 0));
        if (seat.slot >= 0) seat.actor.moveTo(target, 0.7, 0.8);
        else seat.actor.place(target, pose.rotY);
        seat.actor.baseRotY = pose.rotY;
        seat.slot = slot;
      }
      seat.actor.nervous = p.nervous;
      seat.actor.asleep = !p.connected;
    });
    // Stools follow seat slots.
    this.stools.forEach((st, i) => {
      st.visible = i < sorted.length;
      if (st.visible) {
        const pose = this.seatPose(i, sorted.length);
        st.position.copy(pose.pos);
        st.rotation.y = pose.rotY;
      }
    });
  }

  actorOf(id: string): FrogActor | undefined {
    return this.seats.get(id)?.actor;
  }

  headWorld(id: string): THREE.Vector3 | null {
    const a = this.seats.get(id)?.actor;
    return a ? a.headPos() : null;
  }

  djHead(): THREE.Vector3 {
    return this.dj.headPos();
  }

  // ───────────────────────── camera shots ─────────────────────────

  shot(name: string, opts: { aspect?: number; id?: string } = {}): Shot {
    const aspect = opts.aspect ?? 16 / 9;
    const narrow = aspect < 1;
    switch (name) {
      case 'board': {
        // Fit the whole board on screen whatever the aspect ratio.
        const d = narrow ? 9.2 / Math.max(0.5, aspect) * 0.62 : 7.4 + Math.max(0, 1.5 - aspect) * 2;
        return { pos: v3(0, TABLE_Y + d * 0.92, d * 0.62 + 0.4), target: v3(0, TABLE_Y, 0.15), fov: 40 };
      }
      case 'chalk':
        return { pos: v3(0, 2.9, -6.7 + (narrow ? 9.5 : 5.6)), target: CHALK_POS.clone().add(v3(0, -0.05, 0)), fov: 40 };
      case 'dj': {
        const front = this.djGear.localToWorld(v3(0, 1.6, 4.2));
        return { pos: front, target: DJ_POS.clone().add(v3(0, 1.3, 0)), fov: 38 };
      }
      case 'tv':
        return { pos: v3(-2.4, 3.2, narrow ? 4.8 : 2.2), target: v3(-4, 2.2, -5.6), fov: 42 };
      case 'player': {
        const a = opts.id ? this.seats.get(opts.id)?.actor : undefined;
        if (!a) return this.shot('overview', opts);
        const head = a.root.position.clone();
        const dir = v3(-head.x, 0, -head.z).normalize();
        return { pos: head.clone().add(dir.multiplyScalar(2.6)).add(v3(0, 1.3, 0)), target: head.clone().add(v3(0, 0.6, 0)), fov: 38 };
      }
      case 'bottle':
        return { pos: v3(0, 9.5, narrow ? 6 : 3.4), target: v3(0, TABLE_Y, 0), fov: 42 };
      case 'throne':
        return { pos: v3(0, 3.4, 4.2), target: v3(0, 2.2, -3.8), fov: 42 };
      case 'wide':
        return { pos: v3(0, 9, narrow ? 17 : 13), target: v3(0, 1.4, -1.5), fov: 40 };
      case 'overview':
      default:
        return { pos: v3(0, narrow ? 9.5 : 7, narrow ? 15 : 10.5), target: v3(0, 1.3, -1.6), fov: 40 };
    }
  }

  // ───────────────────────── gadgets ─────────────────────────

  setPond(open: boolean): void {
    this.pondTarget = open ? 1 : 0;
  }

  showBottle(on: boolean): void {
    this.bottle.visible = on;
    if (on) this.bottle.rotation.set(0, 0, 0);
  }

  spinBottleTo(angle: number, spins: number, dur = 4.5): void {
    this.bottle.visible = true;
    const from = this.bottle.rotation.y;
    // The bottle's neck is local +Z; yaw θ points it at (sin θ, cos θ). A ring slot at angle a sits at (cos a, sin a).
    const target = Math.PI / 2 - angle;
    let to = target - Math.PI * 2 * spins;
    while (to > from - Math.PI * 2 * spins) to -= Math.PI * 2;
    this.bottleSpin = { from, to, t: 0, dur };
    this.hooks.sfx('spin');
  }

  setTv(on: boolean, label = ''): void {
    if (on && this.tvTarget === 0) {
      this.tv.visible = true;
      this.giant.root.visible = true;
      this.giant.place(v3(-14, 0, -4), Math.PI / 2);
      this.giant.moveTo(v3(-6.6, 0, -5.4), 1.4, 0.6, () => {
        this.giant.play('wave', true);
        this.hooks.sfx('thud', v3(-4, 0, -5.4));
        window.setTimeout(() => this.giant.moveTo(v3(-15, 0, -3), 1.6, 0.6, () => (this.giant.root.visible = false)), 900);
      });
      this.hooks.sfx('ribbitDeep');
    }
    this.tvTarget = on ? 1 : 0;
    this.drawTv(label);
  }

  private drawTv(label: string): void {
    const c = this.tvCanvas.getContext('2d')!;
    c.fillStyle = '#10141c';
    c.fillRect(0, 0, 160, 120);
    for (let i = 0; i < 500; i++) {
      c.fillStyle = Math.random() < 0.5 ? '#2a3040' : '#3a4050';
      c.fillRect(Math.random() * 160, Math.random() * 120, 2, 1);
    }
    c.fillStyle = '#ffe245';
    c.font = '16px "Pixelify Sans", monospace';
    c.textAlign = 'center';
    c.fillText(label.slice(0, 18), 80, 64);
    this.tvTex.needsUpdate = true;
  }

  setDark(level: number): void {
    this.darkTarget = level;
  }

  spotlightOn(world: THREE.Vector3 | null): void {
    if (!world) { this.spot.intensity = 0; return; }
    this.spot.position.copy(world).add(v3(0, 8, 1.5));
    this.spot.target.position.copy(world);
    this.spot.intensity = 90;
    this.spot.castShadow = true;
  }

  zapDj(): void {
    this.djZap = 1.6;
    this.dj.play('shock', true);
    this.hooks.sfx('zap', DJ_POS);
  }

  // ───────────────────────── random events ─────────────────────────

  randomEvent(e: RandomEventId, playerId?: string, seed = 1): void {
    const target = playerId ? this.seats.get(playerId) : [...this.seats.values()][seed % Math.max(1, this.seats.size)];
    switch (e) {
      case 'giant_fly': {
        const fly = P.fly();
        fly.scale.setScalar(5);
        this.scene.add(fly);
        const catcher = target?.actor;
        this.hooks.sfx('buzz');
        this.flies.push({
          mesh: fly, t: 0, dur: 6,
          path: (t) => v3(Math.sin(t * 1.3) * 5, 2.6 + Math.sin(t * 3.1) * 0.8, Math.cos(t * 0.9) * 3 - 1),
          onEnd: () => {
            if (catcher) {
              catcher.play('catchFly', true);
              window.setTimeout(() => catcher.play('burp'), 2300);
            }
          },
        });
        for (const s of this.seats.values()) s.actor.lookAt(fly.position);
        break;
      }
      case 'mic_swallow': {
        const mic = P.microphone();
        mic.position.copy(this.dj.headPos()).add(v3(0.4, -0.5, 0.3));
        mic.scale.setScalar(1.4);
        this.scene.add(mic);
        this.dj.play('shock', true);
        window.setTimeout(() => {
          mic.removeFromParent();
          this.hooks.sfx('gulp', DJ_POS);
          this.dj.play('burp');
          window.setTimeout(() => this.hooks.sfx('micFeedback', DJ_POS), 900);
        }, 900);
        break;
      }
      case 'mushroom_pop': {
        const m = P.mushroom(['#ff5d5d', '#c77dff', '#ffd23a'][seed % 3], true, 1);
        m.position.set(((seed % 7) - 3) * 0.5, TABLE_Y, ((seed % 5) - 2) * 0.4);
        m.scale.setScalar(0.1);
        this.scene.add(m);
        let t = 0;
        const grow = () => {
          t += 0.05;
          m.scale.setScalar(Math.min(1.8, 0.1 + t * 1.6));
          if (t < 1.1) window.setTimeout(grow, 50);
          else {
            m.removeFromParent();
            this.particles.frogFx('confetti', m.position.clone().add(v3(0, 0.6, 0)), 60);
            this.hooks.sfx('pop', m.position);
            for (const s of this.seats.values()) if (Math.random() < 0.5) s.actor.play('shock');
          }
        };
        grow();
        break;
      }
      case 'chair_fall':
        target?.actor.play('fallChair', true);
        break;
      case 'dj_zap':
        this.zapDj();
        break;
      case 'mosquito': {
        if (!target) break;
        const mq = P.mosquito();
        mq.scale.setScalar(1.5);
        this.scene.add(mq);
        const head = target.actor.headPos();
        this.hooks.sfx('mosquito', head);
        this.flies.push({
          mesh: mq, t: 0, dur: 4.5,
          path: (t) => head.clone().add(v3(Math.cos(t * 7) * 0.5, Math.sin(t * 11) * 0.2 - 0.2, Math.sin(t * 7) * 0.5)),
          onEnd: () => target.actor.play('angry'),
        });
        target.actor.play('scratch', true);
        window.setTimeout(() => target.actor.play('angry'), 1900);
        break;
      }
    }
  }

  // ───────────────────────── frame ─────────────────────────

  update(dt: number): void {
    this.time += dt;
    const t = this.time;
    this.env.update(dt, t, this.particles, this.beat);
    for (const s of this.seats.values()) s.actor.update(dt);
    this.dj.update(dt);
    if (this.giant.root.visible) this.giant.update(dt);
    // DJ grooves to the beat.
    if (!this.dj.busy) {
      const m = this.dj.model;
      m.rig.position.y = this.beat * 0.05;
      m.rig.rotation.x = 0.1 + this.beat * 0.08;
      m.armR.rotation.set(-1.2, 0, 0.4 + Math.sin(t * 9) * 0.15);
      m.armL.rotation.set(-0.6 - this.beat * 0.4, 0, -0.5);
    }
    for (const r of this.records) r.rotation.y += dt * 3.5;
    this.cones.forEach((c) => c.scale.setScalar(1 + this.beat * 0.18));
    this.leds.forEach((l, i) => ((l.material as THREE.MeshBasicMaterial).color.setScalar(0).add(new THREE.Color(['#ff5d5d', '#ffe245', '#6fe05a', '#4aa3ff'][i % 4]).multiplyScalar((Math.sin(t * 8 + i) > 0.2 || this.beat > 0.6) ? 2 : 0.3))));
    if (this.djZap > 0) {
      this.djZap -= dt;
      if (Math.random() < 0.6) this.particles.frogFx('spark', DJ_POS.clone().add(v3((Math.random() - 0.5) * 2, 1.2 + Math.random(), 0)), 3);
      this.dj.model.bodyGroup.visible = Math.floor(this.djZap * 14) % 2 === 0;
      if (this.djZap <= 0) { this.dj.model.bodyGroup.visible = true; this.particles.frogFx('steam', this.dj.headPos(), 8); }
    }
    // Pond reveal for lily-pad rounds.
    this.pondOpen = THREE.MathUtils.lerp(this.pondOpen, this.pondTarget, Math.min(1, dt * 4));
    this.pond.scale.setScalar(Math.max(0.001, this.pondOpen));
    if (this.pondOpen > 0.05) this.pondWater.update(dt);
    // Bottle.
    if (this.bottleSpin) {
      const b = this.bottleSpin;
      b.t = Math.min(1, b.t + dt / b.dur);
      const e = 1 - (1 - b.t) ** 4;
      this.bottle.rotation.y = b.from + (b.to - b.from) * e;
      if (b.t >= 1) { this.bottleSpin = null; this.hooks.sfx('ding'); }
    }
    // TV slides up.
    this.tvState = THREE.MathUtils.lerp(this.tvState, this.tvTarget, Math.min(1, dt * 2.5));
    this.tv.visible = this.tvState > 0.02;
    this.tv.position.set(-4.4, (this.tvState - 1) * 3, -5.6);
    this.tv.rotation.y = 0.45;
    if (this.tv.visible && Math.random() < 0.3) this.drawTvNoise();
    // Flying critters.
    for (const f of this.flies) {
      f.t += dt;
      f.mesh.position.copy(f.path(f.t));
      f.mesh.rotation.y = f.t * 10;
      if (f.t >= f.dur) { f.mesh.removeFromParent(); f.onEnd?.(); }
    }
    if (this.flies.some((f) => f.t >= f.dur)) {
      this.flies = this.flies.filter((f) => f.t < f.dur);
      if (!this.flies.length) for (const s of this.seats.values()) s.actor.lookAt(null);
    }
    this.darkness = THREE.MathUtils.lerp(this.darkness, this.darkTarget, Math.min(1, dt * 2));
    this.hemi.intensity = this.env.hemi[2] * (1 - this.darkness * 0.92);
    this.key.intensity = this.env.key[1] * (1 - this.darkness * 0.95);
    this.chalk.update(dt);
    this.particles.update(dt);
    this.rig.update(dt);
  }

  private drawTvNoise(): void {
    const c = this.tvCanvas.getContext('2d')!;
    for (let i = 0; i < 40; i++) {
      c.fillStyle = Math.random() < 0.5 ? '#2a3040' : '#1a2030';
      c.fillRect(Math.random() * 160, Math.random() * 40, 2, 1);
    }
    this.tvTex.needsUpdate = true;
  }

  get flash(): number {
    return this.env.flash?.() ?? 0;
  }

  get darkLevel(): number {
    return this.darkness;
  }

  outfitName(o: Outfit): string {
    return COSMETIC_BY_ID[o.hat]?.name ?? '';
  }
}
