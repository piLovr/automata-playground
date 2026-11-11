// Hilfen für kontextfreie Grammatiken: ε-fähig, produktiv, Zyklen, Spannentabellen.
import type { Grammar, Production, Sym, Word } from '../model/types';

export function cfProductions(g: Grammar): Production[] {
  const n = new Set(g.nonterminals);
  return g.productions.filter((p) => p.left.length === 1 && n.has(p.left[0] as Sym));
}

export function nullableSet(g: Grammar): Set<Sym> {
  const nt = new Set(g.nonterminals);
  const out = new Set<Sym>();
  const ps = cfProductions(g);
  for (let changed = true; changed; ) {
    changed = false;
    for (const p of ps) {
      const x = p.left[0] as Sym;
      if (!out.has(x) && p.right.every((s) => nt.has(s) && out.has(s))) {
        out.add(x);
        changed = true;
      }
    }
  }
  return out;
}

export function productiveSet(g: Grammar): Set<Sym> {
  const nt = new Set(g.nonterminals);
  const out = new Set<Sym>();
  const ps = cfProductions(g);
  for (let changed = true; changed; ) {
    changed = false;
    for (const p of ps) {
      const x = p.left[0] as Sym;
      if (!out.has(x) && p.right.every((s) => !nt.has(s) || out.has(s))) {
        out.add(x);
        changed = true;
      }
    }
  }
  return out;
}

/** Nichtterminale X mit X ⇒⁺ X (über ε-fähige Nachbarn). */
export function cycleSet(g: Grammar): Set<Sym> {
  const nt = new Set(g.nonterminals);
  const nullable = nullableSet(g);
  const names = g.nonterminals;
  const ix = new Map(names.map((s, i) => [s, i]));
  const n = names.length;
  const reach: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  for (const p of cfProductions(g)) {
    const x = ix.get(p.left[0] as Sym) as number;
    p.right.forEach((s, m) => {
      if (!nt.has(s)) return;
      const others = p.right.every((o, k) => k === m || (nt.has(o) && nullable.has(o)));
      if (others) (reach[x] as boolean[])[ix.get(s) as number] = true;
    });
  }
  for (let k = 0; k < n; k++)
    for (let i = 0; i < n; i++)
      if ((reach[i] as boolean[])[k]) for (let j = 0; j < n; j++) if ((reach[k] as boolean[])[j]) (reach[i] as boolean[])[j] = true;
  return new Set(names.filter((s, i) => (reach[i] as boolean[])[i]));
}

export interface Spans {
  /** derives(X, i, j): X ⇒* w[i..j) */
  derives: (x: Sym, i: number, j: number) => boolean;
  /** inContext(X, i, j): S ⇒* w[0..i) X w[j..n) */
  inContext: (x: Sym, i: number, j: number) => boolean;
}

/** Spannentabellen für ein festes Wort (ohne Chomsky-Normalform, auch mit ε- und Kettenproduktionen). */
export function spanTables(g: Grammar, w: Word, withContext: boolean): Spans {
  const nt = new Set(g.nonterminals);
  const names = g.nonterminals;
  const ix = new Map(names.map((s, i) => [s, i]));
  const n = w.length;
  const W = n + 1;
  const D = new Uint8Array(names.length * W * W);
  const C = new Uint8Array(names.length * W * W);
  const at = (x: number, i: number, j: number): number => (x * W + i) * W + j;
  const ps = cfProductions(g);

  const fwd = (right: Word, from: number): Uint8Array[] => {
    const sets: Uint8Array[] = [];
    let cur = new Uint8Array(W);
    cur[from] = 1;
    sets.push(cur);
    for (const s of right) {
      const next = new Uint8Array(W);
      for (let j = 0; j <= n; j++) {
        if (cur[j] === 0) continue;
        if (!nt.has(s)) {
          if (j < n && w[j] === s) next[j + 1] = 1;
        } else {
          const x = ix.get(s) as number;
          for (let m = j; m <= n; m++) if (D[at(x, j, m)] === 1) next[m] = 1;
        }
      }
      cur = next;
      sets.push(cur);
    }
    return sets;
  };
  const bwd = (right: Word, to: number): Uint8Array[] => {
    const k = right.length;
    const sets: Uint8Array[] = new Array<Uint8Array>(k + 1);
    let cur = new Uint8Array(W);
    cur[to] = 1;
    sets[k] = cur;
    for (let p = k - 1; p >= 0; p--) {
      const s = right[p] as Sym;
      const prev = new Uint8Array(W);
      for (let a = 0; a <= n; a++) {
        if (!nt.has(s)) {
          if (a < n && w[a] === s && cur[a + 1] === 1) prev[a] = 1;
        } else {
          const x = ix.get(s) as number;
          for (let b = a; b <= n; b++) if (D[at(x, a, b)] === 1 && cur[b] === 1) prev[a] = 1;
        }
      }
      cur = prev;
      sets[p] = cur;
    }
    return sets;
  };

  for (let changed = true; changed; ) {
    changed = false;
    for (const p of ps) {
      const x = ix.get(p.left[0] as Sym) as number;
      for (let i = 0; i <= n; i++) {
        const f = (fwd(p.right, i)[p.right.length]) as Uint8Array;
        for (let j = i; j <= n; j++) {
          if (f[j] === 1 && D[at(x, i, j)] === 0) {
            D[at(x, i, j)] = 1;
            changed = true;
          }
        }
      }
    }
  }

  if (withContext && g.start !== null && ix.has(g.start)) {
    C[at(ix.get(g.start) as number, 0, n)] = 1;
    const pre = ps.map((p) => ({
      p,
      x: ix.get(p.left[0] as Sym) as number,
      F: Array.from({ length: W }, (_, i) => fwd(p.right, i)),
      B: Array.from({ length: W }, (_, j) => bwd(p.right, j)),
    }));
    for (let changed = true; changed; ) {
      changed = false;
      for (const { p, x, F, B } of pre) {
        for (let i = 0; i <= n; i++) {
          for (let j = i; j <= n; j++) {
            if (C[at(x, i, j)] === 0) continue;
            p.right.forEach((s, m) => {
              if (!nt.has(s)) return;
              const y = ix.get(s) as number;
              const fa = (F[i] as Uint8Array[])[m] as Uint8Array;
              const bb = (B[j] as Uint8Array[])[m + 1] as Uint8Array;
              for (let a = i; a <= j; a++) {
                if (fa[a] === 0) continue;
                for (let b = a; b <= j; b++) {
                  if (bb[b] === 1 && C[at(y, a, b)] === 0) {
                    C[at(y, a, b)] = 1;
                    changed = true;
                  }
                }
              }
            });
          }
        }
      }
    }
  }
  const get = (T: Uint8Array) => (x: Sym, i: number, j: number): boolean => {
    const k = ix.get(x);
    return k !== undefined && i >= 0 && j <= n && i <= j && T[at(k, i, j)] === 1;
  };
  return { derives: get(D), inContext: get(C) };
}
