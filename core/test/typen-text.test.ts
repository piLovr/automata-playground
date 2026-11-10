import { describe, expect, it } from 'vitest';
import { fromJSON, parseDocument, printDocument, toJSON } from '../index';
import type { Diagnostic, Document } from '../index';
import {
  ALL_FIXTURES,
  FIXTURE_KINDS,
  MEALY_PARITAET,
  MOORE_210,
  NKA_46,
  NKA_49,
  TM_59,
  asMealy,
  asMoore,
  asNka,
  asTm,
  firstObject,
  idOf,
  parseFirst,
} from './typen-fixtures';

const errors = (ds: Diagnostic[]): Diagnostic[] => ds.filter((d) => d.severity === 'error');

/** Dokument eines Fixtures; prüft vorab, dass genau ein Objekt der erwarteten Art entsteht. */
function docOf(name: keyof typeof ALL_FIXTURES): Document {
  const doc = parseDocument(ALL_FIXTURES[name]).doc;
  expect(doc.objects.map((o) => o.kind)).toEqual([FIXTURE_KINDS[name]]);
  return doc;
}

describe('Parsen der Fixtures', () => {
  for (const name of Object.keys(ALL_FIXTURES) as (keyof typeof ALL_FIXTURES)[]) {
    it(`${name} parst ohne Fehler zu einem Objekt der richtigen Art`, () => {
      const { doc, diagnostics } = parseDocument(ALL_FIXTURES[name]);
      expect(errors(diagnostics)).toEqual([]);
      expect(doc.objects.map((o) => o.kind)).toEqual([FIXTURE_KINDS[name]]);
    });
  }
});

describe('Anzahl Zustände und Übergänge', () => {
  it('MOORE_210: 4 Zustände, 12 Übergänge', () => {
    const obj = asMoore(parseFirst(MOORE_210));
    expect(obj.states).toHaveLength(4);
    expect(obj.transitions).toHaveLength(12);
  });

  it('MEALY_PARITAET: 2 Zustände, 4 Übergänge', () => {
    const obj = asMealy(parseFirst(MEALY_PARITAET));
    expect(obj.states).toHaveLength(2);
    expect(obj.transitions).toHaveLength(4);
  });

  it('NKA_46: 4 Zustände (inkl. z−), 5 Übergänge', () => {
    const obj = asNka(parseFirst(NKA_46));
    expect(obj.states).toHaveLength(4);
    expect(obj.states.map((s) => s.name)).toContain('z−');
    expect(obj.transitions).toHaveLength(5);
  });

  it('NKA_49: 4 Zustände (inkl. z−), 13 Übergänge', () => {
    const obj = asNka(parseFirst(NKA_49));
    expect(obj.states).toHaveLength(4);
    expect(obj.states.map((s) => s.name)).toContain('z−');
    expect(obj.transitions).toHaveLength(13);
  });

  it('TM_59: 8 Zustände, 18 Übergänge', () => {
    const obj = asTm(parseFirst(TM_59));
    expect(obj.states).toHaveLength(8);
    expect(obj.transitions).toHaveLength(18);
  });
});

describe('Beschriftungen', () => {
  it('NKA_46 erste Zeile: {top: *, read: 0, push: [0, *]}', () => {
    const obj = asNka(parseFirst(NKA_46));
    expect(obj.transitions[0]?.label).toEqual({ top: '*', read: '0', push: ['0', '*'] });
  });

  it('NKA_46 z0, 0, 1 -> z1, ε: push ist das leere Wort', () => {
    const obj = asNka(parseFirst(NKA_46));
    expect(obj.transitions[2]?.label).toEqual({ top: '0', read: '1', push: [] });
  });

  it('NKA_46 ε als Lesesymbol wird zu read: null', () => {
    const obj = asNka(parseFirst(NKA_46));
    expect(obj.transitions[4]?.label).toEqual({ top: '*', read: null, push: ['*'] });
  });

  it('NKA_46: Keller-Anfangssymbol y0 ist *', () => {
    expect(asNka(parseFirst(NKA_46)).y0).toBe('*');
  });

  it('Mealy `u -0/1-> u` ergibt {in: 0, out: 1}', () => {
    const obj = asMealy(parseFirst(MEALY_PARITAET));
    expect(obj.transitions[2]?.label).toEqual({ in: '0', out: '1' });
  });

  it('TM: R -> move 1, N -> move 0, L -> move -1', () => {
    const obj = asTm(parseFirst(TM_59));
    expect(obj.transitions[0]?.label.move).toBe(1); // r, a -> ra, □, R
    expect(obj.transitions[2]?.label.move).toBe(0); // r, □ -> f+, □, N
    expect(obj.transitions[5]?.label.move).toBe(-1); // ra, □ -> la, □, L
  });

  it('TM: Blank und Zeichen □ werden als Symbol gelesen', () => {
    const obj = asTm(parseFirst(TM_59));
    expect(obj.blank).toBe('□');
    expect(obj.transitions[0]?.label).toEqual({ read: 'a', write: '□', move: 1 });
  });

  it('Moore-Ausgaben: A=0, B=1', () => {
    const obj = asMoore(parseFirst(MOORE_210));
    const out = (name: string) => obj.states.find((s) => s.name === name)?.out;
    expect(out('A')).toBe('0');
    expect(out('B')).toBe('1');
    expect(obj.states.find((s) => s.id === idOf(obj, 'B'))?.out).toBe('1');
  });

  it('TM: F+ ist accept, F− ist reject', () => {
    const obj = asTm(parseFirst(TM_59));
    expect(obj.accept).toEqual([idOf(obj, 'f+')]);
    expect(obj.reject).toEqual([idOf(obj, 'f-')]);
  });
});

describe('Round-Trip', () => {
  for (const name of Object.keys(ALL_FIXTURES) as (keyof typeof ALL_FIXTURES)[]) {
    it(`${name}: print(parse(t)) ist Fixpunkt`, () => {
      const p1 = printDocument(docOf(name));
      const p2 = printDocument(parseDocument(p1).doc);
      expect(p1.length).toBeGreaterThan(0);
      expect(p2).toBe(p1);
    });

    it(`${name}: parse(print(d)) ist deep-gleich d`, () => {
      const doc = docOf(name);
      expect(parseDocument(printDocument(doc)).doc).toEqual(doc);
    });

    it(`${name}: fromJSON(toJSON(d)).doc ist deep-gleich d`, () => {
      const doc = docOf(name);
      expect(fromJSON(toJSON(doc)).doc).toEqual(doc);
    });
  }
});

describe('Fehlerfälle', () => {
  it('Zeilenform in dea ist ein Fehler (syntax.unexpected)', () => {
    const text = 'dea Falsch {\n  alphabet 0\n  start A\n  accept A\n  A, 0 -> A\n}\n';
    const { diagnostics } = parseDocument(text);
    expect(errors(diagnostics).map((d) => d.code)).toContain('syntax.unexpected');
  });

  it('Mealy-Label ohne / ergibt Diagnose label.shape', () => {
    const text = 'mealy M {\n  alphabet 0 1\n  ausgabealphabet 0 1\n  start g\n  g -0-> g\n}\n';
    const { diagnostics } = parseDocument(text);
    expect(diagnostics.map((d) => d.code)).toContain('label.shape');
  });

  it('TM-Richtung X ist ein Fehler', () => {
    const text =
      'tm T {\n  alphabet a\n  bandalphabet a □\n  blank □\n  states r f+ f-\n  start r\n  accept f+\n  reject f-\n  r, a -> r, a, X\n}\n';
    const { diagnostics } = parseDocument(text);
    expect(errors(diagnostics).length).toBeGreaterThan(0);
  });

  it('Objekt-Erstellung aus Fixture liefert das erwartete Kind', () => {
    expect(firstObject(parseDocument(TM_59).doc).kind).toBe('tm');
  });
});
