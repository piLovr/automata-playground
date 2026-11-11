// Chomsky-Normalform (6.22–6.32): EPS(G), die vier Schritte von 6.31 und die Prüfung isCnf.
import type {
  Correspondence,
  CnfOptions,
  ElemRef,
  Grammar,
  ProcOptions,
  ProcResult,
  Production,
  ProductionId,
  Sym,
  Word,
} from '../model/types';
import { Rec, abort, clone, guard, mkOrigin, need, newRec, resultName, setText } from '../algo/common';
import { type2Violations } from '../algo/parsing';

type MethodName = 'cnfTerminals' | 'cnfEpsilon' | 'cnfChains' | 'cnfLong' | 'toCnf';

/** Ergebnis eines Schritts samt Herkunft der Produktionen (neue Id → Id der Eingabe). */
interface Built {
  g: Grammar;
  prodSrc: Record<ProductionId, ProductionId | undefined>;
  /** Neue Nichtterminale V_i → Produktion der Eingabe, aus der sie entstanden. */
  ntSrc: Record<Sym, ProductionId | undefined>;
}

function needType2(method: MethodName, g: Grammar): void {
  need(method, g, ['grammatik']);
  const bad = type2Violations(g);
  if (bad.length > 0) abort('algo.notType2', { productionIds: bad }, g.name);
}

const pkey = (left: Word, right: Word): string => `${left.join('\u0000')}\u0001${right.join('\u0000')}`;

function snapG(g: Grammar): Grammar {
  const c = clone(g);
  delete c.origin;
  return c;
}

function mkGrammar(src: Grammar, name: string, nonterminals: Sym[], start: Sym | null, prods: { left: Word; right: Word }[]): Grammar {
  return {
    kind: 'grammatik',
    name,
    nonterminals,
    terminals: src.terminals.slice(),
    start,
    productions: prods.map((p, i): Production => ({ id: `p${i}`, left: p.left.slice(), right: p.right.slice() })),
  };
}

function freshName(used: Set<string>, base: string): string {
  let name = base;
  let n = 0;
  while (used.has(name)) name = `${base}${n++}`;
  used.add(name);
  return name;
}

// ---------------------------------------------------------------------------
// EPS (6.24/6.25)

/** M0, M1, … (Runden) nach 6.25; letzte Runde ändert nichts. Elemente in Entdeckungsreihenfolge. */
function epsRounds(g: Grammar): Sym[][] {
  const N = new Set(g.nonterminals);
  let cur: Sym[] = [];
  const seen = new Set<Sym>();
  for (const p of g.productions) {
    const x = p.left[0] as Sym;
    if (p.right.length === 0 && N.has(x) && !seen.has(x)) {
      seen.add(x);
      cur.push(x);
    }
  }
  const rounds: Sym[][] = [cur];
  for (;;) {
    const next = cur.slice();
    for (const p of g.productions) {
      const x = p.left[0] as Sym;
      if (!seen.has(x) && p.right.every((s) => seen.has(s) && cur.includes(s))) {
        // seen enthält zwischenzeitlich Neues; cur.includes sichert „Mi−1“
        seen.add(x);
        next.push(x);
      }
    }
    rounds.push(next);
    if (next.length === cur.length) return rounds;
    cur = next;
  }
}

function recEps(rec: Rec, rounds: Sym[][], phase: number): void {
  rounds.forEach((m, i) => {
    const prev = i === 0 ? [] : (rounds[i - 1] as Sym[]);
    const added = m.filter((x) => !prev.includes(x));
    rec.add('proc.eps.round', { round: i, added, set: m.slice(), phase }, () => ({
      table: {
        corner: 'i',
        colHead: ['EPS'],
        rowHead: rounds.slice(0, i + 1).map((_, k) => `M${k}`),
        cells: rounds.slice(0, i + 1).map((r) => [setText(r)]),
        activeRow: i,
      },
    }));
  });
}

/** EPS(G) = {X | X ⇒* ε} (6.24/6.25), ein Schritt je Runde. */
export function epsSet(g: Grammar, opts: ProcOptions = {}): ProcResult<Sym[]> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('toCnf', g, ['grammatik']);
    const bad = type2Violations(g);
    if (bad.length > 0) abort('algo.notType2', { productionIds: bad }, g.name);
    const rounds = epsRounds(g);
    recEps(rec, rounds, 0);
    return (rounds[rounds.length - 1] as Sym[]).slice();
  });
}

// ---------------------------------------------------------------------------
// Prüfung 6.22

export function isCnf(g: Grammar): { ok: boolean; productionIds: ProductionId[] } {
  const N = new Set(g.nonterminals);
  const T = new Set(g.terminals);
  const onRight = new Set<Sym>();
  for (const p of g.productions) for (const s of p.right) onRight.add(s);
  const bad: ProductionId[] = [];
  for (const p of g.productions) {
    const x = p.left[0];
    let ok = p.left.length === 1 && N.has(x as Sym);
    if (ok) {
      const r = p.right;
      if (r.length === 0) ok = x === g.start && !onRight.has(x as Sym);
      else if (r.length === 1) ok = T.has(r[0] as Sym);
      else if (r.length === 2) ok = N.has(r[0] as Sym) && N.has(r[1] as Sym);
      else ok = false;
    }
    if (!ok) bad.push(p.id);
  }
  return { ok: bad.length === 0, productionIds: bad };
}

// ---------------------------------------------------------------------------
// Ergebnis und Herkunft

function corrOf(b: Built): Correspondence[] {
  const out: Correspondence[] = [];
  for (const p of b.g.productions) {
    const s = b.prodSrc[p.id];
    if (s !== undefined) out.push({ target: { production: p.id }, source: 0, elems: [{ production: s }] });
  }
  for (const [v, s] of Object.entries(b.ntSrc)) {
    if (s !== undefined) out.push({ target: { nonterminal: v }, source: 0, elems: [{ production: s }] });
  }
  return out;
}

function finish(method: MethodName, src: Grammar, b: Built): Grammar {
  return { ...b.g, origin: mkOrigin(method, [src], corrOf(b)) };
}

function done(rec: Rec, phase: number, b: Built): void {
  rec.add('proc.cnf.done', { phase, productions: b.g.productions.length }, () => ({ obj: snapG(b.g) }));
}

// ---------------------------------------------------------------------------
// Schritt 1: Terminale auslagern

function step1(g: Grammar, opts: CnfOptions, rec: Rec): Built {
  const used = new Set<string>([...g.nonterminals, ...g.terminals]);
  const T = new Set(g.terminals);
  const occurs = new Set<Sym>();
  for (const p of g.productions) for (const s of p.right) if (T.has(s)) occurs.add(s);
  const terms = g.terminals.filter((a) => occurs.has(a));
  const zName = new Map<Sym, Sym>();
  for (const a of terms) zName.set(a, freshName(used, `Z${a}`));
  const name = resultName(opts, g, '_cnf1');
  const build = (doneTerms: Set<Sym>): Built => {
    const prods: { left: Word; right: Word }[] = [];
    const prodSrc: Built['prodSrc'] = {};
    for (const p of g.productions) {
      prodSrc[`p${prods.length}`] = p.id;
      prods.push({ left: p.left, right: p.right.map((s) => (doneTerms.has(s) ? (zName.get(s) as Sym) : s)) });
    }
    for (const a of terms) if (doneTerms.has(a)) prods.push({ left: [zName.get(a) as Sym], right: [a] });
    const nts = [...g.nonterminals, ...terms.filter((a) => doneTerms.has(a)).map((a) => zName.get(a) as Sym)];
    return { g: mkGrammar(g, name, nts, g.start, prods), prodSrc, ntSrc: {} };
  };
  const doneSet = new Set<Sym>();
  for (const a of terms) {
    doneSet.add(a);
    rec.add('proc.cnf.terminal', { phase: 1, terminal: a, nonterminal: zName.get(a) }, () => {
      const b = build(doneSet);
      const z = zName.get(a) as Sym;
      const hl: ElemRef[] = [{ nonterminal: z }, ...b.g.productions.filter((p) => p.right.includes(z)).map((p) => ({ production: p.id }))];
      return { obj: snapG(b.g), highlight: hl };
    });
  }
  const res = build(doneSet);
  done(rec, 1, res);
  return res;
}

export function cnfTerminals(g: Grammar, opts: CnfOptions = {}): ProcResult<Grammar> {
  const rec = newRec(opts);
  return guard(rec, () => {
    needType2('cnfTerminals', g);
    return finish('cnfTerminals', g, step1(g, opts, rec));
  });
}

// ---------------------------------------------------------------------------
// Schritt 2: ε-Produktionen entfernen (6.27–6.30)

function step2(g: Grammar, opts: CnfOptions, rec: Rec): Built {
  const rounds = epsRounds(g);
  recEps(rec, rounds, 2);
  const eps = new Set(rounds[rounds.length - 1] as Sym[]);
  const prods: { left: Word; right: Word }[] = [];
  const prodSrc: Built['prodSrc'] = {};
  const seen = new Set<string>();
  for (const p of g.productions) {
    let variants: Word[] = [[]];
    for (const s of p.right) {
      const next: Word[] = [];
      for (const v of variants) {
        next.push([...v, s]);
        if (eps.has(s)) next.push(v);
      }
      variants = next;
    }
    const fresh: Word[] = [];
    for (const v of variants) {
      if (v.length === 0) continue;
      const k = pkey(p.left, v);
      if (seen.has(k)) continue;
      seen.add(k);
      prodSrc[`p${prods.length}`] = p.id;
      prods.push({ left: p.left, right: v });
      fresh.push(v);
    }
    if (p.right.length === 0 || p.right.some((s) => eps.has(s))) {
      rec.add(
        'proc.cnf.epsilon.production',
        { phase: 2, production: p.id, left: p.left[0], right: p.right.slice(), variants: fresh },
        () => ({ highlight: [{ production: p.id }] }),
        { source: 0, elems: [{ production: p.id }] },
      );
    }
  }
  const nts = g.nonterminals.slice();
  let start = g.start;
  const ntSrc: Built['ntSrc'] = {};
  if (g.start !== null && eps.has(g.start)) {
    const used = new Set<string>([...g.nonterminals, ...g.terminals]);
    const s2 = freshName(used, `${g.start}′`);
    prods.push({ left: [s2], right: [g.start] }, { left: [s2], right: [] });
    nts.unshift(s2);
    rec.add('proc.cnf.epsilon.start', { phase: 2, start: g.start, newStart: s2 }, () => ({ highlight: [{ nonterminal: s2 }] }));
    start = s2;
  }
  const res: Built = { g: mkGrammar(g, resultName(opts, g, '_cnf2'), nts, start, prods), prodSrc, ntSrc };
  done(rec, 2, res);
  return res;
}

export function cnfEpsilon(g: Grammar, opts: CnfOptions = {}): ProcResult<Grammar> {
  const rec = newRec(opts);
  return guard(rec, () => {
    needType2('cnfEpsilon', g);
    return finish('cnfEpsilon', g, step2(g, opts, rec));
  });
}

// ---------------------------------------------------------------------------
// Schritt 3: Kettenproduktionen (M(X))

function step3(g: Grammar, opts: CnfOptions, rec: Rec): Built {
  const N = new Set(g.nonterminals);
  const isChain = (p: Production): boolean => p.right.length === 1 && N.has(p.right[0] as Sym);
  const rows = g.nonterminals;
  // M_0 … M_r
  const rounds: Sym[][][] = [rows.map((x) => [x])];
  for (;;) {
    const prev = rounds[rounds.length - 1] as Sym[][];
    const next = prev.map((m) => {
      const out = m.slice();
      for (const y of m) {
        for (const p of g.productions) {
          if (p.left[0] === y && isChain(p) && !out.includes(p.right[0] as Sym)) out.push(p.right[0] as Sym);
        }
      }
      return out;
    });
    rounds.push(next);
    if (next.every((m, i) => m.length === (prev[i] as Sym[]).length)) break;
  }
  const final = rounds[rounds.length - 1] as Sym[][];
  // Tabelle wie 6.32: nur Zeilen, in denen sich etwas ändert (sonst alle)
  let shown = rows.map((_, i) => i).filter((i) => (final[i] as Sym[]).length > 1);
  if (shown.length === 0) shown = rows.map((_, i) => i);
  rounds.forEach((_, r) => {
    rec.add('proc.cnf.chain.set', { phase: 3, round: r, final: r === rounds.length - 1 }, () => ({
      table: {
        corner: 'X',
        colHead: rounds.slice(0, r + 1).map((_, k) => `M${k}`),
        rowHead: shown.map((xi) => rows[xi] as Sym),
        cells: shown.map((xi) => rounds.slice(0, r + 1).map((rd) => setText((rd[xi] as Sym[]).slice()))),
      },
    }));
  });
  const M = new Map<Sym, Sym[]>(rows.map((x, i) => [x, final[i] as Sym[]]));
  const removed = g.productions.filter(isChain).map((p) => p.id);
  rec.add('proc.cnf.chain.drop', { phase: 3, productionIds: removed }, () => ({
    highlight: removed.map((id) => ({ production: id })),
  }), { source: 0, elems: removed.map((id) => ({ production: id })) });

  const prods: { left: Word; right: Word }[] = [];
  const prodSrc: Built['prodSrc'] = {};
  const seen = new Set<string>();
  let skippedTerminal = false;
  const add = (x: Sym, right: Word, src: ProductionId): boolean => {
    const k = pkey([x], right);
    if (seen.has(k)) return false;
    seen.add(k);
    prodSrc[`p${prods.length}`] = src;
    prods.push({ left: [x], right });
    return true;
  };
  for (const x of rows) {
    const before = prods.length;
    const mx = M.get(x) as Sym[];
    for (const xp of mx) {
      for (const p of g.productions) {
        if (p.left[0] !== xp || isChain(p)) continue;
        if (p.right.length <= 1) {
          // X → a bzw. X → ε: nur für X′ = X, sonst Übertragung (Entscheidung, nicht in 6.32)
          if (xp === x) add(x, p.right, p.id);
          else if (p.right.length === 1) {
            if (opts.scriptLiteral) skippedTerminal = true;
            else add(x, p.right, p.id);
          }
          continue;
        }
        // Kombinationen; erste Position läuft am schnellsten (Reihenfolge wie 6.32)
        const choices = p.right.map((s) => (M.get(s) ?? [s]) as Sym[]);
        let combos: Word[] = [[]];
        for (let i = choices.length - 1; i >= 0; i--) {
          const next: Word[] = [];
          for (const c of combos) for (const y of choices[i] as Sym[]) next.push([y, ...c]);
          combos = next;
        }
        // combos ist jetzt mit letzter Position am schnellsten; umordnen: erste am schnellsten
        combos.sort((a, b) => {
          for (let i = a.length - 1; i >= 0; i--) {
            const ia = (choices[i] as Sym[]).indexOf(a[i] as Sym);
            const ib = (choices[i] as Sym[]).indexOf(b[i] as Sym);
            if (ia !== ib) return ia - ib;
          }
          return 0;
        });
        for (const c of combos) add(x, c, p.id);
      }
    }
    const created = prods.slice(before);
    rec.add('proc.cnf.chain.nt', { phase: 3, nonterminal: x, members: mx.slice(), count: created.length }, () => ({
      highlight: [{ nonterminal: x }],
    }));
  }
  if (skippedTerminal) {
    rec.add('proc.cnf.scriptLiteral', { phase: 3, code: 'cnf.scriptLiteral' }, () => ({}));
  }
  const res: Built = { g: mkGrammar(g, resultName(opts, g, '_cnf3'), g.nonterminals.slice(), g.start, prods), prodSrc, ntSrc: {} };
  done(rec, 3, res);
  return res;
}

export function cnfChains(g: Grammar, opts: CnfOptions = {}): ProcResult<Grammar> {
  const rec = newRec(opts);
  return guard(rec, () => {
    needType2('cnfChains', g);
    return finish('cnfChains', g, step3(g, opts, rec));
  });
}

// ---------------------------------------------------------------------------
// Schritt 4: lange rechte Seiten zerlegen

function step4(g: Grammar, opts: CnfOptions, rec: Rec): Built {
  const sparse = opts.sparse !== false;
  const used = new Set<string>([...g.nonterminals, ...g.terminals]);
  const nts = g.nonterminals.slice();
  const prods: { left: Word; right: Word }[] = [];
  const prodSrc: Built['prodSrc'] = {};
  const ntSrc: Built['ntSrc'] = {};
  const extra: { left: Word; right: Word; src: ProductionId }[] = [];
  const shared = new Map<string, Sym>();
  let counter = 0;
  const newV = (): Sym => {
    let name: string;
    do name = `V${++counter}`;
    while (used.has(name));
    used.add(name);
    nts.push(name);
    return name;
  };
  /** V für das Endstück (Länge ≥ 2); erzeugt bei Bedarf die Kette. */
  const vFor = (tail: Word, src: ProductionId): Sym => {
    const k = tail.join('\u0000');
    if (sparse && shared.has(k)) return shared.get(k) as Sym;
    const v = newV();
    if (sparse) shared.set(k, v);
    ntSrc[v] = src;
    const index = extra.length;
    extra.push({ left: [v], right: [], src });
    const right: Word = tail.length === 2 ? tail.slice() : [tail[0] as Sym, vFor(tail.slice(1), src)];
    (extra[index] as { right: Word }).right = right;
    rec.add('proc.cnf.long.aux', { phase: 4, nonterminal: v, right, production: src }, () => ({ highlight: [{ nonterminal: v }] }), {
      source: 0,
      elems: [{ production: src }],
    });
    return v;
  };
  for (const p of g.productions) {
    if (p.right.length <= 2) {
      prodSrc[`p${prods.length}`] = p.id;
      prods.push({ left: p.left, right: p.right });
      continue;
    }
    const v = vFor(p.right.slice(1), p.id);
    prodSrc[`p${prods.length}`] = p.id;
    prods.push({ left: p.left, right: [p.right[0] as Sym, v] });
  }
  for (const e of extra) {
    prodSrc[`p${prods.length}`] = e.src;
    prods.push({ left: e.left, right: e.right });
  }
  const res: Built = { g: mkGrammar(g, resultName(opts, g, '_cnf4'), nts, g.start, prods), prodSrc, ntSrc };
  done(rec, 4, res);
  return res;
}

export function cnfLong(g: Grammar, opts: CnfOptions = {}): ProcResult<Grammar> {
  const rec = newRec(opts);
  return guard(rec, () => {
    needType2('cnfLong', g);
    return finish('cnfLong', g, step4(g, opts, rec));
  });
}

// ---------------------------------------------------------------------------
// Alle vier Schritte

export function toCnf(g: Grammar, opts: CnfOptions = {}): ProcResult<Grammar> {
  const rec = newRec(opts);
  return guard(rec, () => {
    needType2('toCnf', g);
    const b1 = step1(g, opts, rec);
    const b2 = step2(b1.g, opts, rec);
    const b3 = step3(b2.g, opts, rec);
    const b4 = step4(b3.g, opts, rec);
    const chain = [b1, b2, b3, b4];
    const back = (pid: ProductionId | undefined, from: number): ProductionId | undefined => {
      let cur = pid;
      for (let i = from; i >= 0 && cur !== undefined; i--) cur = (chain[i] as Built).prodSrc[cur];
      return cur;
    };
    const prodSrc: Built['prodSrc'] = {};
    for (const p of b4.g.productions) prodSrc[p.id] = back(p.id, 3);
    const ntSrc: Built['ntSrc'] = {};
    for (const [v, s] of Object.entries(b4.ntSrc)) ntSrc[v] = back(s, 2);
    const final: Built = { g: { ...b4.g, name: resultName(opts, g, '_cnf') }, prodSrc, ntSrc };
    return finish('toCnf', g, final);
  });
}
