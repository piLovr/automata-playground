/// <reference types="node" />
// Brücken (docs/kern-spec-m3.md, Nachtrag): mengeToDea und chainPlan.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  applicableMethods,
  chainPlan,
  enumerate,
  equivalent,
  makeMenge,
  mengeToDea,
  minimize,
  parseDocument,
  runMethod,
  validate,
} from '../index';
import type { DEA, FormalObject, MengeObj, MethodId, RegExpr, Word } from '../index';

const dir = new URL('../../examples/', import.meta.url);
const load = (f: string) => parseDocument(readFileSync(new URL(f, dir), 'utf8')).doc.objects;

const w = (s: string): Word => (s === '' ? [] : [...s]);
const strs = (ws: Word[]) => ws.map((x) => x.join(''));

function check(m: MengeObj): DEA {
  const r = mengeToDea(m);
  expect(r.ok).toBe(true);
  if (!r.ok) throw new Error('unreachable');
  const d = r.result;
  expect(validate(d).filter((x) => x.code === 'dea.missing' || x.severity === 'error')).toEqual([]);
  expect(strs(enumerate(d, 6))).toEqual(strs(enumerate(m, 6)));
  const eq = equivalent(d, m);
  expect(eq.ok && eq.result.equal).toBe(true);
  expect(d.origin?.method).toBe('menge2dea');
  return d;
}

describe('mengeToDea', () => {
  it('1.7-Mengen', () => {
    const objs = load('b1-7.txt').filter((o): o is MengeObj => o.kind === 'menge');
    expect(objs.length).toBe(3);
    for (const m of objs) check(m);
  });
  it('Präfixbaum für {01, 1}: Namen und Größe', () => {
    const d = check(makeMenge('L', [w('1'), w('01')], null));
    expect(d.states.map((s) => s.name).sort()).toEqual(['0', '01', '1', '∅', 'ε'].sort());
    expect(d.accept.length).toBe(2);
  });
  it('leere Menge: nur Start, nicht akzeptierend', () => {
    const d = check(makeMenge('E', [], ['a', 'b']));
    expect(d.states.length).toBe(1);
    expect(d.accept).toEqual([]);
    expect(d.transitions.length).toBe(2);
  });
  it('Menge mit ε', () => {
    const d = check(makeMenge('E', [w(''), w('a')], ['a']));
    expect(d.accept).toContain(d.start);
  });
  it('Schritte und Verteiler', () => {
    const m = makeMenge('L', [w('ab'), w('b')], null);
    const r = mengeToDea(m);
    expect(r.steps.map((s) => s.explanation.key)).toEqual(['proc.trie.word', 'proc.trie.word', 'proc.trie.trap']);
    expect(applicableMethods(m)).toEqual(['menge2dea']);
    expect(runMethod('menge2dea', [m]).ok).toBe(true);
    expect(runMethod('menge2dea', [r.ok ? r.result : m]).ok).toBe(false);
  });
});

describe('chainPlan', () => {
  const regex = (expr: RegExpr): FormalObject => ({ kind: 'regex', name: 'R', alphabet: ['a'], expr });
  const m = makeMenge('L', [w('a')], null);
  const doc = (f: string) => load(f);
  it('Tabelle', () => {
    const rx = regex({ op: 'sym', sym: 'a' });
    expect(chainPlan(rx)).toEqual(['regex2grammar', 'grammar2nea', 'nea2dea', 'minimize']);
    expect(chainPlan(rx, { thompson: true })).toEqual(['thompson', 'nea2dea', 'minimize']);
    expect(chainPlan(m)).toEqual(['menge2dea', 'minimize']);
    expect(chainPlan({ kind: 'egrep', name: 'G', pattern: 'a+', alphabet: [] })).toEqual([
      'egrep2regex', 'regex2grammar', 'grammar2nea', 'nea2dea', 'minimize',
    ]);
    expect(chainPlan({ kind: 'egrep', name: 'G', pattern: '(a)\\1', alphabet: [] })).toBeNull();
    const nea = doc('b2-36.txt').find((o) => o.kind === 'nea');
    if (nea) expect(chainPlan(nea)).toEqual(['nea2dea', 'minimize']);
    const mealy = doc('b2-1.txt')[0] as FormalObject;
    expect(chainPlan(mealy)).toBeNull();
    const dea = r2(m);
    expect(chainPlan(dea)).toEqual(['minimize']);
    expect(chainPlan({ ...dea, transitions: dea.transitions.slice(1) })).toBeNull();
  });
});

function r2(m: MengeObj): DEA {
  const r = mengeToDea(m);
  if (!r.ok) throw new Error('x');
  return r.result;
}

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randRegex(rng: () => number, depth: number): RegExpr {
  if (depth === 0 || rng() < 0.25) return { op: 'sym', sym: rng() < 0.5 ? 'a' : 'b' };
  const k = rng();
  if (k < 0.35) return { op: 'union', left: randRegex(rng, depth - 1), right: randRegex(rng, depth - 1) };
  if (k < 0.7) return { op: 'concat', left: randRegex(rng, depth - 1), right: randRegex(rng, depth - 1) };
  return { op: 'star', inner: randRegex(rng, depth - 1) };
}

function runChain(src: FormalObject, plan: MethodId[]): void {
  let cur: FormalObject = src;
  for (const id of plan) {
    const r = runMethod(id, [cur], { steps: false });
    expect(r.ok, `${src.name}: ${id}`).toBe(true);
    if (!r.ok) return;
    cur = r.result;
  }
  expect(cur.kind).toBe('dea');
  const eq = equivalent(src, cur);
  expect(eq.ok && eq.result.equal, src.name).toBe(true);
  const again = minimize(cur as DEA);
  expect(again.ok && again.result.states.length).toBe((cur as DEA).states.length);
}

describe('Kette bis zum minimalen DEA', () => {
  it('zufällige Ausdrücke (fester Seed)', () => {
    const rng = mulberry32(20240607);
    for (let i = 0; i < 40; i++) {
      const o: FormalObject = { kind: 'regex', name: `R${i}`, alphabet: ['a', 'b'], expr: randRegex(rng, 3) };
      for (const th of [false, true]) {
        const p = chainPlan(o, { thompson: th });
        expect(p).not.toBeNull();
        runChain(o, p as MethodId[]);
      }
    }
  });
  it('Typ-3-Beispiele aus examples/ (Kapitel <= 3)', () => {
    const index = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8')) as { file: string; chapter: number }[];
    let n = 0;
    for (const e of index.filter((x) => x.chapter <= 3)) {
      for (const o of load(e.file)) {
        const p = chainPlan(o);
        if (p === null) continue;
        n++;
        runChain(o, p);
      }
    }
    expect(n).toBeGreaterThan(3);
  });
});
