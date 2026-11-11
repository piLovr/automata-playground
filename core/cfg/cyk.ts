// CYK-Algorithmus (6.33–6.38) für Grammatiken in Chomsky-Normalform.
import type { CykCell, CykMark, CykResult, DerivTree, Grammar, ProcOptions, ProcResult, Sym, Word } from '../model/types';
import { abort, guard, need, newRec, setText } from '../algo/common';
import { isCnf } from './cnf';

/** D[i, j] für das Teilwort w(i, j] (Trennstellen 0 … n), Zellen nach Länge, dann i (6.34). */
export function cyk(g: Grammar, w: Word, opts: ProcOptions = {}): ProcResult<CykResult> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('toCnf', g, ['grammatik']);
    const c = isCnf(g);
    if (!c.ok) abort('cnf.notCnf', { productionIds: c.productionIds }, g.name);
    const n = w.length;
    const order = new Map<Sym, number>(g.nonterminals.map((x, i) => [x, i]));
    const D = new Map<string, CykCell>();
    const sets = new Map<string, Set<Sym>>();
    const key = (i: number, j: number): string => `${i},${j}`;
    const cells: CykCell[] = [];
    const binary = g.productions.filter((p) => p.right.length === 2);
    const showTable = n <= 30;
    const table = (activeRow: number) => ({
      corner: 'i',
      colHead: Array.from({ length: n }, (_, j) => `${j + 1}`),
      rowHead: Array.from({ length: n }, (_, i) => `${i}`),
      cells: Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j0) => {
          const c2 = D.get(key(i, j0 + 1));
          return c2 ? setText(c2.nonterminals) : '';
        }),
      ),
      activeRow,
    });
    const finishCell = (i: number, j: number, marks: CykMark[], splits: { m: number; production: string }[]): void => {
      const lefts = marks.map((mk) => g.productions.find((p) => p.id === mk.production)?.left[0] as Sym);
      const nts = [...new Set(lefts)].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
      const cell: CykCell = { i, j, nonterminals: nts, marks };
      D.set(key(i, j), cell);
      sets.set(key(i, j), new Set(nts));
      cells.push(cell);
      rec.add('proc.cyk.cell', { i, j, nonterminals: nts.slice(), splits, marks: marks.map((m) => ({ ...m })) }, () =>
        showTable ? { table: table(i) } : {},
      );
    };
    for (let i = 0; i < n; i++) {
      const marks: CykMark[] = g.productions
        .filter((p) => p.right.length === 1 && p.right[0] === w[i])
        .map((p) => ({ production: p.id, split: null }));
      finishCell(i, i + 1, marks, []);
    }
    for (let k = 2; k <= n; k++) {
      for (let i = 0; i + k <= n; i++) {
        const j = i + k;
        const marks: CykMark[] = [];
        const splits: { m: number; production: string }[] = [];
        for (let m = i + 1; m < j; m++) {
          const left = sets.get(key(i, m)) as Set<Sym>;
          const right = sets.get(key(m, j)) as Set<Sym>;
          for (const p of binary) {
            if (left.has(p.right[0] as Sym) && right.has(p.right[1] as Sym)) {
              marks.push({ production: p.id, split: m });
              splits.push({ m, production: p.id });
            }
          }
        }
        finishCell(i, j, marks, splits);
      }
    }
    const S = g.start as Sym;
    const accepted =
      n === 0 ? g.productions.some((p) => p.left[0] === S && p.right.length === 0) : (sets.get(key(0, n))?.has(S) ?? false);
    return { word: w.slice(), cells, accepted };
  });
}

/** Ein Ableitungsbaum für x ⇒* w(i, j] aus den Marks (6.36/6.38); null, wenn x ∉ D[i, j]. */
export function cykTree(g: Grammar, r: CykResult, i: number, j: number, x: Sym): DerivTree | null {
  const byPos = new Map<string, CykCell>(r.cells.map((c) => [`${c.i},${c.j}`, c]));
  const prods = new Map(g.productions.map((p) => [p.id, p]));
  let next = 0;
  const build = (a: number, b: number, sym: Sym): DerivTree | null => {
    const cell = byPos.get(`${a},${b}`);
    if (!cell) return null;
    for (const mk of cell.marks) {
      const p = prods.get(mk.production);
      if (!p || p.left[0] !== sym) continue;
      const node: DerivTree = { id: next++, sym, production: p.id, children: [] };
      if (mk.split === null) {
        node.children = [{ id: next++, sym: p.right[0] as Sym, children: [] }];
        return node;
      }
      const l = build(a, mk.split, p.right[0] as Sym);
      const rr = l && build(mk.split, b, p.right[1] as Sym);
      if (!l || !rr) return null;
      node.children = [l, rr];
      return node;
    }
    return null;
  };
  if (i === j) {
    if (i !== 0 || r.word.length !== 0) return null;
    const p = g.productions.find((q) => q.left[0] === x && q.right.length === 0);
    if (!p) return null;
    return { id: 0, sym: x, production: p.id, children: [{ id: 1, sym: null, children: [] }] };
  }
  return build(i, j, x);
}
