// Lobby panels: party code + QR, frog list, host setup scroll (fast presets + deep options), playlist import.

import { CATEGORIES, MAPS, MINIGAMES, PLAYER_COLORS, type CategoryId, type MinigameId } from '../../shared/catalog';
import type { RoomSettings, RoomSnapshot } from '../../shared/protocol';
import { audio } from '../audio/AudioEngine';
import { store } from '../state';
import { clear, h } from '../ui/dom';
import type { GameCtx } from './GameView';
import { qrCanvas } from './widgets';

let lanOrigin: string | null = null;
let lanFetched = false;

async function joinOrigin(): Promise<string> {
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (!isLocal) return location.origin;
  if (!lanFetched) {
    lanFetched = true;
    try {
      const info = await (await fetch('/api/info')).json();
      if (info.lan?.[0]) lanOrigin = `${location.protocol}//${info.lan[0]}:${location.port || (location.protocol === 'https:' ? 443 : 80)}`;
    } catch { /* ignore */ }
  }
  return lanOrigin ?? location.origin;
}

const PRESETS: { name: string; icon: string; s: Partial<RoomSettings> }[] = [
  { name: 'Quick', icon: '⚡', s: { rounds: 4, questionsPerRound: 2, timer: 15 } },
  { name: 'Classic', icon: '🐸', s: { rounds: 6, questionsPerRound: 3, timer: 20, socialRounds: true, randomEvents: true } },
  { name: 'Marathon', icon: '🏃', s: { rounds: 10, questionsPerRound: 3, timer: 20 } },
  { name: 'Chaos', icon: '🌪️', s: { rounds: 6, questionsPerRound: 2, timer: 15, socialRounds: true, randomEvents: true, difficulty: 'mixed' } },
  { name: 'Music only', icon: '🎶', s: { categories: CATEGORIES.filter((c) => c.group !== 'popculture').map((c) => c.id) } },
  { name: 'Pop culture', icon: '🍿', s: { categories: CATEGORIES.filter((c) => c.group === 'popculture' || c.id === 'mixed').map((c) => c.id) } },
];

class LobbyPanel {
  readonly el: HTMLElement;
  code: string;
  private left: HTMLElement;
  private right: HTMLElement;
  private actions: HTMLElement;
  private players: HTMLElement;
  private qrBox: HTMLElement;
  private linkEl: HTMLElement;
  private playlistMsg: HTMLElement;
  private advanced = false;
  private lastSettings = '';
  private lastActions = '';

  constructor(s: RoomSnapshot, private ctx: GameCtx) {
    this.code = s.code;
    this.players = h('div', { class: 'col', style: { gap: '2px' } });
    this.qrBox = h('div', { class: 'center row' });
    this.linkEl = h('div', { class: 'tiny', style: { wordBreak: 'break-all' } });
    this.playlistMsg = h('div', { class: 'tiny' });
    this.left = h('div', { class: 'lobby-side wood' },
      h('h2', null, '🎟️ Party code'),
      h('div', { class: 'code-box' }, s.code),
      h('div', { class: 'row', style: { marginTop: '6px', alignItems: 'flex-start' } }, this.qrBox, h('div', { class: 'col grow' },
        h('div', { class: 'tiny' }, 'Friends scan the QR or open the link on any phone or computer — no download needed.'),
        this.linkEl,
        h('button', { class: 'btn small wood', onclick: () => this.copyLink() }, '📋 Copy link'))),
      h('h3', { style: { marginTop: '8px', fontSize: '15px' } }, 'Frogs at the table'),
      this.players);
    this.right = h('div', { class: 'settings-panel wood' });
    this.actions = h('div', { class: 'lobby-actions' });
    this.el = h('div', { class: 'layer' }, this.left, this.right, this.actions);
    void this.buildQr(s.code);
    ctx.net.on('playlist', (m) => {
      this.playlistMsg.textContent = m.msg;
      this.playlistMsg.style.color = m.ok ? '#2f7f3f' : '#b03a2e';
      audio.sfx(m.ok ? 'correct' : 'error');
    });
    this.update(s);
  }

  private async buildQr(code: string) {
    const origin = await joinOrigin();
    const url = `${origin}/?join=${code}`;
    this.linkEl.textContent = url;
    this.linkEl.dataset.url = url;
    try {
      const c = await qrCanvas(url);
      clear(this.qrBox);
      this.qrBox.appendChild(c);
    } catch { /* QR is a convenience */ }
  }

  private copyLink() {
    const url = this.linkEl.dataset.url ?? location.href;
    void navigator.clipboard?.writeText(url).then(() => this.ctx.hud.toast('Link copied! Send it to your frog friends.'), () => this.ctx.hud.toast(url));
    audio.sfx('click');
  }

  update(s: RoomSnapshot): void {
    const host = s.hostId === s.you.id;
    // Players.
    clear(this.players);
    for (const p of s.players.slice().sort((a, b) => a.seat - b.seat)) {
      this.players.appendChild(h('div', { class: 'player-row' },
        h('span', { class: 'dot', style: { background: PLAYER_COLORS[p.color % PLAYER_COLORS.length] } }),
        h('span', { class: 'grow' }, `${p.isHost ? '👑 ' : ''}${p.name}${p.isBot ? ' 🤖' : ''}${p.id === s.you.id ? ' (you)' : ''}`),
        h('span', { class: 'tiny muted' }, p.isBot ? 'bot' : !p.connected ? 'reconnecting…' : p.ready || p.isHost ? 'ready' : 'not ready'),
        host && p.id !== s.you.id ? h('button', { class: 'chip', title: 'Remove', onclick: () => this.ctx.net.send({ t: 'kick', id: p.id }) }, '✖') : null));
    }
    if (host) {
      this.players.appendChild(h('div', { class: 'row', style: { marginTop: '4px' } },
        h('button', { class: 'btn small', disabled: s.players.length >= s.settings.maxPlayers, onclick: () => { this.ctx.net.send({ t: 'bot_add' }); audio.sfx('pop'); } }, '🤖 Add bot'),
        h('button', { class: 'btn small wood', disabled: !s.players.some((p) => p.isBot), onclick: () => this.ctx.net.send({ t: 'bot_remove' }) }, 'Remove bot')));
    }
    // Settings (only rebuilt when they change so inputs keep focus).
    const sig = JSON.stringify(s.settings) + host + this.advanced;
    if (sig !== this.lastSettings) {
      this.lastSettings = sig;
      this.renderSettings(s, host);
    }
    const me = s.players.find((p) => p.id === s.you.id);
    const aSig = `${host}:${me?.ready}:${s.players.length}`;
    if (aSig !== this.lastActions) {
      this.lastActions = aSig;
      clear(this.actions);
      if (host) {
        const enough = s.players.length >= 2;
        this.actions.append(h('button', { class: 'btn gold', disabled: !enough, onclick: () => { audio.unlock(); audio.sfx('go'); this.ctx.net.send({ t: 'start' }); } }, enough ? '▶ START PARTY' : 'Need 2+ frogs'));
      } else {
        this.actions.append(h('button', { class: `btn ${me?.ready ? 'wood' : 'gold'}`, onclick: () => { audio.unlock(); audio.sfx('ribbit'); this.ctx.net.send({ t: 'ready', v: !me?.ready }); } }, me?.ready ? '✔ Ready! (tap to unready)' : '🐸 I\'m ready!'));
      }
      this.actions.append(
        h('button', { class: 'btn wood small', onclick: () => this.ctx.openCabin() }, '👕 Dress up'),
        h('button', { class: 'btn wood small', onclick: () => this.ctx.leave() }, '🚪 Leave'));
    }
  }

  private renderSettings(s: RoomSnapshot, host: boolean): void {
    const st = s.settings;
    const send = (patch: Partial<RoomSettings>) => { this.ctx.net.send({ t: 'settings', settings: patch }); audio.sfx('click'); };
    clear(this.right);
    this.right.appendChild(h('h2', null, host ? '📜 Party setup' : '📜 Party rules'));
    if (!host) {
      this.right.append(
        h('div', null, `${st.rounds} rounds · ${st.questionsPerRound} questions each · ${st.timer}s timer`),
        h('div', null, `Difficulty: ${st.difficulty} · Map: ${st.map === 'vote' ? 'bottle spin vote' : MAPS.find((m) => m.id === st.map)?.name}`),
        h('div', { class: 'tiny muted' }, `${st.socialRounds ? 'Social rounds on · ' : ''}${st.randomEvents ? 'Random events on · ' : ''}${st.comeback ? 'Underdog bonus on · ' : ''}${st.finalDouble ? 'Final round ×2' : ''}`),
        h('div', { class: 'tiny', style: { marginTop: '6px' } }, 'The host can change these. Waiting for them to start…'));
      return;
    }
    const presets = h('div', { class: 'chips' });
    for (const p of PRESETS) presets.appendChild(h('button', { class: 'chip', onclick: () => send(p.s) }, `${p.icon} ${p.name}`));
    this.right.appendChild(presets);
    const num = (label: string, key: 'rounds' | 'questionsPerRound' | 'timer', min: number, max: number) =>
      h('label', null, label, h('select', { onchange: (e: Event) => send({ [key]: Number((e.target as HTMLSelectElement).value) }) },
        ...Array.from({ length: max - min + 1 }, (_, i) => min + i).filter((v) => key !== 'timer' || v % 5 === 0).map((v) => h('option', { value: String(v), selected: st[key] === v }, String(v)))));
    this.right.append(
      num('Rounds', 'rounds', 3, 12),
      num('Questions per round', 'questionsPerRound', 1, 5),
      num('Seconds per question', 'timer', 10, 30),
      h('label', null, 'Difficulty', h('select', { onchange: (e: Event) => send({ difficulty: (e.target as HTMLSelectElement).value as RoomSettings['difficulty'] }) },
        ...(['easy', 'normal', 'hard', 'mixed'] as const).map((d) => h('option', { value: d, selected: st.difficulty === d }, d)))),
      h('label', null, 'Map', h('select', { onchange: (e: Event) => send({ map: (e.target as HTMLSelectElement).value as RoomSettings['map'] }) },
        h('option', { value: 'vote', selected: st.map === 'vote' }, '🍾 Bottle spin vote'),
        ...MAPS.map((m) => h('option', { value: m.id, selected: st.map === m.id }, m.name)))),
    );
    const toggle = (label: string, key: 'socialRounds' | 'randomEvents' | 'typedAnswers' | 'comeback' | 'finalDouble' | 'isPublic') =>
      h('label', null, label, h('input', { type: 'checkbox', checked: st[key], onchange: (e: Event) => send({ [key]: (e.target as HTMLInputElement).checked }) }));
    this.right.append(
      toggle('🤝 Social rounds (duels, wagers, sabotage)', 'socialRounds'),
      toggle('🪰 Random events', 'randomEvents'),
      toggle('🐸 Underdog bonus for trailing frogs', 'comeback'),
      toggle('💥 Final round double points', 'finalDouble'),
      toggle('⌨️ Typed answers on Hard', 'typedAnswers'),
      toggle('🌍 Public room (anyone can Quick Join)', 'isPublic'),
    );
    this.right.appendChild(h('button', { class: 'chip', style: { marginTop: '6px' }, onclick: () => { this.advanced = !this.advanced; this.lastSettings = ''; this.update(s); } }, this.advanced ? '▲ Hide categories & minigames' : '▼ Categories & minigames'));
    if (this.advanced) {
      const cats = h('div', { class: 'chips' });
      for (const c of CATEGORIES) {
        const on = st.categories.includes(c.id);
        cats.appendChild(h('button', { class: `chip${on ? ' on' : ''}`, onclick: () => {
          const next = on ? st.categories.filter((x) => x !== c.id) : [...st.categories, c.id];
          if (next.length) send({ categories: next as CategoryId[] });
        } }, c.name));
      }
      const mgs = h('div', { class: 'chips' });
      for (const m of MINIGAMES) {
        const on = st.minigames.includes(m.id);
        mgs.appendChild(h('button', { class: `chip${on ? ' on' : ''}`, title: m.blurb, onclick: () => {
          const next = on ? st.minigames.filter((x) => x !== m.id) : [...st.minigames, m.id];
          if (next.length) send({ minigames: next as MinigameId[] });
        } }, m.name));
      }
      this.right.append(h('h3', { style: { fontSize: '14px', margin: '8px 0 4px' } }, 'Categories'), cats, h('h3', { style: { fontSize: '14px', margin: '8px 0 4px' } }, 'Minigames'), mgs);
      // Custom playlists / imports.
      const f = store.features;
      const input = h('input', { class: 'input', placeholder: 'Spotify playlist link, artist name, or audio: words', style: { fontSize: '14px' } }) as HTMLInputElement;
      input.addEventListener('keydown', (e) => e.stopPropagation());
      this.right.append(
        h('h3', { style: { fontSize: '14px', margin: '8px 0 4px' } }, '🎧 Custom playlist'),
        h('div', { class: 'tiny muted' }, `Artist names use MusicBrainz${f?.musicbrainz ? '' : ' (offline)'}. "audio: lo-fi" searches openly licensed recordings (CC0/BY/BY-SA)${f?.openverse ? '' : ' (offline)'}. Spotify links import track info only${f?.spotify ? '' : ' (server needs Spotify keys)'} — Spotify audio is never played.`),
        h('div', { class: 'row' }, input, h('button', { class: 'btn small', onclick: () => { if (input.value.trim()) { this.playlistMsg.textContent = 'Importing…'; this.ctx.net.send({ t: 'import_playlist', url: input.value.trim() }); } } }, 'Import')),
        this.playlistMsg);
    }
  }
}

let panel: LobbyPanel | null = null;

export function lobbyUi(s: RoomSnapshot, ctx: GameCtx): HTMLElement {
  if (!panel || panel.code !== s.code) panel = new LobbyPanel(s, ctx);
  else panel.update(s);
  return panel.el;
}
