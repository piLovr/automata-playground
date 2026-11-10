import { beforeAll, describe, expect, it } from 'vitest';
import { parseDocument, runBatch, simulate } from '../index';
import type { DEA, NEA, Word } from '../index';
import {
  DEA_23,
  NEA_EPSZYKLUS,
  NEA_WORT,
  asDea,
  asNea,
  firstObject,
  idOf,
  namesOf,
} from './fixtures';

let dea!: DEA;
let nea!: NEA;
let epsZ!: NEA;
beforeAll(() => {
  dea = asDea(firstObject(parseDocument(DEA_23).doc));
  nea = asNea(firstObject(parseDocument(NEA_WORT).doc));
  epsZ = asNea(firstObject(parseDocument(NEA_EPSZYKLUS).doc));
});

/** Wort aus einem String mit einfachen Zeichen (nur für Ziffern und Buchstaben ohne Sonderzeichen). */
const w = (s: string): Word => s.split('');

describe('DEA_23', () => {
  it('"" wird abgelehnt, Zustandsfolge [A]', () => {
    const t = simulate(dea, []);
    expect(t.result).toBe('rejected');
    expect(namesOf(dea, t.stateSequence)).toEqual(['A']);
  });

  it('"0" wird akzeptiert', () => {
    expect(simulate(dea, ['0']).result).toBe('accepted');
  });

  it('"-10" wird akzeptiert mit Folge A, M, B, B und Endzustand B', () => {
    const t = simulate(dea, ['-', '1', '0']);
    expect(t.result).toBe('accepted');
    expect(namesOf(dea, t.stateSequence)).toEqual(['A', 'M', 'B', 'B']);
    expect(t.finalState).toBe(idOf(dea, 'B'));
    expect(t.steps.map((s) => s.pos)).toEqual([0, 1, 2, 3]);
  });

  it('"1-" wird abgelehnt mit Endzustand Q', () => {
    const t = simulate(dea, ['1', '-']);
    expect(t.result).toBe('rejected');
    expect(t.finalState).toBe(idOf(dea, 'Q'));
  });

  it('"--" wird abgelehnt', () => {
    expect(simulate(dea, ['-', '-']).result).toBe('rejected');
  });

  it('Symbol außerhalb des Alphabets ergibt stuck', () => {
    expect(simulate(dea, ['x']).result).toBe('stuck');
  });
});

describe('NEA_WORT', () => {
  const accepted = ['', '01', '0101', '001', '001001'];
  const rejected = ['0', '1', '01001', '0011', '10'];

  for (const s of accepted) {
    it(`"${s}" wird akzeptiert`, () => {
      expect(simulate(nea, w(s)).result).toBe('accepted');
    });
  }

  for (const s of rejected) {
    it(`"${s}" wird nicht akzeptiert`, () => {
      expect(['rejected', 'stuck']).toContain(simulate(nea, w(s)).result);
    });
  }

  it('"0101": Schrittzahl, aktive Mengen, Wortkanten überspringen Positionen', () => {
    const t = simulate(nea, w('0101'));
    const id0 = idOf(nea, '0');
    const id2 = idOf(nea, '2');
    const id5 = idOf(nea, '5');
    expect(t.steps).toHaveLength(5);
    expect(t.steps[2]?.active).toContain(id2);
    expect(t.steps[1]?.active).toEqual([]);
    expect(t.result).toBe('accepted');
    expect([...(t.steps[0]?.active ?? [])].sort()).toEqual([id0, id2, id5].sort());
  });
});

describe('NEA_EPSZYKLUS', () => {
  it('"a" wird akzeptiert', () => {
    expect(simulate(epsZ, ['a']).result).toBe('accepted');
  });

  it('"" wird abgelehnt', () => {
    expect(simulate(epsZ, []).result).toBe('rejected');
  });

  it('Berechnungsbaum enthält einen Knoten mit status cycle und terminiert', () => {
    const t = simulate(epsZ, ['a']);
    expect(t.tree).toBeDefined();
    expect(t.tree?.some((n) => n.status === 'cycle')).toBe(true);
  });

  it('stepLimit 2 ergibt result limit', () => {
    expect(simulate(epsZ, ['a'], { stepLimit: 2 }).result).toBe('limit');
  });
});

describe('runBatch', () => {
  it('ok ist true, false oder null je nach Erwartung', () => {
    const res = runBatch(dea, [
      { word: [], expected: false },
      { word: ['0'], expected: true },
      { word: ['1', '-'], expected: true },
      { word: ['-', '1', '0'], expected: null },
    ]);
    expect(res.map((r) => r.result)).toEqual(['rejected', 'accepted', 'rejected', 'accepted']);
    expect(res.map((r) => r.expected)).toEqual([false, true, true, null]);
    expect(res.map((r) => r.ok)).toEqual([true, true, false, null]);
  });

  it('NEA: Erwartung true für 01 ist ok, für 0 mit Erwartung true nicht', () => {
    const res = runBatch(nea, [
      { word: w('01'), expected: true },
      { word: w('0'), expected: true },
    ]);
    expect(res.map((r) => r.ok)).toEqual([true, false]);
  });
});
