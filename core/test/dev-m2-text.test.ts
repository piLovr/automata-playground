import { describe, expect, it } from 'vitest';
import {
  fromJSON,
  grammarType,
  isStale,
  objectHash,
  parseDocument,
  parseGrammarWord,
  parseRegex,
  printDocument,
  printGrammarWord,
  printObject,
  printRegex,
  reconcile,
  regexSize,
  regexSpans,
  regexSymbols,
  subexprAt,
  toJSON,
  validate,
} from '../index';
import type { FormalObject, Grammar, RegexObj } from '../index';

const table: [string, string, string][] = [
  ['∅', '∅', '∅'],
  ['(01)', '01', '(01)'],
  ['((01)0)', '010', '((01)0)'],
  ['((01)(00))', '01(00)', '((01)(00))'],
  ['(∅|1)', '∅|1', '(∅|1)'],
  ['((0(0|1))|1)', '0(0|1)|1', '((0(0|1))|1)'],
  ['(0|(1|(0|0)))', '0|(1|(0|0))', '(0|(1|(0|0)))'],
  ['(∅*)', '∅*', '(∅*)'],
  ['((10)(1*))', '101*', '((10)(1*))'],
  ['(((10)1)*)', '(101)*', '(((10)1)*)'],
  ['((0*)*)', '0**', '((0*)*)'],
  ['(((((01)1)*)*)|(∅*))', '(011)**|∅*', '(((((01)1)*)*)|(∅*))'],
];

describe('Ausdruck 2.22', () => {
  for (const [strict, std] of table.map(([a, b]) => [a, b] as const)) {
    it(`${strict} <-> ${std}`, () => {
      const a = parseRegex(strict);
      expect(a.diagnostics).toEqual([]);
      const b = parseRegex(std);
      expect(b.diagnostics).toEqual([]);
      expect(a.expr).toEqual(b.expr);
      expect(printRegex(a.expr!)).toBe(std);
      expect(printRegex(a.expr!, { strict: true })).toBe(strict);
    });
  }

  it('Linksklammerung und Präzedenz', () => {
    expect(printRegex(parseRegex('a|b|c').expr!, { strict: true })).toBe('((a|b)|c)');
    expect(printRegex(parseRegex('abc').expr!, { strict: true })).toBe('((ab)c)');
    expect(printRegex(parseRegex('a|bc*').expr!, { strict: true })).toBe('(a|(b(c*)))');
  });

  it('ε, \\0, \\e, Maskierung', () => {
    expect(parseRegex('ε').expr).toEqual({ op: 'star', inner: { op: 'empty' } });
    expect(printRegex(parseRegex('\\e').expr!)).toBe('∅*');
    expect(parseRegex('\\0').expr).toEqual({ op: 'empty' });
    expect(parseRegex('eps').expr).toEqual(parseRegex('e p s').expr);
    const e = parseRegex('\\|\\(\\*\\∅').expr!;
    expect(regexSymbols(e)).toEqual(['|', '(', '*', '∅']);
    expect(printRegex(e)).toBe('\\|\\(\\*\\∅');
    expect(parseRegex('<ab>c').expr).toEqual(parseRegex('<ab> c').expr);
  });

  const codes = (t: string): string[] => parseRegex(t).diagnostics.map((d) => d.code);
  it('Fehler', () => {
    expect(parseRegex('(|1)').diagnostics[0]).toMatchObject({
      code: 'regex.missingOperand',
      params: { op: '|', side: 'left' },
      line: 1,
      col: 2,
    });
    expect(parseRegex('|∅|').diagnostics.map((d) => d.params)).toEqual([
      { op: '|', side: 'left' },
      { op: '|', side: 'right' },
    ]);
    expect(codes('()01')).toEqual(['regex.emptyParens']);
    expect(parseRegex('((01)').diagnostics[0]).toMatchObject({ code: 'regex.unbalanced', params: { open: 1 }, col: 1 });
    expect(parseRegex('01)').diagnostics[0]?.code).toBe('regex.unbalanced');
    expect(parseRegex('*(01)').diagnostics[0]).toMatchObject({ code: 'regex.missingOperand', params: { op: '*', side: 'left' } });
    expect(codes('a,b')).toEqual(['syntax.unexpected']);
    expect(parseRegex('(|1)').expr).toBeNull();
  });
  it('Alphabet', () => {
    expect(parseRegex('2*', ['0', '1']).diagnostics[0]).toMatchObject({ code: 'regex.symbolNotInAlphabet', params: { symbol: '2' }, col: 1 });
    expect(parseRegex('2*').diagnostics).toEqual([]);
    expect(parseRegex('').expr).toBeNull();
  });
  it('Größe, Teilausdruck, Spans', () => {
    const e = parseRegex('(0|1)*1').expr!;
    expect(regexSize(e)).toBe(6);
    expect(subexprAt(e, [0, 0])).toEqual(parseRegex('0|1').expr);
    expect(subexprAt(e, [2])).toBeNull();
    const text = printRegex(e);
    const sp = regexSpans(e);
    const at = (p: number[]) => sp.find((s) => JSON.stringify(s.path) === JSON.stringify(p))!;
    expect(text.slice(at([]).from, at([]).to)).toBe(text);
    expect(text.slice(at([0]).from, at([0]).to)).toBe('(0|1)*');
    expect(text.slice(at([0, 0]).from, at([0, 0]).to)).toBe('(0|1)');
    expect(text.slice(at([1]).from, at([1]).to)).toBe('1');
  });
});

const DOC = String.raw`
regex R1 = (0|1)*01   # Kommentar
regex R2 {
  alphabet 0 1 2
  = 0|1
}
dea D {
  start A
  accept ∅
  A -0-> ∅
  ∅ -1-> A
  herkunft minimize aus N@0011aabb
  entspricht z:A <- 0 z:X z:Y
}
nea N {
  start X
  accept Y
  X -0-> Y
  Y -1-> X
}
grammatik G {
  nichtterminale S X0 X1
  terminale 0 1 -
  start S
  S -> 0S | 1S | 01
  X0 -> -X1 | ε
  herkunft regex2grammar aus R1@12345678
  entspricht n:S <- 0 t:r01
  entspricht p:p1 <- 0 t:r
}
`;

describe('Dokument mit Ausdruck, Grammatik, Herkunft', () => {
  const { doc, diagnostics } = parseDocument(DOC);
  it('parst fehlerfrei', () => {
    expect(diagnostics).toEqual([]);
    expect(doc.objects.map((o) => o.kind)).toEqual(['regex', 'regex', 'dea', 'nea', 'grammatik']);
  });
  it('Inhalt', () => {
    const r1 = doc.objects[0] as RegexObj;
    expect(r1.alphabet).toEqual(['0', '1']);
    expect(printRegex(r1.expr!)).toBe('(0|1)*01');
    expect((doc.objects[1] as RegexObj).alphabet).toEqual(['0', '1', '2']);
    const d = doc.objects[2]!;
    if (d.kind !== 'dea') throw new Error();
    expect(d.states.map((s) => s.name)).toEqual(['A', '∅']);
    // Quellzustände über N (X → s0, Y → s1), Zielzustand über D
    expect(d.origin?.corr).toEqual([{ target: { state: 's0' }, source: 0, elems: [{ state: 's0' }, { state: 's1' }] }]);
    const g = doc.objects[4] as Grammar;
    expect(g.productions.map((p) => [p.left, p.right])).toEqual([
      [['S'], ['0', 'S']],
      [['S'], ['1', 'S']],
      [['S'], ['0', '1']],
      [['X0'], ['-', 'X1']],
      [['X0'], []],
    ]);
    expect(g.productions.map((p) => p.id)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
    expect(g.origin?.corr?.[0]).toEqual({ target: { nonterminal: 'S' }, source: 0, elems: [{ subexpr: [0, 1] }] });
  });
  it('Round-Trip Text und JSON', () => {
    const t1 = printDocument(doc);
    const again = parseDocument(t1);
    expect(again.diagnostics).toEqual([]);
    expect(again.doc).toEqual(doc);
    expect(printDocument(again.doc)).toBe(t1);
    expect(t1).toContain('entspricht z:A <- 0 z:X z:Y');
    expect(fromJSON(toJSON(doc)).doc).toEqual(doc);
    expect(printDocument(doc, { origin: false })).not.toContain('herkunft');
  });
  it('Validierung', () => {
    const codes = doc.objects.map((o) => validate(o).map((d) => d.code));
    expect(codes[0]).toEqual([]);
    expect(codes[4]).toEqual([]);
  });
});

describe('Grammatik', () => {
  it('Standardableitung ohne Deklarationen (2.36)', () => {
    const { doc, diagnostics } = parseDocument('grammatik G {\n S -> aSb | ab\n}');
    expect(diagnostics).toEqual([]);
    const g = doc.objects[0] as Grammar;
    expect(g.nonterminals).toEqual(['S']);
    expect(g.terminals).toEqual(['a', 'b']);
    expect(g.start).toBe('S');
    expect(printObject(g)).toBe('grammatik G {\n  nichtterminale S\n  terminale a b\n  start S\n  S -> aSb | ab\n}\n');
  });
  it('mehrbuchstabige Symbole, Längste-Übereinstimmung', () => {
    const text = 'grammatik G {\n nichtterminale X0 X1 X10\n terminale 0\n S -> 0X10 | X0X1\n start X0\n X0 -> 0 X1\n}';
    const g = parseDocument(text).doc.objects[0] as Grammar;
    expect(g.productions[0]?.right).toEqual(['0', 'X10']);
    expect(g.productions[1]?.right).toEqual(['X0', 'X1']);
    const printed = printObject(g);
    expect(printed).toContain('X0 -> 0X1');
    expect(parseDocument(printed).doc.objects[0]).toEqual(g);
    // mehrdeutig -> <>
    const h: Grammar = { ...g, productions: [{ id: 'p0', left: ['X0'], right: ['X', '10'] }] };
    const hp = printObject({ ...h, nonterminals: ['X0', 'X', 'X10'], terminals: ['10', '1', '0'] });
    expect(hp).toContain('<X><10>');
    const back = parseDocument(hp).doc.objects[0] as Grammar;
    expect(back.productions[0]?.right).toEqual(['X', '10']);
  });
  it('Pfeil →, ε/eps, Fehler', () => {
    const g = parseDocument('grammatik G { S → a | eps | ε }').doc.objects[0] as Grammar;
    expect(g.productions.map((p) => p.right)).toEqual([['a'], [], []]);
    const bad = parseDocument('grammatik G {\n S a\n T -> a |\n}');
    expect(bad.diagnostics.map((d) => d.code)).toEqual(['syntax.unexpected', 'syntax.unexpected']);
    expect(bad.diagnostics[0]).toMatchObject({ line: 2 });
  });
  it('Wörter', () => {
    const g = { nonterminals: ['X0', 'S'], terminals: ['a', 'X'] };
    expect(parseGrammarWord('aX0S', g).word).toEqual(['a', 'X0', 'S']);
    expect(parseGrammarWord('ε', g).word).toEqual([]);
    expect(printGrammarWord([], g)).toBe('ε');
    expect(printGrammarWord(['a', 'X0'], g)).toBe('aX0');
    expect(printGrammarWord(['X', '0'], { nonterminals: ['X0'], terminals: ['X', '0'] })).toBe('<X><0>');
  });
  it('Typ-Erkennung', () => {
    const t = (txt: string) => grammarType(parseDocument(txt).doc.objects[0] as Grammar);
    expect(t('grammatik G { S -> 0S | 1S | 01 }').type).toBe(3);
    expect(t('grammatik G { S -> aSb | ab }').type).toBe(2);
    expect(t('grammatik G { S -> aSBC | aBC\n CB -> BC\n aB -> ab }').type).toBe(1);
    expect(t('grammatik G { S -> ε | aSB\n SB -> BS }').startEpsilonRule).toBe(false);
    const eps = t('grammatik G { S -> ε | aTb\n aT -> aTa }');
    expect(eps.type).toBe(1);
    expect(eps.startEpsilonRule).toBe(true);
    expect(t('grammatik G { S -> aA\n A -> b\n aA -> ε }').type).toBe(0);
    expect(t('grammatik G { S -> aS | ε }').productions.map((p) => p.reason)).toEqual(['rightLinear', 'rightLinear']);
    expect(t('grammatik G { S -> Sa | a }').type).toBe(2);
  });
  it('Prüfung', () => {
    const g = (txt: string) => validate(parseDocument(txt).doc.objects[0]!).map((d) => d.code);
    expect(g('grammatik G { nichtterminale S\n terminale a S\n start S\n S -> a }')).toEqual(['grammar.overlap']);
    expect(g('grammatik G { nichtterminale S\n terminale a\n start a\n S -> aX }')).toEqual([
      'grammar.startNotNonterminal',
      'grammar.unknownSymbol',
    ]);
    expect(g('grammatik G { nichtterminale S\n terminale a\n a -> a }')).toEqual(['grammar.noStart', 'grammar.leftNoNonterminal']);
    expect(validate(parseDocument('regex R { alphabet 0\n = 01 }').doc.objects[0]!).map((d) => d.params)).toEqual([{ symbol: '1' }]);
    expect(validate(parseDocument('regex R { alphabet 0 }').doc.objects[0]!).map((d) => d.code)).toEqual(['regex.noExpr']);
  });
});

describe('Hash und veraltet', () => {
  it('Hash unabhängig von Name und Layout, abhängig vom Inhalt', () => {
    const d = parseDocument('dea A { start 0\n accept 1\n 0 -a-> 1\n layout 0@1,2 }\ndea B { start 0\n accept 1\n 0 -a-> 1 }\ndea C { start 0\n 0 -a-> 1 }').doc;
    const [a, b, c] = d.objects as [FormalObject, FormalObject, FormalObject];
    expect(objectHash(a)).toMatch(/^[0-9a-f]{8}$/);
    expect(objectHash(a)).toBe(objectHash(b));
    expect(objectHash(a)).not.toBe(objectHash(c));
    const r1 = parseDocument('regex R = 0|1').doc.objects[0]!;
    const r2 = parseDocument('regex Q = 0|1').doc.objects[0]!;
    expect(objectHash(r1)).toBe(objectHash(r2));
    expect(objectHash(r1)).not.toBe(objectHash(parseDocument('regex R = 0|2').doc.objects[0]!));
  });
  it('isStale', () => {
    const base = parseDocument('regex R = 0|1').doc.objects[0]!;
    const h = objectHash(base);
    const mk = (hash: string) =>
      parseDocument(`regex R = 0|1\ngrammatik G {\n S -> 0\n herkunft regex2grammar aus R@${hash}\n}`).doc;
    expect(isStale(mk(h).objects[1]!, mk(h))).toBe(false);
    expect(isStale(mk('00000000').objects[1]!, mk('00000000'))).toBe(true);
    expect(isStale(mk(h).objects[1]!, { version: 1, objects: [] })).toBe(true);
    expect(isStale(base, mk(h))).toBe(false);
  });
});

describe('reconcile Grammatik', () => {
  it('behält IDs gleicher Produktionen', () => {
    const prev = parseDocument('grammatik G { S -> a | b | c }').doc.objects[0]!;
    const next = parseDocument('grammatik G { S -> c | a | d }').doc.objects[0]!;
    const r = reconcile(prev, next) as Grammar;
    expect(r.productions.map((p) => p.id)).toEqual(['p2', 'p0', 'p3']);
  });
});

describe('JSON-Prüfung', () => {
  it('lehnt fehlerhafte Ausdrücke, Grammatiken und Herkunft ab', () => {
    const bad = (o: unknown) => fromJSON(JSON.stringify({ version: 1, objects: [o] })).doc === undefined;
    expect(bad({ kind: 'regex', name: 'R', alphabet: [], expr: { op: 'foo' } })).toBe(true);
    expect(bad({ kind: 'regex', name: 'R', alphabet: [], expr: null, origin: { method: 'nope', sources: [], sourceHash: [] } })).toBe(true);
    expect(bad({ kind: 'grammatik', name: 'G', nonterminals: [], terminals: [], start: null, productions: [{ id: 'p', left: [], right: [] }, { id: 'p', left: [], right: [] }] })).toBe(true);
    expect(bad({ kind: 'regex', name: 'R', alphabet: [], expr: null })).toBe(false);
  });
});
