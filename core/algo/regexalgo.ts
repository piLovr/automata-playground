// Verfahren mit regulären Ausdrücken: 2.30 (DEA → Ausdruck), Zustandselimination, 2.52–2.54, Thompson.
import type {
  Correspondence,
  DEA,
  ElemRef,
  ExprPath,
  Grammar,
  NEA,
  ProcOptions,
  ProcResult,
  Production,
  RegExpr,
  RegexObj,
  State,
  StateId,
  StepTable,
  Sym,
  Transition,
  Word,
} from '../model/types';
import {
  Progress,
  Rec,
  clone,
  guard,
  layoutAuto,
  limitAbort,
  limits,
  mkNea,
  mkOrigin,
  need,
  newRec,
  printRegex,
  regexSize,
  regexSymbols,
  resultName,
  snapAuto,
} from './common';
import { EMPTY, EPS, cloneExpr, ctor, size, unionAll } from './rexpr';

function regexObj(name: string, alphabet: Sym[], expr: RegExpr): RegexObj {
  return { kind: 'regex', name, alphabet: alphabet.slice(), expr: cloneExpr(expr) };
}

// ---------------------------------------------------------------------------
// 2.30

export function deaToRegex(m: DEA, opts: ProcOptions = {}): ProcResult<RegexObj> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('dea2regex', m, ['dea']);
    const maxSize = limits(opts).maxExprSize;
    const prog = new Progress(opts.onProgress);
    const c = ctor(opts.simplify !== false);
    const start = m.states.findIndex((s) => s.id === m.start);
    const order: State[] = [m.states[start] as State, ...m.states.filter((_, i) => i !== start)];
    const k = order.length;
    if (start !== 0) {
      rec.add('proc.lk.order', { order: order.map((s) => s.id) }, () => ({ obj: snapAuto(m) }));
    }
    const idx = new Map(order.map((s, i) => [s.id, i]));
    const check = (e: RegExpr): RegExpr => {
      if (size(e) > maxSize) limitAbort('exprSize', maxSize);
      return e;
    };
    let L: RegExpr[][] = order.map(() => order.map(() => EMPTY));
    const lists: RegExpr[][][] = order.map(() => order.map(() => []));
    for (const x of m.alphabet) {
      for (const t of m.transitions) {
        if (t.label !== x) continue;
        (lists[idx.get(t.from) as number] as RegExpr[][])[idx.get(t.to) as number]?.push({ op: 'sym', sym: x });
      }
    }
    L = L.map((row, i) =>
      row.map((_, j) => {
        const l = (lists[i] as RegExpr[][])[j] as RegExpr[];
        return check(i === j ? unionAll(c, [...l, EPS]) : unionAll(c, l));
      }),
    );
    const names = order.map((s) => s.name);
    const table = (kk: number): StepTable => ({
      corner: `L^${kk}`,
      colHead: names.slice(),
      rowHead: names.slice(),
      cells: L.map((row) => row.map((e) => printRegex(e))),
    });
    rec.add('proc.lk.base', { k: 0 }, () => ({ table: table(0) }));
    for (let kk = 1; kk <= k; kk++) {
      const v = kk - 1;
      const prev = L;
      const loop = c.star((prev[v] as RegExpr[])[v] as RegExpr);
      L = prev.map((row, i) =>
        row.map((e, j) => {
          const via = c.concat(c.concat((prev[i] as RegExpr[])[v] as RegExpr, loop), (prev[v] as RegExpr[])[j] as RegExpr);
          return check(c.union(e, via));
        }),
      );
      prog.tick(kk);
      rec.add(
        'proc.lk.round',
        { k: kk, via: (order[v] as State).id },
        () => ({ table: table(kk) }),
        { source: 0, elems: [{ state: (order[v] as State).id }] },
      );
    }
    const acc = new Set(m.accept);
    const finals = order.filter((s) => acc.has(s.id)).map((s) => s.id);
    const expr = check(unionAll(c, finals.map((id) => (L[0] as RegExpr[])[idx.get(id) as number] as RegExpr)));
    const result = regexObj(resultName(opts, m, '_ra'), m.alphabet, expr);
    rec.add('proc.lk.result', { finals }, () => ({ obj: clone(result), table: table(k) }), {
      source: 0,
      elems: finals.map((s) => ({ state: s })),
    });
    return { ...result, origin: mkOrigin('dea2regex', [m]) };
  });
}

// ---------------------------------------------------------------------------
// Zustandselimination

export function deaToRegexElim(m: DEA, opts: ProcOptions = {}): ProcResult<RegexObj> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('dea2regexElim', m, ['dea']);
    const maxSize = limits(opts).maxExprSize;
    const c = ctor(opts.simplify !== false);
    const n = m.states.length;
    const END = n + 1;
    const idx = new Map(m.states.map((s, i) => [s.id, i + 1]));
    const edges = new Map<string, RegExpr>();
    const K = (i: number, j: number): string => `${i},${j}`;
    const get = (i: number, j: number): RegExpr | undefined => edges.get(K(i, j));
    const check = (e: RegExpr): RegExpr => {
      if (size(e) > maxSize) limitAbort('exprSize', maxSize);
      return e;
    };
    const lists = new Map<string, RegExpr[]>();
    for (const x of m.alphabet) {
      for (const t of m.transitions) {
        if (t.label !== x) continue;
        const key = K(idx.get(t.from) as number, idx.get(t.to) as number);
        (lists.get(key) ?? lists.set(key, []).get(key)!).push({ op: 'sym', sym: x });
      }
    }
    for (const [key, l] of lists) edges.set(key, unionAll(c, l));
    edges.set(K(0, idx.get(m.start as StateId) as number), EPS);
    for (const id of m.accept) edges.set(K(idx.get(id) as number, END), EPS);
    const alive = new Set<number>([0, END, ...m.states.map((_, i) => i + 1)]);
    const nameOf = (i: number): string => (i === 0 ? '⊢' : i === END ? '⊣' : (m.states[i - 1] as State).name);
    const table = (): StepTable => {
      const rowHead: string[] = [];
      const cells: string[][] = [];
      for (let i = 0; i <= END; i++) {
        for (let j = 0; j <= END; j++) {
          const e = get(i, j);
          if (e !== undefined && alive.has(i) && alive.has(j)) {
            rowHead.push(`${nameOf(i)}→${nameOf(j)}`);
            cells.push([printRegex(e)]);
          }
        }
      }
      return { colHead: ['R'], rowHead, cells };
    };
    for (let q = 1; q <= n; q++) {
      const loop = get(q, q);
      const star = loop === undefined ? null : c.star(loop);
      const nodes = [...alive].filter((x) => x !== q).sort((a, b) => a - b);
      const ins = nodes.filter((i) => get(i, q) !== undefined);
      const outs = nodes.filter((j) => get(q, j) !== undefined);
      for (const i of ins) {
        for (const j of outs) {
          let via = get(i, q) as RegExpr;
          if (star !== null) via = c.concat(via, star);
          via = c.concat(via, get(q, j) as RegExpr);
          const old = get(i, j);
          edges.set(K(i, j), check(old === undefined ? via : c.union(old, via)));
        }
      }
      alive.delete(q);
      for (const key of [...edges.keys()]) {
        const [a, b] = key.split(',').map(Number) as [number, number];
        if (a === q || b === q) edges.delete(key);
      }
      const sid = (m.states[q - 1] as State).id;
      rec.add('proc.elim.state', { state: sid }, () => ({ table: table() }), { source: 0, elems: [{ state: sid }] });
    }
    const expr = get(0, END) ?? EMPTY;
    check(expr);
    return { ...regexObj(resultName(opts, m, '_ra'), m.alphabet, expr), origin: mkOrigin('dea2regexElim', [m]) };
  });
}

// ---------------------------------------------------------------------------
// 2.52–2.54 Ausdruck → Grammatik

interface Part {
  N: Sym[];
  P: { left: Sym; right: Word }[];
  start: Sym;
}

export function regexToGrammar(r: RegexObj, opts: ProcOptions = {}): ProcResult<Grammar> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('regex2grammar', r, ['regex']);
    const expr = r.expr as RegExpr;
    const maxSize = limits(opts).maxExprSize;
    if (regexSize(expr) > maxSize) limitAbort('exprSize', maxSize);
    const T: Sym[] = [...r.alphabet];
    for (const s of regexSymbols(expr)) if (!T.includes(s)) T.push(s);
    const Tset = new Set(T);
    let counter = 0;
    const fresh = (): Sym => {
      let s = `X${counter++}`;
      while (Tset.has(s)) s = `X${counter++}`;
      return s;
    };
    const owner = new Map<Sym, ExprPath>();
    const gram = (p: Part): Grammar => ({
      kind: 'grammatik',
      name: resultName(opts, r, '_g'),
      nonterminals: p.N.slice(),
      terminals: T.slice(),
      start: p.start,
      productions: p.P.map((q, i): Production => ({ id: `p${i}`, left: [q.left], right: q.right.slice() })),
    });
    const isT = (w: Word): boolean => w.every((s) => Tset.has(s));
    const gen = (e: RegExpr, path: ExprPath): Part => {
      let part: Part;
      let key: string;
      switch (e.op) {
        case 'empty': {
          const x = fresh();
          part = { N: [x], P: [], start: x };
          key = 'proc.rg.empty';
          break;
        }
        case 'sym': {
          const x = fresh();
          part = { N: [x], P: [{ left: x, right: [e.sym] }], start: x };
          key = 'proc.rg.sym';
          break;
        }
        case 'union': {
          const a = gen(e.left, [...path, 0]);
          const b = gen(e.right, [...path, 1]);
          const x = fresh();
          part = {
            N: [...a.N, ...b.N, x],
            P: [...a.P, ...b.P, { left: x, right: [a.start] }, { left: x, right: [b.start] }],
            start: x,
          };
          key = 'proc.rg.union';
          break;
        }
        case 'concat': {
          const a = gen(e.left, [...path, 0]);
          const b = gen(e.right, [...path, 1]);
          part = {
            N: [...a.N, ...b.N],
            P: [...a.P.map((q) => (isT(q.right) ? { left: q.left, right: [...q.right, b.start] } : q)), ...b.P],
            start: a.start,
          };
          key = 'proc.rg.concat';
          break;
        }
        default: {
          const a = gen(e.inner, [...path, 0]);
          const x = fresh();
          part = {
            N: [...a.N, x],
            P: [
              ...a.P.map((q) => (isT(q.right) ? { left: q.left, right: [...q.right, x] } : q)),
              { left: x, right: [] },
              { left: x, right: [a.start] },
            ],
            start: x,
          };
          key = 'proc.rg.star';
        }
      }
      owner.set(part.start, path);
      rec.add(key, { path }, () => ({ obj: gram(part) }), { source: 0, elems: [{ subexpr: path }] });
      return part;
    };
    const part = gen(expr, []);
    const g = gram(part);
    const corr: Correspondence[] = g.nonterminals.map((x) => ({
      target: { nonterminal: x } as ElemRef,
      source: 0,
      elems: [{ subexpr: owner.get(x) as ExprPath }],
    }));
    return { ...g, origin: mkOrigin('regex2grammar', [r], corr) };
  });
}

// ---------------------------------------------------------------------------
// Thompson

interface Frag {
  nodes: number[];
  edges: { from: number; to: number; label: Word }[];
  s: number;
  e: number;
}

export function thompsonCore(r: RegexObj, rec: Rec, opts: ProcOptions | undefined): NEA {
  const expr = r.expr as RegExpr;
  const lim = limits(opts).maxStates;
  const alphabet: Sym[] = [...r.alphabet];
  for (const s of regexSymbols(expr)) if (!alphabet.includes(s)) alphabet.push(s);
  let counter = 0;
  const fresh = (): number => {
    if (counter + 1 > lim) limitAbort('states', lim);
    return counter++;
  };
  const toNea = (f: Frag): NEA => {
    const nodes = [...f.nodes].sort((a, b) => a - b);
    const states: State[] = nodes.map((n) => ({ id: `s${n}`, name: `q${n}` }));
    const trans: Transition<Word>[] = f.edges.map((x, i) => ({ id: `t${i}`, from: `s${x.from}`, to: `s${x.to}`, label: x.label.slice() }));
    return mkNea(resultName(opts, r, '_nea'), alphabet, states, `s${f.s}`, [`s${f.e}`], trans);
  };
  const gen = (e: RegExpr, path: ExprPath): Frag => {
    let f: Frag;
    let key: string;
    switch (e.op) {
      case 'empty': {
        const s = fresh();
        const t = fresh();
        f = { nodes: [s, t], edges: [], s, e: t };
        key = 'proc.th.empty';
        break;
      }
      case 'sym': {
        const s = fresh();
        const t = fresh();
        f = { nodes: [s, t], edges: [{ from: s, to: t, label: [e.sym] }], s, e: t };
        key = 'proc.th.sym';
        break;
      }
      case 'union': {
        const a = gen(e.left, [...path, 0]);
        const b = gen(e.right, [...path, 1]);
        const s = fresh();
        const t = fresh();
        f = {
          nodes: [...a.nodes, ...b.nodes, s, t],
          edges: [
            ...a.edges,
            ...b.edges,
            { from: s, to: a.s, label: [] },
            { from: s, to: b.s, label: [] },
            { from: a.e, to: t, label: [] },
            { from: b.e, to: t, label: [] },
          ],
          s,
          e: t,
        };
        key = 'proc.th.union';
        break;
      }
      case 'concat': {
        const a = gen(e.left, [...path, 0]);
        const b = gen(e.right, [...path, 1]);
        f = {
          nodes: [...a.nodes, ...b.nodes],
          edges: [...a.edges, ...b.edges, { from: a.e, to: b.s, label: [] }],
          s: a.s,
          e: b.e,
        };
        key = 'proc.th.concat';
        break;
      }
      default: {
        const a = gen(e.inner, [...path, 0]);
        const s = fresh();
        const t = fresh();
        f = {
          nodes: [...a.nodes, s, t],
          edges: [
            ...a.edges,
            { from: s, to: a.s, label: [] },
            { from: s, to: t, label: [] },
            { from: a.e, to: a.s, label: [] },
            { from: a.e, to: t, label: [] },
          ],
          s,
          e: t,
        };
        key = 'proc.th.star';
      }
    }
    rec.add(key, { path }, () => ({ obj: snapAuto(toNea(f)) }), { source: 0, elems: [{ subexpr: path }] });
    return f;
  };
  return toNea(gen(expr, []));
}

export function thompson(r: RegexObj, opts: ProcOptions = {}): ProcResult<NEA> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('thompson', r, ['regex']);
    const n = thompsonCore(r, rec, opts);
    return { ...layoutAuto(n), origin: mkOrigin('thompson', [r]) };
  });
}
