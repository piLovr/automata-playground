// toDea, Äquivalenz (BFS im Produkt), trennendes Wort (2.84).
import type {
  DEA,
  EquivalenceResult,
  FormalObject,
  NEA,
  ProcOptions,
  ProcResult,
  RegexObj,
  StateId,
  Sym,
  Word,
} from '../model/types';
import { Rec, abort, guard, limits, need, newRec, safeValidate, snapAuto } from './common';
import { deaAsNea, fastDea } from './nea2dea';
import { grammarToNeaCore, type3Violations } from './grammarops';
import { thompsonCore } from './regexalgo';
import { egrepAlphabet, egrepAsRegex, egrepTest } from './egrep';
import { egrepHasBackref, parseEgrep } from '../model/egrep';

/** Typ-3-Objekt → NEA (ohne Schritte); null bei falscher Art oder Fehler. */
function asNea(o: FormalObject): NEA | null {
  const rec = new Rec(false);
  try {
    if (safeValidate(o).some((d) => d.severity === 'error')) return null;
    switch (o.kind) {
      case 'nea':
        return o.start === null ? null : o;
      case 'dea':
        return o.start === null ? null : deaAsNea(o);
      case 'regex':
        return o.expr === null ? null : thompsonCore(o as RegexObj, rec, { limits: { maxStates: 100000 } });
      case 'egrep': {
        const r = egrepAsRegex(o);
        return r === null || r.expr === null ? null : thompsonCore(r, rec, { limits: { maxStates: 100000 } });
      }
      case 'grammatik':
        if (o.start === null || type3Violations(o).length > 0) return null;
        return grammarToNeaCore(o, rec, undefined).nea;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function objAlphabet(o: FormalObject): Sym[] {
  if (o.kind === 'grammatik') return o.terminals;
  if (o.kind === 'egrep') return egrepAlphabet(o) ?? [];
  if (o.kind === 'regex') {
    const a = [...o.alphabet];
    const seen = new Set(a);
    const walk = (e: NonNullable<RegexObj['expr']>): void => {
      if (e.op === 'sym') {
        if (!seen.has(e.sym)) {
          seen.add(e.sym);
          a.push(e.sym);
        }
      } else if (e.op === 'star') walk(e.inner);
      else if (e.op === 'union' || e.op === 'concat') {
        walk(e.left);
        walk(e.right);
      }
    };
    if (o.expr) walk(o.expr);
    return a;
  }
  return o.alphabet;
}

function toDeaOver(o: FormalObject, alphabet: Sym[] | null, maxStates?: number): DEA | null {
  const n = asNea(o);
  if (n === null) return null;
  return fastDea(n, alphabet ?? objAlphabet(o), maxStates);
}

export function toDea(o: FormalObject): DEA | null {
  return toDeaOver(o, null);
}

export function accepts(o: FormalObject, w: Word): boolean | null {
  // egrep: Zeilensemantik direkt (auch für Zeichen außerhalb des Alphabets der Umwandlung)
  if (o.kind === 'egrep') return egrepTest(o, w.join(''));
  const m = toDea(o);
  if (m === null) return null;
  const alpha = new Set(m.alphabet);
  const delta = new Map(m.transitions.map((t) => [`${t.from}\u0000${t.label}`, t.to]));
  let cur = m.start as StateId;
  for (const x of w) {
    if (!alpha.has(x)) return false;
    cur = delta.get(`${cur}\u0000${x}`) as StateId;
  }
  return m.accept.includes(cur);
}

export function equivalent(a: FormalObject, b: FormalObject, opts: ProcOptions = {}): ProcResult<EquivalenceResult> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('equivalent', a, ['dea', 'nea', 'regex', 'grammatik', 'egrep']);
    need('equivalent', b, ['dea', 'nea', 'regex', 'grammatik', 'egrep']);
    for (const o of [a, b]) {
      if (o.kind === 'egrep') {
        const ast = parseEgrep(o.pattern).ast;
        if (ast && egrepHasBackref(ast)) abort('egrep.backref', {}, o.name);
      }
      if (o.kind === 'grammatik') {
        const bad = type3Violations(o);
        if (bad.length > 0) abort('algo.notType3', { productionIds: bad }, o.name);
      }
    }
    const alphabet = [...new Set([...objAlphabet(a), ...objAlphabet(b)])].sort();
    const lim = limits(opts).maxStates;
    const da = toDeaOver(a, alphabet, lim);
    const db = toDeaOver(b, alphabet, lim);
    if (da === null || db === null) return abort('algo.limit', { what: 'states', limit: lim });
    rec.add('proc.eq.convert', { source: 0 }, () => ({ obj: snapAuto(da) }));
    rec.add('proc.eq.convert', { source: 1 }, () => ({ obj: snapAuto(db) }));
    const step = (m: DEA): Map<string, StateId> => new Map(m.transitions.map((t) => [`${t.from}\u0000${t.label}`, t.to]));
    const fa = step(da);
    const fb = step(db);
    const accA = new Set(da.accept);
    const accB = new Set(db.accept);
    const nodes: { p: StateId; q: StateId; parent: number; sym: Sym | null }[] = [
      { p: da.start as StateId, q: db.start as StateId, parent: -1, sym: null },
    ];
    const seen = new Set<string>([`${da.start}\u0000${db.start}`]);
    for (let k = 0; k < nodes.length; k++) {
      const nd = nodes[k] as (typeof nodes)[number];
      if (accA.has(nd.p) !== accB.has(nd.q)) {
        const word: Word = [];
        for (let i = k; nodes[i]!.parent >= 0; i = nodes[i]!.parent) word.unshift(nodes[i]!.sym as Sym);
        rec.add('proc.eq.result', { equal: false, word }, () => ({}));
        return { equal: false, word, inLanguage: accA.has(nd.p) ? 0 : 1 } as EquivalenceResult;
      }
      for (const x of alphabet) {
        const p = fa.get(`${nd.p}\u0000${x}`) as StateId;
        const q = fb.get(`${nd.q}\u0000${x}`) as StateId;
        const key = `${p}\u0000${q}`;
        if (!seen.has(key)) {
          seen.add(key);
          nodes.push({ p, q, parent: k, sym: x });
        }
      }
    }
    rec.add('proc.eq.result', { equal: true, word: null }, () => ({}));
    return { equal: true, word: null, inLanguage: null } as EquivalenceResult;
  });
}

/** 2.84: kürzestes w, das w1 und w2 trennt (genau eines von w1w, w2w in L). */
export function separatingWord(m: DEA, w1: Word, w2: Word, opts: ProcOptions = {}): ProcResult<{ word: Word | null }> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('separatingWord', m, ['dea']);
    const delta = new Map(m.transitions.map((t) => [`${t.from}\u0000${t.label}`, t.to]));
    const acc = new Set(m.accept);
    const run = (w: Word): StateId | null => {
      let cur: StateId | null = m.start;
      for (const x of w) {
        if (cur === null) return null;
        cur = delta.get(`${cur}\u0000${x}`) ?? null;
      }
      return cur;
    };
    const s1 = run(w1);
    const s2 = run(w2);
    rec.add('proc.sep.states', { state1: s1, state2: s2 }, () => ({ obj: snapAuto(m) }));
    const isAcc = (s: StateId | null): boolean => s !== null && acc.has(s);
    type Node = { p: StateId | null; q: StateId | null; parent: number; sym: Sym | null };
    const nodes: Node[] = [{ p: s1, q: s2, parent: -1, sym: null }];
    const seen = new Set<string>([`${s1}\u0000${s2}`]);
    let word: Word | null = null;
    for (let k = 0; k < nodes.length && word === null; k++) {
      const nd = nodes[k] as Node;
      if (isAcc(nd.p) !== isAcc(nd.q)) {
        const w: Word = [];
        for (let i = k; (nodes[i] as Node).parent >= 0; i = (nodes[i] as Node).parent) w.unshift((nodes[i] as Node).sym as Sym);
        word = w;
        break;
      }
      for (const x of m.alphabet) {
        const p = nd.p === null ? null : (delta.get(`${nd.p}\u0000${x}`) ?? null);
        const q = nd.q === null ? null : (delta.get(`${nd.q}\u0000${x}`) ?? null);
        const key = `${p}\u0000${q}`;
        if (!seen.has(key)) {
          seen.add(key);
          nodes.push({ p, q, parent: k, sym: x });
        }
      }
    }
    rec.add('proc.sep.result', { word }, () => ({}));
    return { word };
  });
}
