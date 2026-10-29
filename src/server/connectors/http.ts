// Small fetch wrapper with timeouts, a polite User-Agent and per-host pacing (MusicBrainz asks for ≤1 req/s).

const UA = process.env.LOO_USER_AGENT ?? 'LarpedOneOut/1.0 (+https://github.com/PukkingDragon123/solid-system)';
const lastHit = new Map<string, number>();

export async function getJson<T>(url: string, init: { headers?: Record<string, string>; minGapMs?: number; timeoutMs?: number; method?: string; body?: string } = {}): Promise<T> {
  const host = new URL(url).host;
  const gap = init.minGapMs ?? 0;
  if (gap) {
    const wait = (lastHit.get(host) ?? 0) + gap - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastHit.set(host, Date.now());
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 10000);
  try {
    const res = await fetch(url, {
      method: init.method ?? 'GET',
      body: init.body,
      headers: { 'user-agent': UA, accept: 'application/json', ...(init.headers ?? {}) },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`${host} responded ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}
