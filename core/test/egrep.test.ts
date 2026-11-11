import { describe, expect, it } from 'vitest';
import {
  accepts,
  applicableMethods,
  egrepAll,
  egrepFirst,
  egrepTest,
  egrepToRegex,
  emptyObject,
  enumerate,
  equivalent,
  fromJSON,
  objectHash,
  parseDocument,
  parseEgrep,
  printDocument,
  printEgrepAst,
  runMethod,
  toDea,
  toJSON,
  validate,
} from '../index';
import type { EgrepMatch, EgrepObj, EgrepNode } from '../index';

const eg = (pattern: string, alphabet: string[] = []): EgrepObj => ({ kind: 'egrep', name: 'R', pattern, alphabet });
const liste = ['huo', 'hugo', 'huggo', 'hugggo'];
const listeHits = (pattern: string): number[] =>
  liste.map((l, i) => (egrepTest(eg(pattern), l) ? i : -1)).filter((i) => i >= 0);
const first = (pattern: string, line: string, start = 0): EgrepMatch | null | 'limit' => {
  const p = parseEgrep(pattern);
  expect(p.diagnostics).toEqual([]);
  return egrepFirst(p.ast as EgrepNode, p.groups, line, start);
};
const span = (m: EgrepMatch | null | 'limit', line: string): string[] => {
  if (m === null || m === 'limit') throw new Error(String(m));
  const cps = Array.from(line);
  return [cps.slice(m.from, m.to).join(''), ...m.groups.map((g) => (g ? cps.slice(g.from, g.to).join('') : '<null>'))];
};

describe('egrep: Skriptbeispiele 3.1 bis 3.17', () => {
  const cases: [string, number[]][] = [
    ['hugo', [1]],
    ['uo|ggg', [0, 3]],
    ['ggg*', [2, 3]],
    ['(gg)*', [0, 1, 2, 3]],
    ['g+', [1, 2, 3]],
    ['g?', [0, 1, 2, 3]],
    ['[defg]', [1, 2, 3]],
    ['[d-g]', [1, 2, 3]],
    ['[^1234hugo. ]', []],
    ['[oguh]{5,}', [2, 3]],
    ['[ouh]{5,}', []],
    ['[ogh]{5,}', []],
    ['ugg', [2, 3]],
    ['ugg$', []],
    ['^ugg', []],
    ['ggo$', [2, 3]],
  ];
  for (const [p, hits] of cases) it(`${p}`, () => expect(listeHits(p)).toEqual(hits));

  it('3.9: Zeile mit einer 0 passt auf [^1234hugo. ] (mit Ziffern in der Zeile)', () => {
    expect(egrepTest(eg('[^1234hugo. ]'), '0 huo')).toBe(true);
    expect(egrepTest(eg('[^1234hugo. ]'), '0 huo')).toBe(true);
    expect(egrepTest(eg('[^1234hugo. ]'), '1 hugo')).toBe(false);
  });

  it('3.15: Metazeichen in Klassen', () => {
    const t = (p: string, l: string): boolean | null => egrepTest(eg(p), l);
    expect([t('[[]', '['), t('[[]', ']')]).toEqual([true, false]);
    expect([t('[]]', ']'), t('[]]', '[')]).toEqual([true, false]);
    expect([t('[^[]', ']'), t('[^[]', '[')]).toEqual([true, false]);
    expect([t('[^]]', '['), t('[^]]', ']')]).toEqual([true, false]);
    expect([t('[^^]', '['), t('[^^]', ']'), t('[^^]', '^')]).toEqual([true, true, false]);
  });

  it('3.12 Punkt, 3.29 Escape', () => {
    expect(egrepTest(eg('^.$'), 'x')).toBe(true);
    expect(egrepTest(eg('^\\.$'), 'x')).toBe(false);
    expect(egrepTest(eg('^\\.$'), '.')).toBe(true);
    expect(egrepTest(eg('^\\\\$'), '\\')).toBe(true);
    expect(egrepTest(eg('a\\{2\\}'), 'a{2}')).toBe(true);
  });

  it('3.1 Anwendungsszenario: 001|11101 in 11001001000', () => {
    expect(egrepTest(eg('001|11101'), '11001001000')).toBe(true);
    const p = parseEgrep('001|11101');
    const all = egrepAll(p.ast as EgrepNode, p.groups, '11001001000');
    expect(all).toEqual([
      { from: 2, to: 5, groups: [] },
      { from: 5, to: 8, groups: [] },
    ]);
  });
});

describe('egrep: Treffer und Gruppen (3.18 bis 3.28)', () => {
  it('3.21: Regel 1 und 2a', () => {
    expect(span(first('aa|bb', '_aa_bb_'), '_aa_bb_')).toEqual(['aa']);
    expect(span(first('bb*', 'abbbbc'), 'abbbbc')).toEqual(['bbbb']);
    expect(span(first('b|bbb', 'abbbc'), 'abbbc')).toEqual(['bbb']);
    expect(span(first('.*', 'xyz'), 'xyz')).toEqual(['xyz']);
  });

  it('3.23 Beispiel 1 (Positionen 0-basiert, to exklusiv)', () => {
    const m = first('(bb)c(bb)', 'zzbbcbbz');
    expect(m).toEqual({ from: 2, to: 7, groups: [{ from: 2, to: 4 }, { from: 5, to: 7 }] });
  });

  it('3.23 Beispiel 2 und weiterer Treffer', () => {
    const line = 'zzbbcbbzzzbbcccbb';
    expect(first('(bb)c*(bb)', line)).toEqual({ from: 2, to: 7, groups: [{ from: 2, to: 4 }, { from: 5, to: 7 }] });
    const p = parseEgrep('(bb)c*(bb)');
    const all = egrepAll(p.ast as EgrepNode, p.groups, line);
    expect(all).toEqual([
      { from: 2, to: 7, groups: [{ from: 2, to: 4 }, { from: 5, to: 7 }] },
      { from: 10, to: 17, groups: [{ from: 10, to: 12 }, { from: 15, to: 17 }] },
    ]);
  });

  it('3.24: (.*)(.*) auf abcdefg', () => {
    expect(first('(.*)(.*)', 'abcdefg')).toEqual({
      from: 0,
      to: 7,
      groups: [{ from: 0, to: 7 }, { from: 7, to: 7 }],
    });
  });

  it('3.26: (abc|xyz)\\1', () => {
    const t = (l: string): boolean | null => egrepTest(eg('^(abc|xyz)\\1$'), l);
    expect([t('abcabc'), t('xyzxyz'), t('abcxyz')]).toEqual([true, true, false]);
    expect(egrepTest(eg('^(abc|xyz)(abc|xyz)$'), 'abcxyz')).toBe(true);
  });

  it('3.27: ((gg)+)\\1 auf liste2', () => {
    const liste2 = Array.from({ length: 9 }, (_, k) => 'hu' + 'g'.repeat(k) + 'o');
    const hits = (p: string): number[] => liste2.map((l, i) => (egrepTest(eg(p), l) ? i : -1)).filter((i) => i >= 0);
    expect(hits('((gg)+)\\1')).toEqual([4, 5, 6, 7, 8]);
    expect(hits('u((gg)+)\\1o')).toEqual([4, 8]);
    const m = first('u((gg)+)\\1o', 'huggggo');
    expect(span(m, 'huggggo')).toEqual(['uggggo', 'gg', 'gg']);
  });

  it('3.28: (.*).*(\\1) auf abcxabca (Gesamttreffer am längsten: Variante 2)', () => {
    const line = 'abcxabca';
    expect(first('(.*).*(\\1)', line)).toEqual({
      from: 0,
      to: 8,
      groups: [{ from: 0, to: 1 }, { from: 7, to: 8 }],
    });
  });

  it('POSIX: (a|ab)(c|bcd)(d*) auf abcd', () => {
    expect(span(first('(a|ab)(c|bcd)(d*)', 'abcd'), 'abcd')).toEqual(['abcd', 'ab', 'c', 'd']);
  });

  it('POSIX: (a*)* auf b ist ein leerer Treffer an 0', () => {
    expect(first('(a*)*', 'b')).toEqual({ from: 0, to: 0, groups: [{ from: 0, to: 0 }] });
    expect(first('(a*)*', 'aa')).toEqual({ from: 0, to: 2, groups: [{ from: 0, to: 2 }] });
  });

  it('Gruppe in Wiederholung hält den letzten Durchlauf', () => {
    expect(span(first('(a|b)*', 'abba'), 'abba')).toEqual(['abba', 'a']);
    expect(first('(a)|b', 'b')).toEqual({ from: 0, to: 1, groups: [null] });
  });

  it('Anker', () => {
    expect(first('^b', 'ab')).toBeNull();
    expect(first('a$', 'aa')).toEqual({ from: 1, to: 2, groups: [] });
    expect(first('^', 'abc')).toEqual({ from: 0, to: 0, groups: [] });
    expect(first('$', 'abc')).toEqual({ from: 3, to: 3, groups: [] });
    expect(first('^a', 'ba', 1)).toBeNull();
  });

  it('Rückwärtsverweis (a+)b\\1 auf aabaa', () => {
    expect(span(first('(a+)b\\1', 'aabaa'), 'aabaa')).toEqual(['aabaa', 'aa']);
    expect(span(first('(a+)b\\1', 'aaba'), 'aaba')).toEqual(['aba', 'a']);
  });

  it('Wiederholungen, Klassen, benannte Klassen', () => {
    expect(span(first('a{2,3}', 'aaaa'), 'aaaa')).toEqual(['aaa']);
    expect(span(first('a{2}', 'aaaa'), 'aaaa')).toEqual(['aa']);
    expect(span(first('[[:digit:]]+', 'ab123c'), 'ab123c')).toEqual(['123']);
    expect(span(first('[[:alpha:]-]+', '1ab-c2'), '1ab-c2')).toEqual(['ab-c']);
    expect(span(first('a|', 'b'), 'b')).toEqual(['']);
    expect(span(first('x()y', 'xy'), 'xy')).toEqual(['xy', '']);
  });

  it('egrepAll: leerer Treffer, eine Stelle weiter', () => {
    const p = parseEgrep('b*');
    expect(egrepAll(p.ast as EgrepNode, p.groups, 'abba')).toEqual([
      { from: 0, to: 0, groups: [] },
      { from: 1, to: 3, groups: [] },
      { from: 3, to: 3, groups: [] },
      { from: 4, to: 4, groups: [] },
    ]);
  });

  it('Codepoints', () => {
    expect(first('é+', 'aéé😀')).toEqual({ from: 1, to: 3, groups: [] });
    expect(first('.$', 'a😀')).toEqual({ from: 1, to: 2, groups: [] });
  });

  it('nie hängend: stepLimit', () => {
    const p = parseEgrep('(a*)*(a*)*(a*)*b');
    const line = 'a'.repeat(60);
    expect(egrepFirst(p.ast as EgrepNode, p.groups, line, 0, { stepLimit: 50 })).toBe('limit');
    const t0 = Date.now();
    egrepFirst(p.ast as EgrepNode, p.groups, line);
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(egrepTest(eg('(a*)*(a*)*(a*)*b'), 'a'.repeat(200))).toBe(false);
  });
});

describe('egrep: Syntaxfehler', () => {
  const code = (p: string): { code: string; params: Record<string, unknown> } | null => {
    const d = parseEgrep(p).diagnostics[0];
    return d ? { code: d.code, params: d.params } : null;
  };
  it('Klammern', () => {
    expect(code('(ab')?.code).toBe('egrep.unbalanced');
    expect(code('ab)')?.code).toBe('egrep.unbalanced');
    expect(code('(ab')?.params.col).toBe(1);
  });
  it('Klassen', () => {
    expect(code('[ab')?.code).toBe('egrep.badClass');
    expect(code('[]')?.code).toBe('egrep.badClass');
    expect(code('[z-a]')).toEqual({ code: 'egrep.badRange', params: { from: 'z', to: 'a', col: 2 } });
    expect(code('[[:foo:]]')?.code).toBe('egrep.badClassName');
  });
  it('Wiederholungen', () => {
    expect(code('*a')?.code).toBe('egrep.nothingToRepeat');
    expect(code('a|+')?.code).toBe('egrep.nothingToRepeat');
    expect(code('a{x}')?.code).toBe('egrep.badRepeat');
    expect(code('a{3,2}')?.code).toBe('egrep.badRepeat');
    expect(code('a{2')?.code).toBe('egrep.badRepeat');
    expect(code('a{2}{3}')).toBeNull();
  });
  it('Rückwärtsverweise', () => {
    expect(code('\\1')?.code).toBe('egrep.badBackref');
    expect(code('(a\\1)')?.code).toBe('egrep.badBackref');
    expect(code('(a)\\2')?.code).toBe('egrep.badBackref');
    expect(code('(a)\\1')).toBeNull();
    expect(egrepTest(eg('(a'), 'a')).toBeNull();
  });
  it('validate: Fehler mit params.col, Warnung bei Rückwärtsverweis', () => {
    expect(validate(eg('a)'))[0]).toMatchObject({ severity: 'error', code: 'egrep.unbalanced', objectName: 'R' });
    expect(validate(eg('(a)\\1'))).toMatchObject([{ severity: 'warning', code: 'egrep.backrefNotRegular' }]);
    expect(validate(eg('a+'))).toEqual([]);
  });
});

describe('egrep: printEgrepAst', () => {
  for (const p of ['a(b|c)*d', '^[a-c]+$', '[]a-]', '(a)\\1', 'a{2,}b{3}c?', 'x\\.y\\(', '(a|)b', '[^]x]', '[[:digit:]a]', 'a**']) {
    it(`parse(print(parse(${p}))) = parse(${p})`, () => {
      const a = parseEgrep(p);
      expect(a.diagnostics).toEqual([]);
      const printed = printEgrepAst(a.ast as EgrepNode);
      const b = parseEgrep(printed);
      expect(b.diagnostics).toEqual([]);
      expect(b.ast).toEqual(a.ast);
      expect(printEgrepAst(b.ast as EgrepNode)).toBe(printed);
    });
  }
});

describe('egrep: Umwandlung', () => {
  it('Beispiel: ^a+$ über {a,b}', () => {
    const r = egrepToRegex(eg('^a+$', ['a', 'b']));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.kind).toBe('regex');
    expect(r.result.name).toBe('R_ra');
    expect(r.result.origin?.method).toBe('egrep2regex');
    expect(r.result.origin?.sources).toEqual(['R']);
    expect(accepts(r.result, ['a', 'a'])).toBe(true);
    expect(accepts(r.result, ['a', 'b'])).toBe(false);
    expect(r.steps.map((s) => s.explanation.key)).toContain('proc.egrep.plus');
    expect(r.steps[r.steps.length - 1]?.explanation.key).toBe('proc.egrep.result');
    for (const s of r.steps) expect(s.view.obj?.kind).toBe('regex');
  });

  it('Schlüssel der Schritte', () => {
    const r = egrepToRegex(eg('^[ab].a?b{2,3}c{2}d{1,}$', ['a', 'b', 'c', 'd']));
    expect(r.ok).toBe(true);
    const keys = new Set(r.steps.map((s) => s.explanation.key));
    for (const k of ['proc.egrep.class', 'proc.egrep.any', 'proc.egrep.optional', 'proc.egrep.repeat', 'proc.egrep.plus', 'proc.egrep.anchor', 'proc.egrep.result']) {
      expect(keys.has(k)).toBe(true);
    }
  });

  it('Alphabet aus dem Muster, Name, steps:false', () => {
    const r = egrepToRegex(eg('a[b-d]'), { steps: false, name: 'X' });
    expect(r.ok && r.result.alphabet).toEqual(['a', 'b', 'c', 'd']);
    expect(r.ok && r.result.name).toBe('X');
    expect(r.steps).toEqual([]);
  });

  it('Fehler', () => {
    const err = (o: EgrepObj): string | undefined => {
      const r = egrepToRegex(o);
      return r.ok ? undefined : r.diagnostics[0]?.code;
    };
    expect(err(eg('(a)\\1'))).toBe('egrep.backref');
    expect(err(eg('a^b'))).toBe('egrep.anchorInside');
    expect(err(eg('(^a)'))).toBe('egrep.anchorInside');
    expect(err(eg('a$b|c'))).toBe('egrep.anchorInside');
    expect(err(eg('[\u0000-࿿]'))).toBe('egrep.alphabetTooLarge');
    expect(err(eg('(a'))).toBe('algo.invalid');
    expect(err(eg('^a|b$'))).toBeUndefined();
  });

  it('runMethod, applicableMethods, toDea, equivalent, enumerate', () => {
    const o = eg('^(ab)*$', ['a', 'b']);
    expect(applicableMethods(o)).toEqual(['egrep2regex']);
    const r = runMethod('egrep2regex', [o]);
    expect(r.ok && r.result.kind).toBe('regex');
    expect(runMethod('egrep2regex', [emptyObject('regex', 'x')]).ok).toBe(false);
    expect(toDea(o)).not.toBeNull();
    expect(toDea(eg('(a)\\1'))).toBeNull();
    const ref = parseDocument('regex Q = (ab)*').doc.objects[0]!;
    const eq = equivalent(o, ref);
    expect(eq.ok && eq.result.equal).toBe(true);
    expect(enumerate(o, 4).map((w) => w.join(''))).toEqual(['', 'ab', 'abab']);
    expect(accepts(o, ['a', 'b'])).toBe(true);
    expect(accepts(eg('^(a|b)\\1$'), ['b', 'b'])).toBe(true);
    expect(accepts(eg('^(a|b)\\1$'), ['b', 'a'])).toBe(false);
    const bad = equivalent(eg('(a)\\1'), ref);
    expect(bad.ok).toBe(false);
  });

  it('enumerate mit Rückwärtsverweis: Wörter bis Länge 2', () => {
    const o = eg('^(a|b)\\1$', ['a', 'b']);
    // ohne Umwandlung: Aufzählung durch Probieren
    expect(enumerate(o, 2).map((w) => w.join(''))).toEqual(['aa', 'bb']);
  });
});

// ---------------------------------------------------------------------------
// Eigenschaft: egrepTest = accepts(egrepToRegex)

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomPattern(r: () => number, depth: number): string {
  const pick = <T,>(xs: T[]): T => xs[Math.floor(r() * xs.length)] as T;
  const atom = (d: number): string => {
    const k = r();
    if (k < 0.3) return pick(['a', 'b']);
    if (k < 0.4) return '.';
    if (k < 0.5) return pick(['[ab]', '[^a]', '[a-b]', '[^ab]']);
    if (d > 0 && k < 0.85) return '(' + alt(d - 1) + ')';
    return pick(['a', 'b']);
  };
  const piece = (d: number): string => {
    let s = atom(d);
    const q = r();
    if (q < 0.15) s += '*';
    else if (q < 0.3) s += '+';
    else if (q < 0.4) s += '?';
    else if (q < 0.5) s += pick(['{2}', '{1,2}', '{2,}', '{0,2}']);
    return s;
  };
  const concat = (d: number): string => {
    const n = Math.floor(r() * 4);
    let s = '';
    for (let i = 0; i < n; i++) s += piece(d);
    return s;
  };
  function alt(d: number): string {
    const n = r() < 0.3 ? 2 : 1;
    const parts: string[] = [];
    for (let i = 0; i < n; i++) parts.push(concat(d));
    return parts.join('|');
  }
  // Anker nur am Rand der obersten Alternativen
  const tops: string[] = [];
  const nt = r() < 0.3 ? 2 : 1;
  for (let i = 0; i < nt; i++) tops.push((r() < 0.3 ? '^' : '') + concat(depth) + (r() < 0.3 ? '$' : ''));
  return tops.join('|');
}

describe('egrep: Umwandlung stimmt mit dem Matcher überein (fester Seed)', () => {
  const lines: string[] = [''];
  for (let len = 1; len <= 6; len++) {
    for (let k = 0; k < 1 << len; k++) {
      lines.push(
        Array.from({ length: len }, (_, i) => ((k >> i) & 1 ? 'b' : 'a')).join(''),
      );
    }
  }
  it('150 Muster, alle Zeilen bis Länge 6 über {a,b}', () => {
    const r = rng(20240611);
    let converted = 0;
    for (let n = 0; n < 150; n++) {
      const pattern = randomPattern(r, 2);
      const o = eg(pattern, ['a', 'b']);
      expect(parseEgrep(pattern).diagnostics, pattern).toEqual([]);
      const res = egrepToRegex(o, { steps: false });
      if (!res.ok) {
        expect(res.diagnostics[0]?.code, pattern).toBe('algo.limit');
        continue;
      }
      converted++;
      for (const line of lines) {
        const expected = egrepTest(o, line);
        expect(accepts(res.result, Array.from(line)), `${pattern} auf "${line}"`).toBe(expected);
      }
    }
    expect(converted).toBeGreaterThan(130);
  });
});

describe('egrep: Text, JSON, Hash', () => {
  const text = [
    'egrep R1 = ^[a-z]+$',
    '',
    'egrep R2 = a#b}',
    '',
    'egrep R3 {',
    '  alphabet a b',
    '  = (a|b)*\\1  ',
    '}',
    '',
    'egrep R4 {',
    '  = x{2}',
    '}',
    '',
    'egrep R5 =',
    '',
  ].join('\n');

  it('parse', () => {
    const { doc, diagnostics } = parseDocument(text);
    expect(diagnostics).toEqual([]);
    expect(doc.objects).toEqual([
      { kind: 'egrep', name: 'R1', pattern: '^[a-z]+$', alphabet: [] },
      { kind: 'egrep', name: 'R2', pattern: 'a#b}', alphabet: [] },
      { kind: 'egrep', name: 'R3', pattern: '(a|b)*\\1', alphabet: ['a', 'b'] },
      { kind: 'egrep', name: 'R4', pattern: 'x{2}', alphabet: [] },
      { kind: 'egrep', name: 'R5', pattern: '', alphabet: [] },
    ]);
  });

  it('Round-Trip Text und JSON', () => {
    const { doc } = parseDocument(text);
    const printed = printDocument(doc);
    expect(printed).toContain('egrep R1 = ^[a-z]+$\n');
    expect(printed).toContain('egrep R4 = x{2}\n');
    expect(printed).toContain('egrep R3 {\n  alphabet a b\n  = (a|b)*\\1\n}\n');
    const again = parseDocument(printed);
    expect(again.diagnostics).toEqual([]);
    expect(again.doc).toEqual(doc);
    expect(printDocument(again.doc)).toBe(printed);
    const j = fromJSON(toJSON(doc));
    expect(j.diagnostics).toEqual([]);
    expect(j.doc).toEqual(doc);
  });

  it('Herkunft im Block', () => {
    const src = parseDocument('egrep S = ^a+$').doc.objects[0] as EgrepObj;
    const r = egrepToRegex(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const doc = { version: 1 as const, objects: [src, r.result] };
    const printed = printDocument(doc);
    expect(printed).toContain('herkunft egrep2regex aus S@' + objectHash(src));
    expect(parseDocument(printed).doc.objects[1]).toEqual(r.result);
    const withOrigin: EgrepObj = { ...src, origin: { method: 'egrep2regex', sources: [], sourceHash: [] } };
    const p2 = parseDocument(printDocument({ version: 1, objects: [withOrigin] }));
    expect(p2.doc.objects[0]).toEqual(withOrigin);
  });

  it('JSON-Prüfung', () => {
    const bad = (o: unknown): string => fromJSON(JSON.stringify({ version: 1, objects: [o] })).diagnostics[0]?.code ?? '';
    expect(bad({ kind: 'egrep', name: 'x', pattern: 5, alphabet: [] })).toBe('json.invalid');
    expect(bad({ kind: 'egrep', name: 'x', pattern: 'a', alphabet: [1] })).toBe('json.invalid');
    expect(bad({ kind: 'egrep', name: 'x', pattern: 'a', alphabet: [] })).toBe('');
  });

  it('emptyObject und objectHash', () => {
    expect(emptyObject('egrep', 'n')).toEqual({ kind: 'egrep', name: 'n', pattern: '', alphabet: [] });
    expect(objectHash(eg('a'))).toBe(objectHash({ ...eg('a'), name: 'Z' }));
    expect(objectHash(eg('a'))).not.toBe(objectHash(eg('b')));
  });
});
