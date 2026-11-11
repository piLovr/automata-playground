import { describe, expect, it } from 'vitest';
import { earley, lrAutomaton, lrRun, parseDocument } from '../index';
import type { Grammar, LrAutomaton, Production } from '../index';
import { earleyItemText } from '../cfg/earley';
import { lrItemText } from '../cfg/lr';

const gram = (src: string): Grammar => parseDocument(src).doc.objects[0] as Grammar;
const ok = <R>(r: { ok: boolean; result?: R }): R => {
  expect(r.ok).toBe(true);
  return r.result as R;
};
const ns = (x: string): string => x.replace(/ /g, '');
const chars = (s: string): string[] => [...s];

const G644 = gram('grammatik G644 {\n  nichtterminale S X A B C\n  terminale a b c\n  start S\n  S -> AX\n  X -> BC\n  A -> a\n  B -> b\n  C -> c\n}\n');
const G645 = gram("grammatik G645 {\n  nichtterminale E T F\n  terminale * + ( ) a\n  start E\n  E -> E+T | T\n  T -> T*F | F\n  F -> (E) | a\n}\n");
const GAMB = gram('grammatik GA {\n  nichtterminale E\n  terminale + a\n  start E\n  E -> E+E | a\n}\n');

describe('dev earley 6.44', () => {
  it('Itemmengen', () => {
    const r = ok(earley(G644, chars('abc')));
    const txt = r.sets.map((s) => s.map((it) => ns(earleyItemText(G644.productions.find((p) => p.id === it.production) as Production, it))).sort());
    const want = [
      ['S →_0 • A X', 'A →_0 • a'],
      ['S →_0 A • X', 'X →_1 • B C', 'B →_1 • b', 'A →_0 a •'],
      ['X →_1 B • C', 'C →_2 • c', 'B →_1 b •'],
      ['S →_0 A X •', 'X →_1 B C •', 'C →_2 c •'],
    ];
    expect(txt).toEqual(want.map((s) => s.map(ns).sort()));
    expect(r.accepted).toBe(true);
    expect(ok(earley(G644, chars('ab'))).accepted).toBe(false);
  });
  it('epsilon', () => {
    const g = gram('grammatik E {\n  nichtterminale S A\n  terminale a\n  start S\n  S -> AAa\n  A -> ε\n}\n');
    expect(ok(earley(g, chars('a'))).accepted).toBe(true);
    expect(ok(earley(g, chars('aa'))).accepted).toBe(false);
  });
});

// Zustände der Grammatik 6.45 als Kerne (6.53), Schlüssel = z-Nummer des Skripts
const kernels: Record<number, string[]> = {
  0: ["E' → ⊣ • E ⊢"],
  1: ["E' → ⊣ E • ⊢", 'E → E • + T'],
  2: ['E → T •', 'T → T • * F'],
  3: ['T → F •'],
  4: ['F → a •'],
  5: ['F → ( • E )'],
  7: ['E → E + • T'],
  8: ["E' → ⊣ E ⊢ •"],
  9: ['T → T * • F'],
  10: ['F → ( E • )', 'E → E • + T'],
  11: ['E → E + T •', 'T → T • * F'],
  12: ['T → T * F •'],
  13: ['F → ( E ) •'],
};
const script: [number, string, number][] = [
  [0, 'E', 1], [0, 'T', 2], [0, 'F', 3], [0, 'a', 4], [0, '(', 5],
  [1, '+', 7], [1, '⊢', 8], [2, '*', 9],
  [5, 'E', 10], [5, 'T', 2], [5, 'F', 3], [5, 'a', 4], [5, '(', 5],
  [7, 'T', 11], [7, 'F', 3], [7, 'a', 4], [7, '(', 5],
  [9, 'F', 12], [9, 'a', 4], [9, '(', 5],
  [10, ')', 13], [10, '+', 7], [11, '*', 9],
];
const kernelText = (a: LrAutomaton, id: number): string[] =>
  (a.states[id]?.kernel ?? []).map((i) => ns(lrItemText(a.augmented.productions.find((p) => p.id === i.production) as Production, i.dot))).sort();

describe('dev lr 6.45', () => {
  for (const mode of ['LR0', 'LALR1'] as const) {
    it(`Zustände und goto ${mode}`, () => {
      const a = ok(lrAutomaton(G645, mode));
      expect(a.states.length).toBe(13);
      const map = new Map<number, number>(); // Skript -> unser Zustand
      for (const [z, k] of Object.entries(kernels)) {
        const id = a.states.findIndex((_, i) => JSON.stringify(kernelText(a, i)) === JSON.stringify(k.map(ns).sort()));
        expect(id, `z${z}`).toBeGreaterThanOrEqual(0);
        map.set(Number(z), id);
      }
      expect(a.goto.length).toBe(script.length);
      for (const [f, s, t] of script) {
        const e = a.goto.find((x) => x.from === map.get(f) && x.symbol === s);
        expect(e?.to, `goto(z${f},${s})`).toBe(map.get(t));
      }
    });
  }
  it('LR0 hat Konflikte, LALR1 nicht', () => {
    expect(ok(lrAutomaton(G645, 'LR0')).conflicts.length).toBeGreaterThan(0);
    expect(ok(lrAutomaton(G645, 'LALR1')).conflicts.length).toBe(0);
  });
  it('Lauf (a+a)*a wie Tabelle 6.1', () => {
    const a = ok(lrAutomaton(G645, 'LALR1'));
    const r = lrRun(a, chars('(a+a)*a'));
    expect(r.accepted).toBe(true);
    const names = r.rows.map((row) => {
      const x = row.action;
      if (!x) return '-';
      if (x.kind === 'shift') return 'S';
      if (x.kind === 'accept') return 'A';
      if (x.kind === 'error') return 'err';
      return 'R' + (a.augmented.productions.findIndex((p) => p.id === x.production)); // 1-basiert wie R1..R6
    });
    expect(names).toEqual(['S', 'S', 'R6', 'R4', 'R2', 'S', 'S', 'R6', 'R4', 'R1', 'S', 'R5', 'R4', 'S', 'S', 'R6', 'R3', 'R2', 'A']);
    const symbols = r.rows.map((row) => row.stack.filter((_, i) => i % 2 === 1).join(''));
    expect(symbols[2]).toBe('⊣(a');
    expect(symbols[12]).toBe('⊣F');
    expect(symbols[18]).toBe('⊣E');
    expect(r.rows[0]?.rest.join('')).toBe('(a+a)*a⊢');
    expect(lrRun(a, chars('(a+')).accepted).toBe(false);
  });
});

describe('dev lr Konflikt', () => {
  it('E -> E+E | a', () => {
    for (const mode of ['LR0', 'LALR1'] as const) {
      const a = ok(lrAutomaton(GAMB, mode));
      expect(a.conflicts.length).toBeGreaterThan(0);
      const c = a.conflicts.find((x) => x.symbol === '+');
      expect(c?.actions.map((x) => x.kind).sort()).toEqual(['reduce', 'shift']);
      expect(lrRun(a, chars('a+a+a')).accepted).toBe(true);
    }
  });
  it('Warnungen', async () => {
    const { lrConflictDiagnostics } = await import('../cfg/lr');
    const d = lrConflictDiagnostics(ok(lrAutomaton(GAMB, 'LALR1')));
    expect(d[0]?.code).toBe('lr.conflict');
    expect(d[0]?.severity).toBe('warning');
  });
});
