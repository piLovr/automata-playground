// M2, Teil C Punkte 2, 4, 5: Verfahren an Skriptbeispielen, Erklärungsschlüssel, Grenzen.
// Erwartungen aus docs/kern-spec-m2.md (Teil B) und docs/skript-notizen-m2.md.
// Nur die öffentliche Schnittstelle core/index.ts.

import { describe, expect, it } from 'vitest';
import {
  EXPLANATION_KEYS,
  complement,
  deaToGrammar,
  deaToRegex,
  deaToRegexElim,
  enumerate,
  grammarToNea,
  grammarType,
  mealyToMoore,
  minimize,
  mooreToMealy,
  neaToDea,
  parseDocument,
  parseRegex,
  powerset,
  product,
  reachable,
  regexToGrammar,
  removeEpsilon,
  splitWords,
  thompson,
  validate,
} from '../index';
import type {
  DEA,
  FormalObject,
  Grammar,
  Mealy,
  Moore,
  NEA,
  ProcResult,
  ProcStep,
  RegexObj,
  StepTable,
  Word,
} from '../index';

// ---------------------------------------------------------------------------
// Hilfsfunktionen (Testseite)

function ok<R>(r: ProcResult<R>): R {
  if (!r.ok) throw new Error(`Verfahren ohne Ergebnis: ${r.diagnostics.map((d) => d.code).join(', ')}`);
  return r.result;
}

function parseOne(text: string): FormalObject {
  const r = parseDocument(text);
  expect(r.diagnostics, 'Diagnosen beim Parsen').toEqual([]);
  expect(r.doc.objects).toHaveLength(1);
  return r.doc.objects[0] as FormalObject;
}

/** Alle Wörter über `alpha` bis `maxLen`, nach Länge, dann lexikographisch (Alphabetreihenfolge). */
function wordsUpTo(alpha: string[], maxLen: number): string[] {
  const out: string[] = [];
  let level = [''];
  for (let n = 0; n <= maxLen; n++) {
    out.push(...level);
    level = level.flatMap((w) => alpha.map((x) => w + x));
  }
  return out;
}

const keyOf = (w: Word) => w.join('');
const sortedKeys = (words: Word[]) => words.map(keyOf).sort();
const count = (w: string, ch: string) => [...w].filter((c) => c === ch).length;

/** Klassen (IDs = Namen) in eine vergleichbare Form. */
const norm = (classes: string[][]) =>
  classes.map((c) => [...c].sort()).sort((a, b) => a.join(',').localeCompare(b.join(',')));

const nameMap = (o: { states: { id: string; name: string }[] }): Record<string, string> =>
  Object.fromEntries(o.states.map((s) => [s.id, s.name]));

function stepsWith(steps: ProcStep[], key: string) {
  return steps.filter((s) => s.explanation.key === key);
}

function checkSteps(steps: ProcStep[]) {
  expect(steps.length, 'Schrittliste leer').toBeGreaterThan(0);
  for (const s of steps) {
    expect(EXPLANATION_KEYS as readonly string[], `Schlüssel ${s.explanation.key}`).toContain(s.explanation.key);
    if (s.view.obj) {
      const errs = validate(s.view.obj).filter((d) => d.severity === 'error');
      expect(errs, `validate-Fehler in Schritt ${s.explanation.key}`).toEqual([]);
    }
  }
}

// ---------------------------------------------------------------------------
// Beispielobjekte

/** 2.92: ids = Namen, damit Klassen im Schritt direkt Namen sind. */
const DEA_292: DEA = (() => {
  const delta: [string, string, string][] = [
    ['A', 'a', 'B'], ['B', 'a', 'C'], ['C', 'a', 'D'], ['D', 'a', 'C'], ['E', 'a', 'E'], ['F', 'a', 'E'], ['G', 'a', 'G'],
    ['A', 'b', 'F'], ['B', 'b', 'E'], ['C', 'b', 'D'], ['D', 'b', 'D'], ['E', 'b', 'E'], ['F', 'b', 'G'], ['G', 'b', 'C'],
  ];
  return {
    kind: 'dea',
    name: 'M',
    alphabet: ['a', 'b'],
    states: ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n) => ({ id: n, name: n })),
    start: 'A',
    accept: ['C', 'D', 'G'],
    transitions: delta.map(([from, x, to]) => ({ id: `${from}-${x}`, from, to, label: x })),
  };
})();

/** 2.66 */
const N266 = parseOne(`nea N {
  alphabet 0 1
  states z0 z1 z2 z3 z4 z5
  start z0
  accept z2 z5
  z0 -ε-> z2
  z0 -ε-> z5
  z2 -01-> z2
  z5 -001-> z5
}`) as NEA;

/** NEA ohne ε und Wortkanten: (0|1)*1 */
const NEA_L = parseOne(`nea L {
  alphabet 0 1
  states z0 z1
  start z0
  accept z1
  z0 -0,1-> z0
  z0 -1-> z1
}`) as NEA;

/** Vier erreichbare Teilmengen in der Potenzmenge. */
const NEA_L3 = parseOne(`nea L3 {
  alphabet 0 1
  states z0 z1 z2
  start z0
  accept z2
  z0 -0,1-> z0
  z0 -1-> z1
  z1 -0,1-> z2
}`) as NEA;

/** Zwei Zustände, Parität der Nullen; F = {z1}. Odd-Nullen-Sprache. */
const DEA_PAR = parseOne(`dea Z {
  alphabet 0 1
  states z0 z1
  start z0
  accept z1
  z0 -0-> z1
  z0 -1-> z0
  z1 -0-> z0
  z1 -1-> z1
}`) as DEA;

/** Gleiche Parität, Zustandsreihenfolge z1 z0: Startzustand nicht Index 0 (proc.lk.order). */
const DEA_PAR_REV = parseOne(`dea Z {
  alphabet 0 1
  states z1 z0
  start z0
  accept z1
  z0 -0-> z1
  z0 -1-> z0
  z1 -0-> z0
  z1 -1-> z1
}`) as DEA;

/** Ungerade Anzahl Einsen. */
const DEA_ODD = parseOne(`dea P {
  alphabet 0 1
  states z0 z1
  start z0
  accept z1
  z0 -0-> z0
  z0 -1-> z1
  z1 -0-> z1
  z1 -1-> z0
}`) as DEA;

const DEA_UNREACH = parseOne(`dea R {
  alphabet 0 1
  states z0 z1 z2
  start z0
  accept z1 z2
  z0 -0-> z1
  z0 -1-> z0
  z1 -0-> z0
  z1 -1-> z1
  z2 -0,1-> z2
}`) as DEA;

const REG = parseOne('regex R = (0|1)*01') as RegexObj;

const G244 = parseOne(`grammatik G244 {
  nichtterminale X0 X1 X2 X3 X4 X5 X6 X7
  terminale 0 1 - . E
  start X0
  X0 -> -X1 | X1
  X1 -> 0X2 | 1X2
  X2 -> 0X2 | 1X2 | ε | X3
  X3 -> .0X4 | .1X4 | X5
  X4 -> 0X4 | 1X4 | ε | X5
  X5 -> E-X6 | EX6
  X6 -> 0X7 | 1X7
  X7 -> 0X7 | 1X7 | ε
}`) as Grammar;

const MEALY: Mealy = {
  kind: 'mealy',
  name: 'Mealy',
  alphabet: ['0', '1'],
  outputAlphabet: ['x', 'y'],
  states: [
    { id: 'z0', name: 'z0' },
    { id: 'z1', name: 'z1' },
  ],
  start: 'z0',
  accept: [],
  transitions: [
    { id: 't0', from: 'z0', to: 'z1', label: { in: '0', out: 'x' } },
    { id: 't1', from: 'z0', to: 'z0', label: { in: '1', out: 'y' } },
    { id: 't2', from: 'z1', to: 'z0', label: { in: '0', out: 'y' } },
    { id: 't3', from: 'z1', to: 'z1', label: { in: '1', out: 'x' } },
  ],
};

const MOORE: Moore = {
  kind: 'moore',
  name: 'Moore',
  alphabet: ['0', '1'],
  outputAlphabet: ['x', 'y'],
  states: [
    { id: 'z0', name: 'z0', out: 'x' },
    { id: 'z1', name: 'z1', out: 'y' },
  ],
  start: 'z0',
  accept: [],
  transitions: [
    { id: 't0', from: 'z0', to: 'z1', label: '0' },
    { id: 't1', from: 'z0', to: 'z0', label: '1' },
    { id: 't2', from: 'z1', to: 'z0', label: '0' },
    { id: 't3', from: 'z1', to: 'z1', label: '1' },
  ],
};

const split266 = () => ok(splitWords(N266));

// ---------------------------------------------------------------------------
// Punkt 2a: 2.92 Runde für Runde und Ergebnis

describe('2.92 Minimierung: Runde für Runde', () => {
  const res = minimize(DEA_292);
  const steps = res.steps;

  it('Verfahren liefert ein Ergebnis', () => {
    expect(res.ok).toBe(true);
  });

  it('≡0 = {CDG}{ABEF}', () => {
    const eq0 = stepsWith(steps, 'proc.min.eq0');
    expect(eq0.length).toBeGreaterThan(0);
    const classes = eq0[0]!.explanation.params.classes as string[][];
    expect(norm(classes)).toEqual(norm([['A', 'B', 'E', 'F'], ['C', 'D', 'G']]));
  });

  it('≡1 = {AE}{B}{F}{CDG}, zerfallen ist {ABEF}', () => {
    const r1 = stepsWith(steps, 'proc.min.round').find((s) => s.explanation.params.round === 1);
    expect(r1).toBeDefined();
    expect(norm(r1!.explanation.params.classes as string[][])).toEqual(
      norm([['A', 'E'], ['B'], ['F'], ['C', 'D', 'G']]),
    );
    expect(norm(r1!.explanation.params.split as string[][])).toEqual(norm([['A', 'B', 'E', 'F']]));
  });

  it('≡2 = {A}{B}{E}{F}{CDG}, zerfallen ist {AE}', () => {
    const r2 = stepsWith(steps, 'proc.min.round').find((s) => s.explanation.params.round === 2);
    expect(r2).toBeDefined();
    expect(norm(r2!.explanation.params.classes as string[][])).toEqual(
      norm([['A'], ['B'], ['E'], ['F'], ['C', 'D', 'G']]),
    );
    expect(norm(r2!.explanation.params.split as string[][])).toEqual(norm([['A', 'E']]));
  });

  it('Abbruch: ≡3 = ≡2 erzeugt proc.min.stable', () => {
    expect(stepsWith(steps, 'proc.min.stable').length).toBeGreaterThan(0);
  });

  it('Ergebnis: 5 Zustände in Reihenfolge A, B, CDG, E, F', () => {
    const r = ok(res);
    expect(r.states.map((s) => s.name)).toEqual(['A', 'B', 'CDG', 'E', 'F']);
  });

  it('Ergebnis: Start [A], Endzustand [CDG]', () => {
    const r = ok(res);
    const nm = nameMap(r);
    expect(nm[r.start!]).toBe('A');
    expect(r.accept.map((id) => nm[id])).toEqual(['CDG']);
  });

  it('Ergebnis: Übergänge wie in der Tabelle 2.92', () => {
    const r = ok(res);
    const nm = nameMap(r);
    const delta = Object.fromEntries(r.transitions.map((t) => [`${nm[t.from]}-${t.label}`, nm[t.to]]));
    expect(delta).toEqual({
      'A-a': 'B',
      'A-b': 'F',
      'B-a': 'CDG',
      'B-b': 'E',
      'CDG-a': 'CDG',
      'CDG-b': 'CDG',
      'E-a': 'E',
      'E-b': 'E',
      'F-a': 'E',
      'F-b': 'CDG',
    });
  });

  it('Ergebnis ist minimal: nochmals minimieren ändert die Zahl nicht', () => {
    const r = ok(res);
    expect(ok(minimize(r)).states).toHaveLength(5);
  });

  it('Ergebnis akzeptiert dieselbe Sprache wie M (bis Länge 6)', () => {
    const r = ok(res);
    expect(sortedKeys(enumerate(r, 6))).toEqual(sortedKeys(enumerate(DEA_292, 6)));
  });
});

// ---------------------------------------------------------------------------
// Punkt 2b: 2.66 NEA → DEA

describe('2.66 NEA → DEA (neaToDea)', () => {
  const r = neaToDea(N266);
  const L266 = (w: string) => /^(?:01)*$/.test(w) || /^(?:001)*$/.test(w);

  it('Verfahren liefert einen DEA', () => {
    const d = ok(r);
    expect(d.kind).toBe('dea');
  });

  it('akzeptiert genau (01)*|(001)*, bis Länge 8 (Reihenfolge Länge, dann lexikographisch)', () => {
    const d = ok(r);
    const expected = wordsUpTo(['0', '1'], 8).filter(L266);
    expect(enumerate(d, 8).map(keyOf)).toEqual(expected);
  });

  it('Ergebnis ist total: jeder Zustand hat je Symbol genau einen Übergang', () => {
    const d = ok(r);
    for (const s of d.states) {
      for (const x of d.alphabet) {
        expect(d.transitions.filter((t) => t.from === s.id && t.label === x)).toHaveLength(1);
      }
    }
  });

  it('phases 1, 2, 3 in dieser Reihenfolge', () => {
    const phases = stepsWith(r.steps, 'proc.phase').map((s) => s.explanation.params.phase);
    expect(phases).toEqual([1, 2, 3]);
  });

  it('neaToDea über neaToDea(NEA) ohne Schritte ist dasselbe Ergebnis (Sprache)', () => {
    const quick = ok(neaToDea(N266, { steps: false }));
    expect(enumerate(quick, 8).map(keyOf)).toEqual(enumerate(ok(r), 8).map(keyOf));
  });
});

// ---------------------------------------------------------------------------
// Punkt 2c: Teilschritte 2.71 und 2.72, Potenzmenge 2.74

describe('2.71 / 2.72 / 2.74 Teilschritte', () => {
  it('splitWords (2.71): keine Kante mit |w| ≥ 2, Sprache bleibt', () => {
    const n = ok(splitWords(N266));
    expect(n.transitions.every((t) => t.label.length <= 1)).toBe(true);
    expect(sortedKeys(enumerate(n, 8))).toEqual(sortedKeys(enumerate(N266, 8)));
  });

  it('removeEpsilon (2.72): keine ε-Kanten mehr, Sprache bleibt', () => {
    const n = ok(removeEpsilon(split266()));
    expect(n.transitions.some((t) => t.label.length === 0)).toBe(false);
    expect(sortedKeys(enumerate(n, 8))).toEqual(sortedKeys(enumerate(N266, 8)));
  });

  it('powerset (2.74) nur erreichbare Teilmengen: (0|1)*1 hat 2 Zustände', () => {
    const d = ok(powerset(NEA_L));
    expect(d.states).toHaveLength(2);
    expect(sortedKeys(enumerate(d, 5))).toEqual(
      wordsUpTo(['0', '1'], 5)
        .filter((w) => w.endsWith('1'))
        .sort(),
    );
  });

  it('powerset mit fullPowerset: alle 2^2 = 4 Teilmengen, ∅ ist Zustand', () => {
    const d = ok(powerset(NEA_L, { fullPowerset: true }));
    expect(d.states).toHaveLength(4);
    expect(d.states.map((s) => s.name)).toContain('∅');
  });

  it('powerset: proc.pow.row-Schritte vorhanden', () => {
    expect(stepsWith(powerset(NEA_L).steps, 'proc.pow.row').length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Punkt 2d: 2.30 DEA → Ausdruck, Tabelle k = 0, 1, 2

describe('2.30 DEA → Ausdruck (Tabelle k = 0, 1, 2)', () => {
  const r = deaToRegex(DEA_PAR);
  const steps = r.steps;

  /** Erwartete Sprachen der Zellen bis Länge 3 (von Hand aus 2.29/2.30). */
  const EVEN = ['', '1', '11', '00', '111', '001', '010', '100'];
  const ODD = ['0', '01', '10', '011', '101', '110', '000'];
  const EXPECTED: Record<number, string[][][]> = {
    // k = 0: L^0_00 = {ε,1}, L^0_01 = {0}, L^0_10 = {0}, L^0_11 = {ε,1}
    0: [
      [['', '1'], ['0']],
      [['0'], ['', '1']],
    ],
    // k = 1: L^1_00 = 1*, L^1_01 = 1*0, L^1_10 = 01*, L^1_11 = {ε,1} ∪ 01*0
    1: [
      [['', '1', '11', '111'], ['0', '10', '110']],
      [['0', '01', '011'], ['', '1', '00', '010']],
    ],
    // k = 2: volle Pfade = Paritäten der Nullen
    2: [
      [EVEN, ODD],
      [ODD, EVEN],
    ],
  };

  function tableAt(k: number): StepTable | undefined {
    if (k === 0) return stepsWith(steps, 'proc.lk.base')[0]?.view.table;
    return stepsWith(steps, 'proc.lk.round').find((s) => s.explanation.params.k === k)?.view.table;
  }

  function cellWords(cell: string): string[] {
    const p = parseRegex(cell, ['0', '1']);
    expect(p.diagnostics, `Zelle ${cell}`).toEqual([]);
    const obj: RegexObj = { kind: 'regex', name: 'c', alphabet: ['0', '1'], expr: p.expr };
    return enumerate(obj, 3).map(keyOf).sort();
  }

  for (const k of [0, 1, 2]) {
    it(`Tabelle k = ${k}: Zellen entsprechen der Hand-Erwartung (Wörter bis Länge 3)`, () => {
      const t = tableAt(k);
      expect(t, `Tabelle für k=${k} fehlt`).toBeDefined();
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          expect(cellWords(t!.cells[i]![j]!), `Zelle [${i}][${j}] bei k=${k}`).toEqual(
            [...EXPECTED[k]![i]![j]!].sort(),
          );
        }
      }
    });
  }

  it('Ergebnis ok und Sprache = ungerade Anzahl Nullen (bis Länge 6)', () => {
    const res = ok(r);
    expect(sortedKeys(enumerate(res, 6))).toEqual(
      wordsUpTo(['0', '1'], 6)
        .filter((w) => count(w, '0') % 2 === 1)
        .sort(),
    );
  });

  it('Schritte: proc.lk.base, proc.lk.round (k = 1, 2), proc.lk.result', () => {
    expect(stepsWith(steps, 'proc.lk.base').length).toBe(1);
    const ks = stepsWith(steps, 'proc.lk.round').map((s) => s.explanation.params.k);
    expect(ks).toEqual([1, 2]);
    expect(stepsWith(steps, 'proc.lk.result').length).toBe(1);
  });

  it('ohne Vereinfachung (simplify false): gleiche Sprache', () => {
    const res = ok(deaToRegex(DEA_PAR, { simplify: false, steps: false }));
    expect(sortedKeys(enumerate(res, 6))).toEqual(sortedKeys(enumerate(ok(r), 6)));
  });

  it('Startzustand nicht Index 0: proc.lk.order, Sprache bleibt', () => {
    const rr = deaToRegex(DEA_PAR_REV);
    expect(stepsWith(rr.steps, 'proc.lk.order').length).toBeGreaterThan(0);
    expect(sortedKeys(enumerate(ok(rr), 6))).toEqual(sortedKeys(enumerate(ok(r), 6)));
  });

  it('Zustandselimination (nicht im Skript): gleiche Sprache', () => {
    const res = ok(deaToRegexElim(DEA_PAR));
    expect(sortedKeys(enumerate(res, 6))).toEqual(sortedKeys(enumerate(ok(r), 6)));
  });
});

// ---------------------------------------------------------------------------
// Punkt 2e: 2.69 auf 2.44

describe('2.69 Typ-3-Grammatik → NEA auf 2.44', () => {
  const G_REF = /^-?[01]+(\.[01]+)?(E-?[01]+)?$/;
  const alphabet = ['0', '1', '-', '.', 'E'];
  const reference = wordsUpTo(alphabet, 6).filter((w) => G_REF.test(w)).sort();

  it('2.44 ist Typ 3', () => {
    expect(grammarType(G244).type).toBe(3);
  });

  it('grammarToNea: 8 Nichtterminale → 9 Zustände, Start zX0, Endzustand zf', () => {
    const n = ok(grammarToNea(G244));
    expect(n.states).toHaveLength(9);
    const nm = nameMap(n);
    expect(nm[n.start!]).toBe('zX0');
    expect(n.accept.map((id) => nm[id])).toEqual(['zf']);
  });

  it('Sprache des NEA bis Länge 6 = Gleitkomma-Sprache der Grammatik', () => {
    const n = ok(grammarToNea(G244));
    expect(sortedKeys(enumerate(n, 6))).toEqual(reference);
  });

  it('Sprache der Grammatik bis Länge 6 = Gleitkomma-Sprache', () => {
    expect(sortedKeys(enumerate(G244, 6))).toEqual(reference);
  });
});

// ---------------------------------------------------------------------------
// Punkt 2f: 2.49/2.50 DEA → Typ-3-Grammatik

describe('2.49/2.50 DEA → Typ-3-Grammatik', () => {
  const g = ok(deaToGrammar(DEA_ODD));
  const prodStr = (p: { left: string[]; right: string[] }) =>
    `${p.left.join('')} -> ${p.right.join('') || 'ε'}`;

  it('N = {Xz0, Xz1}, T = {0,1}, S = Xz0', () => {
    expect([...g.nonterminals].sort()).toEqual(['Xz0', 'Xz1']);
    expect([...g.terminals].sort()).toEqual(['0', '1']);
    expect(g.start).toBe('Xz0');
  });

  it('P: Xz → xXz\' für f(z,x)=z\', Xz → ε für z ∈ F', () => {
    expect(g.productions.map(prodStr).sort()).toEqual(
      ['Xz0 -> 0Xz0', 'Xz0 -> 1Xz1', 'Xz1 -> 0Xz1', 'Xz1 -> 1Xz0', 'Xz1 -> ε'].sort(),
    );
  });

  it('Sprache = Sprache des DEA (ungerade Einsen) bis Länge 5', () => {
    const expected = wordsUpTo(['0', '1'], 5)
      .filter((w) => count(w, '1') % 2 === 1)
      .sort();
    expect(sortedKeys(enumerate(g, 5))).toEqual(expected);
    expect(sortedKeys(enumerate(DEA_ODD, 5))).toEqual(expected);
  });
});

describe('2.49/2.50 auf DEA 2.14 (examples/b2-14.txt)', () => {
  const dea = parseOne(`dea B2_14 {
  alphabet 0 1
  start A
  accept A B
  A -0-> A
  A -1-> B
  B -1-> B
  B -0-> C
  C -0,1-> C
}`) as DEA;
  const g = ok(deaToGrammar(dea));
  const prodStr = (p: { left: string[]; right: string[] }) =>
    `${p.left.join('')} -> ${p.right.join('') || 'ε'}`;

  it('Produktionen: X_z → x X_z\' je Übergang, X_z → ε je Endzustand', () => {
    expect(g.productions.map(prodStr).sort()).toEqual(
      [
        'XA -> 0XA', 'XA -> 1XB', 'XB -> 1XB', 'XB -> 0XC',
        'XC -> 0XC', 'XC -> 1XC', 'XA -> ε', 'XB -> ε',
      ].sort(),
    );
  });

  it('Sprache gleich (0*1*) bis Länge 6', () => {
    const expected = wordsUpTo(['0', '1'], 6).filter((w) => /^0*1*$/.test(w)).sort();
    expect(sortedKeys(enumerate(dea, 6))).toEqual(expected);
    expect(sortedKeys(enumerate(g, 6))).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// Punkt 2g: Mealy/Moore und Erreichbarkeit

describe('Erreichbarkeit (2.82) und Mealy/Moore', () => {
  it('reachable entfernt z2 (unerreichbar), Sprache bleibt', () => {
    const r = ok(reachable(DEA_UNREACH));
    expect(r.states.map((s) => s.name).sort()).toEqual(['z0', 'z1']);
    expect(sortedKeys(enumerate(r, 5))).toEqual(sortedKeys(enumerate(DEA_UNREACH, 5)));
  });

  it('mealyToMoore: Ergebnis ist ein Moore-Automat', () => {
    expect(ok(mealyToMoore(MEALY)).kind).toBe('moore');
  });

  it('mooreToMealy: Ergebnis ist ein Mealy-Automat', () => {
    expect(ok(mooreToMealy(MOORE)).kind).toBe('mealy');
  });
});

// ---------------------------------------------------------------------------
// Punkt 4: jeder Schritt

const CASES: [string, () => ProcResult<unknown>][] = [
  ['nea2dea (neaToDea)', () => neaToDea(N266)],
  ['splitWords', () => splitWords(N266)],
  ['removeEpsilon', () => removeEpsilon(split266())],
  ['powerset', () => powerset(NEA_L)],
  ['powerset (fullPowerset)', () => powerset(NEA_L, { fullPowerset: true })],
  ['dea2regex', () => deaToRegex(DEA_PAR)],
  ['dea2regexElim', () => deaToRegexElim(DEA_PAR)],
  ['regex2grammar', () => regexToGrammar(REG)],
  ['grammar2nea', () => grammarToNea(G244)],
  ['dea2grammar', () => deaToGrammar(DEA_ODD)],
  ['thompson', () => thompson(REG)],
  ['complement', () => complement(DEA_PAR)],
  ['intersection', () => product(DEA_PAR, DEA_ODD, 'intersection')],
  ['union', () => product(DEA_PAR, DEA_ODD, 'union')],
  ['reachable', () => reachable(DEA_UNREACH)],
  ['minimize', () => minimize(DEA_292)],
  ['mealy2moore', () => mealyToMoore(MEALY)],
  ['moore2mealy', () => mooreToMealy(MOORE)],
];

describe('Jeder Schritt: validate ohne Fehler, Schlüssel bekannt', () => {
  it.each(CASES)('%s', (_name, run) => {
    const r = run();
    expect(r.ok, 'Verfahren muss gelingen').toBe(true);
    checkSteps(r.steps);
  });

  it('jeder Schritt ist ein eigenständiger Snapshot (keine geteilten Objekte)', () => {
    const objs = neaToDea(N266).steps.map((s) => s.view.obj).filter((o): o is FormalObject => o !== undefined);
    expect(objs.length).toBeGreaterThan(1);
    expect(new Set(objs).size).toBe(objs.length);
  });
});

// ---------------------------------------------------------------------------
// Punkt 5: Grenzen

describe('Grenzen (algo.limit)', () => {
  it('Potenzmenge mit maxStates 3 auf einem NEA mit 4 erreichbaren Teilmengen: algo.limit', () => {
    const r = powerset(NEA_L3, { limits: { maxStates: 3 } });
    expect(r.ok).toBe(false);
    const d = r.ok ? undefined : r.diagnostics.find((x) => x.code === 'algo.limit');
    expect(d, 'algo.limit fehlt').toBeDefined();
    expect(d!.params).toMatchObject({ what: 'states', limit: 3 });
    expect(Array.isArray(r.steps)).toBe(true);
  });

  it('gleicher NEA mit maxStates 4 gelingt: genau 4 Zustände', () => {
    const r = powerset(NEA_L3, { limits: { maxStates: 4 } });
    expect(r.ok).toBe(true);
    expect(ok(r).states).toHaveLength(4);
  });
});
