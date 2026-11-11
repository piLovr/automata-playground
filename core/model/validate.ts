import { validateEgrep } from './egrep';
import { validateGrammar } from './grammar';
import { getKind } from './kinds';
import { validateRegex } from './regex';
import type { Automaton, Diagnostic, FormalKind, FormalObject, ObjectKind } from './types';

export function isAutomaton(o: FormalObject): o is Automaton {
  return o.kind !== 'regex' && o.kind !== 'grammatik' && o.kind !== 'egrep';
}

export function validate(obj: FormalObject): Diagnostic[] {
  if (obj.kind === 'regex') return validateRegex(obj);
  if (obj.kind === 'grammatik') return validateGrammar(obj);
  if (obj.kind === 'egrep') return validateEgrep(obj);
  return getKind(obj.kind).validate(obj);
}

export function emptyAutomaton(kind: ObjectKind, name: string): Automaton {
  return getKind(kind).empty(name);
}

export function emptyObject(kind: FormalKind, name: string): FormalObject {
  if (kind === 'regex') return { kind: 'regex', name, alphabet: [], expr: null };
  if (kind === 'grammatik') {
    return { kind: 'grammatik', name, nonterminals: [], terminals: [], start: null, productions: [] };
  }
  if (kind === 'egrep') return { kind: 'egrep', name, pattern: '', alphabet: [] };
  return getKind(kind).empty(name);
}
