// Grammatik-Verfahren: 2.49/2.50 (DEA → Grammatik), 2.69 (Typ 3 → NEA).
import type {
  Correspondence,
  DEA,
  Grammar,
  NEA,
  ProcOptions,
  ProcResult,
  Production,
  ProductionId,
  State,
  StateId,
  Sym,
  Transition,
  Word,
} from '../model/types';
import { Rec, abort, clone, guard, isStateName, layoutAuto, mkNea, mkOrigin, need, newRec, resultName, snapAuto, uniqueName } from './common';

/** Produktionen, die nicht rechtslinear (Typ 3, 2.45) sind. */
export function type3Violations(g: Grammar): ProductionId[] {
  const N = new Set(g.nonterminals);
  const T = new Set(g.terminals);
  const bad: ProductionId[] = [];
  for (const p of g.productions) {
    let ok = p.left.length === 1 && N.has(p.left[0] as Sym);
    if (ok) {
      const last = p.right[p.right.length - 1];
      const body = last !== undefined && N.has(last) ? p.right.slice(0, -1) : p.right;
      ok = body.every((s) => T.has(s));
    }
    if (!ok) bad.push(p.id);
  }
  return bad;
}

// ---------------------------------------------------------------------------
// 2.49 / 2.50

export function deaToGrammar(m: DEA, opts: ProcOptions = {}): ProcResult<Grammar> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('dea2grammar', m, ['dea']);
    const T = new Set(m.alphabet);
    const used = new Set<string>(T);
    const nt = new Map<StateId, Sym>();
    for (const s of m.states) nt.set(s.id, uniqueName(used, `X${s.name}`));
    const g: Grammar = {
      kind: 'grammatik',
      name: resultName(opts, m, '_g'),
      nonterminals: m.states.map((s) => nt.get(s.id) as Sym),
      terminals: m.alphabet.slice(),
      start: nt.get(m.start as StateId) as Sym,
      productions: [],
    };
    const corr: Correspondence[] = m.states.map((s) => ({
      target: { nonterminal: nt.get(s.id) as Sym },
      source: 0,
      elems: [{ state: s.id }],
    }));
    for (const t of m.transitions) {
      const p: Production = { id: `p${g.productions.length}`, left: [nt.get(t.from) as Sym], right: [t.label, nt.get(t.to) as Sym] };
      g.productions.push(p);
      corr.push({ target: { production: p.id }, source: 0, elems: [{ transition: t.id }] });
      rec.add('proc.dg.trans', { transition: t.id, production: p.id }, () => ({ obj: clone(g), highlight: [{ production: p.id }] }), {
        source: 0,
        elems: [{ transition: t.id }],
      });
    }
    const acc = new Set(m.accept);
    for (const s of m.states) {
      if (!acc.has(s.id)) continue;
      const p: Production = { id: `p${g.productions.length}`, left: [nt.get(s.id) as Sym], right: [] };
      g.productions.push(p);
      corr.push({ target: { production: p.id }, source: 0, elems: [{ state: s.id }] });
      rec.add('proc.dg.final', { state: s.id, production: p.id }, () => ({ obj: clone(g), highlight: [{ production: p.id }] }), {
        source: 0,
        elems: [{ state: s.id }],
      });
    }
    return { ...g, origin: mkOrigin('dea2grammar', [m], corr) };
  });
}

// ---------------------------------------------------------------------------
// 2.69

export function grammarToNeaCore(g: Grammar, rec: Rec, opts: ProcOptions | undefined): { nea: NEA; zOf: Map<Sym, StateId>; prodEdge: Map<ProductionId, string> } {
  const used = new Set<string>();
  const states: State[] = [];
  const zOf = new Map<Sym, StateId>();
  for (const x of g.nonterminals) {
    const cand = `z${x}`;
    const name = isStateName(cand) ? uniqueName(used, cand) : uniqueName(used, 'z');
    const id = `s${states.length}`;
    states.push({ id, name });
    zOf.set(x, id);
  }
  const zf: State = { id: `s${states.length}`, name: uniqueName(used, 'zf') };
  states.push(zf);
  const nea = mkNea(resultName(opts, g, '_nea'), g.terminals, states, zOf.get(g.start as Sym) as StateId, [zf.id], []);
  rec.add('proc.gn.states', {}, () => ({ obj: snapAuto(nea), highlight: states.map((s) => ({ state: s.id })) }));
  const N = new Set(g.nonterminals);
  const prodEdge = new Map<ProductionId, string>();
  for (const p of g.productions) {
    const last = p.right[p.right.length - 1];
    const hasN = last !== undefined && N.has(last);
    const w: Word = hasN ? p.right.slice(0, -1) : p.right.slice();
    const to = hasN ? (zOf.get(last as Sym) as StateId) : zf.id;
    const t: Transition<Word> = { id: `t${nea.transitions.length}`, from: zOf.get(p.left[0] as Sym) as StateId, to, label: w };
    nea.transitions.push(t);
    prodEdge.set(p.id, t.id);
    rec.add('proc.gn.prod', { production: p.id, transition: t.id }, () => ({ obj: snapAuto(nea), added: [t.id], highlight: [{ transition: t.id }] }), {
      source: 0,
      elems: [{ production: p.id }],
    });
  }
  return { nea, zOf, prodEdge };
}

export function grammarToNea(g: Grammar, opts: ProcOptions = {}): ProcResult<NEA> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('grammar2nea', g, ['grammatik']);
    const bad = type3Violations(g);
    if (bad.length > 0) abort('algo.notType3', { productionIds: bad }, g.name);
    const { nea, zOf, prodEdge } = grammarToNeaCore(g, rec, opts);
    const corr: Correspondence[] = [];
    for (const [x, id] of zOf) corr.push({ target: { state: id }, source: 0, elems: [{ nonterminal: x }] });
    for (const [pid, tid] of prodEdge) corr.push({ target: { transition: tid }, source: 0, elems: [{ production: pid }] });
    return { ...layoutAuto(nea), origin: mkOrigin('grammar2nea', [g], corr) };
  });
}
