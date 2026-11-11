// M2, Teil C Punkt 1: Text, JSON, Ausdrücke, Grammatiken, Herkunft.
// Erwartungen aus docs/kern-spec-m2.md (Teil A) und docs/skript-notizen-m2.md (2.22, 2.36–2.44, 2.45, 5.1).
// Nur die öffentliche Schnittstelle core/index.ts.

import { describe, expect, it } from 'vitest';
import {
  emptyObject,
  fromJSON,
  grammarType,
  isAutomaton,
  parseDocument,
  parseRegex,
  printDocument,
  printObject,
  printRegex,
  regexSize,
  regexSymbols,
  subexprAt,
  toJSON,
  validate,
} from '../index';
import type { Diagnostic, Document, FormalObject, Grammar, RegExpr, RegexObj } from '../index';

// ---------------------------------------------------------------------------
// Hilfsfunktionen (Testseite)

const sym = (s: string): RegExpr => ({ op: 'sym', sym: s });
const EMPTY: RegExpr = { op: 'empty' };
/** ε wird als ∅* gelesen (Entscheidung 1). */
const EPS: RegExpr = { op: 'star', inner: { op: 'empty' } };
const uni = (left: RegExpr, right: RegExpr): RegExpr => ({ op: 'union', left, right });
const cat = (left: RegExpr, right: RegExpr): RegExpr => ({ op: 'concat', left, right });
const star = (inner: RegExpr): RegExpr => ({ op: 'star', inner });

function parseRe(text: string, alphabet?: string[]): RegExpr {
  const r = parseRegex(text, alphabet);
  expect(r.diagnostics, `Diagnosen für ${text}`).toEqual([]);
  expect(r.expr, `Ausdruck für ${text}`).not.toBeNull();
  return r.expr as RegExpr;
}

function reDiags(text: string, alphabet?: string[]): Diagnostic[] {
  return parseRegex(text, alphabet).diagnostics;
}

function parseOne(text: string): FormalObject {
  const r = parseDocument(text);
  expect(r.diagnostics, 'Diagnosen beim Parsen').toEqual([]);
  expect(r.doc.objects).toHaveLength(1);
  return r.doc.objects[0] as FormalObject;
}

function parseGrammar(text: string): Grammar {
  const o = parseOne(text);
  expect(o.kind).toBe('grammatik');
  return o as Grammar;
}

/** Produktionen ohne IDs, zum Vergleich der Symbolfolgen. */
const prodsLR = (g: Grammar) => g.productions.map((p) => ({ left: p.left, right: p.right }));
const P = (left: string[], right: string[]) => ({ left, right });

function stateIdOf(o: { states: { id: string; name: string }[] }, name: string): string {
  const s = o.states.find((x) => x.name === name);
  expect(s, `Zustand ${name} fehlt`).toBeDefined();
  return s!.id;
}

// ---------------------------------------------------------------------------
// 2.22 Beispiele: Hin- und Rückweg

/** [Spalte „mit Klammern“ = strenge Form, Spalte „ohne Klammern“ = Standardform]. */
const TABLE_222: [string, string][] = [
  ['∅', '∅'],
  ['0', '0'],
  ['1', '1'],
  ['(01)', '01'],
  ['((01)0)', '010'],
  ['(((01)0)0)', '0100'],
  ['((01)(00))', '01(00)'],
  ['(∅|1)', '∅|1'],
  ['(0|1)', '0|1'],
  ['((0(0|1))|1)', '0(0|1)|1'],
  // Skript lässt die äußeren Klammern stehen: Standardform laut Spezifikation 0|(1|(0|0))
  ['(0|(1|(0|0)))', '0|(1|(0|0))'],
  ['(∅*)', '∅*'],
  ['(0*)', '0*'],
  ['((10)(1*))', '101*'],
  ['(((10)1)*)', '(101)*'],
  ['((0*)*)', '0**'],
  ['(((((01)1)*)*)|(∅*))', '(011)**|∅*'],
];

describe('2.22 Beispiele: Hin- und Rückweg', () => {
  it.each(TABLE_222)('mit Klammern %s ⇄ ohne Klammern %s', (withP, withoutP) => {
    const expr = parseRe(withP);
    expect(printRegex(expr, { strict: true })).toBe(withP);
    expect(printRegex(expr)).toBe(withoutP);
    expect(parseRe(withoutP)).toEqual(expr);
    expect(printRegex(parseRe(withoutP))).toBe(withoutP);
  });
});

// ---------------------------------------------------------------------------
// 2.22 falsche Ausdrücke

describe('2.22 falsche Ausdrücke mit Codes', () => {
  it('(|1): regex.missingOperand, op |, side left', () => {
    const d = reDiags('(|1)').find((x) => x.code === 'regex.missingOperand');
    expect(d).toBeDefined();
    expect(d!.severity).toBe('error');
    expect(d!.params).toMatchObject({ op: '|', side: 'left' });
  });

  it('|∅|: vor und hinter | fehlt je ein Ausdruck (side left und right)', () => {
    const sides = reDiags('|∅|')
      .filter((x) => x.code === 'regex.missingOperand' && x.params.op === '|')
      .map((x) => x.params.side);
    expect(sides).toContain('left');
    expect(sides).toContain('right');
  });

  it('()01: regex.emptyParens', () => {
    expect(reDiags('()01').map((x) => x.code)).toContain('regex.emptyParens');
  });

  it('((01): regex.unbalanced', () => {
    expect(reDiags('((01)').map((x) => x.code)).toContain('regex.unbalanced');
  });

  it('*(01): regex.missingOperand, op *, side left', () => {
    const d = reDiags('*(01)').find((x) => x.code === 'regex.missingOperand');
    expect(d).toBeDefined();
    expect(d!.params).toMatchObject({ op: '*', side: 'left' });
  });

  it('2* mit Alphabet {0,1}: parseRegex meldet regex.symbolNotInAlphabet für 2', () => {
    const d = reDiags('2*', ['0', '1']).find((x) => x.code === 'regex.symbolNotInAlphabet');
    expect(d).toBeDefined();
    expect(d!.params).toMatchObject({ symbol: '2' });
  });

  it('2* ohne Alphabet: der Parser meldet nichts', () => {
    expect(reDiags('2*')).toEqual([]);
  });

  it('2* über {0,1} meldet validate (regex.symbolNotInAlphabet)', () => {
    const obj: RegexObj = { kind: 'regex', name: 'R', alphabet: ['0', '1'], expr: parseRe('2*') };
    const errs = validate(obj).filter((x) => x.severity === 'error');
    expect(errs.map((x) => x.code)).toContain('regex.symbolNotInAlphabet');
  });

  it('Fehler im Dokument tragen Zeile und Spalte', () => {
    const r = parseDocument('regex R = (|1)\n');
    const d = r.diagnostics.find((x) => x.code === 'regex.missingOperand');
    expect(d).toBeDefined();
    expect(d!.line).toBe(1);
    expect(typeof d!.col).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Präzedenz, Linksklammerung, Leerraum

describe('Präzedenz und Linksklammerung (2.21)', () => {
  const A = sym('a');
  const B = sym('b');
  const C = sym('c');
  const AB = ['a', 'b', 'c'];

  it('a|bc* ist a|(b(c*))', () => {
    expect(parseRe('a|bc*', AB)).toEqual(uni(A, cat(B, star(C))));
  });
  it('a|b|c ist ((a|b)|c)', () => {
    expect(parseRe('a|b|c', AB)).toEqual(uni(uni(A, B), C));
  });
  it('abc ist ((ab)c)', () => {
    expect(parseRe('abc', AB)).toEqual(cat(cat(A, B), C));
  });
  it('ab* ist a(b*)', () => {
    expect(parseRe('ab*', AB)).toEqual(cat(A, star(B)));
  });
  it('(ab)* ist (ab)*', () => {
    expect(parseRe('(ab)*', AB)).toEqual(star(cat(A, B)));
  });
  it('a(b|c) ist a(b|c)', () => {
    expect(parseRe('a(b|c)', AB)).toEqual(cat(A, uni(B, C)));
  });

  it('Standardform: rechts verschachteltes | braucht Klammern (a|(b|c))', () => {
    expect(printRegex(uni(A, uni(B, C)))).toBe('a|(b|c)');
    expect(printRegex(uni(A, uni(B, C)), { strict: true })).toBe('(a|(b|c))');
  });
  it('Standardform: links verschachteltes | ohne Klammern (a|b|c)', () => {
    expect(printRegex(uni(uni(A, B), C))).toBe('a|b|c');
  });
  it('Standardform: rechts verschachtelte Konkatenation braucht Klammern (a(bc))', () => {
    expect(printRegex(cat(A, cat(B, C)))).toBe('a(bc)');
  });
  it('(a|b)* in Standardform (a|b)*, strenge Form ((a|b)*)', () => {
    const e = star(uni(A, B));
    expect(printRegex(e)).toBe('(a|b)*');
    expect(printRegex(e, { strict: true })).toBe('((a|b)*)');
  });
  it('a** bleibt a** (Stern auf Stern)', () => {
    expect(printRegex(star(star(A)))).toBe('a**');
  });
  it('Leerraum im Ausdruck wird ignoriert', () => {
    expect(parseRe(' 0 1 ')).toEqual(cat(sym('0'), sym('1')));
    expect(printRegex(parseRe(' 0 | 1 '))).toBe('0|1');
  });
});

// ---------------------------------------------------------------------------
// ε, ASCII-Ersatz, Maskierung

describe('ε, \\0, \\e und Maskierung', () => {
  it('ε wird als ∅* gelesen', () => {
    expect(parseRe('ε')).toEqual(EPS);
  });
  it('\\e ist ε, also ∅*', () => {
    expect(parseRe('\\e')).toEqual(EPS);
  });
  it('ε wird als ∅* gedruckt', () => {
    expect(printRegex(EPS)).toBe('∅*');
  });
  it('0|ε ist 0|∅* (Druck 0|∅*)', () => {
    expect(parseRe('0|ε')).toEqual(uni(sym('0'), EPS));
    expect(printRegex(uni(sym('0'), EPS))).toBe('0|∅*');
  });
  it('\\0 ist ∅', () => {
    expect(parseRe('\\0')).toEqual(EMPTY);
  });
  it('eps ist kein ε, sondern drei Symbole e, p, s', () => {
    const e = parseRe('eps');
    expect(regexSymbols(e)).toEqual(['e', 'p', 's']);
    expect(printRegex(e)).toBe('eps');
  });
  it('\\| ist das Symbol |; der Druck maskiert es wieder', () => {
    expect(parseRe('\\|')).toEqual(sym('|'));
    expect(printRegex(sym('|'))).toBe('\\|');
  });
  it('\\( \\) \\* \\∅ sind Symbole (, ), *, ∅', () => {
    const e = cat(cat(cat(sym('('), sym(')')), sym('*')), sym('∅'));
    expect(parseRe('\\(\\)\\*\\∅')).toEqual(e);
    expect(printRegex(e)).toBe('\\(\\)\\*\\∅');
  });
});

// ---------------------------------------------------------------------------
// Symbole, Größe, Teilausdrücke

describe('regexSymbols, regexSize, subexprAt', () => {
  it('regexSymbols in Reihenfolge des ersten Auftretens', () => {
    expect(regexSymbols(parseRe('1(0|1)0'))).toEqual(['1', '0']);
  });
  it('regexSymbols des leeren Ausdrucks ist leer', () => {
    expect(regexSymbols(EMPTY)).toEqual([]);
  });
  it('regexSize zählt Knoten: ∅ = 1, 0 = 1, 01 = 3, 0|1 = 3, (01)* = 4, ε = 2', () => {
    expect(regexSize(EMPTY)).toBe(1);
    expect(regexSize(sym('0'))).toBe(1);
    expect(regexSize(parseRe('01'))).toBe(3);
    expect(regexSize(parseRe('0|1'))).toBe(3);
    expect(regexSize(parseRe('(01)*'))).toBe(4);
    expect(regexSize(parseRe('ε'))).toBe(2);
  });
  it('subexprAt: Pfade ab der Wurzel, 0 = left/inner, 1 = right', () => {
    const e = parseRe('0(1|0)');
    expect(subexprAt(e, [])).toEqual(e);
    expect(subexprAt(e, [0])).toEqual(sym('0'));
    expect(subexprAt(e, [1, 0])).toEqual(sym('1'));
    expect(subexprAt(e, [1, 1])).toEqual(sym('0'));
  });
  it('subexprAt: ungültiger Pfad ergibt null', () => {
    const e = parseRe('0(1|0)');
    expect(subexprAt(e, [0, 0])).toBeNull();
    expect(subexprAt(e, [5])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Ausdruck im Dokument

describe('Ausdruck als Objekt', () => {
  it('Kurzform druckt nach Standardform: regex R = (011)**|∅*', () => {
    expect(printObject(parseOne('regex R = (011)**|∅*')).trim()).toBe('regex R = (011)**|∅*');
  });
  it('Kurzform: Alphabet ist Symbolmenge des Ausdrucks in Reihenfolge des ersten Auftretens', () => {
    const o = parseOne('regex R = 1(0|1)0') as RegexObj;
    expect(o.kind).toBe('regex');
    expect(o.alphabet).toEqual(['1', '0']);
  });
  it('emptyObject("regex") hat expr null', () => {
    const o = emptyObject('regex', 'R') as RegexObj;
    expect(o.kind).toBe('regex');
    expect(o.name).toBe('R');
    expect(o.expr).toBeNull();
  });
  it('isAutomaton: DEA ja, Ausdruck und Grammatik nein', () => {
    expect(isAutomaton(emptyObject('dea', 'D'))).toBe(true);
    expect(isAutomaton(emptyObject('regex', 'R'))).toBe(false);
    expect(isAutomaton(emptyObject('grammatik', 'G'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Grammatik: 2.36, 2.37, 2.38, 2.44

const G236 = `grammatik G {
  nichtterminale X
  terminale 0 1
  start X
  X -> 01 | 0X1
}`;

const G237 = `grammatik G {
  nichtterminale B Q S X Y Z
  terminale a
  start S
  S -> aXBZ
  XB -> Q
  QB -> Q
  QZ -> ε
  XB -> aXYB
  YB -> aaBY
  YZ -> BZ
  Xa -> aX
  Ba -> aB
}`;

const G238 = `grammatik Gleit {
  nichtterminale Xz Xm Xv Xn Xe Xb
  terminale 0 1 - . E
  start Xz
  Xz -> XmXvXnXe
  Xm -> - | ε
  Xv -> Xb
  Xn -> .Xb | ε
  Xe -> EXmXb | ε
  Xb -> 0Xb | 1Xb | 0 | 1
}`;

const G238_BRACKETS = `grammatik Gleit2 {
  nichtterminale <Xz> <Xm> <Xv> <Xn> <Xe> <Xb>
  terminale 0 1 - . E
  start <Xz>
  <Xz> -> <Xm><Xv><Xn><Xe>
  <Xm> -> - | ε
  <Xv> -> <Xb>
  <Xn> -> .<Xb> | ε
  <Xe> -> E<Xm><Xb> | ε
  <Xb> -> 0<Xb> | 1<Xb> | 0 | 1
}`;

const G244 = `grammatik G244 {
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
}`;

describe('Grammatik 2.36', () => {
  it('parst ohne Diagnosen, N = {X}, T = {0,1}, S = X', () => {
    const g = parseGrammar(G236);
    expect(g.nonterminals).toEqual(['X']);
    expect(g.terminals).toEqual(['0', '1']);
    expect(g.start).toBe('X');
  });
  it('zwei Produktionen p0: X → 01, p1: X → 0X1', () => {
    const g = parseGrammar(G236);
    expect(g.productions.map((p) => p.id)).toEqual(['p0', 'p1']);
    expect(prodsLR(g)).toEqual([P(['X'], ['0', '1']), P(['X'], ['0', 'X', '1'])]);
  });
  it('ohne Deklarationen: N = {X} (Großbuchstabe), T = {0,1}, S = X', () => {
    const g = parseGrammar('grammatik G {\n  X -> 01 | 0X1\n}');
    expect(g.nonterminals).toEqual(['X']);
    expect(g.terminals).toEqual(['0', '1']);
    expect(g.start).toBe('X');
  });
  it('kanonischer Druck', () => {
    const g = parseOne(G236);
    expect(printObject(g).trim()).toBe(
      'grammatik G {\n  nichtterminale X\n  terminale 0 1\n  start X\n  X -> 01 | 0X1\n}',
    );
  });
});

describe('Grammatik 2.37', () => {
  it('parst ohne Diagnosen, neun Produktionen in Textreihenfolge', () => {
    const g = parseGrammar(G237);
    expect(g.nonterminals).toEqual(['B', 'Q', 'S', 'X', 'Y', 'Z']);
    expect(g.terminals).toEqual(['a']);
    expect(g.start).toBe('S');
    expect(prodsLR(g)).toEqual([
      P(['S'], ['a', 'X', 'B', 'Z']),
      P(['X', 'B'], ['Q']),
      P(['Q', 'B'], ['Q']),
      P(['Q', 'Z'], []),
      P(['X', 'B'], ['a', 'X', 'Y', 'B']),
      P(['Y', 'B'], ['a', 'a', 'B', 'Y']),
      P(['Y', 'Z'], ['B', 'Z']),
      P(['X', 'a'], ['a', 'X']),
      P(['B', 'a'], ['a', 'B']),
    ]);
  });
});

describe('Grammatik 2.38 (Gleitkommazahl)', () => {
  it('deklarierte Namen: zwölf Produktionen, S = Xz', () => {
    const g = parseGrammar(G238);
    expect(g.start).toBe('Xz');
    expect(g.nonterminals).toEqual(['Xz', 'Xm', 'Xv', 'Xn', 'Xe', 'Xb']);
    expect(g.terminals).toEqual(['0', '1', '-', '.', 'E']);
    expect(g.productions).toHaveLength(12);
    expect(prodsLR(g)).toEqual([
      P(['Xz'], ['Xm', 'Xv', 'Xn', 'Xe']),
      P(['Xm'], ['-']),
      P(['Xm'], []),
      P(['Xv'], ['Xb']),
      P(['Xn'], ['.', 'Xb']),
      P(['Xn'], []),
      P(['Xe'], ['E', 'Xm', 'Xb']),
      P(['Xe'], []),
      P(['Xb'], ['0', 'Xb']),
      P(['Xb'], ['1', 'Xb']),
      P(['Xb'], ['0']),
      P(['Xb'], ['1']),
    ]);
  });
  it('spitze Klammern <Xz> liefern dieselben Symbole', () => {
    const a = parseGrammar(G238);
    const b = parseGrammar(G238_BRACKETS);
    expect(prodsLR(b)).toEqual(prodsLR(a));
    expect(b.start).toBe('Xz');
  });
  it('kanonischer Druck schreibt mehrbuchstabige Nichtterminale ohne <>, wo eindeutig', () => {
    const printed = printObject(parseOne(G238));
    expect(printed).toContain('  Xz -> XmXvXnXe');
  });
});

describe('Grammatik 2.44 (Typ 3)', () => {
  it('parst ohne Diagnosen, 22 Produktionen, S = X0', () => {
    const g = parseGrammar(G244);
    expect(g.nonterminals).toEqual(['X0', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7']);
    expect(g.terminals).toEqual(['0', '1', '-', '.', 'E']);
    expect(g.start).toBe('X0');
    expect(prodsLR(g)).toEqual([
      P(['X0'], ['-', 'X1']),
      P(['X0'], ['X1']),
      P(['X1'], ['0', 'X2']),
      P(['X1'], ['1', 'X2']),
      P(['X2'], ['0', 'X2']),
      P(['X2'], ['1', 'X2']),
      P(['X2'], []),
      P(['X2'], ['X3']),
      P(['X3'], ['.', '0', 'X4']),
      P(['X3'], ['.', '1', 'X4']),
      P(['X3'], ['X5']),
      P(['X4'], ['0', 'X4']),
      P(['X4'], ['1', 'X4']),
      P(['X4'], []),
      P(['X4'], ['X5']),
      P(['X5'], ['E', '-', 'X6']),
      P(['X5'], ['E', 'X6']),
      P(['X6'], ['0', 'X7']),
      P(['X6'], ['1', 'X7']),
      P(['X7'], ['0', 'X7']),
      P(['X7'], ['1', 'X7']),
      P(['X7'], []),
    ]);
  });
  it('kanonischer Druck enthält „X0 -> -X1 | X1“ ohne <>', () => {
    expect(printObject(parseOne(G244))).toContain('  X0 -> -X1 | X1');
  });
});

// ---------------------------------------------------------------------------
// Grammatik: kanonischer Druck laut Spezifikation

describe('Grammatik: kanonischer Druck und Round-Trip', () => {
  const CANON = `grammatik G {
  nichtterminale S X
  terminale 0 1
  start S
  S -> 0S | 1S | 01
  X -> ε
}`;
  it('Beispiel aus kern-spec-m2 wird exakt wieder gedruckt', () => {
    expect(printObject(parseOne(CANON)).trim()).toBe(CANON);
  });
  it('Text-Round-Trip ist stabil (2.36, 2.37, 2.38, 2.44)', () => {
    for (const t of [G236, G237, G238, G244]) {
      const once = printDocument(parseDocument(t).doc);
      const twice = printDocument(parseDocument(once).doc);
      expect(twice).toBe(once);
    }
  });
});

// ---------------------------------------------------------------------------
// Typ-Erkennung grammarType

describe('grammarType', () => {
  it('2.36 ist Typ 2: X → 01 rechtslinear (3), X → 0X1 kontextfrei (2)', () => {
    const info = grammarType(parseGrammar(G236));
    expect(info.type).toBe(2);
    expect(info.productions.map((p) => [p.type, p.reason])).toEqual([
      [3, 'rightLinear'],
      [2, 'contextFree'],
    ]);
    expect(info.startEpsilonRule).toBe(false);
  });

  it('2.37 ist Typ 0: XB → Q schrumpft', () => {
    const info = grammarType(parseGrammar(G237));
    expect(info.type).toBe(0);
    const byId = Object.fromEntries(info.productions.map((p) => [p.id, p]));
    // p0: S → aXBZ (kontextfrei), p1: XB → Q (schrumpft), p3: QZ → ε (schrumpft)
    expect(byId['p0']).toMatchObject({ type: 2, reason: 'contextFree' });
    expect(byId['p1']).toMatchObject({ type: 0, reason: 'shrinking' });
    expect(byId['p3']).toMatchObject({ type: 0, reason: 'shrinking' });
  });

  it('2.38 ist Typ 2', () => {
    expect(grammarType(parseGrammar(G238)).type).toBe(2);
  });

  it('2.44 ist Typ 3, alle Produktionen rechtslinear', () => {
    const info = grammarType(parseGrammar(G244));
    expect(info.type).toBe(3);
    expect(info.productions.every((p) => p.type === 3 && p.reason === 'rightLinear')).toBe(true);
  });

  // Sonderregel S → ε (5.1): Ausgangsbeispiel mit Typ-1-Produktion Ab → bAb.
  // Hinweis: Nach der Reihenfolge in kern-spec-m2 ist S → ε schon rechtslinear (Typ 3, 2.45),
  // dort greift startEpsilon nie. Der Test folgt der erklärten Absicht („ausgenommen S → ε nach 5.1“).
  it('S → ε mit S nur links: Gesamttyp 1, startEpsilonRule true', () => {
    const info = grammarType(
      parseGrammar('grammatik G {\n  nichtterminale S A\n  terminale a b\n  start S\n  S -> ε | a\n  Ab -> bAb\n}'),
    );
    expect(info.type).toBe(1);
    expect(info.startEpsilonRule).toBe(true);
  });

  it('S → ε, aber S auf einer rechten Seite: Gesamttyp 0, startEpsilonRule false', () => {
    const info = grammarType(
      parseGrammar('grammatik G {\n  nichtterminale S A\n  terminale a b\n  start S\n  S -> ε | a\n  Ab -> bSb\n}'),
    );
    expect(info.type).toBe(0);
    expect(info.startEpsilonRule).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Herkunft und Entsprechungen

const HERKUNFT = `regex R1 = (0|1)*01

nea N1 {
  alphabet 0 1
  states A B
  start A
  accept B
  A -0-> A
  A -0-> B
  B -1-> B
}

dea D1 {
  alphabet 0 1
  states A AB
  start A
  accept AB
  herkunft nea2dea aus N1@3fa2c1d0
  entspricht z:AB <- 0 z:A z:B
  entspricht z:A <- 0 z:A
  A -0-> AB
  A -1-> A
  AB -0-> AB
  AB -1-> A
}

grammatik G1 {
  nichtterminale X0 X1
  terminale 0 1
  start X0
  X0 -> 0X0 | 1X0 | 0X1
  X1 -> ε
  herkunft regex2grammar aus R1@1a2b3c4d
  entspricht n:<X0> <- 0 t:r
  entspricht n:<X1> <- 0 t:r01
}
`;

describe('Herkunft und Entsprechungen', () => {
  const doc: Document = parseDocument(HERKUNFT).doc;
  const diags = parseDocument(HERKUNFT).diagnostics;

  it('parst ohne Diagnosen in vier Objekten', () => {
    expect(diags).toEqual([]);
    expect(doc.objects.map((o) => o.kind)).toEqual(['regex', 'nea', 'dea', 'grammatik']);
  });

  it('dea D1: origin mit method, sources, sourceHash', () => {
    const d1 = doc.objects[2] as FormalObject & { origin?: unknown };
    expect(d1.origin).toMatchObject({
      method: 'nea2dea',
      sources: ['N1'],
      sourceHash: ['3fa2c1d0'],
    });
  });

  it('dea D1: Entsprechungen mit Zielzuständen von D1 und Quellzuständen von N1', () => {
    const d1 = doc.objects[2] as FormalObject & { states: { id: string; name: string }[] };
    const n1 = doc.objects[1] as FormalObject & { states: { id: string; name: string }[] };
    const origin = (d1 as unknown as { origin: { corr: unknown[] } }).origin;
    expect(origin.corr).toEqual([
      {
        target: { state: stateIdOf(d1, 'AB') },
        source: 0,
        elems: [{ state: stateIdOf(n1, 'A') }, { state: stateIdOf(n1, 'B') }],
      },
      {
        target: { state: stateIdOf(d1, 'A') },
        source: 0,
        elems: [{ state: stateIdOf(n1, 'A') }],
      },
    ]);
  });

  it('grammatik G1: origin und Entsprechungen mit n: und t:', () => {
    const g1 = doc.objects[3] as unknown as { origin: unknown };
    expect(g1.origin).toEqual({
      method: 'regex2grammar',
      sources: ['R1'],
      sourceHash: ['1a2b3c4d'],
      corr: [
        { target: { nonterminal: 'X0' }, source: 0, elems: [{ subexpr: [] }] },
        { target: { nonterminal: 'X1' }, source: 0, elems: [{ subexpr: [0, 1] }] },
      ],
    });
  });

  it('Text-Round-Trip ist stabil', () => {
    const once = printDocument(doc);
    const twice = printDocument(parseDocument(once).doc);
    expect(twice).toBe(once);
  });

  it('Dokument-Round-Trip: parse(print(d)).doc deep-equal d', () => {
    expect(parseDocument(printDocument(doc)).doc).toEqual(doc);
  });

  it('origin: false blendet herkunft und entspricht aus', () => {
    const text = printDocument(doc, { origin: false });
    expect(text).not.toContain('herkunft');
    expect(text).not.toContain('entspricht');
  });

  it('origin standardmäßig ausgegeben', () => {
    const text = printDocument(doc);
    expect(text).toContain('herkunft nea2dea aus N1@3fa2c1d0');
    expect(text).toContain('entspricht');
  });
});

// ---------------------------------------------------------------------------
// JSON

describe('JSON: Round-Trip und Prüfung', () => {
  const doc: Document = parseDocument(HERKUNFT).doc;

  it('fromJSON(toJSON(d)).doc deep-equal d (mit Herkunft)', () => {
    const r = fromJSON(toJSON(doc));
    expect(r.diagnostics).toEqual([]);
    expect(r.doc).toEqual(doc);
  });

  it('fromJSON(toJSON(d)) für Ausdruck und Grammatik', () => {
    const d2: Document = {
      version: 1,
      objects: [
        parseOne('regex R = (0|1)*01'),
        parseOne(G244),
      ] as FormalObject[],
    };
    const r = fromJSON(toJSON(d2));
    expect(r.diagnostics).toEqual([]);
    expect(r.doc).toEqual(d2);
  });

  it('JSON mit ungültigem regex-op: json.invalid', () => {
    const json = JSON.stringify({
      version: 1,
      objects: [{ kind: 'regex', name: 'R', alphabet: ['0'], expr: { op: 'plus', inner: { op: 'sym', sym: '0' } } }],
    });
    const r = fromJSON(json);
    expect(r.diagnostics.map((d) => d.code)).toContain('json.invalid');
  });

  it('JSON mit unbekannter Herkunftsmethode: json.invalid', () => {
    const json = JSON.stringify({
      version: 1,
      objects: [
        {
          kind: 'regex',
          name: 'R',
          alphabet: ['0'],
          expr: { op: 'sym', sym: '0' },
          origin: { method: 'erfunden', sources: [], sourceHash: [] },
        },
      ],
    });
    expect(fromJSON(json).diagnostics.map((d) => d.code)).toContain('json.invalid');
  });

  it('JSON mit doppelter Produktions-ID: json.invalid', () => {
    const json = JSON.stringify({
      version: 1,
      objects: [
        {
          kind: 'grammatik',
          name: 'G',
          nonterminals: ['S'],
          terminals: ['0'],
          start: 'S',
          productions: [
            { id: 'p0', left: ['S'], right: ['0'] },
            { id: 'p0', left: ['S'], right: [] },
          ],
        },
      ],
    });
    expect(fromJSON(json).diagnostics.map((d) => d.code)).toContain('json.invalid');
  });

  it('JSON mit falscher Version: json.version', () => {
    const json = JSON.stringify({ version: 2, objects: [] });
    expect(fromJSON(json).diagnostics.map((d) => d.code)).toContain('json.version');
  });
});
