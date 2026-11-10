import { describe, expect, it } from 'vitest';
import { labelInput, parseInputWord, parseLabels, splitUnescaped } from './format';

describe('parseInputWord', () => {
  it('jedes Zeichen ist ein Symbol', () => {
    expect(parseInputWord('-101')).toEqual(['-', '1', '0', '1']);
  });

  it('leer, ε und eps ergeben das leere Wort', () => {
    expect(parseInputWord('')).toEqual([]);
    expect(parseInputWord('ε')).toEqual([]);
    expect(parseInputWord('eps')).toEqual([]);
  });

  it('<name> ist ein mehrbuchstabiges Symbol', () => {
    expect(parseInputWord('<zahl>a')).toEqual(['zahl', 'a']);
  });

  it('Leerraum wird ignoriert', () => {
    expect(parseInputWord('a b')).toEqual(['a', 'b']);
  });

  it('maskiertes Leerzeichen ist ein Symbol', () => {
    expect(parseInputWord('\\ ')).toEqual([' ']);
  });

  it('abschließender Backslash ist ungültig', () => {
    expect(parseInputWord('a\\')).toBeNull();
  });
});

describe('splitUnescaped', () => {
  it('teilt an unmaskierten Kommas und entfernt Leerraum außen', () => {
    expect(splitUnescaped('a, b ,c')).toEqual(['a', 'b', 'c']);
  });

  it('maskiertes Komma trennt nicht', () => {
    expect(splitUnescaped('\\,')).toEqual(['\\,']);
  });
});

describe('parseLabels', () => {
  it('einzelne Symbole getrennt durch Komma', () => {
    expect(parseLabels('0, 1, -').labels).toEqual([['0'], ['1'], ['-']]);
  });

  it('ε ist das leere Wort, 01 ist ein Wort', () => {
    expect(parseLabels('ε, 01').labels).toEqual([[], ['0', '1']]);
  });

  it('maskiertes Komma ist ein Symbol', () => {
    expect(parseLabels('\\,').labels).toEqual([[',']]);
  });
});

describe('labelInput und parseLabels: Rundreise', () => {
  const words: string[][] = [[], [','], ['\\'], [' '], ['zahl'], ['-', '>'], ['ε'], ['0', '1'], ['<', 'a']];

  for (const w of words) {
    it(`Wort ${JSON.stringify(w)} bleibt erhalten`, () => {
      expect(parseLabels(labelInput(w)).labels).toEqual([w]);
    });
  }
});
