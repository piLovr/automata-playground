// M3, Teil C: Sprach-Explorer (core/explore über core/index.ts).
// Erwartungen aus docs/kern-spec-m3.md (Teil A, C) und docs/skript-notizen-m3.md (2.3, 2.10, 4.6, 2.14 …).
// Zufall: fester Seed, eigener PRNG (mulberry32). Vergleich gegen enumerate als Orakel.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  countByLength,
  enumerate,
  evalLang,
  outputsTable,
  parseDocument,
  wordsPage,
} from '../index';
import type { Diagnostic, Document, FormalObject, Mealy, ProcResult, Word } from '../index';

// ---------------------------------------------------------------------------
// Hilfen

const EX = fileURLToPath(new URL('../../examples/', import.meta.url));

function errors(ds: Diagnostic[]): Diagnostic[] {
  return ds.filter((d) => d.severity === 'error');
}

function loadEx(file: string): Document {
  const { doc, diagnostics } = parseDocument(readFileSync(join(EX, file), 'utf8'));
  expect(errors(diagnostics)).toEqual([]);
  return doc;
}

function parse(text: string): Document {
  const { doc, diagnostics } = parseDocument(text);
  expect(errors(diagnostics)).toEqual([]);
  return doc;
}

function obj<T extends FormalObject = FormalObject>(doc: Document, name: string): T {
  const o = doc.objects.find((x) => x.name === name);
  if (!o) throw new Error(`Objekt ${name} fehlt`);
  return o as T;
}

function okOf<T>(r: ProcResult<T>): T {
  if (!r.ok) throw new Error('ProcResult ok=false: ' + r.diagnostics.map((d) => d.code).join(','));
  return r.result;
}

/** Anzahl der Wörter je Länge 0..maxLen aus einer Wortliste (Orakel). */
function byLength(words: Word[], maxLen: number): bigint[] {
  const c: bigint[] = Array.from({ length: maxLen + 1 }, () => 0n);
  for (const w of words) {
    if (w.length <= maxLen) c[w.length] = (c[w.length] ?? 0n) + 1n;
  }
  return c;
}

/** Alle Seiten von wordsPage zusammengesetzt; prüft, dass die Seiten fortschreiten. */
function allPages(o: FormalObject, maxLen: number, size: number): Word[] {
  const out: Word[] = [];
  let offset = 0;
  for (let guard = 0; guard < 100000; guard++) {
    const p = okOf(wordsPage(o, { maxLen, offset, limit: size }));
    out.push(...p.words);
    offset += p.words.length;
    if (p.done) return out;
    expect(p.words.length).toBeGreaterThan(0);
  }
  throw new Error('Seitenschleife endet nicht');
}

/** mulberry32: kleiner, deterministischer PRNG mit festem Seed. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Zufälliger NEA über {0,1}: 1–4 Zustände, bis zu 6 Kanten mit ε, Einzel- und Zweisymbolwörtern. */
function randomNeaText(name: string, r: () => number): string {
  const n = 1 + Math.floor(r() * 4);
  const states = Array.from({ length: n }, (_, i) => `q${i}`);
  const labels = ['ε', '0', '1', '00', '01', '10', '11'];
  const pick = <T,>(xs: T[]): T => xs[Math.floor(r() * xs.length)] as T;
  const trans: string[] = [];
  const count = Math.floor(r() * 7);
  for (let i = 0; i < count; i++) {
    trans.push(`${pick(states)} -${pick(labels)}-> ${pick(states)}`);
  }
  const acc = states.filter(() => r() < 0.4);
  if (acc.length === 0) acc.push(pick(states));
  return [
    `nea ${name} {`,
    '  alphabet 0 1',
    `  states ${states.join(' ')}`,
    '  start q0',
    `  accept ${acc.join(' ')}`,
    ...trans.map((t) => `  ${t}`),
    '}',
    '',
  ].join('\n');
}

/** Zufälliger regulärer Ausdruck über {a,b}; jede Verknüpfung klammerweise. */
function randomRegex(r: () => number, depth: number): string {
  if (depth === 0 || r() < 0.3) return r() < 0.5 ? 'a' : 'b';
  const k = Math.floor(r() * 3);
  if (k === 0) return `(${randomRegex(r, depth - 1)}|${randomRegex(r, depth - 1)})`;
  if (k === 1) return `(${randomRegex(r, depth - 1)})(${randomRegex(r, depth - 1)})`;
  return `(${randomRegex(r, depth - 1)})*`;
}

const DUALZAHL = obj(loadEx('b2-3.txt'), 'Dualzahl');

// ---------------------------------------------------------------------------
// countByLength

describe('countByLength: exakte Zählung über den DEA', () => {
  it('Dualzahl (DEA 2.3, -?(0|1)+): Anzahl je Länge 0, 2, 6, 12, 24, 48, 96', () => {
    // Länge 1: 0,1; Länge n ≥ 2: 2^n Bitfolgen + 2^(n-1) mit Vorzeichen = 3·2^(n-1)
    const r = okOf(countByLength(DUALZAHL, 6));
    expect(r.exact).toBe(true);
    expect(r.counts).toEqual([0n, 2n, 6n, 12n, 24n, 48n, 96n]);
  });

  it('(0|1)*01: Anzahl 0,0,1,2,4,8,16,32 und Länge 60 ergibt 2^58', () => {
    const re = loadEx('ra-endet01.txt');
    const o = obj(re, 'Endet01');
    const r7 = okOf(countByLength(o, 7));
    expect(r7.exact).toBe(true);
    expect(r7.counts).toEqual([0n, 0n, 1n, 2n, 4n, 8n, 16n, 32n]);
    const r60 = okOf(countByLength(o, 60));
    expect(r60.counts.length).toBe(61);
    expect(r60.counts[60]).toBe(2n ** 58n);
  });

  it('endliche Menge {01, 1, 0}: 0, 2, 1', () => {
    const doc = parse('menge M = {01, 1, 0}\n');
    const r = okOf(countByLength(obj(doc, 'M'), 3));
    expect(r.exact).toBe(true);
    expect(r.counts).toEqual([0n, 2n, 1n, 0n]);
  });

  it('Menge mit upTo (L* bis Länge 3 aus dem Sprachrechner) gilt als endliche Menge: 1,1,1,1,0,0,0', () => {
    const star = evalLang('{0}*', EMPTY_DOC, { maxLen: 3 }).result;
    expect(star).not.toBeNull();
    const r = okOf(countByLength(star!, 6));
    expect(r.exact).toBe(true);
    expect(r.counts).toEqual([1n, 1n, 1n, 1n, 0n, 0n, 0n]);
  });
});

const EMPTY_DOC: Document = { version: 1, objects: [] };

describe('countByLength: Stichprobe über Simulation', () => {
  it('NKA 4.6 (0^k 1^k): exact false; gerade Längen 2,4,6 je 1, ungerade 0', () => {
    const nka = obj(loadEx('b4-6.txt'), 'NullEins');
    const r = okOf(countByLength(nka, 7, { stepLimit: 10000 }));
    expect(r.exact).toBe(false);
    expect(r.counts[1]).toBe(0n);
    expect(r.counts[2]).toBe(1n);
    expect(r.counts[3]).toBe(0n);
    expect(r.counts[4]).toBe(1n);
    expect(r.counts[5]).toBe(0n);
    expect(r.counts[6]).toBe(1n);
    expect(r.counts[7]).toBe(0n);
  });

  it('TM ohne erreichbaren Endzustand bei Schrittlimit: ok, exact false, alle Zählungen 0', () => {
    const doc = parse(`tm Loop {
  alphabet 0 1
  blank □
  states s f+ f-
  start s
  accept f+
  reject f-
  s, 0 -> s, 0, R
  s, 1 -> s, 1, R
  s, □ -> s, □, R
}
`);
    const r = okOf(countByLength(obj(doc, 'Loop'), 3, { stepLimit: 50 }));
    expect(r.exact).toBe(false);
    expect(r.counts).toEqual([0n, 0n, 0n, 0n]);
  });

  it('Kandidatenlimit: NKA 4.6 mit maxLen 17 über zwei Zeichen (> 200 000) liefert algo.limit', () => {
    const nka = obj(loadEx('b4-6.txt'), 'NullEins');
    const r = countByLength(nka, 17);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.diagnostics.some((d) => d.code === 'algo.limit')).toBe(true);
  }, 60000);
});

describe('countByLength: Zufall gegen enumerate (fester Seed)', () => {
  it('40 zufällige NEA über {0,1}: counts == Längenverteilung von enumerate (Länge ≤ 7)', () => {
    const r = rng(20101);
    for (let i = 0; i < 40; i++) {
      const doc = parse(randomNeaText(`R${i}`, r));
      const o = obj(doc, `R${i}`);
      const got = okOf(countByLength(o, 7));
      expect(got.exact).toBe(true);
      expect(got.counts).toEqual(byLength(enumerate(o, 7), 7));
    }
  });

  it('40 zufällige reguläre Ausdrücke über {a,b}: counts == Längenverteilung von enumerate (Länge ≤ 7)', () => {
    const r = rng(777);
    for (let i = 0; i < 40; i++) {
      const doc = parse(`regex X${i} = ${randomRegex(r, 3)}\n`);
      const o = obj(doc, `X${i}`);
      const got = okOf(countByLength(o, 7));
      expect(got.exact).toBe(true);
      expect(got.counts).toEqual(byLength(enumerate(o, 7), 7));
    }
  });
});

// ---------------------------------------------------------------------------
// wordsPage

describe('wordsPage: Reihenfolge und Seiten', () => {
  it('(0|1)*01 bis Länge 3: 01, 001, 101; done true', () => {
    const o = obj(loadEx('ra-endet01.txt'), 'Endet01');
    const p = okOf(wordsPage(o, { maxLen: 3, offset: 0, limit: 50 }));
    expect(p.words).toEqual([['0', '1'], ['0', '0', '1'], ['1', '0', '1']]);
    expect(p.done).toBe(true);
    expect(p.exact).toBe(true);
  });

  it('Dualzahl bis Länge 3: gleiche Reihenfolge wie enumerate, done true', () => {
    const p = okOf(wordsPage(DUALZAHL, { maxLen: 3, offset: 0, limit: 1000 }));
    expect(p.words).toEqual(enumerate(DUALZAHL, 3));
    expect(p.words.length).toBe(20);
    expect(p.done).toBe(true);
  });

  it('Seite endet vor dem Ende: done false, Länge der Seite = limit', () => {
    const p = okOf(wordsPage(DUALZAHL, { maxLen: 3, offset: 0, limit: 5 }));
    expect(p.words.length).toBe(5);
    expect(p.done).toBe(false);
  });

  it('Versatz: offset 13, limit 4 entspricht enumerate[13..17)', () => {
    const all = enumerate(DUALZAHL, 3);
    const p = okOf(wordsPage(DUALZAHL, { maxLen: 3, offset: 13, limit: 4 }));
    expect(p.words).toEqual(all.slice(13, 17));
  });

  it('letzte Seite: offset 15, limit 10 liefert die restlichen 5 Wörter und done true', () => {
    const p = okOf(wordsPage(DUALZAHL, { maxLen: 3, offset: 15, limit: 10 }));
    expect(p.words).toEqual(enumerate(DUALZAHL, 3).slice(15));
    expect(p.words.length).toBe(5);
    expect(p.done).toBe(true);
  });

  it('Dualzahl bis Länge 60: erste Wörter in Längen- und Alphabetreihenfolge (Alphabet 0 1 -)', () => {
    const p = okOf(wordsPage(DUALZAHL, { maxLen: 60, offset: 0, limit: 8 }));
    expect(p.words).toEqual([
      ['0'],
      ['1'],
      ['0', '0'],
      ['0', '1'],
      ['1', '0'],
      ['1', '1'],
      ['-', '0'],
      ['-', '1'],
    ]);
    expect(p.done).toBe(false);
    expect(p.exact).toBe(true);
  });

  it('Seitenweise über alle Wörter bis Länge 7 (Dualzahl) ergibt enumerate', () => {
    expect(allPages(DUALZAHL, 7, 7)).toEqual(enumerate(DUALZAHL, 7));
  });

  it('Seitenweise über (0|1)*01 bis Länge 7 (Seiten zu 5) ergibt enumerate', () => {
    const o = obj(loadEx('ra-endet01.txt'), 'Endet01');
    expect(allPages(o, 7, 5)).toEqual(enumerate(o, 7));
  });

  it('20 zufällige Ausdrücke: Seiten zu 5 ergeben enumerate bis Länge 7', () => {
    const r = rng(4242);
    for (let i = 0; i < 20; i++) {
      const doc = parse(`regex P${i} = ${randomRegex(r, 3)}\n`);
      const o = obj(doc, `P${i}`);
      expect(allPages(o, 7, 5)).toEqual(enumerate(o, 7));
    }
  });
});

describe('wordsPage: NKA-Stichprobe (4.6)', () => {
  it('0011 und 000111 kommen vor, 0101 nicht; exact false', () => {
    const nka = obj(loadEx('b4-6.txt'), 'NullEins');
    const p = okOf(wordsPage(nka, { maxLen: 6, offset: 0, limit: 1000, stepLimit: 10000 }));
    expect(p.exact).toBe(false);
    expect(p.words).toContainEqual(['0', '0', '1', '1']);
    expect(p.words).toContainEqual(['0', '0', '0', '1', '1', '1']);
    expect(p.words).not.toContainEqual(['0', '1', '0', '1']);
  });
});

// ---------------------------------------------------------------------------
// outputsTable (Mealy/Moore)

describe('outputsTable: Mealy', () => {
  // examples/mealy-paritaet.txt: Zustand g (gerade Anzahl Einsen), u (ungerade).
  // Aus den Kanten folgt: Ausgabe_i = x_i XOR (Anzahl Einsen vor i mod 2).
  const mealy = obj<Mealy>(loadEx('mealy-paritaet.txt'), 'Paritaet');

  it('Länge 1 und 2 in Längen-/Alphabetordnung mit den Ausgabewörtern aus dem Diagramm', () => {
    const rows = outputsTable(mealy, 2).filter((r) => r.input.length > 0);
    expect(rows).toEqual([
      { input: ['0'], output: ['0'] },
      { input: ['1'], output: ['1'] },
      { input: ['0', '0'], output: ['0', '0'] },
      { input: ['0', '1'], output: ['0', '1'] },
      { input: ['1', '0'], output: ['1', '1'] },
      { input: ['1', '1'], output: ['1', '0'] },
    ]);
  });

  it('Standardlimit 500 Zeilen', () => {
    expect(outputsTable(mealy, 10).length).toBe(500);
  });

  it('expliziter limit 3', () => {
    expect(outputsTable(mealy, 10, 3).length).toBe(3);
  });
});
