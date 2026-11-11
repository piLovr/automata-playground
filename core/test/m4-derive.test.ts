// M4, Teil C: Ableitungen, Ableitungsbäume, Mehrdeutigkeit (4.17–4.24).
// Erwartungen aus docs/kern-spec-m4.md (Teil A, Teil C), docs/plan-m4.md (Entscheidungen) und
// docs/skript-notizen-m4.md (4.18, 4.20, 4.21, 4.22, 4.24). Nur die öffentliche Schnittstelle core/index.ts.
// Grammatiken als Text über parseDocument.

import { describe, expect, it } from 'vitest';
import {
  applicable,
  applyProduction,
  cfgWords,
  extend,
  findAmbiguity,
  findDerivation,
  grammarType,
  leftmostOf,
  leftmostPos,
  parseDocument,
  parseTrees,
  rightmostOf,
  sameTree,
  startDerivation,
  treeOf,
  treeSize,
  treeYield,
} from '../index';
import type { DerivTree, Derivation, Diagnostic, Grammar, ProductionId, Word } from '../index';

// ---------------------------------------------------------------------------
// Hilfsfunktionen (nur Test; prüfen nichts, was die Implementierung liefert)

function gram(text: string): Grammar {
  const { doc, diagnostics } = parseDocument(text);
  const errs = diagnostics.filter((d: Diagnostic) => d.severity === 'error');
  expect(errs).toEqual([]);
  const o = doc.objects[0];
  expect(o?.kind).toBe('grammatik');
  return o as Grammar;
}

const W = (s: string): Word => [...s];
const str = (w: Word): string => w.join('');

/** Produktion mit gegebener linker und rechter Seite (ε als ''). */
function pid(g: Grammar, right: string, left = 'S'): ProductionId {
  const p = g.productions.find((q) => str(q.left) === left && str(q.right) === right);
  if (!p) throw new Error(`Produktion ${left} -> ${right || 'ε'} fehlt`);
  return p.id;
}

function rightOf(g: Grammar, id: ProductionId): string {
  const p = g.productions.find((q) => q.id === id);
  if (!p) throw new Error(`Produktion ${id} unbekannt`);
  return str(p.right) || 'ε';
}

/** Baut eine Ableitung aus Schritten (rechte Seite, Stelle); ε als ''. */
function build(g: Grammar, steps: [string, number][]): Derivation {
  let d: Derivation = startDerivation(g);
  for (const [right, pos] of steps) {
    const r = extend(g, d, pid(g, right), pos);
    if ('error' in r) throw new Error(`extend abgelehnt: ${right || 'ε'} @${pos}`);
    d = r;
  }
  return d;
}

const forms = (d: Derivation): string[] => d.steps.map((s) => str(s.form));
const prodsOf = (g: Grammar, d: Derivation): string[] => d.steps.map((s) => rightOf(g, s.production));

/** Linksableitung: jeder Schritt ersetzt das linkeste Nichtterminal (hier nur S). */
function isLeftmost(d: Derivation): boolean {
  let prev = d.start;
  for (const s of d.steps) {
    if (s.pos !== prev.indexOf('S')) return false;
    prev = s.form;
  }
  return true;
}

/** Rechtsableitung: jeder Schritt ersetzt das rechteste Nichtterminal. */
function isRightmost(d: Derivation): boolean {
  let prev = d.start;
  for (const s of d.steps) {
    if (s.pos !== prev.lastIndexOf('S')) return false;
    prev = s.form;
  }
  return true;
}

/** Klammerform: S[S[ε] S[( S[ε] )]] (ε-Blatt = ε). */
function br(t: DerivTree): string {
  const label = t.sym === null ? 'ε' : t.sym;
  return t.children.length === 0 ? label : `${label}[${t.children.map(br).join(' ')}]`;
}

function preorderIds(t: DerivTree): number[] {
  return [t.id, ...t.children.flatMap(preorderIds)];
}

/** Produktionen der inneren Knoten in Vorordnung (Kantenliste 4.20). */
function innerProductions(g: Grammar, t: DerivTree): string[] {
  const here = t.production !== undefined ? [rightOf(g, t.production)] : [];
  return [...here, ...t.children.flatMap((c) => innerProductions(g, c))];
}

function balanced(w: string): boolean {
  let depth = 0;
  for (const c of w) {
    depth += c === '(' ? 1 : -1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

/** Alle Wörter über dem Alphabet mit Länge 0 … hi. */
function allWords(alphabet: string[], hi: number): string[] {
  const out: string[] = [''];
  let layer: string[] = [''];
  for (let n = 1; n <= hi; n++) {
    layer = layer.flatMap((w) => alphabet.map((a) => w + a));
    out.push(...layer);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Grammatiken

/** 4.16: S → ε | (S) | SS */
const G416 = gram(`grammatik G416 {
  nichtterminale S
  terminale ( )
  start S
  S -> ε | (S) | SS
}`);

/** Eindeutige Klammergrammatik (Ende 4.24): S → ε | ST, T → (S) */
const GU = gram(`grammatik GU {
  nichtterminale S T
  terminale ( )
  start S
  S -> ε | ST
  T -> (S)
}`);

/** Typ 0 (4.14-Stil): AB → BA, Linksseite zwei Nichtterminale. */
const T0 = gram(`grammatik T0 {
  nichtterminale S A B
  terminale a b
  start S
  S -> aAB
  AB -> BA
}`);

/** Typ 1 (kontextsensitiv, nicht kontextfrei): a^n b^n c^n. */
const A3 = gram(`grammatik A3 {
  nichtterminale S B C
  terminale a b c
  start S
  S -> aBC | aSBC
  CB -> BC
  aB -> ab
  bB -> bb
  bC -> bc
  cC -> cc
}`);

// Ableitungen 4.18 / 4.21 als Schrittlisten (rechte Seite, Stelle)
const ROW1: [string, number][] = [['SS', 0], ['(S)', 1], ['', 0], ['', 1]]; // S ⇒ SS ⇒ S(S) ⇒ (S) ⇒ ()
const ROW2: [string, number][] = [['SS', 0], ['', 0], ['(S)', 0], ['', 1]]; // Linksableitung 4.18 / 4.21
const ROW3: [string, number][] = [['SS', 0], ['(S)', 1], ['', 2], ['', 0]]; // Rechtsableitung 4.21

// ---------------------------------------------------------------------------

describe('4.17 Ableitungsschritte', () => {
  it('leftmostPos: Index des linkesten Nichtterminals, null ohne Nichtterminal', () => {
    expect(leftmostPos(G416, W('SS'))).toBe(0);
    expect(leftmostPos(G416, W('(S)'))).toBe(1);
    expect(leftmostPos(G416, W('()'))).toBeNull();
  });

  it('applicable(SS) nennt alle 3 Produktionen an jeder der 2 Stellen (6 Einträge)', () => {
    const app = applicable(G416, W('SS'));
    expect(app).toHaveLength(6);
    for (const right of ['', '(S)', 'SS']) {
      for (const pos of [0, 1]) {
        expect(app.some((e) => e.production === pid(G416, right) && e.pos === pos)).toBe(true);
      }
    }
  });

  it('applicable ohne Nichtterminal ist leer', () => {
    expect(applicable(G416, W('()'))).toEqual([]);
  });

  it('applyProduction: ε-Produktion entfernt die Stelle', () => {
    const r1 = applyProduction(G416, W('SS'), pid(G416, ''), 0);
    expect('form' in r1 && str(r1.form)).toBe('S');
    const r2 = applyProduction(G416, W('(S)'), pid(G416, ''), 1);
    expect('form' in r2 && str(r2.form)).toBe('()');
  });

  it('applyProduction an Stelle ohne passendes Nichtterminal ist ein Fehler', () => {
    const r = applyProduction(G416, W('(S)'), pid(G416, 'SS'), 0);
    expect('error' in r).toBe(true);
  });

  it('extend an ungültiger Stelle liefert einen Fehler', () => {
    const r = extend(G416, startDerivation(G416), pid(G416, 'SS'), 5);
    expect('error' in r).toBe(true);
  });

  it('startDerivation beginnt mit [S]', () => {
    const d = startDerivation(G416);
    expect(str(d.start)).toBe('S');
    expect(d.steps).toEqual([]);
  });
});

describe('4.18 Ableitungsfolgen (Links- und Rechtsableitung)', () => {
  it('Zeile 1 (weder links noch rechts): S ⇒ SS ⇒ S(S) ⇒ (S) ⇒ ()', () => {
    const d = build(G416, ROW1);
    expect(forms(d)).toEqual(['SS', 'S(S)', '(S)', '()']);
    expect(isLeftmost(d)).toBe(false);
    expect(isRightmost(d)).toBe(false);
  });

  it('Zeile 2 (Linksableitung): S ⇒ SS ⇒ S ⇒ (S) ⇒ ()', () => {
    const d = build(G416, ROW2);
    expect(forms(d)).toEqual(['SS', 'S', '(S)', '()']);
    expect(isLeftmost(d)).toBe(true);
    expect(isRightmost(d)).toBe(false);
  });

  it('Zeile 3 (Rechtsableitung): S ⇒ SS ⇒ S(S) ⇒ S() ⇒ ()', () => {
    const d = build(G416, ROW3);
    expect(forms(d)).toEqual(['SS', 'S(S)', 'S()', '()']);
    expect(isRightmost(d)).toBe(true);
    expect(isLeftmost(d)).toBe(false);
  });
});

describe('4.19/4.20 Ableitungsbaum', () => {
  const d2 = build(G416, ROW2);
  const t2 = treeOf(G416, d2);

  it('Baum zur Linksableitung 4.20 hat Klammerform S[S[ε] S[( S[ε] )]]', () => {
    expect(t2).not.toBeNull();
    expect(br(t2!)).toBe('S[S[ε] S[( S[ε] )]]');
  });

  it('Blätter links→rechts ergeben () (ε-Blätter zählen nicht)', () => {
    expect(str(treeYield(t2!))).toBe('()');
  });

  it('Baumgröße 8 (alle Knoten inkl. ε-Blätter)', () => {
    expect(treeSize(t2!)).toBe(8);
  });

  it('Kantenliste 4.20: Produktionen der inneren Knoten in Vorordnung sind SS, ε, (S), ε', () => {
    expect(innerProductions(G416, t2!)).toEqual(['SS', 'ε', '(S)', 'ε']);
  });

  it('Ids in Vorordnung 0, 1, … (lückenlos)', () => {
    const ids = preorderIds(t2!);
    expect(ids).toEqual(ids.map((_, i) => i));
  });

  it('treeOf ist nur für Typ 2 definiert: Typ-0-Grammatik ergibt null', () => {
    expect(treeOf(T0, startDerivation(T0))).toBeNull();
  });
});

describe('4.21 Zwei Ableitungen, ein Baum', () => {
  it('Zeile 1, Linksableitung und Rechtsableitung ergeben denselben Baum 4.20', () => {
    const expected = 'S[S[ε] S[( S[ε] )]]';
    for (const steps of [ROW1, ROW2, ROW3]) {
      const t = treeOf(G416, build(G416, steps));
      expect(t).not.toBeNull();
      expect(br(t!)).toBe(expected);
    }
  });

  it('die beiden Ableitungen aus 4.21 sind verschieden, ihre Bäume sind gleich', () => {
    const d2 = build(G416, ROW2);
    const d3 = build(G416, ROW3);
    expect(forms(d2)).not.toEqual(forms(d3));
    expect(sameTree(treeOf(G416, d2)!, treeOf(G416, d3)!)).toBe(true);
  });
});

describe('4.22 Links- und Rechtsableitung aus dem Baum', () => {
  const t = treeOf(G416, build(G416, ROW2))!;

  it('leftmostOf liefert die Linksableitung 4.18 (Zeile 2)', () => {
    const d = leftmostOf(G416, t);
    expect(str(d.start)).toBe('S');
    expect(forms(d)).toEqual(['SS', 'S', '(S)', '()']);
    expect(prodsOf(G416, d)).toEqual(['SS', 'ε', '(S)', 'ε']);
    expect(isLeftmost(d)).toBe(true);
  });

  it('rightmostOf liefert die Rechtsableitung 4.21 (Zeile 3)', () => {
    const d = rightmostOf(G416, t);
    expect(str(d.start)).toBe('S');
    expect(forms(d)).toEqual(['SS', 'S(S)', 'S()', '()']);
    expect(prodsOf(G416, d)).toEqual(['SS', '(S)', 'ε', 'ε']);
    expect(isRightmost(d)).toBe(true);
  });

  it('aus dem Baum der Zeile 1 (nicht links/rechts) wird dieselbe Linksableitung', () => {
    const t1 = treeOf(G416, build(G416, ROW1))!;
    expect(forms(leftmostOf(G416, t1))).toEqual(['SS', 'S', '(S)', '()']);
  });

  it('Wiederholung: der Baum des Ergebnisses ist derselbe Baum (sameTree)', () => {
    expect(sameTree(treeOf(G416, leftmostOf(G416, t))!, t)).toBe(true);
    expect(sameTree(treeOf(G416, rightmostOf(G416, t))!, t)).toBe(true);
  });
});

describe('4.23 Gleichheit von Bäumen', () => {
  it('sameTree ist reflexiv und ignoriert Ids', () => {
    const t = treeOf(G416, build(G416, ROW2))!;
    expect(sameTree(t, t)).toBe(true);
  });
});

describe('4.24 Zwei Bäume für ()()() (Grammatik 4.16)', () => {
  // Bäume A und B aus den Notizen (4.24), Klammerform.
  const A = 'S[S[S[( S[ε] )] S[( S[ε] )]] S[( S[ε] )]]';
  const B = 'S[S[( S[ε] )] S[S[( S[ε] )] S[( S[ε] )]]]';

  const res = parseTrees(G416, W('()()()'), { maxNodes: 60, maxTrees: 50 });

  it('ist ein Ergebnis mit trees (ok)', () => {
    expect(res.ok).toBe(true);
  });

  it('die ersten zwei Bäume sind A und B (Reihenfolge egal), Größe je 17', () => {
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const [t0, t1] = res.result.trees;
    expect(t0 && t1).toBeTruthy();
    expect(new Set([br(t0!), br(t1!)])).toEqual(new Set([A, B]));
    expect(treeSize(t0!)).toBe(17);
    expect(treeSize(t1!)).toBe(17);
    expect(sameTree(t0!, t1!)).toBe(false);
  });

  it('Bäume sind nach Größe aufsteigend geordnet', () => {
    if (!res.ok) throw new Error('parseTrees fehlgeschlagen');
    const sizes = res.result.trees.map(treeSize);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });

  it('infinite = true (S ⇒⁺ S über S → SS mit S ⇒* ε)', () => {
    if (!res.ok) throw new Error('parseTrees fehlgeschlagen');
    expect(res.result.infinite).toBe(true);
    expect(res.result.complete).toBe(false);
  });

  it('jeder Baum ergibt ()()()', () => {
    if (!res.ok) throw new Error('parseTrees fehlgeschlagen');
    for (const t of res.result.trees) expect(str(treeYield(t))).toBe('()()()');
  });

  it('bei maxNodes 17 genau A und B; bei maxNodes 16 keiner', () => {
    const r17 = parseTrees(G416, W('()()()'), { maxNodes: 17 });
    expect(r17.ok).toBe(true);
    if (r17.ok) expect(r17.result.trees.map(br).sort()).toEqual([A, B].sort());
    const r16 = parseTrees(G416, W('()()()'), { maxNodes: 16 });
    expect(r16.ok).toBe(true);
    if (r16.ok) expect(r16.result.trees).toEqual([]);
  });

  it('maxTrees begrenzt die Anzahl', () => {
    const r = parseTrees(G416, W('()()()'), { maxTrees: 3 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.trees.length).toBeLessThanOrEqual(3);
  });
});

describe('parseTrees und findAmbiguity, Abnahme', () => {
  it('Wort "()": Bäume paarweise verschieden, Größe ≤ 60, alle ergeben "()"', () => {
    const r = parseTrees(G416, W('()'), { maxNodes: 60, maxTrees: 50 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ts = r.result.trees;
    expect(ts.length).toBeGreaterThan(1);
    for (const t of ts) {
      expect(treeSize(t)).toBeLessThanOrEqual(60);
      expect(str(treeYield(t))).toBe('()');
    }
    const first = ts.slice(0, 10);
    for (let i = 0; i < first.length; i++) {
      for (let j = i + 1; j < first.length; j++) {
        expect(sameTree(first[i]!, first[j]!)).toBe(false);
      }
    }
  });

  it('eindeutige Grammatik S → ε | ST, T → (S): "()()" hat genau einen Baum, nicht unendlich', () => {
    const r = parseTrees(GU, W('()()'), { maxNodes: 60 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.trees).toHaveLength(1);
    expect(r.result.infinite).toBe(false);
    expect(r.result.complete).toBe(true);
  });

  it('eindeutige Grammatik: Wort ε hat genau einen Baum der Größe 2 (S + ε)', () => {
    const r = parseTrees(GU, W(''), { maxNodes: 60 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.trees).toHaveLength(1);
    expect(treeSize(r.result.trees[0]!)).toBe(2);
  });

  it('Wort nicht in der Sprache: keine Bäume, Suche vollständig', () => {
    const r = parseTrees(GU, W('(('), { maxNodes: 60 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.trees).toEqual([]);
  });

  it('findAmbiguity für 4.16: findet ein Wort mit zwei verschiedenen Bäumen', () => {
    const r = findAmbiguity(G416, { maxLen: 8 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.found).not.toBeNull();
    const f = r.result.found!;
    expect(sameTree(f.trees[0], f.trees[1])).toBe(false);
    expect(str(treeYield(f.trees[0]))).toBe(str(f.word));
    expect(str(treeYield(f.trees[1]))).toBe(str(f.word));
    expect(r.result.checkedUpTo).toBe(f.word.length);
  });

  it('findAmbiguity für 4.16: das kürzeste Wort ist ε (S → ε und S → SS mit zwei ε-Blättern)', () => {
    // Nach Länge geordnet ist ε das erste Wort mit zwei Bäumen; es ist in 4.16 mehrdeutig.
    const r = findAmbiguity(G416, { maxLen: 8 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.found?.word).toEqual([]);
  });

  it('findAmbiguity für eindeutige Grammatik bis Länge 8: nichts gefunden, ehrlich', () => {
    const r = findAmbiguity(GU, { maxLen: 8 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.found).toBeNull();
      expect(r.result.checkedUpTo).toBe(8);
    }
  });
});

describe('cfgWords (Teil A)', () => {
  const dyck = (maxLen: number): string[] => allWords(['(', ')'], maxLen).filter(balanced).sort();

  it('4.16 bis Länge 6: genau die wohlgeformten Klammerwörter (9 Stück), vollständig', () => {
    const r = cfgWords(G416, 6);
    expect(r.complete).toBe(true);
    expect([...r.words].map(str).sort()).toEqual(dyck(6));
    expect(r.words).toHaveLength(9);
  });

  it('eindeutige Grammatik GU bis Länge 6: dieselbe Sprache', () => {
    const r = cfgWords(GU, 6);
    expect(r.complete).toBe(true);
    expect([...r.words].map(str).sort()).toEqual(dyck(6));
  });
});

describe('findDerivation (Teil A)', () => {
  it('"()" in 4.16: kürzeste Linksableitung mit 2 Schritten S ⇒ (S) ⇒ ()', () => {
    const r = findDerivation(G416, W('()'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.steps).toHaveLength(2);
    expect(forms(r.result)).toEqual(['(S)', '()']);
    expect(isLeftmost(r.result)).toBe(true);
  });

  it('"" in 4.16: eine Ableitung S ⇒ ε', () => {
    const r = findDerivation(G416, W(''));
    expect(r.ok).toBe(true);
    if (r.ok) expect(forms(r.result)).toEqual(['']);
  });

  it('nicht ableitbares Wort "(()": ok false, Suche vollständig, diagnostics leer', () => {
    const r = findDerivation(G416, W('(()'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.diagnostics).toEqual([]);
  });

  it('Grenze maxSteps 1 vor dem Fund: ok false mit Warnung derive.limit', () => {
    const r = findDerivation(G416, W('()'), { maxSteps: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.diagnostics.some((d) => d.code === 'derive.limit' && d.severity === 'warning')).toBe(true);
    }
  });

  it('Typ 1 (Breitensuche): "abc" in a^n b^n c^n kürzest in 3 Schritten', () => {
    expect(grammarType(A3).type).toBe(0); // CB → BC: nicht verkürzend, aber nicht Form 5.1
    expect(grammarType(A3).nonContracting).toBe(true);
    const r = findDerivation(A3, W('abc'));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.steps).toHaveLength(3);
      expect(forms(r.result)).toEqual(['aBC', 'abC', 'abc']);
    }
  });
});

describe('Anwendbarkeit für Typ 0 und Fehlerfälle', () => {
  it('Typ 0: Linksseite AB ist an Stelle 0 und 2 von ABAB anwendbar', () => {
    const p = pid(T0, 'BA', 'AB');
    const app = applicable(T0, W('ABAB'));
    expect(app).toEqual(
      expect.arrayContaining([
        { production: p, pos: 0 },
        { production: p, pos: 2 },
      ]),
    );
    expect(app).toHaveLength(2);
  });

  it('Typ 0: AB → BA an Stelle 2 von ABAB ergibt ABBA', () => {
    const r = applyProduction(T0, W('ABAB'), pid(T0, 'BA', 'AB'), 2);
    expect('form' in r && str(r.form)).toBe('ABBA');
  });

  it('parseTrees für Typ 0: Fehler derive.notType2', () => {
    const r = parseTrees(T0, W('ab'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.diagnostics.some((d) => d.code === 'derive.notType2')).toBe(true);
  });
});
