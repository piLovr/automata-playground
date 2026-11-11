import { describe, expect, it } from 'vitest';
import {
  cfgWords,
  enumerate,
  extend,
  findAmbiguity,
  findDerivation,
  leftmostOf,
  parseDocument,
  parseTrees,
  rightmostOf,
  sameTree,
  startDerivation,
  treeOf,
  treeSize,
  treeYield,
  countByLength,
} from '../index';
import type { Derivation, DerivTree, Grammar, Word } from '../index';

const gram = (t: string): Grammar => {
  const r = parseDocument(t);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return r.doc.objects[0] as Grammar;
};
const G416 = gram(`grammatik G { nichtterminale S
 terminale ( )
 start S
 S -> ε | (S) | SS }`);
const G424 = gram(`grammatik H { nichtterminale S T
 terminale ( )
 start S
 S -> ε | ST
 T -> (S) }`);
const w = (s: string): Word => [...s];
const id = (g: Grammar, right: string, left = 'S'): string =>
  g.productions.find((p) => p.left.join('') === left && p.right.join('') === right)?.id as string;

function derive(g: Grammar, steps: [string, number][]): Derivation {
  let d = startDerivation(g);
  for (const [r, pos] of steps) {
    const e = extend(g, d, id(g, r), pos);
    if ('error' in e) throw new Error(JSON.stringify(e.error));
    d = e;
  }
  return d;
}
const edges = (t: DerivTree): string[] => {
  const out: string[] = [];
  const go = (n: DerivTree): void => {
    if (n.children.length > 0) out.push(`${n.sym}${n.id} -> ${n.children.map((c) => `${c.sym ?? 'ε'}${c.sym === 'S' || c.sym === null ? c.id : ''}`).join(' ')}`);
    n.children.forEach(go);
  };
  go(t);
  return out;
};
const brackets = (t: DerivTree): string =>
  t.children.length === 0 ? (t.sym ?? 'ε') : `${t.sym}[${t.children.map(brackets).join(' ')}]`;

describe('4.20 bis 4.22', () => {
  it('Baum 4.20', () => {
    const d2 = derive(G416, [['SS', 0], ['(S)', 1], ['', 2], ['', 0]]);
    const t = treeOf(G416, d2) as DerivTree;
    expect(brackets(t)).toBe('S[S[ε] S[( S[ε] )]]');
    expect(treeYield(t)).toEqual(w('()'));
    expect(treeSize(t)).toBe(8);
    expect(edges(t)).toEqual(['S0 -> S1 S3', 'S1 -> ε2', 'S3 -> ( S5 )', 'S5 -> ε6']);
  });
  it('4.21 zwei Ableitungen, ein Baum; 4.22 Links/Rechts', () => {
    const a = derive(G416, [['SS', 0], ['', 0], ['(S)', 0], ['', 1]]);
    const b = derive(G416, [['SS', 0], ['(S)', 1], ['', 2], ['', 0]]);
    expect(a.steps.at(-1)?.form).toEqual(w('()'));
    expect(b.steps.at(-1)?.form).toEqual(w('()'));
    const ta = treeOf(G416, a) as DerivTree;
    const tb = treeOf(G416, b) as DerivTree;
    expect(sameTree(ta, tb)).toBe(true);
    expect(leftmostOf(G416, ta)).toEqual(a);
    expect(rightmostOf(G416, ta)).toEqual(b);
  });
  it('Fehler', () => {
    const e = extend(G416, startDerivation(G416), id(G416, '(S)'), 1);
    expect('error' in e && e.error.code).toBe('derive.notApplicable');
  });
});

describe('4.24', () => {
  it('Bäume A, B, infinite', () => {
    const r = parseTrees(G416, w('()()()'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.infinite).toBe(true);
    expect(r.result.complete).toBe(false);
    const [t0, t1] = r.result.trees as [DerivTree, DerivTree];
    expect(treeSize(t0)).toBe(treeSize(t1));
    const P = 'S[( S[ε] )]';
    const A = `S[S[${P} ${P}] ${P}]`;
    const B = `S[${P} S[${P} ${P}]]`;
    expect([brackets(t0), brackets(t1)].sort()).toEqual([A, B].sort());
    console.log('Reihenfolge:', brackets(t0) === A ? 'A,B' : 'B,A', r.result.trees.length);
  });
  it('findAmbiguity 4.16', () => {
    const r = findAmbiguity(G416);
    expect(r.ok && r.result.found !== null).toBe(true);
    if (r.ok && r.result.found) expect(sameTree(r.result.found.trees[0], r.result.found.trees[1])).toBe(false);
  });
  it('eindeutige Grammatik bis Länge 8', () => {
    const r = findAmbiguity(G424, { maxLen: 8 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.found).toBeNull();
    expect(r.result.checkedUpTo).toBe(8);
    expect(r.result.limitHit).toBe(false);
    const t = parseTrees(G424, w('(())()'));
    expect(t.ok && t.result.trees.length).toBe(1);
    expect(t.ok && t.result.complete).toBe(true);
  });
});

describe('findDerivation / cfgWords', () => {
  it('Linksableitung', () => {
    const r = findDerivation(G416, w('(())()'));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.steps.at(-1)?.form).toEqual(w('(())()'));
    const n = findDerivation(G416, w('(()'));
    expect(n.ok).toBe(false);
    expect(!n.ok && n.diagnostics).toEqual([]);
  });
  it('Typ 0/1', () => {
    const g = gram(`grammatik K { nichtterminale S B
 terminale a b c
 start S
 S -> aSBc | abc
 cB -> Bc
 bB -> bb }`);
    const r = findDerivation(g, w('aabbcc'));
    expect(r.ok).toBe(true);
    const n = findDerivation(g, w('aabcc'));
    expect(n.ok).toBe(false);
  });
  it('cfgWords gegen enumerate (Typ 3) und Klammern', () => {
    const g3 = gram(`grammatik R { nichtterminale X Y
 terminale 0 1
 start X
 X -> 0Y | 1X | ε
 Y -> 1Y | 0X }`);
    const a = cfgWords(g3, 6);
    expect(a.complete).toBe(true);
    expect(a.words).toEqual(enumerate(g3, 6));
    const b = cfgWords(G416, 6);
    expect(b.words.map((x) => x.join(''))).toEqual(['', '()', '(())', '()()', '((()))', '(()())', '(())()', '()(())', '()()()']);
    expect(countByLength(G416, 6).ok && (countByLength(G416, 6) as { result: { exact: boolean } }).result.exact).toBe(true);
  });
});
