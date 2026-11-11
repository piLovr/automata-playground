// Ableitungsbäume (4.19–4.22).
import { grammarType } from '../model/grammar';
import type { Derivation, DerivTree, Grammar, ProductionId, Sym, Word } from '../model/types';

interface MNode {
  sym: Sym | null;
  production?: ProductionId;
  children: MNode[];
}

/** Vorordnungsnummern 0, 1, … */
function number(root: MNode): DerivTree {
  let next = 0;
  const go = (n: MNode): DerivTree => {
    const t: DerivTree = { id: next++, sym: n.sym, children: [] };
    if (n.production !== undefined) t.production = n.production;
    t.children = n.children.map(go);
    return t;
  };
  return go(root);
}

/** Baum zu einer Ableitung (4.19); null, wenn die Grammatik nicht Typ 2/3 ist oder die Ableitung nicht passt. */
export function treeOf(g: Grammar, d: Derivation): DerivTree | null {
  if (grammarType(g).type < 2 || d.start.length !== 1) return null;
  const frontier: MNode[] = d.start.map((s) => ({ sym: s, children: [] }));
  const root = frontier[0] as MNode;
  for (const st of d.steps) {
    const p = g.productions.find((q) => q.id === st.production);
    const node = frontier[st.pos];
    if (!p || p.left.length !== 1 || !node || node.sym !== p.left[0]) return null;
    node.production = p.id;
    const kids: MNode[] = p.right.map((s) => ({ sym: s, children: [] }));
    node.children = p.right.length === 0 ? [{ sym: null, children: [] }] : kids;
    frontier.splice(st.pos, 1, ...kids);
  }
  return number(root);
}

function fromTree(t: DerivTree, pick: (idx: number[]) => number): Derivation {
  let frontier: DerivTree[] = [t];
  const start: Word = [t.sym as Sym];
  const steps: Derivation['steps'] = [];
  for (;;) {
    const idx: number[] = [];
    frontier.forEach((n, i) => {
      if (n.production !== undefined) idx.push(i);
    });
    if (idx.length === 0) break;
    const pos = pick(idx);
    const n = frontier[pos] as DerivTree;
    const kids = n.children.filter((c) => c.sym !== null);
    frontier = [...frontier.slice(0, pos), ...kids, ...frontier.slice(pos + 1)];
    steps.push({ production: n.production as ProductionId, pos, form: frontier.map((x) => x.sym as Sym) });
  }
  return { start, steps };
}

/** Die Linksableitung zum Baum (4.22). */
export function leftmostOf(_g: Grammar, t: DerivTree): Derivation {
  return fromTree(t, (idx) => idx[0] as number);
}

/** Die Rechtsableitung zum Baum (4.22). */
export function rightmostOf(_g: Grammar, t: DerivTree): Derivation {
  return fromTree(t, (idx) => idx[idx.length - 1] as number);
}

export function treeSize(t: DerivTree): number {
  return 1 + t.children.reduce((a, c) => a + treeSize(c), 0);
}

/** Blätter von links nach rechts ohne ε. */
export function treeYield(t: DerivTree): Word {
  if (t.children.length === 0) return t.sym === null ? [] : [t.sym];
  return t.children.flatMap(treeYield);
}

/** Gleiche Struktur, Beschriftung und Produktionen; ids sind egal. */
export function sameTree(a: DerivTree, b: DerivTree): boolean {
  if (a.sym !== b.sym || a.production !== b.production || a.children.length !== b.children.length) return false;
  return a.children.every((c, i) => sameTree(c, b.children[i] as DerivTree));
}
