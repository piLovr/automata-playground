// Orakel: Wörter der Sprache, unabhängig von den Umwandlungen implementiert.
//  - Ausdruck: direkt über die Semantik 2.23
//  - Grammatik: Breitensuche über Satzformen (2.39)
//  - DEA/NEA: eigene limitfreie Konfigurationserreichbarkeit (2.58/2.65)
import { egrepAlphabet, egrepAsRegex, egrepTest } from './egrep';
import { egrepHasBackref, parseEgrep } from '../model/egrep';
import type { FormalObject, Grammar, RegExpr, Sym, Word } from '../model/types';

function orderOf(alphabet: Sym[]): (a: Sym) => number {
  const m = new Map(alphabet.map((s, i) => [s, i]));
  return (s) => m.get(s) ?? alphabet.length;
}

function compare(rank: (s: Sym) => number): (a: Word, b: Word) => number {
  return (a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    for (let i = 0; i < a.length; i++) {
      const x = a[i] as Sym;
      const y = b[i] as Sym;
      if (x === y) continue;
      const d = rank(x) - rank(y);
      if (d !== 0) return d;
      return x < y ? -1 : 1;
    }
    return 0;
  };
}

const key = (w: Word): string => JSON.stringify(w);

type Lang = Map<string, Word>;

function regexLang(e: RegExpr, n: number): Lang {
  switch (e.op) {
    case 'empty':
      return new Map();
    case 'sym':
      return n >= 1 ? new Map([[key([e.sym]), [e.sym]]]) : new Map();
    case 'union': {
      const out = regexLang(e.left, n);
      for (const [k, w] of regexLang(e.right, n)) out.set(k, w);
      return out;
    }
    case 'concat': {
      const a = regexLang(e.left, n);
      const b = regexLang(e.right, n);
      const out: Lang = new Map();
      for (const u of a.values()) {
        for (const v of b.values()) {
          if (u.length + v.length <= n) {
            const w = [...u, ...v];
            out.set(key(w), w);
          }
        }
      }
      return out;
    }
    default: {
      const a = [...regexLang(e.inner, n).values()].filter((w) => w.length > 0);
      const out: Lang = new Map([[key([]), []]]);
      let frontier: Word[] = [[]];
      while (frontier.length > 0) {
        const next: Word[] = [];
        for (const u of frontier) {
          for (const v of a) {
            if (u.length + v.length > n) continue;
            const w = [...u, ...v];
            const k = key(w);
            if (!out.has(k)) {
              out.set(k, w);
              next.push(w);
            }
          }
        }
        frontier = next;
      }
      return out;
    }
  }
}

function grammarLang(g: Grammar, n: number): Word[] {
  if (g.start === null) return [];
  const T = new Set(g.terminals);
  const nonShrinking = g.productions.every((p) => p.left.length <= p.right.length);
  const cap = nonShrinking ? n : 2 * n + 4;
  const seen = new Set<string>();
  const queue: Word[] = [[g.start]];
  seen.add(key(queue[0] as Word));
  const out: Word[] = [];
  const MAX_FORMS = 500000;
  for (let q = 0; q < queue.length && seen.size < MAX_FORMS; q++) {
    const f = queue[q] as Word;
    if (f.every((s) => T.has(s))) {
      if (f.length <= n) out.push(f);
      continue;
    }
    for (const p of g.productions) {
      const l = p.left;
      if (l.length === 0) continue;
      for (let i = 0; i + l.length <= f.length; i++) {
        let hit = true;
        for (let j = 0; j < l.length; j++) {
          if (f[i + j] !== l[j]) {
            hit = false;
            break;
          }
        }
        if (!hit) continue;
        const nf = [...f.slice(0, i), ...p.right, ...f.slice(i + l.length)];
        if (nf.length > cap || nf.filter((s) => T.has(s)).length > n) continue;
        const k = key(nf);
        if (!seen.has(k)) {
          seen.add(k);
          queue.push(nf);
        }
      }
    }
  }
  return out;
}

// Zugehörigkeit: Mengen-BFS über Konfigurationen (Zustand, Position); Wort- und ε-Kanten.
function accepts(o: Extract<FormalObject, { kind: 'dea' | 'nea' }>, w: Word): boolean {
  if (o.start === null) return false;
  const finals = new Set<string>(o.accept);
  const seen = new Set<string>([`${o.start}\u0000${0}`]);
  const stack: Array<[string, number]> = [[o.start, 0]];
  while (stack.length > 0) {
    const [z, i] = stack.pop() as [string, number];
    if (i === w.length && finals.has(z)) return true;
    for (const t of o.transitions) {
      if (t.from !== z) continue;
      const lab: Word = typeof t.label === 'string' ? [t.label] : (t.label as Word);
      if (i + lab.length > w.length) continue;
      if (!lab.every((x, k) => x === w[i + k])) continue;
      const j = i + lab.length;
      const key2 = `${t.to}\u0000${j}`;
      if (!seen.has(key2)) {
        seen.add(key2);
        stack.push([t.to, j]);
      }
    }
  }
  return false;
}

export function enumerate(o: FormalObject, maxLen: number, maxCount?: number): Word[] {
  const limit = maxCount ?? Number.POSITIVE_INFINITY;
  const finish = (ws: Word[], alphabet: Sym[]): Word[] => ws.sort(compare(orderOf(alphabet))).slice(0, limit);
  switch (o.kind) {
    case 'regex': {
      if (o.expr === null) return [];
      return finish([...regexLang(o.expr, maxLen).values()], o.alphabet);
    }
    case 'egrep': {
      const r = egrepAsRegex(o);
      if (r?.expr) return finish([...regexLang(r.expr, maxLen).values()], r.alphabet);
      const ast = parseEgrep(o.pattern).ast;
      const alpha = egrepAlphabet(o);
      if (!ast || !egrepHasBackref(ast) || alpha === null) return [];
      // Rückwärtsverweise: Aufzählung durch Probieren (Arbeit begrenzt)
      const out: Word[] = [];
      let budget = 200000;
      let layer: Word[] = [[]];
      for (let len = 0; len <= maxLen && layer.length > 0; len++) {
        const hits: Word[] = [];
        for (const w of layer) {
          if (--budget < 0) return finish(out, alpha);
          if (egrepTest(o, w.join('')) === true) hits.push(w);
        }
        out.push(...hits);
        if (len === maxLen) break;
        layer = layer.flatMap((w) => alpha.map((x) => [...w, x]));
      }
      return finish(out, alpha);
    }
    case 'grammatik':
      return finish(grammarLang(o, maxLen), o.terminals);
    case 'dea':
    case 'nea': {
      const out: Word[] = [];
      if (o.start === null || limit <= 0) return out;
      let layer: Word[] = [[]];
      for (let len = 0; len <= maxLen && layer.length > 0; len++) {
        for (const w of layer) {
          if (accepts(o, w)) {
            out.push(w);
            if (out.length >= limit) return out;
          }
        }
        if (len === maxLen) break;
        const next: Word[] = [];
        for (const w of layer) for (const x of o.alphabet) next.push([...w, x]);
        layer = next;
      }
      return out;
    }
    default:
      return [];
  }
}
