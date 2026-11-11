// M3, Abnahme 2.10: Moore-Automat aus 2.10 gibt für Dualzahlen als letzte Ausgabe 1.
// Erwartungen aus docs/kern-spec-m3.md (Teil C) und docs/skript-notizen-m1.md (2.3, 2.10).
// Dualzahl nach 2.3 = Vorzeichen optional, danach mindestens eine Ziffer 0/1 (-?[01]+).
// Nur die öffentliche Schnittstelle core/index.ts.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { outputsTable, parseDocument, simulate, validate } from '../index';
import type { DEA, Diagnostic, Document, Moore, Word } from '../index';

const EX = fileURLToPath(new URL('../../examples/', import.meta.url));

function loadEx(file: string): Document {
  const { doc, diagnostics } = parseDocument(readFileSync(join(EX, file), 'utf8'));
  const errs: Diagnostic[] = diagnostics.filter((d) => d.severity === 'error');
  expect(errs).toEqual([]);
  return doc;
}

const MOORE_210 = loadEx('b2-10.txt').objects.find((o) => o.name === 'Dualzahl_g') as Moore;
const DEA_23 = loadEx('b2-3.txt').objects.find((o) => o.name === 'Dualzahl') as DEA;

/** Erwartung aus dem Skript: Dualzahl mit optionalem Vorzeichen. */
const isDualzahl = (w: Word): boolean => /^-?[01]+$/.test(w.join(''));

/** Alle Wörter über {0,1,-} mit Länge von lo bis hi, in Längen- und Alphabetreihenfolge. */
function wordsOver(alphabet: string[], lo: number, hi: number): Word[] {
  const out: Word[] = [];
  let layer: Word[] = [[]];
  for (let n = 1; n <= hi; n++) {
    layer = layer.flatMap((w) => alphabet.map((a) => [...w, a]));
    if (n >= lo) out.push(...layer);
  }
  return out;
}

const WORDS = wordsOver(['0', '1', '-'], 1, 6);

describe('Abnahme 2.10: Moore-Automat', () => {
  it('Automat 2.10 ist fehlerfrei und hat g(B) = 1, g(A) = g(M) = g(Q) = 0', () => {
    expect(validate(MOORE_210!).filter((d) => d.severity === 'error')).toEqual([]);
    const outOf = (name: string) => MOORE_210!.states.find((s) => s.name === name)?.out;
    expect(outOf('B')).toBe('1');
    expect(outOf('A')).toBe('0');
    expect(outOf('M')).toBe('0');
    expect(outOf('Q')).toBe('0');
  });

  it('Wortmenge über {0,1,-} bis Länge 6 hat 1092 Wörter (Test-Sanity)', () => {
    expect(WORDS.length).toBe(3 + 9 + 27 + 81 + 243 + 729);
  });

  it('DEA 2.3 akzeptiert genau die Dualzahlen -?[01]+ (Bezugsgröße für die Abnahme)', () => {
    for (const w of WORDS) {
      const r = simulate(DEA_23!, w);
      expect(r.result === 'accepted').toBe(isDualzahl(w));
    }
  });

  it('für alle Wörter bis Länge 6: letzte Ausgabe ist 1 genau für Dualzahlen, sonst 0', () => {
    const failures: string[] = [];
    for (const w of WORDS) {
      const t = simulate(MOORE_210!, w);
      const last = t.output?.[t.output.length - 1];
      const expected = isDualzahl(w) ? '1' : '0';
      if (t.result !== 'done' || last !== expected) {
        failures.push(`${w.join('')}: erwartet ${expected}, tatsächlich ${last ?? '(keine)'} (${t.result})`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('Beispiele: 0, 1, -0, -1, 01 ja; 1-0, -, --, 0- nein', () => {
    const last = (w: string[]) => {
      const t = simulate(MOORE_210!, w);
      return t.output?.[t.output.length - 1];
    };
    expect(last(['0'])).toBe('1');
    expect(last(['1'])).toBe('1');
    expect(last(['-', '0'])).toBe('1');
    expect(last(['-', '1'])).toBe('1');
    expect(last(['0', '1'])).toBe('1');
    expect(last(['1', '-', '0'])).toBe('0');
    expect(last(['-'])).toBe('0');
    expect(last(['-', '-'])).toBe('0');
    expect(last(['0', '-'])).toBe('0');
  });

  it('gleiches Ergebnis über die Ausgabetabelle (outputsTable bis Länge 6)', () => {
    const rows = outputsTable(MOORE_210!, 6, 5000).filter((r) => r.input.length > 0);
    expect(rows.length).toBe(WORDS.length);
    const failures = rows
      .filter((r) => r.output[r.output.length - 1] !== (isDualzahl(r.input) ? '1' : '0'))
      .map((r) => r.input.join(''));
    expect(failures).toEqual([]);
  });
});
