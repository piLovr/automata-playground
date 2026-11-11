// Verfahren aus Abschnitt 7.1: Skriptverweis, Anzahl Quellen, Kennzeichnung „nicht im Skript“.
import type { MethodId } from '../../core/index';

export interface MethodInfo {
  /** Nummer im Skript; leer = nicht im Skript. */
  ref: string;
  /** Ergänzung zu einer im Skript als Übung offenen Konstruktion. */
  supplement?: boolean;
  /** Zwei Quellobjekte (Produktautomat). */
  binary?: boolean;
}

export const METHODS: Record<MethodId, MethodInfo> = {
  nea2dea: { ref: '2.71–2.74' },
  splitWords: { ref: '2.71' },
  removeEpsilon: { ref: '2.72' },
  powerset: { ref: '2.74' },
  dea2regex: { ref: '2.30' },
  dea2regexElim: { ref: '' },
  regex2grammar: { ref: '2.52–2.54', supplement: true },
  grammar2nea: { ref: '2.69' },
  dea2grammar: { ref: '2.49/2.50' },
  thompson: { ref: '' },
  complement: { ref: '2.33' },
  intersection: { ref: '2.33', binary: true },
  union: { ref: '', binary: true },
  reachable: { ref: '2.82' },
  minimize: { ref: '2.90' },
  mealy2moore: { ref: '' },
  moore2mealy: { ref: '' },
  egrep2regex: { ref: '3.25, 7.4' },
};

/** Reihenfolge im Verfahrensreiter. */
export const METHOD_ORDER: MethodId[] = [
  'nea2dea',
  'splitWords',
  'removeEpsilon',
  'powerset',
  'minimize',
  'reachable',
  'dea2regex',
  'dea2regexElim',
  'dea2grammar',
  'regex2grammar',
  'thompson',
  'grammar2nea',
  'complement',
  'intersection',
  'union',
  'mealy2moore',
  'moore2mealy',
  'egrep2regex',
];
