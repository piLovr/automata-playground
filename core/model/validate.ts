import { getKind } from './kinds';
import type { Diagnostic, FormalObject, ObjectKind } from './types';

export function validate(obj: FormalObject): Diagnostic[] {
  return getKind(obj.kind).validate(obj);
}

export function emptyAutomaton(kind: ObjectKind, name: string): FormalObject {
  return getKind(kind).empty(name);
}
