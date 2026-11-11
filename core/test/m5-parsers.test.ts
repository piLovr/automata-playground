// M5, Teil C: CYK (6.33–6.38), Earley (6.39–6.44), LR (6.45–6.57, Tabelle 6.1).
// Erwartungen aus docs/kern-spec-m5.md (Teil C), docs/plan-m5.md (Entscheidung 1) und
// docs/skript-notizen-m5.md (6.35, 6.38, 6.44, 6.50/6.53/6.55, Tabelle 6.1). Nur core/index.ts.
// Grammatiken als Text über parseDocument.
//
// Hinweise:
// - Zustandsnummern der LR-Konstruktion sind frei (Breitensuche). Die Zuordnung zu z0 … z13 erfolgt
//   über die Itemmengen aus 6.53 (Umbenennung). Tabelle 6.1 nutzt die Nummern aus 6.50; die
//   Umrechnung läuft über die Itemmengen (NUM_6_1).
// - Fixturen werden lazy ausgewertet, damit ein fehlendes Verfahren je Test rot wird.
// - Warnungen (cnf.scriptLiteral, lr.conflict) sind bei ok:true nicht im Ergebnistyp vorgesehen
//   und werden hier nicht geprüft (siehe Abschnitt am Ende).

import { describe, expect, it } from 'vitest';
import {
  cyk,
  cykTree,
  earley,
  lrAutomaton,
  lrRun,
  parseDocument,
  toCnf,
  treeYield,
} from '../index';
import type {
  CykCell,
  CykResult,
  Diagnostic,
  DerivTree,
  EarleyItem,
  Grammar,
  LrAutomaton,
  LrItem,
  ProcResult,
  Production,
  Word,
} from '../index';

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

/** Wertet erst bei der ersten Verwendung aus. */
function lazy<T>(f: () => T): () => T {
  let v: T | undefined;
  let done = false;
  return () => {
    if (!done) {
      v = f();
      done = true;
    }
    return v as T;
  };
}

const W = (s: string): Word => [...s];
const str = (w: Word): string => (w.length ? w.join(' ') : 'ε');
const pstr = (p: Production): string => `${str(p.left)} -> ${str(p.right)}`;
const sorted = (xs: string[]): string[] => [...xs].sort();

function prodOf(g: Grammar, id: string): Production {
  const p = g.productions.find((q) => q.id === id);
  if (!p) throw new Error(`Produktion ${id} unbekannt`);
  return p;
}

/** Id der Produktion mit gegebenem Text („E -> E + F“). */
function idOf(g: Grammar, line: string): string {
  const p = g.productions.find((q) => pstr(q) === line);
  if (!p) throw new Error(`Produktion „${line}“ fehlt`);
  return p.id;
}

/** Zelle D[i, j] aus dem CYK-Ergebnis. */
function cellOf(r: CykResult, i: number, j: number): CykCell {
  const c = r.cells.find((x) => x.i === i && x.j === j);
  if (!c) throw new Error(`Zelle (${i},${j}) fehlt`);
  return c;
}

// ---------------------------------------------------------------------------
// Grammatiken

/** 6.32 (E → E+F | F, F → (E) | a), Startsymbol E. */
const G32 = gram(`grammatik G32 {
  nichtterminale E F
  terminale a + ( )
  start E
  E -> E+F | F
  F -> (E) | a
}`);

/** CNF aus 6.32 (sparsam, scriptLiteral), Grundlage für 6.35 und 6.38. */
const cnf35 = lazy(() => ok(toCnf(G32, { scriptLiteral: true })));

/** 6.44: S → AX, X → BC, A → a, B → b, C → c. */
const G44 = gram(`grammatik G44 {
  nichtterminale S X A B C
  terminale a b c
  start S
  S -> AX
  X -> BC
  A -> a
  B -> b
  C -> c
}`);

/** 6.45: E → E+T | T, T → T*F | F, F → (E) | a. */
const G45 = gram(`grammatik G45 {
  nichtterminale E T F
  terminale + * ( ) a
  start E
  E -> E+T | T
  T -> T*F | F
  F -> (E) | a
}`);

/** Typ 0 (AB → BA): kein Typ 2. */
const T0 = gram(`grammatik T0 {
  nichtterminale S A B
  terminale a b
  start S
  S -> aAB
  AB -> BA
}`);

// ---------------------------------------------------------------------------
// CYK (6.33–6.38)

const cykW = lazy(() => cyk(cnf35(), W('(a+a)')));
const cykR = lazy(() => ok(cykW()));

describe('CYK 6.35: Pyramide Zelle für Zelle (scriptLiteral-CNF, Wort (a+a))', () => {
  // Erwartung aus der CNF (6.32 sparsam): D[0,5] enthält E und F (Z( V3 → E und F).
  // Abb. 6.2 (E, F) stimmt damit überein; die Markierungsdarstellung 6.38 nennt nur E.
  const expected: [number, number, string[]][] = [
    [0, 1, ['Z(']],
    [1, 2, ['Za']],
    [2, 3, ['Z+']],
    [3, 4, ['Za']],
    [4, 5, ['Z)']],
    [0, 2, []],
    [1, 3, []],
    [2, 4, ['V2']],
    [3, 5, ['V5']],
    [0, 3, []],
    [1, 4, ['E']],
    [2, 5, []],
    [0, 4, []],
    [1, 5, ['V3']],
    [0, 5, ['E', 'F']],
  ];

  it('erfolgreich, 15 Zellen für n = 5', () => {
    expect(cykW().ok).toBe(true);
    expect(cykR().cells.length).toBe(15);
  });

  for (const [i, j, nts] of expected) {
    it(`D[${i},${j}] = {${nts.join(', ')}}`, () => {
      expect(sorted([...cellOf(cykR(), i, j).nonterminals])).toEqual(sorted(nts));
    });
  }

  it('accepted: S ∈ D[0,5] (E ∈ D[0,5])', () => {
    expect(cykR().accepted).toBe(true);
  });

  it('Schritte: je Zelle ein Schritt proc.cyk.cell in der Reihenfolge von 6.34 (nach Länge, dann i)', () => {
    const steps = cykW().steps;
    expect(steps.every((s) => s.explanation.key === 'proc.cyk.cell')).toBe(true);
    const order = steps.map((s) => [s.explanation.params.i, s.explanation.params.j]);
    expect(order).toEqual([
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
      [0, 2], [1, 3], [2, 4], [3, 5],
      [0, 3], [1, 4], [2, 5],
      [0, 4], [1, 5],
      [0, 5],
    ]);
  });

  it('Zerlegungen: D[1,4] über m = 2 mit E → Za V2; D[0,5] über m = 1 mit E → Z( V3 und F → Z( V3', () => {
    const step = (i: number, j: number) =>
      cykW().steps.find((s) => s.explanation.params.i === i && s.explanation.params.j === j);
    const s14 = step(1, 4)?.explanation.params.splits as { m: number; production: string }[];
    expect(s14).toContainEqual({ m: 2, production: idOf(cnf35(), 'E -> Za V2') });
    const s05 = step(0, 5)?.explanation.params.splits as { m: number; production: string }[];
    expect(s05).toContainEqual({ m: 1, production: idOf(cnf35(), 'E -> Z( V3') });
    expect(s05).toContainEqual({ m: 1, production: idOf(cnf35(), 'F -> Z( V3') });
  });
});

describe('CYK 6.38: Markierungen (Produktion und Trennstelle)', () => {
  const markStr = (c: CykCell): string[] =>
    c.marks.map((m) => `${pstr(prodOf(cnf35(), m.production))}@${m.split ?? '-'}`).sort();

  const expected: [number, number, string[]][] = [
    [0, 1, ['Z( -> (@-']],
    [1, 2, ['Za -> a@-']],
    [2, 3, ['Z+ -> +@-']],
    [3, 4, ['Za -> a@-']],
    [4, 5, ['Z) -> )@-']],
    [2, 4, ['V2 -> Z+ Za@3']],
    [3, 5, ['V5 -> Za Z)@4']],
    [1, 4, ['E -> Za V2@2']],
    [1, 5, ['V3 -> E Z)@4']],
    // Laut CNF auch F → Z( V3 (6.38 nennt nur E; vgl. Abb. 6.2).
    [0, 5, ['E -> Z( V3@1', 'F -> Z( V3@1']],
  ];

  for (const [i, j, marks] of expected) {
    it(`Marks D[${i},${j}]`, () => {
      expect(cellOf(cykR(), i, j).marks.length).toBe(marks.length);
      expect(markStr(cellOf(cykR(), i, j))).toEqual(sorted(marks));
    });
  }

  it('leere Zellen haben keine Marks', () => {
    for (const [i, j] of [[0, 2], [1, 3], [0, 3], [2, 5], [0, 4]] as const) {
      expect(cellOf(cykR(), i, j).marks).toEqual([]);
    }
  });
});

describe('CYK: Ableitungsbaum (cykTree, 8.4)', () => {
  it('D[0,5] für E: Wurzelproduktion E → Z( V3, Blätter ergeben (a+a)', () => {
    const t = cykTree(cnf35(), cykR(), 0, 5, 'E') as DerivTree;
    expect(t).not.toBeNull();
    expect(treeYield(t)).toEqual(W('(a+a)'));
    expect(t.sym).toBe('E');
    expect(t.production).toBe(idOf(cnf35(), 'E -> Z( V3'));
  });

  it('Teilbaum D[1,4] für E ergibt a+a', () => {
    const t = cykTree(cnf35(), cykR(), 1, 4, 'E') as DerivTree;
    expect(t).not.toBeNull();
    expect(treeYield(t)).toEqual(W('a+a'));
  });

  it('Z( ∉ D[0,5]: null', () => {
    expect(cykTree(cnf35(), cykR(), 0, 5, 'Z(')).toBeNull();
  });
});

describe('CYK: Annahme und Voraussetzung', () => {
  it('Wort (a+) wird abgelehnt', () => {
    expect(ok(cyk(cnf35(), W('(a+)'))).accepted).toBe(false);
  });

  it('G32 ist nicht CNF: cnf.notCnf', () => {
    const res = cyk(G32, W('(a+a)'));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.diagnostics.map((d) => d.code)).toContain('cnf.notCnf');
  });
});

// ---------------------------------------------------------------------------
// Earley (6.39–6.44)

/** Item als Text „S -> A • X @0“ (Punkt nach dem Präfix, @ Ursprung i). */
function itemText(g: Grammar, it: { production: string; dot: number; origin: number }): string {
  const p = prodOf(g, it.production);
  const rhs = [...p.right.slice(0, it.dot), '•', ...p.right.slice(it.dot)];
  return `${str(p.left)} -> ${rhs.join(' ')} @${it.origin}`;
}

const earleyABC = lazy(() => earley(G44, W('abc')));
const earleyR = lazy(() => ok(earleyABC()));

describe('Earley 6.44: Itemmengen S0 … S3 für abc', () => {
  it('akzeptiert abc', () => {
    expect(earleyR().accepted).toBe(true);
    expect(earleyR().word).toEqual(W('abc'));
  });

  it('Itemmengen als Mengen wie in 6.44', () => {
    const got = earleyR().sets.map((set) => sorted(set.map((it) => itemText(G44, it))));
    expect(got).toEqual([
      sorted(['S -> • A X @0', 'A -> • a @0']),
      sorted(['S -> A • X @0', 'X -> • B C @1', 'B -> • b @1', 'A -> a • @0']),
      sorted(['X -> B • C @1', 'C -> • c @2', 'B -> b • @1']),
      sorted(['S -> A X • @0', 'X -> B C • @1', 'C -> c • @2']),
    ]);
  });

  it('Regel und auslösende Items je Item wie in 6.44 (Lexer, Completer, Predictor)', () => {
    const sets = earleyR().sets;
    const inSet = (it: EarleyItem, j: number) => `${itemText(G44, it)} in S${j}`;
    const got = sets
      .flatMap((set, j) =>
        set.map((it) => ({
          key: inSet(it, j),
          rule: it.rule,
          causes: sorted(it.cause.map(([m, k]) => inSet(sets[m]?.[k] as EarleyItem, m))),
        })),
      )
      .sort((a, b) => (a.key < b.key ? -1 : 1));
    const expected = [
      { key: 'S -> • A X @0 in S0', rule: 'init', causes: [] },
      { key: 'A -> • a @0 in S0', rule: 'predictor', causes: ['S -> • A X @0 in S0'] },
      { key: 'A -> a • @0 in S1', rule: 'lexer', causes: ['A -> • a @0 in S0'] },
      { key: 'S -> A • X @0 in S1', rule: 'completer', causes: sorted(['A -> a • @0 in S1', 'S -> • A X @0 in S0']) },
      { key: 'X -> • B C @1 in S1', rule: 'predictor', causes: ['S -> A • X @0 in S1'] },
      { key: 'B -> • b @1 in S1', rule: 'predictor', causes: ['X -> • B C @1 in S1'] },
      { key: 'B -> b • @1 in S2', rule: 'lexer', causes: ['B -> • b @1 in S1'] },
      { key: 'X -> B • C @1 in S2', rule: 'completer', causes: sorted(['B -> b • @1 in S2', 'X -> • B C @1 in S1']) },
      { key: 'C -> • c @2 in S2', rule: 'predictor', causes: ['X -> B • C @1 in S2'] },
      { key: 'C -> c • @2 in S3', rule: 'lexer', causes: ['C -> • c @2 in S2'] },
      { key: 'X -> B C • @1 in S3', rule: 'completer', causes: sorted(['C -> c • @2 in S3', 'X -> B • C @1 in S2']) },
      { key: 'S -> A X • @0 in S3', rule: 'completer', causes: sorted(['X -> B C • @1 in S3', 'S -> A • X @0 in S1']) },
    ].sort((a, b) => (a.key < b.key ? -1 : 1));
    expect(got).toEqual(expected);
  });

  it('Schritte: je hinzugefügtem Item ein Schritt proc.earley.item (12 Items)', () => {
    expect(earleyABC().steps.filter((s) => s.explanation.key === 'proc.earley.item').length).toBe(12);
  });

  it('abd wird abgelehnt', () => {
    expect(ok(earley(G44, W('abd'))).accepted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// LR (6.45–6.57)

/** Zustandsmengen aus 6.53 (Kern + Hülle, ⊣ und ⊢ als Terminale). */
const EXPECTED_STATES: Record<string, string[]> = {
  z0: ["S' -> ⊣ • E ⊢", 'E -> • E + T', 'E -> • T', 'T -> • T * F', 'T -> • F', 'F -> • ( E )', 'F -> • a'],
  z1: ["S' -> ⊣ E • ⊢", 'E -> E • + T'],
  z2: ['E -> T •', 'T -> T • * F'],
  z3: ['T -> F •'],
  z4: ['F -> a •'],
  z5: ['F -> ( • E )', 'E -> • E + T', 'E -> • T', 'T -> • T * F', 'T -> • F', 'F -> • ( E )', 'F -> • a'],
  z7: ['E -> E + • T', 'T -> • T * F', 'T -> • F', 'F -> • ( E )', 'F -> • a'],
  z8: ["S' -> ⊣ E ⊢ •"],
  z9: ['T -> T * • F', 'F -> • ( E )', 'F -> • a'],
  z10: ['F -> ( E • )', 'E -> E • + T'],
  z11: ['E -> E + T •', 'T -> T • * F'],
  z12: ['T -> T * F •'],
  z13: ['F -> ( E ) •'],
};

/** goto-Tabelle 6.55 ohne Fehlereinträge (z6 = Fehlerzustand, leer). */
const EXPECTED_GOTO = [
  'z0|E|z1', 'z0|T|z2', 'z0|F|z3', 'z0|a|z4', 'z0|(|z5',
  'z1|+|z7', 'z1|⊢|z8',
  'z2|*|z9',
  'z5|E|z10', 'z5|T|z2', 'z5|F|z3', 'z5|a|z4', 'z5|(|z5',
  'z7|T|z11', 'z7|F|z3', 'z7|a|z4', 'z7|(|z5',
  'z9|F|z12', 'z9|a|z4', 'z9|(|z5',
  'z10|)|z13', 'z10|+|z7',
  'z11|*|z9',
];

/** Nummern aus Tabelle 6.1 (Nummern nach 6.50) für die Zustände nach 6.53. */
const NUM_6_1: Record<string, number> = {
  z0: 0, z1: 1, z10: 2, z7: 3, z11: 4, z2: 5, z9: 6, z12: 7, z3: 8, z5: 9, z13: 10, z4: 11,
};

/** Itemtext eines LR-Items; das Hilfsitem '__start' heißt S'. */
function lrItemText(a: LrAutomaton, it: LrItem): string {
  const p = a.augmented.productions.find((q) => q.id === it.production);
  if (!p) throw new Error(`Produktion ${it.production} unbekannt`);
  const left = it.production === '__start' ? "S'" : str(p.left);
  const rhs = [...p.right.slice(0, it.dot), '•', ...p.right.slice(it.dot)];
  return `${left} -> ${rhs.join(' ')}`;
}

const sigOf = (lines: string[]): string => sorted(lines).join(' || ');

/** Zuordnung Zustandsnummer der Konstruktion → z0 … z13 über die Itemmengen. */
function labelsOf(a: LrAutomaton): Map<number, string> {
  const bySig = new Map(Object.entries(EXPECTED_STATES).map(([k, v]) => [sigOf(v), k]));
  return new Map(
    a.states.map((s) => [s.id, bySig.get(sigOf(s.items.map((it) => lrItemText(a, it)))) ?? `?${s.id}`]),
  );
}

const lr0 = lazy(() => ok(lrAutomaton(G45, 'LR0')));
const lalr = lazy(() => ok(lrAutomaton(G45, 'LALR1')));

describe('LR 6.53: Zustände (Umbenennung erlaubt)', () => {
  it('LR(0): 13 Zustände, Itemmengen z0 … z13 (z6 ist Fehlerzustand, kein Zustand)', () => {
    const a = lr0();
    expect(a.states.length).toBe(13);
    expect(sorted([...labelsOf(a).values()])).toEqual(sorted(Object.keys(EXPECTED_STATES)));
  });

  it('LALR(1): dieselben 13 Zustände und Kerne', () => {
    const a = lalr();
    expect(a.states.length).toBe(13);
    expect(sorted([...labelsOf(a).values()])).toEqual(sorted(Object.keys(EXPECTED_STATES)));
  });

  it('Schritte: je neuem Zustand ein Schritt proc.lr.state (13)', () => {
    const res = lrAutomaton(G45, 'LALR1');
    expect(res.steps.filter((s) => s.explanation.key === 'proc.lr.state').length).toBe(13);
  });
});

describe('LR 6.55: goto-Tabelle bis auf Umbenennung', () => {
  for (const [name, get] of [['LR(0)', lr0], ['LALR(1)', lalr]] as const) {
    it(`${name}: goto(z, X) wie 6.55 (ohne Fehlereinträge)`, () => {
      const a = get();
      const lab = labelsOf(a);
      const got = a.goto.map((g) => `${lab.get(g.from)}|${g.symbol}|${lab.get(g.to)}`).sort();
      expect(got).toEqual(sorted(EXPECTED_GOTO));
    });
  }
});

describe('LR: Aktionen (LALR(1), Vorausschau)', () => {
  const actText = (state: string, sym: string): string[] => {
    const a = lalr();
    const lab = labelsOf(a);
    const id = [...lab].find(([, v]) => v === state)?.[0];
    return (a.actions[id as number]?.[sym] ?? []).map((x) => {
      if (x.kind === 'shift') return `shift ${lab.get(x.to)}`;
      if (x.kind === 'reduce') return `reduce ${pstr(prodOf(a.augmented, x.production))}`;
      return 'accept';
    });
  };

  const cases: [string, string, string[]][] = [
    ['z0', '(', ['shift z5']],
    ['z0', 'a', ['shift z4']],
    ['z1', '⊢', ['accept']],
    ['z1', '+', ['shift z7']],
    ['z2', '*', ['shift z9']],
    ['z2', '+', ['reduce E -> T']],
    ['z2', ')', ['reduce E -> T']],
    ['z2', '⊢', ['reduce E -> T']],
    ['z4', ')', ['reduce F -> a']],
    ['z4', '+', ['reduce F -> a']],
    ['z4', '*', ['reduce F -> a']],
    ['z4', '⊢', ['reduce F -> a']],
    ['z4', '(', []],
    ['z4', 'a', []],
    ['z11', '*', ['shift z9']],
    ['z11', '+', ['reduce E -> E + T']],
    ['z13', ')', ['reduce F -> ( E )']],
  ];
  for (const [state, sym, want] of cases) {
    it(`act(${state}, ${sym}) = ${want.join(' / ') || 'error'}`, () => {
      expect(actText(state, sym)).toEqual(want);
    });
  }

  it('LALR(1) hat keinen Konflikt', () => {
    expect(lalr().conflicts).toEqual([]);
  });

  it('LR(0) hat Shift/Reduce-Konflikte am Symbol * in z2 und z11', () => {
    const a = lr0();
    const lab = labelsOf(a);
    const cs = a.conflicts.map((c) => `${lab.get(c.state)}/${c.symbol}`).sort();
    expect(cs).toEqual(['z11/*', 'z2/*']);
    for (const c of a.conflicts) {
      expect(c.actions.map((x) => x.kind).sort()).toEqual(['reduce', 'shift']);
    }
  });
});

// ---------------------------------------------------------------------------
// LR-Lauf: Tabelle 6.1, Eingabe (a+a)*a

describe('LR-Lauf: Tabelle 6.1 für (a+a)*a', () => {
  const run = () => lrRun(lalr(), W('(a+a)*a'));

  /** Erwartete Zeilen nach Tabelle 6.1 (Zustände nach 6.50); Aktion: s<Ziel>, r <Produktion>, acc. */
  const expected: { stack: (number | string)[]; rest: string; action: string }[] = [
    { stack: [0, '⊣'], rest: '(a+a)*a⊢', action: 's9' },
    { stack: [0, '⊣', 9, '('], rest: 'a+a)*a⊢', action: 's11' },
    { stack: [0, '⊣', 9, '(', 11, 'a'], rest: '+a)*a⊢', action: 'r F -> a' },
    { stack: [0, '⊣', 9, '(', 8, 'F'], rest: '+a)*a⊢', action: 'r T -> F' },
    { stack: [0, '⊣', 9, '(', 5, 'T'], rest: '+a)*a⊢', action: 'r E -> T' },
    { stack: [0, '⊣', 9, '(', 2, 'E'], rest: '+a)*a⊢', action: 's3' },
    { stack: [0, '⊣', 9, '(', 2, 'E', 3, '+'], rest: 'a)*a⊢', action: 's11' },
    { stack: [0, '⊣', 9, '(', 2, 'E', 3, '+', 11, 'a'], rest: ')*a⊢', action: 'r F -> a' },
    { stack: [0, '⊣', 9, '(', 2, 'E', 3, '+', 8, 'F'], rest: ')*a⊢', action: 'r T -> F' },
    { stack: [0, '⊣', 9, '(', 2, 'E', 3, '+', 4, 'T'], rest: ')*a⊢', action: 'r E -> E + T' },
    { stack: [0, '⊣', 9, '(', 2, 'E'], rest: ')*a⊢', action: 's10' },
    { stack: [0, '⊣', 9, '(', 2, 'E', 10, ')'], rest: '*a⊢', action: 'r F -> ( E )' },
    { stack: [0, '⊣', 8, 'F'], rest: '*a⊢', action: 'r T -> F' },
    { stack: [0, '⊣', 5, 'T'], rest: '*a⊢', action: 's6' },
    { stack: [0, '⊣', 5, 'T', 6, '*'], rest: 'a⊢', action: 's11' },
    { stack: [0, '⊣', 5, 'T', 6, '*', 11, 'a'], rest: '⊢', action: 'r F -> a' },
    { stack: [0, '⊣', 5, 'T', 6, '*', 7, 'F'], rest: '⊢', action: 'r T -> T * F' },
    { stack: [0, '⊣', 5, 'T'], rest: '⊢', action: 'r E -> T' },
    { stack: [0, '⊣', 1, 'E'], rest: '⊢', action: 'acc' },
  ];

  it('akzeptiert (a+a)*a', () => {
    expect(run().accepted).toBe(true);
  });

  it('19 Zeilen', () => {
    expect(run().rows.length).toBe(expected.length);
  });

  it('Keller, Rest und Aktion je Zeile wie Tabelle 6.1', () => {
    const a = lalr();
    const lab = labelsOf(a);
    const num = (x: number | string): number | string =>
      typeof x === 'number' ? (NUM_6_1[lab.get(x) ?? ''] ?? `?${x}`) : x;
    const actStr = (act: unknown): string => {
      const x = act as { kind?: string; to?: number; production?: string } | null;
      if (!x) return 'null';
      if (x.kind === 'shift') return `s${NUM_6_1[lab.get(x.to as number) ?? ''] ?? '?'}`;
      if (x.kind === 'reduce') return `r ${pstr(prodOf(a.augmented, x.production as string))}`;
      if (x.kind === 'accept') return 'acc';
      return String(x.kind);
    };
    const got = run().rows.map((row) => ({
      stack: row.stack.map(num),
      rest: row.rest.join(''),
      action: actStr(row.action),
    }));
    expect(got).toEqual(expected);
  });

  it('Aktionsart je Zeile: S S R R R S S R R R S R R S S R R R acc', () => {
    const a = lalr();
    const kinds = run().rows.map((row) => {
      const k = (row.action as { kind?: string } | null)?.kind;
      return k === 'shift' ? 'S' : k === 'reduce' ? 'R' : k === 'accept' ? 'acc' : String(k);
    });
    expect(kinds).toEqual(['S', 'S', 'R', 'R', 'R', 'S', 'S', 'R', 'R', 'R', 'S', 'R', 'R', 'S', 'S', 'R', 'R', 'R', 'acc']);
    expect(a.augmented.productions.length).toBeGreaterThan(0);
  });

  it('(a+) wird abgelehnt', () => {
    expect(lrRun(lalr(), W('(a+)')).accepted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Warnungen
// ProcResult mit ok:true trägt keine Diagnosen. cnf.scriptLiteral und lr.conflict (als Warnung)
// sind daher hier nicht prüfbar; die Konflikte selbst prüfen die Tests oben über LrAutomaton.conflicts.

describe('Abgelehnte Verfahren', () => {
  it('toCnf auf Typ 0: ok false (algo.notType2)', () => {
    const r = toCnf(T0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.diagnostics.map((d) => d.code)).toContain('algo.notType2');
  });
});
