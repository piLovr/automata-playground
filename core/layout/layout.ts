// Deterministisches Layout: Schichten per BFS, danach einfache Kräfte.
import type { Automaton, Point, StateId } from '../model/types';
import { transitionsOf } from '../model/util';

const DX = 160;
const DY = 120;
const ITER = 60;

function layered(obj: Automaton): Map<StateId, Point> {
  const ids = obj.states.map((s) => s.id);
  const out = new Map<StateId, Point>();
  if (ids.length === 0) return out;
  const succ = new Map<StateId, StateId[]>();
  for (const t of transitionsOf(obj)) {
    const l = succ.get(t.from) ?? [];
    l.push(t.to);
    succ.set(t.from, l);
  }
  const layerOf = new Map<StateId, number>();
  const layers: StateId[][] = [];
  const bfs = (root: StateId, base: number): void => {
    layerOf.set(root, base);
    let frontier = [root];
    let d = base;
    while (frontier.length > 0) {
      (layers[d] ??= []).push(...frontier);
      const next: StateId[] = [];
      for (const s of frontier) {
        for (const n of succ.get(s) ?? []) {
          if (ids.includes(n) && !layerOf.has(n)) {
            layerOf.set(n, d + 1);
            next.push(n);
          }
        }
      }
      frontier = next;
      d++;
    }
  };
  const root = obj.start !== null && ids.includes(obj.start) ? obj.start : (ids[0] as StateId);
  bfs(root, 0);
  for (const id of ids) if (!layerOf.has(id)) bfs(id, layers.length);
  layers.forEach((layer, li) => {
    layer.forEach((id, k) => out.set(id, { x: li * DX, y: (k - (layer.length - 1) / 2) * DY }));
  });
  return out;
}

function relax(obj: Automaton, pos: Map<StateId, Point>): void {
  const ids = obj.states.map((s) => s.id);
  const edges = transitionsOf(obj)
    .filter((t) => t.from !== t.to && pos.has(t.from) && pos.has(t.to))
    .map((t) => [t.from, t.to] as const);
  for (let it = 0; it < ITER; it++) {
    const force = new Map<StateId, Point>(ids.map((id) => [id, { x: 0, y: 0 }]));
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        const pa = pos.get(ids[a] as string) as Point;
        const pb = pos.get(ids[b] as string) as Point;
        let dx = pa.x - pb.x;
        let dy = pa.y - pb.y;
        if (dx === 0 && dy === 0) {
          dx = 1;
          dy = 0.5;
        }
        const d2 = Math.max(dx * dx + dy * dy, 1);
        const d = Math.sqrt(d2);
        const f = 6000 / d2;
        const fa = force.get(ids[a] as string) as Point;
        const fb = force.get(ids[b] as string) as Point;
        fa.x += (dx / d) * f;
        fa.y += (dy / d) * f;
        fb.x -= (dx / d) * f;
        fb.y -= (dy / d) * f;
      }
    }
    for (const [u, v] of edges) {
      const pu = pos.get(u) as Point;
      const pv = pos.get(v) as Point;
      const dx = pv.x - pu.x;
      const dy = pv.y - pu.y;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const f = (d - DX) * 0.05;
      const fu = force.get(u) as Point;
      const fv = force.get(v) as Point;
      fu.x += (dx / d) * f;
      fu.y += (dy / d) * f;
      fv.x -= (dx / d) * f;
      fv.y -= (dy / d) * f;
    }
    for (const id of ids) {
      const p = pos.get(id) as Point;
      const f = force.get(id) as Point;
      p.x += Math.max(-20, Math.min(20, f.x));
      p.y += Math.max(-20, Math.min(20, f.y));
    }
  }
}

export function autoLayout(obj: Automaton, opts: { keep?: boolean } = {}): Record<StateId, Point> {
  const pos = layered(obj);
  relax(obj, pos);
  const result: Record<StateId, Point> = {};
  for (const s of obj.states) {
    const p = pos.get(s.id) as Point;
    result[s.id] = { x: Math.round(p.x) + 0, y: Math.round(p.y) + 0 };
  }
  if (opts.keep) {
    const fixed = obj.states.filter((s) => s.pos !== undefined);
    const free = obj.states.filter((s) => s.pos === undefined);
    if (fixed.length > 0) {
      const maxX = Math.max(...fixed.map((s) => (s.pos as Point).x));
      const minNew = free.length > 0 ? Math.min(...free.map((s) => (result[s.id] as Point).x)) : 0;
      for (const s of fixed) result[s.id] = { x: (s.pos as Point).x, y: (s.pos as Point).y };
      for (const s of free) {
        const p = result[s.id] as Point;
        result[s.id] = { x: p.x - minNew + maxX + DX, y: p.y };
      }
    }
  }
  return result;
}
