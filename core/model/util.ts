// Hilfsfunktionen für Modell-Operationen (rein).
import type { Automaton, Sym, Transition, Word } from './types';

export type AnyLabel = Sym | Word;
export type AnyTransition = Transition<AnyLabel>;

export function labelWord(l: AnyLabel): Word {
  return typeof l === 'string' ? [l] : l;
}

export function transitionsOf(obj: Automaton): AnyTransition[] {
  return obj.transitions as AnyTransition[];
}

export function withTransitions<O extends Automaton>(obj: O, transitions: AnyTransition[]): O {
  return { ...obj, transitions } as unknown as O;
}

export function labelKey(l: AnyLabel): string {
  return JSON.stringify(l);
}

export function sameLabel(a: AnyLabel, b: AnyLabel): boolean {
  return labelKey(a) === labelKey(b);
}

/** Zahl hinter dem Präfix, z. B. numericSuffix("s12", "s") = 12; sonst -1. */
export function numericSuffix(id: string, prefix: string): number {
  if (!id.startsWith(prefix)) return -1;
  const rest = id.slice(prefix.length);
  return /^\d+$/.test(rest) ? Number(rest) : -1;
}

/** Nächste freie ID `<prefix><n>` mit n = max vorhandene + 1. */
export function nextId(ids: Iterable<string>, prefix: string): string {
  let max = -1;
  for (const id of ids) max = Math.max(max, numericSuffix(id, prefix));
  return `${prefix}${max + 1}`;
}

/** Erster freier Name `<prefix>0`, `<prefix>1`, … */
export function freshName(existing: string[], prefix: string): string {
  const used = new Set(existing);
  let n = 0;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

/** Symbole eines Labels, ohne Duplikate neu hinzugekommen zu `alphabet`. */
export function extendAlphabet(alphabet: Sym[], labels: AnyLabel[]): Sym[] {
  const out = alphabet.slice();
  const seen = new Set(out);
  for (const l of labels) {
    for (const s of labelWord(l)) {
      if (!seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
  }
  return out;
}
