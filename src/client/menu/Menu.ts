// The cabin main menu. Every menu is a physical station in the room: wooden signs float over each one,
// clicking a sign (or the object itself) glides the camera over while your frog hops along, then the
// station's panel slides in beside it.

import * as THREE from 'three';
import { MAP_BY_ID } from '../../shared/catalog';
import { COSMETIC_BY_ID, type Outfit } from '../../shared/cosmetics';
import { levelFromXp } from '../../shared/progression';
import type { PublicRoomInfo } from '../../shared/protocol';
import type { CoverSpec } from '../../shared/content';
import { recordCoverUrl } from '../art/icons';
import { audio } from '../audio/AudioEngine';
import type { Net } from '../net/Net';
import type { Cabin, Station } from '../scenes/cabin/Cabin';
import { store } from '../state';
import { clear, fmt, h } from '../ui/dom';
import type { Anchor, Hud } from '../ui/Hud';
import { drawLogo } from '../ui/theme';
import { collectionPanel, profilePanel, shopPanel, wardrobePanel } from './panels';
import { cancelThumbs } from './thumbs';

export interface MenuCtx {
  hud: Hud;
  net: Net;
  cabin: Cabin;
  canvas: HTMLCanvasElement;
  startTutorial(): void;
  backToParty(): void;
  openSettings(): void;
  openCredits(): void;
}

const STATIONS: Station[] = ['play', 'customize', 'shop', 'collection', 'profile', 'tutorial'];
const SIDE: Record<Station, string> = { home: '', play: 'left', customize: 'right', shop: 'left', collection: 'left', profile: 'left', tutorial: 'right' };
const TITLES: Record<Station, string> = { home: '', play: '🎉 Party Table', customize: '🪞 Changing Room', shop: '🛒 Mossy\'s Stall', collection: '💿 Record Shelf', profile: '📒 Scrapbook', tutorial: '🎓 Frog School' };

export class Menu {
  readonly layer: HTMLElement;
  readonly ctx: MenuCtx;
  station: Station = 'home';
  tabs: Record<string, string> = { customize: 'hat', shop: 'deals', collection: 'records' };
  /** Outfit being tried on in the changing room / shop (not yet saved). */
  preview: Outfit | null = null;
  selected: string | null = null;
  pendingBots = 0;
  rooms: PublicRoomInfo[] = [];
  /** Item we asked the server to buy; celebrated when it shows up as owned. */
  awaitBuy: string | null = null;
  /** When the current shop state arrived (for the deal countdown). */
  shopAt = Date.now();
  private signs = new Map<Station, Anchor>();
  private panel: HTMLElement | null = null;
  private panelBody: HTMLElement | null = null;
  private top: HTMLElement;
  private coinEl: HTMLElement;
  private logo: HTMLElement;
  private dock: HTMLElement;
  private partyBtn: HTMLElement;
  private shown = false;
  private unsub: (() => void)[] = [];
  private openTimer = 0;
  private drag = { on: false, x: 0, moved: 0, id: -1 };
  private ndc = new THREE.Vector2();
  private hoverAction: string | null = null;

  constructor(ctx: MenuCtx) {
    this.ctx = ctx;
    this.layer = h('div', { class: 'layer menu-layer' });
    const logoCanvas = drawLogo('LARPED ONE OUT', 4);
    logoCanvas.className = 'pixel-logo';
    this.logo = h('div', { class: 'logo-wrap' }, logoCanvas, h('div', { class: 'tagline' }, 'the frog party game where the worst guesser gets exposed'));
    this.coinEl = h('div', { class: 'coin-hud wood dark' });
    this.top = h('div', { class: 'menu-top' },
      h('button', { class: 'btn wood small icon', title: 'Settings', 'aria-label': 'Settings', onclick: () => { audio.sfx('click'); ctx.openSettings(); } }, '⚙️'),
      h('button', { class: 'btn wood small icon', title: 'Credits & licenses', 'aria-label': 'Credits and licenses', onclick: () => { audio.sfx('click'); ctx.openCredits(); } }, '📜'),
      h('button', { class: 'btn wood small icon', title: 'Fullscreen', 'aria-label': 'Fullscreen', onclick: () => toggleFullscreen() }, '⛶'));
    this.dock = h('div', { class: 'menu-dock wood dark' });
    for (const st of STATIONS) {
      const label = ctx.cabin.stations[st].label;
      this.dock.appendChild(h('button', { title: label, onclick: () => this.open(st) }, label.split(' ')[0], h('span', null, label.split(' ').slice(1).join(' '))));
    }
    this.partyBtn = h('button', { class: 'btn gold party-return', onclick: () => ctx.backToParty() }, '');
    this.layer.append(this.logo, this.top, this.coinEl, this.dock, this.partyBtn);
  }

  // ───────────────────────── lifecycle ─────────────────────────

  show(station: Station = 'home'): void {
    if (!this.shown) {
      this.shown = true;
      this.ctx.hud.phaseLayer.appendChild(this.layer);
      const c = this.ctx.canvas;
      c.addEventListener('pointermove', this.onMove);
      c.addEventListener('pointerdown', this.onDown);
      c.addEventListener('pointerup', this.onUp);
      c.addEventListener('pointercancel', this.onUp);
      window.addEventListener('keydown', this.onKey);
      this.unsub.push(
        store.on('profile', () => this.onProfile()),
        store.on('shop', () => { this.shopAt = Date.now(); if (this.station === 'shop') this.rerender(); }),
        store.on('records', () => { this.fillShelf(); if (this.station === 'collection') this.rerender(); }),
        store.on('room', () => this.syncParty()),
        this.ctx.net.on('rooms', (m) => { this.rooms = m.rooms; if (this.station === 'play') this.rerender(); }),
      );
      this.ctx.net.send({ t: 'records' });
      this.ctx.net.send({ t: 'shop' });
    }
    this.onProfile();
    this.syncParty();
    this.open(station, true);
  }

  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.layer.remove();
    const c = this.ctx.canvas;
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    for (const u of this.unsub) u();
    this.unsub = [];
    this.closePanel();
    this.clearSigns();
    this.endPreview();
    delete this.ctx.hud.root.dataset.menu;
    c.style.cursor = '';
  }

  get visible(): boolean {
    return this.shown;
  }

  // ───────────────────────── stations ─────────────────────────

  open(station: Station, instant = false): void {
    const cabin = this.ctx.cabin;
    window.clearTimeout(this.openTimer);
    if (station !== this.station) {
      audio.sfx('whoosh');
      this.endPreview();
      this.selected = null;
      cancelThumbs();
    }
    this.station = station;
    this.closePanel();
    if (instant) { cabin.station = station === 'home' ? 'play' : 'home'; }
    cabin.goTo(station, instant ? 0.01 : 1.4);
    if (instant) cabin.reframe();
    this.layer.dataset.station = station;
    this.ctx.hud.root.dataset.menu = station;
    cabin.present(null, this.outfit());
    if (station === 'home') {
      this.showSigns();
      return;
    }
    this.clearSigns();
    if (station === 'shop') this.ctx.net.send({ t: 'shop' });
    if (station === 'collection') this.ctx.net.send({ t: 'records' });
    if (station === 'play') this.ctx.net.send({ t: 'rooms' });
    this.openTimer = window.setTimeout(() => this.openPanel(), instant ? 0 : 750);
  }

  back(): void {
    audio.sfx('click');
    this.open('home');
  }

  private openPanel(): void {
    this.closePanel();
    const st = this.station;
    this.panelBody = h('div', { class: 'panel-body' });
    this.panel = h('div', { class: `panel wood ${SIDE[st]} panel-in` },
      h('div', { class: 'panel-head' },
        h('button', { class: 'btn wood small', onclick: () => this.back(), title: 'Back (Esc)' }, '◀ Back'),
        h('h2', null, TITLES[st])),
      this.panelBody);
    this.layer.appendChild(this.panel);
    this.rerender();
  }

  private closePanel(): void {
    this.panel?.remove();
    this.panel = null;
    this.panelBody = null;
  }

  /** Rebuilds the open panel in place, keeping its scroll position. */
  rerender(): void {
    const body = this.panelBody;
    if (!body || !this.panel) return;
    const scroll = this.panel.scrollTop;
    const inner = body.querySelector<HTMLElement>('.scroll-keep');
    const innerScroll = inner?.scrollTop ?? 0;
    clear(body);
    body.appendChild(this.build(this.station));
    this.panel.scrollTop = scroll;
    const inner2 = body.querySelector<HTMLElement>('.scroll-keep');
    if (inner2) inner2.scrollTop = innerScroll;
  }

  private build(st: Station): HTMLElement {
    switch (st) {
      case 'play': return this.playPanel();
      case 'customize': return wardrobePanel(this);
      case 'shop': return shopPanel(this);
      case 'collection': return collectionPanel(this);
      case 'profile': return profilePanel(this);
      case 'tutorial': return this.tutorialPanel();
      default: return h('div');
    }
  }

  private showSigns(): void {
    this.clearSigns();
    const cabin = this.ctx.cabin;
    for (const st of STATIONS) {
      const def = cabin.stations[st];
      const el = h('button', { class: `menu-sign${st === 'play' ? ' hot' : ''}`, onclick: () => this.open(st) }, def.label);
      if (st === 'tutorial' && store.profile && !store.profile.tutorialDone) el.appendChild(h('span', { class: 'sign-new' }, 'NEW'));
      const anchor = this.ctx.hud.anchor(el, () => def.sign);
      el.classList.add('clickable');
      this.signs.set(st, anchor);
    }
  }

  private clearSigns(): void {
    for (const a of this.signs.values()) this.ctx.hud.unanchor(a);
    this.signs.clear();
  }

  // ───────────────────────── profile / party sync ─────────────────────────

  outfit(): Outfit {
    return this.preview ?? store.profile?.outfit ?? this.ctx.cabin.frog.model.outfit;
  }

  setPreview(o: Outfit | null): void {
    this.preview = o;
    this.ctx.cabin.setOutfit(o ?? store.profile?.outfit ?? this.ctx.cabin.frog.model.outfit);
  }

  endPreview(): void {
    if (this.preview) this.setPreview(null);
  }

  private onProfile(): void {
    const p = store.profile;
    if (!p) { this.coinEl.textContent = 'Connecting…'; return; }
    const lv = levelFromXp(p.xp);
    if (this.awaitBuy && p.owned.includes(this.awaitBuy)) this.celebrateBuy(this.awaitBuy);
    clear(this.coinEl);
    this.coinEl.append(
      h('span', { class: 'coins' }, `🪙 ${fmt(p.coins)}`),
      h('span', { class: 'lvl' }, `Lv ${lv.level}`),
      h('span', { class: 'xpbar', title: `${lv.into} / ${lv.need} XP` }, h('i', { style: { width: `${Math.round((lv.into / Math.max(1, lv.need)) * 100)}%` } })));
    if (!this.preview) this.ctx.cabin.setOutfit(p.outfit);
    if (this.station !== 'home') this.rerender();
    else this.showSigns();
  }

  private celebrateBuy(id: string): void {
    this.awaitBuy = null;
    const cabin = this.ctx.cabin;
    audio.sfx('buy');
    audio.sfx('cheer');
    cabin.merchant.play('cheer', true);
    cabin.frog.play('celebrate', true);
    cabin.particles.frogFx('confetti', cabin.merchant.headPos(), 30);
    const def = COSMETIC_BY_ID[id];
    this.ctx.hud.toast(`🛍️ ${def?.name ?? 'Item'} is yours! Find it in the changing room.`, 'wood');
  }

  private syncParty(): void {
    const r = store.room;
    this.partyBtn.style.display = r ? '' : 'none';
    if (r) this.partyBtn.textContent = `🐸 Back to the party · ${r.code}`;
  }

  private fillShelf(): void {
    // The shelf shows real discovered records; the cabin builds sleeve textures from their cover art.
    const p = store.profile;
    this.ctx.cabin.setCollection(store.records.map((r) => ({ cover: coverTexture(r.id, r.title, r.cover) })), (p?.trophies ?? []).map((t) => t.kind));
  }

  // ───────────────────────── input ─────────────────────────

  private setNdc(ev: PointerEvent): void {
    const r = this.ctx.canvas.getBoundingClientRect();
    this.ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  }

  private onMove = (ev: PointerEvent): void => {
    this.setNdc(ev);
    if (this.drag.on && ev.pointerId === this.drag.id) {
      const dx = ev.clientX - this.drag.x;
      this.drag.x = ev.clientX;
      this.drag.moved += Math.abs(dx);
      if (this.station === 'customize' || this.station === 'shop') this.ctx.cabin.turn(dx * 0.012);
      return;
    }
    const action = this.ctx.cabin.pick(this.ndc);
    if (action !== this.hoverAction) {
      this.hoverAction = action;
      for (const [st, a] of this.signs) a.el.classList.toggle('hover', st === action);
    }
    this.ctx.canvas.style.cursor = action ? 'pointer' : this.station === 'customize' ? 'grab' : '';
  };

  private onDown = (ev: PointerEvent): void => {
    audio.unlock();
    this.setNdc(ev);
    this.drag = { on: true, x: ev.clientX, moved: 0, id: ev.pointerId };
  };

  private onUp = (ev: PointerEvent): void => {
    if (!this.drag.on) return;
    const moved = this.drag.moved;
    this.drag.on = false;
    if (moved > 8 || ev.type === 'pointercancel') return;
    this.setNdc(ev);
    const action = this.ctx.cabin.pick(this.ndc);
    if (!action) return;
    if ((STATIONS as string[]).includes(action)) {
      if (action !== this.station) this.open(action as Station);
      return;
    }
    if (action === 'record') {
      const on = audio.musicKey !== 'cabin';
      if (on) audio.playMusic('cabin'); else audio.stopMusic(0.6);
      this.ctx.cabin.toggleRecord(on);
      audio.sfx('scratch');
      return;
    }
    if (action === 'lamp') { audio.sfx('click'); this.ctx.cabin.frog.play('shock'); return; }
    this.ctx.cabin.poke(action);
  };

  private onKey = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape' && this.station !== 'home' && !(ev.target instanceof HTMLInputElement)) this.back();
  };

  // ───────────────────────── play ─────────────────────────

  private playPanel(): HTMLElement {
    const net = this.ctx.net;
    const online = net.online;
    const code = h('input', { class: 'input code-input', maxlength: 4, placeholder: 'CODE', autocapitalize: 'characters', autocomplete: 'off', spellcheck: false, 'aria-label': 'Party code' }) as HTMLInputElement;
    code.addEventListener('input', () => { code.value = code.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
    const join = () => {
      const c = code.value.trim().toUpperCase();
      if (c.length !== 4) { this.ctx.hud.toast('Party codes are 4 letters.'); return; }
      audio.sfx('pop');
      net.send({ t: 'join', code: c, session: net.sessionFor(c) });
    };
    code.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
    const rooms = this.rooms.filter((r) => r.code !== store.room?.code);
    return h('div', { class: 'col' },
      !online ? h('div', { class: 'note bad' }, '📡 Not connected to the game server — reconnecting… You can still try the tutorial offline.') : null,
      h('p', { class: 'tiny' }, 'Host a party and share the code or QR — friends join from any phone or computer, no download. 2–12 frogs.'),
      store.room
        ? h('button', { class: 'btn gold', onclick: () => this.ctx.backToParty() }, `🐸 Return to party ${store.room.code}`)
        : h('button', { class: 'btn gold', disabled: !online, onclick: () => { audio.sfx('go'); net.send({ t: 'create', settings: { isPublic: false } }); } }, '🎉 Host a party'),
      h('div', { class: 'row' }, code, h('button', { class: 'btn', disabled: !online, onclick: join }, 'Join')),
      h('div', { class: 'row' },
        h('button', { class: 'btn wood small grow', disabled: !online, onclick: () => { audio.sfx('pop'); net.send({ t: 'quick' }); } }, '⚡ Quick match'),
        h('button', { class: 'btn wood small grow', disabled: !online, onclick: () => { audio.sfx('pop'); this.pendingBots = 3; net.send({ t: 'create', settings: { isPublic: false } }); } }, '🤖 Practice vs bots')),
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', null, 'Open lobbies'), h('button', { class: 'chip', onclick: () => net.send({ t: 'rooms' }) }, '↻ refresh')),
      rooms.length
        ? h('div', { class: 'col room-list', style: { gap: '4px' } }, ...rooms.map((r) => h('div', { class: 'player-row' },
          h('b', null, r.code),
          h('span', { class: 'grow' }, `${r.host}'s party · ${MAP_BY_ID[r.map]?.name ?? ''}`),
          h('span', null, `${r.players}/${r.max}`),
          h('button', { class: 'chip on', disabled: r.players >= r.max, onclick: () => net.send({ t: 'join', code: r.code }) }, r.phase === 'lobby' ? 'Join' : 'Watch & join'))))
        : h('div', { class: 'tiny' }, 'No public lobbies right now. Quick match opens one that others can find.'),
      h('button', { class: 'btn wood small', onclick: () => this.open('tutorial') }, '🎓 New here? DJ Lilypadd\'s quick tutorial'));
  }

  private tutorialPanel(): HTMLElement {
    const done = store.profile?.tutorialDone;
    return h('div', { class: 'col' },
      h('p', null, 'DJ Lilypadd teaches the whole game in a couple of quick rounds: voting with your glove cursor, a real song clip, finishing lyrics, the chalkboard, and what happens to the last-place frog…'),
      h('p', { class: 'tiny' }, 'It runs right here in your browser against practice bots — no server or internet needed.'),
      h('button', { class: 'btn gold', onclick: () => { audio.sfx('go'); this.ctx.startTutorial(); } }, done ? '🎓 Replay the tutorial' : '🎓 Start the tutorial (+100 🪙)'));
  }
}

const coverCache = new Map<string, THREE.Texture>();

function coverTexture(id: string, title: string, cover?: CoverSpec): THREE.Texture {
  let t = coverCache.get(id);
  if (!t) {
    const img = new Image();
    t = new THREE.Texture(img);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    const tex = t;
    img.onload = () => { tex.needsUpdate = true; };
    img.src = recordCoverUrl(id, title, cover, 2);
    coverCache.set(id, t);
  }
  return t;
}

function toggleFullscreen(): void {
  audio.sfx('click');
  const d = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  if (document.fullscreenElement || d.webkitFullscreenElement) (document.exitFullscreen?.bind(document) ?? d.webkitExitFullscreen)?.();
  else (el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen)?.();
}
