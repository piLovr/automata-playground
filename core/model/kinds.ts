// Kind-Registry: je Objektart ein Eintrag; Parser, Printer, Validierung und Simulator
// rufen typspezifische Teile hier ab. Neue Typen (mealy, moore, nka, tm, …) = neuer Eintrag.
import { printSymbol, printWord } from '../text/word';
import { simulateDea } from '../sim/dea';
import { simulateNea } from '../sim/nea';
import { validateDea, validateNea } from './checks';
import type { Diagnostic, FormalObject, ObjectKind, SimOptions, Sym, Trace, Word } from './types';

export type AnyLabel = Sym | Word;

export interface KindSpec {
  kind: ObjectKind;
  /** Schlüsselwort in der Textsprache. */
  keyword: string;
  empty(name: string): FormalObject;
  /** Wandelt ein gelesenes Label-Wort in die Kantenbeschriftung des Typs. */
  makeLabel(word: Word): { ok: true; label: AnyLabel } | { ok: false; code: 'dea.labelLength' };
  printLabel(label: AnyLabel): string;
  validate(obj: FormalObject): Diagnostic[];
  simulate(obj: FormalObject, word: Word, opts: SimOptions): Trace;
}

const deaSpec: KindSpec = {
  kind: 'dea',
  keyword: 'dea',
  empty: (name) => ({ kind: 'dea', name, alphabet: [], states: [], start: null, accept: [], transitions: [] }),
  makeLabel: (word) =>
    word.length === 1 ? { ok: true, label: word[0] as Sym } : { ok: false, code: 'dea.labelLength' },
  printLabel: (label) => (typeof label === 'string' ? printSymbol(label) : printWord(label)),
  validate(obj) {
    if (obj.kind !== 'dea') throw new Error('kind mismatch');
    return validateDea(obj);
  },
  simulate(obj, word, opts) {
    if (obj.kind !== 'dea') throw new Error('kind mismatch');
    return simulateDea(obj, word, opts);
  },
};

const neaSpec: KindSpec = {
  kind: 'nea',
  keyword: 'nea',
  empty: (name) => ({ kind: 'nea', name, alphabet: [], states: [], start: null, accept: [], transitions: [] }),
  makeLabel: (word) => ({ ok: true, label: word }),
  printLabel: (label) => printWord(typeof label === 'string' ? [label] : label),
  validate(obj) {
    if (obj.kind !== 'nea') throw new Error('kind mismatch');
    return validateNea(obj);
  },
  simulate(obj, word, opts) {
    if (obj.kind !== 'nea') throw new Error('kind mismatch');
    return simulateNea(obj, word, opts);
  },
};

export const kinds: readonly KindSpec[] = [deaSpec, neaSpec];

export function getKind(kind: ObjectKind): KindSpec {
  const k = kinds.find((s) => s.kind === kind);
  if (!k) throw new Error(`unknown kind ${kind}`);
  return k;
}

export function findKindByKeyword(keyword: string): KindSpec | undefined {
  return kinds.find((s) => s.keyword === keyword);
}
