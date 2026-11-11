// M4, Teil C: Grammatik → Kellerautomat (4.27), Lauf top-down (4.28), bottom-up (4.34),
// NKA-Option „akzeptanz leer“ und NKA 4.6.
// Erwartungen aus docs/kern-spec-m4.md (Teil B, Teil C), docs/plan-m4.md (Entscheidungen 2),
// docs/skript-notizen-m4.md (4.24, 4.27, 4.28, 4.34, 4.35, 4.36). Nur core/index.ts.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  applicableMethods,
  bottomUpRun,
  cfgWords,
  edit,
  fromJSON,
  grammarToNka,
  grammarType,
  METHOD_IDS,
  parseDocument,
  printDocument,
  runMethod,
  simulate,
  toJSON,
  topDownRun,
} from '../index';
import type {
  Derivation,
  Diagnostic,
  Grammar,
  NKA,
  ParseAction,
  ParseRow,
  Production,
  ProductionId,
  Word,
} from '../index';

// ---------------------------------------------------------------------------
// Hilfsfunktionen

const EX = fileURLToPath(new URL('../../examples/', import.meta.url));

function parseOne(text: string): { objects: unknown[]; errors: Diagnostic[] } {
  const { doc, diagnostics } = parseDocument(text);
  return { objects: doc.objects, errors: diagnostics.filter((d) => d.severity === 'error') };
}

function gram(text: string): Grammar {
  const { objects, errors } = parseOne(text);
  expect(errors).toEqual([]);
  expect((objects[0] as Grammar).kind).toBe('grammatik');
  return objects[0] as Grammar;
}

const W = (s: string): Word => [...s];
const str = (w: Word): string => w.join('');

function rightOf(g: Grammar, id: ProductionId): string {
  const p: Production | undefined = g.productions.find((q) => q.id === id);
  if (!p) throw new Error(`Produktion ${id} unbekannt`);
  return str(p.right) || 'ε';
}

/** Aktion als kurzer Text: start, prod:<rechte Seite>, read:<Symbol>, accept, - (keine). */
function actStr(g: Grammar, a: ParseAction | null): string {
  if (a === null) return '-';
  switch (a.kind) {
    case 'start':
      return 'start';
    case 'produce':
    case 'reduce':
      return 'prod:' + rightOf(g, a.production);
    case 'read':
    case 'shift':
      return 'read:' + a.sym;
    case 'accept':
      return 'accept';
  }
}

/** Zeile als Feldliste: gelesen, Rest, Zustand, Keller, Aktion, Satzform. */
function rowFields(g: Grammar, r: ParseRow): string[] {
  return [str(r.read), str(r.rest), r.state, str(r.stack), actStr(g, r.action), str(r.form)];
}

function derivForms(d: Derivation): string[] {
  return d.steps.map((s) => str(s.form));
}

function derivProds(g: Grammar, d: Derivation): string[] {
  return d.steps.map((s) => rightOf(g, s.production));
}

/** Linksableitung: jeder Schritt an der ersten S-Stelle (nur S als Nichtterminal). */
function isLeftmost(d: Derivation): boolean {
  let prev = d.start;
  for (const s of d.steps) {
    if (s.pos !== prev.indexOf('S')) return false;
    prev = s.form;
  }
  return true;
}

/** Rechtsableitung: jeder Schritt an der letzten S-Stelle. */
function isRightmost(d: Derivation): boolean {
  let prev = d.start;
  for (const s of d.steps) {
    if (s.pos !== prev.lastIndexOf('S')) return false;
    prev = s.form;
  }
  return true;
}

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

const G416 = gram(`grammatik G416 {
  nichtterminale S
  terminale ( )
  start S
  S -> ε | (S) | SS
}`);

const T0 = gram(`grammatik T0 {
  nichtterminale S A B
  terminale a b
  start S
  S -> aAB
  AB -> BA
}`);

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

const RL = gram(`grammatik RL {
  nichtterminale X
  terminale 0 1
  start X
  X -> 0X | 1
}`);

const WORD_4_28 = W('(())()');

// ---------------------------------------------------------------------------

describe('4.27 Konstruktion Grammatik → Kellerautomat', () => {
  const r = grammarToNka(G416);

  it('G416 (Typ 2) ergibt einen NKA, Verfahren grammar2nka', () => {
    expect(r.ok).toBe(true);
    expect(METHOD_IDS).toContain('grammar2nka');
  });

  it('Zustände z0, z, z+; Start z0; Endzustand z+', () => {
    if (!r.ok) throw new Error('grammarToNka fehlgeschlagen');
    const nka: NKA = r.result;
    const names = nka.states.map((s) => s.name).sort();
    expect(names).toEqual(['z+', 'z', 'z0'].sort());
    expect(nka.states.find((s) => s.id === nka.start)?.name).toBe('z0');
    const acc = nka.accept.map((id) => nka.states.find((s) => s.id === id)?.name);
    expect(acc).toEqual(['z+']);
  });

  it('Kelleralphabet = {*} ∪ T ∪ N, y0 = *; Eingabealphabet = T', () => {
    if (!r.ok) throw new Error('grammarToNka fehlgeschlagen');
    expect(new Set(r.result.stackAlphabet)).toEqual(new Set(['*', 'S', '(', ')']));
    expect(r.result.y0).toBe('*');
    expect(new Set(r.result.alphabet)).toEqual(new Set(['(', ')']));
  });

  it('genau 7 Übergänge wie 4.27: Start 1, Produktionen 3, Lesen 2, Akzeptanz 1', () => {
    if (!r.ok) throw new Error('grammarToNka fehlgeschlagen');
    expect(r.result.transitions).toHaveLength(7);
  });

  it('die Übergänge (Zustand, oberstes Symbol, Eingabe, Ziel, Kellerpush) sind die aus 4.27', () => {
    if (!r.ok) throw new Error('grammarToNka fehlgeschlagen');
    const nka = r.result;
    const nameOf = (id: string) => nka.states.find((s) => s.id === id)?.name ?? id;
    const got = new Set(
      nka.transitions.map(
        (t) =>
          `${nameOf(t.from)}|${t.label.top}|${t.label.read ?? 'ε'}|${nameOf(t.to)}|${str(t.label.push)}`,
      ),
    );
    expect(got).toEqual(
      new Set([
        'z0|*|ε|z|S*', // Start: (z0, y0, ε) → (z, S y0)
        'z|S|ε|z|', // S → ε
        'z|S|ε|z|(S)', // S → (S)
        'z|S|ε|z|SS', // S → SS
        'z|(|(|z|', // Lesen "("
        'z|)|)|z|', // Lesen ")"
        'z|*|ε|z+|*', // Akzeptanz: (z, y0, ε) → (z+, y0)
      ]),
    );
  });

  it('je Übergang ein Schritt im Verfahren (7 Schritte)', () => {
    expect(r.steps).toHaveLength(7);
  });

  it('Typ 0 und Typ 1 werden mit algo.notType2 abgelehnt', () => {
    for (const g of [T0, A3]) {
      const x = grammarToNka(g);
      expect(x.ok).toBe(false);
      if (!x.ok) expect(x.diagnostics.some((d) => d.code === 'algo.notType2')).toBe(true);
    }
  });

  it('rechtslineare Grammatik (Typ 3 ⊂ Typ 2) wird übersetzt', () => {
    expect(grammarType(RL).type).toBe(3);
    expect(grammarToNka(RL).ok).toBe(true);
  });

  it('applicableMethods für Typ 2 enthält grammar2nka; runMethod verteilt dorthin', () => {
    expect(applicableMethods(G416)).toContain('grammar2nka');
    const m = runMethod('grammar2nka', [G416], {});
    expect(m.ok).toBe(true);
    if (m.ok) expect(m.result.kind).toBe('nka');
  });
});

describe('4.28 Lauf top-down für (())() in Grammatik 4.16, Zeile für Zeile', () => {
  const run = topDownRun(G416, WORD_4_28);

  // Zeilen A…O: gelesen | Rest | Zustand | Keller (oberstes links, * unten) | Aktion | Satzform
  const TABLE_428: string[][] = [
    ['', '(())()', 'z0', '*', 'start', ''], // A
    ['', '(())()', 'z', 'S*', 'prod:SS', 'S'], // B
    ['', '(())()', 'z', 'SS*', 'prod:(S)', 'SS'], // C
    ['', '(())()', 'z', '(S)S*', 'read:(', '(S)S'], // D
    ['(', '())()', 'z', 'S)S*', 'prod:(S)', '(S)S'], // E
    ['(', '())()', 'z', '(S))S*', 'read:(', '((S))S'], // F
    ['((', '))()', 'z', 'S))S*', 'prod:ε', '((S))S'], // G
    ['((', '))()', 'z', '))S*', 'read:)', '(())S'], // H
    ['(()', ')()', 'z', ')S*', 'read:)', '(())S'], // I
    ['(())', '()', 'z', 'S*', 'prod:(S)', '(())S'], // J
    ['(())', '()', 'z', '(S)*', 'read:(', '(())(S)'], // K
    ['(())(', ')', 'z', 'S)*', 'prod:ε', '(())(S)'], // L
    ['(())(', ')', 'z', ')*', 'read:)', '(())()'], // M
    ['(())()', '', 'z', '*', 'accept', '(())()'], // N
    ['(())()', '', 'z+', '*', '-', '(())()'], // O
  ];

  it('Lauf akzeptiert, 15 Zeilen A…O', () => {
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.result.accepted).toBe(true);
    expect(run.result.rows).toHaveLength(15);
  });

  it('jede Zeile (gelesen, Rest, Zustand, Keller, Aktion, Satzform) wie Tabelle 4.28', () => {
    if (!run.ok) throw new Error('topDownRun fehlgeschlagen');
    const rows = run.result.rows.map((r) => rowFields(G416, r));
    expect(rows).toEqual(TABLE_428);
  });

  it('Linksableitung der Zeilen: SS, (S), (S), ε, (S), ε; Satzformen wie 4.28', () => {
    if (!run.ok) throw new Error('topDownRun fehlgeschlagen');
    const d = run.result.derivation;
    expect(d).not.toBeNull();
    expect(derivProds(G416, d!)).toEqual(['SS', '(S)', '(S)', 'ε', '(S)', 'ε']);
    expect(derivForms(d!)).toEqual(['SS', '(S)S', '((S))S', '(())S', '(())(S)', '(())()']);
    expect(str(d!.start)).toBe('S');
    expect(isLeftmost(d!)).toBe(true);
  });

  it('tree ist der Ableitungsbaum der Linksableitung, Ergebnis (())()', () => {
    if (!run.ok) throw new Error('topDownRun fehlgeschlagen');
    expect(run.result.tree).not.toBeNull();
    expect(run.result.explored).toBeGreaterThanOrEqual(run.result.rows.length);
  });
});

describe('4.34 Bottom-up-Lauf für (())() in Grammatik 4.16, Zeile für Zeile', () => {
  const run = bottomUpRun(G416, WORD_4_28);

  // Zeilen 1…14: gelesen | Rest | Zustand | Keller (oberstes rechts, * links) | Aktion | Satzform (4.35)
  const TABLE_434: string[][] = [
    ['', '(())()', 'z0', '*', 'read:(', '(())()'], // 1
    ['(', '())()', 'z', '*(', 'read:(', '(())()'], // 2
    ['((', '))()', 'z', '*((', 'prod:ε', '(())()'], // 3
    ['((', '))()', 'z', '*((S', 'read:)', '((S))()'], // 4
    ['(()', ')()', 'z', '*((S)', 'prod:(S)', '((S))()'], // 5
    ['(()', ')()', 'z', '*(S', 'read:)', '(S)()'], // 6
    ['(())', '()', 'z', '*(S)', 'prod:(S)', '(S)()'], // 7
    ['(())', '()', 'z', '*S', 'read:(', 'S()'], // 8
    ['(())(', ')', 'z', '*S(', 'prod:ε', 'S()'], // 9
    ['(())(', ')', 'z', '*S(S', 'read:)', 'S(S)'], // 10
    ['(())()', '', 'z', '*S(S)', 'prod:(S)', 'S(S)'], // 11
    ['(())()', '', 'z', '*SS', 'prod:SS', 'SS'], // 12
    ['(())()', '', 'z', '*S', 'accept', 'S'], // 13
    ['(())()', '', 'z+', '*S', '-', 'S'], // 14
  ];

  it('Lauf akzeptiert, 14 Zeilen', () => {
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.result.accepted).toBe(true);
    expect(run.result.rows).toHaveLength(14);
  });

  it('jede Zeile wie Tabelle 4.34 (Keller, Zustand, ungelesener Rest, Aktion)', () => {
    if (!run.ok) throw new Error('bottomUpRun fehlgeschlagen');
    const rows = run.result.rows.map((r) => rowFields(G416, r));
    expect(rows).toEqual(TABLE_434);
  });

  it('Rechtsableitung von hinten nach vorne (4.36) und Baum', () => {
    if (!run.ok) throw new Error('bottomUpRun fehlgeschlagen');
    const d = run.result.derivation;
    expect(d).not.toBeNull();
    expect(derivForms(d!)).toEqual(['SS', 'S(S)', 'S()', '(S)()', '((S))()', '(())()']);
    expect(derivProds(G416, d!)).toEqual(['SS', '(S)', 'ε', '(S)', '(S)', 'ε']);
    expect(str(d!.start)).toBe('S');
    expect(isRightmost(d!)).toBe(true);
    expect(run.result.tree).not.toBeNull();
  });
});

describe('Abnahme NKA 4.6 (schon vorhanden)', () => {
  const nullEins = parseOne(readFileSync(join(EX, 'b4-6.txt'), 'utf8')).objects[0] as NKA;

  it('akzeptiert 00001111', () => {
    expect(simulate(nullEins, W('00001111')).result).toBe('accepted');
  });

  it('verwirft 0000111 und 0001111 (Anzahl 0 und 1 verschieden)', () => {
    expect(simulate(nullEins, W('0000111')).result).toBe('rejected');
    expect(simulate(nullEins, W('0001111')).result).toBe('rejected');
  });
});

describe('NKA-Option akzeptanz leer', () => {
  // Kleiner Automat: (a^n b^n)* mit Akzeptanz über leeren Keller (nur y0 übrig, Zustand egal).
  const TEXT_EMPTY = `nka Leer {
  alphabet a b
  keller *
  states z0
  start z0
  akzeptanz leer
  z0, *, a -> z0, a*
  z0, a, a -> z0, aa
  z0, a, b -> z0, ε
}`;

  const leer = parseOne(TEXT_EMPTY).objects[0] as NKA;

  it('Text „akzeptanz leer“ wird als acceptBy empty gelesen', () => {
    expect(parseOne(TEXT_EMPTY).errors).toEqual([]);
    expect(leer.acceptBy).toBe('empty');
  });

  it('Eingabe gelesen und nur y0 im Keller: ε, ab, aabb, abab akzeptiert', () => {
    for (const w of ['', 'ab', 'aabb', 'abab']) {
      expect(simulate(leer, W(w)).result, w).toBe('accepted');
    }
  });

  it('nicht vollständig gelesen oder Keller nicht leer: aab, ba, abba abgelehnt', () => {
    for (const w of ['aab', 'ba', 'abba']) {
      expect(simulate(leer, W(w)).result, w).toBe('rejected');
    }
  });

  it('edit.setAcceptBy: empty setzt, final entfernt das Feld', () => {
    const e = edit.setAcceptBy(leer, 'empty');
    expect(e.acceptBy).toBe('empty');
    const f = edit.setAcceptBy(leer, 'final');
    expect(f.acceptBy).toBeUndefined();
  });

  it('Round-Trip Text: Drucker schreibt „akzeptanz leer“, Wiedereinlesen behält acceptBy', () => {
    const printed = printDocument({ version: 1, objects: [leer] });
    expect(printed).toContain('akzeptanz leer');
    const back = parseOne(printed);
    expect(back.errors).toEqual([]);
    expect((back.objects[0] as NKA).acceptBy).toBe('empty');
  });

  it('Round-Trip JSON: fromJSON(toJSON) ergibt dasselbe Dokument mit acceptBy empty', () => {
    const doc = { version: 1 as const, objects: [leer] };
    const back = fromJSON(toJSON(doc));
    expect(back.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(back.doc).toEqual(doc);
  });

  it('Standard (final): Drucker schreibt keine Zeile „akzeptanz“', () => {
    const nka = parseOne(readFileSync(join(EX, 'b4-6.txt'), 'utf8')).objects[0] as NKA;
    expect(printDocument({ version: 1, objects: [nka] })).not.toContain('akzeptanz');
  });

  it('gleicher Automat mit final und ohne Endzustand akzeptiert nichts: ab abgelehnt', () => {
    const finalMode = edit.setAcceptBy(leer, 'final');
    expect(simulate(finalMode, W('ab')).result).toBe('rejected');
  });
});

describe('Grammatik 4.16 Sprache über den Automaten (Kontrolle)', () => {
  it('cfgWords(4.16, 4) und Automat aus grammarToNka akzeptieren dieselben Wörter bis Länge 4', () => {
    const nk = grammarToNka(G416);
    expect(nk.ok).toBe(true);
    if (!nk.ok) return;
    const words = new Set(cfgWords(G416, 4).words.map(str));
    for (const w of allWords(['(', ')'], 4)) {
      expect(simulate(nk.result, W(w)).result === 'accepted', w).toBe(words.has(w));
    }
  });
});
