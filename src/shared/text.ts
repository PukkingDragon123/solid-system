// Text helpers: player name sanitising and forgiving answer matching.

const BLOCKED = ['nigg', 'fagg', 'retard', 'kike', 'chink', 'spic', 'tranny', 'cunt', 'rape', 'nazi', 'hitler'];

export const NAME_MIN = 2;
export const NAME_MAX = 16;

export function sanitizeName(raw: unknown, fallback = 'Froggo'): string {
  if (typeof raw !== 'string') return fallback;
  // Keep letters (any script), digits, spaces and a few friendly symbols.
  let s = raw.normalize('NFKC').replace(/[^\p{L}\p{N} _.\-!?'~*]/gu, '').replace(/\s+/g, ' ').trim();
  s = Array.from(s).slice(0, NAME_MAX).join('');
  if (Array.from(s).length < NAME_MIN) return fallback;
  const low = s.toLowerCase().replace(/[^a-z]/g, '');
  if (BLOCKED.some((b) => low.includes(b))) return fallback;
  return s;
}

export function normalizeAnswer(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  let cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** Forgiving comparison for typed answers: ignores case, punctuation, articles and small typos. */
export function answersMatch(given: string, expected: string, aliases: readonly string[] = []): boolean {
  const g = normalizeAnswer(given);
  if (!g) return false;
  for (const cand of [expected, ...aliases]) {
    const e = normalizeAnswer(cand);
    if (!e) continue;
    if (g === e) return true;
    const dist = levenshtein(g, e);
    const allowed = e.length <= 4 ? 0 : e.length <= 8 ? 1 : Math.floor(e.length * 0.2);
    if (dist <= allowed) return true;
    // Accept answers that contain every word of a multi-word target ("bohemian rhapsody queen").
    const words = e.split(' ').filter((w) => w.length > 1);
    if (words.length >= 2 && words.every((w) => g.split(' ').includes(w))) return true;
  }
  return false;
}

export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.max(min, Math.min(max, n));
}
