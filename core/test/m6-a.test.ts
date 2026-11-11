import { describe, expect, it } from 'vitest';
import { findDerivation, hierarchyPlacement, parseDocument, printObject, simulate, tmCost, wordProblem } from '../index';
import { runTmFast, simulateTm } from '../sim/tm';
import type { FormalObject, Grammar, TM } from '../index';

function obj(text: string): FormalObject {
  const { doc, diagnostics } = parseDocument(text);
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return doc.objects[0] as FormalObject;
}
const w = (s: string): string[] => s.split('');

describe('M6 A', () => {
  const anbncn = obj(`grammatik G {
    nichtterminale S B C
    terminale a b c
    start S
    S -> aSBC | aBC
    CB -> BC
    aB -> ab
    bB -> bb
    bC -> bc
    cC -> cc
  }`) as Grammar;
  it('wordProblem exakt (nicht verkürzend)', () => {
    const yes = wordProblem(anbncn, w('aabbcc'));
    expect(yes.ok && yes.result.verdict).toBe('derivable');
    const no = wordProblem(anbncn, w('aabbc'));
    expect(no.ok && no.result.verdict).toBe('notDerivable');
    expect(no.ok && no.result.exact).toBe(true);
    expect(findDerivation(anbncn, w('aabbcc')).ok).toBe(true);
    expect(findDerivation(anbncn, w('abcc')).ok).toBe(false);
  });
  it('Typ 0 nie notDerivable', () => {
    const g = obj(`grammatik H {
      nichtterminale S X
      terminale a b
      start S
      S -> aSb | X
      X -> ε
    }`) as Grammar;
    const r = wordProblem(g, w('b'));
    expect(r.ok && r.result.verdict).toBe('unknown');
    const f = findDerivation(g, w('b'));
    expect(f.ok).toBe(false);
  });
  it('Hierarchie', () => {
    expect(hierarchyPlacement(anbncn)).toMatchObject({ level: 1, reason: 'grammar1' });
  });
  const lba = obj(`tm M {
    alphabet a
    blank □
    lba
    start q
    accept f
    q, a -> q, a, R
    q, □ -> f, □, R
  }`) as TM;
  it('lba Textform, Grenze, Kosten', () => {
    expect(lba.bounded).toBe(true);
    expect(printObject(lba)).toContain('lba');
    expect((parseDocument(printObject(lba)).doc.objects[0] as TM).bounded).toBe(true);
    const t = simulate(lba, w('aa'));
    expect(t.result).toBe('accepted');
    expect(t.steps[0]?.tape?.bounds).toEqual([-1, 2]);
    const L = obj(`tm L {
      alphabet a
      blank □
      lba
      start q
      accept f
      q, a -> q, a, R
      q, □ -> q, □, R
    }`) as TM;
    const b = simulate(L, w('a'));
    expect(b.result).toBe('bound');
    expect(b.steps[b.steps.length - 1]?.explanation.key).toBe('sim.tm.bound');
    const rows = tmCost(lba, { maxLen: 4 });
    expect(rows.length).toBe(5);
    for (const row of rows) {
      expect(row.maxSteps).toBe(row.n + 1);
    }
    for (const word of [[], w('a'), w('aaa')]) {
      const a = simulateTm(lba, word);
      const f = runTmFast(lba, word);
      expect(f).toEqual({ result: a.result, steps: a.steps.length - 1, visited: a.visited });
    }
    expect(hierarchyPlacement(lba)).toMatchObject({ level: 1, reason: 'lba' });
  });
});
