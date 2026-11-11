import { describe, expect, it } from 'vitest';
import { EXPLANATION_KEYS, cfgWords, cnfChains, cnfEpsilon, cnfLong, cnfTerminals, cyk, cykTree, epsSet, isCnf, runMethod, toCnf, treeYield } from '../index';
import type { Grammar, Sym } from '../index';

function mk(start: string, nts: string[], ts: string[], rules: string[]): Grammar {
  const productions = rules.map((r, i) => {
    const [l, rr] = r.split('->').map((x) => x.trim());
    return { id: `p${i}`, left: [l as string], right: rr === '' ? [] : (rr as string).split(' ') };
  });
  return { kind: 'grammatik', name: 'G', nonterminals: nts, terminals: ts, start, productions };
}
const show = (g: Grammar): string[] => g.productions.map((p) => `${p.left.join('')} -> ${p.right.join(' ') || 'ε'}`);
const G632 = (): Grammar => mk('E', ['E', 'F'], ['+', 'a', '(', ')'], ['E -> E + F', 'E -> F', 'F -> ( E )', 'F -> a']);
const ok = <T>(r: { ok: boolean } & { result?: T }): T => {
  expect(r.ok).toBe(true);
  return (r as { result: T }).result;
};

describe('CNF 6.32', () => {
  it('Schritt 1', () => {
    const g1 = ok(cnfTerminals(G632()));
    expect(new Set(show(g1))).toEqual(new Set(['E -> E Z+ F', 'E -> F', 'F -> Z( E Z)', 'F -> Za', 'Z+ -> +', 'Za -> a', 'Z( -> (', 'Z) -> )']));
  });
  it('Schritt 2 ohne Änderung, Schritt 3 literal', () => {
    const g1 = ok(cnfTerminals(G632()));
    const g2 = ok(cnfEpsilon(g1));
    expect(show(g2)).toEqual(show(g1));
    const r = cnfChains(g2, { scriptLiteral: true });
    const g3 = ok(r);
    expect(show(g3).slice(0, 12)).toEqual([
      'E -> E Z+ F', 'E -> F Z+ F', 'E -> Za Z+ F', 'E -> E Z+ Za', 'E -> F Z+ Za', 'E -> Za Z+ Za',
      'E -> Z( E Z)', 'E -> Z( F Z)', 'E -> Z( Za Z)', 'F -> Z( E Z)', 'F -> Z( F Z)', 'F -> Z( Za Z)',
    ]);
    expect(g3.productions.some((p) => p.left[0] === 'E' && p.right.join('') === 'a')).toBe(false);
    if (r.ok) {
      const tab = r.steps.find((s) => s.explanation.key === 'proc.cnf.chain.set' && s.explanation.params.final);
      expect(tab?.view.table?.cells).toEqual([['{E}', '{E,F}', '{E,F,Za}', '{E,F,Za}'], ['{F}', '{F,Za}', '{F,Za}', '{F,Za}']]);
      expect(r.steps.some((s) => s.explanation.key === 'proc.cnf.scriptLiteral')).toBe(true);
    }
  });
  it('Schritt 3 ohne scriptLiteral überträgt X -> a', () => {
    const g3 = ok(cnfChains(ok(cnfTerminals(G632()))));
    expect(show(g3)).toContain('E -> a');
    expect(show(g3)).toContain('F -> a');
  });
  it('Schritt 4 sparsam und wörtlich', () => {
    const g3 = ok(cnfChains(ok(cnfTerminals(G632())), { scriptLiteral: true }));
    const g4 = ok(cnfLong(g3));
    expect(g4.nonterminals.filter((x) => x.startsWith('V'))).toEqual(['V1', 'V2', 'V3', 'V4', 'V5']);
    expect(show(g4)).toContain('E -> E V1');
    expect(show(g4)).toContain('E -> Za V2');
    expect(show(g4).slice(-5)).toEqual(['V1 -> Z+ F', 'V2 -> Z+ Za', 'V3 -> E Z)', 'V4 -> F Z)', 'V5 -> Za Z)']);
    expect(show(g4)).toContain('F -> Z( V5');
    expect(isCnf(g4).ok).toBe(true);
    const w = ok(cnfLong(g3, { sparse: false }));
    expect(w.nonterminals.filter((x) => x.startsWith('V')).length).toBe(12);
    expect(isCnf(w).ok).toBe(true);
  });
  it('Schlüssel und Herkunft', () => {
    const r = toCnf(G632(), { scriptLiteral: true });
    expect(r.ok).toBe(true);
    for (const s of r.steps) expect(EXPLANATION_KEYS as readonly string[]).toContain(s.explanation.key);
    if (r.ok) {
      expect(r.result.origin?.method).toBe('toCnf');
      expect(r.result.origin?.corr?.length).toBeGreaterThan(0);
    }
    expect(runMethod('toCnf', [G632()]).ok).toBe(true);
  });
});

describe('EPS 6.26', () => {
  it('Runden', () => {
    const g = mk('X', ['X', 'Y', 'Z'], ['a'], ['X -> Y Z', 'Y -> Z Z', 'Z -> a', 'Z -> ']);
    const r = epsSet(g);
    expect(ok(r)).toEqual(['Z', 'Y', 'X']);
    expect(r.steps.length).toBe(4);
  });
});

describe('CYK 6.35', () => {
  const g = ok(cnfLong(ok(cnfChains(ok(cnfTerminals(G632())), { scriptLiteral: true }))));
  const w = ['(', 'a', '+', 'a', ')'];
  it('Pyramide', () => {
    const r = ok(cyk(g, w));
    const d = (i: number, j: number): Sym[] => (r.cells.find((c) => c.i === i && c.j === j)?.nonterminals ?? []).slice().sort();
    expect(d(0, 1)).toEqual(['Z(']);
    expect(d(1, 2)).toEqual(['Za']);
    expect(d(2, 3)).toEqual(['Z+']);
    expect(d(4, 5)).toEqual(['Z)']);
    expect(d(1, 4)).toEqual(['E']);
    expect(d(2, 4)).toEqual(['V2']);
    expect(d(3, 5)).toEqual(['V5']);
    expect(d(1, 5)).toEqual(['V3']);
    expect(d(0, 5)).toEqual(['E', 'F']);
    expect(d(0, 2)).toEqual([]);
    expect(r.accepted).toBe(true);
    expect(r.cells.length).toBe(15);
    const t = cykTree(g, r, 0, 5, 'E');
    expect(t && treeYield(t)).toEqual(w);
    expect(cykTree(g, r, 0, 4, 'E')).toBeNull();
  });
  it('a ist in literal-CNF nicht ableitbar, sonst schon', () => {
    expect(ok(cyk(g, ['a'])).accepted).toBe(false);
    const g2 = ok(toCnf(G632()));
    expect(ok(cyk(g2, ['a'])).accepted).toBe(true);
  });
  it('nicht CNF', () => {
    const r = cyk(G632(), w);
    expect(r.ok).toBe(false);
  });
});

describe('Sprache gleich', () => {
  const gs = [
    G632(),
    mk('S', ['S', 'A', 'B'], ['a', 'b'], ['S -> A B', 'S -> S S', 'A -> a A', 'A -> ', 'B -> b B', 'B -> b', 'B -> ']),
    mk('S', ['S'], ['a', 'b'], ['S -> a S b', 'S -> ']),
    mk('S', ['S', 'T'], ['a', 'b'], ['S -> T', 'T -> S', 'S -> a T b b', 'T -> a', 'T -> S a']),
    mk('S', ['S', 'A'], ['a'], ['S -> A A A A', 'A -> a', 'A -> ']),
  ];
  for (const [k, g] of gs.entries()) {
    it(`Grammatik ${k}`, () => {
      const c = ok(toCnf(g));
      expect(isCnf(c).ok).toBe(true);
      const a = cfgWords(g, 5).words.map((x) => x.join(' ')).sort();
      const b = cfgWords(c, 5).words.map((x) => x.join(' ')).sort();
      expect(b).toEqual(a);
      for (const x of a.slice(0, 20)) expect(ok(cyk(c, x === '' ? [] : x.split(' '))).accepted).toBe(true);
    });
  }
});
