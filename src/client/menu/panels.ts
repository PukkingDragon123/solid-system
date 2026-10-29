// Station panels: changing room, merchant stall, record shelf and scrapbook.

import { CATEGORY_BY_ID, EMOTE_BY_ID, MAP_BY_ID } from '../../shared/catalog';
import { COSMETICS, COSMETIC_BY_ID, OUTFIT_SLOTS, isPurchasable, type CosmeticDef, type Outfit, type Slot } from '../../shared/cosmetics';
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID, levelFromXp } from '../../shared/progression';
import type { ProfilePrivate } from '../../shared/protocol';
import { recordCoverUrl, stickerUrl } from '../art/icons';
import { audio } from '../audio/AudioEngine';
import { store } from '../state';
import { clear, fmt, h } from '../ui/dom';
import type { Menu } from './Menu';
import { thumbInto } from './thumbs';

const WARDROBE_TABS: [Slot, string][] = [
  ['hat', '🎩 Hats'], ['clothes', '🧥 Clothes'], ['neck', '📿 Neck'], ['face', '🕶️ Face'],
  ['skin', '🎨 Colour'], ['pattern', '🐆 Pattern'], ['eyes', '👀 Eyes'], ['mouth', '👄 Mouth'],
  ['idle', '💃 Idle'], ['emote', '😂 Emotes'],
];

const SHOP_TABS: [string, string][] = [['deals', '🔥 Deals'], ...WARDROBE_TABS, ['banner', '🖼️ Banners'], ['title', '🏷️ Titles'], ['sticker', '⭐ Stickers']];

const IDLE_DEMO: Record<string, string> = { idle_chill: 'scratch', idle_sleepy: 'sleep', idle_groovy: 'dance', idle_hyper: 'hop', idle_dramatic: 'faint' };

function loading(): HTMLElement {
  return h('div', { class: 'note' }, 'Fetching your frog from the pond…');
}

function tabs(list: [string, string][], current: string, onPick: (id: string) => void): HTMLElement {
  return h('div', { class: 'tabs' }, ...list.map(([id, label]) => h('button', { class: `tab${id === current ? ' on' : ''}`, onclick: () => { audio.sfx('click'); onPick(id); } }, label)));
}

function lockText(c: CosmeticDef): string {
  if (c.level) return `🔒 Level ${c.level}`;
  if (c.achievement) return `🏆 ${ACHIEVEMENT_BY_ID[c.achievement]?.name ?? 'Achievement'}`;
  return `🪙 ${fmt(c.price)}`;
}

function itemCard(c: CosmeticDef, opts: { owned: boolean; equipped: boolean; selected?: boolean; base: Outfit; price?: number; deal?: number; onClick: () => void }): HTMLElement {
  const img = h('img', { class: 'thumb', alt: '' });
  thumbInto(img, c.id, opts.base);
  return h('button', { class: `item${opts.owned ? '' : ' locked'}${opts.equipped ? ' equipped' : ''}${opts.selected ? ' selected' : ''}`, title: c.desc ?? c.name, onclick: opts.onClick },
    h('i', { class: `rar ${c.rarity}` }),
    opts.deal ? h('span', { class: 'deal' }, `-${Math.round(opts.deal * 100)}%`) : null,
    img,
    h('span', { class: 'nm' }, c.name),
    h('span', { class: 'price' }, opts.owned ? (opts.equipped ? '✔ Wearing' : 'Owned') : opts.price !== undefined ? `🪙 ${fmt(opts.price)}` : lockText(c)));
}

function equipped(o: Outfit, c: CosmeticDef): boolean {
  if (c.slot === 'emote') return o.emotes.includes(c.id.replace(/^emote_/, ''));
  if ((OUTFIT_SLOTS as string[]).includes(c.slot)) return (o as unknown as Record<string, string>)[c.slot] === c.id;
  return false;
}

/** Shows off an item on the cabin frog (emotes and idles play their animation). */
function demo(m: Menu, c: CosmeticDef): void {
  const frog = m.ctx.cabin.frog;
  if (c.slot === 'emote') {
    const e = EMOTE_BY_ID[c.id.replace(/^emote_/, '')];
    if (e) { frog.play(e.anim, true); audio.sfx(e.sfx); }
  } else if (c.slot === 'idle') {
    frog.play(IDLE_DEMO[c.id] ?? 'dance', true);
  } else {
    frog.play(['flex', 'dance', 'bow', 'cheer'][Math.floor(Math.random() * 4)], true);
  }
}

function buy(m: Menu, id: string): void {
  audio.unlock();
  m.awaitBuy = id;
  m.ctx.net.send({ t: 'buy', item: id });
}

function priceOf(id: string): number {
  const deal = store.shop?.deals.find((d) => d.id === id);
  return deal ? deal.price : COSMETIC_BY_ID[id]?.price ?? 0;
}

// ───────────────────────── changing room ─────────────────────────

export function wardrobePanel(m: Menu): HTMLElement {
  const p = store.profile;
  if (!p) return loading();
  const slot = (m.tabs.customize ?? 'hat') as Slot;
  const owned = new Set(p.owned);
  const base = p.outfit;
  const look = m.outfit();
  const items = COSMETICS.filter((c) => c.slot === slot).sort((a, b) => Number(owned.has(b.id)) - Number(owned.has(a.id)) || a.price - b.price);
  const net = m.ctx.net;

  const grid = h('div', { class: 'item-grid scroll-keep' }, ...items.map((c) => itemCard(c, {
    owned: owned.has(c.id),
    equipped: equipped(look, c),
    base,
    onClick: () => {
      audio.sfx('swap');
      if (c.slot === 'emote') {
        const e = c.id.replace(/^emote_/, '');
        demo(m, c);
        if (!owned.has(c.id)) { m.ctx.hud.toast(`${c.name}: ${lockText(c)} at Mossy's stall`); return; }
        const list = p.outfit.emotes.includes(e) ? p.outfit.emotes.filter((x) => x !== e) : [...p.outfit.emotes, e];
        if (!list.length) { m.ctx.hud.toast('Keep at least one emote!'); return; }
        if (list.length > 8) { m.ctx.hud.toast('The emote wheel holds 8 — unequip one first.'); return; }
        net.send({ t: 'profile_update', outfit: { emotes: list } });
        return;
      }
      const next = { ...look, [c.slot]: c.id } as Outfit;
      if (owned.has(c.id)) {
        // Equip: drop any try-ons from other slots that you don't own.
        const clean = { ...p.outfit, [c.slot]: c.id } as Outfit;
        m.preview = null;
        m.ctx.cabin.setOutfit(clean);
        net.send({ t: 'profile_update', outfit: { [c.slot]: c.id } });
      } else {
        m.setPreview(next);
        m.rerender();
      }
      demo(m, c);
    },
  })));

  const tryOn = m.preview ? OUTFIT_SLOTS.map((s) => m.preview![s]).filter((id) => !owned.has(id)) : [];
  const tryBar = tryOn.length
    ? h('div', { class: 'tryon paper' },
      h('div', null, `👗 Trying on: ${tryOn.map((id) => COSMETIC_BY_ID[id]?.name).join(', ')}`),
      h('div', { class: 'row' },
        ...tryOn.filter((id) => isPurchasable(COSMETIC_BY_ID[id])).slice(0, 2).map((id) => h('button', { class: 'btn small gold', disabled: p.coins < priceOf(id), onclick: () => buy(m, id) }, `Buy ${COSMETIC_BY_ID[id].name} · 🪙${fmt(priceOf(id))}`)),
        h('button', { class: 'btn small wood', onclick: () => { m.setPreview(null); m.rerender(); } }, 'Take off')))
    : null;

  return h('div', { class: 'col' },
    h('div', { class: 'row' },
      h('button', { class: 'btn small wood icon', title: 'Spin left', onclick: () => m.ctx.cabin.turn(-0.6) }, '⟲'),
      h('div', { class: 'tiny grow center' }, 'Drag in the mirror to spin your frog'),
      h('button', { class: 'btn small wood icon', title: 'Spin right', onclick: () => m.ctx.cabin.turn(0.6) }, '⟳')),
    tabs(WARDROBE_TABS, slot, (id) => { m.tabs.customize = id; m.rerender(); }),
    slot === 'emote' ? h('div', { class: 'tiny' }, `Emote wheel: ${p.outfit.emotes.length}/8 equipped. Tap to equip or unequip.`) : null,
    tryBar,
    grid,
    h('div', { class: 'row' },
      h('button', { class: 'btn small wood grow', onclick: () => surprise(m, p) }, '🎲 Surprise me'),
      h('button', { class: 'btn small wood grow', onclick: () => m.open('shop') }, '🛒 Get more at the shop')));
}

function surprise(m: Menu, p: ProfilePrivate): void {
  const owned = p.owned.map((id) => COSMETIC_BY_ID[id]).filter(Boolean);
  const patch: Partial<Outfit> = {};
  for (const s of ['skin', 'pattern', 'eyes', 'mouth', 'hat', 'clothes', 'neck', 'face'] as const) {
    const opts = owned.filter((c) => c.slot === s);
    if (opts.length) patch[s] = opts[Math.floor(Math.random() * opts.length)].id;
  }
  audio.sfx('magic');
  m.preview = null;
  m.ctx.cabin.setOutfit({ ...p.outfit, ...patch });
  m.ctx.cabin.frog.play('backflip', true);
  m.ctx.net.send({ t: 'profile_update', outfit: patch });
}

// ───────────────────────── merchant stall ─────────────────────────

const GREETINGS = [
  'Welcome, welcome! Fresh drip, straight from the bog.',
  'Everything here is earned with pond coins. No real money, ever. Mossy has principles.',
  'Hats! Chains! Questionable jackets! Browse, little tadpole.',
  'Today\'s deals are hotter than a lily pad in July.',
];

export function shopPanel(m: Menu): HTMLElement {
  const p = store.profile;
  if (!p) return loading();
  const shop = store.shop;
  const tab = m.tabs.shop ?? 'deals';
  const owned = new Set(p.owned);
  const base = p.outfit;
  const deals = new Map((shop?.deals ?? []).map((d) => [d.id, d]));
  const list: CosmeticDef[] = tab === 'deals'
    ? (shop?.deals ?? []).map((d) => COSMETIC_BY_ID[d.id]).filter(Boolean)
    : COSMETICS.filter((c) => c.slot === tab && (isPurchasable(c) || c.level || c.achievement)).sort((a, b) => a.price - b.price);

  const select = (c: CosmeticDef) => {
    audio.sfx('swap');
    m.selected = c.id;
    m.ctx.cabin.present({ slot: c.slot, id: c.id }, base);
    if (c.slot === 'emote' || c.slot === 'idle') demo(m, c);
    m.rerender();
  };

  const sel = m.selected ? COSMETIC_BY_ID[m.selected] : null;
  let detail: HTMLElement | null = null;
  if (sel) {
    const price = priceOf(sel.id);
    const have = owned.has(sel.id);
    const canBuy = isPurchasable(sel) && !have;
    const wearable = (OUTFIT_SLOTS as string[]).includes(sel.slot);
    detail = h('div', { class: 'detail paper' },
      h('div', { class: 'row' },
        h('div', { class: 'grow' },
          h('b', null, sel.name), ' ', h('span', { class: `rar-label ${sel.rarity}` }, sel.rarity),
          h('div', { class: 'tiny' }, sel.desc ?? describe(sel))),
        h('div', { class: 'coins' }, have ? '✔' : canBuy ? `🪙${fmt(price)}` : '')),
      h('div', { class: 'row' },
        canBuy ? h('button', { class: 'btn small gold grow', disabled: p.coins < price, onclick: () => buy(m, sel.id) }, p.coins < price ? `Need 🪙${fmt(price - p.coins)} more` : 'Buy it!') : null,
        !canBuy && !have ? h('div', { class: 'tiny grow' }, `Unlock: ${lockText(sel)}`) : null,
        wearable ? h('button', { class: 'btn small wood', onclick: () => { m.setPreview({ ...base, [sel.slot]: sel.id } as Outfit); demo(m, sel); } }, '🪞 Try on') : null,
        have && wearable ? h('button', { class: 'btn small wood', onclick: () => { m.ctx.net.send({ t: 'profile_update', outfit: { [sel.slot]: sel.id } }); m.preview = null; demo(m, sel); audio.sfx('swap'); } }, 'Wear it') : null));
  }

  const refresh = shop ? Math.max(0, shop.refreshIn - (Date.now() - m.shopAt)) : 0;
  return h('div', { class: 'col' },
    h('div', { class: 'speech-line bubble' }, GREETINGS[Math.floor(Date.now() / 20000) % GREETINGS.length]),
    tabs(SHOP_TABS, tab, (id) => { m.tabs.shop = id; m.rerender(); }),
    tab === 'deals' ? h('div', { class: 'tiny' }, shop ? `Three daily deals · new stock in ${dur(refresh)}` : 'Mossy is unpacking the deals…') : null,
    detail,
    h('div', { class: 'item-grid scroll-keep' }, ...list.map((c) => {
      const d = deals.get(c.id);
      return itemCard(c, { owned: owned.has(c.id), equipped: equipped(base, c), selected: m.selected === c.id, base, price: isPurchasable(c) ? d?.price ?? c.price : undefined, deal: d?.discount, onClick: () => select(c) });
    })),
    h('div', { class: 'tiny' }, '🪙 Coins come from playing: finishing games, podiums, achievements and level-ups. Cosmetics never change scoring.'));
}

function describe(c: CosmeticDef): string {
  switch (c.slot) {
    case 'title': return 'A title shown under your name at the table.';
    case 'banner': return 'A banner for your scrapbook profile.';
    case 'sticker': return 'A sticker for your scrapbook.';
    case 'emote': return 'An emote for your in-game emote wheel.';
    case 'idle': return 'How your frog fidgets while waiting.';
    default: return `A ${c.rarity} ${c.slot} for your frog.`;
  }
}

function dur(ms: number): string {
  const m = Math.floor(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

// ───────────────────────── record shelf ─────────────────────────

const COLLECTION_TABS: [string, string][] = [['records', '💿 Records'], ['artists', '🎤 Artists'], ['trophies', '🏆 Trophies'], ['achievements', '🎖️ Achievements'], ['cosmetics', '👕 Wardrobe']];

export function collectionPanel(m: Menu): HTMLElement {
  const p = store.profile;
  if (!p) return loading();
  const tab = m.tabs.collection ?? 'records';
  let body: HTMLElement;
  if (tab === 'records') {
    const recs = store.records;
    body = recs.length
      ? h('div', { class: 'records scroll-keep' }, ...recs.map((r) => h('div', { class: 'record', title: `${r.title} — ${r.artist}${r.year ? ` (${r.year})` : ''}\n${r.license}` },
        h('img', { src: recordCoverUrl(r.id, r.title, r.cover, 3), alt: '' }),
        h('b', null, r.title), h('div', null, r.artist), r.year ? h('div', { class: 'tiny' }, String(r.year)) : null)))
      : h('div', { class: 'note' }, 'No records yet! Every song you hear in a game is added to your shelf — with its licence.');
  } else if (tab === 'artists') {
    body = p.artists.length
      ? h('div', { class: 'chips scroll-keep' }, ...p.artists.map((a) => h('span', { class: 'chip on' }, a)))
      : h('div', { class: 'note' }, 'Artists you meet in questions show up here.');
  } else if (tab === 'trophies') {
    const icon = { win: '🏆', podium: '🥈', toad: '🪨' } as const;
    body = p.trophies.length
      ? h('div', { class: 'col scroll-keep', style: { gap: '4px' } }, ...[...p.trophies].reverse().map((t) => h('div', { class: 'player-row' },
        h('span', { class: 'big-ico' }, icon[t.kind]),
        h('span', { class: 'grow' }, t.kind === 'win' ? 'Winner' : t.kind === 'podium' ? 'Podium' : 'Larped one out (toad)', h('div', { class: 'tiny' }, `${MAP_BY_ID[t.map]?.name ?? t.map} · ${t.players} frogs`)),
        h('span', { class: 'tiny' }, new Date(t.at).toLocaleDateString()))))
      : h('div', { class: 'note' }, 'Win or podium in a game to put a trophy on the shelf. Become the toad and you get… a rock.');
  } else if (tab === 'achievements') {
    body = h('div', { class: 'scroll-keep' }, ...ACHIEVEMENTS.map((a) => h('div', { class: `badge${p.achievements[a.id] ? '' : ' off'}`, title: `${a.desc} (+${a.coins} 🪙)` }, h('span', { class: 'ico' }, a.icon), a.name)));
  } else {
    const owned = new Set(p.owned);
    const slots = [...new Set(COSMETICS.map((c) => c.slot))];
    body = h('div', { class: 'col scroll-keep', style: { gap: '4px' } }, ...slots.map((s) => {
      const all = COSMETICS.filter((c) => c.slot === s);
      const have = all.filter((c) => owned.has(c.id)).length;
      return h('div', { class: 'row' }, h('span', { class: 'grow' }, s[0].toUpperCase() + s.slice(1)), h('span', { class: 'xpbar wide' }, h('i', { style: { width: `${(have / all.length) * 100}%` } })), h('span', { class: 'tiny' }, `${have}/${all.length}`));
    }));
  }
  const done = Object.keys(p.achievements).length;
  return h('div', { class: 'col' },
    h('div', { class: 'statgrid' },
      h('span', null, 'Records'), h('b', null, String(p.records.length)),
      h('span', null, 'Artists'), h('b', null, String(p.artists.length)),
      h('span', null, 'Trophies'), h('b', null, String(p.trophies.filter((t) => t.kind !== 'toad').length)),
      h('span', null, 'Achievements'), h('b', null, `${done}/${ACHIEVEMENTS.length}`)),
    tabs(COLLECTION_TABS, tab, (id) => { m.tabs.collection = id; m.rerender(); }),
    body);
}

// ───────────────────────── scrapbook ─────────────────────────

export function profilePanel(m: Menu): HTMLElement {
  const p = store.profile;
  if (!p) return loading();
  const net = m.ctx.net;
  const lv = levelFromXp(p.xp);
  const banner = COSMETIC_BY_ID[p.banner] ?? COSMETIC_BY_ID.banner_swamp;
  const st = p.stats;
  const acc = st.answered ? Math.round((st.correct / st.answered) * 100) : 0;
  const favs = Object.entries(st.categories).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => CATEGORY_BY_ID[id]?.name ?? id);
  const owned = new Set(p.owned);

  const name = h('input', { class: 'input', value: p.name, maxlength: 16, 'aria-label': 'Frog name' }) as HTMLInputElement;
  const saveName = () => {
    const v = name.value.trim();
    if (v && v !== p.name) { net.send({ t: 'profile_update', name: v }); store.saveSettings({ name: v }); audio.sfx('ribbit'); }
  };
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveName(); });
  name.addEventListener('blur', saveName);

  const select = (slot: 'title' | 'banner', cur: string) => {
    const sel = h('select', { class: 'input', 'aria-label': slot }) as HTMLSelectElement;
    for (const c of COSMETICS.filter((x) => x.slot === slot && owned.has(x.id))) sel.appendChild(h('option', { value: c.id, selected: c.id === cur }, c.name));
    sel.addEventListener('change', () => { net.send({ t: 'profile_update', [slot]: sel.value }); audio.sfx('swap'); });
    return sel;
  };

  return h('div', { class: 'col' },
    h('div', { class: 'banner-card', style: { background: `linear-gradient(180deg, ${banner.color2 ?? '#9be36b'} 0%, ${banner.color ?? '#2f5f3a'} 70%)` } },
      h('div', { class: 'bn-name' }, p.name),
      h('div', { class: 'bn-title' }, `“${COSMETIC_BY_ID[p.title]?.name ?? 'Pond Rookie'}”`),
      h('div', { class: 'bn-level' }, `Level ${lv.level}`, h('span', { class: 'xpbar' }, h('i', { style: { width: `${(lv.into / Math.max(1, lv.need)) * 100}%` } })), h('span', { class: 'tiny' }, ` ${lv.into}/${lv.need} XP`))),
    h('label', { class: 'row' }, h('span', { style: { width: '64px' } }, 'Name'), name),
    h('label', { class: 'row' }, h('span', { style: { width: '64px' } }, 'Title'), select('title', p.title)),
    h('label', { class: 'row' }, h('span', { style: { width: '64px' } }, 'Banner'), select('banner', p.banner)),
    h('div', { class: 'statgrid' },
      h('span', null, 'Games'), h('b', null, String(st.games)),
      h('span', null, 'Wins'), h('b', null, String(st.wins)),
      h('span', null, 'Podiums'), h('b', null, String(st.podiums)),
      h('span', null, 'Times toad\'d'), h('b', null, String(st.toads)),
      h('span', null, 'Accuracy'), h('b', null, st.answered ? `${acc}%` : '—'),
      h('span', null, 'Best streak'), h('b', null, String(st.bestStreak)),
      h('span', null, 'Fastest answer'), h('b', null, st.fastestMs ? `${(st.fastestMs / 1000).toFixed(2)}s` : '—'),
      h('span', null, 'Lyrics nailed'), h('b', null, String(st.lyricsCorrect))),
    h('div', { class: 'tiny' }, `Favourite categories: ${favs.length ? favs.join(', ') : 'play a game to find out!'}`),
    h('div', null, ...ACHIEVEMENTS.filter((a) => p.achievements[a.id]).map((a) => h('span', { class: 'mini-badge', title: `${a.name}: ${a.desc}` }, a.icon))),
    stickerBoard(m, p));
}

function stickerBoard(m: Menu, p: ProfilePrivate): HTMLElement {
  const board = h('div', { class: 'scrap', title: 'Drag stickers around. Double-click one to peel it off.' });
  const items = p.scrapbook.map((s) => ({ ...s }));
  let saveTimer = 0;
  const save = () => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => m.ctx.net.send({ t: 'profile_update', scrapbook: items }), 400);
  };
  const draw = () => {
    clear(board);
    items.forEach((s, i) => {
      const el = h('img', { class: 'stk', src: stickerUrl(s.sticker, 4), alt: COSMETIC_BY_ID[s.sticker]?.name ?? '', draggable: false, style: { left: `calc(${s.x * 100}% - 24px)`, top: `calc(${s.y * 100}% - 24px)`, transform: `rotate(${s.r}deg)` } });
      el.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        el.setPointerCapture(ev.pointerId);
        el.style.cursor = 'grabbing';
        audio.sfx('pop', { vol: 0.4 });
        const move = (e: PointerEvent) => {
          const r = board.getBoundingClientRect();
          s.x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
          s.y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
          el.style.left = `calc(${s.x * 100}% - 24px)`;
          el.style.top = `calc(${s.y * 100}% - 24px)`;
        };
        const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.style.cursor = ''; save(); };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
      });
      el.addEventListener('dblclick', () => { items.splice(i, 1); audio.sfx('swap'); draw(); save(); });
      board.appendChild(el);
    });
  };
  draw();
  const stickers = COSMETICS.filter((c) => c.slot === 'sticker' && p.owned.includes(c.id));
  const palette = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px' } }, ...stickers.map((c) => h('button', { class: 'chip', title: `Add ${c.name}`, onclick: () => {
    if (items.length >= 40) { m.ctx.hud.toast('Scrapbook page is full!'); return; }
    items.push({ sticker: c.id, x: 0.15 + Math.random() * 0.7, y: 0.15 + Math.random() * 0.7, r: Math.round((Math.random() - 0.5) * 40) });
    audio.sfx('pop');
    draw();
    save();
  } }, h('img', { src: stickerUrl(c.id, 2), alt: '', style: { width: '24px', height: '24px', imageRendering: 'pixelated', verticalAlign: 'middle' } }))));
  return h('div', { class: 'col', style: { gap: '4px' } }, h('h3', null, '✂️ Sticker page'), board, palette, h('div', { class: 'tiny' }, 'Tap a sticker to add it, drag to move, double-click to remove. More stickers at the shop.'));
}
