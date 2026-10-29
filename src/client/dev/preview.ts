// Dev-only turntable for checking frog models and cosmetics: /preview.html?set=hats
import * as THREE from 'three';
import { COSMETICS, DEFAULT_OUTFIT, type Outfit } from '../../shared/cosmetics';
import { PixelRenderer } from '../render/PixelRenderer';
import { FrogActor } from '../render/frog/FrogActor';

const app = document.getElementById('app')!;
const pr = new PixelRenderer(app);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#2a3b4a');
const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
scene.add(new THREE.HemisphereLight('#ffe8c8', '#2a3020', 1.4));
const sun = new THREE.DirectionalLight('#fff2dd', 2.2);
sun.position.set(3, 6, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -8; sun.shadow.camera.right = 8; sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#4a6a3a' }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const params = new URLSearchParams(location.search);
const set = params.get('set') ?? 'hats';
const slotMap: Record<string, keyof Outfit> = { hats: 'hat', clothes: 'clothes', neck: 'neck', face: 'face', skins: 'skin', eyes: 'eyes', mouths: 'mouth', patterns: 'pattern' };
const slot = slotMap[set];
let outfits: Outfit[] = [];
if (slot) outfits = COSMETICS.filter((c) => c.slot === slot).map((c) => ({ ...DEFAULT_OUTFIT, [slot]: c.id }) as Outfit);
if (set === 'toad') outfits = [DEFAULT_OUTFIT, { ...DEFAULT_OUTFIT, hat: 'hat_crown' }];
if (params.get('items')) {
  const o: Record<string, unknown> = { ...DEFAULT_OUTFIT };
  for (const id of params.get('items')!.split(',')) { const c = COSMETICS.find((x) => x.id === id); if (c) o[c.slot] = id; }
  outfits = [o as unknown as Outfit];
}
const cols = Math.ceil(Math.sqrt(outfits.length * 1.6));
const actors: FrogActor[] = [];
outfits.forEach((o, i) => {
  const a = new FrogActor(o, {}, { toad: set === 'toad' && i === 1 });
  a.enableIdles = params.has('idle');
  const x = (i % cols) - (cols - 1) / 2;
  const z = Math.floor(i / cols) - (Math.ceil(outfits.length / cols) - 1) / 2;
  a.place(new THREE.Vector3(x * 1.6, 0, z * 1.6), Number(params.get('rot') ?? 0.35));
  scene.add(a.root);
  actors.push(a);
});
const rows = Math.ceil(outfits.length / cols);
const dist = Math.max(cols, rows * 1.4) * 1.6 + 2;
cam.position.set(0, dist * 0.55, dist * 0.9);
cam.lookAt(0, 0.6, 0);
const act = params.get('act');
if (act) actors.forEach((a) => a.play(act));
function resize() { pr.resize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
addEventListener('resize', resize);
resize();
let last = performance.now();
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  for (const a of actors) a.update(dt);
  pr.render(scene, cam);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
(window as any).__ready = true;
