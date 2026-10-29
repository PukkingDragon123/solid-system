// End-to-end multiplayer test: starts the real server (with a 10× faster room clock), connects two
// WebSocket players plus a bot, plays a whole game — including a mid-game disconnect and reconnect —
// and checks rewards, profiles and the HTTP API. Run with `npm run test:e2e`.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

const PORT = 8790 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
const tmp = mkdtempSync(join(tmpdir(), 'loo-e2e-'));
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); console.log(`${ok ? '  ✔' : '  ✖'} ${msg}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, ['--import', 'tsx', 'src/server/main.ts'], {
  env: { ...process.env, PORT: String(PORT), LOO_TIME_SCALE: '10', LOO_OFFLINE: '1', LOO_DB: join(tmp, 'profiles.sqlite') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error(`server did not start:\n${serverLog}`);
}

/** A scripted player: votes, answers and makes social picks automatically. */
class Player {
  constructor(name) {
    this.name = name;
    this.msgs = [];
    this.phases = new Set();
    this.room = null;
    this.session = null;
    this.profile = null;
    this.errors = [];
    this.answered = new Set();
    this.rewards = null;
  }

  connect(token) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
      this.ws = ws;
      ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', v: 3, token, name: this.name })));
      ws.on('error', reject);
      ws.on('message', (raw) => {
        const m = JSON.parse(String(raw));
        this.msgs.push(m);
        if (m.t === 'welcome') { this.token = m.token; this.profile = m.profile; resolve(); }
        if (m.t === 'profile') this.profile = m.profile;
        if (m.t === 'error') this.errors.push(m);
        if (m.t === 'room') { if (m.session) this.session = m.session; this.onRoom(m.s); }
      });
    });
  }

  send(m) { if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m)); }

  waitFor(pred, ms = 30000, what = 'condition') {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const tick = () => {
        const v = pred();
        if (v) return resolve(v);
        if (Date.now() - start > ms) return reject(new Error(`${this.name}: timed out waiting for ${what}`));
        setTimeout(tick, 25);
      };
      tick();
    });
  }

  onRoom(s) {
    this.room = s;
    const ph = s.phase;
    this.phases.add(ph.id);
    if (ph.id === 'rewards') this.rewards = ph.rewards;
    const vote = (options) => { if (!ph.votes?.[s.you.id] && options?.length) this.send({ t: 'vote', target: options[Math.floor(Math.random() * options.length)].id }); };
    if (ph.id === 'map_vote' || ph.id === 'category_vote') vote(ph.options);
    if (ph.id === 'rematch_vote') this.send({ t: 'vote', target: 'lobby' });
    if (ph.id === 'question' && !this.answered.has(ph.q.id)) {
      this.answered.add(ph.q.id);
      const q = ph.q;
      // Secret answers must never reach clients.
      const leaked = JSON.stringify(q).match(/correctId|correctLabel|"correct"/);
      if (leaked) failures.push(`question ${q.id} leaked ${leaked[0]}`);
      const delay = 50 + Math.random() * 200;
      setTimeout(() => {
        if (q.input === 'choice') this.send({ t: 'answer', q: q.id, choice: q.choices[Math.floor(Math.random() * q.choices.length)].id });
        else if (q.input === 'year') this.send({ t: 'answer', q: q.id, year: Math.round((q.yearRange[0] + q.yearRange[1]) / 2) });
        else this.send({ t: 'answer', q: q.id, text: 'frog' });
      }, delay);
    }
    if (ph.id === 'social_setup' && !ph.doneIds.includes(s.you.id)) {
      if (ph.social === 'wager') this.send({ t: 'social', wager: 0 });
      else if (ph.social !== 'duel' || ph.chooser === s.you.id) {
        const t = ph.targets.find((id) => id !== s.you.id);
        if (t) this.send({ t: 'social', target: t });
      }
    }
  }

  close() { this.ws?.close(); }
}

async function main() {
  await waitForServer();
  console.log(`LARPED ONE OUT e2e — server on :${PORT}`);

  const info = await (await fetch(`${BASE}/api/info`)).json();
  check(info.content?.playable > 20, `/api/info reports playable songs (${info.content?.playable})`);
  const credits = await (await fetch(`${BASE}/api/credits`)).json();
  check(Array.isArray(credits.music) && credits.music.every((m) => m.composition && m.basis), '/api/credits lists a licence and basis for every playable piece');

  const a = new Player('Ribbita');
  const b = new Player('Hopkins');
  await a.connect();
  await b.connect();
  check(a.profile?.coins > 0, 'new profiles start with coins');

  // Host creates a fast private room; guest joins by code.
  a.send({ t: 'create', settings: { rounds: 3, questionsPerRound: 2, timer: 12, isPublic: false } });
  const code = await a.waitFor(() => a.room?.code, 5000, 'room code');
  check(/^[A-Z]{4}$/.test(code), `room code looks right (${code})`);
  b.send({ t: 'join', code });
  await b.waitFor(() => b.room?.players.length === 2, 5000, 'guest seated');
  check(a.room.hostId === a.room.you.id, 'creator is host');

  b.send({ t: 'start' });
  await sleep(200);
  check(a.room.phase.id === 'lobby', 'non-host cannot start the game');

  a.send({ t: 'bot_add' });
  await a.waitFor(() => a.room?.players.length === 3, 5000, 'bot seated');
  b.send({ t: 'ready', v: true });
  a.send({ t: 'start' });
  await a.waitFor(() => a.room?.phase.id !== 'lobby', 5000, 'game start');
  check(true, 'host started the game with 2 humans + 1 bot');

  // Mid-game: the guest drops and comes back with the same seat.
  await b.waitFor(() => b.phases.has('question_reveal'), 120000, 'first reveal');
  const oldId = b.room.you.id;
  const session = b.session;
  b.close();
  await sleep(400);
  const b2 = new Player('Hopkins');
  b2.answered = b.answered;
  await b2.connect(b.token);
  b2.send({ t: 'join', code, session });
  await b2.waitFor(() => b2.room, 5000, 'rejoin');
  check(b2.room.you.id === oldId, 'reconnect restores the same seat');
  check(b2.room.players.find((p) => p.id === oldId)?.connected, 'reconnected player shows as connected');

  // Play to the end.
  await a.waitFor(() => a.phases.has('rewards'), 240000, 'rewards');
  const required = ['map_vote', 'map_reveal', 'category_vote', 'question', 'question_reveal', 'scoreboard', 'finale', 'rewards'];
  for (const p of required) check(a.phases.has(p), `host saw phase ${p}`);
  check(a.phases.has('round_intro') || a.phases.has('final_intro'), 'host saw a round intro');
  const rw = a.rewards ?? [];
  check(rw.length === 2, `rewards for both humans (${rw.length})`);
  check(rw.every((r) => r.coins > 0 && r.xp > 0), 'every human earned coins and XP');
  await a.waitFor(() => a.profile?.stats.games === 1, 5000, 'profile update');
  check(a.profile.stats.games === 1, 'host profile counts the finished game');
  await b2.waitFor(() => b2.profile?.stats.games === 1, 5000, 'guest profile update');
  check(b2.profile.stats.games === 1, 'reconnected guest profile counts the finished game');

  // Shop: buy something cheap with earned coins.
  a.send({ t: 'shop' });
  const shop = await a.waitFor(() => a.msgs.find((m) => m.t === 'shop'), 3000, 'shop');
  check(shop.shop.deals.length === 3, 'shop offers three daily deals');
  const coins = a.profile.coins;
  a.send({ t: 'buy', item: 'skin_lime' });
  await a.waitFor(() => a.profile.owned.includes('skin_lime') || a.errors.some((e) => e.code === 'buy_failed'), 3000, 'purchase');
  check(a.profile.owned.includes('skin_lime') && a.profile.coins === coins - 60, 'buying deducts coins and grants the item');
  a.send({ t: 'buy', item: 'skin_rainbow' });
  await sleep(300);
  check(!a.profile.owned.includes('skin_rainbow'), 'level-locked items cannot be bought');

  // Unknown room code gives a friendly error.
  a.send({ t: 'join', code: 'ZZZZ' });
  await a.waitFor(() => a.errors.some((e) => e.code === 'no_room'), 3000, 'no_room error');
  check(true, 'joining a missing room reports an error');

  a.close();
  b2.close();
}

let exitCode = 0;
try {
  await main();
} catch (err) {
  failures.push(String(err.message ?? err));
  console.error(err);
}
server.kill();
rmSync(tmp, { recursive: true, force: true });
if (failures.length) {
  console.log(`\n✖ ${failures.length} failure(s):\n - ${failures.join('\n - ')}`);
  exitCode = 1;
} else {
  console.log('\n✔ e2e passed');
}
process.exit(exitCode);
