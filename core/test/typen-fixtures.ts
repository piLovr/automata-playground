import { isAutomaton, parseDocument } from '../index';
import type {
  Automaton,
  Document,
  FormalObject,
  Mealy,
  Moore,
  NKA,
  ObjectKind,
  StateId,
  TM,
} from '../index';

/** Moore-Automat auf Basis 2.3 (Skript 2.10): g(B) = 1, sonst 0. */
export const MOORE_210 = String.raw`moore Moore210 {
  alphabet 0 1 \-
  ausgabealphabet 0 1
  states A B M Q
  start A
  A -0,1-> B
  A -\--> M
  M -0,1-> B
  M -\--> Q
  B -0,1-> B
  B -\--> Q
  Q -0,1,\--> Q
  out A=0 B=1 M=0 Q=0
}
`;

/** Mealy-Automat: Ausgabe = Parität der bisher gelesenen Einsen. */
export const MEALY_PARITAET = String.raw`mealy Paritaet {
  alphabet 0 1
  ausgabealphabet 0 1
  states g u
  start g
  g -0/0-> g
  g -1/1-> u
  u -0/1-> u
  u -1/0-> g
}
`;

/** Kellerautomat Skript 4.6 (0^k 1^k), Standardregel nicht modelliert. */
export const NKA_46 = String.raw`nka NKA46 {
  alphabet 0 1
  kelleralphabet * 0
  keller *
  states z0 z1 z+ z−
  start z0
  accept z+
  z0, *, 0 -> z0, 0*
  z0, 0, 0 -> z0, 00
  z0, 0, 1 -> z1, ε
  z1, 0, 1 -> z1, ε
  z1, *, ε -> z+, *
}
`;

/** Kellerautomat Skript 4.9 (Palindrome gerader Länge), Standardregel nicht modelliert. */
export const NKA_49 = String.raw`nka NKA49 {
  alphabet a b
  kelleralphabet * a b
  keller *
  states zin zout z− z+
  start zin
  accept z+
  zin, *, a -> zin, a*
  zin, *, b -> zin, b*
  zin, a, a -> zin, aa
  zin, a, b -> zin, ba
  zin, b, a -> zin, ab
  zin, b, b -> zin, bb
  zin, a, ε -> zout, a
  zin, b, ε -> zout, b
  zout, a, a -> zout, ε
  zout, a, b -> z−, ε
  zout, b, a -> z−, ε
  zout, b, b -> zout, ε
  zout, *, ε -> z+, *
}
`;

/** Turingmaschine Skript 5.9 (Palindrome über {a, b}). Skriptname f− wird als f- geschrieben. */
export const TM_59 = String.raw`tm TM59 {
  alphabet a b
  bandalphabet a b □
  blank □
  states r ra rb l la lb f+ f-
  start r
  accept f+
  reject f-
  r, a -> ra, □, R
  r, b -> rb, □, R
  r, □ -> f+, □, N
  ra, a -> ra, a, R
  ra, b -> ra, b, R
  ra, □ -> la, □, L
  rb, a -> rb, a, R
  rb, b -> rb, b, R
  rb, □ -> lb, □, L
  la, a -> l, □, L
  la, b -> f-, b, N
  la, □ -> f+, □, N
  lb, a -> f-, a, N
  lb, b -> l, □, L
  lb, □ -> f+, □, N
  l, a -> l, a, L
  l, b -> l, b, L
  l, □ -> r, □, R
}
`;

/** Turingmaschine, die auf jedem a ewig nach rechts-stehen-bleibt (Schleife). */
export const TM_ENDLOS = String.raw`tm Endlos {
  alphabet a
  bandalphabet a □
  blank □
  states r f+ f-
  start r
  accept f+
  reject f-
  r, a -> r, a, N
}
`;

/** Alle Fixtures dieser Testgruppe. */
export const ALL_FIXTURES = {
  MOORE_210,
  MEALY_PARITAET,
  NKA_46,
  NKA_49,
  TM_59,
};

/** Erwartete Objektart je Fixture. */
export const FIXTURE_KINDS: Record<keyof typeof ALL_FIXTURES, ObjectKind> = {
  MOORE_210: 'moore',
  MEALY_PARITAET: 'mealy',
  NKA_46: 'nka',
  NKA_49: 'nka',
  TM_59: 'tm',
};

// ---------------------------------------------------------------------------
// Hilfsfunktionen

export function firstObject(doc: Document): FormalObject {
  const o = doc.objects[0];
  if (!o) throw new Error('Dokument ohne Objekt');
  return o;
}

/** Erstes Objekt eines Textes. */
export function parseFirst(text: string): Automaton {
  const o = firstObject(parseDocument(text).doc);
  if (!isAutomaton(o)) throw new Error(`Zustandsmaschine erwartet, ist ${o.kind}`);
  return o;
}

/** ID des Zustands mit dem angegebenen Namen. Wirft, wenn er fehlt. */
export function idOf(obj: Automaton, name: string): StateId {
  const s = obj.states.find((st) => st.name === name);
  if (!s) throw new Error(`Zustand ${name} fehlt in ${obj.name}`);
  return s.id;
}

/** Zustandsnamen zu einer Liste von IDs (fehlende IDs erscheinen als ?id). */
export function namesOf(
  obj: Automaton,
  ids: readonly StateId[] | null | undefined,
): string[] {
  return (ids ?? []).map((id) => obj.states.find((s) => s.id === id)?.name ?? `?${id}`);
}

export function asMealy(o: FormalObject): Mealy {
  if (o.kind !== 'mealy') throw new Error(`erwartet mealy, ist ${o.kind}`);
  return o;
}

export function asMoore(o: FormalObject): Moore {
  if (o.kind !== 'moore') throw new Error(`erwartet moore, ist ${o.kind}`);
  return o;
}

export function asNka(o: FormalObject): NKA {
  if (o.kind !== 'nka') throw new Error(`erwartet nka, ist ${o.kind}`);
  return o;
}

export function asTm(o: FormalObject): TM {
  if (o.kind !== 'tm') throw new Error(`erwartet tm, ist ${o.kind}`);
  return o;
}
