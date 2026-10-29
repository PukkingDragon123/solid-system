// LARPED ONE OUT — browser entry point. Boots the renderer, the cabin menu and the clubhouse, connects to the
// game server and switches between them with iris wipes.

import './styles.css';
import { ACHIEVEMENT_BY_ID } from '../shared/progression';
import { Painter } from './art/painter';
import { audio } from './audio/AudioEngine';
import { GameView, type GameCtx } from './game/GameView';
import { Tutorial } from './game/Tutorial';
import { Menu } from './menu/Menu';
import { askName, closeModal, openCredits, openSettings } from './menu/overlays';
import { LocalServer, OFFLINE } from './net/LocalServer';
import { Net } from './net/Net';
import { PixelRenderer } from './render/PixelRenderer';
import { Cabin, type Station } from './scenes/cabin/Cabin';
import { Clubhouse } from './scenes/clubhouse/Clubhouse';
import { store } from './state';
import { h } from './ui/dom';
import { Hud } from './ui/Hud';
import { drawLogo, installTheme } from './ui/theme';

type Mode = 'cabin' | 'game' | 'tutorial';

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function progress(frac: number, msg: string): void {
  const bar = document.getElementById('loading-bar');
  const m = document.getElementById('loading-msg');
  if (bar) bar.style.width = `${Math.round(frac * 100)}%`;
  if (m) m.textContent = msg;
}

function favicon(): void {
  const p = new Painter(16);
  p.ellipse(8, 10, 7, 5, '#5fbf3f');
  p.circle(4.5, 5, 3, '#5fbf3f');
  p.circle(11.5, 5, 3, '#5fbf3f');
  p.circle(4.5, 5, 2, '#ffffff');
  p.circle(11.5, 5, 2, '#ffffff');
  p.rect(4, 5, 2, 2, '#1b1420');
  p.rect(11, 5, 2, 2, '#1b1420');
  p.rect(5, 11, 6, 1, '#1b1420');
  p.outline('#1b1420');
  const link = document.getElementById('favicon') as HTMLLinkElement | null;
  if (link) link.href = p.dataUrl(4);
}

class App {
  readonly container = document.getElementById('app')!;
  pixel!: PixelRenderer;
  hud!: Hud;
  cabin!: Cabin;
  club!: Clubhouse;
  game!: GameView;
  menu!: Menu;
  readonly net: Net = OFFLINE ? new LocalServer() : new Net();
  mode: Mode = 'cabin';
  private tutorial: Tutorial | null = null;
  private tutorialView: GameView | null = null;
  private dressingUp = false;
  private last = performance.now();
  private statusPill = h('div', { class: 'status-pill', style: { display: 'none' } });
  private everOnline = false;
  private joinCode: string | null = null;
  private switching = false;

  async boot(): Promise<void> {
    installTheme();
    favicon();
    const logo = drawLogo('LARPED ONE OUT', 4);
    logo.className = 'pixel-logo';
    document.getElementById('loading-logo')?.appendChild(logo);
    const q = new URLSearchParams(location.search);
    const code = (q.get('join') ?? q.get('code') ?? '').toUpperCase().replace(/[^A-Z]/g, '');
    if (code.length === 4) this.joinCode = code;

    // Connect first so the profile arrives while the scenes build.
    store.net = this.net;
    this.net.name = store.settings.name;
    this.wireNet();
    this.net.connect();

    progress(0.1, 'Polishing pixels…');
    await frame();
    try {
      this.pixel = new PixelRenderer(this.container);
    } catch (err) {
      console.error(err);
      progress(1, 'Your browser could not start WebGL. Try enabling hardware acceleration or another browser.');
      return;
    }
    this.pixel.setQuality(store.settings.quality);
    this.hud = new Hud(this.container);
    this.hud.root.appendChild(this.statusPill);
    progress(0.3, 'Lighting the cabin fireplace…');
    await frame();
    this.cabin = new Cabin();
    this.cabin.sfx = (n) => audio.sfx(n);
    progress(0.6, 'Waking up DJ Lilypadd…');
    await frame();
    this.club = new Clubhouse({ sfx: (n, pos) => audio.sfx(n, { pan: pos ? Math.max(-1, Math.min(1, pos.x / 8)) * 0.6 : 0 }) });
    progress(0.85, 'Tuning the turntable…');
    await frame();
    const ctx: GameCtx = {
      hud: this.hud,
      net: this.net,
      scene: this.club,
      pixel: this.pixel,
      canvas: this.pixel.canvas,
      leave: () => this.leaveParty(),
      openCabin: () => this.dressUp(),
    };
    this.game = new GameView(ctx);
    this.menu = new Menu({
      hud: this.hud,
      net: this.net,
      cabin: this.cabin,
      canvas: this.pixel.canvas,
      startTutorial: () => this.startTutorial(),
      backToParty: () => this.enterGame(),
      openSettings: () => this.settings(),
      openCredits: () => openCredits(),
    });
    this.applySettings();
    store.on('settings', () => this.applySettings());
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    this.resize();
    if (store.profile) this.cabin.setOutfit(store.profile.outfit);
    this.menu.show('home');
    requestAnimationFrame(this.loop);
    progress(1, '');
    await this.tapToStart();
  }

  /** Browsers only allow sound after a tap, so the loading screen ends with one. */
  private tapToStart(): Promise<void> {
    const loading = document.getElementById('loading')!;
    const msg = document.getElementById('loading-msg')!;
    msg.replaceChildren(h('div', { class: 'tap-start' }, this.joinCode ? `👆 Tap to join party ${this.joinCode}` : '👆 Tap anywhere to start'));
    return new Promise((resolve) => {
      const go = () => {
        loading.removeEventListener('pointerdown', go);
        window.removeEventListener('keydown', go);
        audio.unlock();
        audio.setVolumes(store.settings.music, store.settings.sfx);
        loading.style.transition = 'opacity 400ms steps(4)';
        loading.style.opacity = '0';
        window.setTimeout(() => loading.remove(), 420);
        if (this.mode === 'cabin') { audio.playMusic('cabin'); this.cabin.toggleRecord(true); }
        audio.sfx('ribbit');
        this.afterStart();
        resolve();
      };
      loading.addEventListener('pointerdown', go);
      window.addEventListener('keydown', go);
    });
  }

  private afterStart(): void {
    const join = () => {
      if (!this.joinCode) return;
      const code = this.joinCode;
      this.joinCode = null;
      history.replaceState(null, '', location.pathname);
      this.net.send({ t: 'join', code, session: this.net.sessionFor(code) });
    };
    if (!store.settings.name) {
      askName(store.profile?.name ?? '', (name) => {
        const clean = name.trim().slice(0, 16);
        if (clean.length >= 2) {
          store.saveSettings({ name: clean });
          this.net.name = clean;
          this.net.send({ t: 'profile_update', name: clean });
        }
        if (this.joinCode) join();
        else if (store.profile && !store.profile.tutorialDone) this.hud.toast('New frog? DJ Lilypadd\'s tutorial poster is on the left wall 🎓', 'wood', 6000);
      });
    } else {
      join();
    }
  }

  // ───────────────────────── networking ─────────────────────────

  private wireNet(): void {
    const net = this.net;
    net.on('welcome', (m) => {
      store.profile = m.profile;
      store.features = m.features;
      store.emit('features');
      store.emit('profile');
      if (store.settings.name && m.profile.name !== store.settings.name && m.profile.stats.games === 0) {
        net.send({ t: 'profile_update', name: store.settings.name });
      }
    });
    net.on('profile', (m) => {
      const before = store.profile;
      store.profile = m.profile;
      if (before && m.profile.level > before.level) { audio.sfx('levelup'); this.hud?.toast(`⬆️ Level ${m.profile.level}!`, 'wood'); }
      store.emit('profile');
    });
    net.on('shop', (m) => { store.shop = m.shop; store.emit('shop'); });
    net.on('records', (m) => { store.records = m.records; store.emit('records'); });
    net.on('achievement', (m) => {
      const a = ACHIEVEMENT_BY_ID[m.id];
      if (!a) return;
      audio.sfx('levelup');
      this.hud?.toast(`${a.icon} Achievement: ${a.name} (+${a.coins} 🪙)`, 'wood', 5000);
    });
    net.on('error', (m) => {
      if (m.code === 'status') return;
      audio.sfx('error');
      this.hud?.toast(m.msg, 'paper', 4200);
    });
    net.on('room', (m) => {
      const prevCode = store.room?.code;
      store.prevRoom = store.room;
      store.room = m.s;
      store.emit('room');
      if (!this.game) return;
      if (prevCode !== m.s.code) this.dressingUp = false;
      // "Practice vs bots" creates a room, then fills it.
      if (this.menu.pendingBots > 0 && m.s.phase.id === 'lobby' && m.s.hostId === m.s.you.id) {
        const n = this.menu.pendingBots;
        this.menu.pendingBots = 0;
        for (let i = 0; i < n; i++) net.send({ t: 'bot_add' });
      }
      if (this.mode === 'tutorial') return;
      if (this.mode === 'cabin') {
        if (this.dressingUp && m.s.phase.id === 'lobby') return;
        this.dressingUp = false;
        this.enterGame();
        return;
      }
      this.game.onRoom(m.s);
    });
    net.on('left', (m) => {
      store.room = null;
      store.emit('room');
      this.dressingUp = false;
      if (m.reason && m.reason !== 'left') this.hud?.toast(m.reason, 'paper', 4500);
      if (this.mode === 'game') this.goCabin('play');
    });
    net.onStatus((status) => {
      if (status === 'open') this.everOnline = true;
      const bad = status !== 'open';
      this.statusPill.style.display = bad && this.everOnline ? '' : 'none';
      this.statusPill.className = `status-pill${bad ? ' bad' : ''}`;
      this.statusPill.textContent = status === 'connecting' ? '📡 Reconnecting…' : '📡 Offline — retrying';
    });
  }

  // ───────────────────────── modes ─────────────────────────

  private enterGame(): void {
    if (this.mode === 'game' || this.switching) return;
    this.switching = true;
    audio.sfx('whoosh');
    void this.hud.iris(() => {
      this.menu.hide();
      this.mode = 'game';
      this.dressingUp = false;
      this.game.attach();
      if (store.room) this.game.onRoom(store.room);
      this.resize();
    }).then(() => { this.switching = false; });
  }

  private goCabin(station: Station = 'home'): void {
    if (this.switching) return;
    this.switching = true;
    void this.hud.iris(() => {
      this.game.detach();
      this.tutorialView?.detach();
      this.mode = 'cabin';
      closeModal();
      this.menu.show(station);
      this.resize();
      audio.duck(1);
      audio.playMusic('cabin');
      this.cabin.toggleRecord(true);
    }).then(() => { this.switching = false; });
  }

  private dressUp(): void {
    this.dressingUp = true;
    this.goCabin('customize');
  }

  private leaveParty(): void {
    this.net.send({ t: 'leave' });
    store.room = null;
    store.emit('room');
    this.goCabin('play');
  }

  private startTutorial(): void {
    if (this.tutorial || this.switching) return;
    if (store.room) {
      this.net.send({ t: 'leave' });
      store.room = null;
      store.emit('room');
    }
    const p = store.profile;
    const tutorial = new Tutorial(this.hud, {
      name: store.settings.name || p?.name || 'You',
      outfit: p?.outfit ?? this.cabin.frog.model.outfit,
      level: p?.level ?? 1,
      onDone: () => this.net.send({ t: 'tutorial_done' }),
      onExit: () => {
        this.tutorial = null;
        this.goCabin('home');
      },
    });
    const view = new GameView({
      hud: this.hud,
      net: tutorial.net,
      scene: this.club,
      pixel: this.pixel,
      canvas: this.pixel.canvas,
      leave: () => tutorial.exit(),
      openCabin: () => tutorial.exit(),
    });
    tutorial.net.on('room', (m) => view.onRoom(m.s));
    tutorial.net.on('left', () => tutorial.exit());
    this.tutorial = tutorial;
    this.tutorialView = view;
    this.switching = true;
    void this.hud.iris(() => {
      this.menu.hide();
      this.mode = 'tutorial';
      view.attach();
      tutorial.start();
      this.resize();
    }).then(() => { this.switching = false; });
  }

  private settings(): void {
    openSettings(this.pixel, { onTutorial: () => this.startTutorial(), onCredits: () => openCredits() });
  }

  private applySettings(): void {
    const s = store.settings;
    audio.setVolumes(s.music, s.sfx);
    const sway = s.reduceMotion ? 0 : 0.012;
    this.cabin.rig.sway = sway;
    this.club.rig.sway = sway;
    document.documentElement.classList.toggle('reduce-motion', s.reduceMotion);
  }

  // ───────────────────────── frame loop ─────────────────────────

  private resize(): void {
    const w = this.container.clientWidth;
    const hgt = this.container.clientHeight;
    this.pixel.resize(w, hgt);
    const aspect = w / Math.max(1, hgt);
    for (const cam of [this.cabin.rig.camera, this.club.rig.camera]) {
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
    }
    this.cabin.aspect = aspect;
    if (this.mode === 'cabin' && !this.cabin.rig.moving) this.cabin.reframe();
  }

  private loop = (now: number): void => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const reduce = store.settings.reduceMotion;
    const u = this.pixel.uniforms;
    let cam;
    let scene;
    if (this.mode === 'cabin') {
      this.cabin.update(dt);
      cam = this.cabin.rig.camera;
      scene = this.cabin.scene;
      this.cabin.particles.setViewport(this.pixel.renderer.domElement.height, cam.fov);
      u.flash.value = 0;
      u.darkness.value = 0;
    } else {
      this.club.beat = audio.beat();
      this.club.update(dt);
      (this.mode === 'tutorial' ? this.tutorialView : this.game)?.update(dt);
      cam = this.club.rig.camera;
      scene = this.club.scene;
      this.club.particles.setViewport(this.pixel.renderer.domElement.height, cam.fov);
      u.flash.value = this.club.flash * (reduce ? 0.25 : 1);
      u.darkness.value = this.club.darkLevel;
    }
    this.pixel.render(scene, cam);
    this.hud.update(cam);
  };
}

const app = new App();
app.boot().catch((err) => {
  console.error(err);
  progress(1, `Something went wrong while loading: ${(err as Error).message}`);
});
