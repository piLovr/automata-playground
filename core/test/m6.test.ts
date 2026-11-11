import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  findDerivation,
  grammarType,
  hierarchyPlacement,
  parseDocument,
  printDocument,
  printObject,
  runTmFast,
  simulate,
  tmCost,
  wordProblem,
} from '../index';
import type { Derivation, FormalObject, Grammar, TM, Word } from '../index';

const examplesDir = new URL('../../examples/', import.meta.url);
const readExample = (name: string): string => readFileSync(new URL(name, examplesDir), 'utf8');

/** Parst Text ohne Fehler und liefert das erste Objekt. */
function load(text: string): FormalObject {
  const { doc, diagnostics } = parseDocument(text);
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect(doc.objects.length).toBeGreaterThanOrEqual(1);
  return doc.objects[0] as FormalObject;
}
const loadFile = (name: string): FormalObject => load(readExample(name));
const w = (s: string): Word => s.split('');

/** Alle Wörter über dem Alphabet bis maxLen, nach Länge geordnet. */
function allWords(alphabet: string[], maxLen: number): Word[] {
  const out: Word[] = [[]];
  let layer: Word[] = [[]];
  for (let n = 1; n <= maxLen; n++) {
    layer = layer.flatMap((p) => alphabet.map((c) => [...p, c]));
    out.push(...layer);
  }
  return out;
}

/** Deterministischer Zufallsgenerator (mulberry32) mit Seed. */
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

/**
 * Zufällige Grammatik über {a, b} mit Nichtterminalen S, A, B.
 * nonContracting: |links| ≤ |rechts|, rechts nie leer. Sonst beliebige Längen (rechts auch ε).
 */
function randomGrammar(r: () => number, contracting: boolean): string {
  const pick = (xs: string[]): string => xs[Math.floor(r() * xs.length)]!;
  const nts = ['S', 'A', 'B'];
  const all = ['S', 'A', 'B', 'a', 'b'];
  const count = 2 + Math.floor(r() * 4);
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    const ll = 1 + Math.floor(r() * 3);
    const left: string[] = i === 0 ? ['S'] : Array.from({ length: ll }, () => pick(all));
    if (!left.some((x) => nts.includes(x))) left[0] = pick(nts);
    const minR = contracting ? 0 : left.length;
    const rl = minR + Math.floor(r() * (4 - minR));
    const right = Array.from({ length: rl }, () => pick(all));
    lines.push(`${left.join('')} -> ${right.length > 0 ? right.join('') : 'ε'}`);
  }
  return `grammatik R {\n  nichtterminale S A B\n  terminale a b\n  start S\n  ${lines.join('\n  ')}\n}`;
}

/** Brute force: kürzeste Ableitungslänge je Satzform, nur Satzformen der Länge ≤ maxLen. */
function closure(g: Grammar, maxLen: number): Map<string, number> {
  const start = g.start as string;
  const dist = new Map<string, number>([[start, 0]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const f = queue[i]!;
    const d = dist.get(f)!;
    for (const p of g.productions) {
      const L = p.left.join('');
      const R = p.right.join('');
      for (let pos = 0; pos + L.length <= f.length; pos++) {
        if (!f.startsWith(L, pos)) continue;
        const nf = f.slice(0, pos) + R + f.slice(pos + L.length);
        if (nf.length <= maxLen && !dist.has(nf)) {
          dist.set(nf, d + 1);
          queue.push(nf);
        }
      }
    }
  }
  return dist;
}

/** Prüft, dass jeder Schritt die angegebene Produktion an der angegebenen Stelle anwendet. */
function checkDerivation(g: Grammar, word: Word, d: Derivation, minSteps?: number): void {
  expect(d.start).toEqual([g.start]);
  let cur: Word = d.start;
  for (const st of d.steps) {
    const p = g.productions.find((x) => x.id === st.production);
    expect(p, `Produktion ${st.production}`).toBeDefined();
    if (!p) return;
    expect(cur.slice(st.pos, st.pos + p.left.length)).toEqual(p.left);
    const next = [...cur.slice(0, st.pos), ...p.right, ...cur.slice(st.pos + p.left.length)];
    expect(st.form).toEqual(next);
    cur = next;
  }
  expect(cur).toEqual(word);
  if (minSteps !== undefined) expect(d.steps.length).toBe(minSteps);
}

const SEEDS = 40;

describe('wordProblem gegen Brute force (nicht verkürzend)', () => {
  it('derivable/notDerivable stimmen für alle Wörter bis Länge 4; Ableitungen gültig und kürzest', () => {
    for (let k = 0; k < SEEDS; k++) {
      const text = randomGrammar(rng(20261111 + k), false);
      const g = load(text) as Grammar;
      expect(grammarType(g).nonContracting, text).toBe(true);
      const dist = closure(g, 4);
      for (const word of allWords(['a', 'b'], 4)) {
        const res = wordProblem(g, word);
        expect(res.ok, `${text} / ${word.join('')}`).toBe(true);
        if (!res.ok) continue;
        const exp = dist.get(word.join(''));
        const where = `${text} / ${word.join('')}`;
        if (exp === undefined) {
          expect(res.result.verdict, where).toBe('notDerivable');
          expect(res.result.exact, where).toBe(true);
          expect(res.result.derivation, where).toBeNull();
        } else {
          expect(res.result.verdict, where).toBe('derivable');
          expect(res.result.derivation, where).not.toBeNull();
          checkDerivation(g, word, res.result.derivation!, exp);
        }
      }
    }
  });
});

describe('Typ 0 (verkürzend): nie notDerivable', () => {
  const fixed = load(`grammatik H {
    nichtterminale S X
    terminale a b
    start S
    S -> aSb | XX
    XX -> ε
  }`) as Grammar;

  it('feste Grammatik: ab ableitbar, b nicht entscheidbar, Diagnose derive.limit', () => {
    expect(grammarType(fixed).type).toBe(0);
    expect(grammarType(fixed).nonContracting).toBe(false);
    const ab = wordProblem(fixed, w('ab'));
    expect(ab.ok && ab.result.verdict).toBe('derivable');
    const b = wordProblem(fixed, w('b'));
    expect(b.ok).toBe(true);
    if (b.ok) {
      expect(b.result.verdict).not.toBe('notDerivable');
      expect(b.result.exact).toBe(false);
      expect(b.result.limitHit).not.toBeNull();
    }
    const f = findDerivation(fixed, w('b'));
    expect(f.ok).toBe(false);
    if (f.ok) throw new Error('erwartet ok: false');
    const warn = f.diagnostics.find((d) => d.code === 'derive.limit');
    expect(warn?.severity).toBe('warning');
    expect(['length', 'steps']).toContain(warn?.params.what);
  });

  it('zufällige verkürzende Typ-0-Grammatiken: nie notDerivable', () => {
    const picked: string[] = [];
    for (let k = 0; k < 60 && picked.length < 8; k++) {
      const text = randomGrammar(rng(777 + k), true);
      const gt = grammarType(load(text) as Grammar);
      if (gt.type === 0 && !gt.nonContracting) picked.push(text);
    }
    expect(picked.length).toBeGreaterThanOrEqual(5);
    for (const text of picked) {
      const g = load(text) as Grammar;
      for (const word of allWords(['a', 'b'], 4)) {
        const where = `${text} / ${word.join('')}`;
        const res = wordProblem(g, word);
        expect(res.ok, where).toBe(true);
        if (!res.ok) continue;
        expect(res.result.verdict, where).not.toBe('notDerivable');
        if (res.result.verdict === 'derivable') {
          checkDerivation(g, word, res.result.derivation!);
        } else {
          expect(res.result.limitHit, where).not.toBeNull();
          const f = findDerivation(g, word);
          expect(f.ok, where).toBe(false);
          if (f.ok) throw new Error(where);
          expect(f.diagnostics.some((d) => d.code === 'derive.limit'), where).toBe(true);
        }
      }
    }
  });
});

describe('LBA-Grenze (5.21)', () => {
  const rightRunner = (header: string): string => `tm Rechts {
  alphabet a
  blank □
  ${header}
  states q f
  start q
  accept f
  q, a -> q, a, R
  q, □ -> q, □, R
}`;
  const acceptOnExit = `tm Ausgang {
  alphabet a
  blank □
  lba
  states q f
  start q
  accept f
  q, a -> q, a, R
  q, □ -> f, □, R
}`;

  it('lba-Kopfzeile: bounded, Text-Rundlauf erhält bounded', () => {
    const text = rightRunner('lba');
    const m = load(text) as TM;
    expect(m.bounded).toBe(true);
    expect(printObject(m)).toMatch(/^\s*lba\s*$/m);
    const printed = printDocument(parseDocument(text).doc);
    const again = parseDocument(printed).doc.objects[0] as TM;
    expect(again.bounded).toBe(true);
    expect(printDocument(parseDocument(printed).doc)).toBe(printed);
  });

  it('ohne lba-Kopfzeile nicht bounded', () => {
    const m = load(rightRunner('')) as TM;
    expect(m.bounded ?? false).toBe(false);
    const t = simulate(m, w('aa'), { stepLimit: 20 });
    expect(t.result).toBe('limit');
    for (const s of t.steps) expect(s.tape?.bounds).toBeUndefined();
  });

  it('Kopf läuft rechts heraus → bound; jede TapeView bounds [-1, n]', () => {
    const m = load(rightRunner('lba')) as TM;
    for (const n of [1, 3]) {
      const word = Array.from({ length: n }, () => 'a');
      const t = simulate(m, word);
      expect(t.result).toBe('bound');
      const tapes = t.steps.map((s) => s.tape).filter((x): x is NonNullable<typeof x> => x !== undefined);
      expect(tapes.length).toBeGreaterThan(0);
      for (const tv of tapes) expect(tv.bounds).toEqual([-1, n]);
      const last = t.steps[t.steps.length - 1]!;
      expect(last.explanation.key).toBe('sim.tm.bound');
      expect(last.tape?.head).toBe(n + 1);
      expect(t.steps.length).toBe(n + 2);
    }
  });

  it('n = 0: bounds [-1, 0], bound nach einem Schritt', () => {
    const m = load(rightRunner('lba')) as TM;
    const t = simulate(m, []);
    expect(t.result).toBe('bound');
    expect(t.steps.length).toBe(2);
    for (const s of t.steps) expect(s.tape?.bounds).toEqual([-1, 0]);
  });

  it('Endzustand hat Vorrang: wird auf dem Austrittsschritt f erreicht, zählt accepted', () => {
    const m = load(acceptOnExit) as TM;
    expect(simulate(m, w('a')).result).toBe('accepted');
    expect(simulate(m, []).result).toBe('accepted');
  });

  it('runTmFast liefert dieselben Zahlen wie simulate (auch bound)', () => {
    const m = load(rightRunner('lba')) as TM;
    const acc = load(acceptOnExit) as TM;
    for (const machine of [m, acc]) {
      for (const word of allWords(['a'], 3)) {
        const t = simulate(machine, word);
        expect(runTmFast(machine, word, 10000)).toEqual({
          result: t.result,
          steps: t.steps.length - 1,
          visited: t.visited,
        });
      }
    }
  });

  it('Hierarchie: LBA → Stufe 1 (lba), nicht exakt', () => {
    expect(hierarchyPlacement(load(rightRunner('lba')))).toEqual({ level: 1, reason: 'lba', exact: false });
  });
});

describe('hierarchyPlacement je Objekttyp (5.25)', () => {
  it('DEA, NEA, regex, egrep ohne Rückverweis, Menge: Stufe 3, exakt', () => {
    expect(hierarchyPlacement(loadFile('b2-14.txt'))).toEqual({ level: 3, reason: 'dea', exact: true });
    expect(hierarchyPlacement(loadFile('b2-66.txt'))).toEqual({ level: 3, reason: 'nea', exact: true });
    expect(hierarchyPlacement(loadFile('b2-24.txt'))).toEqual({ level: 3, reason: 'regex', exact: true });
    expect(hierarchyPlacement(loadFile('b3-23.txt'))).toEqual({ level: 3, reason: 'egrep', exact: true });
    expect(hierarchyPlacement(loadFile('b1-7.txt'))).toEqual({ level: 3, reason: 'menge', exact: true });
  });

  it('egrep mit Rückverweis: Stufe 1 egrepBackref, nicht exakt', () => {
    const e = load(String.raw`egrep Rueck = (ab)\1`);
    expect(hierarchyPlacement(e)).toEqual({ level: 1, reason: 'egrepBackref', exact: false });
  });

  it('Grammatik Typ 3 → Stufe 3 grammar3, exakt', () => {
    const g = load(`grammatik R3 {
      nichtterminale S
      terminale a b
      start S
      S -> aS | b
    }`) as Grammar;
    expect(grammarType(g).type).toBe(3);
    expect(hierarchyPlacement(g)).toEqual({ level: 3, reason: 'grammar3', exact: true });
  });

  it('Grammatik Typ 2 → Stufe 2 grammar2, nicht exakt', () => {
    const g = loadFile('b4-15.txt') as Grammar;
    expect(grammarType(g).type).toBe(2);
    expect(hierarchyPlacement(g)).toEqual({ level: 2, reason: 'grammar2', exact: false });
  });

  it('Grammatik Typ 1 (anbncn) → Stufe 1 grammar1, nicht exakt', () => {
    const g = load(`grammatik G {
      nichtterminale S B C
      terminale a b c
      start S
      S -> aSBC | aBC
      CB -> BC
      aB -> ab
      bB -> bb
      bC -> bc
      cC -> cc
    }`) as Grammar;
    expect(hierarchyPlacement(g)).toEqual({ level: 1, reason: 'grammar1', exact: false });
  });

  it('Typ 0 verkürzend → Stufe 0 grammar0, nicht exakt', () => {
    const g = load(`grammatik H {
      nichtterminale S X
      terminale a b
      start S
      S -> aSb | XX
      XX -> ε
    }`) as Grammar;
    expect(grammarType(g).type).toBe(0);
    expect(grammarType(g).nonContracting).toBe(false);
    expect(hierarchyPlacement(g)).toEqual({ level: 0, reason: 'grammar0', exact: false });
  });

  it('Typ 0 nicht verkürzend → Stufe 1 grammar1 (gleiche Sprachklasse), nicht exakt', () => {
    const g = load(`grammatik N {
      nichtterminale S A
      terminale a b
      start S
      S -> AA | a
      AA -> ab
      aA -> bb
    }`) as Grammar;
    expect(grammarType(g).type).toBe(0);
    expect(grammarType(g).nonContracting).toBe(true);
    expect(hierarchyPlacement(g)).toEqual({ level: 1, reason: 'grammar1', exact: false });
  });

  it('NKA → Stufe 2 nka, nicht exakt', () => {
    expect(hierarchyPlacement(loadFile('b4-6.txt'))).toEqual({ level: 2, reason: 'nka', exact: false });
  });

  it('TM ohne lba → Stufe 0 tm, nicht exakt', () => {
    expect(hierarchyPlacement(loadFile('b5-9.txt'))).toEqual({ level: 0, reason: 'tm', exact: false });
  });

  it('Mealy und Moore: keine Stufe (transducer)', () => {
    for (const f of ['mealy-paritaet.txt', 'b2-10.txt']) {
      const p = hierarchyPlacement(loadFile(f));
      expect(p.level, f).toBeNull();
      expect(p.reason, f).toBe('transducer');
      expect(p.exact, f).toBe(false);
    }
  });
});

describe('tmCost gegen simulate (5.20, b5-9, Länge ≤ 4)', () => {
  const tm = loadFile('b5-9.txt') as TM;
  const rows = tmCost(tm, { maxLen: 4 });

  it('Zeilen für n = 0 … 4', () => {
    expect(rows.map((r) => r.n)).toEqual([0, 1, 2, 3, 4]);
  });

  it('Anzahl, Halte, Maxima und Worst-Wort stimmen mit einzelnen Läufen überein', () => {
    for (const row of rows) {
      const words = allWords(tm.alphabet, 4).filter((x) => x.length === row.n);
      const traces = words.map((x) => simulate(tm, x));
      const halted = traces.filter((t) => t.result !== 'limit');
      expect(row.words).toBe(words.length);
      expect(row.halted).toBe(halted.length);
      if (halted.length === 0) {
        expect(row.maxSteps).toBeNull();
        expect(row.maxVisited).toBeNull();
        expect(row.worstWord).toBeNull();
        continue;
      }
      const maxSteps = Math.max(...halted.map((t) => t.steps.length - 1));
      const maxVisited = Math.max(...halted.map((t) => t.visited ?? 0));
      expect(row.maxSteps).toBe(maxSteps);
      expect(row.maxVisited).toBe(maxVisited);
      expect(row.worstWord).not.toBeNull();
      expect(simulate(tm, row.worstWord!).steps.length - 1).toBe(maxSteps);
    }
  });

  it('runTmFast liefert dieselben Schritte und Felder wie simulate', () => {
    for (const word of allWords(tm.alphabet, 4)) {
      const t = simulate(tm, word);
      expect(runTmFast(tm, word, 10000)).toEqual({
        result: t.result,
        steps: t.steps.length - 1,
        visited: t.visited,
      });
    }
  });
});

describe('Beispielindex examples/index.json', () => {
  it('jede Datei ist vorhanden und parst ohne Fehler', () => {
    const index = JSON.parse(readExample('index.json')) as { id: string; file: string }[];
    expect(index.length).toBeGreaterThan(0);
    for (const e of index) {
      const { doc, diagnostics } = parseDocument(readExample(e.file));
      expect(diagnostics.filter((d) => d.severity === 'error'), e.id).toEqual([]);
      expect(doc.objects.length, e.id).toBeGreaterThanOrEqual(1);
    }
  });
});
