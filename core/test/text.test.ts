import { beforeAll, describe, expect, it } from 'vitest';
import { parseDocument, parseWord, printSymbol, printWord } from '../index';
import type { DEA, Diagnostic } from '../index';
import { DEA_23, asDea, firstObject, idOf } from './fixtures';

describe('Text: Parsen von DEA_23', () => {
  let diagnostics: Diagnostic[] = [];
  let obj!: DEA;
  beforeAll(() => {
    const r = parseDocument(DEA_23);
    diagnostics = r.diagnostics;
    obj = asDea(firstObject(r.doc));
  });

  it('liefert keine Diagnosen', () => {
    expect(diagnostics).toEqual([]);
  });
  it('Zustände in Reihenfolge A, B, M, Q', () => {
    expect(obj.states.map((s) => s.name)).toEqual(['A', 'B', 'M', 'Q']);
  });
  it('Alphabet ist 0, 1, -', () => {
    expect(obj.alphabet).toEqual(['0', '1', '-']);
  });
  it('12 Übergänge (A -0,1-> B ergibt zwei Übergänge, Q -0,1,\\--> Q drei)', () => {
    expect(obj.transitions).toHaveLength(12);
  });
  it('start ist die ID von A', () => {
    expect(obj.start).toBe(idOf(obj, 'A'));
  });
  it('accept ist die ID von B', () => {
    expect(obj.accept).toEqual([idOf(obj, 'B')]);
  });
});

describe('Text: Escapes, Kommentare, eps, states, Namen', () => {
  it('Escapes: Leerzeichen, Komma, Raute und <zahl> als Symbole', () => {
    const text = String.raw`dea Esc {
  alphabet \  \, \# <zahl>
  start p
  p -\ ,\,,<zahl>-> q
  q -\#-> q
}
`;
    const { doc, diagnostics } = parseDocument(text);
    const obj = asDea(firstObject(doc));
    expect(diagnostics).toEqual([]);
    expect(obj.alphabet).toEqual([' ', ',', '#', 'zahl']);
    expect(obj.transitions.map((t) => t.label)).toEqual([' ', ',', 'zahl', '#']);
  });

  it('Kommentare mit # werden ignoriert', () => {
    const text = [
      '# Kopfkommentar',
      'dea Kom { # hinter der Klammer',
      '  alphabet a # Kommentar mitten drin',
      '  start p',
      '  p -a-> p # Ende',
      '}',
      '',
    ].join('\n');
    const { doc, diagnostics } = parseDocument(text);
    const obj = asDea(firstObject(doc));
    expect(diagnostics).toEqual([]);
    expect(obj.alphabet).toEqual(['a']);
    expect(obj.transitions).toHaveLength(1);
  });

  it('eps und ε sind das leere Wort, auch in einer Labelliste', () => {
    const text = [
      'nea EpsA {',
      '  start p',
      '  p -eps-> q',
      '  q -ε-> p',
      '  q -a,eps-> r',
      '}',
      '',
    ].join('\n');
    const { doc, diagnostics } = parseDocument(text);
    expect(diagnostics).toEqual([]);
    const obj = firstObject(doc);
    if (obj.kind !== 'nea') throw new Error('erwartet nea');
    expect(obj.transitions.map((t) => t.label)).toEqual([[], [], ['a'], []]);
  });

  it('states-Zeile bestimmt die Reihenfolge der Zustände', () => {
    const text = 'dea R {\n  states Z Y\n  start Y\n  Y -a-> Z\n}\n';
    const { doc } = parseDocument(text);
    expect(firstObject(doc).states.map((s) => s.name)).toEqual(['Z', 'Y']);
  });

  it('Zustandsnamen dürfen auf - enden (f-), Pfeil nur nach Leerraum', () => {
    const text = 'nea M {\n  start f-\n  f- -a-> z+\n}\n';
    const { doc, diagnostics } = parseDocument(text);
    expect(diagnostics).toEqual([]);
    expect(firstObject(doc).states.map((s) => s.name)).toEqual(['f-', 'z+']);
  });

  it('layout mit negativen und Dezimalzahlen', () => {
    const text = 'nea P {\n  start A\n  A -a-> B\n  layout A@-2.5,3.25 B@80,120\n}\n';
    const { doc, diagnostics } = parseDocument(text);
    expect(diagnostics).toEqual([]);
    const [a, b] = firstObject(doc).states;
    expect(a?.pos).toEqual({ x: -2.5, y: 3.25 });
    expect(b?.pos).toEqual({ x: 80, y: 120 });
  });
});

describe('Text: Fehlerdiagnosen', () => {
  it('leeres Label (A --> B) ist Fehler in Zeile 3 mit \\- im Hinweis', () => {
    const text = ['nea L {', '  start A', '  A --> B', '}', ''].join('\n');
    const { diagnostics } = parseDocument(text);
    const err = diagnostics.find((d) => d.severity === 'error' && d.line === 3);
    expect(err).toBeDefined();
    expect(err?.col).toBeGreaterThan(0);
    expect((err?.params.expected as string[] | undefined)?.some((e) => e.includes('\\-'))).toBe(true);
  });

  it('fehlendes } ergibt syntax.unterminated mit Position', () => {
    const { diagnostics } = parseDocument(['dea G {', '  start A', ''].join('\n'));
    const d = diagnostics.find((x) => x.code === 'syntax.unterminated');
    expect(d).toBeDefined();
    expect(d?.params.what).toBe('object');
    expect(typeof d?.line).toBe('number');
    expect(typeof d?.col).toBe('number');
  });

  it('unbekannte Art ergibt syntax.unknownKind', () => {
    const { diagnostics } = parseDocument('xyz Foo {\n}\n');
    const d = diagnostics.find((x) => x.code === 'syntax.unknownKind');
    expect(d).toBeDefined();
    expect(d?.params.kind).toBe('xyz');
    expect(d?.line).toBe(1);
  });

  it('DEA-Label ab ergibt dea.labelLength und übernimmt den Übergang nicht', () => {
    const text = ['dea L {', '  start A', '  A -ab-> B', '}', ''].join('\n');
    const { doc, diagnostics } = parseDocument(text);
    const d = diagnostics.find((x) => x.code === 'dea.labelLength');
    expect(d).toBeDefined();
    expect(d?.line).toBe(3);
    expect(asDea(firstObject(doc)).transitions).toHaveLength(0);
  });
});

describe('Wörter: parseWord, printWord, printSymbol', () => {
  it('0\\-1 ergibt 0, -, 1', () => {
    const r = parseWord('0\\-1');
    expect(r.word).toEqual(['0', '-', '1']);
    expect(r.diagnostics).toEqual([]);
  });
  it('leere Eingabe und ε ergeben das leere Wort', () => {
    expect(parseWord('').word).toEqual([]);
    expect(parseWord('ε').word).toEqual([]);
  });
  it('<zahl>a ergibt zahl, a', () => {
    expect(parseWord('<zahl>a').word).toEqual(['zahl', 'a']);
  });
  it('printWord([]) ist ε', () => {
    expect(printWord([])).toBe('ε');
  });
  it('printWord druckt Escapes und <name>', () => {
    expect(printWord(['0', '-', '1'])).toBe('0\\-1');
    expect(printWord(['zahl', 'a'])).toBe('<zahl>a');
  });
  it('printSymbol: Länge 1 nie als <x>, Länge > 1 als <name>', () => {
    expect(printSymbol('a')).toBe('a');
    expect(printSymbol('zahl')).toBe('<zahl>');
  });
  it('printWord und parseWord sind invers', () => {
    for (const w of [[], ['0'], [' ', ',', '#', '<', '>', '\\', '{', '}', '-'], ['zahl', 'a']]) {
      expect(parseWord(printWord(w)).word).toEqual(w);
    }
  });
});
