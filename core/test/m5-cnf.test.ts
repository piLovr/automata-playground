// M5, Teil C: Chomsky-Normalform (6.22–6.32), EPS (6.24–6.26).
// Erwartungen aus docs/kern-spec-m5.md (Teil A, Teil C), docs/plan-m5.md (Entscheidung 1) und
// docs/skript-notizen-m5.md (6.22, 6.26, 6.29/6.30, 6.31, 6.32). Nur core/index.ts.
// Grammatiken als Text über parseDocument. Produktionen werden als Text „L -> r1 r2 …“ verglichen
// (Symbole durch Leerzeichen getrennt, ε für die leere rechte Seite).

import { describe, expect, it } from 'vitest';
import {
  cfgWords,
  cnfChains,
  cnfEpsilon,
  cnfLong,
  cnfTerminals,
  epsSet,
  isCnf,
  parseDocument,
  toCnf,
} from '../index';
import type { Diagnostic, Grammar, Production, ProductionId, ProcResult, StepTable, Word } from '../index';

// ---------------------------------------------------------------------------
// Hilfsfunktionen (nur Test)

function gram(text: string): Grammar {
  const { doc, diagnostics } = parseDocument(text);
  const errs = diagnostics.filter((d: Diagnostic) => d.severity === 'error');
  expect(errs, text).toEqual([]);
  const o = doc.objects[0];
  expect(o?.kind).toBe('grammatik');
  return o as Grammar;
}

/** Erfolgreiches Ergebnis; wirft, wenn das Verfahren abgelehnt wurde. */
function ok<R>(r: ProcResult<R>): R {
  if (!r.ok) throw new Error('Verfahren abgelehnt: ' + JSON.stringify(r.diagnostics));
  return r.result;
}

const str = (w: Word): string => (w.length ? w.join(' ') : 'ε');
const pstr = (p: Production): string => `${str(p.left)} -> ${str(p.right)}`;
const prodSet = (g: Grammar): string[] => g.productions.map(pstr).sort();
const sorted = (xs: string[]): string[] => [...xs].sort();
const wstr = (w: Word): string => w.join('');

/** Id der Produktion mit gegebenem Text („E -> E + F“). */
function idOf(g: Grammar, line: string): ProductionId {
  const p = g.productions.find((q) => pstr(q) === line);
  if (!p) throw new Error(`Produktion „${line}“ fehlt`);
  return p.id;
}

/** ZellenText „{E, F}“ bzw. „∅“ als Menge von Symbolen. */
const cellSet = (s: string): string[] =>
  s
    .replace(/[{}∅\s]/g, '')
    .split(',')
    .filter((x) => x !== '')
    .sort();

// ---------------------------------------------------------------------------
// Grammatiken

/** 6.32: E → E+F | F, F → (E) | a, Startsymbol E. */
const G32 = gram(`grammatik G32 {
  nichtterminale E F
  terminale a + ( )
  start E
  E -> E+F | F
  F -> (E) | a
}`);

/** 6.26: X → YZ, Y → ZZ, Z → a | ε. */
const G26 = gram(`grammatik G26 {
  nichtterminale X Y Z
  terminale a
  start X
  X -> YZ
  Y -> ZZ
  Z -> a | ε
}`);

/** Typ 0 (AB → BA): kein Typ 2. */
const T0 = gram(`grammatik T0 {
  nichtterminale S A B
  terminale a b
  start S
  S -> aAB
  AB -> BA
}`);

/** Bereits in CNF (mit S → ε, S nicht rechts). */
const GCNF = gram(`grammatik GCNF {
  nichtterminale S A B
  terminale a b
  start S
  S -> ε | AB
  A -> a
  B -> b
}`);

// ---------------------------------------------------------------------------
// EPS (6.24–6.26)

describe('EPS-Menge (6.24–6.26)', () => {
  it('6.26: EPS = {X, Y, Z}', () => {
    expect(sorted(ok(epsSet(G26)))).toEqual(['X', 'Y', 'Z']);
  });

  it('6.26: schrittweise, je Runde mindestens ein Schritt (M1, M2, M3)', () => {
    const r = epsSet(G26);
    expect(r.ok).toBe(true);
    expect(r.steps.length).toBeGreaterThanOrEqual(3);
  });

  it('steps:false liefert dieselbe Menge ohne Schritte', () => {
    const r = epsSet(G26, { steps: false });
    expect(sorted(ok(r))).toEqual(['X', 'Y', 'Z']);
    expect(r.steps).toEqual([]);
  });

  it('ohne ε-Produktionen ist EPS leer (G32)', () => {
    expect(ok(epsSet(G32))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// isCnf (6.22)

describe('isCnf (6.22)', () => {
  it('CNF-Grammatik mit S → ε (S nicht rechts) ist CNF', () => {
    expect(isCnf(GCNF).ok).toBe(true);
    expect(isCnf(GCNF).productionIds).toEqual([]);
  });

  it('6.32-Grammatik vor der Umwandlung ist nicht CNF; genau E+F, E→F, F→(E) sind verletzt', () => {
    const r = isCnf(G32);
    expect(r.ok).toBe(false);
    expect(sorted([...r.productionIds])).toEqual(
      sorted([idOf(G32, 'E -> E + F'), idOf(G32, 'E -> F'), idOf(G32, 'F -> ( E )')]),
    );
  });

  it('A → aA verletzt die Form X → YZ / X → a', () => {
    const g = gram(`grammatik GN {
      nichtterminale A
      terminale a b
      start A
      A -> aA | b
    }`);
    const r = isCnf(g);
    expect(r.ok).toBe(false);
    expect(r.productionIds).toEqual([idOf(g, 'A -> a A')]);
  });

  it('S → ε mit S auf rechter Seite ist nicht CNF', () => {
    const g = gram(`grammatik GS {
      nichtterminale S
      terminale a
      start S
      S -> ε | SS | a
    }`);
    expect(isCnf(g).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Schritt 1: Terminale auslagern (6.31, 6.32 Schritt 1)

describe('Schritt 1: cnfTerminals (6.32)', () => {
  const expected = sorted([
    'E -> E Z+ F',
    'E -> F',
    'F -> Z( E Z)',
    'F -> Za',
    'Z+ -> +',
    'Za -> a',
    'Z( -> (',
    'Z) -> )',
  ]);

  it('ergibt exakt die Produktionen aus 6.32 Schritt 1', () => {
    expect(prodSet(ok(cnfTerminals(G32)))).toEqual(expected);
  });

  it('neue Nichtterminale Z+, Za, Z(, Z) und Startsymbol E', () => {
    const r = ok(cnfTerminals(G32));
    expect(r.start).toBe('E');
    expect(sorted(r.nonterminals)).toEqual(sorted(['E', 'F', 'Z+', 'Za', 'Z(', 'Z)']));
  });

  it('Herkunft: Methode cnfTerminals', () => {
    expect(ok(cnfTerminals(G32)).origin?.method).toBe('cnfTerminals');
  });
});

// ---------------------------------------------------------------------------
// Schritt 2: ε-Produktionen (6.27–6.30)

describe('Schritt 2: cnfEpsilon (6.27–6.30)', () => {
  it('6.32 Schritt 2: keine ε-Produktionen, keine Änderung', () => {
    const s1 = ok(cnfTerminals(G32));
    const s2 = ok(cnfEpsilon(s1));
    expect(prodSet(s2)).toEqual(prodSet(s1));
    expect(s2.start).toBe(s1.start);
  });

  it('6.26-Grammatik: Produktionen ohne ε-Symbole (6.28), neues Startsymbol S̄ → ε | X (6.29/6.30)', () => {
    const r = ok(cnfEpsilon(G26));
    const start = r.start as string;
    expect(start).not.toBe('X');
    expect(start).not.toBeNull();

    const rest = r.productions.filter((p) => str(p.left) !== start).map(pstr);
    expect(sorted(rest)).toEqual(
      sorted(['X -> Y Z', 'X -> Y', 'X -> Z', 'Y -> Z Z', 'Y -> Z', 'Z -> a']),
    );

    const fromStart = r.productions.filter((p) => str(p.left) === start).map(pstr);
    expect(sorted(fromStart)).toEqual(sorted([`${start} -> ε`, `${start} -> X`]));

    expect(r.productions.some((p) => p.right.includes(start))).toBe(false);
  });

  it('6.26-Grammatik: Sprache bleibt bis Länge 4 erhalten', () => {
    const r = ok(cnfEpsilon(G26));
    const a = cfgWords(G26, 4);
    const b = cfgWords(r, 4);
    expect(sorted(b.words.map(wstr))).toEqual(sorted(a.words.map(wstr)));
  });
});

// ---------------------------------------------------------------------------
// Schritt 3: Kettenproduktionen, Mengentabelle (6.31, 6.32 Schritt 3)

describe('Schritt 3: cnfChains (6.32)', () => {
  const s1 = () => ok(cnfTerminals(G32));

  it('Mengentabelle M0 … M3: E → {E}, {E,F}, {E,F,Za}, {E,F,Za}; F → {F}, {F,Za}, {F,Za}, {F,Za}', () => {
    const r = cnfChains(s1(), { scriptLiteral: true });
    expect(r.ok).toBe(true);
    const tables = r.steps.map((s) => s.view.table).filter((t): t is StepTable => t !== undefined);
    expect(tables.length).toBeGreaterThan(0);
    const last = tables[tables.length - 1] as StepTable;
    expect(last.rowHead.length).toBe(2);
    expect(last.colHead.length).toBe(4);
    const row = (x: string): string[][] => {
      const i = last.rowHead.indexOf(x);
      expect(i, `Zeile ${x}`).toBeGreaterThanOrEqual(0);
      return (last.cells[i] ?? []).map(cellSet);
    };
    expect(row('E')).toEqual([['E'], ['E', 'F'], ['E', 'F', 'Za'], ['E', 'F', 'Za']]);
    expect(row('F')).toEqual([['F'], ['F', 'Za'], ['F', 'Za'], ['F', 'Za']]);
  });

  it('wörtlich (scriptLiteral): genau die Produktionen aus 6.32 Schritt 3, ohne E → a / F → a', () => {
    const expected = sorted([
      'E -> E Z+ F',
      'E -> F Z+ F',
      'E -> Za Z+ F',
      'E -> E Z+ Za',
      'E -> F Z+ Za',
      'E -> Za Z+ Za',
      'E -> Z( E Z)',
      'E -> Z( F Z)',
      'E -> Z( Za Z)',
      'F -> Z( E Z)',
      'F -> Z( F Z)',
      'F -> Z( Za Z)',
      'Z+ -> +',
      'Za -> a',
      'Z( -> (',
      'Z) -> )',
    ]);
    expect(prodSet(ok(cnfChains(s1(), { scriptLiteral: true })))).toEqual(expected);
  });

  it('wörtlich: Produktionen in der Reihenfolge der Notizen (E-Familie aus E → E Z+ F zuerst)', () => {
    const r = ok(cnfChains(s1(), { scriptLiteral: true }));
    const lines = r.productions.map(pstr);
    const order = [
      'E -> E Z+ F',
      'E -> F Z+ F',
      'E -> Za Z+ F',
      'E -> E Z+ Za',
      'E -> F Z+ Za',
      'E -> Za Z+ Za',
    ].map((l) => lines.indexOf(l));
    for (const i of order) expect(i).toBeGreaterThanOrEqual(0);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('Standard (ohne scriptLiteral): zusätzlich E → a und F → a', () => {
    const expected = sorted([
      'E -> E Z+ F',
      'E -> F Z+ F',
      'E -> Za Z+ F',
      'E -> E Z+ Za',
      'E -> F Z+ Za',
      'E -> Za Z+ Za',
      'E -> Z( E Z)',
      'E -> Z( F Z)',
      'E -> Z( Za Z)',
      'E -> a',
      'F -> Z( E Z)',
      'F -> Z( F Z)',
      'F -> Z( Za Z)',
      'F -> a',
      'Z+ -> +',
      'Za -> a',
      'Z( -> (',
      'Z) -> )',
    ]);
    expect(prodSet(ok(cnfChains(s1())))).toEqual(expected);
  });

  it('wörtlich: Doppelte Produktionen werden nicht angelegt', () => {
    const lines = ok(cnfChains(s1(), { scriptLiteral: true })).productions.map(pstr);
    expect(new Set(lines).size).toBe(lines.length);
  });

  it('T0 (kein Typ 2): Verfahren abgelehnt mit algo.notType2', () => {
    const r = cnfTerminals(T0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.diagnostics.map((d) => d.code)).toContain('algo.notType2');
  });
});

// ---------------------------------------------------------------------------
// Schritt 4: lange rechte Seiten (6.31, 6.32 Schritt 4)

describe('Schritt 4: cnfLong (6.32)', () => {
  const literal = () => ok(cnfChains(ok(cnfTerminals(G32)), { scriptLiteral: true }));

  it('sparsam (Standard) mit scriptLiteral: exakt die Tabelle 6.32 mit V1 … V5', () => {
    const expected = sorted([
      'E -> E V1',
      'E -> F V1',
      'E -> Za V1',
      'E -> E V2',
      'E -> F V2',
      'E -> Za V2',
      'E -> Z( V3',
      'E -> Z( V4',
      'E -> Z( V5',
      'F -> Z( V3',
      'F -> Z( V4',
      'F -> Z( V5',
      'V1 -> Z+ F',
      'V2 -> Z+ Za',
      'V3 -> E Z)',
      'V4 -> F Z)',
      'V5 -> Za Z)',
      'Z+ -> +',
      'Za -> a',
      'Z( -> (',
      'Z) -> )',
    ]);
    const r = ok(cnfLong(literal()));
    expect(prodSet(r)).toEqual(expected);
    expect(r.start).toBe('E');
  });

  it('sparsam: Nichtterminale V1 … V5 in dieser Reihenfolge der Tabelle', () => {
    const r = ok(cnfLong(literal()));
    const vs = r.nonterminals.filter((n) => /^V\d+$/.test(n));
    expect(sorted(vs)).toEqual(['V1', 'V2', 'V3', 'V4', 'V5']);
  });

  it('wörtlich (sparse: false): jede Produktion mit k ≥ 3 eigene neue Variablen, nur Länge ≤ 2', () => {
    const base = literal();
    const r = ok(cnfLong(base, { sparse: false }));
    expect(r.productions.every((p) => p.right.length <= 2)).toBe(true);
    expect(isCnf(r).ok).toBe(true);
    const added = r.nonterminals.length - base.nonterminals.length;
    // 12 Produktionen der Länge 3 nach Schritt 3; jede braucht mindestens eine eigene Variable.
    expect(added).toBeGreaterThanOrEqual(12);
    expect(added).toBeGreaterThan(5);
  });

  it('wörtlich und sparsam erzeugen dieselbe Sprache (bis Länge 5)', () => {
    const base = literal();
    const sp = cfgWords(ok(cnfLong(base)), 5);
    const wo = cfgWords(ok(cnfLong(base, { sparse: false })), 5);
    expect(sp.complete).toBe(true);
    expect(wo.complete).toBe(true);
    expect(sorted(wo.words.map(wstr))).toEqual(sorted(sp.words.map(wstr)));
  });
});

// ---------------------------------------------------------------------------
// toCnf: alle Schritte, Kette, Standard und wörtlich

describe('toCnf (6.31, 6.32)', () => {
  it('scriptLiteral: CNF aus 6.32 (sparsam) mit allen 21 Produktionen', () => {
    const expected = sorted([
      'E -> E V1',
      'E -> F V1',
      'E -> Za V1',
      'E -> E V2',
      'E -> F V2',
      'E -> Za V2',
      'E -> Z( V3',
      'E -> Z( V4',
      'E -> Z( V5',
      'F -> Z( V3',
      'F -> Z( V4',
      'F -> Z( V5',
      'V1 -> Z+ F',
      'V2 -> Z+ Za',
      'V3 -> E Z)',
      'V4 -> F Z)',
      'V5 -> Za Z)',
      'Z+ -> +',
      'Za -> a',
      'Z( -> (',
      'Z) -> )',
    ]);
    const r = ok(toCnf(G32, { scriptLiteral: true }));
    expect(prodSet(r)).toEqual(expected);
    expect(r.origin?.method).toBe('toCnf');
  });

  it('Kette G1 … G4 ergibt dasselbe wie toCnf (scriptLiteral)', () => {
    const g1 = ok(cnfTerminals(G32));
    const g2 = ok(cnfEpsilon(g1));
    const g3 = ok(cnfChains(g2, { scriptLiteral: true }));
    const g4 = ok(cnfLong(g3));
    expect(prodSet(ok(toCnf(G32, { scriptLiteral: true })))).toEqual(prodSet(g4));
  });

  it('scriptLiteral: Sprache ändert sich, „a“ fehlt (Entscheidung 1)', () => {
    const r = ok(toCnf(G32, { scriptLiteral: true }));
    expect(cfgWords(G32, 1).words.map(wstr)).toContain('a');
    expect(cfgWords(r, 1).words.map(wstr)).not.toContain('a');
  });

  it('Standard: Ergebnis ist CNF, E → a und F → a enthalten', () => {
    const r = ok(toCnf(G32));
    expect(isCnf(r).ok).toBe(true);
    const lines = prodSet(r);
    expect(lines).toContain('E -> a');
    expect(lines).toContain('F -> a');
  });

  it('Standard: Sprache bleibt bis Länge 5 erhalten (cfgWords)', () => {
    const a = cfgWords(G32, 5);
    const b = cfgWords(ok(toCnf(G32)), 5);
    expect(a.complete).toBe(true);
    expect(b.complete).toBe(true);
    expect(sorted(b.words.map(wstr))).toEqual(sorted(a.words.map(wstr)));
    expect(a.words.map(wstr)).toContain('(a+a)');
  });

  it('T0 (kein Typ 2): Verfahren abgelehnt mit algo.notType2', () => {
    const r = toCnf(T0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.diagnostics.map((d) => d.code)).toContain('algo.notType2');
  });
});

// ---------------------------------------------------------------------------
// Eingabeprüfung: CYK nur für CNF (in der Teil-A-Datei geprüft, hier Schnittstelle)

describe('CNF-Voraussetzung', () => {
  it('toCnf-Ergebnis ist CNF (Standard und scriptLiteral)', () => {
    expect(isCnf(ok(toCnf(G32))).ok).toBe(true);
    expect(isCnf(ok(toCnf(G32, { scriptLiteral: true }))).ok).toBe(true);
  });
});
