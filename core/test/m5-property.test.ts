// M5, Teil C, Eigenschaftstest: zufällige kleine Typ-2-Grammatiken (≤ 3 Nichtterminale, ≤ 6
// Produktionen, Alphabet {a, b}, rechte Seiten der Länge 0 … 3, ε erlaubt). Fester Seed, eigener
// PRNG (mulberry32), damit der Lauf reproduzierbar ist.
// Eigenschaften (kern-spec-m5 Teil C):
//   - L(toCnf(G)) = L(G) bis Länge 5 (cfgWords), Ergebnis ist CNF
//   - CYK auf toCnf(G) ⇔ Zugehörigkeit
//   - Earley auf G ⇔ Zugehörigkeit
//   - für konfliktfreie LALR(1)-Grammatiken: lrRun ⇔ Zugehörigkeit
// Zugehörigkeit: Wortliste aus cfgWords(G, 5) (Orakel). Nur core/index.ts.

import { describe, expect, it } from 'vitest';
import {
  cfgWords,
  cyk,
  earley,
  isCnf,
  lrAutomaton,
  lrRun,
  parseDocument,
  toCnf,
} from '../index';
import type { Diagnostic, Grammar, Word } from '../index';

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

const SEED = 20261111;
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

const wstr = (w: Word): string => w.join('');
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

describe('Eigenschaften zufälliger Typ-2-Grammatiken (fester Seed)', () => {
  it(`toCnf erhält die Sprache bis Länge ${MAX_LEN}; CYK und Earley entscheiden Zugehörigkeit; LALR(1) wo konfliktfrei`, () => {
    const rnd = mulberry32(SEED);
    let checked = 0;
    let conflictFree = 0;
    const failures: string[] = [];

    for (let idx = 0; idx < GRAMMARS; idx++) {
      const text = randomGrammarText(rnd, idx);
      const g = gram(text);

      const lang = cfgWords(g, MAX_LEN);
      expect(lang.complete, `cfgWords unvollständig:\n${text}`).toBe(true);
      const inL = new Set(lang.words.map(wstr));

      const cnfRes = toCnf(g);
      if (!cnfRes.ok) {
        failures.push(`toCnf abgelehnt:\n${text}`);
        continue;
      }
      const cnf = cnfRes.result;

      // (1) CNF und Sprache
      if (!isCnf(cnf).ok) failures.push(`nicht CNF:\n${text}`);
      const cnfWords = cfgWords(cnf, MAX_LEN);
      expect(cnfWords.complete, `cfgWords(CNF) unvollständig:\n${text}`).toBe(true);
      expect(
        [...new Set(cnfWords.words.map(wstr))].sort(),
        `Sprache verändert:\n${text}`,
      ).toEqual([...inL].sort());

      // (2) CYK auf CNF, (3) Earley auf G: je Wort gegen das Orakel
      for (const w of ALL) {
        const want = inL.has(w);
        const c = cyk(cnf, W(w));
        if (!c.ok || c.result.accepted !== want) failures.push(`CYK „${w}“ soll ${want}:\n${text}`);
        const e = earley(g, W(w));
        if (!e.ok || e.result.accepted !== want) failures.push(`Earley „${w}“ soll ${want}:\n${text}`);
      }

      // (4) LALR(1), nur konfliktfreie Grammatiken
      const lr = lrAutomaton(g, 'LALR1');
      if (lr.ok && lr.result.conflicts.length === 0) {
        conflictFree++;
        for (const w of ALL) {
          const want = inL.has(w);
          const run = lrRun(lr.result, W(w));
          if (run.accepted !== want) failures.push(`lrRun „${w}“ soll ${want}:\n${text}`);
        }
      }
      checked++;
    }

    expect(failures, failures.slice(0, 3).join('\n---\n')).toEqual([]);
    expect(checked).toBe(GRAMMARS);
    // Der Lauf muss auch LALR(1)-Fälle enthalten, sonst prüft (4) nichts.
    expect(conflictFree).toBeGreaterThan(5);
  });
});
