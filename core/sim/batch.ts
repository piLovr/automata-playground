import { getKind } from '../model/kinds';
import type { Automaton, BatchEntry, BatchResult, SimOptions, Trace, Word } from '../model/types';

export function simulate(obj: Automaton, word: Word, opts: SimOptions = {}): Trace {
  return getKind(obj.kind).simulate(obj, word, opts);
}

export function runBatch(obj: Automaton, entries: BatchEntry[], opts: SimOptions = {}): BatchResult[] {
  return entries.map((e) => {
    const result = simulate(obj, e.word, opts).result;
    return {
      word: e.word,
      expected: e.expected,
      result,
      ok: e.expected === null ? null : (result === 'accepted') === e.expected,
    };
  });
}
