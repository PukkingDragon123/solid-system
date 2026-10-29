// Coins, XP, achievements, purchases and profile edits. All of it is validated server-side.

import { MAPS } from '../shared/catalog';
import { COSMETICS, COSMETIC_BY_ID, dailyDeals, isPurchasable, sanitizeOutfit, STARTER_ITEMS, utcDayKey, type Outfit } from '../shared/cosmetics';
import { ACHIEVEMENT_BY_ID, LEVEL_UNLOCKS, LEVEL_UP_COINS, levelFromXp } from '../shared/progression';
import type { ProfilePrivate, RewardSummary, ShopState } from '../shared/protocol';
import type { GameReport } from '../shared/game/Room';
import { sanitizeName } from '../shared/text';

const PLACE_COINS = [60, 40, 30];

/** Grants an achievement (once). Returns true if newly unlocked. */
export function grantAchievement(p: ProfilePrivate, id: string, unlocked: string[] = []): boolean {
  const def = ACHIEVEMENT_BY_ID[id];
  if (!def || p.achievements[id]) return false;
  p.achievements[id] = Date.now();
  p.coins += def.coins;
  for (const c of COSMETICS) {
    if (c.achievement === id && !p.owned.includes(c.id)) {
      p.owned.push(c.id);
      unlocked.push(c.id);
    }
  }
  return true;
}

function applyXp(p: ProfilePrivate, xp: number, unlocked: string[]): { before: number; after: number } {
  const before = levelFromXp(p.xp).level;
  p.xp += xp;
  const after = levelFromXp(p.xp).level;
  for (let lv = before + 1; lv <= after; lv++) {
    p.coins += LEVEL_UP_COINS;
    const item = LEVEL_UNLOCKS[lv];
    if (item && !p.owned.includes(item)) { p.owned.push(item); unlocked.push(item); }
  }
  p.level = after;
  return { before, after };
}

function ownedNonStarter(p: ProfilePrivate): number {
  const starters = new Set(STARTER_ITEMS);
  return p.owned.filter((id) => !starters.has(id)).length;
}

export function computeRewards(report: GameReport, load: (profileId: string) => ProfilePrivate | undefined, save: (p: ProfilePrivate) => void): RewardSummary[] {
  const out: RewardSummary[] = [];
  const n = report.players.length;
  for (const pl of report.players) {
    if (pl.isBot || !pl.profileId) continue;
    const p = load(pl.profileId);
    if (!p) continue;
    const s = pl.stats;
    const achievements: string[] = [];
    const unlocked: string[] = [];
    const before = { coins: p.coins };

    // Coins: everyone gets paid to play; placement and accuracy add more. The toad gets a pity tip.
    let coins = 25 + s.correct * 4 + (PLACE_COINS[pl.place - 1] ?? 10);
    if (pl.isToad && n > 1) coins += 15;
    p.coins += coins;

    // Stats.
    const st = p.stats;
    st.games++;
    if (pl.isWinner) st.wins++;
    if (pl.isToad && n > 1) st.toads++;
    if (pl.place <= 3 && n >= 3) st.podiums++;
    st.answered += s.answered;
    st.correct += s.correct;
    st.bestStreak = Math.max(st.bestStreak, s.bestStreak);
    st.lyricsCorrect += s.lyricsCorrect;
    if (s.fastestMs !== null && (st.fastestMs === null || s.fastestMs < st.fastestMs)) st.fastestMs = s.fastestMs;
    for (const [k, v] of Object.entries(s.categories)) {
      if (k.startsWith('map:')) continue;
      st.categories[k] = (st.categories[k] ?? 0) + v;
    }
    if (!st.mapsPlayed.includes(report.map)) st.mapsPlayed.push(report.map);

    // Collection: records and artists discovered this game.
    const records: string[] = [];
    for (const id of s.songs) if (!p.records.includes(id)) { p.records.push(id); records.push(id); }
    for (const a of s.artists) if (!p.artists.includes(a)) p.artists.push(a);
    if (pl.isWinner && n > 1) p.trophies.push({ id: `t${Date.now().toString(36)}`, kind: 'win', at: Date.now(), map: report.map, players: n });
    else if (pl.place <= 3 && n >= 3) p.trophies.push({ id: `t${Date.now().toString(36)}`, kind: 'podium', at: Date.now(), map: report.map, players: n });
    if (pl.isToad && n > 1) p.trophies.push({ id: `t${Date.now().toString(36)}t`, kind: 'toad', at: Date.now(), map: report.map, players: n });
    if (p.trophies.length > 60) p.trophies = p.trophies.slice(-60);

    // XP.
    const xp = 60 + s.correct * 12 + Math.round(pl.score / 200) + (pl.isWinner ? 50 : 0);
    const lv = applyXp(p, xp, unlocked);

    // Achievements.
    const check = (id: string, cond: boolean) => { if (cond && grantAchievement(p, id, unlocked)) achievements.push(id); };
    check('first_game', true);
    check('first_win', pl.isWinner && n > 1);
    check('larped', pl.isToad && n > 1);
    check('larped_3', st.toads >= 3);
    check('streak_3', s.bestStreak >= 3);
    check('streak_5', s.bestStreak >= 5);
    check('speed', s.fastestMs !== null && s.fastestMs <= 1500);
    check('ear', s.ear);
    check('year_exact', s.yearExact);
    check('lyrics_5', st.lyricsCorrect >= 5);
    check('perfect_round', s.perfectRounds >= 1);
    check('comeback', pl.isWinner && s.lastAtHalf);
    check('sabotage', s.sabotageHit);
    check('wager_big', s.bigWager);
    check('duel_win', s.duelWins >= 1);
    check('party_6', n >= 6);
    check('maps_all', MAPS.every((m) => st.mapsPlayed.includes(m.id)));
    check('games_10', st.games >= 10);
    check('games_50', st.games >= 50);
    check('records_20', p.records.length >= 20);
    check('podium_5', st.podiums >= 5);
    check('collector_10', ownedNonStarter(p) >= 10);

    save(p);
    out.push({
      playerId: pl.id,
      coins: p.coins - before.coins,
      xp,
      levelBefore: lv.before,
      levelAfter: lv.after,
      achievements,
      unlocked,
      records,
    });
  }
  return out;
}

export function shopState(now = Date.now()): ShopState {
  const day = utcDayKey(now);
  const next = new Date(day + 'T00:00:00Z').getTime() + 86400000;
  return { day, deals: dailyDeals(day), refreshIn: next - now };
}

export function buyItem(p: ProfilePrivate, itemId: string, now = Date.now()): { ok: boolean; msg: string; achievements: string[] } {
  const def = COSMETIC_BY_ID[itemId];
  if (!def) return { ok: false, msg: 'That item does not exist.', achievements: [] };
  if (p.owned.includes(itemId)) return { ok: false, msg: 'You already own that!', achievements: [] };
  if (!isPurchasable(def)) return { ok: false, msg: def.level ? `Unlocks at level ${def.level}.` : 'Unlocked by an achievement.', achievements: [] };
  const deal = shopState(now).deals.find((d) => d.id === itemId);
  const price = deal ? deal.price : def.price;
  if (p.coins < price) return { ok: false, msg: `You need ${price - p.coins} more coins.`, achievements: [] };
  p.coins -= price;
  p.owned.push(itemId);
  const achievements: string[] = [];
  if (ownedNonStarter(p) >= 10 && grantAchievement(p, 'collector_10')) achievements.push('collector_10');
  return { ok: true, msg: `Bought ${def.name}!`, achievements };
}

export interface ProfileEdit {
  name?: string;
  outfit?: Partial<Outfit>;
  title?: string;
  banner?: string;
  scrapbook?: ProfilePrivate['scrapbook'];
}

export function editProfile(p: ProfilePrivate, edit: ProfileEdit): string[] {
  const achievements: string[] = [];
  if (edit.name !== undefined) p.name = sanitizeName(edit.name, p.name);
  if (edit.outfit) {
    const owned = new Set(p.owned);
    p.outfit = sanitizeOutfit({ ...p.outfit, ...edit.outfit }, owned);
    const o = p.outfit;
    if (o.hat !== 'hat_none' && o.clothes !== 'clothes_none' && o.neck !== 'neck_none' && o.face !== 'face_none' && grantAchievement(p, 'fashion')) achievements.push('fashion');
  }
  if (edit.title && COSMETIC_BY_ID[edit.title]?.slot === 'title' && p.owned.includes(edit.title)) p.title = edit.title;
  if (edit.banner && COSMETIC_BY_ID[edit.banner]?.slot === 'banner' && p.owned.includes(edit.banner)) p.banner = edit.banner;
  if (Array.isArray(edit.scrapbook)) {
    const clean: ProfilePrivate['scrapbook'] = [];
    for (const s of edit.scrapbook.slice(0, 40)) {
      if (!s || typeof s.sticker !== 'string' || !p.owned.includes(s.sticker) || COSMETIC_BY_ID[s.sticker]?.slot !== 'sticker') continue;
      const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : (lo + hi) / 2);
      clean.push({ sticker: s.sticker, x: num(s.x, 0, 1), y: num(s.y, 0, 1), r: num(s.r, -45, 45) });
    }
    p.scrapbook = clean;
  }
  return achievements;
}

export function titleName(p: ProfilePrivate): string {
  return COSMETIC_BY_ID[p.title]?.name ?? 'Pond Rookie';
}
