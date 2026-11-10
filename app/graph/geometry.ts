import type { Point } from '../../core/model/types';

export const STATE_R = 26;
export const ACCEPT_GAP = 5;

export function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}
export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}
export function scale(a: Point, k: number): Point {
  return { x: a.x * k, y: a.y * k };
}
export function len(a: Point): number {
  return Math.hypot(a.x, a.y);
}
export function norm(a: Point): Point {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
}
export function perp(a: Point): Point {
  return { x: -a.y, y: a.x };
}

export interface EdgeGeometry {
  path: string;
  /** Mittelpunkt der Beschriftung. */
  label: Point;
  /** Spitze und Richtung für den Pfeil. */
  tip: Point;
  dir: Point;
}

/**
 * Kante zwischen zwei verschiedenen Zuständen. bend = 0 gerade, sonst quadratische
 * Kurve, deren Scheitel um bend Pixel senkrecht zur Verbindungslinie versetzt ist.
 */
export function edgeBetween(a: Point, b: Point, bend: number, r = STATE_R, labelWidth = 0): EdgeGeometry {
  const d = norm(sub(b, a));
  const n = perp(d);
  const mid = scale(add(a, b), 0.5);
  if (bend === 0) {
    const start = add(a, scale(d, r));
    const tip = sub(b, scale(d, r + 1));
    return {
      path: `M${start.x},${start.y} L${tip.x},${tip.y}`,
      label: add(mid, scale(n, -(12 + Math.abs(n.x) * labelWidth * 0.5))),
      tip,
      dir: d,
    };
  }
  // Kontrollpunkt so, dass der Scheitel der Kurve bei mid + n*bend liegt.
  const ctrl = add(mid, scale(n, bend * 2));
  const ds = norm(sub(ctrl, a));
  const de = norm(sub(b, ctrl));
  const start = add(a, scale(ds, r));
  const tip = sub(b, scale(de, r + 1));
  const apex = add(mid, scale(n, bend));
  return {
    path: `M${start.x},${start.y} Q${ctrl.x},${ctrl.y} ${tip.x},${tip.y}`,
    label: add(apex, scale(n, Math.sign(bend) * (13 + Math.abs(n.x) * labelWidth * 0.5))),
    tip,
    dir: de,
  };
}

/** Schleife am Zustand c, nach außen in Richtung angle (Bogenmaß). */
export function selfLoop(c: Point, angle: number, r = STATE_R): EdgeGeometry {
  const spread = 0.52;
  const reach = r * 2.9;
  const a1 = angle - spread;
  const a2 = angle + spread;
  const p1 = { x: c.x + Math.cos(a1) * r, y: c.y + Math.sin(a1) * r };
  const p2 = { x: c.x + Math.cos(a2) * (r + 1), y: c.y + Math.sin(a2) * (r + 1) };
  const c1 = { x: c.x + Math.cos(a1 - 0.35) * reach, y: c.y + Math.sin(a1 - 0.35) * reach };
  const c2 = { x: c.x + Math.cos(a2 + 0.35) * reach, y: c.y + Math.sin(a2 + 0.35) * reach };
  const dir = norm(sub(p2, c2));
  const top = { x: c.x + Math.cos(angle) * (reach * 0.66 + 10), y: c.y + Math.sin(angle) * (reach * 0.66 + 10) };
  return {
    path: `M${p1.x},${p1.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`,
    label: top,
    tip: p2,
    dir,
  };
}

/**
 * Richtung in die freieste Lücke zwischen den Nachbarn. prefer (Bogenmaß) wird genommen,
 * solange dort mindestens 50° frei sind; sonst die Mitte der größten Lücke.
 * Standard: oben (Schleifen); der Startpfeil bevorzugt links.
 */
export function freeAngle(c: Point, neighbours: Point[], prefer = -Math.PI / 2): number {
  if (neighbours.length === 0) return prefer;
  const angles = neighbours.map((p) => Math.atan2(p.y - c.y, p.x - c.x)).sort((a, b) => a - b);
  const clearance = Math.min(...angles.map((a) => Math.abs(Math.atan2(Math.sin(a - prefer), Math.cos(a - prefer)))));
  if (clearance > (50 * Math.PI) / 180) return prefer;
  let best = prefer;
  let bestScore = -1;
  for (let i = 0; i < angles.length; i++) {
    const a = angles[i]!;
    const b = i + 1 < angles.length ? angles[i + 1]! : angles[0]! + Math.PI * 2;
    const gap = b - a;
    const mid = a + gap / 2;
    const score = gap + 0.3 * Math.max(0, Math.cos(mid - prefer));
    if (score > bestScore) {
      bestScore = score;
      best = mid;
    }
  }
  return best;
}

export function arrowHead(tip: Point, dir: Point, size = 9): string {
  const n = perp(dir);
  const back = sub(tip, scale(dir, size));
  const l = add(back, scale(n, size * 0.5));
  const r = sub(back, scale(n, size * 0.5));
  return `M${tip.x},${tip.y} L${l.x},${l.y} L${r.x},${r.y} Z`;
}

/** Startpfeil, der von links (oder aus der freiesten Richtung) auf den Zustand zeigt. */
export function startArrow(c: Point, angle: number, r = STATE_R): { path: string; tip: Point; dir: Point } {
  const d = { x: Math.cos(angle), y: Math.sin(angle) };
  const from = add(c, scale(d, r + 34));
  const tip = add(c, scale(d, r + 1));
  return { path: `M${from.x},${from.y} L${tip.x},${tip.y}`, tip, dir: scale(d, -1) };
}

export function rectContains(r: { x: number; y: number; w: number; h: number }, p: Point): boolean {
  const x0 = Math.min(r.x, r.x + r.w);
  const x1 = Math.max(r.x, r.x + r.w);
  const y0 = Math.min(r.y, r.y + r.h);
  const y1 = Math.max(r.y, r.y + r.h);
  return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
}

/** Zerlegt "z12" in Basis "z" und tiefgestellten Index "12" (nur Anzeige). */
export function splitSubscript(name: string): { base: string; sub: string } {
  const m = /^(\p{L}+'*)(\d+)$/u.exec(name);
  return m ? { base: m[1]!, sub: m[2]! } : { base: name, sub: '' };
}
