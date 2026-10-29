// The final results cinematic: lights out, spotlight on last place, frog → toad transformation,
// "LARPED ONE OUT", gasps, pointing, laughing, inflatable-hammer slapstick with a tumbling toad,
// then the winner's golden lily pad throne.

import * as THREE from 'three';
import type { Phase, RoomSnapshot } from '../../shared/protocol';
import { audio } from '../audio/AudioEngine';
import type { FrogActor } from '../render/frog/FrogActor';
import { VOX } from '../render/frog/FrogModel';
import type { Clubhouse } from '../scenes/clubhouse/Clubhouse';
import * as P from '../scenes/props';
import { buildHat } from '../render/frog/cosmetics';
import { voxMesh } from '../render/voxel';
import { h } from '../ui/dom';
import type { Hud } from '../ui/Hud';
import { drawLogo } from '../ui/theme';

type FinalePhase = Extract<Phase, { id: 'finale' }>;

interface Tumble {
  actor: FrogActor;
  vel: THREE.Vector3;
  ang: THREE.Vector3;
  active: boolean;
}

export class Finale {
  private timers: number[] = [];
  private raf = 0;
  private extras: THREE.Object3D[] = [];
  private overlays: HTMLElement[] = [];
  private tumble: Tumble | null = null;
  private projectiles: { obj: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number }[] = [];
  private running = false;
  private crown: THREE.Object3D | null = null;
  private last = 0;

  constructor(private scene: Clubhouse, private hud: Hud, private say: (text: string, ms: number) => void) {}

  private at(sec: number, fn: () => void): void {
    this.timers.push(window.setTimeout(() => { if (this.running) fn(); }, sec * 1000));
  }

  run(s: RoomSnapshot, ph: FinalePhase, music: (key: string) => void): void {
    this.stop();
    this.running = true;
    const sc = this.scene;
    const loser = sc.actorOf(ph.loser);
    const winner = sc.actorOf(ph.winner);
    const name = (id: string) => s.players.find((p) => p.id === id)?.name ?? '???';
    const others = [...sc.seats.values()].filter((x) => x.player.id !== ph.loser).map((x) => x.actor);
    const aspect = sc.rig.camera.aspect;
    const solo = s.players.length < 2;

    // 0s — lights out, record scratch.
    audio.stopMusic(0.05);
    audio.sfx('scratch');
    sc.setDark(0.86);
    sc.rig.go(sc.shot('wide', { aspect }), 1.2);
    sc.dj.play('shock', true);
    this.say('...wait. Lights. LIGHTS! It\'s time to find out who\'s the TOAD.', 3800);
    sc.chalk.clear();
    sc.chalk.write('AND THE TOAD IS...', 256, 136, { size: 40, align: 'center' });

    // 1.6s — spotlight + dramatic organ.
    this.at(1.6, () => {
      audio.sfx('drama');
      music('drama');
      if (loser) {
        sc.spotlightOn(loser.root.position.clone().add(new THREE.Vector3(0, 0.8, 0)));
        const head = loser.root.position.clone();
        const dir = new THREE.Vector3(-head.x, 0, -head.z).normalize();
        sc.rig.go({ pos: head.clone().add(dir.multiplyScalar(4.2)).add(new THREE.Vector3(0, 2.2, 0)), target: head.clone().add(new THREE.Vector3(0, 0.7, 0)), fov: 40 }, 4.5);
      }
    });
    this.at(3, () => {
      if (loser) for (const o of others) o.lookAt(loser.headPos());
      loser?.play('gasp', true);
      if (loser) loser.nervous = 1;
    });
    this.at(5.2, () => { loser?.play('cry', true); audio.sfx('drumroll'); });

    // 7s — transformation.
    this.at(7, () => {
      if (!loser) return;
      audio.sfx('transform');
      audio.sfx('magic');
      const p = loser.headPos();
      sc.particles.frogFx('poof', p.clone().add(new THREE.Vector3(0, -0.4, 0)), 40);
      sc.particles.emit('spark', p, 40, { color: ['#c8ff7a', '#ffe245', '#ffffff'], speed: 3, gravity: 0, life: 1, size: 0.12, spread: 2 });
      sc.rig.addShake(0.5);
      this.hud.root.animate([{ filter: 'brightness(3)' }, { filter: 'brightness(1)' }], { duration: 500, easing: 'steps(5)' });
      loser.toToad(true);
      loser.nervous = 0;
    });
    this.at(7.5, () => {
      audio.sfx('crash');
      const logo = drawLogo('LARPED ONE OUT', 6);
      const el = h('div', { class: 'larped' }, logo, h('div', { class: 'titlecard' }, h('div', { class: 'mid' }, solo ? 'Even alone, someone has to be the toad.' : `${name(ph.loser)} is the toad!`)));
      this.hud.topLayer.appendChild(el);
      this.overlays.push(el);
      sc.chalk.write(name(ph.loser).toUpperCase(), 256, 200, { size: 36, align: 'center', color: '#ffb0b0' });
    });
    this.at(8.4, () => { for (const o of others) o.play('gasp', true); audio.sfx('gasp'); });
    this.at(9.6, () => {
      for (const o of others) o.play('pointLaugh', true);
      audio.sfx('laugh');
      window.setTimeout(() => audio.sfx('laugh', { pitch: 1.2 }), 400);
      sc.rig.go(sc.shot('overview', { aspect }), 1.4);
    });

    // 12s — slapstick.
    this.at(12, () => {
      if (!loser) return;
      music('chase');
      sc.setDark(0.35);
      sc.spotlightOn(null);
      for (const o of others) o.lookAt(null);
      const bonkers = others.slice(0, 4);
      const target = loser.root.position.clone();
      bonkers.forEach((o, i) => {
        const hammer = P.hammer(['#ff5d9e', '#4aa3ff', '#ffe245', '#6fe05a'][i % 4]);
        hammer.scale.setScalar(1.3);
        hammer.position.set(0, -6 * VOX, 1 * VOX);
        hammer.rotation.x = -Math.PI / 2;
        o.model.armR.add(hammer);
        this.extras.push(hammer);
        const a = (i / Math.max(1, bonkers.length)) * Math.PI * 2;
        o.moveTo(target.clone().add(new THREE.Vector3(Math.cos(a) * 1.25, 0, Math.sin(a) * 1.25)), 0.8, 0.9);
        o.baseRotY = Math.atan2(-Math.cos(a), -Math.sin(a));
      });
      // Bonk loop.
      let n = 0;
      const bonk = () => {
        if (!this.running || n > 7) return;
        const o = bonkers[n % bonkers.length];
        o?.play('swing', true);
        loser.play('bonked', true);
        audio.sfx('bonk', { pitch: 0.85 + Math.random() * 0.4 });
        sc.particles.frogFx('stars', loser.headPos(), 5);
        sc.rig.addShake(0.12);
        n++;
        this.timers.push(window.setTimeout(bonk, 330));
      };
      this.timers.push(window.setTimeout(bonk, 900));
      // Lily pads thrown from the crowd.
      for (let i = 0; i < 6; i++) {
        this.timers.push(window.setTimeout(() => {
          const from = (others[i % Math.max(1, others.length)]?.headPos() ?? new THREE.Vector3(0, 2, 3)).clone();
          const pad = P.lilyPad('#3fae4f', 5, i % 2 === 0);
          pad.scale.setScalar(1.6);
          sc.scene.add(pad);
          this.extras.push(pad);
          this.projectiles.push({ obj: pad, from, to: loser.headPos(), t: 0, dur: 0.7 });
          audio.sfx('whoosh', { vol: 0.5 });
        }, 1200 + i * 380));
      }
    });
    // 15.5s — launched into a ragdoll tumble inside a cartoon dust cloud.
    this.at(15.6, () => {
      if (!loser) return;
      audio.sfx('bonk', { pitch: 0.6 });
      audio.sfx('boing');
      this.tumble = { actor: loser, vel: new THREE.Vector3(1.4, 5.5, 2.2), ang: new THREE.Vector3(7, 2, 9), active: true };
      for (let i = 0; i < 6; i++) this.timers.push(window.setTimeout(() => {
        sc.particles.frogFx('dust', loser.root.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.5, (Math.random() - 0.5) * 1.5)), 14);
        sc.particles.frogFx('stars', loser.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 3);
      }, i * 160));
    });

    // 19s — the throne.
    this.at(19, () => {
      sc.setDark(0.15);
      for (const e of this.extras) e.removeFromParent();
      this.extras = [];
      sc.throne.visible = true;
      sc.throne.scale.setScalar(0.01);
      this.grow(sc.throne, 2, 600);
      sc.rig.go(sc.shot('throne', { aspect }), 1.5);
      music('victory');
      audio.sfx('cheer');
      if (winner) {
        winner.moveTo(new THREE.Vector3(0, 0.75, -3.6), 1.1, 1.6, () => {
          winner.baseRotY = 0;
          winner.play('celebrate', true);
          const c = new THREE.Group();
          c.add(voxMesh(buildHat('hat_crown')!.main, VOX));
          c.position.set(0, 1 * VOX, 0);
          c.scale.setScalar(0.8);
          winner.model.headTop.add(c);
          this.crown = c;
          sc.particles.frogFx('confetti', winner.headPos(), 80);
        });
      }
      const banner = h('div', { class: 'overlay passthrough' }, h('div', { class: 'titlecard card-pop', style: { marginTop: '-30vh' } }, h('div', { class: 'big' }, ph.tie ? 'PHOTO FINISH!' : `${name(ph.winner).toUpperCase()} WINS!`), h('div', { class: 'mid' }, 'Long live the Lily Pad Royalty 👑')));
      this.timers.push(window.setTimeout(() => { if (this.running) { this.hud.topLayer.appendChild(banner); this.overlays.push(banner); } }, 1300));
      for (const o of others) if (o !== winner) this.timers.push(window.setTimeout(() => o.play('celebrate', true), 1400 + Math.random() * 800));
      if (loser) this.timers.push(window.setTimeout(() => loser.play('shrug', true), 2600));
    });
    this.at(21, () => { for (let i = 0; i < 5; i++) this.timers.push(window.setTimeout(() => sc.particles.frogFx('confetti', new THREE.Vector3((Math.random() - 0.5) * 8, 4, -2 + Math.random() * 3), 50), i * 500)); });

    this.last = performance.now();
    const loop = () => {
      if (!this.running) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.step(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private grow(obj: THREE.Object3D, to: number, ms: number): void {
    const start = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - start) / ms);
      const e = 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;
      obj.scale.setScalar(Math.max(0.01, to * e));
      if (k < 1) requestAnimationFrame(tick);
    };
    tick();
  }

  private step(dt: number): void {
    // Ragdoll-ish tumble: ballistic body with bouncy, rolling contacts and floppy limbs.
    const tb = this.tumble;
    if (tb?.active) {
      const r = tb.actor.root;
      tb.actor.basePos.addScaledVector(tb.vel, dt);
      tb.vel.y -= 14 * dt;
      const rig = tb.actor.model.rig;
      rig.rotation.x += tb.ang.x * dt;
      rig.rotation.z += tb.ang.z * dt;
      rig.rotation.y += tb.ang.y * dt;
      const m = tb.actor.model;
      const flop = Math.sin(performance.now() / 60);
      m.armL.rotation.z = -1 - flop * 1.2;
      m.armR.rotation.z = 1 + flop * 1.2;
      m.legL.rotation.x = flop;
      m.legR.rotation.x = -flop;
      if (tb.actor.basePos.y < 0.05 && tb.vel.y < 0) {
        tb.actor.basePos.y = 0.05;
        tb.vel.y = -tb.vel.y * 0.45;
        tb.vel.x *= 0.6;
        tb.vel.z *= 0.6;
        tb.ang.multiplyScalar(0.55);
        audio.sfx('squish', { vol: 0.6 });
        this.scene.particles.frogFx('dust', r.position.clone(), 8);
        if (tb.vel.y < 0.6) {
          tb.active = false;
          rig.rotation.set(-Math.PI / 2 + 0.2, 0, 0.3);
          tb.actor.play('sleep', true);
        }
      }
      const lim = 8;
      tb.actor.basePos.x = THREE.MathUtils.clamp(tb.actor.basePos.x, -lim, lim);
      tb.actor.basePos.z = THREE.MathUtils.clamp(tb.actor.basePos.z, -lim, lim);
    }
    for (const p of this.projectiles) {
      p.t += dt / p.dur;
      const k = Math.min(1, p.t);
      p.obj.position.lerpVectors(p.from, p.to, k);
      p.obj.position.y += Math.sin(k * Math.PI) * 1.5;
      p.obj.rotation.x += dt * 12;
      if (k >= 1 && p.obj.parent) {
        p.obj.removeFromParent();
        audio.sfx('splash', { vol: 0.6 });
        this.scene.particles.emit('drop', p.to, 10, { color: '#7fd0ff', speed: 2, gravity: -6, life: 0.6, size: 0.08 });
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.t < 1);
  }

  stop(): void {
    if (!this.running && !this.timers.length) return;
    this.running = false;
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
    cancelAnimationFrame(this.raf);
    for (const e of this.extras) e.removeFromParent();
    this.extras = [];
    for (const o of this.overlays) o.remove();
    this.overlays = [];
    this.crown?.removeFromParent();
    this.crown = null;
    this.projectiles = [];
    const sc = this.scene;
    sc.setDark(0);
    sc.spotlightOn(null);
    sc.throne.visible = false;
    if (this.tumble) {
      this.tumble.actor.model.rig.rotation.set(0, 0, 0);
      this.tumble = null;
    }
    // Everyone hops back to their stool.
    const n = sc.seats.size;
    [...sc.seats.values()].forEach((seat) => {
      const pose = sc.seatPose(seat.slot, n);
      const to = pose.pos.clone().add(new THREE.Vector3(0, 0.62, 0));
      seat.actor.lookAt(null);
      if (seat.actor.root.position.distanceTo(to) > 0.2) seat.actor.moveTo(to, 0.9, 0.8);
      seat.actor.baseRotY = pose.rotY;
    });
  }
}
