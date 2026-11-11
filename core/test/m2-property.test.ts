// M2, Teil C Punkt 3: eigenschaftsbasierte Tests mit festem Seed (je 100 Fälle, kleine Größen).
// Orakel: enumerate bis Länge 6 bzw. Mengenoperationen auf enumerate, equivalent, accepts.
// Erwartungen aus docs/kern-spec-m2.md (Teil B) und docs/skript-notizen-m2.md.
// Nur die öffentliche Schnittstelle core/index.ts.

import { describe, expect, it } from 'vitest';
import {
  accepts,
  complement,
  deaToRegex,
  enumerate,
  equivalent,
  grammarToNea,
  minimize,
  neaToDea,
  product,
  regexToGrammar,
} from '../index';
import type {
  DEA,
  EquivalenceResult,
  FormalObject,
  NEA,
  ProcResult,
  RegExpr,
  RegexObj,
  Word,
} from '../index';

// ---------------------------------------------------------------------------
// Eigener PRNG (mulberry32), keine Abhängigkeit

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const rnd = (rng: Rng, n: number) => Math.floor(rng() * n);

const ALPH = ['a', 'b'];

// ---------------------------------------------------------------------------
// Zufallsgeneratoren

/** Ausdruck mit Tiefe ≤ depth über {a,b}; ∅ selten. */
function randRegex(rng: Rng, depth: number): RegExpr {
  if (depth === 0 || rng() < 0.25) {
    if (rng() < 0.08) return { op: 'empty' };
    return { op: 'sym', sym: ALPH[rnd(rng, 2)]! };
  }
  const k = rng();
  if (k < 0.35) return { op: 'union', left: randRegex(rng, depth - 1), right: randRegex(rng, depth - 1) };
  if (k < 0.7) return { op: 'concat', left: randRegex(rng, depth - 1), right: randRegex(rng, depth - 1) };
  return { op: 'star', inner: randRegex(rng, depth - 1) };
}

function randRegexObj(rng: Rng): RegexObj {
  return { kind: 'regex', name: 'R', alphabet: [...ALPH], expr: randRegex(rng, 4) };
}

/** Totaler DEA mit bis zu maxStates Zuständen. */
function randDea(rng: Rng, maxStates: number): DEA {
  const n = 1 + rnd(rng, maxStates);
  const names = Array.from({ length: n }, (_, i) => `z${i}`);
  const transitions: DEA['transitions'] = [];
  let t = 0;
  for (const from of names) {
    for (const x of ALPH) {
      transitions.push({ id: `t${t++}`, from, to: names[rnd(rng, n)]!, label: x });
    }
  }
  const accept = names.filter(() => rng() < 0.4);
  return {
    kind: 'dea',
    name: 'D',
    alphabet: [...ALPH],
    states: names.map((id) => ({ id, name: id })),
    start: 'z0',
    accept,
    transitions,
  };
}

/** NEA mit bis zu maxStates Zuständen, Kanten mit Wörtern der Länge 0, 1 oder 2. */
function randNea(rng: Rng, maxStates: number): NEA {
  const n = 1 + rnd(rng, maxStates);
  const names = Array.from({ length: n }, (_, i) => `z${i}`);
  const m = rnd(rng, 7);
  const transitions: NEA['transitions'] = [];
  for (let t = 0; t < m; t++) {
    const r = rng();
    const len = r < 0.2 ? 0 : r < 0.7 ? 1 : 2;
    const word = Array.from({ length: len }, () => ALPH[rnd(rng, 2)]!);
    transitions.push({ id: `t${t}`, from: names[rnd(rng, n)]!, to: names[rnd(rng, n)]!, label: word });
  }
  const accept = names.filter(() => rng() < 0.4);
  return {
    kind: 'nea',
    name: 'N',
    alphabet: [...ALPH],
    states: names.map((id) => ({ id, name: id })),
    start: 'z0',
    accept,
    transitions,
  };
}

// ---------------------------------------------------------------------------
// Orakel-Hilfen

/** Alle Wörter über `alpha` bis `maxLen`, nach Länge, dann lexikographisch. */
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

/** Sprache bis Länge L als sortierte Schlüssel. */
const lang = (o: FormalObject, L: number): string[] => enumerate(o, L).map(keyOf).sort();

function ok<R>(r: ProcResult<R>): R {
  if (!r.ok) throw new Error(`Verfahren ohne Ergebnis: ${r.diagnostics.map((d) => d.code).join(', ')}`);
  return r.result;
}

const withStart = (d: DEA, s: string): DEA => ({ ...d, start: s });

/** equivalent ist ein Verfahren mit Schritten: ProcResult<EquivalenceResult>. */
const eqv = (a: FormalObject, b: FormalObject): EquivalenceResult => ok(equivalent(a, b, { steps: false }));

/** Gegenbeispiel-Prüfung für equivalent (Spezifikation: kürzestes, lexikographisch kleinstes Wort). */
function checkEquivalence(A: FormalObject, B: FormalObject, res: EquivalenceResult, label: string) {
  if (res.equal) {
    expect(res.word, `${label}: equal, aber Wort`).toBeNull();
    expect(res.inLanguage, `${label}: equal, aber inLanguage`).toBeNull();
    expect(lang(A, 6), `${label}: equal, aber Sprachen verschieden`).toEqual(lang(B, 6));
    return;
  }
  expect(res.word, `${label}: ungleich, aber kein Wort`).not.toBeNull();
  const w = res.word as Word;
  const inA = accepts(A, w);
  const inB = accepts(B, w);
  expect(inA, `${label}: accepts(A) null`).not.toBeNull();
  expect(inB, `${label}: accepts(B) null`).not.toBeNull();
  expect(inA !== inB, `${label}: Wort ${keyOf(w)} liegt nicht in genau einer Sprache`).toBe(true);
  expect(res.inLanguage, `${label}: inLanguage`).toBe(inA ? 0 : 1);

  const L = w.length;
  const SA = new Set(enumerate(A, L).map(keyOf));
  const SB = new Set(enumerate(B, L).map(keyOf));
  // Kein kürzeres Wort trennt
  for (const u of wordsUpTo(ALPH, L - 1)) {
    expect(SA.has(u) === SB.has(u), `${label}: kürzeres trennendes Wort ${u}`).toBe(true);
  }
  // Unter den Wörtern gleicher Länge ist w das lexikographisch kleinste
  const firstSeparating = wordsUpTo(ALPH, L).find((u) => u.length === L && SA.has(u) !== SB.has(u));
  expect(firstSeparating, `${label}: lexikographisch kleinstes Wort`).toBe(keyOf(w));
}

// ---------------------------------------------------------------------------
// Punkt 3a: Kette Ausdruck → Grammatik → NEA → DEA → minimal → Ausdruck

describe('Eigenschaft: Kette Ausdruck → Grammatik → NEA → DEA → minimal → Ausdruck', () => {
  it('erhält die Sprache (enumerate bis 6) und equivalent = true, 100 Fälle', () => {
    const rng = mulberry32(20261110);
    for (let i = 0; i < 100; i++) {
      const R = randRegexObj(rng);
      const G = ok(regexToGrammar(R, { steps: false }));
      const N = ok(grammarToNea(G, { steps: false }));
      const D = ok(neaToDea(N, { steps: false }));
      const M = ok(minimize(D, { steps: false }));
      const R2 = ok(deaToRegex(M, { steps: false }));
      const base = lang(R, 6);
      expect(lang(G, 6), `Fall ${i}: Grammatik`).toEqual(base);
      expect(lang(N, 6), `Fall ${i}: NEA`).toEqual(base);
      expect(lang(D, 6), `Fall ${i}: DEA`).toEqual(base);
      expect(lang(M, 6), `Fall ${i}: minimal`).toEqual(base);
      expect(lang(R2, 6), `Fall ${i}: Ausdruck`).toEqual(base);
      expect(eqv(R, R2).equal, `Fall ${i}: equivalent`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Punkt 3b: Kette NEA → DEA → minimal → Ausdruck → Grammatik → NEA → DEA → minimal

describe('Eigenschaft: Kette NEA → DEA → minimal → Ausdruck → Grammatik → NEA → DEA → minimal', () => {
  it('erhält die Sprache und equivalent = true, 100 Fälle', () => {
    const rng = mulberry32(20261111);
    for (let i = 0; i < 100; i++) {
      const N = randNea(rng, 4);
      const D = ok(neaToDea(N, { steps: false }));
      const M = ok(minimize(D, { steps: false }));
      const R = ok(deaToRegex(M, { steps: false }));
      const G = ok(regexToGrammar(R, { steps: false }));
      const N2 = ok(grammarToNea(G, { steps: false }));
      const D2 = ok(neaToDea(N2, { steps: false }));
      const M2 = ok(minimize(D2, { steps: false }));
      const base = lang(N, 6);
      expect(lang(D, 6), `Fall ${i}: DEA`).toEqual(base);
      expect(lang(M, 6), `Fall ${i}: minimal`).toEqual(base);
      expect(lang(R, 6), `Fall ${i}: Ausdruck`).toEqual(base);
      expect(lang(G, 6), `Fall ${i}: Grammatik`).toEqual(base);
      expect(lang(N2, 6), `Fall ${i}: NEA`).toEqual(base);
      expect(lang(M2, 6), `Fall ${i}: minimal (Kette)`).toEqual(base);
      expect(eqv(N, M2).equal, `Fall ${i}: equivalent`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Punkt 3c: Minimierung

describe('Eigenschaft: Minimierung', () => {
  it('zufällige totale DEA: nie mehr Zustände, zweimal minimieren ändert nichts, Sprache bleibt (100 Fälle)', () => {
    const rng = mulberry32(3001);
    for (let i = 0; i < 100; i++) {
      const D = randDea(rng, 4);
      const M = ok(minimize(D, { steps: false }));
      const M2 = ok(minimize(M, { steps: false }));
      expect(M.states.length, `Fall ${i}: nicht mehr Zustände`).toBeLessThanOrEqual(D.states.length);
      expect(M2.states.length, `Fall ${i}: zweimal minimieren`).toBe(M.states.length);
      expect(lang(M, 6), `Fall ${i}: Sprache`).toEqual(lang(D, 6));
    }
  });

  it('Ergebnis ist minimal: keine zwei verschiedenen Zustände sind äquivalent (100 Fälle)', () => {
    const rng = mulberry32(3002);
    for (let i = 0; i < 100; i++) {
      const M = ok(minimize(randDea(rng, 4), { steps: false }));
      for (const s of M.states) {
        for (const t of M.states) {
          if (s.id === t.id) continue;
          const eq = eqv(withStart(M, s.id), withStart(M, t.id)).equal;
          expect(eq, `Fall ${i}: Zustände ${s.id} und ${t.id} sind äquivalent`).toBe(false);
        }
      }
    }
  });

  it('aus NEA: nie mehr Zustände als der DEA, zweimal minimieren ändert nichts (100 Fälle)', () => {
    const rng = mulberry32(3003);
    for (let i = 0; i < 100; i++) {
      const D = ok(neaToDea(randNea(rng, 4), { steps: false }));
      const M = ok(minimize(D, { steps: false }));
      const M2 = ok(minimize(M, { steps: false }));
      expect(M.states.length, `Fall ${i}`).toBeLessThanOrEqual(D.states.length);
      expect(M2.states.length, `Fall ${i}`).toBe(M.states.length);
      expect(lang(M, 6), `Fall ${i}: Sprache`).toEqual(lang(D, 6));
    }
  });
});

// ---------------------------------------------------------------------------
// Punkt 3d: Komplement, Schnitt, Vereinigung als Mengenoperationen

describe('Eigenschaft: Komplement, Schnitt, Vereinigung', () => {
  it('stimmen mit Mengenoperationen auf enumerate (bis 6) überein, 100 Fälle', () => {
    const rng = mulberry32(4001);
    const universe = wordsUpTo(ALPH, 6);
    for (let i = 0; i < 100; i++) {
      const A = randDea(rng, 4);
      const B = randDea(rng, 4);
      const LA = new Set(lang(A, 6));
      const LB = new Set(lang(B, 6));

      const C = ok(complement(A, { steps: false }));
      expect(lang(C, 6), `Fall ${i}: Komplement`).toEqual(universe.filter((u) => !LA.has(u)).sort());

      const I = ok(product(A, B, 'intersection', { steps: false }));
      expect(lang(I, 6), `Fall ${i}: Schnitt`).toEqual(universe.filter((u) => LA.has(u) && LB.has(u)).sort());

      const V = ok(product(A, B, 'union', { steps: false }));
      expect(lang(V, 6), `Fall ${i}: Vereinigung`).toEqual(universe.filter((u) => LA.has(u) || LB.has(u)).sort());
    }
  });
});

// ---------------------------------------------------------------------------
// Punkt 3e: equivalent liefert ein Gegenbeispiel, wenn ungleich

describe('Eigenschaft: equivalent liefert kürzestes Gegenbeispiel', () => {
  it('zufällige DEA-Paare, 100 Fälle', () => {
    const rng = mulberry32(5001);
    let unequal = 0;
    for (let i = 0; i < 100; i++) {
      const A = randDea(rng, 4);
      const B = randDea(rng, 4);
      const res = eqv(A, B);
      if (!res.equal) unequal++;
      checkEquivalence(A, B, res, `DEA-Paar ${i}`);
    }
    // Sanity: die Zufallspaare sind nicht alle gleich
    expect(unequal).toBeGreaterThan(0);
  });

  it('zufällige NEA-Paare, 100 Fälle', () => {
    const rng = mulberry32(5002);
    for (let i = 0; i < 100; i++) {
      const A = randNea(rng, 4);
      const B = randNea(rng, 4);
      checkEquivalence(A, B, eqv(A, B), `NEA-Paar ${i}`);
    }
  });

  it('Ausdruck gegen sich selbst (umgeformt): equal = true', () => {
    const R: RegexObj = { kind: 'regex', name: 'R', alphabet: [...ALPH], expr: { op: 'union', left: { op: 'sym', sym: 'a' }, right: { op: 'sym', sym: 'b' } } };
    const Rt: RegexObj = { ...R, expr: { op: 'union', left: { op: 'sym', sym: 'b' }, right: { op: 'sym', sym: 'a' } } };
    expect(eqv(R, Rt).equal).toBe(true);
  });
});
