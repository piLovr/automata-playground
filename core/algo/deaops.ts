// Verfahren auf DEA: erreichbare Zustände (2.82), Minimierung (2.90), Komplement/Produkt (2.33).
import type {
  Correspondence,
  DEA,
  ElemRef,
  ProcOptions,
  ProcResult,
  State,
  StateId,
  StepTable,
  Sym,
  Transition,
} from '../model/types';
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
  mkOrigin,
  need,
  needTotal,
  newRec,
  resultName,
  setName,
  compactNames,
  snapAuto,
  uniqueName,
} from './common';

// ---------------------------------------------------------------------------
// 2.82

function reachCore(m: DEA, rec: Rec): { dea: DEA; removed: StateId[] } {
  const succ = new Map<StateId, StateId[]>();
  for (const t of m.transitions) (succ.get(t.from) ?? succ.set(t.from, []).get(t.from)!).push(t.to);
  const S = new Set<StateId>([m.start as StateId]);
  const items = (): StateId[] => m.states.map((s) => s.id).filter((id) => S.has(id));
  let round = 0;
  rec.add('proc.reach.round', { round, added: [m.start] }, () => ({
    obj: snapAuto(m),
    set: { round, items: items() },
    highlight: items().map((s) => ({ state: s }) as ElemRef),
  }));
  for (;;) {
    const before = new Set(S);
    for (const z of before) for (const t of succ.get(z) ?? []) S.add(t);
    round++;
    const added = m.states.map((s) => s.id).filter((id) => S.has(id) && !before.has(id));
    rec.add('proc.reach.round', { round, added }, () => ({
      obj: snapAuto(m),
      set: { round, items: items() },
      highlight: added.map((s) => ({ state: s }) as ElemRef),
    }));
    if (added.length === 0) break;
  }
  const states = m.states.filter((s) => S.has(s.id)).map((s) => ({ id: s.id, name: s.name }));
  const removed = m.states.map((s) => s.id).filter((id) => !S.has(id));
  const dea = mkDea(
    m.name,
    m.alphabet,
    states,
    m.start,
    m.accept.filter((id) => S.has(id)),
    m.transitions.filter((t) => S.has(t.from) && S.has(t.to)).map((t) => ({ ...t })),
  );
  rec.add('proc.reach.done', { removed }, () => ({ obj: snapAuto(dea), highlight: removed.length ? [] : [] }));
  return { dea, removed };
}

function idCorr(states: State[]): Correspondence[] {
  return states.map((s) => ({ target: { state: s.id }, source: 0, elems: [{ state: s.id }] }));
}

export function reachable(m: DEA, opts: ProcOptions = {}): ProcResult<DEA> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('reachable', m, ['dea']);
    const r = reachCore(m, rec).dea;
    return {
      ...layoutAuto({ ...r, name: resultName(opts, m, '_err') }),
      origin: mkOrigin('reachable', [m], idCorr(r.states)),
    };
  });
}

// ---------------------------------------------------------------------------
// 2.90

export function minimize(m: DEA, opts: ProcOptions = {}): ProcResult<DEA> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('minimize', m, ['dea']);
    needTotal(m);
    const R = reachCore(m, rec).dea;
    const Z = R.states;
    const X = R.alphabet;
    const idx = new Map(Z.map((s, i) => [s.id, i]));
    const delta: number[][] = Z.map(() => X.map(() => -1));
    for (const t of R.transitions) {
      const x = X.indexOf(t.label);
      (delta[idx.get(t.from) as number] as number[])[x] = idx.get(t.to) as number;
    }
    const acc = new Set(R.accept.map((id) => idx.get(id) as number));
    // cls[i] = Klassennummer (0-basiert); Klassen nach erstem Zustand in Modellreihenfolge
    const renumber = (keys: string[]): number[] => {
      const nr = new Map<string, number>();
      return keys.map((k) => {
        let v = nr.get(k);
        if (v === undefined) {
          v = nr.size;
          nr.set(k, v);
        }
        return v;
      });
    };
    let cls = renumber(Z.map((_, i) => (acc.has(i) ? 'F' : 'N')));
    const classesOf = (c: number[]): StateId[][] => {
      const out: StateId[][] = [];
      c.forEach((k, i) => {
        (out[k] ??= []).push((Z[i] as State).id);
      });
      return out;
    };
    const tableOf = (prev: number[], now: number[]): StepTable => ({
      corner: '≡',
      colHead: [...X, '[z]'],
      rowHead: Z.map((s) => s.name),
      cells: Z.map((_, i) => [
        ...X.map((_x, x) => String(((prev[(delta[i] as number[])[x] as number] as number) ?? 0) + 1)),
        String((now[i] as number) + 1),
      ]),
    });
    rec.add('proc.min.eq0', { classes: classesOf(cls) }, () => ({
      obj: snapAuto(R),
      partition: { round: 0, classes: classesOf(cls) },
      table: tableOf(cls, cls),
    }));
    let round = 0;
    for (;;) {
      const next = renumber(
        Z.map((_, i) => `${cls[i]}|${X.map((_x, x) => cls[(delta[i] as number[])[x] as number]).join(',')}`),
      );
      const oldCount = Math.max(-1, ...cls) + 1;
      const newCount = Math.max(-1, ...next) + 1;
      round++;
      if (newCount === oldCount) {
        rec.add('proc.min.stable', { round }, () => ({
          obj: snapAuto(R),
          partition: { round, classes: classesOf(cls) },
          table: tableOf(cls, cls),
        }));
        break;
      }
      const old = classesOf(cls);
      const nw = classesOf(next);
      const split = old.filter((c) => !nw.some((d) => d.length === c.length && d.every((id, k) => id === c[k])));
      const prev = cls;
      cls = next;
      rec.add('proc.min.round', { round, classes: classesOf(cls), split }, () => ({
        obj: snapAuto(R),
        partition: { round, classes: classesOf(cls) },
        table: tableOf(prev, cls),
        highlight: split.flat().map((s) => ({ state: s }) as ElemRef),
      }));
    }
    const classes = classesOf(cls);
    const used = new Set<string>();
    const states: State[] = compactNames(
      classes.map((c, k) => ({
        id: `s${k}`,
        name: uniqueName(used, setName(c.map((id) => (Z[idx.get(id) as number] as State).name))),
      })),
    );
    const trans: Transition<Sym>[] = [];
    classes.forEach((c, k) => {
      const rep = idx.get(c[0] as StateId) as number;
      X.forEach((x, xi) =>
        trans.push({ id: `t${trans.length}`, from: `s${k}`, to: `s${cls[(delta[rep] as number[])[xi] as number]}`, label: x }),
      );
    });
    const accSet = new Set<number>();
    for (const i of acc) accSet.add(cls[i] as number);
    const result = mkDea(
      resultName(opts, m, '_min'),
      X,
      states,
      `s${cls[idx.get(R.start as StateId) as number]}`,
      [...accSet].sort((a, b) => a - b).map((k) => `s${k}`),
      trans,
    );
    const corr: Correspondence[] = classes.map((c, k) => ({
      target: { state: `s${k}` },
      source: 0,
      elems: c.map((id) => ({ state: id })),
    }));
    return { ...layoutAuto(result), origin: mkOrigin('minimize', [m], corr) };
  });
}

// ---------------------------------------------------------------------------
// 2.33 Komplement

export function complement(m: DEA, opts: ProcOptions = {}): ProcResult<DEA> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('complement', m, ['dea']);
    needTotal(m);
    const acc = new Set(m.accept);
    const finals = m.states.map((s) => s.id).filter((id) => !acc.has(id));
    const r = mkDea(
      resultName(opts, m, '_komp'),
      m.alphabet,
      m.states.map((s) => ({ id: s.id, name: s.name })),
      m.start,
      finals,
      m.transitions.map((t) => ({ ...t })),
    );
    const out = layoutAuto(r);
    rec.add('proc.compl', { finals }, () => ({ obj: snapAuto(out), highlight: finals.map((s) => ({ state: s }) as ElemRef) }));
    return { ...out, origin: mkOrigin('complement', [m], idCorr(r.states)) };
  });
}

// ---------------------------------------------------------------------------
// 2.33 Produkt

export function product(
  a: DEA,
  b: DEA,
  op: 'intersection' | 'union',
  opts: ProcOptions = {},
): ProcResult<DEA> {
  const rec = newRec(opts);
  return guard(rec, () => {
    const method = op;
    need(method, a, ['dea']);
    need(method, b, ['dea']);
    const sa = new Set(a.alphabet);
    const sb = new Set(b.alphabet);
    if (sa.size !== sb.size || [...sa].some((x) => !sb.has(x))) {
      abort('algo.alphabetMismatch', { left: a.alphabet, right: b.alphabet });
    }
    needTotal(a);
    needTotal(b);
    const lim = limits(opts).maxStates;
    const prog = new Progress(opts.onProgress);
    const X = a.alphabet;
    const next = (m: DEA): Map<string, StateId> => {
      const mp = new Map<string, StateId>();
      for (const t of m.transitions) mp.set(`${t.from}\u0000${t.label}`, t.to);
      return mp;
    };
    const fa = next(a);
    const fb = next(b);
    const name = (m: DEA, id: StateId): string => (m.states.find((s) => s.id === id) as State).name;
    const accA = new Set(a.accept);
    const accB = new Set(b.accept);
    const pairs: [StateId, StateId][] = [[a.start as StateId, b.start as StateId]];
    const keyOf = new Map<string, number>([[`${a.start}\u0000${b.start}`, 0]]);
    const rows: number[][] = [];
    const table: StepTable = { colHead: X.slice(), rowHead: [], cells: [] };
    const txt = ([p, q]: [StateId, StateId]): string => `(${name(a, p)},${name(b, q)})`;
    for (let k = 0; k < pairs.length; k++) {
      const [p, q] = pairs[k] as [StateId, StateId];
      const to: number[] = [];
      const targets: [StateId, StateId][] = [];
      for (const x of X) {
        const t: [StateId, StateId] = [fa.get(`${p}\u0000${x}`) as StateId, fb.get(`${q}\u0000${x}`) as StateId];
        const key = `${t[0]}\u0000${t[1]}`;
        let i = keyOf.get(key);
        if (i === undefined) {
          if (pairs.length + 1 > lim) limitAbort('states', lim);
          i = pairs.length;
          pairs.push(t);
          keyOf.set(key, i);
        }
        to.push(i);
        targets.push(t);
      }
      rows.push(to);
      prog.tick(pairs.length);
      if (rec.on) {
        table.rowHead.push(txt([p, q]));
        table.cells.push(targets.map(txt));
        rec.add(
          'proc.prod.pair',
          { state: `s${k}`, pair: [p, q], targets },
          () => ({ table: { ...clone(table), activeRow: table.rowHead.length - 1 } }),
        );
      }
    }
    const used = new Set<string>();
    const states: State[] = pairs.map(([p, q], i) => ({
      id: `s${i}`,
      name: uniqueName(used, `${name(a, p)}_${name(b, q)}`),
    }));
    const trans: Transition<Sym>[] = [];
    rows.forEach((to, k) => to.forEach((t, x) => trans.push({ id: `t${trans.length}`, from: `s${k}`, to: `s${t}`, label: X[x] as Sym })));
    const accept = pairs
      .map(([p, q], i) => {
        const ok = op === 'intersection' ? accA.has(p) && accB.has(q) : accA.has(p) || accB.has(q);
        return ok ? `s${i}` : null;
      })
      .filter((x): x is string => x !== null);
    const r = mkDea(resultName(opts, a, op === 'intersection' ? '_schnitt' : '_ver'), X, states, 's0', accept, trans);
    const corr: Correspondence[] = [];
    pairs.forEach(([p, q], i) => {
      corr.push({ target: { state: `s${i}` }, source: 0, elems: [{ state: p }] });
      corr.push({ target: { state: `s${i}` }, source: 1, elems: [{ state: q }] });
    });
    return { ...layoutAuto(r), origin: mkOrigin(method, [a, b], corr) };
  });
}

