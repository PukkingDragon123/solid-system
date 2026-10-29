// Shared board layout. The interactive board is a square lying on the clubhouse table; all cursor
// positions and target rectangles live in board space (u, v in 0..1) so every device agrees on
// what a glove is pointing at, whatever its screen shape.

export interface BoardSlot {
  u: number;
  v: number;
  w: number;
  h: number;
}

export function gridSlots(n: number): BoardSlot[] {
  if (n <= 0) return [];
  if (n === 1) return [{ u: 0.5, v: 0.5, w: 0.5, h: 0.4 }];
  if (n === 2) return [{ u: 0.27, v: 0.52, w: 0.4, h: 0.46 }, { u: 0.73, v: 0.52, w: 0.4, h: 0.46 }];
  if (n === 3) return [0.18, 0.5, 0.82].map((u) => ({ u, v: 0.52, w: 0.29, h: 0.46 }));
  if (n === 4) {
    return [
      { u: 0.28, v: 0.3, w: 0.4, h: 0.34 },
      { u: 0.72, v: 0.3, w: 0.4, h: 0.34 },
      { u: 0.28, v: 0.73, w: 0.4, h: 0.34 },
      { u: 0.72, v: 0.73, w: 0.4, h: 0.34 },
    ];
  }
  const cols = n <= 6 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const w = 0.9 / cols;
  const h = Math.min(0.42, 0.88 / rows);
  const out: BoardSlot[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const inRow = Math.min(cols, n - r * cols);
    const c = i % cols;
    const rowStart = 0.5 - (inRow * w) / 2;
    out.push({ u: rowStart + w * (c + 0.5), v: 0.5 - (rows * h) / 2 + h * (r + 0.5) + 0.02, w: w * 0.9, h: h * 0.88 });
  }
  return out;
}

/** Options arranged in a ring around the board centre (map vote: the bottle sits in the middle). */
export function ringSlots(n: number, radius = 0.36): BoardSlot[] {
  const out: BoardSlot[] = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    out.push({ u: 0.5 + Math.cos(a) * radius, v: 0.5 + Math.sin(a) * radius, w: 0.24, h: 0.2 });
  }
  return out;
}

export function ringAngle(i: number, n: number): number {
  return -Math.PI / 2 + (i / n) * Math.PI * 2;
}

export function slotContains(s: BoardSlot, u: number, v: number): boolean {
  return Math.abs(u - s.u) <= s.w / 2 && Math.abs(v - s.v) <= s.h / 2;
}
