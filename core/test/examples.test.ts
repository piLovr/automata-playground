/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseDocument, printDocument, simulate, validate } from '../index';
import type { FormalObject, Word } from '../index';

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
        const obj = parsed.doc.objects[0] as FormalObject;
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
  const objectOf = (file: string): FormalObject => {
    const obj = parseDocument(load(file)).doc.objects[0];
    if (!obj) throw new Error(`kein Objekt in ${file}`);
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
