// Modal boards: settings, credits & licensing and first-visit name entry.

import { audio } from '../audio/AudioEngine';
import type { PixelRenderer } from '../render/PixelRenderer';
import { store } from '../state';
import { clear, h } from '../ui/dom';

let open: HTMLElement | null = null;

function modal(title: string, body: HTMLElement, onClose?: () => void): HTMLElement {
  closeModal();
  const close = () => { closeModal(); onClose?.(); };
  const card = h('div', { class: 'modal-card wood card-pop', role: 'dialog', 'aria-label': title },
    h('div', { class: 'panel-head' }, h('h2', { class: 'grow' }, title), h('button', { class: 'btn wood small icon', title: 'Close', 'aria-label': 'Close', onclick: () => { audio.sfx('click'); close(); } }, '✖')),
    body);
  const el = h('div', { class: 'modal', onclick: (e: Event) => { if (e.target === el) close(); } }, card);
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { window.removeEventListener('keydown', onKey); close(); } };
  window.addEventListener('keydown', onKey);
  document.getElementById('hud')?.appendChild(el);
  open = el;
  return el;
}

export function closeModal(): void {
  open?.remove();
  open = null;
}

// ───────────────────────── settings ─────────────────────────

export function openSettings(pixel: PixelRenderer, extra: { onTutorial(): void; onCredits(): void }): void {
  const s = store.settings;
  const slider = (label: string, value: number, set: (v: number) => void) => {
    const input = h('input', { type: 'range', min: 0, max: 100, value: Math.round(value * 100), 'aria-label': label }) as HTMLInputElement;
    input.addEventListener('input', () => set(Number(input.value) / 100));
    input.addEventListener('change', () => audio.sfx('pop'));
    return h('label', null, h('span', null, label), input);
  };
  const quality = h('select', { 'aria-label': 'Graphics quality' }, ...(['low', 'medium', 'high'] as const).map((q) => h('option', { value: q, selected: s.quality === q }, q === 'low' ? 'Low (phones)' : q === 'medium' ? 'Medium' : 'High (crisp)'))) as HTMLSelectElement;
  quality.addEventListener('change', () => {
    store.saveSettings({ quality: quality.value as 'low' | 'medium' | 'high' });
    pixel.setQuality(store.settings.quality);
  });
  const motion = h('input', { type: 'checkbox', checked: s.reduceMotion, 'aria-label': 'Reduce motion' }) as HTMLInputElement;
  motion.addEventListener('change', () => store.saveSettings({ reduceMotion: motion.checked }));
  const f = store.features;
  const feat = (on: boolean | undefined, name: string) => h('span', { class: `chip${on ? ' on' : ''}` }, `${on ? '✔' : '✖'} ${name}`);
  const body = h('div', { class: 'col settings-body' },
    slider('🎵 Music', s.music, (v) => { store.saveSettings({ music: v }); audio.setVolumes(store.settings.music, store.settings.sfx); }),
    slider('🔊 Sound effects', s.sfx, (v) => { store.saveSettings({ sfx: v }); audio.setVolumes(store.settings.music, store.settings.sfx); }),
    h('label', null, h('span', null, '🖼️ Graphics'), quality),
    h('label', null, h('span', null, '🌀 Reduce motion & flashes'), motion),
    h('div', { class: 'tiny' }, 'Online music & movie services on this server:'),
    h('div', { class: 'chips' }, feat(f?.musicbrainz, 'MusicBrainz'), feat(f?.openverse, 'Openverse'), feat(f?.commons, 'Wikimedia Commons'), feat(f?.jamendo, 'Jamendo'), feat(f?.spotify, 'Spotify (metadata)'), feat(f?.tmdb, 'TMDB')),
    h('div', { class: 'tiny' }, 'The built-in songs, questions and art always work offline. Services only add extra questions when the server operator has configured them.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn small wood grow', onclick: () => { closeModal(); extra.onTutorial(); } }, '🎓 Tutorial'),
      h('button', { class: 'btn small wood grow', onclick: () => { closeModal(); extra.onCredits(); } }, '📜 Credits')));
  modal('⚙️ Settings', body);
}

// ───────────────────────── credits ─────────────────────────

interface Manifest {
  music: { title: string; artist: string; composition: string; recording: string; basis: string; attribution?: string; source?: string }[];
  metadataOnly: number;
  facts: string;
  filtered: { id: string; reason: string }[];
}

export function openCredits(): void {
  const list = h('div', { class: 'col' }, h('div', { class: 'tiny' }, 'Loading the licence ledger…'));
  const body = h('div', { class: 'col credits' },
    h('h3', null, '🐸 The game'),
    h('p', null, 'LARPED ONE OUT — code, voxel frogs, pixel art, UI, sound effects, the DJ Lilypadd character and the House Band songs are original works made for this game, released as CC0 (public domain dedication). No band logos, mascots or protected characters are used.'),
    h('h3', null, '🎼 Music you hear'),
    h('p', { class: 'tiny' }, 'Every clip is performed live in your browser by the game\'s own synthesizer from a score. Classical pieces and folk songs are public-domain compositions (composer died 70+ years ago and/or published before 1930 in the US); our arrangements and performances are original and CC0. No recordings from labels or streaming services are ever played.'),
    list,
    h('h3', null, '🔤 Fonts'),
    h('ul', null,
      h('li', null, 'Pixelify Sans by Stefie Justprince — SIL Open Font License 1.1 (via Fontsource)'),
      h('li', null, 'Silkscreen by Jason Kottke — SIL Open Font License 1.1 (via Fontsource)')),
    h('h3', null, '🧰 Libraries'),
    h('ul', null,
      h('li', null, 'three.js — MIT License'),
      h('li', null, 'ws — MIT License'),
      h('li', null, 'node-qrcode — MIT License'),
      h('li', null, 'Vite, esbuild, TypeScript, Vitest (build tools) — MIT / Apache-2.0')),
    h('h3', null, '🌐 Optional online sources'),
    h('ul', { class: 'tiny' },
      h('li', null, 'MusicBrainz — release titles, years and track lists (core data CC0).'),
      h('li', null, 'Album art is never downloaded: Cover Art Archive images belong to their labels and artists and carry no reuse licence, so every sleeve in the game is original, procedurally generated pixel art.'),
      h('li', null, 'Openverse, Wikimedia Commons, Jamendo — audio is only played when each individual file\'s licence is CC0, public domain, CC BY or CC BY-SA, with attribution shown. NonCommercial and NoDerivatives files are excluded automatically.'),
      h('li', null, 'Spotify — playlist import uses Spotify\'s official Web API for track titles and artists only, linking back to Spotify. Spotify audio is not played in quizzes.'),
      h('li', null, 'TMDB — This product uses the TMDB API but is not endorsed or certified by TMDB.')),
    h('p', { class: 'tiny' }, 'LARPED ONE OUT is not affiliated with or endorsed by any artist, label, studio or platform mentioned in its trivia. Names and facts are used for identification only.'));
  modal('📜 Credits & licences', body);
  fetch('/api/credits').then((r) => r.json()).then((m: Manifest) => {
    clear(list);
    list.append(
      h('div', { class: 'tiny' }, `${m.music.length} playable pieces.${m.metadataOnly ? ` ${m.metadataOnly} imported songs are used for metadata-only questions.` : ''} Real-world releases in trivia rounds are always metadata only (titles, years, artists — no audio).`),
      h('div', { class: 'credit-list' }, ...m.music.map((x) => h('div', { class: 'credit-row' },
        h('b', null, x.title), ` — ${x.artist}`,
        h('div', { class: 'tiny' }, `Composition: ${x.composition} · Recording: ${x.recording}`),
        h('div', { class: 'tiny muted' }, x.basis, x.attribution ? ` · ${x.attribution}` : '', x.source ? ' · ' : '', x.source ? h('a', { href: x.source, target: '_blank', rel: 'noopener noreferrer' }, 'source') : null)))),
      h('div', { class: 'tiny' }, m.facts));
    if (m.filtered.length) list.append(h('div', { class: 'tiny' }, `${m.filtered.length} items were filtered out automatically because their licence could not be verified.`));
  }).catch(() => {
    clear(list);
    list.append(h('div', { class: 'tiny' }, 'Could not reach the server for the full list — every built-in song is public domain or original CC0.'));
  });
}

// ───────────────────────── first visit ─────────────────────────

export function askName(current: string, onDone: (name: string) => void): void {
  const input = h('input', { class: 'input', value: current, maxlength: 16, placeholder: 'Frog name', 'aria-label': 'Frog name', autocomplete: 'nickname' }) as HTMLInputElement;
  const go = () => {
    const v = input.value.trim();
    if (v.length < 2) { input.focus(); audio.sfx('error'); return; }
    closeModal();
    onDone(v);
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  modal('🐸 What\'s your frog called?', h('div', { class: 'col' },
    h('p', null, 'Pick a name for the chalkboard. You can change it any time in your scrapbook.'),
    input,
    h('button', { class: 'btn gold', onclick: go }, 'Ribbit! Let\'s go')), () => onDone(input.value.trim() || current));
  setTimeout(() => input.focus(), 50);
}
