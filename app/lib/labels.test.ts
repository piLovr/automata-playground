import { describe, expect, it } from 'vitest';
import { editLabels, parseLabelsFor } from './labels';

describe('parseLabelsFor', () => {
  it('TM: lesen -> schreiben, Richtung; mehrere durch ;', () => {
    expect(parseLabelsFor('tm', 'a -> □, R; b → b, L; □ -> 1, N').labels).toEqual([
      { read: 'a', write: '□', move: 1 },
      { read: 'b', write: 'b', move: -1 },
      { read: '□', write: '1', move: 0 },
    ]);
    expect(parseLabelsFor('tm', 'a -> b').error).toBeDefined();
  });
  it('NKA: oben, Eingabe -> kellern', () => {
    expect(parseLabelsFor('nka', '*, 0 -> 0*; 0, ε -> ε').labels).toEqual([
      { top: '*', read: '0', push: ['0', '*'] },
      { top: '0', read: null, push: [] },
    ]);
  });
  it('Mealy: Eingabe/Ausgabe', () => {
    expect(parseLabelsFor('mealy', '0/1, 1/0').labels).toEqual([
      { in: '0', out: '1' },
      { in: '1', out: '0' },
    ]);
    expect(parseLabelsFor('mealy', '01/1').error).toBeDefined();
  });
  it('Round-Trip über editLabels', () => {
    const cases = [
      ['tm', [{ read: ';', write: ',', move: -1 }]],
      ['nka', [{ top: '⊥', read: null, push: ['a', '⊥'] }]],
      ['mealy', [{ in: '/', out: ',' }]],
      ['moore', ['-']],
      ['nea', [[], ['0', '1']]],
    ] as const;
    for (const [kind, labels] of cases) {
      expect(parseLabelsFor(kind, editLabels(kind, labels as never)).labels).toEqual(labels);
    }
  });
});
