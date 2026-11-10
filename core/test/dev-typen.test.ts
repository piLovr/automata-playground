import { describe, expect, it } from 'vitest';
import { edit, emptyAutomaton, fromJSON, parseDocument, parseWord, printDocument, reconcile, simulate, toJSON, validate } from '../index';
import type { Automaton, Mealy, Moore, NKA, TM } from '../index';
import { ALL_FIXTURES, parseFirst } from './typen-fixtures';

const w = (s: string): string[] => parseWord(s).word;
const names = (o: Automaton, ids: string[]): string[] => ids.map((i) => o.states.find((s) => s.id === i)?.name ?? '?');

describe('dev typen: Round-Trip', () => {
  for (const [key, text] of Object.entries(ALL_FIXTURES)) {
    it(`${key}: Text und JSON`, () => {
      const { doc, diagnostics } = parseDocument(text);
      expect(diagnostics).toEqual([]);
      const t = printDocument(doc);
      expect(parseDocument(t).doc).toEqual(doc);
      expect(printDocument(parseDocument(t).doc)).toBe(t);
      expect(fromJSON(toJSON(doc)).doc).toEqual(doc);
    });
  }
  it('Mealy mit Symbol / und Moore ohne Ausgabe', () => {
    const { doc, diagnostics } = parseDocument('mealy M { A -\\//\\/-> A }\nmoore N { A -a-> A }');
    expect(diagnostics).toEqual([]);
    expect((doc.objects[0] as Mealy).transitions[0]?.label).toEqual({ in: '/', out: '/' });
    expect(parseDocument(printDocument(doc)).doc).toEqual(doc);
  });
  it('leere Automaten', () => {
    for (const k of ['mealy', 'moore', 'nka', 'tm'] as const) {
      const e = emptyAutomaton(k, 'X');
      const d = { version: 1 as const, objects: [e] };
      expect(parseDocument(printDocument(d)).doc).toEqual(d);
      expect(fromJSON(toJSON(d)).doc).toEqual(d);
    }
  });
  it('JSON-Prüfung', () => {
    const bad = { version: 1, objects: [{ ...emptyAutomaton('tm', 'T'), reject: ['x'] }] };
    expect(fromJSON(JSON.stringify(bad)).diagnostics[0]?.code).toBe('json.invalid');
  });
});

describe('dev typen: Simulation', () => {
  it('Moore 2.10: -101 -> 00111', () => {
    const o = parseFirst(ALL_FIXTURES.MOORE_210) as Moore;
    const tr = simulate(o, w('\\-101'));
    expect(tr.result).toBe('done');
    expect(tr.output).toEqual(['0', '0', '1', '1', '1']);
    expect(names(o, tr.stateSequence ?? [])).toEqual(['A', 'M', 'B', 'B', 'B']);
  });
  it('Mealy Parität', () => {
    const o = parseFirst(ALL_FIXTURES.MEALY_PARITAET) as Mealy;
    const tr = simulate(o, w('1101'));
    expect(tr.output).toEqual(['1', '0', '0', '1']);
    expect(tr.steps[0]?.output).toEqual([]);
  });
  it('NKA 4.6 Verlaufstabelle', () => {
    const o = parseFirst(ALL_FIXTURES.NKA_46) as NKA;
    const tr = simulate(o, w('00001111'));
    expect(tr.result).toBe('accepted');
    const rows = tr.steps.map((s) => [names(o, s.active)[0], (s.stack ?? []).join('')]);
    expect(rows).toEqual([
      ['z0', '*'], ['z0', '0*'], ['z0', '00*'], ['z0', '000*'], ['z0', '0000*'],
      ['z1', '000*'], ['z1', '00*'], ['z1', '0*'], ['z1', '*'], ['z+', '*'],
    ]);
    expect(tr.steps.map((s) => s.pos)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 8]);
    expect(simulate(o, w('0001111')).result).toBe('rejected');
  });
  it('NKA 4.9 abaaaaba', () => {
    const o = parseFirst(ALL_FIXTURES.NKA_49) as NKA;
    const tr = simulate(o, w('abaaaaba'));
    expect(tr.result).toBe('accepted');
    expect(simulate(o, w('abaab')).result).toBe('rejected');
    expect(simulate(o, w('')).result).toBe('rejected');
  });
  it('NKA Wachstumsschleife terminiert', () => {
    const { doc } = parseDocument('nka L { alphabet a\n keller *\n start s\n s, *, ε -> s, **\n}');
    const r = simulate(doc.objects[0] as NKA, w('a'), { stepLimit: 500 }).result;
    expect(['limit', 'rejected']).toContain(r);
  });
  it('TM 5.9 abbba in 21 Schritten', () => {
    const o = parseFirst(ALL_FIXTURES.TM_59) as TM;
    const tr = simulate(o, w('abbba'));
    expect(tr.result).toBe('accepted');
    expect(tr.steps.length).toBe(22);
    const zs = tr.steps.map((s) => names(o, s.active)[0]);
    expect(zs).toEqual([
      'r', 'ra', 'ra', 'ra', 'ra', 'ra', 'la', 'l', 'l', 'l', 'l', 'r', 'rb', 'rb', 'rb', 'lb', 'l', 'l', 'r', 'rb', 'lb', 'f+',
    ]);
    const heads = tr.steps.map((s) => (s.tape?.head ?? 0) + 1);
    expect(heads).toEqual([1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3, 2, 3, 4, 3, 3]);
    expect(tr.steps[1]?.tape?.cells.slice(0, 2)).toEqual(['□', 'b']);
    expect(tr.visited).toBeGreaterThan(0);
  });
  it('TM leere Eingabe', () => {
    const o = parseFirst(ALL_FIXTURES.TM_59) as TM;
    const tr = simulate(o, []);
    expect(tr.result).toBe('accepted');
    expect(tr.steps[0]?.tape?.cells).toEqual(['□']);
  });
});

describe('dev typen: Prüfung, Edit, Reconcile', () => {
  it('Prüfungen', () => {
    const tm = parseFirst(ALL_FIXTURES.TM_59) as TM;
    expect(validate(tm).filter((d) => d.severity === 'error')).toEqual([]);
    const bad = edit.setRejecting(tm, tm.accept[0] as string, true);
    expect(validate(bad).map((d) => d.code)).toContain('tm.finalOverlap');
    const moore = parseFirst(ALL_FIXTURES.MOORE_210) as Moore;
    expect(validate(edit.setOutput(moore, moore.states[0]?.id ?? '', null)).map((d) => d.code)).toContain('moore.missingOut');
  });
  it('edit und convertKind', () => {
    const nka = emptyAutomaton('nka', 'K') as NKA;
    const a = edit.addState(nka, 'z0');
    const b = edit.addTransition(a.obj, a.id, a.id, { top: '⊥', read: 'x', push: ['y', '⊥'] }).obj;
    expect(b.alphabet).toEqual(['x']);
    expect(b.stackAlphabet).toEqual(['⊥', 'y']);
    expect(() => edit.convertKind(b, 'dea')).toThrow();
    const t = parseFirst(ALL_FIXTURES.TM_59) as TM;
    const r = edit.removeStates(t, t.reject);
    expect(r.reject).toEqual([]);
  });
  it('reconcile behält IDs', () => {
    const prev = parseFirst(ALL_FIXTURES.NKA_46);
    const next = parseFirst(ALL_FIXTURES.NKA_46.replace('start z0', 'start z0\n  accept z+ z0'));
    const rec = reconcile(prev, next);
    expect(rec.transitions.map((t) => t.id)).toEqual(prev.transitions.map((t) => t.id));
  });
});
