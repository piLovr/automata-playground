import { beforeAll, describe, expect, it } from 'vitest';
import { runBatch, simulate } from '../index';
import type { NKA, TM, Trace, TapeView, Word } from '../index';
import {
  MEALY_PARITAET,
  MOORE_210,
  NKA_46,
  NKA_49,
  TM_59,
  TM_ENDLOS,
  asNka,
  asTm,
  namesOf,
  parseFirst,
} from './typen-fixtures';

/** Wort aus einem String mit einfachen Zeichen. */
const w = (s: string): Word => s.split('');

/** Zelle an Bandposition pos; außerhalb der View ist das Blank. */
function cellAt(tape: TapeView, pos: number): string {
  return tape.cells[pos - tape.origin] ?? '□';
}

/** Bandausschnitt Positionen -1 bis 5 (Abbildung 5.2: Index = Position + 1). */
function bandWindow(tape: TapeView): string {
  const cells: string[] = [];
  for (let p = -1; p <= 5; p++) cells.push(cellAt(tape, p));
  return cells.join(' ');
}

describe('Moore MOORE_210', () => {
  let t!: Trace;
  beforeAll(() => {
    t = simulate(parseFirst(MOORE_210), ['-', '1', '0', '1']);
  });

  it('Ergebnis done', () => {
    expect(t.result).toBe('done');
  });

  it('Ausgabewort 0 0 1 1 1 (|w|+1 Symbole)', () => {
    expect(t.output).toEqual(['0', '0', '1', '1', '1']);
  });

  it('steps[0].output ist g(z0) = [0]', () => {
    expect(t.steps[0]?.output).toEqual(['0']);
  });
});

describe('Mealy MEALY_PARITAET', () => {
  let t!: Trace;
  beforeAll(() => {
    t = simulate(parseFirst(MEALY_PARITAET), ['1', '1', '0', '1']);
  });

  it('Ausgabewort 1 0 0 1 bei Ergebnis done', () => {
    expect(t.result).toBe('done');
    expect(t.output).toEqual(['1', '0', '0', '1']);
  });

  it('steps[0].output ist leer, je gelesenem Symbol ein Schritt', () => {
    expect(t.steps[0]?.output).toEqual([]);
    expect(t.steps).toHaveLength(5);
  });
});

describe('NKA NKA_46 (0^k 1^k)', () => {
  let obj!: NKA;
  beforeAll(() => {
    obj = asNka(parseFirst(NKA_46));
  });

  it('00001111 wird akzeptiert', () => {
    expect(simulate(obj, w('00001111')).result).toBe('accepted');
  });

  it('00001111: 10 Schritte, Zustände und Keller wie in der Verlaufstabelle 4.6', () => {
    const t = simulate(obj, w('00001111'));
    expect(t.steps).toHaveLength(10);
    expect(t.steps.map((s) => namesOf(obj, s.active)[0])).toEqual([
      'z0', 'z0', 'z0', 'z0', 'z0', 'z1', 'z1', 'z1', 'z1', 'z+',
    ]);
    expect(t.steps.map((s) => (s.stack ?? []).join(''))).toEqual([
      '*', '0*', '00*', '000*', '0000*', '000*', '00*', '0*', '*', '*',
    ]);
  });

  it('00001111: steps[i].pos entspricht der gelesenen Länge der Zeile', () => {
    const t = simulate(obj, w('00001111'));
    expect(t.steps.map((s) => s.pos)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 8]);
  });

  it('0011 wird akzeptiert', () => {
    expect(simulate(obj, w('0011')).result).toBe('accepted');
  });

  it('001 wird nicht akzeptiert', () => {
    expect(['rejected', 'stuck']).toContain(simulate(obj, w('001')).result);
  });

  it('0101 wird nicht akzeptiert', () => {
    expect(['rejected', 'stuck']).toContain(simulate(obj, w('0101')).result);
  });

  it('leeres Wort wird nicht akzeptiert (kein Übergang auf (z0, *, ε))', () => {
    expect(simulate(obj, []).result).toBe('rejected');
  });
});

describe('NKA NKA_49 (Palindrome gerader Länge)', () => {
  let obj!: NKA;
  beforeAll(() => {
    obj = asNka(parseFirst(NKA_49));
  });

  it('abaaaaba wird akzeptiert, Baum vorhanden mit akzeptierendem Knoten', () => {
    const t = simulate(obj, w('abaaaaba'));
    expect(t.result).toBe('accepted');
    expect(t.tree).toBeDefined();
    expect(t.tree?.some((n) => n.status === 'accepting')).toBe(true);
  });

  it('aab wird nicht akzeptiert', () => {
    expect(simulate(obj, w('aab')).result).not.toBe('accepted');
  });
});

describe('TM TM_59 (Palindrome über {a, b})', () => {
  let obj!: TM;
  let t!: Trace;
  beforeAll(() => {
    obj = asTm(parseFirst(TM_59));
    t = simulate(obj, w('abbba'));
  });

  // Zustände je Konfiguration, Abbildung 5.2 (Zeilen 0 bis 21).
  const STATES = [
    'r', 'ra', 'ra', 'ra', 'ra', 'ra', 'la', 'l', 'l', 'l', 'l',
    'r', 'rb', 'rb', 'rb', 'lb', 'l', 'l', 'r', 'rb', 'lb', 'f+',
  ];
  // Kopfposition aus Abbildung 5.2 (Index mit Rand-Blank bei 0), minus 1 = Bandposition.
  const HEADS_FIG = [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3, 2, 3, 4, 3, 3];
  // Bandinhalt Abbildung 5.2 für Positionen -1 bis 5.
  const BAND_A = '□ a b b b a □';
  const BAND_B = '□ □ b b b a □';
  const BAND_C = '□ □ b b b □ □';
  const BAND_D = '□ □ □ b b □ □';
  const BAND_E = '□ □ □ b □ □ □';
  const BAND_F = '□ □ □ □ □ □ □';
  const BANDS_FIG = [
    BAND_A,
    BAND_B, BAND_B, BAND_B, BAND_B, BAND_B, BAND_B,
    BAND_C, BAND_C, BAND_C, BAND_C, BAND_C,
    BAND_D, BAND_D, BAND_D, BAND_D,
    BAND_E, BAND_E, BAND_E,
    BAND_F, BAND_F, BAND_F,
  ];

  it('abbba wird akzeptiert', () => {
    expect(t.result).toBe('accepted');
  });

  it('22 Schritte (Startkonfiguration + 21 Übergänge)', () => {
    expect(t.steps).toHaveLength(22);
  });

  it('Zustandsfolge entspricht Abbildung 5.2', () => {
    expect(t.steps.map((s) => namesOf(obj, s.active)[0])).toEqual(STATES);
  });

  it('Kopfposition (+1) entspricht Abbildung 5.2', () => {
    expect(t.steps.map((s) => (s.tape?.head ?? NaN) + 1)).toEqual(HEADS_FIG);
  });

  it('Bandinhalt (Positionen -1 bis 5) entspricht Abbildung 5.2', () => {
    expect(t.steps.map((s) => (s.tape ? bandWindow(s.tape) : ''))).toEqual(BANDS_FIG);
  });

  it('Trace.visited ist die Anzahl besuchter Felder (0 bis 5: 6)', () => {
    expect(t.visited).toBe(6);
  });

  it('Wort ab wird abgelehnt und endet in f−', () => {
    const r = simulate(obj, w('ab'));
    expect(r.result).toBe('rejected');
    expect(namesOf(obj, r.steps[r.steps.length - 1]?.active)[0]).toBe('f-');
  });

  it('leeres Wort wird akzeptiert', () => {
    expect(simulate(obj, []).result).toBe('accepted');
  });
});

describe('stepLimit', () => {
  it('TM mit Schleife r, a -> r, a, N und stepLimit 50 ergibt limit', () => {
    const obj = asTm(parseFirst(TM_ENDLOS));
    expect(simulate(obj, ['a'], { stepLimit: 50 }).result).toBe('limit');
  });
});

describe('runBatch für nka und tm', () => {
  it('NKA_46: ok true bzw. false je nach Erwartung', () => {
    const obj = asNka(parseFirst(NKA_46));
    const res = runBatch(obj, [
      { word: w('0011'), expected: true },
      { word: w('001'), expected: true },
      { word: w('001'), expected: false },
      { word: [], expected: null },
    ]);
    expect(res.map((r) => r.result)).toEqual(['accepted', 'rejected', 'rejected', 'rejected']);
    expect(res.map((r) => r.ok)).toEqual([true, false, true, null]);
  });

  it('TM_59: ok true bzw. false je nach Erwartung', () => {
    const obj = asTm(parseFirst(TM_59));
    const res = runBatch(obj, [
      { word: w('abbba'), expected: true },
      { word: w('ab'), expected: true },
      { word: [], expected: null },
    ]);
    expect(res.map((r) => r.result)).toEqual(['accepted', 'rejected', 'accepted']);
    expect(res.map((r) => r.ok)).toEqual([true, false, null]);
  });
});
