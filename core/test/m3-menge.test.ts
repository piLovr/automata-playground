// M3, Teil C: endliche Mengen (menge), Text/JSON, Sprachrechner (Kap. 1, 1.4–1.10).
// Erwartungen aus docs/kern-spec-m3.md (Teil A, C) und docs/skript-notizen-m3.md (1.3–1.10).
// Nur die öffentliche Schnittstelle core/index.ts.

import { describe, expect, it } from 'vitest';
import {
  accepts,
  emptyObject,
  equivalent,
  evalLang,
  fromJSON,
  isAutomaton,
  objectHash,
  parseDocument,
  printDocument,
  toDea,
  toJSON,
  validate,
} from '../index';
import type { Diagnostic, Document, MengeObj, ProcResult, Word } from '../index';

const errors = (ds: Diagnostic[]): Diagnostic[] => ds.filter((d) => d.severity === 'error');
const EMPTY: Document = { version: 1, objects: [] };

function parse(text: string): Document {
  const { doc, diagnostics } = parseDocument(text);
  expect(errors(diagnostics)).toEqual([]);
  return doc;
}

function mengeOf(doc: Document, name: string): MengeObj {
  const o = doc.objects.find((x) => x.name === name);
  expect(o?.kind).toBe('menge');
  return o as MengeObj;
}

/** Wörter als Zeichenketten (Symbole einzeln, ε = ''). */
const strs = (ws: Word[]): string[] => ws.map((w) => w.join(''));

function ev(expr: string, doc: Document = EMPTY, opts?: { maxLen?: number; maxWords?: number }) {
  const r = evalLang(expr, doc, opts);
  expect(errors(r.diagnostics)).toEqual([]);
  expect(r.result).not.toBeNull();
  return r as typeof r & { result: MengeObj };
}

function okOf<T>(r: ProcResult<T>): T {
  if (!r.ok) throw new Error('ProcResult ok=false');
  return r.result;
}

// ---------------------------------------------------------------------------
// Text: Kurzform, Blockform, Wörter, Duplikate, Sortierung

describe('menge: Text', () => {
  it('Kurzform 1.4-Beispiel: {01, 1, ε} liefert ε, 1, 01 (Länge, dann lexikographisch)', () => {
    const doc = parse('menge L1 = {01, 1, ε}\n');
    const L1 = mengeOf(doc, 'L1');
    expect(L1.kind).toBe('menge');
    expect(strs(L1.words)).toEqual(['', '1', '01']);
    // Alphabet ohne Angabe: Symbole in Reihenfolge des ersten Auftretens
    expect(L1.alphabet).toEqual(['0', '1']);
    expect(L1.upTo).toBeUndefined();
  });

  it('eps ist ebenfalls das leere Wort', () => {
    const G = mengeOf(parse('menge G = {eps}\n'), 'G');
    expect(G.words).toEqual([[]]);
  });

  it('{} ist die leere Menge; {ε} ist nicht leer', () => {
    const doc = parse('menge E = {}\nmenge Eps = {ε}\n');
    expect(mengeOf(doc, 'E').words).toEqual([]);
    expect(mengeOf(doc, 'Eps').words).toEqual([[]]);
  });

  it('∅ als Kurzform ist die leere Menge (Spec: {} oder ∅)', () => {
    const doc = parse('menge F = ∅\n');
    expect(mengeOf(doc, 'F').words).toEqual([]);
  });

  it('{∅} im Mengenliteral ist ebenfalls die leere Menge', () => {
    const doc = parse('menge F = {∅}\n');
    expect(mengeOf(doc, 'F').words).toEqual([]);
  });

  it('Duplikate: Wort nur einmal, Warnung menge.duplicate', () => {
    const { doc, diagnostics } = parseDocument('menge D = {0, 1, 0}\n');
    expect(errors(diagnostics)).toEqual([]);
    const D = mengeOf(doc, 'D');
    expect(strs(D.words)).toEqual(['0', '1']);
    const dup = diagnostics.find((d) => d.code === 'menge.duplicate');
    expect(dup).toBeDefined();
    expect(dup?.severity).toBe('warning');
    expect(dup?.params).toMatchObject({ word: ['0'] });
  });

  it('Sortierung nach Länge, dann lexikographisch in Alphabetreihenfolge', () => {
    // Erstes Auftreten 0 vor 1, daher Alphabet 0 < 1
    const S = mengeOf(parse('menge S = {0, 11, 10, 01, ε}\n'), 'S');
    expect(S.alphabet).toEqual(['0', '1']);
    expect(strs(S.words)).toEqual(['', '0', '01', '10', '11']);
  });

  it('Symbol der Länge > 1 als <name>', () => {
    const N = mengeOf(parse('menge N = {<ab>c}\n'), 'N');
    expect(N.words).toEqual([['ab', 'c']]);
    expect(N.alphabet).toEqual(['ab', 'c']);
  });

  it('Blockform mit bis: upTo wird gesetzt', () => {
    const doc = parse(`menge L {
  alphabet 0 1
  = {01, 1}
  bis 6
}
`);
    const L = mengeOf(doc, 'L');
    expect(L.alphabet).toEqual(['0', '1']);
    expect(strs(L.words)).toEqual(['1', '01']);
    expect(L.upTo).toBe(6);
  });

  it('Blockform mit expliziter Alphabet-Angabe behält das Alphabet', () => {
    const L = mengeOf(parse('menge L {\n  alphabet 0 1 2\n  = {01}\n}\n'), 'L');
    expect(L.alphabet).toEqual(['0', '1', '2']);
    expect(strs(L.words)).toEqual(['01']);
  });

  it('fehlerhafte Menge (nicht geschlossen) liefert einen Fehler', () => {
    const { diagnostics } = parseDocument('menge X = {0, 1\n');
    expect(errors(diagnostics).length).toBeGreaterThan(0);
  });

  it('Round-Trip Text: parse → print → parse ergibt dieselben Objekte', () => {
    const text = `menge L1 = {01, 1, ε}
menge L2 = {000, 01}
menge E = {}
menge S = {0, 11, 10, 01, ε}
`;
    const doc1 = parse(text);
    const printed = printDocument(doc1);
    const doc2 = parse(printed);
    expect(doc2.objects).toEqual(doc1.objects);
  });

  it('Drucker schreibt Kurzform, wenn Alphabet abgeleitet ist und kein upTo/origin vorliegt', () => {
    // Alphabet 0,1 entspricht der Reihenfolge des ersten Auftretens in den sortierten Wörtern
    const printed = printDocument(parse('menge L1 = {0, 1, 01}\n'));
    expect(printed).toMatch(/menge L1 = \{/);
    expect(printed).not.toMatch(/menge L1 \{/);
    expect(printed).not.toMatch(/bis \d/);
  });

  it('JSON-Round-Trip für menge', () => {
    const doc = parse('menge L1 = {01, 1, ε}\nmenge L2 = {0}\n');
    const r = fromJSON(toJSON(doc));
    expect(errors(r.diagnostics)).toEqual([]);
    expect(r.doc?.objects).toEqual(doc.objects);
  });

  it('Hash unterscheidet verschiedene Wortmengen, ist für gleiche gleich', () => {
    const doc = parse('menge A = {0, 1}\nmenge B = {0, 1}\nmenge C = {0}\n');
    const h = (n: string) => objectHash(mengeOf(doc, n));
    expect(h('A')).toBe(h('B'));
    expect(h('A')).not.toBe(h('C'));
  });

  it('emptyObject("menge") ist ein leeres, gültiges Objekt ohne Automaten-Status', () => {
    const o = emptyObject('menge', 'M');
    expect(o.kind).toBe('menge');
    expect(isAutomaton(o)).toBe(false);
    expect(errors(validate(o))).toEqual([]);
    expect((o as MengeObj).words).toEqual([]);
  });

  it('accepts über Typ-3-Behandlung der endlichen Menge', () => {
    const L = mengeOf(parse('menge L = {01, 1}\n'), 'L');
    expect(accepts(L, ['0', '1'])).toBe(true);
    expect(accepts(L, ['1'])).toBe(true);
    expect(accepts(L, ['0'])).toBe(false);
    expect(accepts(L, [])).toBe(false);
    expect(toDea(L)).not.toBeNull();
  });

  it('Äquivalenz mit regulärem Ausdruck: {0, 00} = 0|00; {0} ≠ 0|00 mit Wort 00 in Sprache 1', () => {
    const doc = parse('menge A = {0, 00}\nmenge C = {0}\nregex R = 0|00\n');
    const A = mengeOf(doc, 'A');
    const C = mengeOf(doc, 'C');
    const R = doc.objects.find((o) => o.name === 'R');
    expect(R).toBeDefined();
    const eq = okOf(equivalent(A, R!));
    expect(eq.equal).toBe(true);
    const neq = okOf(equivalent(C, R!));
    expect(neq.equal).toBe(false);
    expect(neq.word).toEqual(['0', '0']);
    expect(neq.inLanguage).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Sprachrechner: 1.4, 1.7, 1.8, 1.9, 1.10

describe('Sprachrechner: Wörter (1.4)', () => {
  it('00 · 10 = 0010 und 10 · 00 = 1000 (Juxtaposition und ·)', () => {
    expect(strs(ev('{00}{10}').result.words)).toEqual(['0010']);
    expect(strs(ev('{00} · {10}').result.words)).toEqual(['0010']);
    expect(strs(ev('{10}{00}').result.words)).toEqual(['1000']);
    expect(strs(ev('{10} . {00}').result.words)).toEqual(['1000']);
  });

  it('0^5 = 00000; 0^3 1^3 = 000111; 0 1^3 = 0111', () => {
    expect(strs(ev('{0}^5').result.words)).toEqual(['00000']);
    expect(strs(ev('{0}^3{1}^3').result.words)).toEqual(['000111']);
    expect(strs(ev('{0}{1}^3').result.words)).toEqual(['0111']);
  });

  it('(01)^3 = 010101', () => {
    expect(strs(ev('{01}^3').result.words)).toEqual(['010101']);
  });

  it('w^1 = w; ε^k = ε (k = 0 und k = 3)', () => {
    expect(strs(ev('{0110}^1').result.words)).toEqual(['0110']);
    expect(ev('{ε}^3').result.words).toEqual([[]]);
    expect(ev('{ε}^0').result.words).toEqual([[]]);
    expect(ev('{0}^0').result.words).toEqual([[]]);
  });
});

describe('Sprachrechner: Mengen (1.7)', () => {
  it('{01, 1} · {000, 01} = {01000, 0101, 1000, 101}', () => {
    const expected = ['101', '0101', '1000', '01000'];
    expect(strs(ev('{01, 1}{000, 01}').result.words)).toEqual(expected);
    expect(strs(ev('{01, 1} · {000, 01}').result.words)).toEqual(expected);
  });

  it('{010, 11}^2 = {010010, 01011, 11010, 1111}', () => {
    expect(strs(ev('{010, 11}^2').result.words)).toEqual(['1111', '01011', '11010', '010010']);
  });

  it('{0, 1}^3 = alle acht Wörter der Länge 3 in Reihenfolge', () => {
    expect(strs(ev('{0, 1}^3').result.words)).toEqual(['000', '001', '010', '011', '100', '101', '110', '111']);
  });

  it('Namen aus dem Dokument: L1 · L2 wie 1.7', () => {
    const doc = parse('menge L1 = {01, 1}\nmenge L2 = {000, 01}\n');
    expect(strs(ev('L1 L2', doc).result.words)).toEqual(['101', '0101', '1000', '01000']);
  });

  it('Vereinigung ∪ und |; Präzedenz: Konkatenation vor ∪', () => {
    expect(strs(ev('{a}{b} | {c}').result.words)).toEqual(['c', 'ab']);
    expect(strs(ev('{a} ∪ {b}{c}').result.words)).toEqual(['a', 'bc']);
    expect(strs(ev('{0, 1} ∪ {1, 2}').result.words)).toEqual(['0', '1', '2']);
  });

  it('Präzedenz: Potenz vor Konkatenation ({a}{b}^2 = {abb})', () => {
    expect(strs(ev('{a}{b}^2').result.words)).toEqual(['abb']);
  });

  it('Klammern ändern die Reihenfolge: ({a} | {b}){c}', () => {
    expect(strs(ev('({a} | {b}){c}').result.words)).toEqual(['ac', 'bc']);
  });

  it('Leere Menge: {}{a} = {}, {}^0 = {ε}', () => {
    expect(ev('{}{a}').result.words).toEqual([]);
    expect(ev('{}^0').result.words).toEqual([[]]);
  });
});

describe('Sprachrechner: Stern und Plus (1.8–1.10)', () => {
  it('1.8: {ε}L = L = L{ε}', () => {
    const doc = parse('menge L = {01, 1}\n');
    const L = mengeOf(doc, 'L');
    expect(ev('{ε}L', doc).result.words).toEqual(L.words);
    expect(ev('L{ε}', doc).result.words).toEqual(L.words);
  });

  it('{0,1}* bis Länge 4 = alle Wörter über {0,1} bis Länge 4; upTo = 4; Warnung lang.truncated', () => {
    const r = ev('{0,1}*', EMPTY, { maxLen: 4 });
    // alle Wörter über {0,1} der Länge 0..4, in Längen- und Alphabetreihenfolge
    const expected: string[] = [];
    for (let n = 0; n <= 4; n++) {
      for (let v = 0; v < 2 ** n; v++) {
        expected.push(n === 0 ? '' : v.toString(2).padStart(n, '0'));
      }
    }
    expect(strs(r.result.words)).toEqual(expected);
    expect(r.result.words.length).toBe(31);
    expect(r.result.upTo).toBe(4);
    expect(r.diagnostics.some((d) => d.code === 'lang.truncated' && d.severity === 'warning')).toBe(true);
  });

  it('Standard-maxLen ist 6: {0}* liefert 0^0 … 0^6 und upTo 6', () => {
    const r = ev('{0}*');
    expect(strs(r.result.words)).toEqual(['', '0', '00', '000', '0000', '00000', '000000']);
    expect(r.result.upTo).toBe(6);
  });

  it('{01}* bis Länge 4 enthält ε, 01, 0101 (nicht 010101)', () => {
    const r = ev('{01}*', EMPTY, { maxLen: 4 });
    expect(strs(r.result.words)).toEqual(['', '01', '0101']);
    expect(r.result.upTo).toBe(4);
  });

  it('{01}+ bis Länge 6: 01, 0101, 010101 (ohne ε)', () => {
    const r = ev('{01}+');
    expect(strs(r.result.words)).toEqual(['01', '0101', '010101']);
    expect(r.result.upTo).toBe(6);
  });

  it('endliche Sonderfälle ohne Kürzung: {}* = {ε}, {ε}* = {ε}, {}+ = ∅', () => {
    expect(ev('{}*').result.words).toEqual([[]]);
    expect(ev('{ε}*').result.words).toEqual([[]]);
    expect(ev('{}+').result.words).toEqual([]);
  });

  it('1.9: L* = {ε} ∪ L+', () => {
    const doc = parse('menge B = {01}\n');
    const star = strs(ev('B*', doc).result.words);
    const plus = strs(ev('B+', doc).result.words);
    expect(star).toEqual(['', ...plus]);
  });

  it('1.10: ε ∈ L+ gilt, wenn ε ∈ L; ε ∉ L+ sonst', () => {
    const doc = parse('menge A = {0, ε}\nmenge B = {01}\n');
    const withEps = strs(ev('A+', doc, { maxLen: 6 }).result.words);
    expect(withEps).toContain('');
    expect(withEps).toEqual(['', '0', '00', '000', '0000', '00000', '000000']);
    const withoutEps = ev('B+', doc);
    expect(strs(withoutEps.result.words)).not.toContain('');
    expect(strs(withoutEps.result.words)).toEqual(['01', '0101', '010101']);
  });

  it('Stern eines Typ-3-Objekts: Dualzahl (DEA 2.3) bis Länge 3 ist exakt die Menge der 20 Wörter', () => {
    const doc = parse(DUALZAHL_23);
    const r = ev('Dualzahl', doc, { maxLen: 3 });
    const expected = [
      '0', '1',
      '00', '01', '10', '11', '-0', '-1',
      '000', '001', '010', '011', '100', '101', '110', '111',
      '-00', '-01', '-10', '-11',
    ].sort();
    expect(strs(r.result.words).sort()).toEqual(expected);
    expect(r.result.words.length).toBe(20);
    expect(r.result.upTo).toBe(3);
    expect(r.diagnostics.some((d) => d.code === 'lang.truncated')).toBe(true);
  });
});

const DUALZAHL_23 = String.raw`dea Dualzahl {
  alphabet 0 1 \-
  start A
  accept B
  A -0,1-> B
  A -\--> M
  M -0,1-> B
  M -\--> Q
  B -0,1-> B
  B -\--> Q
  Q -0,1,\--> Q
}
`;

// ---------------------------------------------------------------------------
// Fehler und Grenzen

describe('Sprachrechner: Diagnosen und Grenzen', () => {
  it('unbekannter Name: lang.unknownName, kein Ergebnis', () => {
    const r = evalLang('Foo', EMPTY);
    expect(r.result).toBeNull();
    expect(r.diagnostics.some((d) => d.code === 'lang.unknownName')).toBe(true);
  });

  it('Syntaxfehler im Ausdruck: lang.syntax', () => {
    const r = evalLang('{0})', EMPTY);
    expect(r.result).toBeNull();
    expect(r.diagnostics.some((d) => d.code === 'lang.syntax')).toBe(true);
  });

  it('Typ-2-Grammatik ist weder endlich noch Typ 3: lang.notFinite', () => {
    const doc = parse(`grammatik G {
  nichtterminale X
  terminale 0 1
  start X
  X -> 01 | 0X1
}
`);
    const r = evalLang('G', doc);
    expect(r.result).toBeNull();
    expect(r.diagnostics.some((d) => d.code === 'lang.notFinite')).toBe(true);
  });

  it('mehr Wörter als maxWords: lang.tooLarge', () => {
    const r = evalLang('{0,1}^3', EMPTY, { maxWords: 7 });
    expect(r.diagnostics.some((d) => d.code === 'lang.tooLarge')).toBe(true);
  });

  it('{0,1}^13 (8192 Wörter) überschreitet das Standardlimit 5000: lang.tooLarge', () => {
    const r = evalLang('{0,1}^13', EMPTY);
    expect(r.diagnostics.some((d) => d.code === 'lang.tooLarge')).toBe(true);
  });

  it('{0,1}^3 liegt unter dem Standardlimit und ist fehlerfrei', () => {
    expect(ev('{0,1}^3').result.words.length).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Herkunft und Schritte

describe('Sprachrechner: Herkunft und Schritte', () => {
  it('Ergebnis hat origin.method sprachop, sources = benutzte Namen', () => {
    const doc = parse('menge L1 = {01, 1}\nmenge L2 = {000, 01}\n');
    const r = ev('L1 L2', doc);
    expect(r.result.origin?.method).toBe('sprachop');
    expect([...(r.result.origin?.sources ?? [])].sort()).toEqual(['L1', 'L2']);
  });

  it('Literale ohne Namen: sources leer', () => {
    const r = ev('{0}{1}');
    expect(r.result.origin?.sources ?? []).toEqual([]);
  });

  it('je Operation ein Schritt mit proc.lang-Schlüssel', () => {
    const keys = (expr: string) => evalLang(expr, EMPTY).steps.map((s) => s.explanation.key);
    expect(keys('{0}{1}')).toContain('proc.lang.concat');
    expect(keys('{0}|{1}')).toContain('proc.lang.union');
    expect(keys('{0}^3')).toContain('proc.lang.power');
    expect(keys('{0}*')).toContain('proc.lang.star');
    expect(keys('{0}+')).toContain('proc.lang.plus');
  });
});
