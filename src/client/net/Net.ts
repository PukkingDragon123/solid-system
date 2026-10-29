// WebSocket client: automatic reconnect, clock sync, room session restore, typed handlers.

import { PROTOCOL_VERSION, type C2S, type S2C } from '../../shared/protocol';

type Handler<T extends S2C['t']> = (msg: Extract<S2C, { t: T }>) => void;

export interface Transport {
  send(msg: C2S): void;
  on<T extends S2C['t']>(t: T, fn: Handler<T>): () => void;
  serverNow(): number;
  readonly online: boolean;
}

const TOKEN_KEY = 'loo_token';

export function storage(): Storage | null {
  try {
    const s = window.localStorage;
    s.setItem('__t', '1');
    s.removeItem('__t');
    return s;
  } catch {
    return null;
  }
}

export class Net implements Transport {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<(m: S2C) => void>>();
  private backoff = 500;
  private pingTimer = 0;
  private pings = 0;
  private offset = 0;
  private bestRtt = Infinity;
  private outbox: C2S[] = [];
  private closedByUs = false;
  status: 'connecting' | 'open' | 'closed' = 'closed';
  roomCode: string | null = null;
  session: string | null = null;
  name = '';

  constructor(private url = Net.defaultUrl()) {
    this.on('room', (m) => {
      this.roomCode = m.s.code;
      if (m.session) {
        this.session = m.session;
        try { sessionStorage.setItem(`loo_session_${m.s.code}`, m.session); } catch { /* ignore */ }
      }
    });
    this.on('left', () => { this.roomCode = null; this.session = null; });
    this.on('pong', (m) => {
      const now = performance.now();
      const rtt = now - m.c;
      if (rtt < this.bestRtt * 1.2 || this.pings < 3) {
        this.bestRtt = Math.min(this.bestRtt, rtt);
        // serverTime ≈ m.s + rtt/2 at local time `now` (Date-based).
        this.offset = m.s + rtt / 2 - (Date.now() - 0);
      }
    });
    this.on('welcome', (m) => {
      const s = storage();
      s?.setItem(TOKEN_KEY, m.token);
      if (this.offset === 0) this.offset = m.serverTime - Date.now();
      // Restore our seat after a reconnect.
      if (this.roomCode && this.session) this.send({ t: 'join', code: this.roomCode, session: this.session });
    });
  }

  static defaultUrl(): string {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}/ws`;
  }

  get online(): boolean {
    return this.status === 'open';
  }

  connect(): void {
    this.closedByUs = false;
    this.status = 'connecting';
    this.emit({ t: 'error', code: 'status', msg: 'connecting' });
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.status = 'open';
      this.backoff = 500;
      const token = storage()?.getItem(TOKEN_KEY) ?? undefined;
      this.rawSend({ t: 'hello', v: PROTOCOL_VERSION, token, name: this.name || undefined });
      for (const m of this.outbox.splice(0)) this.rawSend(m);
      this.pings = 0;
      this.ping();
      this.emitStatus();
    };
    ws.onmessage = (ev) => {
      let msg: S2C;
      try { msg = JSON.parse(ev.data as string); } catch { return; }
      this.emit(msg);
    };
    ws.onclose = () => {
      this.status = 'closed';
      window.clearTimeout(this.pingTimer);
      this.emitStatus();
      if (this.closedByUs) return;
      window.setTimeout(() => this.connect(), this.backoff);
      this.backoff = Math.min(8000, this.backoff * 2);
    };
    ws.onerror = () => ws.close();
  }

  private emitStatus() {
    for (const fn of this.handlers.get('__status') ?? []) fn({ t: 'error', code: 'status', msg: this.status });
  }

  onStatus(fn: (status: string) => void): () => void {
    const set = this.handlers.get('__status') ?? new Set();
    const wrapped = () => fn(this.status);
    set.add(wrapped);
    this.handlers.set('__status', set);
    return () => set.delete(wrapped);
  }

  private ping() {
    this.rawSend({ t: 'ping', c: performance.now() });
    this.pings++;
    this.pingTimer = window.setTimeout(() => this.ping(), this.pings < 6 ? 1500 : 8000);
  }

  private rawSend(msg: C2S) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  send(msg: C2S): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.rawSend(msg);
    else if (msg.t !== 'cur' && msg.t !== 'ping') this.outbox.push(msg);
  }

  on<T extends S2C['t']>(t: T, fn: Handler<T>): () => void {
    const set = this.handlers.get(t) ?? new Set();
    set.add(fn as (m: S2C) => void);
    this.handlers.set(t, set);
    return () => set.delete(fn as (m: S2C) => void);
  }

  emit(msg: S2C): void {
    for (const fn of this.handlers.get(msg.t) ?? []) {
      try { fn(msg); } catch (err) { console.error(err); }
    }
  }

  serverNow(): number {
    return Date.now() + this.offset;
  }

  sessionFor(code: string): string | undefined {
    try { return sessionStorage.getItem(`loo_session_${code}`) ?? undefined; } catch { return undefined; }
  }

  close(): void {
    this.closedByUs = true;
    this.ws?.close();
  }
}
