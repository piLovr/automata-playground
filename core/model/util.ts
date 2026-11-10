// Hilfsfunktionen für Modell-Operationen (rein).
import type { Automaton, MealyLabel, NkaLabel, Sym, TmLabel, Transition, Word } from './types';

export type AnyLabel = Sym | Word | MealyLabel | NkaLabel | TmLabel;
export type AnyTransition = Transition<AnyLabel>;

/** Symbole eines Labels als Wort (nur sinnvoll für DEA/NEA/Moore; bei Objektlabels alle Symbole in Feldreihenfolge). */
export function labelWord(l: AnyLabel): Word {
  if (typeof l === 'string') return [l];
  if (Array.isArray(l)) return l;
  if ('in' in l) return [l.in, l.out];
  if ('top' in l) return [l.top, ...(l.read === null ? [] : [l.read]), ...l.push];
  return [l.read, l.write];
}

/** Tiefe Kopie eines Labels. */
export function cloneLabel<L extends AnyLabel>(l: L): L {
  if (Array.isArray(l)) return l.slice() as L;
  if (typeof l === 'object') {
    const c = { ...l } as Record<string, unknown>;
    if (Array.isArray(c.push)) c.push = c.push.slice();
    return c as L;
  }
  return l;
}

export function transitionsOf(obj: Automaton): AnyTransition[] {
  return obj.transitions as AnyTransition[];
}

export function withTransitions<O extends Automaton>(obj: O, transitions: AnyTransition[]): O {
  return { ...obj, transitions } as unknown as O;
}

/** Kanonischer Schlüssel (Feldreihenfolge bei Objektlabels egal). */
export function labelKey(l: AnyLabel): string {
  if (typeof l === 'object' && !Array.isArray(l)) {
    const o = l as unknown as Record<string, unknown>;
    return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
  }
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

function addAll(list: Sym[], syms: Sym[]): Sym[] {
  const out = list.slice();
  const seen = new Set(out);
  for (const s of syms) {
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/** Erweitert die zum Typ passenden Alphabete um die Symbole der Labels (Reihenfolge des ersten Auftretens). */
export function withLabelSymbols<O extends Automaton>(obj: O, labels: AnyLabel[]): O {
  const o = obj as Automaton;
  let x = o.alphabet;
  switch (o.kind) {
    case 'dea':
    case 'nea':
    case 'moore': {
      for (const l of labels) x = addAll(x, labelWord(l));
      return { ...o, alphabet: x } as unknown as O;
    }
    case 'mealy': {
      let y = o.outputAlphabet;
      for (const l of labels as MealyLabel[]) {
        x = addAll(x, [l.in]);
        y = addAll(y, [l.out]);
      }
      return { ...o, alphabet: x, outputAlphabet: y } as unknown as O;
    }
    case 'nka': {
      let y = o.stackAlphabet;
      for (const l of labels as NkaLabel[]) {
        if (l.read !== null) x = addAll(x, [l.read]);
        y = addAll(y, [l.top, ...l.push]);
      }
      return { ...o, alphabet: x, stackAlphabet: y } as unknown as O;
    }
    case 'tm': {
      let y = o.tapeAlphabet;
      for (const l of labels as TmLabel[]) y = addAll(y, [l.read, l.write]);
      return { ...o, tapeAlphabet: y } as unknown as O;
    }
  }
}
