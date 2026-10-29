// Binds authoritative room snapshots to the clubhouse scene and HUD, and turns pointer input into
// cursor/vote/answer messages. One instance lives for the whole session.

import * as THREE from 'three';
import { CATEGORY_BY_ID, EMOTE_BY_ID, MAP_BY_ID, MAPS, MINIGAME_BY_ID, PLAYER_COLORS, SOCIAL_BY_ID, type MapId } from '../../shared/catalog';
import { ringAngle } from '../../shared/board';
import { COSMETIC_BY_ID } from '../../shared/cosmetics';
import { wagerOptions } from '../../shared/game/scoring';
import { ACHIEVEMENT_BY_ID } from '../../shared/progression';
import { beatsToSec } from '../../shared/music';
import type { Phase, PlayerPublic, PublicQuestion, RoomFx, RoomSnapshot, RoomSettings } from '../../shared/protocol';
import { coverUrl, gloveUrl } from '../art/icons';
import { audio, type ClipHandle } from '../audio/AudioEngine';
import type { Transport } from '../net/Net';
import type { PixelRenderer } from '../render/PixelRenderer';
import type { Clubhouse } from '../scenes/clubhouse/Clubhouse';
import { TABLE_Y } from '../scenes/clubhouse/Clubhouse';
import { pixelatedCoverTexture, type BoardKind, type BoardOption } from '../scenes/clubhouse/Board';
import { store } from '../state';
import { clear, fmt, h } from '../ui/dom';
import type { Anchor, Hud } from '../ui/Hud';
import { Finale } from './Finale';
import { lobbyUi } from './lobby';
import { emoteBar, LilyTimer, titleCard, typewriter } from './widgets';

interface RemoteCursor {
  el: HTMLElement;
  u: number;
  v: number;
  tu: number;
  tv: number;
  down: boolean;
  seen: number;
}

export interface GameCtx {
  hud: Hud;
  net: Transport;
  scene: Clubhouse;
  pixel: PixelRenderer;
  canvas: HTMLCanvasElement;
  leave(): void;
  openCabin(): void;
}

const LEAD_IN = 0.9;

export class GameView {
  private ctx: GameCtx;
  private snap: RoomSnapshot | null = null;
  private phaseKey = '';
  private phaseEl: HTMLElement;
  private timer = new LilyTimer();
  private tags = new Map<string, Anchor>();
  private optAnchors = new Map<string, Anchor>();
  private speech: Anchor | null = null;
  private cursors = new Map<string, RemoteCursor>();
  private myCursor = { u: 0.5, v: 0.5, down: false, el: null as HTMLElement | null, lastSend: 0, sx: -1, sy: -1, onBoard: false };
  private clips: ClipHandle[] = [];
  private timers: number[] = [];
  private emotes: HTMLElement | null = null;
  private myChoice: string | null = null;
  private finale: Finale;
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(TABLE_Y + 0.1));
  private lyricEls: HTMLElement[] = [];
  private lyricTimes: number[] = [];
  private stagePills: HTMLElement[] = [];
  private stageTimes: number[] = [];
  private coverImg: HTMLImageElement | null = null;
  private questionStart = 0;
  private attached = false;
  private lastTickSfx = -1;
  private sabotageEl: HTMLElement | null = null;
  private unsub: (() => void)[] = [];

  constructor(ctx: GameCtx) {
    this.ctx = ctx;
    this.phaseEl = h('div', { class: 'layer' });
    this.finale = new Finale(ctx.scene, ctx.hud, (text, ms) => this.djSay(text, ms));
    this.timer.onTick = (s) => {
      if (this.snap?.phase.id === 'question' && s <= 5 && s !== this.lastTickSfx) {
        this.lastTickSfx = s;
        audio.sfx(s <= 3 ? 'tickHurry' : 'tick');
      }
    };
  }

  // ───────────────────────── lifecycle ─────────────────────────

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.ctx.hud.phaseLayer.appendChild(this.phaseEl);
    const c = this.ctx.canvas;
    c.addEventListener('pointermove', this.onPointerMove);
    c.addEventListener('pointerdown', this.onPointerDown);
    c.addEventListener('pointerup', this.onPointerUp);
    c.addEventListener('pointerleave', this.onPointerLeave);
    const net = this.ctx.net;
    this.unsub.push(
      net.on('cur', (m) => this.onCursors(m.c)),
      net.on('fx', (m) => this.onFx(m.fx)),
    );
    const me = h('div', { class: 'cursor me' }, h('img', { src: gloveUrl('#ffffff') }));
    this.myCursor.el = me;
    this.ctx.hud.cursorLayer.appendChild(me);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    this.clearPhase();
    this.phaseEl.remove();
    const c = this.ctx.canvas;
    c.removeEventListener('pointermove', this.onPointerMove);
    c.removeEventListener('pointerdown', this.onPointerDown);
    c.removeEventListener('pointerup', this.onPointerUp);
    c.removeEventListener('pointerleave', this.onPointerLeave);
    for (const u of this.unsub) u();
    this.unsub = [];
    for (const a of this.tags.values()) this.ctx.hud.unanchor(a);
    this.tags.clear();
    for (const cur of this.cursors.values()) cur.el.remove();
    this.cursors.clear();
    this.myCursor.el?.remove();
    this.myCursor.el = null;
    this.emotes?.remove();
    this.emotes = null;
    this.snap = null;
    this.phaseKey = '';
    this.finale.stop();
  }

  // ───────────────────────── server events ─────────────────────────

  onRoom(s: RoomSnapshot): void {
    const prev = this.snap;
    this.snap = s;
    const scene = this.ctx.scene;
    scene.myId = s.you.id;
    if (s.phase.id === 'lobby' || s.phase.id === 'intro' || s.phase.id === 'map_vote') {
      if (s.map !== scene.mapId && s.phase.id !== 'map_vote') scene.setMap(s.map);
    }
    scene.syncPlayers(s.players);
    this.syncTags(s);
    this.syncEmoteBar(s);
    const key = `${s.phase.id}:${s.phaseStart}`;
    if (key !== this.phaseKey) {
      this.phaseKey = key;
      this.enterPhase(s, prev);
    } else {
      this.refreshPhase(s);
    }
  }

  private onCursors(list: [string, number, number, number][]): void {
    const s = this.snap;
    if (!s) return;
    const now = performance.now();
    for (const [id, u, v, d] of list) {
      if (id === s.you.id) continue;
      let c = this.cursors.get(id);
      const p = s.players.find((x) => x.id === id);
      if (!p) continue;
      if (!c) {
        const color = PLAYER_COLORS[p.color % PLAYER_COLORS.length];
        const el = h('div', { class: 'cursor' }, h('img', { src: gloveUrl(color) }), h('span', { class: 'who', style: { background: color } }, p.name));
        this.ctx.hud.cursorLayer.appendChild(el);
        c = { el, u, v, tu: u, tv: v, down: false, seen: now };
        this.cursors.set(id, c);
      }
      c.tu = u;
      c.tv = v;
      c.seen = now;
      const down = d === 1;
      if (down !== c.down) {
        c.down = down;
        c.el.classList.toggle('down', down);
        if (down) audio.sfx('click', { vol: 0.4 });
      }
    }
  }

  private onFx(fx: RoomFx): void {
    const scene = this.ctx.scene;
    switch (fx.k) {
      case 'emote': {
        const e = EMOTE_BY_ID[fx.e];
        const actor = scene.actorOf(fx.p);
        if (!e || !actor) return;
        actor.play(e.anim, true);
        audio.sfx(e.sfx, { pitch: 0.9 + Math.random() * 0.2, vol: 0.8 });
        const pop = h('div', { class: 'emote-pop' }, e.icon);
        const a = this.ctx.hud.anchor(pop, () => actor.headPos().add(new THREE.Vector3(0, 0.3, 0)));
        window.setTimeout(() => this.ctx.hud.unanchor(a), 1700);
        break;
      }
      case 'event':
        scene.randomEvent(fx.e, fx.p, fx.seed);
        if (fx.e === 'dj_zap' || fx.e === 'mic_swallow') this.djSay(fx.e === 'dj_zap' ? 'BZZZT! ...I\'m fine. Totally fine.' : '*gulp* ...anyone seen my mic?', 2600);
        break;
      case 'locked':
        if (this.snap?.phase.id === 'question') audio.sfx('lock', { vol: 0.35, pitch: 1.2 });
        break;
      case 'join':
        audio.sfx('ribbit', { pitch: 1.1 });
        break;
      case 'leave':
        audio.sfx('poof');
        break;
      case 'host':
        if (this.snap && fx.p === this.snap.you.id && this.snap.phase.id !== 'lobby') this.ctx.hud.toast('👑 You are now the host!');
        break;
      case 'toast':
        this.ctx.hud.toast(fx.text);
        break;
      case 'hint':
      case 'stage':
        break;
    }
  }

  // ───────────────────────── nametags, emotes ─────────────────────────

  private syncTags(s: RoomSnapshot): void {
    const hud = this.ctx.hud;
    const ids = new Set(s.players.map((p) => p.id));
    for (const [id, a] of this.tags) if (!ids.has(id)) { hud.unanchor(a); this.tags.delete(id); }
    const showScore = s.phase.id !== 'lobby';
    for (const p of s.players) {
      let a = this.tags.get(p.id);
      if (!a) {
        const el = h('div', { class: 'nametag' });
        a = hud.anchor(el, () => this.ctx.scene.headWorld(p.id), [0, -8]);
        this.tags.set(p.id, a);
      }
      const el = a.el;
      el.className = `anchor nametag${p.id === s.you.id ? ' me' : ''}${p.isHost ? ' host' : ''}${p.connected || p.isBot ? '' : ' off'}`;
      el.style.borderColor = PLAYER_COLORS[p.color % PLAYER_COLORS.length];
      clear(el);
      el.append(h('span', { class: 'lvl' }, `L${p.level}`), p.name);
      if (s.phase.id === 'question' && p.locked) el.append(h('span', { class: 'lock' }, '✔'));
      if (s.phase.id === 'lobby' && p.ready && !p.isBot) el.append(h('span', { class: 'lock' }, '✔'));
      if (showScore) el.append(h('span', { class: 'score' }, `${fmt(p.score)} pts${p.streak >= 2 ? ` 🔥${p.streak}` : ''}`));
    }
  }

  private syncEmoteBar(s: RoomSnapshot): void {
    const me = s.players.find((p) => p.id === s.you.id);
    if (!me) return;
    const key = me.outfit.emotes.join(',');
    if (this.emotes && this.emotes.dataset.key === key) return;
    this.emotes?.remove();
    this.emotes = emoteBar(me.outfit.emotes, (id) => {
      audio.unlock();
      this.ctx.net.send({ t: 'emote', id });
    });
    this.emotes.dataset.key = key;
    this.ctx.hud.topLayer.appendChild(this.emotes);
  }

  djSay(text: string, ms = 3200): void {
    const hud = this.ctx.hud;
    if (this.speech) hud.unanchor(this.speech);
    const body = h('span');
    const el = h('div', { class: 'speech bubble' }, h('span', { class: 'who' }, 'DJ LILYPADD'), body);
    const a = hud.anchor(el, () => this.ctx.scene.djHead().add(new THREE.Vector3(0, 0.25, 0)), [0, -6], false);
    this.speech = a;
    typewriter(body, text);
    audio.babble(text, 0.9);
    const dj = this.ctx.scene.dj;
    let flap = 0;
    const talk = window.setInterval(() => { dj.model.setMouth(flap++ % 2 ? 'open' : 'base'); }, 110);
    window.setTimeout(() => { window.clearInterval(talk); dj.model.setMouth('base'); }, Math.min(ms, text.length * 30 + 300));
    window.setTimeout(() => { if (this.speech === a) { hud.unanchor(a); this.speech = null; } }, ms);
  }

  // ───────────────────────── phases ─────────────────────────

  private clearPhase(): void {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
    for (const c of this.clips) c.stop();
    this.clips = [];
    clear(this.phaseEl);
    for (const a of this.optAnchors.values()) this.ctx.hud.unanchor(a);
    this.optAnchors.clear();
    this.ctx.scene.board.clear();
    this.ctx.scene.setPond(false);
    this.ctx.scene.showBottle(false);
    this.lyricEls = [];
    this.stagePills = [];
    this.coverImg = null;
    this.sabotageEl?.remove();
    this.sabotageEl = null;
    this.myChoice = null;
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private aspect(): number {
    return this.ctx.pixel.width / Math.max(1, this.ctx.pixel.height);
  }

  private shot(name: string, dur = 1.2, id?: string): void {
    const sc = this.ctx.scene;
    sc.rig.go(sc.shot(name, { aspect: this.aspect(), id }), dur);
  }

  private player(id: string): PlayerPublic | undefined {
    return this.snap?.players.find((p) => p.id === id);
  }

  private localMs(serverMs: number): number {
    return serverMs - this.ctx.net.serverNow() + Date.now();
  }

  private enterPhase(s: RoomSnapshot, prev: RoomSnapshot | null): void {
    const prevPhase = prev?.phase;
    this.clearPhase();
    const ph = s.phase;
    const scene = this.ctx.scene;
    if (ph.id !== 'finale') this.finale.stop();
    if (ph.id !== 'question') audio.duck(1);
    const top = this.phaseEl;
    const roundPill = () => (s.round > 0 ? top.appendChild(h('div', { class: 'round-pill wood dark' }, `ROUND ${s.round}/${s.totalRounds}`)) : null);

    switch (ph.id) {
      case 'lobby': {
        scene.setMap(s.map);
        scene.setDark(0);
        scene.spotlightOn(null);
        scene.throne.visible = false;
        for (const seat of scene.seats.values()) seat.actor.toToad(false);
        this.shot('overview', 1.6);
        top.appendChild(lobbyUi(s, this.ctx));
        this.chalkLobby(s);
        audio.playMusic(this.mapMusic(s.map));
        break;
      }
      case 'intro': {
        this.shot('dj', 1.2);
        this.djSay(ph.line, 4200);
        scene.chalk.clear();
        scene.chalk.write(`TONIGHT: ${s.players.length} FROGS`, 256, 90, { size: 34, align: 'center' });
        scene.chalk.write(`${s.totalRounds} ROUNDS`, 256, 150, { size: 30, align: 'center', delay: 1 });
        scene.chalk.write('LOWEST SCORE = TOAD', 256, 210, { size: 26, align: 'center', delay: 2, color: '#ffb0b0' });
        audio.playMusic(this.mapMusic(s.map));
        this.later(2600, () => this.shot('overview', 1.4));
        break;
      }
      case 'map_vote': {
        this.shot('bottle', 1.3);
        scene.showBottle(true);
        const opts: BoardOption[] = ph.options.map((o) => ({ id: o.id, label: o.label, sub: o.sub, color: o.color, map: o.id }));
        this.setBoard('maps', opts);
        top.appendChild(h('div', { class: 'banner wood' }, h('div', { class: 'tag' }, 'MAP VOTE'), 'Point your glove at a map!', h('div', { class: 'sub' }, 'The bottle decides — more votes = better odds')));
        top.appendChild(this.timer.el);
        this.djSay('Where are we partying tonight? Vote and I\'ll spin the bottle!', 3500);
        break;
      }
      case 'map_reveal': {
        scene.showBottle(true);
        const opts: BoardOption[] = ph.options.map((o) => ({ id: o.id, label: o.label, sub: o.sub, color: o.color, map: o.id }));
        this.setBoard('maps', opts);
        const idx = ph.options.findIndex((o) => o.id === ph.winner);
        scene.spinBottleTo(ringAngle(idx, ph.options.length), ph.spins, 4.2);
        audio.sfx('drumroll');
        this.later(4300, () => {
          audio.sfx('crash');
          scene.board.setAllStates((id) => (id === ph.winner ? 'winner' : 'dim'));
          scene.particles.frogFx('confetti', scene.board.itemWorld(ph.winner, 0.6) ?? new THREE.Vector3(), 50);
          top.appendChild(titleCard(MAP_BY_ID[ph.winner]?.name.toUpperCase() ?? ph.winner, MAP_BY_ID[ph.winner]?.blurb));
        });
        this.later(5600, () => {
          void this.ctx.hud.iris(() => {
            scene.setMap(ph.winner as MapId);
            scene.showBottle(false);
            scene.board.clear();
            this.clearOptLabels();
            this.ctx.scene.rig.cut(scene.shot('wide', { aspect: this.aspect() }));
            audio.playMusic(this.mapMusic(ph.winner as MapId));
          });
        });
        break;
      }
      case 'round_intro':
      case 'final_intro': {
        const final = ph.id === 'final_intro';
        const social = ph.id === 'round_intro' ? ph.social : null;
        this.shot(final ? 'dj' : 'overview', 1.2);
        top.appendChild(titleCard(final ? 'FINAL ROUND' : `ROUND ${s.round}`, final ? (s.settings.finalDouble ? 'DOUBLE POINTS. Everything is at stake.' : 'Everything is at stake.') : social ? `Social round: ${SOCIAL_BY_ID[social].name}` : `of ${s.totalRounds}`));
        audio.sfx(final ? 'gong' : 'whoosh');
        if (final) { this.djSay('Final round! Somebody here is about to become a TOAD...', 4000); audio.playMusic('drama'); }
        scene.chalk.clear();
        scene.chalk.write(final ? 'FINAL ROUND!' : `ROUND ${s.round}`, 256, 120, { size: 52, align: 'center' });
        if (social) scene.chalk.write(SOCIAL_BY_ID[social].name.toUpperCase(), 256, 190, { size: 26, align: 'center', delay: 0.8, color: '#ffe245' });
        this.reactNervous(s);
        break;
      }
      case 'category_vote': {
        this.shot('board', 1.2);
        const opts: BoardOption[] = ph.options.map((o) => ({ id: o.id, label: o.label, sub: o.sub, color: o.color, art: o.art }));
        this.setBoard('categories', opts);
        top.appendChild(h('div', { class: 'banner wood' }, h('div', { class: 'tag' }, `ROUND ${s.round}`), 'Vote for a category!', h('div', { class: 'sub' }, 'Move your glove onto a card — you can change your mind until time runs out')));
        top.appendChild(this.timer.el);
        roundPill();
        if (s.map && audio.musicKey === 'drama') audio.playMusic(this.mapMusic(s.map));
        break;
      }
      case 'category_reveal': {
        const opts: BoardOption[] = ph.options.map((o) => ({ id: o.id, label: o.label, sub: o.sub, color: o.color, art: o.art }));
        this.setBoard('categories', opts);
        audio.sfx('drumroll');
        audio.duck(0.4);
        this.later(1700, () => {
          audio.sfx('crash');
          audio.duck(1);
          scene.board.setAllStates((id) => (id === ph.winner ? 'winner' : 'dim'));
          const w = scene.board.itemWorld(ph.winner, 0.5);
          if (w) {
            scene.particles.frogFx('confetti', w, 60);
            scene.particles.emit('bubble', w, 20, { color: '#c8f0ff', speed: 1, gravity: 0.6, life: 2, size: 0.12, wobble: 1 });
            scene.rig.go({ pos: w.clone().add(new THREE.Vector3(0, 3, 3.2)), target: w, fov: 38 }, 0.8);
            scene.rig.addShake(0.2);
          }
          const win = ph.options.find((o) => o.id === ph.winner);
          top.appendChild(h('div', { class: 'banner wood' }, h('div', { class: 'tag' }, ph.tie ? 'TIE BREAKER!' : 'THE FROGS HAVE SPOKEN'), win?.label ?? ''));
          for (const seat of scene.seats.values()) {
            const voted = ph.votes[seat.player.id];
            if (voted === ph.winner) seat.actor.play('cheer');
            else if (voted) seat.actor.play(Math.random() < 0.5 ? 'facepalm' : 'shrug');
          }
        });
        break;
      }
      case 'minigame_intro': {
        const mg = MINIGAME_BY_ID[ph.minigame];
        this.shot('dj', 1.1);
        const extra = h('div', { class: 'paper card', style: { marginTop: '10px', fontSize: '16px' } }, mg.howTo, ph.note ? h('div', { class: 'tiny', style: { marginTop: '6px' } }, `📜 ${ph.note}`) : null);
        top.appendChild(titleCard(mg.name.toUpperCase(), `${ph.topic}${ph.social ? ` · ${SOCIAL_BY_ID[ph.social].name}` : ''}`, extra));
        this.djSay(ph.social ? SOCIAL_BY_ID[ph.social].dj : mg.dj, 4200);
        audio.sfx(mg.audio === 'required' ? 'scratch' : 'whoosh');
        if (mg.board === 'tv') scene.setTv(true, ph.topic);
        else scene.setTv(false);
        roundPill();
        break;
      }
      case 'social_setup':
        this.enterSocial(s, ph);
        roundPill();
        break;
      case 'question':
        this.enterQuestion(s, ph.q, ph.sabotaged);
        roundPill();
        break;
      case 'question_reveal':
        this.enterReveal(s, ph, prevPhase);
        roundPill();
        break;
      case 'scoreboard':
        this.enterScoreboard(s, ph);
        roundPill();
        scene.setTv(false);
        break;
      case 'finale':
        scene.setTv(false);
        this.finale.run(s, ph, (key) => audio.playMusic(key, key !== 'victory'));
        break;
      case 'rewards':
        this.enterRewards(s, ph);
        break;
      case 'rematch_vote': {
        this.shot('board', 1.4);
        const opts: BoardOption[] = ph.options.map((o) => ({ id: o.id, label: o.label, sub: o.sub, color: o.color, art: o.art }));
        this.setBoard('cards', opts);
        top.appendChild(h('div', { class: 'banner wood' }, h('div', { class: 'tag' }, 'GG!'), 'What next?', h('div', { class: 'sub' }, 'Vote with your glove')));
        top.appendChild(this.timer.el);
        top.appendChild(h('div', { class: 'lobby-actions' }, h('button', { class: 'btn wood small', onclick: () => this.ctx.leave() }, '🚪 Leave party')));
        audio.playMusic(this.mapMusic(s.map));
        break;
      }
    }
  }

  private refreshPhase(s: RoomSnapshot): void {
    const ph = s.phase;
    if (ph.id === 'lobby') {
      const el = lobbyUi(s, this.ctx);
      if (el.parentElement !== this.phaseEl) { clear(this.phaseEl); this.phaseEl.appendChild(el); }
      this.chalkLobby(s);
      if (s.map !== this.ctx.scene.mapId) this.ctx.scene.setMap(s.map);
    }
    if (ph.id === 'question') this.refreshQuestion(s, ph.q);
    if (ph.id === 'social_setup') this.refreshSocial(s, ph);
  }

  private mapMusic(map: MapId): string {
    return { swamp_clubhouse: 'swamp', mushroom_tavern: 'tavern', rainy_cabin: 'rain', lilypad_disco: 'disco', frog_arcade: 'arcade', moonlit_pond: 'moon' }[map] ?? 'lobby';
  }

  private chalkLobby(s: RoomSnapshot): void {
    const ch = this.ctx.scene.chalk;
    const sig = `${s.code}:${s.players.length}`;
    if ((ch as unknown as { sig?: string }).sig === sig) return;
    (ch as unknown as { sig?: string }).sig = sig;
    ch.clear();
    ch.write('PARTY CODE', 256, 60, { size: 28, align: 'center', instant: true });
    ch.write(s.code, 256, 130, { size: 76, align: 'center', speed: 6 });
    ch.write(`${s.players.length}/${s.settings.maxPlayers} FROGS`, 256, 210, { size: 26, align: 'center', delay: 0.6 });
  }

  private reactNervous(s: RoomSnapshot): void {
    for (const p of s.players) {
      if (p.nervous > 0.6) this.ctx.scene.actorOf(p.id)?.play('gasp');
    }
  }

  // ───────────────────────── board & labels ─────────────────────────

  private clearOptLabels(): void {
    for (const a of this.optAnchors.values()) this.ctx.hud.unanchor(a);
    this.optAnchors.clear();
  }

  private setBoard(kind: BoardKind, opts: BoardOption[]): void {
    const scene = this.ctx.scene;
    scene.board.set(kind, opts);
    scene.setPond(kind === 'lilypads');
    this.clearOptLabels();
    if (kind === 'lilypads') audio.sfx('splash');
    for (const o of opts) {
      const label = h('div', { class: 'optlabel' }, o.label, o.sub && kind !== 'maps' ? h('span', { class: 'sub' }, o.sub) : null, h('span', { class: 'voters' }));
      const a = this.ctx.hud.anchor(label, () => scene.board.itemWorld(o.id, kind === 'categories' || kind === 'cards' ? 0.15 : 0.3), [0, kind === 'categories' ? 34 : 0]);
      this.optAnchors.set(o.id, a);
    }
  }

  private votesFor(s: RoomSnapshot): Record<string, string> {
    const ph = s.phase;
    if (ph.id === 'category_vote' || ph.id === 'map_vote' || ph.id === 'rematch_vote' || ph.id === 'category_reveal' || ph.id === 'map_reveal') return ph.votes;
    if (ph.id === 'social_setup') return ph.picks;
    return {};
  }

  private updateVoterDots(s: RoomSnapshot): Map<string, string[]> {
    const votes = this.votesFor(s);
    const byOpt = new Map<string, string[]>();
    for (const [pid, opt] of Object.entries(votes)) {
      const p = s.players.find((x) => x.id === pid);
      if (!p) continue;
      const list = byOpt.get(opt) ?? [];
      list.push(PLAYER_COLORS[p.color % PLAYER_COLORS.length]);
      byOpt.set(opt, list);
    }
    for (const [id, a] of this.optAnchors) {
      const dots = a.el.querySelector('.voters');
      if (!dots) continue;
      const cols = byOpt.get(id) ?? [];
      const sig = cols.join(',');
      if ((dots as HTMLElement).dataset.sig !== sig) {
        (dots as HTMLElement).dataset.sig = sig;
        clear(dots);
        for (const c of cols) dots.appendChild(h('i', { style: { background: c } }));
        if (cols.length) audio.sfx('pop', { pitch: 1.4, vol: 0.3 });
      }
      a.el.classList.toggle('mine', votes[s.you.id] === id || this.myChoice === id);
    }
    return byOpt;
  }

  // ───────────────────────── social rounds ─────────────────────────

  private enterSocial(s: RoomSnapshot, ph: Extract<Phase, { id: 'social_setup' }>): void {
    const top = this.phaseEl;
    const def = SOCIAL_BY_ID[ph.social];
    top.appendChild(this.timer.el);
    const me = s.you.id;
    this.shot('board', 1.1);
    if (ph.social === 'wager') {
      const myScore = s.players.find((p) => p.id === me)?.score ?? 0;
      const opts = wagerOptions(myScore).map((w, i, arr) => ({ id: `w${w}`, label: w === 0 ? 'No bet' : i === arr.length - 1 && arr.length > 3 ? `ALL IN (${w})` : `${w} pts`, color: ['#9aa0b8', '#6fe05a', '#ffd23a', '#ff5d5d'][i] ?? '#ffffff' }));
      this.setBoard('wagers', opts);
      top.appendChild(h('div', { class: 'banner wood' }, h('div', { class: 'tag' }, def.name.toUpperCase()), 'How much will you wager?', h('div', { class: 'sub' }, 'Right answer = win it. Wrong answer = lose it.')));
    } else if (ph.social === 'duel' && ph.chooser !== me) {
      const chooser = this.player(ph.chooser ?? '');
      top.appendChild(h('div', { class: 'banner wood' }, h('div', { class: 'tag' }, 'FROG DUEL'), `${chooser?.name ?? 'Someone'} is picking an opponent...`, h('div', { class: 'sub' }, 'The lowest frog gets to throw down the gauntlet')));
      if (ph.chooser) this.shot('player', 1, ph.chooser);
    } else {
      const others = ph.targets.filter((t) => t !== me).map((id) => {
        const p = this.player(id)!;
        return { id, label: p?.name ?? '?', sub: `${fmt(p?.score ?? 0)} pts`, color: PLAYER_COLORS[(p?.color ?? 0) % PLAYER_COLORS.length] };
      });
      if (ph.social === 'sabotage') others.push({ id: 'none', label: 'Nobody (be nice)', sub: '', color: '#ffffff' });
      this.setBoard('players', others);
      const prompt = ph.social === 'duel' ? 'Challenge a frog to a duel!' : ph.social === 'predict' ? 'Who will get the next question WRONG?' : 'Secretly pick a frog to sabotage!';
      top.appendChild(h('div', { class: 'banner wood' }, h('div', { class: 'tag' }, def.name.toUpperCase()), prompt, h('div', { class: 'sub' }, def.blurb)));
    }
    this.refreshSocial(s, ph);
  }

  private refreshSocial(s: RoomSnapshot, ph: Extract<Phase, { id: 'social_setup' }>): void {
    const mine = ph.picks[s.you.id] ?? (s.you.wager !== undefined ? `w${s.you.wager}` : null);
    this.myChoice = mine;
  }

  // ───────────────────────── questions ─────────────────────────

  private enterQuestion(s: RoomSnapshot, q: PublicQuestion, sabotaged: string[]): void {
    const scene = this.ctx.scene;
    const top = this.phaseEl;
    const mg = MINIGAME_BY_ID[q.minigame];
    this.questionStart = this.localMs(q.startAt);
    this.lastTickSfx = -1;
    const boardKind: BoardKind = q.board === 'tv' || q.board === 'chalk' ? 'cards' : q.board;
    if (q.input === 'choice' && q.choices) {
      this.setBoard(q.minigame === 'higher_lower' ? 'arrows' : boardKind, q.choices.map((c) => ({ id: c.id, label: c.label, sub: c.sub, cover: c.cover })));
      this.shot('board', 1);
    } else {
      this.shot('chalk', 1);
    }
    // Banner prompt + chalkboard projection.
    top.appendChild(h('div', { class: 'banner wood' },
      h('div', { class: 'tag' }, `${mg.name.toUpperCase()} · ${q.index}/${q.total}${q.multiplier > 1 ? ' · ×2' : ''}`),
      q.prompt,
      q.sub ? h('div', { class: 'sub' }, q.sub) : null));
    scene.chalk.clear();
    wrapChalk(scene, q.prompt);
    top.appendChild(this.timer.el);
    const av = h('div', { class: `availability ${q.availability.playable ? '' : 'meta'}` }, h('b', null, q.availability.playable ? '🔊 ' + q.availability.label : '📜 ' + q.availability.label), ' — ', q.availability.detail);
    top.appendChild(av);

    // Media.
    const media = h('div', { class: 'media-center passthrough' });
    if (q.emoji) media.appendChild(h('div', { class: 'emoji-big' }, q.emoji));
    if (q.cover) {
      const img = h('img', { class: 'cover-reveal' });
      this.coverImg = img;
      img.src = pixelUrl(q.cover, 16);
      media.appendChild(img);
    }
    if (media.childElementCount) top.appendChild(media);
    if (q.hints) top.appendChild(this.hintBox(q));
    if (q.lyrics && q.audio?.clip) {
      const box = h('div', { class: 'lyrics chalk passthrough' });
      const beats = q.lyricBeats ?? [];
      this.lyricEls = q.lyrics.map((l, i) => h('div', { class: `line${i === q.lyrics!.length - 1 ? ' blank' : ''}` }, i === q.lyrics!.length - 1 ? l : l));
      this.lyricTimes = beats.map((b) => this.questionStart + (0.3 + beatsToSec(b, q.audio!.clip!.bpm)) * 1000);
      this.lyricEls.forEach((e, i) => { if (i < this.lyricEls.length - 1) e.style.opacity = '0.25'; else e.style.opacity = '0'; box.appendChild(e); });
      top.appendChild(box);
    }
    if (q.audio?.stages && q.audio.stages.length > 2) {
      const row = h('div', { class: 'row center', style: { position: 'absolute', top: '120px', left: '50%', transform: 'translateX(-50%)', gap: '6px' } });
      let t = LEAD_IN;
      this.stageTimes = [];
      this.stagePills = q.audio.stages.map((len, i) => {
        this.stageTimes.push(this.questionStart + t * 1000);
        t += len + (q.audio!.stageGap ?? 1.1);
        return row.appendChild(h('span', { class: 'chip', style: { fontSize: '14px' } }, `${len}s · ${[100, 85, 70, 55, 42][i] ?? 40}%`));
      });
      top.appendChild(row);
    }
    // Inputs.
    if (q.input === 'year') top.appendChild(this.yearDial(q));
    if (q.input === 'text') top.appendChild(this.textInput(q));
    // Audio.
    this.playQuestionAudio(q);
    // Sabotage visuals for the victim (harmless and fair: they just get in the way a bit).
    if (s.you.sabotagedBy || sabotaged.includes(s.you.id)) this.startSabotage();
    for (const id of sabotaged) {
      const a = scene.actorOf(id);
      if (a) scene.particles.frogFx('stars', a.headPos(), 4);
    }
    if (!q.audio) audio.playMusic('think');
    this.refreshQuestion(s, q);
  }

  private hintBox(q: PublicQuestion): HTMLElement {
    const list = h('ul', { style: { paddingLeft: '18px', margin: '4px 0' } });
    const box = h('div', { class: 'hints chalk passthrough' }, h('div', { style: { fontFamily: 'var(--title-font)', fontSize: '13px', color: 'var(--gold)' } }, q.hintTitle ?? 'HINTS'), list);
    box.dataset.hints = '';
    const render = (hints: string[]) => {
      if (box.dataset.hints === hints.join('|')) return;
      box.dataset.hints = hints.join('|');
      clear(list);
      hints.forEach((t) => list.appendChild(h('li', null, t)));
      audio.sfx('chalkwrite');
    };
    render(q.hints ?? []);
    (box as unknown as { render: typeof render }).render = render;
    return box;
  }

  private refreshQuestion(s: RoomSnapshot, q: PublicQuestion): void {
    const box = this.phaseEl.querySelector('.hints') as (HTMLElement & { render?: (h: string[]) => void }) | null;
    box?.render?.(q.hints ?? []);
    const answer = s.you.answer;
    if (answer !== undefined && answer !== null) this.myChoice = typeof answer === 'string' ? answer : String(answer);
  }

  private yearDial(q: PublicQuestion): HTMLElement {
    const [lo, hi] = q.yearRange ?? [1950, 2025];
    const mid = Math.round((lo + hi) / 2);
    const yr = h('div', { class: 'yr' }, String(mid));
    const range = h('input', { type: 'range', min: String(lo), max: String(hi), value: String(mid) }) as HTMLInputElement;
    range.addEventListener('input', () => { yr.textContent = range.value; audio.sfx('tick', { vol: 0.3 }); });
    const btn = h('button', { class: 'btn gold', onclick: () => {
      this.ctx.net.send({ t: 'answer', q: q.id, year: Number(range.value) });
      btn.setAttribute('disabled', 'true');
      range.disabled = true;
      btn.textContent = `Locked: ${range.value}`;
      audio.sfx('lock');
    } }, 'Lock it in!');
    return h('div', { class: 'answer-strip' }, h('div', { class: 'yeardial wood' }, h('div', { class: 'row' }, h('button', { class: 'btn small wood', onclick: () => { range.value = String(Number(range.value) - 1); yr.textContent = range.value; } }, '−'), h('div', { class: 'grow' }, yr), h('button', { class: 'btn small wood', onclick: () => { range.value = String(Number(range.value) + 1); yr.textContent = range.value; } }, '+')), range, btn));
  }

  private textInput(q: PublicQuestion): HTMLElement {
    const input = h('input', { class: 'input', placeholder: 'Type your answer…', maxlength: '60', autocomplete: 'off' }) as HTMLInputElement;
    const submit = () => {
      if (!input.value.trim()) return;
      this.ctx.net.send({ t: 'answer', q: q.id, text: input.value.trim() });
      input.disabled = true;
      btn.setAttribute('disabled', 'true');
      btn.textContent = 'Locked!';
      audio.sfx('lock');
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); e.stopPropagation(); });
    const btn = h('button', { class: 'btn gold', onclick: submit }, 'Answer');
    window.setTimeout(() => input.focus(), 400);
    return h('div', { class: 'answer-strip' }, h('div', { class: 'wood row' }, input, btn));
  }

  private async playQuestionAudio(q: PublicQuestion): Promise<void> {
    const a = q.audio;
    if (!a || !audio.ctx) return;
    audio.duck(0.05);
    audio.stopMusic(0.5);
    try {
      let buf: AudioBuffer;
      let offset = 0;
      let len: number;
      let rate = 1;
      if (a.clip) {
        buf = await audio.renderClip(a.clip);
        len = beatsToSec(a.clip.len, a.clip.bpm);
        rate = a.clip.rate ?? 1;
        if (a.clip.reverse) offset = Math.max(0, buf.duration - len - 0.35);
        offset += a.clip.reverse ? 0 : 0.02;
      } else if (a.file) {
        buf = await audio.loadFile(a.file.src, a.file.reverse);
        offset = a.file.reverse ? Math.max(0, buf.duration - a.file.offset - a.file.len) : a.file.offset;
        len = a.file.len;
        rate = a.file.rate ?? 1;
      } else return;
      if (this.snap?.phase.id !== 'question' || this.snap.phase.q.id !== q.id) return;
      const start = this.localMs(q.startAt);
      const end = this.localMs(q.deadline);
      const scene = this.ctx.scene;
      if (a.stages?.length) {
        let t = a.stages.length > 2 ? LEAD_IN : 0.3;
        a.stages.forEach((stageLen, i) => {
          const at = start + t * 1000;
          const dur = Math.min(len, stageLen) * (a.clip ? 1 : 1);
          this.clips.push(audio.playBuffer(buf, audio.ctxTimeAt(at), offset, dur * rate, rate));
          this.timers.push(window.setTimeout(() => {
            scene.dj.play(i === 0 ? 'nod' : 'nod');
            this.stagePills.forEach((p, j) => (p.style.background = j === i ? '#ffd23a' : j < i ? '#c8c8c8' : ''));
          }, Math.max(0, at - Date.now())));
          if (q.minigame === 'finish_lyrics') {
            this.timers.push(window.setTimeout(() => { audio.sfx('scratch'); scene.dj.play('shock', true); scene.rig.addShake(0.15); }, Math.max(0, at + dur * 1000 - Date.now())));
          }
          t += stageLen + (a.stageGap ?? 1.1);
        });
      } else if (a.loop) {
        const playLen = len / rate;
        for (let at = start + 300; at < end - 500; at += (playLen + 1) * 1000) {
          this.clips.push(audio.playBuffer(buf, audio.ctxTimeAt(at), offset, Math.min(len, ((end - at) / 1000) * rate), rate));
        }
        if (q.minigame === 'reverse_song') this.timers.push(window.setTimeout(() => audio.sfx('scratch'), Math.max(0, start - Date.now())));
      }
    } catch (err) {
      console.warn('clip failed', err);
    }
  }

  private startSabotage(): void {
    const fx = h('div', { class: 'sabotage-fx' });
    this.sabotageEl = fx;
    this.phaseEl.appendChild(fx);
    this.ctx.hud.toast('🪰 Someone sabotaged you! Answer anyway for a bonus.', 'paper');
    const bugs = Array.from({ length: 5 }, () => fx.appendChild(h('div', { class: 'bug' }, '🪰')));
    const splats = Array.from({ length: 3 }, (_, i) => fx.appendChild(h('div', { class: 'splat', style: { left: `${15 + i * 30}%`, top: `${30 + (i % 2) * 25}%` } })));
    let t = 0;
    const tick = () => {
      if (!this.sabotageEl) return;
      t += 0.03;
      bugs.forEach((b, i) => {
        const x = 50 + Math.sin(t * (1.3 + i * 0.2) + i) * 38;
        const y = 50 + Math.cos(t * (1.7 + i * 0.15) + i * 2) * 32;
        b.style.left = `${x}%`;
        b.style.top = `${y}%`;
      });
      splats.forEach((sp, i) => (sp.style.opacity = String(Math.max(0, 0.7 - t * 0.05 * (i + 1)))));
      requestAnimationFrame(tick);
    };
    tick();
  }

  // ───────────────────────── reveal / scoreboard / rewards ─────────────────────────

  private enterReveal(s: RoomSnapshot, ph: Extract<Phase, { id: 'question_reveal' }>, _prev: Phase | undefined): void {
    const scene = this.ctx.scene;
    const top = this.phaseEl;
    const q = ph.q;
    audio.duck(1);
    if (q.input === 'choice' && q.choices) {
      const boardKind: BoardKind = q.minigame === 'higher_lower' ? 'arrows' : q.board === 'tv' || q.board === 'chalk' ? 'cards' : q.board;
      this.setBoard(boardKind, q.choices.map((c) => ({ id: c.id, label: c.label, sub: c.sub, cover: c.cover })));
      scene.board.setAllStates((id) => (id === ph.correct ? 'correct' : 'wrong'));
      for (const [id, a] of this.optAnchors) a.el.classList.add(id === ph.correct ? 'correct' : 'wrong');
      const w = scene.board.itemWorld(ph.correct, 0.5);
      if (w) {
        scene.particles.frogFx('confetti', w, 40);
        scene.rig.go({ pos: w.clone().add(new THREE.Vector3(0, 3.4, 3.6)), target: w, fov: 40 }, 0.9);
      }
    } else {
      this.shot('overview', 1);
    }
    if (this.coverImg === null && q.cover) {
      top.appendChild(h('div', { class: 'media-center passthrough' }, h('img', { class: 'cover-reveal', src: coverUrl(q.cover, 8) })));
    }
    const mine = ph.results.find((r) => r.playerId === s.you.id);
    audio.sfx(mine?.correct ? 'correct' : 'wrong');
    top.appendChild(h('div', { class: 'banner wood' },
      h('div', { class: 'tag' }, mine ? (mine.correct ? `+${fmt(mine.points)} POINTS!` : mine.answerLabel ? 'NOPE!' : 'TOO SLOW!') : 'ANSWER'),
      ph.correctLabel,
      ph.fact ? h('div', { class: 'sub' }, ph.fact) : null));
    const chips = h('div', { class: 'results' });
    const sorted = ph.results.slice().sort((a, b) => b.points - a.points);
    sorted.forEach((r, i) => {
      const p = this.player(r.playerId);
      if (!p) return;
      const bonus = [r.streakBonus ? `🔥+${r.streakBonus}` : '', r.underdogBonus ? `🐸+${r.underdogBonus}` : '', r.social ? `${r.social > 0 ? '🎲+' : '💸'}${r.social}` : ''].filter(Boolean).join(' ');
      const chip = h('div', { class: `result-chip ${r.correct ? 'ok' : 'bad'}`, style: { animationDelay: `${i * 80}ms`, borderColor: PLAYER_COLORS[p.color % PLAYER_COLORS.length] } },
        `${r.correct ? '✔' : '✖'} ${p.name}`, r.points ? h('span', { class: 'pts' }, `${r.points > 0 ? '+' : ''}${fmt(r.points)}`) : null, bonus ? h('span', { class: 'tiny', style: { marginLeft: '4px' } }, bonus) : null,
        r.ms !== null && r.correct ? h('span', { class: 'tiny muted', style: { marginLeft: '4px' } }, `${(r.ms / 1000).toFixed(1)}s`) : null);
      chips.appendChild(chip);
      const actor = scene.actorOf(r.playerId);
      if (actor) this.later(300 + Math.random() * 600, () => actor.play(r.correct ? (r.points > 900 ? 'celebrate' : 'cheer') : ['cry', 'facepalm', 'shock', 'angry'][Math.floor(Math.random() * 4)]));
    });
    top.appendChild(h('div', { style: { position: 'absolute', bottom: '70px', left: '50%', transform: 'translateX(-50%)', width: '96vw', display: 'flex', justifyContent: 'center' } }, chips));
    ph.socialLines.forEach((line, i) => this.later(1200 + i * 900, () => this.ctx.hud.toast(line, 'paper', 3200)));
    if (ph.socialLines.length) audio.sfx('cheer');
    scene.chalk.clear();
    scene.chalk.write('ANSWER:', 256, 80, { size: 28, align: 'center', instant: true });
    wrapChalk(scene, ph.correctLabel, 140, 32, '#fff1b0');
  }

  private enterScoreboard(s: RoomSnapshot, ph: Extract<Phase, { id: 'scoreboard' }>): void {
    const scene = this.ctx.scene;
    const top = this.phaseEl;
    this.shot('chalk', 1.2);
    scene.chalk.clear();
    scene.chalk.write(`AFTER ROUND ${ph.round}/${ph.total}`, 256, 26, { size: 22, align: 'center', instant: true, color: '#ffe245' });
    const n = ph.standings.length;
    const rowH = Math.min(36, 230 / Math.max(1, n));
    const size = Math.max(14, Math.min(26, rowH * 0.8));
    ph.standings.forEach((st, i) => {
      const p = this.player(st.id);
      if (!p) return;
      const y = 62 + i * rowH;
      const last = i === n - 1 && n > 1;
      const move = st.prevRank - st.rank;
      scene.chalk.write(`${st.rank}. ${p.name}${last ? ' 🐸?' : ''}`, 40, y, { size, delay: 0.25 + i * 0.35, color: last ? '#ffb0b0' : i === 0 ? '#fff1b0' : '#f4f1e8' });
      scene.chalk.write(`${fmt(st.score)}${move > 0 ? ' ↑' : move < 0 ? ' ↓' : ''}`, 470, y, { size, align: 'right', delay: 0.4 + i * 0.35 });
    });
    // Crisp overlay copy for small screens.
    const board = h('div', { class: 'scoreboard chalk card-pop' }, h('h3', { style: { textAlign: 'center', color: 'var(--gold)' } }, `ROUND ${ph.round} OF ${ph.total}`));
    ph.standings.forEach((st, i) => {
      const p = this.player(st.id);
      if (!p) return;
      const move = st.prevRank - st.rank;
      const last = i === ph.standings.length - 1 && ph.standings.length > 1;
      board.appendChild(h('div', { class: `row${last ? ' last' : ''}`, style: { animationDelay: `${i * 120}ms` } },
        h('span', { class: 'rank' }, `${st.rank}.`), h('span', { class: 'grow' }, `${p.name}${last ? ' — toad watch 👀' : ''}`),
        move ? h('span', { class: `move ${move > 0 ? 'up' : 'down'}` }, move > 0 ? `▲${move}` : `▼${-move}`) : null,
        h('span', { class: 'delta' }, st.delta ? `+${fmt(st.delta)}` : ''), h('b', { style: { marginLeft: '8px' } }, fmt(st.score))));
    });
    const wrap = h('div', { class: 'overlay', style: { alignItems: 'end', paddingBottom: '64px' } }, board);
    if (this.aspect() < 1.2) top.appendChild(wrap);
    else this.later(2200, () => top.appendChild(wrap));
    // Frogs react to their new positions.
    this.later(900, () => {
      ph.standings.forEach((st, i) => {
        const a = scene.actorOf(st.id);
        if (!a) return;
        const move = st.prevRank - st.rank;
        if (i === 0 && n > 1) a.play('flex');
        else if (i === n - 1 && n > 1) a.play('shock');
        else if (move > 0) a.play('cheer');
        else if (move < 0) a.play('facepalm');
      });
      audio.sfx('chalkwrite');
    });
  }

  private enterRewards(s: RoomSnapshot, ph: Extract<Phase, { id: 'rewards' }>): void {
    const top = this.phaseEl;
    const mine = ph.rewards.find((r) => r.playerId === s.you.id);
    const place = ph.ranking.indexOf(s.you.id) + 1;
    const card = h('div', { class: 'rewards wood card-pop' });
    card.append(h('h2', null, place === 1 ? '🏆 YOU WON!' : place === ph.ranking.length ? '🐸 YOU GOT LARPED' : `#${place} of ${ph.ranking.length}`));
    if (mine) {
      const coinEl = h('div', { class: 'coin' }, '+0 🪙');
      card.append(coinEl);
      let c = 0;
      const step = Math.max(1, Math.round(mine.coins / 20));
      const id = window.setInterval(() => {
        c = Math.min(mine.coins, c + step);
        coinEl.textContent = `+${c} 🪙`;
        audio.sfx('coin', { vol: 0.4 });
        if (c >= mine.coins) window.clearInterval(id);
      }, 60);
      this.timers.push(id as unknown as number);
      card.append(h('div', null, `+${mine.xp} XP${mine.levelAfter > mine.levelBefore ? `  ·  LEVEL UP! ${mine.levelBefore} → ${mine.levelAfter}` : ''}`));
      if (mine.levelAfter > mine.levelBefore) this.later(900, () => audio.sfx('levelup'));
      for (const a of mine.achievements) { const def = ACHIEVEMENT_BY_ID[a]; card.append(h('div', { class: 'tiny' }, `${def?.icon ?? '🏅'} Achievement: ${def?.name ?? a}`)); }
      for (const u of mine.unlocked) card.append(h('div', { class: 'tiny' }, `🎁 Unlocked: ${COSMETIC_BY_ID[u]?.name ?? u}`));
      if (mine.records.length) card.append(h('div', { class: 'tiny' }, `💿 ${mine.records.length} new record${mine.records.length > 1 ? 's' : ''} for your collection`));
    } else {
      card.append(h('div', { class: 'tiny muted' }, 'Rewards are saved to your profile.'));
    }
    card.append(h('div', { class: 'tiny muted', style: { marginTop: '6px' } }, 'Rematch vote coming up…'));
    top.appendChild(h('div', { class: 'overlay' }, card));
    audio.playMusic('lobby');
  }

  // ───────────────────────── input ─────────────────────────

  private pointerToBoard(ev: PointerEvent): [number, number] | null {
    const rect = this.ctx.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.ctx.scene.rig.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.plane, hit)) return null;
    return this.ctx.scene.board.worldToUv(hit);
  }

  private onPointerMove = (ev: PointerEvent): void => {
    const c = this.myCursor;
    c.sx = ev.clientX;
    c.sy = ev.clientY;
    const uv = this.pointerToBoard(ev);
    if (!uv) return;
    c.u = uv[0];
    c.v = uv[1];
    this.sendCursor();
  };

  private onPointerDown = (ev: PointerEvent): void => {
    audio.unlock();
    this.myCursor.down = true;
    this.myCursor.el?.classList.add('down');
    this.onPointerMove(ev);
    this.sendCursor(true);
  };

  private onPointerUp = (ev: PointerEvent): void => {
    this.myCursor.down = false;
    this.myCursor.el?.classList.remove('down');
    this.sendCursor(true);
    const uv = this.pointerToBoard(ev);
    if (!uv) return;
    this.click(uv[0], uv[1]);
  };

  private onPointerLeave = (): void => {
    this.myCursor.sx = -1;
  };

  private sendCursor(force = false): void {
    const now = performance.now();
    const c = this.myCursor;
    if (!force && now - c.lastSend < 50) return;
    c.lastSend = now;
    this.ctx.net.send({ t: 'cur', u: +c.u.toFixed(3), v: +c.v.toFixed(3), d: c.down ? 1 : 0 });
  }

  private click(u: number, v: number): void {
    const s = this.snap;
    if (!s) return;
    const id = this.ctx.scene.board.hitTest(u, v);
    if (!id) return;
    const ph = s.phase;
    const net = this.ctx.net;
    if (ph.id === 'category_vote' || ph.id === 'map_vote' || ph.id === 'rematch_vote') {
      net.send({ t: 'vote', target: id });
      this.myChoice = id;
      audio.sfx('pop');
      this.ctx.scene.actorOf(s.you.id)?.play('nod');
    } else if (ph.id === 'question' && ph.q.input === 'choice') {
      if (this.myChoice || s.you.answer) return;
      net.send({ t: 'answer', q: ph.q.id, choice: id });
      this.myChoice = id;
      audio.sfx('lock');
      this.ctx.scene.board.setAllStates((x) => (x === id ? 'idle' : 'idle'));
    } else if (ph.id === 'social_setup') {
      if (ph.social === 'wager') net.send({ t: 'social', wager: Number(id.slice(1)) });
      else net.send({ t: 'social', target: id });
      this.myChoice = id;
      audio.sfx('pop');
    }
  }

  // ───────────────────────── frame ─────────────────────────

  update(dt: number): void {
    const s = this.snap;
    if (!s) return;
    const scene = this.ctx.scene;
    const hud = this.ctx.hud;
    const now = Date.now();
    // Timer.
    const ph = s.phase;
    if (ph.id === 'question') this.timer.set(this.localMs(ph.q.deadline) - now, ph.q.deadline - ph.q.startAt);
    else this.timer.set(this.localMs(s.phaseEnd) - now, s.phaseEnd - s.phaseStart);
    // Lyrics karaoke + stage pills + pixelated cover.
    if (this.lyricEls.length) {
      this.lyricEls.forEach((el, i) => {
        const on = now >= (this.lyricTimes[i] ?? Infinity);
        const isBlank = i === this.lyricEls.length - 1;
        el.style.opacity = isBlank ? (on ? '1' : '0') : on ? '1' : '0.25';
        el.classList.toggle('on', on && !isBlank);
      });
    }
    if (this.coverImg && ph.id === 'question') {
      const el = (now - this.questionStart) / Math.max(1, this.localMs(ph.q.deadline) - this.questionStart);
      const level = el < 0.2 ? 16 : el < 0.4 ? 8 : el < 0.6 ? 4 : el < 0.8 ? 2 : 1;
      const want = String(level);
      if (this.coverImg.dataset.level !== want && ph.q.cover) {
        this.coverImg.dataset.level = want;
        this.coverImg.src = pixelUrl(ph.q.cover, level);
        audio.sfx('swap', { vol: 0.3 });
      }
    }
    // Cursors.
    const votes = this.updateVoterDots(s);
    const hover = new Map<string, number>();
    for (const [, c] of this.cursors) {
      c.u += (c.tu - c.u) * Math.min(1, dt * 14);
      c.v += (c.tv - c.v) * Math.min(1, dt * 14);
      const w = scene.board.uvToWorld(c.u, c.v, 0.15);
      const p = hud.project(w, scene.rig.camera);
      c.el.style.transform = `translate(${Math.round(p.x - 8)}px, ${Math.round(p.y - 6)}px)`;
      c.el.style.opacity = performance.now() - c.seen > 8000 ? '0.35' : '1';
      const id = scene.board.hitTest(c.u, c.v);
      if (id) hover.set(id, (hover.get(id) ?? 0) + 1);
    }
    for (const id of [...this.cursors.keys()]) if (!s.players.some((p) => p.id === id)) { this.cursors.get(id)!.el.remove(); this.cursors.delete(id); }
    const me = this.myCursor;
    if (me.el) {
      me.el.style.display = me.sx < 0 ? 'none' : '';
      me.el.style.transform = `translate(${Math.round(me.sx - 8)}px, ${Math.round(me.sy - 6)}px)`;
      const myHover = scene.board.hitTest(me.u, me.v);
      if (myHover) hover.set(myHover, (hover.get(myHover) ?? 0) + 1);
    }
    scene.board.update(dt, hover, votes, this.myChoice);
    this.ctx.canvas.style.cursor = scene.board.items.length ? 'none' : '';
  }
}

function wrapChalk(scene: Clubhouse, text: string, y0 = 90, size = 30, color?: string): void {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 26) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  const s = lines.length > 4 ? size * 0.75 : size;
  lines.slice(0, 6).forEach((l, i) => scene.chalk.write(l, 256, y0 + i * s * 1.25, { size: s, align: 'center', delay: i * 0.4, color }));
}

const pixCache = new Map<string, string>();
function pixelUrl(cover: Parameters<typeof pixelatedCoverTexture>[0], level: number): string {
  const key = `${cover.motif}:${cover.bg}:${level}`;
  let url = pixCache.get(key);
  if (!url) {
    const tex = pixelatedCoverTexture(cover, level);
    const src = tex.image as HTMLCanvasElement;
    const big = document.createElement('canvas');
    big.width = big.height = 256;
    const c = big.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.drawImage(src, 0, 0, 256, 256);
    url = big.toDataURL();
    pixCache.set(key, url);
  }
  return url;
}

export function categoryName(id: string): string {
  return CATEGORY_BY_ID[id]?.name ?? id;
}

export function mapsList() {
  return MAPS;
}

export type { RoomSettings };
