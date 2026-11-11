import { isAutomaton } from '../index';
import type { Automaton, DEA, Document, FormalObject, NEA, StateId } from '../index';

/** DEA aus Skript 2.3 (F = {B} laut Vorgabe; das Minus steht im Text als \-). */
export const DEA_23 = String.raw`dea Skript23 {
  alphabet 0 1 \-
  start A
  accept B
  A -0,1-> B
  A -\--> M
  M -0,1-> B
  M -\--> Q
  B -0,1-> B
  B -\--> Q
  Q -0,1,\--> Q
}
`;

/** NEA mit ε-Kanten und Wortkanten: L = (01)* ∪ (001)*. */
export const NEA_WORT = String.raw`nea NeaWort {
  start 0
  accept 2 5
  0 -ε-> 2
  0 -ε-> 5
  2 -01-> 2
  5 -001-> 5
}
`;

/** NEA mit ε-Zyklus p <-> q; Terminierung wird geprüft. */
export const NEA_EPSZYKLUS = String.raw`nea EpsZyklus {
  start p
  accept r
  p -ε-> q
  q -ε-> p
  q -a-> r
}
`;

/** DEA mit fehlenden Paaren (x,b), (y,a), (y,b). */
export const DEA_UNVOLLSTAENDIG = String.raw`dea Unvollstaendig {
  alphabet a b
  start x
  accept y
  x -a-> y
}
`;

export const FIXTURES: Record<string, string> = {
  DEA_23,
  NEA_WORT,
  NEA_EPSZYKLUS,
  DEA_UNVOLLSTAENDIG,
};

/** ID des Zustands mit dem angegebenen Namen. Wirft, wenn er fehlt. */
export function idOf(obj: { name: string; states: { id: StateId; name: string }[] }, name: string): StateId {
  const s = obj.states.find((st) => st.name === name);
  if (!s) throw new Error(`Zustand ${name} fehlt in ${obj.name}`);
  return s.id;
}

/** Zustandsnamen zu einer Liste von IDs (fehlende IDs erscheinen als ?id). */
export function namesOf(
  obj: { states: { id: StateId; name: string }[] },
  ids: readonly StateId[] | null | undefined,
): string[] {
  return (ids ?? []).map((id) => obj.states.find((s) => s.id === id)?.name ?? `?${id}`);
}

export function firstObject(doc: Document): FormalObject {
  const o = doc.objects[0];
  if (!o) throw new Error('Dokument ohne Objekt');
  return o;
}

export function asAut(o: FormalObject): Automaton {
  if (!isAutomaton(o)) throw new Error(`Zustandsmaschine erwartet, ist ${o.kind}`);
  return o;
}

export function asDea(o: FormalObject): DEA {
  if (o.kind !== 'dea') throw new Error(`erwartet dea, ist ${o.kind}`);
  return o;
}

export function asNea(o: FormalObject): NEA {
  if (o.kind !== 'nea') throw new Error(`erwartet nea, ist ${o.kind}`);
  return o;
}
