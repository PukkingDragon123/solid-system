// LARPED ONE OUT game server: serves the built client, the WebSocket game protocol and a tiny JSON API.

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { PROTOCOL_VERSION, type C2S, type S2C } from '../shared/protocol';
import { buildContent, contentSummary, creditsManifest, recordsFor } from './content';
import { buyItem, editProfile, shopState } from './economy';
import { connectorFeatures, importPlaylist } from './connectors';
import { proxyAudio } from './connectors/audioProxy';
import { ProfileStore } from './ProfileStore';
import { RoomManager, type Client } from './RoomManager';
import { grantAchievement } from './economy';

const PORT = Number(process.env.PORT ?? 8787);
const HERE = fileURLToPath(new URL('.', import.meta.url));
const STATIC_DIR = resolve(process.env.LOO_STATIC ?? join(HERE, '../client'));
const DATA_FILE = process.env.LOO_DB ?? resolve(process.cwd(), 'data/profiles.sqlite');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const profiles = new ProfileStore();
await profiles.init(DATA_FILE);
const content = buildContent();
const rooms = new RoomManager(() => content, profiles);

function lanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://x');
  let path = decodeURIComponent(url.pathname);
  if (path === '/' || !extname(path)) path = '/index.html';
  const file = normalize(join(STATIC_DIR, path));
  if (!file.startsWith(STATIC_DIR)) { res.writeHead(403).end(); return; }
  if (!existsSync(file) || !statSync(file).isFile()) {
    if (!existsSync(join(STATIC_DIR, 'index.html'))) {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('LARPED ONE OUT server is running. Run `npm run build` to serve the client from here, or use `npm run dev`.');
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    return;
  }
  const immutable = path.startsWith('/assets/');
  res.writeHead(200, {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
  });
  createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/api/health') return json(res, 200, { ok: true, ...rooms.stats() });
  if (url.pathname === '/api/info') return json(res, 200, { lan: lanAddresses(), port: PORT, version: PROTOCOL_VERSION, features: connectorFeatures(), content: contentSummary(content) });
  if (url.pathname === '/api/rooms') return json(res, 200, rooms.publicRooms());
  if (url.pathname === '/api/credits') return json(res, 200, creditsManifest(content));
  if (url.pathname.startsWith('/api/audio/')) { void proxyAudio(req, res, url.pathname.slice('/api/audio/'.length)); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  serveStatic(req, res);
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

wss.on('connection', (ws: WebSocket) => {
  const client: Client = {
    ws,
    profile: null,
    token: null,
    room: null,
    playerId: null,
    send(msg: S2C) {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    },
  };
  let alive = true;
  let msgBudget = 80;
  let budgetAt = Date.now();
  ws.on('pong', () => { alive = true; });
  const ping = setInterval(() => {
    if (!alive) { ws.terminate(); return; }
    alive = false;
    ws.ping();
  }, 20000);

  ws.on('message', async (data) => {
    const now = Date.now();
    msgBudget = Math.min(80, msgBudget + ((now - budgetAt) / 1000) * 50);
    budgetAt = now;
    if (msgBudget < 1) return;
    msgBudget--;
    let msg: C2S;
    try {
      msg = JSON.parse(String(data));
      if (!msg || typeof msg !== 'object' || typeof (msg as { t?: unknown }).t !== 'string') return;
    } catch {
      return;
    }
    if (msg.t === 'ping') { client.send({ t: 'pong', c: Number(msg.c) || 0, s: Date.now() }); return; }
    if (msg.t === 'hello') {
      const { token, profile } = profiles.login(msg.token, typeof msg.name === 'string' ? msg.name : undefined);
      client.profile = profile;
      client.token = token;
      client.send({ t: 'welcome', token, profile, serverTime: Date.now(), features: connectorFeatures() });
      return;
    }
    const p = client.profile;
    if (!p) { client.send({ t: 'error', code: 'no_hello', msg: 'Say hello first.' }); return; }

    switch (msg.t) {
      case 'profile_update': {
        const achievements = editProfile(p, msg);
        profiles.save(p);
        client.send({ t: 'profile', profile: p });
        for (const a of achievements) client.send({ t: 'achievement', id: a });
        rooms.refreshPlayer(client);
        return;
      }
      case 'buy': {
        const r = buyItem(p, String(msg.item));
        if (r.ok) profiles.save(p);
        client.send({ t: 'profile', profile: p });
        if (!r.ok) client.send({ t: 'error', code: 'buy_failed', msg: r.msg });
        for (const a of r.achievements) client.send({ t: 'achievement', id: a });
        return;
      }
      case 'shop':
        client.send({ t: 'shop', shop: shopState() });
        return;
      case 'records':
        client.send({ t: 'records', records: recordsFor(content, p.records) });
        return;
      case 'tutorial_done': {
        if (!p.tutorialDone) {
          p.tutorialDone = true;
          if (grantAchievement(p, 'tutorial')) client.send({ t: 'achievement', id: 'tutorial' });
          profiles.save(p);
          client.send({ t: 'profile', profile: p });
        }
        return;
      }
      case 'create':
        rooms.create(client, msg.settings);
        return;
      case 'join':
        rooms.join(client, msg.code, msg.session);
        return;
      case 'quick':
        rooms.quick(client);
        return;
      case 'leave':
        rooms.leave(client);
        client.send({ t: 'left', reason: 'left' });
        return;
      case 'rooms':
        client.send({ t: 'rooms', rooms: rooms.publicRooms() });
        return;
      case 'import_playlist': {
        if (!client.room || client.room.hostId !== client.playerId) {
          client.send({ t: 'playlist', ok: false, msg: 'Only the host can import a playlist.' });
          return;
        }
        const room = client.room;
        const result = await importPlaylist(String(msg.url ?? ''));
        if (result.ok && result.pack && client.room === room) {
          // Imported content is scoped to this room only and is never persisted.
          room.setContent(buildContent([result.pack]));
        }
        client.send({ t: 'playlist', ok: result.ok, msg: result.msg, count: result.count });
        return;
      }
      default:
        rooms.route(client, msg);
    }
  });

  ws.on('close', () => {
    clearInterval(ping);
    rooms.onClose(client);
  });
  ws.on('error', () => ws.terminate());
});

server.listen(PORT, () => {
  const lan = lanAddresses();
  console.log(`\n🐸 LARPED ONE OUT server listening on http://localhost:${PORT}`);
  if (lan.length) console.log(`   On your network: ${lan.map((a) => `http://${a}:${PORT}`).join('  ')}`);
  console.log(`   Content: ${JSON.stringify(contentSummary(content))}\n`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    wss.close();
    server.close();
    process.exit(0);
  });
}
