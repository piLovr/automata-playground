// Edit-Operationen: rein, geben ein neues Objekt zurück, Eingaben bleiben unverändert.
import type { Automaton, DEA, NEA, ObjectKind, Point, State, StateId, Sym, TransitionId, Word } from './types';
import {
  extendAlphabet,
  freshName,
  labelKey,
  nextId,
  sameLabel,
  transitionsOf,
  withTransitions,
  type AnyLabel,
  type AnyTransition,
} from './util';

export interface Fragment {
  kind: ObjectKind;
  states: State[];
  transitions: { id: string; from: string; to: string; label: unknown }[];
}

function clonePos(p: Point | undefined): Point | undefined {
  return p === undefined ? undefined : { x: p.x, y: p.y };
}

export function addState<O extends Automaton>(obj: O, name: string, pos?: Point): { obj: O; id: StateId } {
  const id = nextId(obj.states.map((s) => s.id), 's');
  const state: State = pos ? { id, name, pos: { x: pos.x, y: pos.y } } : { id, name };
  return { obj: { ...obj, states: [...obj.states, state] } as O, id };
}

export function renameState<O extends Automaton>(obj: O, id: StateId, name: string): O {
  if (obj.states.some((s) => s.id !== id && s.name === name)) {
    throw new Error(`state name already used: ${name}`);
  }
  return { ...obj, states: obj.states.map((s) => (s.id === id ? { ...s, name } : s)) } as O;
}

export function moveStates<O extends Automaton>(obj: O, moves: Record<StateId, Point>): O {
  return {
    ...obj,
    states: obj.states.map((s) => {
      const p = Object.prototype.hasOwnProperty.call(moves, s.id) ? moves[s.id] : undefined;
      return p ? { ...s, pos: { x: p.x, y: p.y } } : s;
    }),
  } as O;
}

export function removeStates<O extends Automaton>(obj: O, ids: StateId[]): O {
  const gone = new Set(ids);
  const next = {
    ...obj,
    states: obj.states.filter((s) => !gone.has(s.id)),
    start: obj.start !== null && gone.has(obj.start) ? null : obj.start,
    accept: obj.accept.filter((a) => !gone.has(a)),
  } as O;
  return withTransitions(
    next,
    transitionsOf(obj).filter((t) => !gone.has(t.from) && !gone.has(t.to)),
  );
}

export function setStart<O extends Automaton>(obj: O, id: StateId | null): O {
  return { ...obj, start: id } as O;
}

export function setAccepting<O extends Automaton>(obj: O, id: StateId, accepting: boolean): O {
  const has = obj.accept.includes(id);
  if (accepting === has) return { ...obj, accept: obj.accept.slice() } as O;
  return { ...obj, accept: accepting ? [...obj.accept, id] : obj.accept.filter((a) => a !== id) } as O;
}

export function addTransition<O extends Automaton>(
  obj: O,
  from: StateId,
  to: StateId,
  label: O['transitions'][number]['label'],
): { obj: O; id: TransitionId } {
  const id = nextId(obj.transitions.map((t) => t.id), 't');
  const t: AnyTransition = { id, from, to, label: label as AnyLabel };
  const next = withTransitions(obj, [...transitionsOf(obj), t]);
  return { obj: { ...next, alphabet: extendAlphabet(obj.alphabet, [label as AnyLabel]) } as O, id };
}

export function removeTransitions<O extends Automaton>(obj: O, ids: TransitionId[]): O {
  const gone = new Set(ids);
  return withTransitions(
    obj,
    transitionsOf(obj).filter((t) => !gone.has(t.id)),
  );
}

export function setEdgeLabels<O extends Automaton>(
  obj: O,
  from: StateId,
  to: StateId,
  labels: O['transitions'][number]['label'][],
): O {
  const old = transitionsOf(obj).filter((t) => t.from === from && t.to === to);
  const pool = old.slice();
  const ids = new Set(obj.transitions.map((t) => t.id));
  const group: AnyTransition[] = (labels as AnyLabel[]).map((label) => {
    const k = pool.findIndex((t) => sameLabel(t.label, label));
    if (k >= 0) {
      const [hit] = pool.splice(k, 1);
      return { ...(hit as AnyTransition), label };
    }
    const id = nextId(ids, 't');
    ids.add(id);
    return { id, from, to, label };
  });
  const out: AnyTransition[] = [];
  let placed = false;
  for (const t of transitionsOf(obj)) {
    if (t.from === from && t.to === to) {
      if (!placed) {
        out.push(...group);
        placed = true;
      }
    } else out.push(t);
  }
  if (!placed) out.push(...group);
  const next = withTransitions(obj, out);
  return { ...next, alphabet: extendAlphabet(obj.alphabet, labels as AnyLabel[]) } as O;
}

export function setDeaTarget(obj: DEA, from: StateId, symbol: Sym, to: StateId | null): DEA {
  const idx = obj.transitions.findIndex((t) => t.from === from && t.label === symbol);
  if (to === null) {
    return { ...obj, transitions: obj.transitions.filter((t) => !(t.from === from && t.label === symbol)) };
  }
  if (idx < 0) return addTransition(obj, from, to, symbol).obj;
  let seen = false;
  const transitions = obj.transitions.flatMap((t) => {
    if (t.from === from && t.label === symbol) {
      if (seen) return [];
      seen = true;
      return [{ ...t, to }];
    }
    return [t];
  });
  return { ...obj, transitions };
}

export function setNeaTargets(obj: NEA, from: StateId, word: Word, targets: StateId[]): NEA {
  const want = [...new Set(targets)];
  const kept = new Set<StateId>();
  const transitions = obj.transitions.filter((t) => {
    if (t.from !== from || labelKey(t.label) !== labelKey(word)) return true;
    if (want.includes(t.to) && !kept.has(t.to)) {
      kept.add(t.to);
      return true;
    }
    return false;
  });
  const ids = new Set(obj.transitions.map((t) => t.id));
  for (const to of want) {
    if (kept.has(to)) continue;
    const id = nextId(ids, 't');
    ids.add(id);
    transitions.push({ id, from, to, label: word.slice() });
  }
  return { ...obj, transitions, alphabet: extendAlphabet(obj.alphabet, [word]) };
}

export function setAlphabet<O extends Automaton>(obj: O, alphabet: Sym[]): O {
  return { ...obj, alphabet: alphabet.slice() } as O;
}

/** Fangzustand: neuer Zustand, alle fehlenden (z, x) – auch seine eigenen – führen dorthin. */
export function addTrapState(obj: DEA, name?: string): { obj: DEA; id: StateId } {
  const names = obj.states.map((s) => s.name);
  const wanted = name ?? 'fang';
  const finalName = names.includes(wanted) ? freshName(names, wanted) : wanted;
  const { obj: withState, id } = addState(obj, finalName);
  const have = new Set(obj.transitions.map((t) => JSON.stringify([t.from, t.label])));
  const transitions = withState.transitions.slice();
  const ids = new Set(transitions.map((t) => t.id));
  for (const s of withState.states) {
    for (const x of withState.alphabet) {
      if (have.has(JSON.stringify([s.id, x]))) continue;
      const tid = nextId(ids, 't');
      ids.add(tid);
      transitions.push({ id: tid, from: s.id, to: id, label: x });
    }
  }
  return { obj: { ...withState, transitions }, id };
}

export function convertKind(obj: Automaton, kind: ObjectKind): Automaton {
  if (obj.kind === kind) return obj;
  if (obj.kind === 'dea') {
    return { ...obj, kind: 'nea', transitions: obj.transitions.map((t) => ({ ...t, label: [t.label] })) };
  }
  const bad = obj.transitions.find((t) => t.label.length !== 1);
  if (bad) throw new Error('cannot convert: label length is not 1');
  return { ...obj, kind: 'dea', transitions: obj.transitions.map((t) => ({ ...t, label: t.label[0] as Sym })) };
}

export function copyStates(obj: Automaton, ids: StateId[]): Fragment {
  const set = new Set(ids);
  return {
    kind: obj.kind,
    states: obj.states
      .filter((s) => set.has(s.id))
      .map((s) => {
        const c = { ...s } as State;
        if (s.pos) c.pos = { ...s.pos };
        return c;
      }),
    transitions: transitionsOf(obj)
      .filter((t) => set.has(t.from) && set.has(t.to))
      .map((t) => ({ ...t, label: Array.isArray(t.label) ? t.label.slice() : t.label })),
  };
}

export function pasteFragment<O extends Automaton>(
  obj: O,
  frag: Fragment,
  offset: Point,
): { obj: O; ids: StateId[] } {
  if (frag.kind !== obj.kind) throw new Error('fragment kind mismatch');
  const names = obj.states.map((s) => s.name);
  const stateIds = obj.states.map((s) => s.id);
  const map = new Map<string, string>();
  const added: State[] = [];
  for (const s of frag.states) {
    const id = nextId(stateIds, 's');
    stateIds.push(id);
    const name = names.includes(s.name) ? freshName(names, s.name) : s.name;
    names.push(name);
    map.set(s.id, id);
    const c = { ...s, id, name } as State;
    const p = clonePos(s.pos);
    if (p) c.pos = { x: p.x + offset.x, y: p.y + offset.y };
    added.push(c);
  }
  const tids = obj.transitions.map((t) => t.id);
  const newT: AnyTransition[] = [];
  for (const t of frag.transitions) {
    const id = nextId(tids, 't');
    tids.push(id);
    const label = t.label as AnyLabel;
    newT.push({
      id,
      from: map.get(t.from) ?? t.from,
      to: map.get(t.to) ?? t.to,
      label: Array.isArray(label) ? label.slice() : label,
    });
  }
  const base = withTransitions(obj, [...transitionsOf(obj), ...newT]);
  const out = {
    ...base,
    states: [...obj.states, ...added],
    alphabet: extendAlphabet(obj.alphabet, newT.map((t) => t.label)),
  } as O;
  return { obj: out, ids: added.map((s) => s.id) };
}
