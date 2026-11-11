/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isAutomaton, parseDocument, printDocument, simulate, validate } from '../index';
import type { Automaton, Word } from '../index';

const dir = new URL('../../examples/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.txt')).sort();

const load = (name: string): string => readFileSync(new URL(name, dir), 'utf8');

describe('Beispieldateien examples/*.txt', () => {
  it('es gibt Beispieldateien', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    describe(file, () => {
      const text = load(file);
      const parsed = parseDocument(text);

      it('liefert keine Diagnose mit severity error', () => {
        const errors = parsed.diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toEqual([]);
      });

      it('enthält genau ein Objekt', () => {
        expect(parsed.doc.objects).toHaveLength(1);
      });

      it('validate liefert keine Fehler', () => {
        const obj = parsed.doc.objects[0]!;
        const errors = validate(obj).filter((d) => d.severity === 'error');
        expect(errors).toEqual([]);
      });

      it('printDocument ist Fixpunkt von parse und print', () => {
        const once = printDocument(parseDocument(text).doc);
        const twice = printDocument(parseDocument(once).doc);
        expect(twice).toBe(once);
      });
    });
  }
});

describe('Simulation der Beispiele', () => {
  const objectOf = (file: string): Automaton => {
    const obj = parseDocument(load(file)).doc.objects[0];
    if (!obj || !isAutomaton(obj)) throw new Error(`kein Automat in ${file}`);
    return obj;
  };

  it('b2-3: -101 wird akzeptiert', () => {
    const word: Word = ['-', '1', '0', '1'];
    expect(simulate(objectOf('b2-3.txt'), word).result).toBe('accepted');
  });

  it('b2-66: 001001 wird akzeptiert', () => {
    const word: Word = ['0', '0', '1', '0', '0', '1'];
    expect(simulate(objectOf('b2-66.txt'), word).result).toBe('accepted');
  });

  it('b2-66: 01001 wird nicht akzeptiert', () => {
    const word: Word = ['0', '1', '0', '0', '1'];
    expect(simulate(objectOf('b2-66.txt'), word).result).not.toBe('accepted');
  });
});

describe('Simulation der Beispiele für Mealy, Moore, Keller, TM', () => {
  const objectOf = (file: string): Automaton => {
    const obj = parseDocument(load(file)).doc.objects[0];
    if (!obj || !isAutomaton(obj)) throw new Error(`kein Automat in ${file}`);
    return obj;
  };
  const sym = (s: string) => [...s];
  it('b2-10: Moore gibt für -101 die Ausgabe 00111', () => {
    const t = simulate(objectOf('b2-10.txt'), sym('-101'));
    expect(t.result).toBe('done');
    expect(t.output?.join('')).toBe('00111');
  });
  it('mealy-paritaet: 1101 ergibt 1001', () => {
    expect(simulate(objectOf('mealy-paritaet.txt'), sym('1101')).output?.join('')).toBe('1001');
  });
  it('b4-6: 00001111 akzeptiert, 0001111 nicht', () => {
    expect(simulate(objectOf('b4-6.txt'), sym('00001111')).result).toBe('accepted');
    expect(simulate(objectOf('b4-6.txt'), sym('0001111')).result).not.toBe('accepted');
  });
  it('b4-9: abaaaaba akzeptiert', () => {
    expect(simulate(objectOf('b4-9.txt'), sym('abaaaaba')).result).toBe('accepted');
  });
  it('b5-9: abbba akzeptiert in 21 Schritten, ab abgelehnt', () => {
    const t = simulate(objectOf('b5-9.txt'), sym('abbba'));
    expect(t.result).toBe('accepted');
    expect(t.steps.length).toBe(22);
    expect(simulate(objectOf('b5-9.txt'), sym('ab')).result).toBe('rejected');
  });
  it('tm-inc: 1011 + 1 = 1100', () => {
    const t = simulate(objectOf('tm-inc.txt'), sym('1011'));
    expect(t.result).toBe('accepted');
    const tape = t.steps.at(-1)!.tape!;
    expect(tape.cells.join('').replace(/□/g, '')).toBe('1100');
  });
});
