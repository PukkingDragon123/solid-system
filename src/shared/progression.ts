// Levels, XP and achievements. Tuned so a typical game (~12 min) gives a level-up every game or two early on.

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  coins: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'tutorial', name: 'Class Dismissed', desc: 'Finish DJ Lilypadd\'s tutorial', icon: '🎓', coins: 100 },
  { id: 'first_game', name: 'Hop In', desc: 'Play your first full game', icon: '🐸', coins: 50 },
  { id: 'first_win', name: 'Lily Pad Royalty', desc: 'Win a game', icon: '👑', coins: 100 },
  { id: 'larped', name: 'Larped', desc: 'Get exposed as the toad', icon: '🪨', coins: 40 },
  { id: 'larped_3', name: 'Serial Toad', desc: 'Become the toad three times', icon: '🍄', coins: 80 },
  { id: 'streak_3', name: 'Hat Trick', desc: 'Answer 3 in a row correctly', icon: '🎩', coins: 30 },
  { id: 'streak_5', name: 'On Fire', desc: 'Answer 5 in a row correctly', icon: '🔥', coins: 60 },
  { id: 'speed', name: 'Lightning Tongue', desc: 'Answer correctly within 1.5 seconds', icon: '⚡', coins: 40 },
  { id: 'ear', name: 'Golden Ears', desc: 'Guess a song from the 0.5 second clip', icon: '👂', coins: 80 },
  { id: 'year_exact', name: 'Time Traveler', desc: 'Guess a release year exactly', icon: '⏳', coins: 40 },
  { id: 'lyrics_5', name: 'Lyric Lord', desc: 'Finish 5 lyrics correctly (lifetime)', icon: '🎶', coins: 60 },
  { id: 'perfect_round', name: 'Flawless Croak', desc: 'Get every question in a round right', icon: '💎', coins: 60 },
  { id: 'comeback', name: 'Comeback Kid', desc: 'Win after being last at the halfway point', icon: '🚀', coins: 120 },
  { id: 'sabotage', name: 'Chaos Agent', desc: 'Your sabotage target answers wrong', icon: '🪰', coins: 40 },
  { id: 'wager_big', name: 'High Roller', desc: 'Win a wager of 500+ points', icon: '🎲', coins: 60 },
  { id: 'duel_win', name: 'Duel Champ', desc: 'Win a frog duel', icon: '⚔️', coins: 40 },
  { id: 'party_6', name: 'Party Animal', desc: 'Play a game with 6+ frogs', icon: '🎉', coins: 50 },
  { id: 'maps_all', name: 'World Hopper', desc: 'Play on all six maps', icon: '🗺️', coins: 150 },
  { id: 'games_10', name: 'Certified Croaker', desc: 'Play 10 games', icon: '📼', coins: 100 },
  { id: 'games_50', name: 'Bog Legend', desc: 'Play 50 games', icon: '🏆', coins: 300 },
  { id: 'records_20', name: 'Crate Digger', desc: 'Discover 20 records', icon: '💿', coins: 80 },
  { id: 'podium_5', name: 'Podium Regular', desc: 'Finish top 3 five times', icon: '🥉', coins: 80 },
  { id: 'collector_10', name: 'Collector', desc: 'Own 10 non-starter cosmetics', icon: '🧺', coins: 60 },
  { id: 'fashion', name: 'Fashion Frog', desc: 'Wear a hat, clothes, neck and face item at once', icon: '🕶️', coins: 40 },
];

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/** XP needed to go from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return 150 + 50 * (level - 1);
}

export function levelFromXp(totalXp: number): { level: number; into: number; need: number } {
  let level = 1;
  let rest = Math.max(0, Math.floor(totalXp));
  while (rest >= xpForLevel(level) && level < 999) {
    rest -= xpForLevel(level);
    level++;
  }
  return { level, into: rest, need: xpForLevel(level) };
}

export const LEVEL_UP_COINS = 40;

export const LEVEL_UNLOCKS: Record<number, string> = {
  5: 'hat_sprout',
  10: 'neck_medal',
  15: 'clothes_varsity',
  20: 'skin_rainbow',
};

export const STARTING_COINS = 150;
