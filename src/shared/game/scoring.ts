// Server-authoritative scoring rules. Accuracy first, speed second, streaks and comebacks on top.

export const BASE_POINTS = 1000;
export const STAGE_MULT = [1, 0.85, 0.7, 0.55, 0.42];
export const CLUE_MULT = [1, 0.8, 0.62, 0.45];

/** Correct answer value given how long it took: 100% instantly, 45% at the buzzer. */
export function speedFactor(ms: number, limitMs: number): number {
  const f = 1 - Math.max(0, Math.min(1, ms / Math.max(1, limitMs)));
  return 0.45 + 0.55 * f;
}

export function yearScore(guess: number, actual: number): number {
  const d = Math.abs(guess - actual);
  if (d === 0) return 1;
  if (d === 1) return 0.7;
  if (d === 2) return 0.5;
  if (d <= 4) return 0.3;
  if (d <= 6) return 0.12;
  return 0;
}

export function streakBonus(streak: number): number {
  return streak >= 2 ? 100 * Math.min(streak - 1, 5) : 0;
}

/** Players in the bottom third (after round 1) earn +20% on correct answers. */
export function underdogFactor(rank: number, playerCount: number, round: number): number {
  if (round <= 1 || playerCount < 3) return 0;
  const bottomStart = Math.ceil((playerCount * 2) / 3);
  return rank > bottomStart - 1 && rank >= 2 ? 0.2 : 0;
}

export function wagerOptions(score: number): number[] {
  if (score < 400) return [0, 100, 200];
  const r = (x: number) => Math.max(50, Math.round(x / 50) * 50);
  return [0, r(score * 0.25), r(score * 0.5), r(score)].filter((v, i, a) => a.indexOf(v) === i);
}

export function duelSteal(victimScore: number): number {
  return Math.min(500, Math.max(0, Math.round((victimScore * 0.25) / 10) * 10));
}

export const PREDICT_BONUS = 250;
export const SABOTAGE_BONUS = 200;
export const UNSHAKEN_BONUS = 150;
