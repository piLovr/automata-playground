// NEA → DEA nach Skript 2.70–2.74: Wortkanten zerlegen, ε entfernen, Potenzmenge.
import type {
  Correspondence,
  DEA,
  ElemRef,
  NEA,
  ProcOptions,
  ProcResult,
  State,
  StateId,
  StepTable,
  Sym,
  Transition,
  Word,
} from '../model/types';
import { freshName, nextId } from '../model/util';
import {
  Progress,
  Rec,
  abort,
  clone,
  guard,
  layoutAuto,
  limitAbort,
  limits,
  mkDea,
  mkNea,
  mkOrigin,
  need,
  newRec,
  resultName,
  setName,
  compactNames,
  setText,
  snapAuto,
  uniqueName,
} from './common';


/** DEA als NEA (Beschriftungen als Einzelwort). */
export function deaAsNea(m: DEA): NEA {
  return mkNea(
    m.name,
    m.alphabet,
    clone(m.states),
    m.start,
    m.accept.slice(),
    m.transitions.map((t) => ({ id: t.id, from: t.from, to: t.to, label: [t.label] })),
  );
}

// ---------------------------------------------------------------------------
// 2.71: Wortkanten zerlegen

export function splitCore(n: NEA, rec: Rec): NEA {
  const states: State[] = n.states.map((s) => ({ id: s.id, name: s.name }));
  const names = states.map((s) => s.name);
  let trans: Transition<Word>[] = n.transitions.map((t) => ({ id: t.id, from: t.from, to: t.to, label: t.label.slice() }));
  const mk = (): NEA =>
    mkNea(n.name, n.alphabet, states.map((s) => ({ ...s })), n.start, n.accept.slice(), trans.map((t) => ({ ...t, label: t.label.slice() })));
  for (const t of n.transitions) {
    if (t.label.length < 2) continue;
    const k = t.label.length;
    const newStates: StateId[] = [];
    for (let i = 1; i < k; i++) {
      const name = freshName(names, 'h');
      names.push(name);
      const id = nextId(states.map((s) => s.id), 's');
      states.push({ id, name });
      newStates.push(id);
    }
    const chain = [t.from, ...newStates, t.to];
    const newTrans: Transition<Word>[] = [];
    const allIds = trans.map((x) => x.id);
    for (let i = 0; i < k; i++) {
      const id = nextId(allIds, 't');
      allIds.push(id);
      newTrans.push({ id, from: chain[i] as string, to: chain[i + 1] as string, label: [t.label[i] as Sym] });
    }
    const at = trans.findIndex((x) => x.id === t.id);
    trans = [...trans.slice(0, at), ...newTrans, ...trans.slice(at + 1)];
    rec.add(
      'proc.split.edge',
      { transition: t.id, word: t.label, newStates, newTransitions: newTrans.map((x) => x.id) },
      () => ({
        obj: snapAuto(mk()),
        highlight: newStates.map((s) => ({ state: s })),
        added: newTrans.map((x) => x.id),
      }),
      { source: 0, elems: [{ transition: t.id }] },
    );
  }
  return mk();
}

// ---------------------------------------------------------------------------
// 2.72: ε-Kanten entfernen (Entscheidung 4)

export function epsCore(n: NEA, rec: Rec): NEA {
  const states: State[] = n.states.map((s) => ({ id: s.id, name: s.name }));
  let trans: Transition<Word>[] = n.transitions.map((t) => ({ id: t.id, from: t.from, to: t.to, label: t.label.slice() }));
  const accept = new Set(n.accept);
  const mk = (): NEA =>
    mkNea(
      n.name,
      n.alphabet,
      states.map((s) => ({ ...s })),
      n.start,
      states.map((s) => s.id).filter((id) => accept.has(id)),
      trans.map((t) => ({ ...t, label: t.label.slice() })),
    );
  const eps = trans.filter((t) => t.label.length === 0);
  const have = new Set(trans.map((t) => `${t.from}\u0000${t.to}\u0000${JSON.stringify(t.label)}`));
  const ids = trans.map((t) => t.id);
  const addEdge = (key: 'proc.eps.r1' | 'proc.eps.r2', e: Transition<Word>, via: Transition<Word>, from: StateId, to: StateId): boolean => {
    const k = `${from}\u0000${to}\u0000${JSON.stringify(via.label)}`;
    if (have.has(k)) return false;
    have.add(k);
    const id = nextId(ids, 't');
    ids.push(id);
    trans.push({ id, from, to, label: via.label.slice() });
    rec.add(
      key,
      { eps: e.id, via: via.id, added: id },
      () => ({ obj: snapAuto(mk()), highlight: [{ transition: e.id }, { transition: via.id }], added: [id] }),
      { source: 0, elems: [{ transition: e.id }] },
    );
    return true;
  };
  if (eps.length > 0) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of eps) {
        for (const a of trans.slice()) {
          if (a.label.length > 0 && a.from === e.to && addEdge('proc.eps.r1', e, a, e.from, a.to)) changed = true;
        }
        for (const a of trans.slice()) {
          if (a.label.length > 0 && a.to === e.from && addEdge('proc.eps.r2', e, a, a.from, e.to)) changed = true;
        }
        if (accept.has(e.to) && !accept.has(e.from)) {
          accept.add(e.from);
          changed = true;
          rec.add(
            'proc.eps.f',
            { state: e.from, eps: e.id },
            () => ({ obj: snapAuto(mk()), highlight: [{ state: e.from }, { transition: e.id }] }),
            { source: 0, elems: [{ transition: e.id }] },
          );
        }
      }
    }
    const removed = eps.map((e) => e.id);
    trans = trans.filter((t) => t.label.length > 0);
    rec.add('proc.eps.r3', { removed }, () => ({ obj: snapAuto(mk()) }), {
      source: 0,
      elems: removed.map((id) => ({ transition: id })),
    });
  }
  return mk();
}

// ---------------------------------------------------------------------------
// 2.74: Potenzmengenkonstruktion

export interface PowerResult {
  dea: DEA;
  /** Zu jedem DEA-Zustand die Menge der NEA-Zustände (IDs des Eingabe-NEA). */
  sets: StateId[][];
}

export function powerCore(n: NEA, rec: Rec, opts: ProcOptions | undefined): PowerResult {
  const lim = limits(opts).maxStates;
  const prog = new Progress(opts?.onProgress);
  const Z = n.states;
  const idx = new Map(Z.map((s, i) => [s.id, i]));
  const X = n.alphabet;
  const xi = new Map(X.map((x, i) => [x, i]));
  const succ: Set<number>[][] = Z.map(() => X.map(() => new Set<number>()));
  for (const t of n.transitions) {
    const a = idx.get(t.from);
    const b = idx.get(t.to);
    const x = xi.get(t.label[0] as Sym);
    if (a !== undefined && b !== undefined && x !== undefined) (succ[a] as Set<number>[])[x]?.add(b);
  }
  const acc = new Set(n.accept.map((id) => idx.get(id) as number));
  const s0 = idx.get(n.start as StateId) as number;
  const sets: number[][] = [];
  const keyOf = new Map<string, number>();
  const key = (s: number[]): string => s.join(',');
  const add = (s: number[]): number => {
    const k = key(s);
    const have = keyOf.get(k);
    if (have !== undefined) return have;
    if (sets.length + 1 > lim) limitAbort('states', lim);
    sets.push(s);
    keyOf.set(k, sets.length - 1);
    return sets.length - 1;
  };
  add([s0]);
  if (opts?.fullPowerset === true) {
    const m = Z.length;
    if (m > 30 || 2 ** m > lim) limitAbort('states', lim);
    for (let mask = 0; mask < 2 ** m; mask++) {
      const s: number[] = [];
      for (let i = 0; i < m; i++) if ((mask >> i) & 1) s.push(i);
      add(s);
    }
  }
  const nameOfSet = (s: number[]): string => setName(s.map((i) => (Z[i] as State).name));
  const textOfSet = (s: number[]): string => setText(s.map((i) => (Z[i] as State).name));
  const idsOfSet = (s: number[]): StateId[] => s.map((i) => (Z[i] as State).id);
  const rows: number[][] = []; // Ziele je Zeile (Mengenindex je Symbol)
  const table: StepTable = { colHead: X.slice(), rowHead: [], cells: [] };
  for (let k = 0; k < sets.length; k++) {
    const S = sets[k] as number[];
    const targets: number[][] = [];
    const newSets: StateId[][] = [];
    const to: number[] = [];
    for (let x = 0; x < X.length; x++) {
      const u = new Set<number>();
      for (const z of S) for (const y of (succ[z] as Set<number>[])[x] as Set<number>) u.add(y);
      const T = [...u].sort((a, b) => a - b);
      const before = sets.length;
      to.push(add(T));
      if (sets.length > before) newSets.push(idsOfSet(T));
      targets.push(T);
    }
    rows.push(to);
    prog.tick(sets.length);
    if (rec.on) {
      table.rowHead.push(textOfSet(S));
      table.cells.push(targets.map(textOfSet));
      rec.add(
        'proc.pow.row',
        { state: `s${k}`, set: idsOfSet(S), targets: targets.map(idsOfSet), newSets },
        () => ({ table: { ...clone(table), activeRow: table.rowHead.length - 1 } }),
        { source: 0, elems: idsOfSet(S).map((id) => ({ state: id })) },
      );
    }
  }
  const used = new Set<string>();
  const states: State[] = compactNames(sets.map((s, i) => ({ id: `s${i}`, name: uniqueName(used, nameOfSet(s)) })));
  const trans: Transition<Sym>[] = [];
  rows.forEach((to, k) =>
    to.forEach((t, x) => trans.push({ id: `t${trans.length}`, from: `s${k}`, to: `s${t}`, label: X[x] as Sym })),
  );
  const accept = sets.map((s, i) => (s.some((z) => acc.has(z)) ? `s${i}` : null)).filter((x): x is string => x !== null);
  return { dea: mkDea(n.name, X, states, 's0', accept, trans), sets: sets.map(idsOfSet) };
}

function noWordEdges(n: NEA): void {
  const bad = n.transitions.filter((t) => t.label.length !== 1);
  if (bad.length > 0) abort('algo.invalid', { diagnostics: bad.length, transitionIds: bad.map((t) => t.id) }, n.name);
}

// ---------------------------------------------------------------------------
// Öffentliche Verfahren

function nameFix<A extends { name: string }>(a: A, opts: ProcOptions | undefined, src: { name: string }, suffix: string): A {
  return { ...a, name: resultName(opts, src, suffix) };
}

function idCorr(states: State[]): Correspondence[] {
  return states.map((s) => ({ target: { state: s.id }, source: 0, elems: [{ state: s.id }] }));
}

export function splitWords(n: NEA, opts: ProcOptions = {}): ProcResult<NEA> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('splitWords', n, ['nea']);
    const r = nameFix(splitCore(n, rec), opts, n, '_nea');
    const known = new Set(n.states.map((s) => s.id));
    return {
      ...layoutAuto(r),
      origin: mkOrigin('splitWords', [n], idCorr(r.states.filter((s) => known.has(s.id)))),
    };
  });
}

export function removeEpsilon(n: NEA, opts: ProcOptions = {}): ProcResult<NEA> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('removeEpsilon', n, ['nea']);
    const r = nameFix(epsCore(n, rec), opts, n, '_nea');
    return { ...layoutAuto(r), origin: mkOrigin('removeEpsilon', [n], idCorr(r.states)) };
  });
}

function powerCorr(p: PowerResult, known: Set<StateId>): Correspondence[] {
  return p.dea.states.map((s, i) => ({
    target: { state: s.id } as ElemRef,
    source: 0,
    elems: (p.sets[i] as StateId[]).filter((id) => known.has(id)).map((id) => ({ state: id }) as ElemRef),
  }));
}

export function powerset(n: NEA, opts: ProcOptions = {}): ProcResult<DEA> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('powerset', n, ['nea']);
    noWordEdges(n);
    const p = powerCore(n, rec, opts);
    const r = nameFix(p.dea, opts, n, '_dea');
    return {
      ...layoutAuto(r),
      origin: mkOrigin('powerset', [n], powerCorr(p, new Set(n.states.map((s) => s.id)))),
    };
  });
}

export function neaToDea(n: NEA | DEA, opts: ProcOptions = {}): ProcResult<DEA> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('nea2dea', n, ['nea', 'dea']);
    const src: NEA = n.kind === 'dea' ? deaAsNea(n) : n;
    const known = new Set(src.states.map((s) => s.id));
    const hasWords = src.transitions.some((t) => t.label.length >= 2);
    const hasEps = src.transitions.some((t) => t.label.length === 0);
    rec.add(hasWords ? 'proc.phase' : 'proc.phase.skip', { phase: 1 }, () => ({ obj: snapAuto(src) }));
    const a = splitCore(src, rec);
    rec.add(hasEps ? 'proc.phase' : 'proc.phase.skip', { phase: 2 }, () => ({ obj: snapAuto(a) }));
    const b = epsCore(a, rec);
    rec.add('proc.phase', { phase: 3 }, () => ({ obj: snapAuto(b) }));
    const p = powerCore(b, rec, opts);
    const r = nameFix(p.dea, opts, n, '_dea');
    return { ...layoutAuto(r), origin: mkOrigin('nea2dea', [n], powerCorr(p, known)) };
  });
}

// ---------------------------------------------------------------------------
// Schneller Weg ohne Schritte: Teilmengenkonstruktion mit ε-Hülle direkt

/**
 * Totaler DEA über `alphabet` (Obermenge der Symbole des NEA), nur erreichbare Teilmengen.
 * Gibt null zurück, wenn das Limit überschritten wird.
 */
export function fastDea(n: NEA, alphabet: Sym[], maxStates = 2000000): DEA | null {
  const N = n.states.length;
  const idx = new Map(n.states.map((s, i) => [s.id, i]));
  let total = N;
  const eps: number[][] = [];
  const edges: { from: number; to: number; sym: Sym }[] = [];
  const ensure = (i: number): void => {
    while (eps.length <= i) eps.push([]);
  };
  ensure(N);
  for (const t of n.transitions) {
    const a = idx.get(t.from);
    const b = idx.get(t.to);
    if (a === undefined || b === undefined) continue;
    if (t.label.length === 0) (eps[a] as number[]).push(b);
    else {
      let cur = a;
      for (let i = 0; i < t.label.length; i++) {
        const next = i === t.label.length - 1 ? b : total++;
        edges.push({ from: cur, to: next, sym: t.label[i] as Sym });
        cur = next;
      }
    }
  }
  ensure(total);
  const ai = new Map(alphabet.map((x, i) => [x, i]));
  const step: number[][][] = [];
  for (let i = 0; i < total; i++) step.push(alphabet.map(() => []));
  for (const e of edges) {
    const x = ai.get(e.sym);
    if (x !== undefined) ((step[e.from] as number[][])[x] as number[]).push(e.to);
  }
  const closure = (seed: Iterable<number>): number[] => {
    const seen = new Set<number>(seed);
    const stack = [...seen];
    while (stack.length > 0) {
      const s = stack.pop() as number;
      for (const t of eps[s] as number[]) {
        if (!seen.has(t)) {
          seen.add(t);
          stack.push(t);
        }
      }
    }
    return [...seen].sort((a, b) => a - b);
  };
  const acc = new Set(n.accept.map((id) => idx.get(id)).filter((x): x is number => x !== undefined));
  const sets: number[][] = [];
  const keyOf = new Map<string, number>();
  const add = (s: number[]): number => {
    const k = s.join(',');
    const have = keyOf.get(k);
    if (have !== undefined) return have;
    sets.push(s);
    keyOf.set(k, sets.length - 1);
    return sets.length - 1;
  };
  const s0 = idx.get(n.start as StateId);
  if (s0 === undefined) return null;
  add(closure([s0]));
  const trans: Transition<Sym>[] = [];
  for (let k = 0; k < sets.length; k++) {
    if (sets.length > maxStates) return null;
    const S = sets[k] as number[];
    for (let x = 0; x < alphabet.length; x++) {
      const u = new Set<number>();
      for (const z of S) for (const y of (step[z] as number[][])[x] as number[]) u.add(y);
      const t = add(closure(u));
      trans.push({ id: `t${trans.length}`, from: `s${k}`, to: `s${t}`, label: alphabet[x] as Sym });
    }
  }
  const states: State[] = sets.map((_, i) => ({ id: `s${i}`, name: `q${i}` }));
  const accept = sets.map((s, i) => (s.some((z) => acc.has(z)) ? `s${i}` : null)).filter((x): x is string => x !== null);
  return mkDea(n.name, alphabet, states, 's0', accept, trans);
}

