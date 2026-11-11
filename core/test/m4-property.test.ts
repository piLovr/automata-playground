// M4, Teil C, Eigenschaftstest: zufällige kleine Typ-2-Grammatiken (≤ 3 Nichtterminale, ≤ 6
// Produktionen, Alphabet {a, b}). Fester Seed, eigener PRNG (mulberry32), damit der Lauf
// reproduzierbar ist.
// Erwartungen: docs/kern-spec-m4.md (Teil C, Eigenschaft), docs/skript-notizen-m4.md (4.27, 4.34–4.35).
// Nur core/index.ts.

import { describe, expect, it } from 'vitest';
import {
  bottomUpRun,
  cfgWords,
  grammarToNka,
  grammarType,
  parseDocument,
  simulate,
  topDownRun,
} from '../index';
import type { Diagnostic, Grammar, NKA, Word } from '../index';

// ---------------------------------------------------------------------------
// Eigener PRNG (mulberry32), fester Seed

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

const SEED = 20260411;
const GRAMMARS = 60;
const MAX_LEN = 5;

/** Zufällige Typ-2-Grammatik als Text. Linksseiten sind einzelne Nichtterminale. */
function randomGrammarText(rnd: () => number, idx: number): string {
  const nts = ['S', 'A', 'B'].slice(0, 1 + Math.floor(rnd() * 3));
  const syms = [...nts, 'a', 'b'];
  const nProd = 2 + Math.floor(rnd() * 5); // 2 … 6
  const byLeft = new Map<string, string[]>();
  for (let i = 0; i < nProd; i++) {
    const left = nts[Math.floor(rnd() * nts.length)] as string;
    const len = Math.floor(rnd() * 4); // 0 … 3
    let rhs = '';
    for (let j = 0; j < len; j++) rhs += syms[Math.floor(rnd() * syms.length)];
    if (rhs === '') rhs = 'ε';
    byLeft.set(left, [...(byLeft.get(left) ?? []), rhs]);
  }
  const lines = [...byLeft].map(([l, alts]) => `  ${l} -> ${alts.join(' | ')}`);
  return [
    `grammatik R${idx} {`,
    `  nichtterminale ${nts.join(' ')}`,
    '  terminale a b',
    '  start S',
    ...lines,
    '}',
  ].join('\n');
}

function gram(text: string): Grammar {
  const { doc, diagnostics } = parseDocument(text);
  const errs = diagnostics.filter((d: Diagnostic) => d.severity === 'error');
  expect(errs, text).toEqual([]);
  return doc.objects[0] as Grammar;
}

const str = (w: Word): string => w.join('');
const W = (s: string): Word => [...s];

/** Alle Wörter über dem Alphabet mit Länge 0 … hi. */
function allWords(alphabet: string[], hi: number): string[] {
  const out: string[] = [''];
  let layer: string[] = [''];
  for (let n = 1; n <= hi; n++) {
    layer = layer.flatMap((w) => alphabet.map((a) => w + a));
    out.push(...layer);
  }
  return out;
}

const ALL = allWords(['a', 'b'], MAX_LEN);

// ---------------------------------------------------------------------------

describe('Eigenschaft: Grammatik → Kellerautomat → Läufe, zufällige Typ-2-Grammatiken', () => {
  const rnd = mulberry32(SEED);
  const grammars: { text: string; g: Grammar }[] = [];
  for (let i = 0; i < GRAMMARS; i++) {
    const text = randomGrammarText(rnd, i);
    grammars.push({ text, g: gram(text) });
  }

  it('Stichprobe: alle Grammatiken sind Typ 2 (oder 3) und in cfgWords vollständig bis Länge 5', () => {
    for (const { text, g } of grammars) {
      const t = grammarType(g).type;
      expect([2, 3], text).toContain(t);
      expect(cfgWords(g, MAX_LEN).complete, text).toBe(true);
    }
  });

  it('Wörter aus cfgWords (bis Länge 5) werden vom Automaten aus grammarToNka nie verworfen, andere nie akzeptiert; topDownRun und bottomUpRun entscheiden', () => {
    let checked = 0;
    let undecided = 0;
    for (const { text, g } of grammars) {
      const nk = grammarToNka(g);
      expect(nk.ok, text).toBe(true);
      if (!nk.ok) continue;
      const nka: NKA = nk.result;
      const inList = new Set(cfgWords(g, MAX_LEN).words.map(str));
      for (const w of ALL) {
        const res = simulate(nka, W(w)).result;
        const msg = `${text}\nWort "${w}"`;
        if (inList.has(w)) {
          expect(res, msg).not.toBe('rejected');
          if (res === 'limit') {
            undecided++; // Linksrekursion top-down (4.31): ehrlich „nicht entschieden“
            const td = topDownRun(g, W(w));
            expect(td.ok && td.result.accepted, `topDown ${msg}`).toBe(true);
          }
        } else {
          expect(res, msg).not.toBe('accepted');
          if (res === 'limit') undecided++;
        }
        const bu = bottomUpRun(g, W(w));
        expect(bu.ok, msg).toBe(true);
        if (bu.ok) {
          expect(bu.result.accepted, `bottomUp ${msg}`).toBe(inList.has(w));
          if (inList.has(w)) expect(bu.result.limitHit, `bottomUp limitHit ${msg}`).toBe(false);
        }
        checked++;
      }
    }
    expect(checked).toBe(GRAMMARS * ALL.length);
    console.info(`NKA-Simulation: nicht entschieden (limit) ${undecided} von ${checked}`);
  });

  it('topDownRun akzeptiert genau die Wörter aus cfgWords (wo ohne Grenze)', () => {
    let compared = 0;
    let skipped = 0;
    for (const { text, g } of grammars) {
      const inList = new Set(cfgWords(g, MAX_LEN).words.map(str));
      for (const w of ALL) {
        const r = topDownRun(g, W(w));
        if (!r.ok) {
          expect(r.diagnostics.every((d) => d.severity === 'warning'), `${text}\n"${w}"`).toBe(true);
          skipped++;
          continue;
        }
        if (r.result.limitHit) {
          skipped++;
          continue;
        }
        expect(r.result.accepted, `${text}\nWort "${w}"`).toBe(inList.has(w));
        compared++;
      }
    }
    // Sicherung gegen einen leeren Test: es muss überhaupt verglichen worden sein.
    expect(compared).toBeGreaterThan(0);
    console.info(`topDownRun: verglichen ${compared}, ohne Grenze übersprungen ${skipped}`);
  });

  it('bottomUpRun akzeptiert genau die Wörter aus cfgWords (wo ohne Grenze)', () => {
    let compared = 0;
    let skipped = 0;
    for (const { text, g } of grammars) {
      const inList = new Set(cfgWords(g, MAX_LEN).words.map(str));
      for (const w of ALL) {
        const r = bottomUpRun(g, W(w));
        if (!r.ok) {
          expect(r.diagnostics.every((d) => d.severity === 'warning'), `${text}\n"${w}"`).toBe(true);
          skipped++;
          continue;
        }
        if (r.result.limitHit) {
          skipped++;
          continue;
        }
        expect(r.result.accepted, `${text}\nWort "${w}"`).toBe(inList.has(w));
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(0);
    console.info(`bottomUpRun: verglichen ${compared}, ohne Grenze übersprungen ${skipped}`);
  });
});
