// The six playable maps. Each builds its environment around the shared table/chalkboard/DJ layout
// and drives its own ambient animation (fireflies, rain + lightning, disco lights, neon flicker...).

import * as THREE from 'three';
import type { MapId } from '../../../shared/catalog';
import { Painter, shade } from '../../art/painter';
import { grass, logs, planks, rug, sky, stone, tiles, wallpaper } from '../../art/textures';
import type { Particles } from '../../render/particles';
import { FX_LAYER } from '../../render/PixelRenderer';
import { WaterTexture } from '../common';
import * as P from '../props';

export interface MapEnv {
  id: MapId;
  group: THREE.Group;
  background: THREE.Color | THREE.Texture;
  fog: THREE.Fog;
  hemi: [string, string, number];
  key: [string, number];
  djHat: string;
  djClothes: string;
  djFace: string;
  update(dt: number, t: number, particles: Particles, beat: number): void;
  flash?: () => number;
  ambientMusic: string;
}

const box = (w: number, h: number, d: number, mat: THREE.Material) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.receiveShadow = true;
  m.castShadow = true;
  return m;
};

const std = (map: THREE.Texture | null, color = '#ffffff', rough = 0.9) => new THREE.MeshStandardMaterial({ map, color, roughness: rough });

function floorDisc(tex: THREE.Texture, r = 14): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), std(tex));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

function wall(tex: THREE.Texture, w: number, h: number, pos: THREE.Vector3, rotY: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std(tex));
  m.position.copy(pos);
  m.rotation.y = rotY;
  m.receiveShadow = true;
  return m;
}

function pointLight(color: string, intensity: number, dist: number, pos: THREE.Vector3): THREE.PointLight {
  const l = new THREE.PointLight(color, intensity, dist, 1.6);
  l.position.copy(pos);
  return l;
}

/** A glowing "window" plane showing an outdoor backdrop. */
function windowView(drawer: (p: Painter) => void, w: number, h: number): THREE.Mesh {
  const p = new Painter(64, 40);
  drawer(p);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: p.texture(), toneMapped: false }));
  return m;
}

function nightSwamp(p: Painter): void {
  for (let y = 0; y < 40; y++) p.rect(0, y, 64, 1, y < 22 ? (y < 10 ? '#16213e' : '#1f2f52') : '#1d3b3a');
  p.noise(0, 0, 64, 20, '#ffffff', 0.03, 3);
  p.circle(50, 8, 4, '#fff1b0');
  for (let i = 0; i < 6; i++) p.rect(i * 11 + 2, 16 - (i % 2) * 3, 1, 8 + (i % 2) * 3, '#122a22');
  for (let i = 0; i < 5; i++) p.poly([[i * 14, 22], [i * 14 + 7, 8 + (i % 3) * 3], [i * 14 + 14, 22]], '#163a2c');
  p.rect(0, 26, 64, 14, '#1f4a6a');
  p.noise(0, 27, 64, 13, '#5fa8d8', 0.05, 8);
  p.ellipse(18, 31, 5, 1.5, '#3f8f3f');
  p.ellipse(44, 35, 4, 1.2, '#3f8f3f');
  p.noise(0, 10, 64, 20, '#ffe86a', 0.01, 12);
}

function rainyForest(p: Painter): void {
  for (let y = 0; y < 40; y++) p.rect(0, y, 64, 1, y < 24 ? '#3b4b6a' : '#2a3f3a');
  for (let i = 0; i < 9; i++) p.poly([[i * 8 - 4, 30], [i * 8 + 3, 4 + (i % 3) * 4], [i * 8 + 10, 30]], shade('#2f4f3f', (i % 3) * 0.04));
  p.rect(0, 30, 64, 10, '#2f4a3a');
  p.rect(26, 6, 2, 26, '#e8e8f0');
}

function addSky(group: THREE.Group, top: string, bottom: string, stars = 0): void {
  const m = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 16), new THREE.MeshBasicMaterial({ map: sky(top, bottom, stars), side: THREE.BackSide, toneMapped: false, fog: false }));
  group.add(m);
}

function scatter(group: THREE.Group, make: (i: number) => THREE.Object3D, n: number, rMin: number, rMax: number, opts: { avoidFront?: boolean; y?: number; seed?: number } = {}): void {
  let s = (opts.seed ?? 1) * 7919;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    let a = rnd() * Math.PI * 2;
    if (opts.avoidFront && Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) - Math.PI / 2) < 0.6) a += Math.PI * 0.6;
    const r = rMin + rnd() * (rMax - rMin);
    const o = make(i);
    o.position.set(Math.cos(a) * r, opts.y ?? 0, Math.sin(a) * r);
    o.rotation.y = rnd() * Math.PI * 2;
    o.scale.multiplyScalar(0.8 + rnd() * 0.5);
    group.add(o);
  }
}

function fireflies(particles: Particles, t: number, dt: number, count: number, area: number, y = 1.5): void {
  if (Math.random() < dt * count) {
    const a = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * area;
    particles.emit('firefly', new THREE.Vector3(Math.cos(a) * r, y + Math.random() * 2.5, Math.sin(a) * r - 1), 1, { color: ['#ffe86a', '#d8ff6a'], speed: 0.15, up: 0.2, gravity: 0, life: 4, size: 0.14, drag: 0.2, wobble: 0.5 });
  }
  void t;
}

// ───────────────────────── Swamp Clubhouse ─────────────────────────

function swampClubhouse(): MapEnv {
  const g = new THREE.Group();
  g.add(floorDisc(planks('#9a6b3f', [10, 10])));
  const rugM = new THREE.Mesh(new THREE.CircleGeometry(5.6, 32), std(rug('#5a7a3a', '#e8c25a')));
  rugM.rotation.x = -Math.PI / 2;
  rugM.position.y = 0.01;
  rugM.receiveShadow = true;
  g.add(rugM);
  const wl = logs('#8a5a33', [6, 3]);
  g.add(wall(wl, 26, 9, new THREE.Vector3(0, 4.5, -9), 0));
  g.add(wall(wl, 22, 9, new THREE.Vector3(-11.5, 4.5, 1), Math.PI / 2));
  g.add(wall(wl, 22, 9, new THREE.Vector3(11.5, 4.5, 1), -Math.PI / 2));
  // Windows onto the night swamp.
  for (const x of [-7.6, 8.4]) {
    const v = windowView(nightSwamp, 3, 2.2);
    v.position.set(x, 3.6, -8.95);
    g.add(v);
    const f = P.window_(3.2, 2.4);
    f.position.set(x, 2.4, -8.95);
    g.add(f);
  }
  const side = windowView(nightSwamp, 3.4, 2.2);
  side.position.set(-11.45, 3.4, -2);
  side.rotation.y = Math.PI / 2;
  g.add(side);
  // Beams, lanterns, plants, shelves.
  for (const x of [-6, 0, 6]) {
    const beam = box(0.4, 0.4, 20, std(null, '#5a3a1f'));
    beam.position.set(x, 7.2, 0);
    g.add(beam);
  }
  const lamps: THREE.PointLight[] = [];
  for (const [x, z] of [[-4, -3], [4, -3], [0, 3]]) {
    const l = P.lantern('#ffb84d');
    l.position.set(x, 5.2, z);
    l.scale.setScalar(1.6);
    g.add(l);
    const pl = pointLight('#ffb070', 6, 12, new THREE.Vector3(x, 4.8, z));
    lamps.push(pl);
    g.add(pl);
  }
  for (const [x, z, s] of [[-10, -7, 1], [10, -7, 2], [-10.3, 6, 3], [10.2, 5, 4], [-3.4, -8.3, 5]]) {
    const pl = P.plant(s);
    pl.position.set(x, 0, z);
    pl.scale.setScalar(1.8);
    g.add(pl);
  }
  const shelf = P.bookshelf();
  shelf.position.set(-10.9, 0, -4.8);
  shelf.rotation.y = Math.PI / 2;
  g.add(shelf);
  for (const [x, z] of [[9.6, 7], [-9.4, 8.2]]) {
    const c = P.crate();
    c.position.set(x, 0, z);
    c.scale.setScalar(1.6);
    g.add(c);
  }
  return {
    id: 'swamp_clubhouse', group: g, background: new THREE.Color('#1a1410'), fog: new THREE.Fog('#1a1410', 16, 34),
    hemi: ['#ffe2b8', '#3b2a1f', 1.1], key: ['#ffd8a8', 1.6], djHat: 'hat_backcap', djClothes: 'clothes_hoodie', djFace: 'face_none',
    ambientMusic: 'swamp',
    update(dt, t, particles) {
      lamps.forEach((l, i) => (l.intensity = 6 + Math.sin(t * 7 + i * 2) * 0.6 + Math.sin(t * 13 + i) * 0.3));
      fireflies(particles, t, dt, 1.2, 5);
    },
  };
}

// ───────────────────────── Mushroom Tavern ─────────────────────────

function mushroomTavern(): MapEnv {
  const g = new THREE.Group();
  g.add(floorDisc(stone('#5a4a6a', [10, 10])));
  const w = wallpaper('#3a2a4f', '#5a3f7a', [8, 4]);
  g.add(wall(w, 26, 9, new THREE.Vector3(0, 4.5, -9), 0));
  g.add(wall(w, 22, 9, new THREE.Vector3(-11.5, 4.5, 1), Math.PI / 2));
  g.add(wall(w, 22, 9, new THREE.Vector3(11.5, 4.5, 1), -Math.PI / 2));
  const caps = ['#c77dff', '#4dffea', '#ff7ad1', '#ffd23a'];
  const glowLights: THREE.PointLight[] = [];
  const spots: [number, number, number][] = [[-9, -7, 3.2], [9.5, -6.5, 2.6], [-10, 3, 2.2], [10, 4, 3], [-5, -8.2, 1.6], [4.5, -8.4, 1.8], [-9.5, 8, 1.6], [9.4, 8.5, 2]];
  spots.forEach(([x, z, s], i) => {
    const m = P.mushroom(caps[i % caps.length], true, 1);
    m.position.set(x, 0, z);
    m.scale.setScalar(s);
    g.add(m);
    if (i < 4) {
      const pl = pointLight(caps[i % caps.length], 5, 10, new THREE.Vector3(x * 0.85, s * 0.55, z * 0.85));
      glowLights.push(pl);
      g.add(pl);
    }
  });
  for (const [x, z] of [[-8, 6.2], [8.4, -2.4]]) {
    const c = P.crate();
    c.position.set(x, 0, z);
    c.scale.setScalar(1.7);
    g.add(c);
  }
  return {
    id: 'mushroom_tavern', group: g, background: new THREE.Color('#120a1c'), fog: new THREE.Fog('#120a1c', 14, 32),
    hemi: ['#d8b8ff', '#2a1a3a', 0.9], key: ['#e8c8ff', 1.2], djHat: 'hat_mushroom', djClothes: 'clothes_overalls', djFace: 'face_round',
    ambientMusic: 'tavern',
    update(dt, t, particles) {
      glowLights.forEach((l, i) => (l.intensity = 4.5 + Math.sin(t * 1.3 + i * 1.7) * 1.2));
      if (Math.random() < dt * 3) {
        const a = Math.random() * Math.PI * 2;
        particles.emit('square', new THREE.Vector3(Math.cos(a) * (3 + Math.random() * 7), 0.4, Math.sin(a) * (3 + Math.random() * 7)), 1, { color: caps, speed: 0.2, up: 0.4, gravity: 0.08, life: 5, size: 0.07, drag: 0.1, wobble: 0.6 });
      }
    },
  };
}

// ───────────────────────── Rainy Forest Cabin ─────────────────────────

function rainyCabin(): MapEnv {
  const g = new THREE.Group();
  g.add(floorDisc(planks('#7a5a3a', [10, 10], 'planks2')));
  const wl = logs('#6a4a2f', [6, 3]);
  g.add(wall(wl, 26, 9, new THREE.Vector3(0, 4.5, -9), 0));
  g.add(wall(wl, 22, 9, new THREE.Vector3(-11.5, 4.5, 1), Math.PI / 2));
  g.add(wall(wl, 22, 9, new THREE.Vector3(11.5, 4.5, 1), -Math.PI / 2));
  const views: THREE.Mesh[] = [];
  for (const x of [-7.4, 7.4]) {
    const v = windowView(rainyForest, 4.4, 3);
    v.position.set(x, 3.9, -8.95);
    g.add(v);
    views.push(v);
    const f = P.window_(4.6, 3.2);
    f.position.set(x, 2.3, -8.95);
    g.add(f);
  }
  const lamp = P.lantern('#ffc870');
  lamp.position.set(0, 5.4, 0);
  lamp.scale.setScalar(1.8);
  g.add(lamp);
  const warm = pointLight('#ffc070', 7, 13, new THREE.Vector3(0, 5, 0));
  g.add(warm);
  for (const [x, z, s] of [[-10, -7, 7], [10, 6, 8], [-10, 6, 9]]) {
    const pl = P.plant(s);
    pl.position.set(x, 0, z);
    pl.scale.setScalar(1.7);
    g.add(pl);
  }
  const shelf = P.bookshelf();
  shelf.position.set(10.9, 0, -4);
  shelf.rotation.y = -Math.PI / 2;
  g.add(shelf);
  // Rain sheet outside the windows (particles) + lightning flash.
  let flash = 0;
  let nextBolt = 6;
  return {
    id: 'rainy_cabin', group: g, background: new THREE.Color('#141a24'), fog: new THREE.Fog('#141a24', 14, 32),
    hemi: ['#b8c8e8', '#2a2a30', 0.85], key: ['#c8d8ff', 1.1], djHat: 'hat_bucket', djClothes: 'clothes_raincoat', djFace: 'face_none',
    ambientMusic: 'rain',
    flash: () => flash,
    update(dt, t, particles) {
      for (let i = 0; i < 3; i++) {
        const x = (Math.random() - 0.5) * 22;
        particles.emit('rain', new THREE.Vector3(x, 7.5, -9.6 - Math.random()), 1, { color: '#b8c6ff', speed: 0.1, up: -1, gravity: -22, life: 0.5, size: 0.12, drag: 0 });
      }
      if (Math.random() < dt * 2) particles.emit('drop', new THREE.Vector3((Math.random() - 0.5) * 8, 7, (Math.random() - 0.5) * 6), 1, { color: '#9fd0ff', speed: 0, up: 0, gravity: -9, life: 0.8, size: 0.06 });
      nextBolt -= dt;
      if (nextBolt < 0) { flash = 1; nextBolt = 7 + Math.random() * 10; }
      flash = Math.max(0, flash - dt * 3);
      warm.intensity = 7 + Math.sin(t * 9) * 0.4;
      views.forEach((v) => ((v.material as THREE.MeshBasicMaterial).color.setScalar(1 + flash * 2)));
    },
  };
}

// ───────────────────────── Floating Lily Pad Disco ─────────────────────────

function lilypadDisco(): MapEnv {
  const g = new THREE.Group();
  addSky(g, '#0a0420', '#24104a', 0.04);
  const water = new WaterTexture('#1a3b6a', '#3a6aaa', 64);
  water.texture.repeat.set(10, 10);
  const sea = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({ map: water.texture, roughness: 0.3, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.3;
  sea.receiveShadow = true;
  g.add(sea);
  const pad = P.lilyPad('#3fae4f', 26);
  pad.scale.setScalar(6.4);
  pad.position.y = -0.36;
  g.add(pad);
  scatter(g, (i) => { const p = P.lilyPad('#3f9f4f', 8, i % 3 === 0); p.scale.setScalar(2.4); return p; }, 14, 14, 26, { y: -0.28, seed: 3 });
  // Disco ball with sweeping colour spotlights.
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), new THREE.MeshStandardMaterial({ color: '#e8e8f0', metalness: 0.9, roughness: 0.15, flatShading: true }));
  ball.position.set(0, 7.5, -1);
  g.add(ball);
  const string = box(0.05, 3, 0.05, std(null, '#8a8fa8'));
  string.position.set(0, 9.4, -1);
  g.add(string);
  const colors = ['#ff2fa0', '#4dffea', '#ffe245', '#a37bff'];
  const spots = colors.map((c, i) => {
    const s = new THREE.SpotLight(c, 40, 22, 0.32, 0.6, 1.4);
    s.position.set(0, 7.4, -1);
    const tgt = new THREE.Object3D();
    g.add(tgt);
    s.target = tgt;
    g.add(s);
    return { s, tgt, i };
  });
  // Speaker stacks on the pad edges.
  for (const x of [-9, 9]) {
    const sp = P.speaker();
    sp.group.position.set(x, 0, -6);
    sp.group.scale.setScalar(2);
    sp.group.rotation.y = x < 0 ? 0.6 : -0.6;
    g.add(sp.group);
  }
  return {
    id: 'lilypad_disco', group: g, background: new THREE.Color('#0a0420'), fog: new THREE.Fog('#160a30', 20, 60),
    hemi: ['#b8a8ff', '#10204a', 0.7], key: ['#e8d8ff', 0.8], djHat: 'hat_headphones', djClothes: 'clothes_tracksuit', djFace: 'face_star',
    ambientMusic: 'disco',
    update(dt, t, particles, beat) {
      water.update(dt);
      ball.rotation.y += dt * 0.8;
      spots.forEach(({ tgt, i }) => {
        const a = t * (0.6 + i * 0.15) + (i * Math.PI) / 2;
        tgt.position.set(Math.cos(a) * 6, 0, Math.sin(a) * 5 - 1);
      });
      spots.forEach(({ s }) => (s.intensity = 30 + beat * 20));
      if (Math.random() < dt * 4) {
        const a = Math.random() * Math.PI * 2;
        particles.emit('spark', new THREE.Vector3(Math.cos(a) * 6, 0.5 + Math.random() * 5, Math.sin(a) * 6), 1, { color: colors, speed: 0.1, up: 0, gravity: 0, life: 0.6, size: 0.1 });
      }
    },
  };
}

// ───────────────────────── Frog Arcade ─────────────────────────

function frogArcade(): MapEnv {
  const g = new THREE.Group();
  g.add(floorDisc(tiles('#1c1238', '#2b1d5a', [16, 16])));
  const w = wallpaper('#140c28', '#2b1d5a', [10, 4]);
  g.add(wall(w, 26, 9, new THREE.Vector3(0, 4.5, -9), 0));
  g.add(wall(w, 22, 9, new THREE.Vector3(-11.5, 4.5, 1), Math.PI / 2));
  g.add(wall(w, 22, 9, new THREE.Vector3(11.5, 4.5, 1), -Math.PI / 2));
  const neon = ['#ff2fa0', '#4dffea', '#ffd23a', '#a37bff', '#6fe05a'];
  const screens: { mat: THREE.MeshBasicMaterial; p: Painter; seed: number }[] = [];
  const cabinets: [number, number, number][] = [[-10, -7.6, 0.5], [-7.6, -8.2, 0.2], [7.6, -8.2, -0.2], [10, -7.6, -0.5], [-10.4, 3, Math.PI / 2], [10.4, 3, -Math.PI / 2], [-10.4, 6, Math.PI / 2], [10.4, 6.2, -Math.PI / 2]];
  cabinets.forEach(([x, z, r], i) => {
    const c = P.arcadeCabinet(neon[i % neon.length]);
    c.position.set(x, 0, z);
    c.rotation.y = r;
    c.scale.setScalar(1.6);
    g.add(c);
    const p = new Painter(16, 12);
    const mat = new THREE.MeshBasicMaterial({ map: p.texture(), toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(11 / 16, 8 / 16), mat);
    scr.position.set(0, 25 / 16, 5.05 / 16);
    scr.rotation.x = -0.12;
    c.add(scr);
    screens.push({ mat, p, seed: i });
  });
  // Neon strips.
  for (const [y, c] of [[7.6, neon[0]], [0.15, neon[1]]] as const) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(26, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2), toneMapped: false }));
    strip.position.set(0, y, -8.9);
    g.add(strip);
  }
  const lights = [pointLight('#ff2fa0', 6, 14, new THREE.Vector3(-6, 4, -5)), pointLight('#4dffea', 6, 14, new THREE.Vector3(6, 4, -5)), pointLight('#a37bff', 4, 12, new THREE.Vector3(0, 5, 4))];
  lights.forEach((l) => g.add(l));
  let acc = 0;
  return {
    id: 'frog_arcade', group: g, background: new THREE.Color('#0a0614'), fog: new THREE.Fog('#0a0614', 14, 30),
    hemi: ['#a8a0ff', '#1a0a2a', 0.7], key: ['#d8d0ff', 0.9], djHat: 'hat_propeller', djClothes: 'clothes_tee', djFace: 'face_visor',
    ambientMusic: 'arcade',
    update(dt, t, _particles, beat) {
      acc += dt;
      lights.forEach((l, i) => (l.intensity = 5 + Math.sin(t * 3 + i * 2) * 1.5 + beat * 2));
      if (acc > 0.15) {
        acc = 0;
        for (const s of screens) {
          const p = s.p;
          p.clear('#0a0a1a');
          const k = Math.floor(t * 6 + s.seed * 3);
          for (let i = 0; i < 6; i++) p.rect((k * (i + 1) + s.seed * 5) % 16, (i * 2 + s.seed) % 12, 2, 1, neon[(i + s.seed) % neon.length]);
          p.rect((k * 2) % 14, 9, 3, 2, '#6fe05a');
          (s.mat.map as THREE.Texture).needsUpdate = true;
        }
      }
    },
  };
}

// ───────────────────────── Moonlit Pond ─────────────────────────

function moonlitPond(): MapEnv {
  const g = new THREE.Group();
  addSky(g, '#050a1e', '#132a4a', 0.06);
  const water = new WaterTexture('#14305a', '#2a5a8a', 64);
  water.texture.repeat.set(8, 8);
  const pond = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({ map: water.texture, roughness: 0.2, metalness: 0.2 }));
  pond.rotation.x = -Math.PI / 2;
  pond.position.y = -0.25;
  g.add(pond);
  const island = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 10.5, 0.6, 36), std(grass('#2f5f3a', [10, 10])));
  island.position.y = -0.3;
  island.receiveShadow = true;
  g.add(island);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(4.2, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff6d8').multiplyScalar(1.4), toneMapped: false, fog: false }));
  moon.position.set(8, 16, -40);
  moon.lookAt(0, 2, 0);
  g.add(moon);
  const halo = new THREE.Mesh(new THREE.CircleGeometry(7, 32), new THREE.MeshBasicMaterial({ color: '#fff6d8', transparent: true, opacity: 0.12, toneMapped: false, fog: false }));
  halo.position.copy(moon.position).add(new THREE.Vector3(0, 0, -0.1));
  halo.lookAt(0, 2, 0);
  g.add(halo);
  scatter(g, (i) => P.reeds(i + 1), 18, 8.6, 10.5, { avoidFront: true, seed: 4 });
  scatter(g, (i) => { const p = P.lilyPad('#3f8f4f', 8, i % 2 === 0); p.scale.setScalar(2); return p; }, 16, 11, 24, { y: -0.2, seed: 9 });
  scatter(g, (i) => { const r = P.rock(i, '#5a6078'); r.scale.setScalar(1.8); return r; }, 7, 7.5, 9.2, { avoidFront: true, seed: 2 });
  scatter(g, (i) => { const t = P.tree(i, '#1f4f3a'); t.scale.setScalar(2.4); return t; }, 10, 26, 36, { y: -0.3, seed: 6 });
  const moonLight = new THREE.DirectionalLight('#b8c8ff', 0.6);
  moonLight.position.set(8, 16, -30);
  g.add(moonLight);
  return {
    id: 'moonlit_pond', group: g, background: new THREE.Color('#050a1e'), fog: new THREE.Fog('#0a1430', 20, 55),
    hemi: ['#a8b8ff', '#0a1a2a', 0.75], key: ['#d8e0ff', 0.9], djHat: 'hat_wizard', djClothes: 'clothes_cape', djFace: 'face_none',
    ambientMusic: 'moon',
    update(dt, t, particles) {
      water.update(dt);
      fireflies(particles, t, dt, 3, 8, 0.6);
      (halo.material as THREE.MeshBasicMaterial).opacity = 0.1 + Math.sin(t * 0.5) * 0.03;
    },
  };
}

export function buildMap(id: MapId): MapEnv {
  const env = id === 'mushroom_tavern' ? mushroomTavern()
    : id === 'rainy_cabin' ? rainyCabin()
    : id === 'lilypad_disco' ? lilypadDisco()
    : id === 'frog_arcade' ? frogArcade()
    : id === 'moonlit_pond' ? moonlitPond()
    : swampClubhouse();
  env.group.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.layers.mask === 0) o.layers.set(0); });
  void FX_LAYER;
  return env;
}
