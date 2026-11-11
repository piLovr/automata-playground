import type { MethodId } from './types';

/** Alle Verfahren mit Herkunft (Laufzeitliste zu `MethodId`). */
export const METHOD_IDS: readonly MethodId[] = [
  'nea2dea',
  'splitWords',
  'removeEpsilon',
  'powerset',
  'dea2regex',
  'dea2regexElim',
  'regex2grammar',
  'grammar2nea',
  'dea2grammar',
  'thompson',
  'complement',
  'intersection',
  'union',
  'reachable',
  'minimize',
  'mealy2moore',
  'moore2mealy',
  'egrep2regex',
];
