// Algorithmus von Earley (6.43, Beispiel 6.44).
import type { EarleyItem, EarleyResult, EarleyRule, Grammar, ProcOptions, ProcResult, Production, Sym, Word } from '../model/types';
import { abort, guard, need, newRec } from '../algo/common';
import { type2Violations } from '../algo/parsing';

const words = (w: Word): string => w.join(w.every((s) => s.length === 1) ? '' : ' ');

/** Item als Text: `X →_i v1 • v2` (6.41). */
export function earleyItemText(p: Production, it: { dot: number; origin: number }): string {
  const l = words(p.right.slice(0, it.dot));
  const r = words(p.right.slice(it.dot));
  return `${p.left.join('')} →_${it.origin} ${[l, '•', r].filter((s) => s !== '').join(' ')}`;
}

export function earley(g: Grammar, w: Word, opts: ProcOptions = {}): ProcResult<EarleyResult> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('earley', g, ['grammatik']);
    const bad = type2Violations(g);
    if (bad.length > 0) abort('algo.notType2', { productionIds: bad }, g.name);
    const S = g.start as Sym;
    const N = new Set(g.nonterminals);
    const prods = new Map<string, Production>(g.productions.map((p) => [p.id, p]));
    const byLeft = new Map<Sym, Production[]>();
    for (const p of g.productions) {
      const l = p.left[0] as Sym;
      byLeft.set(l, [...(byLeft.get(l) ?? []), p]);
    }
    const n = w.length;
    const sets: EarleyItem[][] = Array.from({ length: n + 1 }, () => []);
    const seen: Set<string>[] = Array.from({ length: n + 1 }, () => new Set<string>());
    const next = (it: EarleyItem): Sym | undefined => (prods.get(it.production) as Production).right[it.dot];

    const add = (j: number, item: EarleyItem): void => {
      const key = `${item.production}|${item.dot}|${item.origin}`;
      const seenJ = seen[j] as Set<string>;
      if (seenJ.has(key)) return;
      seenJ.add(key);
      const set = sets[j] as EarleyItem[];
      set.push(item);
      const idx = set.length - 1;
      rec.add('proc.earley.item', { set: j, index: idx, production: item.production, dot: item.dot, origin: item.origin, rule: item.rule, cause: item.cause }, () => ({
        table: {
          corner: `S${j}`,
          colHead: ['Item', 'rule'],
          rowHead: set.map((_, k) => String(k)),
          cells: set.map((it) => [earleyItemText(prods.get(it.production) as Production, it), it.rule]),
          activeRow: idx,
        },
      }), { source: 0, elems: [{ production: item.production }] });
    };
    const mk = (production: string, dot: number, origin: number, rule: EarleyRule, cause: [number, number][]): EarleyItem => ({ production, dot, origin, rule, cause });

    for (const p of byLeft.get(S) ?? []) add(0, mk(p.id, 0, 0, 'init', []));

    for (let j = 0; j <= n; j++) {
      const set = sets[j] as EarleyItem[];
      for (let k = 0; k < set.length; k++) {
        const it = set[k] as EarleyItem;
        const p = prods.get(it.production) as Production;
        const nx = next(it);
        if (nx === undefined) {
          // Completer: Y →_m v • in S_j schiebt Items aus S_m
          const m = it.origin;
          const from = sets[m] as EarleyItem[];
          // Bei m === j kann `from` während der Schleife wachsen; neue Items dort erledigt der ε-Fall unten.
          for (let q = 0; q < from.length; q++) {
            const cand = from[q] as EarleyItem;
            if (next(cand) === p.left[0]) add(j, mk(cand.production, cand.dot + 1, cand.origin, 'completer', [[m, q], [j, k]]));
          }
        } else if (N.has(nx)) {
          // Predictor
          for (const q of byLeft.get(nx) ?? []) add(j, mk(q.id, 0, j, 'predictor', [[j, k]]));
          // Standardergänzung (nicht im Skript, wegen ε-Produktionen): ist Y in derselben Menge schon vollständig
          // abgeleitet (Y →_j v • ∈ S_j), muss der Completer auch für dieses später hinzugekommene Item laufen.
          for (let q = 0; q < set.length; q++) {
            const done = set[q] as EarleyItem;
            if (done.origin === j && next(done) === undefined && (prods.get(done.production) as Production).left[0] === nx) {
              add(j, mk(it.production, it.dot + 1, it.origin, 'completer', [[j, k], [j, q]]));
            }
          }
        } else if (j < n && nx === w[j]) {
          // Lexer
          add(j + 1, mk(it.production, it.dot + 1, it.origin, 'lexer', [[j, k]]));
        }
      }
      if (set.length === 0) break; // 6.43 Schritt 3: S_j = ∅, nicht ableitbar
    }
    const accepted = (sets[n] as EarleyItem[]).some((it) => {
      const p = prods.get(it.production) as Production;
      return it.origin === 0 && it.dot === p.right.length && p.left[0] === S;
    });
    return { word: w.slice(), sets, accepted };
  });
}
