// Verteiler: runMethod und applicableMethods.
import type { FormalObject, MethodId, ProcOptions, ProcResult } from '../model/types';
import { abort, guard, newRec } from './common';
import { neaToDea, powerset, removeEpsilon, splitWords } from './nea2dea';
import { complement, minimize, product, reachable } from './deaops';
import { deaToRegex, deaToRegexElim, regexToGrammar, thompson } from './regexalgo';
import { deaToGrammar, grammarToNea, type3Violations } from './grammarops';
import { egrepToRegex } from './egrep';
import { mealyToMoore, mooreToMealy } from './mealymoore';

export function applicableMethods(o: FormalObject): MethodId[] {
  switch (o.kind) {
    case 'dea':
      return ['dea2regex', 'dea2regexElim', 'dea2grammar', 'complement', 'intersection', 'union', 'reachable', 'minimize'];
    case 'nea':
      return ['nea2dea', 'splitWords', 'removeEpsilon', 'powerset'];
    case 'regex':
      return ['regex2grammar', 'thompson'];
    case 'grammatik':
      return type3Violations(o).length === 0 ? ['grammar2nea'] : [];
    case 'egrep':
      return ['egrep2regex'];
    case 'mealy':
      return ['mealy2moore'];
    case 'moore':
      return ['moore2mealy'];
    default:
      return [];
  }
}

export function runMethod(method: MethodId, sources: FormalObject[], opts: ProcOptions = {}): ProcResult<FormalObject> {
  const a = sources[0];
  const b = sources[1];
  const wrong = (kind: string): ProcResult<FormalObject> => {
    const rec = newRec(opts);
    return guard(rec, () => abort('algo.wrongKind', { method, kind }));
  };
  if (a === undefined) return wrong('none');
  switch (method) {
    case 'nea2dea':
      return a.kind === 'nea' || a.kind === 'dea' ? neaToDea(a, opts) : wrong(a.kind);
    case 'splitWords':
      return a.kind === 'nea' ? splitWords(a, opts) : wrong(a.kind);
    case 'removeEpsilon':
      return a.kind === 'nea' ? removeEpsilon(a, opts) : wrong(a.kind);
    case 'powerset':
      return a.kind === 'nea' ? powerset(a, opts) : wrong(a.kind);
    case 'dea2regex':
      return a.kind === 'dea' ? deaToRegex(a, opts) : wrong(a.kind);
    case 'dea2regexElim':
      return a.kind === 'dea' ? deaToRegexElim(a, opts) : wrong(a.kind);
    case 'dea2grammar':
      return a.kind === 'dea' ? deaToGrammar(a, opts) : wrong(a.kind);
    case 'regex2grammar':
      return a.kind === 'regex' ? regexToGrammar(a, opts) : wrong(a.kind);
    case 'thompson':
      return a.kind === 'regex' ? thompson(a, opts) : wrong(a.kind);
    case 'grammar2nea':
      return a.kind === 'grammatik' ? grammarToNea(a, opts) : wrong(a.kind);
    case 'complement':
      return a.kind === 'dea' ? complement(a, opts) : wrong(a.kind);
    case 'reachable':
      return a.kind === 'dea' ? reachable(a, opts) : wrong(a.kind);
    case 'minimize':
      return a.kind === 'dea' ? minimize(a, opts) : wrong(a.kind);
    case 'intersection':
    case 'union':
      if (a.kind !== 'dea') return wrong(a.kind);
      if (b === undefined || b.kind !== 'dea') return wrong(b === undefined ? 'none' : b.kind);
      return product(a, b, method, opts);
    case 'sprachop':
      return wrong(a.kind); // nur über evalLang
    case 'egrep2regex':
      return a.kind === 'egrep' ? egrepToRegex(a, opts) : wrong(a.kind);
    case 'mealy2moore':
      return a.kind === 'mealy' ? mealyToMoore(a, opts) : wrong(a.kind);
    case 'moore2mealy':
      return a.kind === 'moore' ? mooreToMealy(a, opts) : wrong(a.kind);
  }
}
