import { describe, expect, it } from 'vitest';
import { bottomUpRun, edit, fromJSON, grammarToNka, parseDocument, parseWord, printDocument, runMethod, simulate, toJSON, topDownRun } from '../index';
import type { FormalObject, Grammar, NKA, ParseRun } from '../index';

const G416 = parseDocument('grammatik G416 {\n  nichtterminale S\n  terminale ( )\n  start S\n  S -> ε | (S) | SS\n}\n').doc.objects[0] as Grammar;
const w = (s: string): string[] => parseWord(s).word;
const j = (x: string[]): string => x.join('');
const ok = <R>(r: { ok: boolean; result?: R }): R => {
  expect(r.ok).toBe(true);
  return r.result as R;
};
const act = (a: ParseRun['rows'][number]['action'], g: Grammar): string => {
  if (a === null) return '-';
  switch (a.kind) {
    case 'start':
      return 'start';
    case 'accept':
      return 'accept';
    case 'read':
    case 'shift':
      return `${a.kind}${a.sym}`;
    default: {
      const p = g.productions.find((x) => x.id === a.production);
      return `${p?.left.join('')}->${j(p?.right ?? [])}`;
    }
  }
};

describe('dev parse: 4.27', () => {
  it('Aufbau', () => {
    const k = ok(grammarToNka(G416));
    expect(k.states.map((s) => s.name)).toEqual(['z0', 'z', 'z+']);
    expect(k.y0).toBe('*');
    expect(k.transitions).toHaveLength(1 + 3 + 2 + 1);
    expect(k.origin?.method).toBe('grammar2nka');
    expect(runMethod('grammar2nka', [G416]).ok).toBe(true);
  });
  it('akzeptiert die Klammerwörter bis Länge 6', () => {
    const k = ok(grammarToNka(G416));
    const balanced = (s: string): boolean => {
      let d = 0;
      for (const c of s) {
        d += c === '(' ? 1 : -1;
        if (d < 0) return false;
      }
      return d === 0;
    };
    for (let len = 0; len <= 6; len++) {
      for (let m = 0; m < 2 ** len; m++) {
        const s = Array.from({ length: len }, (_, i) => ((m >> i) & 1 ? ')' : '(')).join('');
        const t = simulate(k, w(s));
        expect(t.result === 'accepted', s).toBe(balanced(s));
        if (len <= 4) {
          expect(ok(topDownRun(G416, w(s))).accepted, 'td ' + s).toBe(balanced(s));
          expect(ok(bottomUpRun(G416, w(s))).accepted, 'bu ' + s).toBe(balanced(s));
        }
      }
    }
  });
  it('keine Typ-2-Grammatik', () => {
    const g = parseDocument('grammatik H {\n  nichtterminale S A\n  terminale a\n  start S\n  S -> a\n  aA -> a\n}\n').doc.objects[0] as Grammar;
    const r = grammarToNka(g);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.diagnostics[0]?.code).toBe('algo.notType2');
  });
});

describe('dev parse: 4.28', () => {
  it('Tabelle Zeile für Zeile', () => {
    const run = ok(topDownRun(G416, w('(())()')));
    expect(run.accepted).toBe(true);
    const rows = run.rows.map((r) => [j(r.read), r.state, j(r.stack), act(r.action, G416)]);
    expect(rows).toEqual([
      ['', 'z0', '*', 'start'],
      ['', 'z', 'S*', 'S->SS'],
      ['', 'z', 'SS*', 'S->(S)'],
      ['', 'z', '(S)S*', 'read('],
      ['(', 'z', 'S)S*', 'S->(S)'],
      ['(', 'z', '(S))S*', 'read('],
      ['((', 'z', 'S))S*', 'S->'],
      ['((', 'z', '))S*', 'read)'],
      ['(()', 'z', ')S*', 'read)'],
      ['(())', 'z', 'S*', 'S->(S)'],
      ['(())', 'z', '(S)*', 'read('],
      ['(())(', 'z', 'S)*', 'S->'],
      ['(())(', 'z', ')*', 'read)'],
      ['(())()', 'z', '*', 'accept'],
      ['(())()', 'z+', '*', '-'],
    ]);
    expect(j(run.rows[6]?.form ?? [])).toBe('((S))S');
    expect(run.derivation?.steps.map((s) => j(s.form))).toEqual(['SS', '(S)S', '((S))S', '(())S', '(())(S)', '(())()']);
    expect(run.tree?.sym).toBe('S');
    expect(run.deadEnds).toBeGreaterThanOrEqual(0);
  });
  it('abgelehnt', () => {
    const run = ok(topDownRun(G416, w('(()')));
    expect(run.accepted).toBe(false);
    expect(run.rows).toEqual([]);
  });
});

describe('dev parse: 4.34', () => {
  it('Tabelle Zeile für Zeile', () => {
    const run = ok(bottomUpRun(G416, w('(())()')));
    expect(run.accepted).toBe(true);
    const rows = run.rows.map((r) => [j(r.stack), r.state, j(r.rest), act(r.action, G416)]);
    expect(rows).toEqual([
      ['*', 'z0', '(())()', 'shift('],
      ['*(', 'z', '())()', 'shift('],
      ['*((', 'z', '))()', 'S->'],
      ['*((S', 'z', '))()', 'shift)'],
      ['*((S)', 'z', ')()', 'S->(S)'],
      ['*(S', 'z', ')()', 'shift)'],
      ['*(S)', 'z', '()', 'S->(S)'],
      ['*S', 'z', '()', 'shift('],
      ['*S(', 'z', ')', 'S->'],
      ['*S(S', 'z', ')', 'shift)'],
      ['*S(S)', 'z', '', 'S->(S)'],
      ['*SS', 'z', '', 'S->SS'],
      ['*S', 'z', '', 'accept'],
      ['*S', 'z+', '', '-'],
    ]);
    expect(j(run.rows[2]?.form ?? [])).toBe('(())()'.slice(0, 2) + '))()');
    // Rechtsableitung S => SS => S(S) => S() => (S)() => (())() ... endet bei (())()
    const forms = run.derivation?.steps.map((s) => j(s.form));
    expect(forms?.[forms.length - 1]).toBe('(())()');
    expect(forms?.[0]).toBe('SS');
    expect(run.tree?.sym).toBe('S');
  });
});

describe('dev parse: acceptBy', () => {
  const text = 'nka E {\n  alphabet a\n  kelleralphabet * A\n  keller *\n  akzeptanz leer\n  start p\n  p, *, a -> p, A*\n  p, A, a -> p, ε\n}\n';
  it('Round-Trip Text und JSON', () => {
    const { doc, diagnostics } = parseDocument(text);
    expect(diagnostics).toEqual([]);
    const o = doc.objects[0] as NKA;
    expect(o.acceptBy).toBe('empty');
    const t = printDocument(doc);
    expect(t).toContain('akzeptanz leer');
    expect(parseDocument(t).doc).toEqual(doc);
    expect(fromJSON(toJSON(doc)).doc).toEqual(doc);
    const bad = { version: 1, objects: [{ ...o, acceptBy: 'x' }] };
    expect(fromJSON(JSON.stringify(bad)).diagnostics[0]?.code).toBe('json.invalid');
  });
  it('Simulation und edit', () => {
    const o = parseDocument(text).doc.objects[0] as NKA;
    expect(simulate(o, w('')).result).toBe('accepted');
    expect(simulate(o, w('a')).result).toBe('rejected'); // Keller A*, nicht leer
    const f = edit.setAcceptBy(o, 'final');
    expect('acceptBy' in f).toBe(false);
    expect(simulate(f, w('')).result).toBe('rejected');
    expect(printDocument({ version: 1, objects: [f as FormalObject] })).not.toContain('akzeptanz');
    expect(edit.setAcceptBy(f, 'empty').acceptBy).toBe('empty');
  });
});
