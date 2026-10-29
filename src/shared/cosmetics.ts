// Cosmetic catalog. Everything is earnable with in-game coins (or by playing); nothing affects scoring.

import { EMOTES, DEFAULT_EMOTES } from './catalog';

export type Slot = 'skin' | 'pattern' | 'eyes' | 'mouth' | 'hat' | 'clothes' | 'neck' | 'face' | 'idle' | 'emote' | 'title' | 'banner' | 'sticker';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface CosmeticDef {
  id: string;
  slot: Slot;
  name: string;
  price: number; // 0 = free starter item
  rarity: Rarity;
  desc?: string;
  /** Unlocked by reaching a level instead of buying. */
  level?: number;
  /** Unlocked by an achievement instead of buying. */
  achievement?: string;
  /** Primary display colour (also used for skins). */
  color?: string;
  color2?: string;
}

const C = (id: string, slot: Slot, name: string, price: number, rarity: Rarity, extra: Partial<CosmeticDef> = {}): CosmeticDef => ({ id, slot, name, price, rarity, ...extra });

export const COSMETICS: CosmeticDef[] = [
  // ── Skins (body + belly colours) ──
  C('skin_classic', 'skin', 'Classic Pond Green', 0, 'common', { color: '#5fbf3f', color2: '#d9f2a6' }),
  C('skin_lime', 'skin', 'Lime Fizz', 60, 'common', { color: '#9be22d', color2: '#f0ffc2' }),
  C('skin_teal', 'skin', 'Lagoon Teal', 60, 'common', { color: '#2fb5a4', color2: '#c9f5e8' }),
  C('skin_brown', 'skin', 'Mud Pie', 60, 'common', { color: '#9a6b3f', color2: '#f1d9b0' }),
  C('skin_orange', 'skin', 'Tangerine', 90, 'common', { color: '#ff8a2a', color2: '#ffe2b8' }),
  C('skin_yellow', 'skin', 'Lemon Drop', 90, 'common', { color: '#ffd23a', color2: '#fff6c9' }),
  C('skin_blue', 'skin', 'Poison Dart Blue', 120, 'rare', { color: '#2f7bff', color2: '#bfe0ff' }),
  C('skin_purple', 'skin', 'Grape Soda', 120, 'rare', { color: '#8f5cff', color2: '#e6d9ff' }),
  C('skin_pink', 'skin', 'Bubblegum', 120, 'rare', { color: '#ff6fbf', color2: '#ffe0f1' }),
  C('skin_red', 'skin', 'Strawberry Dart', 120, 'rare', { color: '#e8383d', color2: '#ffd2c9' }),
  C('skin_white', 'skin', 'Albino Moon', 250, 'epic', { color: '#f2efe6', color2: '#ffffff' }),
  C('skin_midnight', 'skin', 'Midnight', 250, 'epic', { color: '#2b2f4f', color2: '#7f88c9' }),
  C('skin_glass', 'skin', 'Glass Frog', 600, 'epic', { color: '#a8f0c8', color2: '#e8fff4', desc: 'Slightly see-through. Very fancy.' }),
  C('skin_gold', 'skin', 'Golden Ribbit', 1000, 'legendary', { color: '#ffc531', color2: '#fff1b0', desc: 'Shiny. Smug. Expensive.' }),
  C('skin_rainbow', 'skin', 'Rainbow Shimmer', 0, 'legendary', { level: 20, color: '#ff6f6f', color2: '#ffffff', desc: 'Reach level 20.' }),

  // ── Patterns ──
  C('pat_none', 'pattern', 'Plain', 0, 'common'),
  C('pat_spots', 'pattern', 'Freckle Spots', 60, 'common'),
  C('pat_stripes', 'pattern', 'Tiger Stripes', 120, 'rare'),
  C('pat_camo', 'pattern', 'Bog Camo', 120, 'rare'),
  C('pat_dart', 'pattern', 'Dart Frog Bold', 150, 'rare'),
  C('pat_hearts', 'pattern', 'Heart Spots', 150, 'rare'),
  C('pat_galaxy', 'pattern', 'Starry Speckles', 400, 'epic'),

  // ── Eyes ──
  C('eyes_classic', 'eyes', 'Big Shiny Eyes', 0, 'common'),
  C('eyes_sleepy', 'eyes', 'Sleepy', 60, 'common'),
  C('eyes_angry', 'eyes', 'Grumpy Brows', 90, 'common'),
  C('eyes_tiny', 'eyes', 'Pinprick Panic', 90, 'common'),
  C('eyes_googly', 'eyes', 'Googly', 120, 'rare'),
  C('eyes_side', 'eyes', 'Side-Eye', 120, 'rare'),
  C('eyes_star', 'eyes', 'Starstruck', 150, 'rare'),
  C('eyes_heart', 'eyes', 'Smitten', 150, 'rare'),
  C('eyes_sparkle', 'eyes', 'Anime Sparkle', 250, 'epic'),

  // ── Mouths ──
  C('mouth_smile', 'mouth', 'Smile', 0, 'common'),
  C('mouth_grin', 'mouth', 'Big Grin', 60, 'common'),
  C('mouth_o', 'mouth', 'Shook', 60, 'common'),
  C('mouth_smug', 'mouth', 'Smug', 90, 'common'),
  C('mouth_tongue', 'mouth', 'Blep', 90, 'common'),
  C('mouth_tooth', 'mouth', 'Buck Tooth', 120, 'rare'),
  C('mouth_derp', 'mouth', 'Derp', 150, 'rare'),
  C('mouth_fangs', 'mouth', 'Vamp Fangs', 200, 'rare'),

  // ── Hats ──
  C('hat_none', 'hat', 'No Hat', 0, 'common'),
  C('hat_party', 'hat', 'Party Cone', 60, 'common', { color: '#ff5d9e', color2: '#ffe245' }),
  C('hat_beanie', 'hat', 'Cozy Beanie', 80, 'common', { color: '#e8573f', color2: '#f4f4f4' }),
  C('hat_bucket', 'hat', 'Bucket Hat', 100, 'common', { color: '#d9c38c' }),
  C('hat_backcap', 'hat', 'Backwards Cap', 100, 'common', { color: '#3f6fe8', color2: '#f4f4f4' }),
  C('hat_lilypad', 'hat', 'Lily Pad Sunhat', 120, 'rare', { color: '#4fae3f', color2: '#ff9ec9' }),
  C('hat_chef', 'hat', 'Chef Toque', 120, 'rare', { color: '#ffffff' }),
  C('hat_cowboy', 'hat', 'Swamp Wrangler', 150, 'rare', { color: '#9a6b3f', color2: '#5a3a1f' }),
  C('hat_propeller', 'hat', 'Propeller Cap', 150, 'rare', { color: '#ffd23a', color2: '#e8383d' }),
  C('hat_tophat', 'hat', 'Dapper Top Hat', 200, 'rare', { color: '#24222e', color2: '#c0392b' }),
  C('hat_headphones', 'hat', 'Big Headphones', 200, 'rare', { color: '#2b2b38', color2: '#ff5d5d' }),
  C('hat_viking', 'hat', 'Inflatable Viking', 200, 'rare', { color: '#c8c8d8', color2: '#fff1b0' }),
  C('hat_vinyl', 'hat', 'Vinyl Brim', 250, 'epic', { color: '#161619', color2: '#ff5d5d', desc: 'A whole record. On your head.' }),
  C('hat_mohawk', 'hat', 'Punk Mohawk', 250, 'epic', { color: '#ff2fa0' }),
  C('hat_grad_bear', 'hat', 'Graduation Teddy Cap', 300, 'epic', { color: '#8a5a33', color2: '#24222e', desc: 'Fuzzy teddy ears + a tiny mortarboard. Graduated with honours.' }),
  C('hat_wizard', 'hat', 'Moon Wizard', 300, 'epic', { color: '#3b3f9e', color2: '#ffe245' }),
  C('hat_mushroom', 'hat', 'Mushroom Crown', 350, 'epic', { color: '#e8383d', color2: '#ffc531' }),
  C('hat_halo', 'hat', 'Angel Halo', 400, 'epic', { color: '#fff1b0' }),
  C('hat_crown', 'hat', 'Tiny Crown', 500, 'legendary', { color: '#ffc531', color2: '#e8383d' }),
  C('hat_sprout', 'hat', 'Sprout Cap', 0, 'rare', { level: 5, color: '#6fe05a', desc: 'Reach level 5.' }),

  // ── Clothes ──
  C('clothes_none', 'clothes', 'Au Naturel', 0, 'common'),
  C('clothes_tee', 'clothes', 'Ribbit Tee', 60, 'common', { color: '#f4f4f4', color2: '#3fbf6a' }),
  C('clothes_hoodie', 'clothes', 'Comfy Hoodie', 100, 'common', { color: '#8a8fa8', color2: '#6c7088' }),
  C('clothes_sweater', 'clothes', 'Knit Sweater', 100, 'common', { color: '#c0392b', color2: '#f4f4f4' }),
  C('clothes_hawaiian', 'clothes', 'Hawaiian Shirt', 120, 'rare', { color: '#33b5e5', color2: '#ffe245' }),
  C('clothes_overalls', 'clothes', 'Farm Overalls', 120, 'rare', { color: '#3f6fe8', color2: '#ffd23a' }),
  C('clothes_tracksuit', 'clothes', 'Retro Tracksuit', 150, 'rare', { color: '#7b3fe8', color2: '#f4f4f4' }),
  C('clothes_flannel', 'clothes', 'Grunge Flannel', 150, 'rare', { color: '#b03a2e', color2: '#2b2b38', desc: 'Alternative rock dad energy.' }),
  C('clothes_raincoat', 'clothes', 'Yellow Raincoat', 150, 'rare', { color: '#ffd23a', color2: '#e8b81a' }),
  C('clothes_cape', 'clothes', 'Hero Cape', 200, 'rare', { color: '#e8383d', color2: '#ffc531' }),
  C('clothes_suit', 'clothes', 'Little Suit', 250, 'epic', { color: '#2b2f4f', color2: '#f4f4f4' }),
  C('clothes_punk', 'clothes', 'Spiky Punk Jacket', 300, 'epic', { color: '#1c1c22', color2: '#c8c8d8' }),
  C('clothes_tux', 'clothes', 'Gala Tux', 400, 'epic', { color: '#141418', color2: '#ffffff' }),
  C('clothes_dino', 'clothes', 'Dino Onesie', 450, 'legendary', { color: '#5fbf3f', color2: '#ffd23a', desc: 'A frog dressed as a dinosaur. Evolution is confusing.' }),
  C('clothes_banana', 'clothes', 'Banana Suit', 450, 'legendary', { color: '#ffe245', color2: '#8a6a1f' }),
  C('clothes_varsity', 'clothes', 'Varsity Jacket', 0, 'epic', { level: 15, color: '#2f7bff', color2: '#f4f4f4', desc: 'Reach level 15.' }),

  // ── Neck / back ──
  C('neck_none', 'neck', 'Nothing', 0, 'common'),
  C('neck_bowtie', 'neck', 'Bow Tie', 60, 'common', { color: '#e8383d' }),
  C('neck_scarf', 'neck', 'Cozy Scarf', 80, 'common', { color: '#ff8a2a', color2: '#ffe2b8' }),
  C('neck_bandana', 'neck', 'Bandana', 80, 'common', { color: '#3f6fe8' }),
  C('neck_bell', 'neck', 'Cow Bell', 90, 'common', { color: '#ffc531' }),
  C('neck_flowers', 'neck', 'Flower Lei', 100, 'common', { color: '#ff6fbf', color2: '#ffe245' }),
  C('neck_headphones', 'neck', 'Neck Headphones', 150, 'rare', { color: '#f4f4f4', color2: '#33d6c3' }),
  C('neck_guitar', 'neck', 'Tiny Guitar', 300, 'epic', { color: '#e8383d', color2: '#f4f4f4', desc: 'Slung on your back. Plays exactly zero chords.' }),
  C('neck_chain', 'neck', 'Lily Pad Chain', 350, 'epic', { color: '#ffc531', color2: '#4fae3f', desc: 'Heavy gold. Heavier swagger.' }),
  C('neck_medal', 'neck', 'Pond Medal', 0, 'epic', { level: 10, color: '#ffc531', color2: '#3f6fe8', desc: 'Reach level 10.' }),

  // ── Face ──
  C('face_none', 'face', 'Nothing', 0, 'common'),
  C('face_round', 'face', 'Round Specs', 90, 'common', { color: '#2b2b38' }),
  C('face_eyepatch', 'face', 'Eyepatch', 100, 'common', { color: '#1c1c22' }),
  C('face_shades', 'face', 'Retro Shades', 120, 'rare', { color: '#1c1c22', color2: '#ff5d5d' }),
  C('face_mustache', 'face', 'Fancy Mustache', 120, 'rare', { color: '#3b2414' }),
  C('face_monocle', 'face', 'Monocle', 150, 'rare', { color: '#ffc531' }),
  C('face_3d', 'face', '3D Glasses', 150, 'rare', { color: '#f4f4f4' }),
  C('face_star', 'face', 'Star Shades', 200, 'rare', { color: '#ff6fbf' }),
  C('face_visor', 'face', 'Neon Visor', 250, 'epic', { color: '#33d6c3' }),
  C('face_pixel', 'face', 'Pixel Shades', 300, 'epic', { color: '#141418' }),

  // ── Idle animation styles ──
  C('idle_chill', 'idle', 'Chill', 0, 'common', { desc: 'Blinks, scratches, catches the odd fly.' }),
  C('idle_sleepy', 'idle', 'Snoozy', 100, 'common', { desc: 'Dozes off at every opportunity.' }),
  C('idle_groovy', 'idle', 'Groovy', 150, 'rare', { desc: 'Cannot stop dancing.' }),
  C('idle_hyper', 'idle', 'Hyper', 150, 'rare', { desc: 'Too much fly juice.' }),
  C('idle_dramatic', 'idle', 'Dramatic', 200, 'epic', { desc: 'Falls off chairs. Often.' }),

  // ── Titles ──
  C('title_rookie', 'title', 'Pond Rookie', 0, 'common'),
  C('title_lurker', 'title', 'Professional Lurker', 100, 'common'),
  C('title_iconic', 'title', 'Lowkey Iconic', 150, 'rare'),
  C('title_philosopher', 'title', 'Lily Pad Philosopher', 150, 'rare'),
  C('title_main', 'title', 'Main Character', 200, 'rare'),
  C('title_royalty', 'title', 'Swamp Royalty', 0, 'epic', { achievement: 'first_win' }),
  C('title_larped', 'title', 'Larped Once', 0, 'rare', { achievement: 'larped' }),
  C('title_pro_toad', 'title', 'Professional Toad', 0, 'epic', { achievement: 'larped_3' }),
  C('title_hot', 'title', 'Hot Streak', 0, 'rare', { achievement: 'streak_5' }),
  C('title_speedy', 'title', 'Speedy Ribbit', 0, 'rare', { achievement: 'speed' }),
  C('title_ears', 'title', 'Ear of the Pond', 0, 'epic', { achievement: 'ear' }),
  C('title_year', 'title', 'Year Wizard', 0, 'rare', { achievement: 'year_exact' }),
  C('title_lyric', 'title', 'Lyric Lord', 0, 'epic', { achievement: 'lyrics_5' }),
  C('title_comeback', 'title', 'Comeback Kid', 0, 'epic', { achievement: 'comeback' }),
  C('title_chaos', 'title', 'Chaos Agent', 0, 'rare', { achievement: 'sabotage' }),
  C('title_roller', 'title', 'High Roller', 0, 'rare', { achievement: 'wager_big' }),
  C('title_duel', 'title', 'Duel Champ', 0, 'rare', { achievement: 'duel_win' }),
  C('title_croaker', 'title', 'Certified Croaker', 0, 'rare', { achievement: 'games_10' }),
  C('title_legend', 'title', 'Bog Legend', 0, 'legendary', { achievement: 'games_50' }),
  C('title_vinyl', 'title', 'Vinyl Vulture', 0, 'epic', { achievement: 'records_20' }),
  C('title_fashion', 'title', 'Fashion Frog', 0, 'rare', { achievement: 'fashion' }),
  C('title_party', 'title', 'Party Animal', 0, 'rare', { achievement: 'party_6' }),
  C('title_student', 'title', 'Honour Student', 0, 'common', { achievement: 'tutorial' }),

  // ── Profile banners ──
  C('banner_swamp', 'banner', 'Swamp Dusk', 0, 'common', { color: '#2f5f3a', color2: '#9be36b' }),
  C('banner_sunset', 'banner', 'Sunset Pond', 80, 'common', { color: '#ff8a5c', color2: '#ffe245' }),
  C('banner_rain', 'banner', 'Rainy Window', 120, 'rare', { color: '#3b5b8a', color2: '#b8c6ff' }),
  C('banner_mushroom', 'banner', 'Mushroom Glow', 120, 'rare', { color: '#5a2f8a', color2: '#ff7ad1' }),
  C('banner_retro', 'banner', 'Retro Grid', 120, 'rare', { color: '#1c1c3a', color2: '#ff2fa0' }),
  C('banner_moon', 'banner', 'Big Moon', 150, 'rare', { color: '#1c2450', color2: '#fff1b0' }),
  C('banner_disco', 'banner', 'Disco Fever', 200, 'epic', { color: '#ff2fa0', color2: '#4dffea' }),
  C('banner_world', 'banner', 'World Hopper', 0, 'epic', { achievement: 'maps_all', color: '#3f6fe8', color2: '#6fe05a' }),
  C('banner_gold', 'banner', 'Golden Throne', 500, 'legendary', { color: '#8a6a1f', color2: '#ffc531' }),

  // ── Scrapbook stickers ──
  C('stk_lily', 'sticker', 'Lily Pad', 0, 'common'),
  C('stk_fly', 'sticker', 'Fly', 0, 'common'),
  C('stk_note', 'sticker', 'Music Note', 0, 'common'),
  C('stk_heart', 'sticker', 'Heart', 30, 'common'),
  C('stk_star', 'sticker', 'Gold Star', 30, 'common'),
  C('stk_mushroom', 'sticker', 'Mushroom', 40, 'common'),
  C('stk_vinyl', 'sticker', 'Vinyl', 40, 'common'),
  C('stk_moon', 'sticker', 'Moon', 40, 'common'),
  C('stk_rain', 'sticker', 'Rain Cloud', 40, 'common'),
  C('stk_crown', 'sticker', 'Crown', 60, 'rare'),
  C('stk_dj', 'sticker', 'DJ Lilypadd', 60, 'rare'),
  C('stk_toad', 'sticker', 'Toad', 0, 'rare', { achievement: 'larped' }),

  // ── Emotes (unlock for the emote wheel) ──
  ...EMOTES.map((e) => C(`emote_${e.id}`, 'emote', e.name, e.price, e.price === 0 ? 'common' : e.price >= 200 ? 'epic' : 'rare')),
];

export const COSMETIC_BY_ID: Record<string, CosmeticDef> = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));

export function isPurchasable(c: CosmeticDef): boolean {
  return c.price > 0 && !c.level && !c.achievement;
}

export const STARTER_ITEMS = COSMETICS.filter((c) => c.price === 0 && !c.level && !c.achievement).map((c) => c.id);

export interface Outfit {
  skin: string;
  pattern: string;
  eyes: string;
  mouth: string;
  hat: string;
  clothes: string;
  neck: string;
  face: string;
  idle: string;
  emotes: string[]; // up to 8 equipped emote ids (without the emote_ prefix)
}

export const DEFAULT_OUTFIT: Outfit = {
  skin: 'skin_classic',
  pattern: 'pat_none',
  eyes: 'eyes_classic',
  mouth: 'mouth_smile',
  hat: 'hat_none',
  clothes: 'clothes_none',
  neck: 'neck_none',
  face: 'face_none',
  idle: 'idle_chill',
  emotes: DEFAULT_EMOTES.slice(0, 8),
};

export const OUTFIT_SLOTS: (keyof Omit<Outfit, 'emotes'>)[] = ['skin', 'pattern', 'eyes', 'mouth', 'hat', 'clothes', 'neck', 'face', 'idle'];

/** Coerces arbitrary input into a valid outfit, falling back to defaults for unknown or unowned items. */
export function sanitizeOutfit(raw: unknown, owned?: ReadonlySet<string>): Outfit {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Outfit = { ...DEFAULT_OUTFIT, emotes: DEFAULT_OUTFIT.emotes.slice() };
  for (const slot of OUTFIT_SLOTS) {
    const id = src[slot];
    if (typeof id !== 'string') continue;
    const def = COSMETIC_BY_ID[id];
    if (!def || def.slot !== slot) continue;
    if (owned && !owned.has(id)) continue;
    out[slot] = id;
  }
  if (Array.isArray(src.emotes)) {
    const emotes: string[] = [];
    for (const e of src.emotes) {
      if (typeof e !== 'string' || emotes.includes(e)) continue;
      const def = COSMETIC_BY_ID[`emote_${e}`];
      if (!def) continue;
      if (owned && !owned.has(def.id)) continue;
      emotes.push(e);
      if (emotes.length >= 8) break;
    }
    if (emotes.length) out.emotes = emotes;
  }
  return out;
}

/** Deterministic daily deals — three discounted purchasable cosmetics per UTC day. */
export function dailyDeals(dayKey: string): { id: string; price: number; discount: number }[] {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < dayKey.length; i++) { h ^= dayKey.charCodeAt(i); h = Math.imul(h, 16777619); }
  const pool = COSMETICS.filter((c) => isPurchasable(c) && c.slot !== 'sticker' && c.slot !== 'title' && c.price >= 80);
  const picks: CosmeticDef[] = [];
  let seed = h;
  while (picks.length < 3 && picks.length < pool.length) {
    seed = (Math.imul(seed ^ (seed >>> 13), 1274126177) + 0x9e3779b9) >>> 0;
    const c = pool[seed % pool.length];
    if (!picks.includes(c)) picks.push(c);
  }
  return picks.map((c, i) => {
    const discount = [0.5, 0.35, 0.25][i];
    return { id: c.id, price: Math.max(10, Math.round((c.price * (1 - discount)) / 5) * 5), discount };
  });
}

export function utcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
