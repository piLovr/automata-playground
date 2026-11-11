// Suche: Ableitung zu einem Wort, alle Bäume, Mehrdeutigkeit, Wörter einer kontextfreien Grammatik.
import { Abort, diag, need } from '../algo/common';
import { grammarType } from '../model/grammar';
import type {
  AmbiguityResult,
  Derivation,
  DerivTree,
  Diagnostic,
  Grammar,
  ProcResult,
  Production,
  ProductionId,
  Sym,
  TreesResult,
  Word,
} from '../model/types';
import { cfProductions, cycleSet, nullableSet, productiveSet, spanTables } from './analysis';
import { wordProblem } from '../m6/word';
import { applicable, applyProduction, leftmostPos } from './ops';
import { treeOf } from './tree';

function run<R>(fn: () => ProcResult<R>): ProcResult<R> {
  try {
    return fn();
  } catch (e) {
    if (e instanceof Abort) return { ok: false, diagnostics: e.diags, steps: [] };
    return { ok: false, diagnostics: [diag('algo.invalid', { diagnostics: 0, reason: String(e) })], steps: [] };
  }
}

const done = <R>(result: R): ProcResult<R> => ({ ok: true, result, steps: [] });

function limitDiag(what: 'nodes' | 'steps' | 'length', limit: number): Diagnostic {
  return { severity: 'warning', code: 'derive.limit', params: { what, limit } };
}

const keyOf = (f: Word): string => f.join('\u0001');

// ---------------------------------------------------------------------------
// findDerivation

export function findDerivation(
  g: Grammar,
  w: Word,
  opts: { maxSteps?: number; leftmost?: boolean } = {},
): ProcResult<Derivation> {
  return run(() => {
    need('derive', g, ['grammatik']);
    const maxSteps = opts.maxSteps ?? 50000;
    const type = grammarType(g).type;
    const cf = type >= 2;
    if (!cf) {
      // Typ 0/1: Satzformen dürfen wachsen; die Suche steckt in wordProblem (exakt nur bei nicht verkürzenden Grammatiken)
      const r = wordProblem(g, w, opts.maxSteps === undefined ? {} : { maxSteps: opts.maxSteps });
      if (!r.ok) return { ok: false, diagnostics: r.diagnostics, steps: [] };
      const wp = r.result;
      if (wp.verdict === 'derivable') return done(wp.derivation as Derivation);
      if (wp.verdict === 'unknown') {
        const what = wp.limitHit === 'steps' ? 'steps' : 'length';
        return { ok: false, diagnostics: [limitDiag(what, what === 'steps' ? (opts.maxSteps ?? 200000) : wp.maxLength)], steps: [] };
      }
      return { ok: false, diagnostics: [], steps: [] };
    }
    const S = g.start as Sym;
    const n = w.length;
    const nt = new Set(g.nonterminals);
    const notFound: ProcResult<Derivation> = { ok: false, diagnostics: [], steps: [] };
    let nullable = new Set<Sym>();
    if (cf) {
      if (!spanTables(g, w, false).derives(S, 0, n)) return notFound;
      nullable = nullableSet(g);
    }
    const bound = n + (cf ? nullable.size : g.productions.filter((p) => p.right.length === 0).length) + 2;
    const leftmost = cf && opts.leftmost !== false;
    const target = keyOf(w);

    interface Node {
      form: Word;
      parent: number;
      step: { production: ProductionId; pos: number } | null;
    }
    const nodes: Node[] = [{ form: [S], parent: -1, step: null }];
    const seen = new Set<string>([keyOf([S])]);
    const build = (i: number): Derivation => {
      const steps: Derivation['steps'] = [];
      for (let k = i; k > 0; k = (nodes[k] as Node).parent) {
        const nd = nodes[k] as Node;
        steps.push({ production: (nd.step as { production: ProductionId }).production, pos: (nd.step as { pos: number }).pos, form: nd.form });
      }
      return { start: [S], steps: steps.reverse() };
    };
    if (keyOf([S]) === target) return done(build(0));
    let generated = 0;
    for (let qi = 0; qi < nodes.length; qi++) {
      const cur = nodes[qi] as Node;
      let apps = applicable(g, cur.form);
      if (leftmost) {
        const lp = leftmostPos(g, cur.form);
        apps = apps.filter((a) => a.pos === lp);
      }
      for (const a of apps) {
        if (++generated > maxSteps) return { ok: false, diagnostics: [limitDiag('steps', maxSteps)], steps: [] };
        const r = applyProduction(g, cur.form, a.production, a.pos) as { form: Word };
        const f = r.form;
        if (f.length > bound) continue;
        if (cf) {
          let terms = 0;
          let ok = true;
          let inPrefix = true;
          for (let k = 0; k < f.length; k++) {
            const s = f[k] as Sym;
            if (!nt.has(s)) {
              terms++;
              if (leftmost && inPrefix && (k >= n || w[k] !== s)) ok = false;
            } else {
              inPrefix = false;
              if (!nullable.has(s)) terms++;
            }
          }
          if (!ok || terms > n) continue;
        }
        const key = keyOf(f);
        if (seen.has(key)) continue;
        seen.add(key);
        nodes.push({ form: f, parent: qi, step: { production: a.production, pos: a.pos } });
        if (key === target) return done(build(nodes.length - 1));
      }
    }
    // Typ 2: das Wort ist ableitbar, aber die Längengrenze hat den Weg abgeschnitten
    if (cf) return { ok: false, diagnostics: [limitDiag('length', bound)], steps: [] };
    return notFound;
  });
}

// ---------------------------------------------------------------------------
// parseTrees

export function parseTrees(
  g: Grammar,
  w: Word,
  opts: { maxNodes?: number; maxTrees?: number } = {},
): ProcResult<TreesResult> {
  return run(() => {
    need('derive', g, ['grammatik']);
    if (grammarType(g).type < 2) return { ok: false, diagnostics: [diag('derive.notType2', {}, g.name)], steps: [] };
    return done(parseTreesCore(g, w, opts.maxNodes ?? 60, opts.maxTrees ?? 50, 400000));
  });
}

function parseTreesCore(g: Grammar, w: Word, maxNodes: number, maxTrees: number, maxWork: number): TreesResult {
  const S = g.start as Sym;
  const n = w.length;
  const nt = new Set(g.nonterminals);
  if (!spanTables(g, w, false).derives(S, 0, n)) return { trees: [], complete: true, infinite: false };

  const nullable = nullableSet(g);
  const productive = productiveSet(g);
  const prodsFor = new Map<Sym, Production[]>();
  for (const p of cfProductions(g)) {
    if (!p.right.every((s) => !nt.has(s) || productive.has(s))) continue;
    const l = prodsFor.get(p.left[0] as Sym) ?? [];
    l.push(p);
    prodsFor.set(p.left[0] as Sym, l);
  }

  // unendlich viele Bäume: ein Zyklus X ⇒⁺ X, dessen X in einem Baum von w vorkommt
  let infinite = false;
  const cyc = cycleSet(g);
  if (cyc.size > 0) {
    const sp = spanTables(g, w, true);
    outer: for (const x of cyc) {
      for (let i = 0; i <= n; i++)
        for (let j = i; j <= n; j++)
          if (sp.derives(x, i, j) && sp.inContext(x, i, j)) {
            infinite = true;
            break outer;
          }
    }
  }

  const trees: DerivTree[] = [];
  let work = 0;
  let workHit = false;
  let stop = false;
  const flags = { cut: false };
  let L = 0;
  const seq: ProductionId[] = [];

  const emit = (): void => {
    let d: Derivation = { start: [S], steps: [] };
    let form: Word = [S];
    for (const id of seq) {
      const pos = leftmostPos(g, form) as number;
      const r = applyProduction(g, form, id, pos) as { form: Word };
      form = r.form;
      d = { start: d.start, steps: [...d.steps, { production: id, pos, form }] };
    }
    const t = treeOf(g, d);
    if (t) trees.push(t);
    if (trees.length >= maxTrees) stop = true;
  };

  const dfs = (form: Word, size: number): void => {
    if (++work > maxWork) {
      workHit = true;
      stop = true;
      return;
    }
    const lp = form.findIndex((s) => nt.has(s));
    if (lp < 0) {
      if (size === L && form.length === n && form.every((s, i) => s === w[i])) emit();
      return;
    }
    for (const p of prodsFor.get(form[lp] as Sym) ?? []) {
      const nf = [...form.slice(0, lp), ...p.right, ...form.slice(lp + 1)];
      let ok = true;
      let terms = 0;
      let nts = 0;
      let inPrefix = true;
      for (let k = 0; k < nf.length; k++) {
        const s = nf[k] as Sym;
        if (!nt.has(s)) {
          terms++;
          if (inPrefix && (k >= n || w[k] !== s)) ok = false;
        } else {
          inPrefix = false;
          nts++;
          if (!nullable.has(s)) terms++;
        }
      }
      if (!ok || terms > n) continue;
      const ns = size + Math.max(1, p.right.length);
      if (ns + nts > L) {
        flags.cut = true;
        continue;
      }
      seq.push(p.id);
      dfs(nf, ns);
      seq.pop();
      if (stop) return;
    }
  };

  let complete = false;
  for (L = 1; L <= maxNodes && !stop; L++) {
    flags.cut = false;
    dfs([S], 1);
    if (stop) break;
    if (!flags.cut) {
      complete = true;
      break;
    }
  }
  if (workHit || trees.length >= maxTrees) complete = false;
  if (infinite) complete = false;
  return { trees, complete, infinite };
}

// ---------------------------------------------------------------------------
// cfgWords

function compareWords(rank: Map<Sym, number>): (a: Word, b: Word) => number {
  const r = (s: Sym): number => rank.get(s) ?? Number.MAX_SAFE_INTEGER;
  return (a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    for (let i = 0; i < a.length; i++) {
      const x = a[i] as Sym;
      const y = b[i] as Sym;
      if (x !== y) return r(x) !== r(y) ? r(x) - r(y) : x < y ? -1 : 1;
    }
    return 0;
  };
}

/** Alle Terminalwörter bis Länge maxLen einer Grammatik Typ 2/3, Längen-/Terminalordnung. */
export function cfgWords(g: Grammar, maxLen: number, opts: { maxWork?: number } = {}): { words: Word[]; complete: boolean } {
  if (g.start === null || grammarType(g).type < 2) return { words: [], complete: false };
  const maxWork = opts.maxWork ?? 200000;
  const S = g.start;
  const nt = new Set(g.nonterminals);
  const nullable = nullableSet(g);
  const productive = productiveSet(g);
  const words: Word[] = [];
  if (!productive.has(S)) return { words, complete: true };
  let complete = true;

  // ε-freie Grammatik: jedes Symbol liefert mindestens ein Terminal, die Satzformlänge ist beschränkt
  const prods = new Map<Sym, Word[]>();
  const seenProd = new Set<string>();
  for (const p of cfProductions(g)) {
    if (!p.right.every((s) => !nt.has(s) || productive.has(s))) continue;
    const x = p.left[0] as Sym;
    const slots = p.right.flatMap((s, i) => (nt.has(s) && nullable.has(s) ? [i] : []));
    if (slots.length > 12) {
      complete = false;
      continue;
    }
    for (let mask = 0; mask < 1 << slots.length; mask++) {
      const drop = new Set(slots.filter((_, b) => (mask >> b) & 1));
      const r = p.right.filter((_, i) => !drop.has(i));
      if (r.length === 0) continue;
      const k = x + '\u0002' + keyOf(r);
      if (seenProd.has(k)) continue;
      seenProd.add(k);
      const l = prods.get(x) ?? [];
      l.push(r);
      prods.set(x, l);
    }
  }

  const found = new Set<string>();
  if (nullable.has(S)) {
    words.push([]);
    found.add('');
  }
  const visited = new Set<string>([keyOf([S])]);
  const stack: Word[] = [[S]];
  let work = 0;
  while (stack.length > 0) {
    const form = stack.pop() as Word;
    const lp = form.findIndex((s) => nt.has(s));
    if (lp < 0) {
      const k = keyOf(form);
      if (form.length <= maxLen && !found.has(k)) {
        found.add(k);
        words.push(form);
      }
      continue;
    }
    for (const r of prods.get(form[lp] as Sym) ?? []) {
      if (form.length - 1 + r.length > maxLen) continue;
      const nf = [...form.slice(0, lp), ...r, ...form.slice(lp + 1)];
      const k = keyOf(nf);
      if (visited.has(k)) continue;
      if (++work > maxWork) {
        complete = false;
        stack.length = 0;
        break;
      }
      visited.add(k);
      stack.push(nf);
    }
  }
  const rank = new Map(g.terminals.map((t, i) => [t, i]));
  words.sort(compareWords(rank));
  return { words, complete };
}

// ---------------------------------------------------------------------------
// findAmbiguity

export function findAmbiguity(
  g: Grammar,
  opts: { maxLen?: number; maxNodes?: number } = {},
): ProcResult<AmbiguityResult> {
  return run<AmbiguityResult>(() => {
    need('derive', g, ['grammatik']);
    if (grammarType(g).type < 2) return { ok: false, diagnostics: [diag('derive.notType2', {}, g.name)], steps: [] };
    const maxLen = opts.maxLen ?? 8;
    const maxNodes = opts.maxNodes ?? 60;
    // Wörterliste; bei Arbeitsgrenze mit kürzerer Länge wiederholen
    let L = maxLen;
    let list = cfgWords(g, L);
    while (!list.complete && L > 0) list = cfgWords(g, --L);
    let limitHit = L < maxLen || !list.complete;
    let checked = list.complete ? L : -1;
    for (const w of list.words) {
      const r = parseTreesCore(g, w, maxNodes, 2, 400000);
      if (r.trees.length >= 2) {
        return done({ found: { word: w, trees: [r.trees[0] as DerivTree, r.trees[1] as DerivTree] }, checkedUpTo: w.length, limitHit });
      }
      if (!r.complete) {
        limitHit = true;
        checked = Math.min(checked, w.length - 1);
      }
    }
    return done({ found: null, checkedUpTo: checked, limitHit });
  });
}
