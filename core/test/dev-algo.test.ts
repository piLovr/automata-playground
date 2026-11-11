import { describe, expect, it } from 'vitest';
import {
  EXPLANATION_KEYS, accepts, applicableMethods, complement, deaToGrammar, deaToRegex, deaToRegexElim, enumerate,
  equivalent, grammarToNea, minimize, neaToDea, parseDocument, powerset, product, reachable, regexToGrammar,
  removeEpsilon, runMethod, separatingWord, splitWords, thompson, toDea, validate,
} from '../index';
import type { DEA, Document, FormalObject, Grammar, NEA, ProcResult, RegExpr, RegexObj, Word } from '../index';

const parse = <T extends FormalObject>(text: string): T => {
  const { doc } = parseDocument(text) as { doc: Document };
  return doc.objects[0] as T;
};
const w = (s: string): Word => (s === '' ? [] : s.split(''));

const M292 = parse<DEA>(`dea M292 {
  alphabet a b
  states A B C D E F G
  start A
  accept C D G
  A -a-> B
  A -b-> F
  B -a-> C
  B -b-> E
  C -a-> D
  C -b-> D
  D -a-> C
  D -b-> D
  E -a-> E
  E -b-> E
  F -a-> E
  F -b-> G
  G -a-> G
  G -b-> C
}`);

const N266 = parse<NEA>(`nea N266 {
  alphabet 0 1
  states 0 1 2 3 4 5
  start 0
  accept 2 5
  0 -ε-> 2
  0 -ε-> 5
  2 -01-> 2
  5 -001-> 5
}`);

function ok<R>(r: ProcResult<R>): R {
  if (!r.ok) throw new Error(JSON.stringify(r.diagnostics));
  return r.result;
}

function checkSteps(r: ProcResult<unknown>): void {
  for (const s of r.steps) {
    expect(EXPLANATION_KEYS as readonly string[]).toContain(s.explanation.key);
    const o = s.view.obj;
    if (o) expect(validate(o).filter((d) => d.severity === 'error')).toEqual([]);
  }
}

const sym = (s: string): RegExpr => ({ op: 'sym', sym: s });
const un = (l: RegExpr, r: RegExpr): RegExpr => ({ op: 'union', left: l, right: r });
const cat = (l: RegExpr, r: RegExpr): RegExpr => ({ op: 'concat', left: l, right: r });
const st = (e: RegExpr): RegExpr => ({ op: 'star', inner: e });
const rx = (e: RegExpr, alphabet = ['0', '1']): RegexObj => ({ kind: 'regex', name: 'R', alphabet, expr: e });
// (0|1)*01
const R01 = rx(cat(cat(st(un(sym('0'), sym('1'))), sym('0')), sym('1')));

const norm = (cs: string[][]): string[] => cs.map((c) => c.slice().sort().join('')).sort();

describe('2.92 minimize', () => {
  it('Runden und Ergebnis', () => {
    const r = minimize(M292);
    const res = ok(r);
    checkSteps(r);
    const parts = r.steps.filter((s) => s.view.partition).map((s) => s.view.partition!);
    const names = (cs: string[][]): string[][] => cs.map((c) => c.map((id) => M292.states.find((s) => s.id === id)!.name));
    expect(parts.map((p) => p.round)).toEqual([0, 1, 2, 3]);
    expect(norm(names(parts[0]!.classes))).toEqual(['ABEF', 'CDG']);
    expect(norm(names(parts[1]!.classes))).toEqual(['AE', 'B', 'CDG', 'F']);
    expect(norm(names(parts[2]!.classes))).toEqual(['A', 'B', 'CDG', 'E', 'F']);
    expect(norm(names(parts[3]!.classes))).toEqual(norm(names(parts[2]!.classes)));
    expect(r.steps.map((s) => s.explanation.key).filter((k) => k.startsWith('proc.min'))).toEqual([
      'proc.min.eq0', 'proc.min.round', 'proc.min.round', 'proc.min.stable',
    ]);
    expect(res.states.map((s) => s.name).sort()).toEqual(['A', 'B', 'CDG', 'E', 'F']);
    expect(res.accept.map((id) => res.states.find((s) => s.id === id)!.name)).toEqual(['CDG']);
    expect(validate(res).filter((d) => d.severity === 'error')).toEqual([]);
    expect(equivalent(M292, res).ok && (equivalent(M292, res) as { result: { equal: boolean } }).result.equal).toBe(true);
    expect(ok(minimize(res)).states.length).toBe(5);
  });
});

describe('Verfahren Rauchtests', () => {
  it('NEA 2.66 -> DEA', () => {
    const r = neaToDea(N266);
    const d = ok(r);
    checkSteps(r);
    expect(r.steps.map((s) => s.explanation.key).slice(0, 3)).toEqual(['proc.phase', 'proc.split.edge', 'proc.split.edge']);
    expect(validate(d).filter((x) => x.severity === 'error')).toEqual([]);
    const oracle = enumerate(N266, 8).map((x) => x.join(''));
    expect(oracle).toContain('0101');
    expect(oracle).not.toContain('0');
    for (let len = 0; len <= 8; len++) {
      for (let k = 0; k < 2 ** len; k++) {
        const word = k.toString(2).padStart(len, '0').slice(len === 0 ? 1 : 0).split('').filter(Boolean);
        const want = oracle.includes(word.join(''));
        expect(accepts(d, word)).toBe(want);
        expect(accepts(toDea(N266)!, word)).toBe(want);
      }
    }
    expect(ok(splitWords(N266)).states.length).toBe(9);
    const re = removeEpsilon(N266);
    expect(ok(re).transitions.every((t) => t.label.length > 0)).toBe(true);
    const p = powerset(ok(removeEpsilon(ok(splitWords(N266)))));
    checkSteps(p);
    expect(ok(p).states.length).toBe(d.states.length);
    const lim = powerset(ok(removeEpsilon(ok(splitWords(N266)))), { limits: { maxStates: 3 } });
    expect(lim.ok).toBe(false);
    const full = ok(powerset(ok(removeEpsilon(ok(splitWords(N266)))), { fullPowerset: true }));
    expect(full.states.length).toBe(2 ** 9);
  });

  it('Ausdruck, Grammatik, NEA, DEA', () => {
    const g = regexToGrammar(R01);
    checkSteps(g);
    const gr = ok(g) as Grammar;
    expect(validate(gr).filter((d) => d.severity === 'error')).toEqual([]);
    const o1 = enumerate(R01, 6);
    expect(enumerate(gr, 6)).toEqual(o1);
    const n = ok(grammarToNea(gr));
    expect(enumerate(n, 6)).toEqual(o1);
    const th = thompson(R01);
    checkSteps(th);
    expect(enumerate(ok(th), 6)).toEqual(o1);
    const d = ok(neaToDea(n));
    const mm = ok(minimize(d));
    expect(mm.states.length).toBe(3);
    expect(enumerate(mm, 6)).toEqual(o1);
    const re = ok(deaToRegex(mm));
    expect(enumerate(re, 6)).toEqual(o1);
    const re2 = ok(deaToRegexElim(mm));
    expect(enumerate(re2, 6)).toEqual(o1);
    const eq = equivalent(R01, re);
    expect(eq.ok && eq.result.equal).toBe(true);
    const ne = equivalent(R01, rx(cat(cat(st(un(sym('0'), sym('1'))), sym('1')), sym('1'))));
    expect(ne.ok && ne.result).toEqual({ equal: false, word: ['0', '1'], inLanguage: 0 });
    const gg = ok(deaToGrammar(mm)) as Grammar;
    expect(enumerate(gg, 6)).toEqual(o1);
    expect(mm.origin?.method).toBe('minimize');
  });

  it('2.30 Tabelle', () => {
    const m2 = parse<DEA>(`dea Z { alphabet 0 1
      start p
      accept q
      p -0-> p
      p -1-> q
      q -0-> q
      q -1-> p }`);
    const r = deaToRegex(m2);
    checkSteps(r);
    const t0 = r.steps[0]!.view.table!;
    expect(t0.cells).toEqual([['0|∅*', '1'], ['1', '0|∅*']]);
    expect(r.steps.length).toBe(4);
    const raw = deaToRegex(m2, { simplify: false });
    expect(ok(raw)).toBeTruthy();
    const eq = equivalent(ok(r), ok(raw));
    expect(eq.ok && eq.result.equal).toBe(true);
  });

  it('Komplement, Produkt, erreichbar, trennendes Wort', () => {
    const c = ok(complement(M292));
    expect(c.accept.length).toBe(4);
    const a = ok(minimize(M292));
    const pi = ok(product(M292, c, 'intersection'));
    expect(enumerate(pi, 5)).toEqual([]);
    const pu = ok(product(M292, c, 'union'));
    expect(enumerate(pu, 3).length).toBe(1 + 2 + 4 + 8);
    expect(ok(reachable(M292)).states.length).toBe(7);
    const sw = separatingWord(a, w('a'), w('b'));
    expect(sw.ok && sw.result.word).toEqual(['a']);
    const same = separatingWord(a, w('ab'), w('ab'));
    expect(same.ok && same.result.word).toBe(null);
    const un = parse<DEA>(`dea U { alphabet 0
      start A
      accept A
      A -0-> A
      B -0-> A }`);
    const rr = reachable(un);
    expect(ok(rr).states.length).toBe(1);
    checkSteps(rr);
    expect(product(M292, un, 'union').ok).toBe(false);
    expect(runMethod('minimize', [M292]).ok).toBe(true);
    expect(applicableMethods(M292)).toContain('minimize');
  });

  it('Mealy/Moore', () => {
    const me = parse<FormalObject>(`mealy P {
      alphabet 0 1
      outputs 0 1
      start e
      e -0/0-> e
      e -1/0-> o
      o -0/1-> o
      o -1/1-> e }`);
    const r = runMethod('mealy2moore', [me]);
    expect(r.ok).toBe(true);
    checkSteps(r);
    if (r.ok) {
      const back = runMethod('moore2mealy', [r.result]);
      expect(back.ok).toBe(true);
    }
  });
});

describe('partieller DEA (ohne Fangzustand)', () => {
  const P = parse<DEA>(`dea Partiell {
  alphabet a b
  states A B C
  start A
  accept C
  A -a-> B
  B -b-> C
  A -b-> A
  C -a-> C
}`);

  it('deaToRegex und reachable akzeptieren fehlende Übergänge und erhalten die Sprache', () => {
    expect(validate(P).some((x) => x.code === 'dea.missing')).toBe(true);
    const orig = enumerate(P, 6);
    expect(orig.length).toBeGreaterThan(0);
    const re = deaToRegex(P);
    expect(re.ok).toBe(true);
    if (re.ok) expect(enumerate(re.result, 6)).toEqual(orig);
    const rc = reachable(P);
    expect(rc.ok).toBe(true);
    if (rc.ok) expect(enumerate(rc.result, 6)).toEqual(orig);
  });

  it('minimize behält die Vorbedingung algo.incomplete', () => {
    const r = minimize(P);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.diagnostics.some((d) => d.code === 'algo.incomplete')).toBe(true);
  });
});
