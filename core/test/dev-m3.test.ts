import { describe, expect, it } from 'vitest';
import {
  countByLength,
  enumerate,
  equivalent,
  evalLang,
  fromJSON,
  objectHash,
  outputsTable,
  parseDocument,
  printDocument,
  printWord,
  toJSON,
  validate,
  wordsPage,
} from '../index';
import type { Document, FormalObject, Word } from '../index';

const parse = (t: string): Document => {
  const r = parseDocument(t);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return r.doc;
};
const show = (ws: Word[]): string[] => ws.map(printWord);

describe('menge: Text', () => {
  it('Kurzform, Sortierung, Duplikate, Round-Trip', () => {
    const r = parseDocument('menge L1 = {01, 1, ε, 1}');
    expect(r.diagnostics.map((d) => [d.code, d.severity])).toEqual([['menge.duplicate', 'warning']]);
    const m = r.doc.objects[0] as Extract<FormalObject, { kind: 'menge' }>;
    expect(show(m.words)).toEqual(['ε', '1', '01']);
    const text = printDocument(r.doc);
    const again = parseDocument(text);
    expect(again.diagnostics).toEqual([]);
    expect(again.doc).toEqual(r.doc);
    expect(printDocument(again.doc)).toBe(text);
  });
  it('Blockform mit Alphabet, bis, leer', () => {
    const d = parse('menge A {\n alphabet 1 0\n = {0, 1}\n bis 4\n}\nmenge E = {}\nmenge F = {∅}');
    const a = d.objects[0] as Extract<FormalObject, { kind: 'menge' }>;
    expect(a.alphabet).toEqual(['1', '0']);
    expect(show(a.words)).toEqual(['1', '0']);
    expect(a.upTo).toBe(4);
    expect((d.objects[1] as { words: Word[] }).words).toEqual([]);
    expect((d.objects[2] as { words: Word[] }).words).toEqual([]);
    expect(parse(printDocument(d))).toEqual(d);
    expect(fromJSON(toJSON(d)).doc).toEqual(d);
    expect(validate(a)).toEqual([]);
    expect(objectHash(d.objects[1] as FormalObject)).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('evalLang', () => {
  const doc = parse('menge A = {01, 1}\nmenge B = {000, 01}\nmenge C = {010, 11}\nmenge D = {0, 1}\nmenge E = {ε}\nregex R = (0|1)*01');
  const run = (e: string, o = {}): string[] => {
    const r = evalLang(e, doc, o);
    expect(r.result, JSON.stringify(r.diagnostics)).not.toBeNull();
    return show((r.result as { words: Word[] }).words);
  };
  it('1.7', () => {
    expect(run('A B').sort()).toEqual(['01000', '0101', '1000', '101'].sort());
    expect(run('A · B')).toEqual(['101', '0101', '1000', '01000']);
    expect(run('C^2')).toEqual(['1111', '01011', '11010', '010010']);
    expect(run('D^3')).toEqual(['000', '001', '010', '011', '100', '101', '110', '111']);
    expect(run('{01, 1} {000, 01}').length).toBe(4);
  });
  it('1.8 und Stern/Plus', () => {
    expect(run('E A')).toEqual(run('A'));
    expect(run('A E')).toEqual(run('A'));
    expect(run('A^0')).toEqual(['ε']);
    expect(run('∅*')).toEqual(['ε']);
    expect(run('∅+')).toEqual([]);
    const r = evalLang('D*', doc, { maxLen: 4 });
    expect(r.result?.words.length).toBe(31);
    expect(r.result?.upTo).toBe(4);
    expect(r.diagnostics.map((d) => d.code)).toEqual(['lang.truncated']);
    expect(r.result?.origin?.method).toBe('sprachop');
    expect(run('{ε, 0}+', { maxLen: 3 })).toEqual(['ε', '0', '00', '000']);
    expect(run('{0}+', { maxLen: 3 })).toEqual(['0', '00', '000']);
    expect(run('A | B ∪ E')).toContain('ε');
  });
  it('Typ-3-Objekte, Fehler', () => {
    expect(run('R', { maxLen: 3 })).toEqual(['01', '001', '101']);
    expect(run('D R', { maxLen: 3 })).toEqual(['001', '101']);
    expect(evalLang('X', doc).diagnostics[0]?.code).toBe('lang.unknownName');
    expect(evalLang('A ∪', doc).diagnostics[0]?.code).toBe('lang.syntax');
    expect(evalLang('D^5', doc, { maxWords: 10 }).diagnostics[0]?.code).toBe('lang.tooLarge');
    expect(evalLang('D^2 D', doc).steps.map((s) => s.explanation.key)).toEqual(['proc.lang.power', 'proc.lang.concat']);
  });
  it('Menge ist Typ 3', () => {
    const r = evalLang('A B', doc);
    const re = parse('regex X = 01000|0101|1000|101').objects[0] as FormalObject;
    const q = equivalent(r.result as FormalObject, re);
    expect(q.ok && q.result.equal).toBe(true);
  });
});

describe('Explorer', () => {
  const doc = parse(
    'regex R = (0|1)*01\nnea N {\n start p\n accept q\n p -0,1-> p\n p -0-> r\n r -1-> q\n}\nmenge M = {ε, 1, 01, 11}\nmoore Y {\n start a\n accept a\n out a=0 b=1\n a -0-> b\n a -1-> a\n b -0-> b\n b -1-> a\n}',
  );
  const obj = (n: string): FormalObject => doc.objects.find((o) => o.name === n) as FormalObject;
  it('countByLength stimmt mit enumerate', () => {
    for (const n of ['R', 'N', 'M']) {
      const c = countByLength(obj(n), 7);
      expect(c.ok).toBe(true);
      if (!c.ok) continue;
      const counts = Array<number>(8).fill(0);
      for (const w of enumerate(obj(n), 7)) counts[w.length]!++;
      expect(c.result.counts.map(Number)).toEqual(counts);
      expect(c.result.exact).toBe(true);
    }
    const c = countByLength(obj('R'), 6);
    expect(c.ok && c.result.counts.map(Number)).toEqual([0, 0, 1, 2, 4, 8, 16]);
  });
  it('wordsPage über Seiten', () => {
    for (const n of ['R', 'M']) {
      const all = enumerate(obj(n), 6);
      const got: Word[] = [];
      let offset = 0;
      for (let i = 0; i < 100; i++) {
        const p = wordsPage(obj(n), { maxLen: 6, offset, limit: 7 });
        if (!p.ok) throw new Error('page');
        got.push(...p.result.words);
        offset += p.result.words.length;
        if (p.result.done) break;
      }
      expect(show(got)).toEqual(show(all));
    }
  });
  it('outputsTable', () => {
    const t = outputsTable(obj('Y') as never, 2);
    expect(t.length).toBe(7);
    expect(show([t[0]!.output])).toEqual(['0']);
  });
});
