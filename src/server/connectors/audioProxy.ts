// Same-origin proxy for externally hosted, openly licensed audio files. Clients only ever see an
// opaque token (so the file name can't leak the answer), and only URLs registered by our own
// connectors can be fetched — this is not an open proxy.

import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

const registry = new Map<string, { url: string; expires: number }>();
const TTL = 6 * 3600 * 1000;

export function registerAudio(url: string): string {
  const token = randomBytes(12).toString('base64url');
  registry.set(token, { url, expires: Date.now() + TTL });
  if (registry.size > 5000) {
    const now = Date.now();
    for (const [k, v] of registry) if (v.expires < now) registry.delete(k);
  }
  return `/api/audio/${token}`;
}

export async function proxyAudio(req: IncomingMessage, res: ServerResponse, token: string): Promise<void> {
  const entry = registry.get(token);
  if (!entry || entry.expires < Date.now()) { res.writeHead(404).end(); return; }
  try {
    const headers: Record<string, string> = {};
    if (req.headers.range) headers.range = String(req.headers.range);
    const upstream = await fetch(entry.url, { headers });
    if (!upstream.ok && upstream.status !== 206) { res.writeHead(502).end(); return; }
    const pass: Record<string, string> = { 'cache-control': 'private, max-age=3600' };
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const v = upstream.headers.get(h);
      if (v) pass[h] = v;
    }
    res.writeHead(upstream.status, pass);
    if (upstream.body) Readable.fromWeb(upstream.body as never).pipe(res);
    else res.end();
  } catch {
    res.writeHead(502).end();
  }
}
