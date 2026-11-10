import { describe, expect, it } from 'vitest';
import {
  edit,
  emptyAutomaton,
  fromJSON,
  parseDocument,
  printDocument,
  printObject,
  toJSON,
} from '../index';
import type { Automaton, DEA, Document, NEA, StateId, Word } from '../index';
import { DEA_23, FIXTURES, asDea, firstObject, idOf } from './fixtures';

// Garantie 2: printDocument(parse(t)) ist Fixpunkt.
describe('Garantie 2: Text-Fixpunkt', () => {
  for (const [name, text] of Object.entries(FIXTURES)) {
    it(`${name}: Fixture ist gültig und Druck ist Fixpunkt`, () => {
      const first = parseDocument(text);
      expect(first.diagnostics).toEqual([]);
      const p1 = printDocument(first.doc);
      const second = parseDocument(p1);
      expect(second.diagnostics).toEqual([]);
      expect(printDocument(second.doc)).toBe(p1);
    });
  }
});

// Garantie 1: parse(print(m)) deep-equal m.
describe('Garantie 1: Text-Round-Trip für Fixtures', () => {
  for (const [name, text] of Object.entries(FIXTURES)) {
    it(`${name}: parse(print(m)) == m`, () => {
      const doc = parseDocument(text).doc;
      expect(parseDocument(printDocument(doc)).doc).toEqual(doc);
    });
  }

  it('DEA_23 mit ganzzahligem Layout: layout-Zeile bleibt erhalten', () => {
    const m = asDea(firstObject(parseDocument(DEA_23).doc));
    const m2 = edit.moveStates(m, {
      [idOf(m, 'A')]: { x: 80, y: 120 },
      [idOf(m, 'B')]: { x: 240, y: 120 },
      [idOf(m, 'M')]: { x: 80, y: 260 },
    });
    const objText = printObject(m2);
    expect(objText).toMatch(/^\s*layout\s/m);

    const back = asDea(firstObject(parseDocument(printDocument({ version: 1, objects: [m2] })).doc));
    expect(back.states.map((s) => s.pos)).toEqual([
      { x: 80, y: 120 },
      { x: 240, y: 120 },
      { x: 80, y: 260 },
      undefined,
    ]);
    expect(parseDocument(printDocument({ version: 1, objects: [m2] })).doc).toEqual({
      version: 1,
      objects: [m2],
    });
  });

  it('layout:false lässt die layout-Zeile weg', () => {
    const m = asDea(firstObject(parseDocument(DEA_23).doc));
    const m2 = edit.moveStates(m, { [idOf(m, 'A')]: { x: 10, y: 20 } });
    const text = printDocument({ version: 1, objects: [m2] }, { layout: false });
    expect(text).not.toMatch(/^\s*layout/m);
  });
});

// Garantie 3: fromJSON(toJSON(d)) deep-equal d.
describe('Garantie 3: JSON-Round-Trip', () => {
  for (const [name, text] of Object.entries(FIXTURES)) {
    it(`${name}`, () => {
      const doc = parseDocument(text).doc;
      const r = fromJSON(toJSON(doc));
      expect(r.diagnostics).toEqual([]);
      expect(r.doc).toEqual(doc);
    });
  }

  it('beliebige IDs und Sonderzeichen bleiben erhalten', () => {
    const odd: Document = {
      version: 1,
      objects: [
        {
          kind: 'dea',
          name: 'Odd',
          alphabet: ['a', ' '],
          states: [
            { id: 'x-1 ö', name: 'q', pos: { x: 1.5, y: -2 } },
            { id: 'Ω_2', name: 'r' },
          ],
          start: 'x-1 ö',
          accept: ['Ω_2'],
          transitions: [{ id: 't/9', from: 'x-1 ö', to: 'Ω_2', label: 'a' }],
        },
      ],
    };
    const r = fromJSON(toJSON(odd));
    expect(r.diagnostics).toEqual([]);
    expect(r.doc).toEqual(odd);
  });

  it('falsche Version ergibt json.version', () => {
    const r = fromJSON('{"version":2,"objects":[]}');
    expect(r.diagnostics.some((d) => d.code === 'json.version')).toBe(true);
    expect(r.doc).toBeUndefined();
  });

  it('unbekannte StateId in einer Kante ergibt json.invalid', () => {
    const bad = JSON.stringify({
      version: 1,
      objects: [
        {
          kind: 'dea',
          name: 'Bad',
          alphabet: ['a'],
          states: [{ id: 's0', name: 'A' }],
          start: 's0',
          accept: [],
          transitions: [{ id: 't0', from: 's0', to: 'nope', label: 'a' }],
        },
      ],
    });
    const r = fromJSON(bad);
    expect(r.diagnostics.some((d) => d.code === 'json.invalid')).toBe(true);
  });
});

// Garantien 1 bis 3, eigenschaftsbasiert mit festem Seed.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KEYWORDS = new Set(['alphabet', 'states', 'start', 'accept', 'layout', 'dea', 'nea']);
const NAME_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_+'".split('');
const SINGLE_SYMBOLS = ['0', '1', 'a', '-', ',', '#', '<', '>', '\\', '{', '}', ' '];

function randomModel(kind: 'dea' | 'nea', rnd: () => number): Automaton {
  const int = (lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1));
  const chance = (p: number): boolean => rnd() < p;
  const pick = <T,>(xs: readonly T[]): T => xs[int(0, xs.length - 1)] as T;
  const shuffle = <T,>(xs: readonly T[]): T[] => {
    const out = [...xs];
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  };

  // Alphabet: 1 bis 4 Einzelzeichen (inkl. Sonderzeichen und Leerzeichen) plus ein Mehrzeichen-Symbol.
  const singles = shuffle(SINGLE_SYMBOLS).slice(0, int(1, 4));
  const alphabet = [...singles, chance(0.5) ? 'ab' : 'zahl'];

  // Zustandsnamen, eindeutig, keine Schlüsselwörter.
  const n = int(1, 6);
  const names = new Set<string>();
  while (names.size < n) {
    let s = '';
    for (let k = int(1, 6); k > 0; k--) s += pick(NAME_CHARS);
    if (!KEYWORDS.has(s)) names.add(s);
  }

  let obj: Automaton = emptyAutomaton(kind, 'Zufall');
  obj = edit.setAlphabet(obj, alphabet);
  const ids: StateId[] = [];
  for (const name of names) {
    const r = edit.addState(obj, name);
    obj = r.obj;
    ids.push(r.id);
  }
  for (const id of ids) {
    if (chance(0.5)) obj = edit.moveStates(obj, { [id]: { x: int(-200, 200), y: int(-200, 200) } });
  }
  if (chance(0.8)) obj = edit.setStart(obj, pick(ids));
  for (const id of ids) {
    if (chance(0.4)) obj = edit.setAccepting(obj, id, true);
  }

  if (kind === 'dea') {
    let d = obj as DEA;
    for (const from of ids) {
      for (const sym of alphabet) {
        if (chance(0.7)) d = edit.setDeaTarget(d, from, sym, pick(ids));
      }
    }
    return d;
  }

  let nea = obj as NEA;
  for (const from of ids) {
    for (const to of ids) {
      if (!chance(0.3)) continue;
      const words: Word[] = [];
      const seen = new Set<string>();
      for (let k = int(1, 3); k > 0; k--) {
        const w: Word = [];
        for (let len = int(0, 3); len > 0 && alphabet.length > 0; len--) w.push(pick(alphabet));
        const key = JSON.stringify(w);
        if (!seen.has(key)) {
          seen.add(key);
          words.push(w);
        }
      }
      nea = edit.setEdgeLabels(nea, from, to, words);
    }
  }
  return nea;
}

describe('Garantien 1 bis 3, eigenschaftsbasiert (fester Seed)', () => {
  for (const [kind, seed] of [
    ['dea', 1001],
    ['nea', 2002],
  ] as const) {
    it(`200 zufällige ${kind.toUpperCase()}: Text- und JSON-Round-Trip`, () => {
      const rnd = mulberry32(seed);
      for (let i = 0; i < 200; i++) {
        const label = `${kind} #${i} (seed ${seed})`;
        const m = randomModel(kind, rnd);
        // Kanonische IDs und Reihenfolge durch einmal parse(print(m)).
        const canon = parseDocument(printDocument({ version: 1, objects: [m] }));
        expect(canon.diagnostics, label).toEqual([]);
        const c = canon.doc;
        // Text-Round-Trip.
        expect(parseDocument(printDocument(c)).doc, label).toEqual(c);
        // JSON-Round-Trip.
        expect(fromJSON(toJSON(c)).doc, label).toEqual(c);
      }
    });
  }
});
