import { isAutomaton } from './validate';
import type { Automaton, FormalObject, Grammar, Production, State } from './types';
import { labelKey, numericSuffix, transitionsOf, type AnyTransition } from './util';

/**
 * Übernimmt aus `prev` IDs (Zustände gleichen Namens, Übergänge gleichen (from-Name, to-Name, Label))
 * und Positionen (wenn `next` keine hat). Neue Elemente bekommen IDs, die in `prev` nicht vorkommen.
 */
export function reconcile(prev: FormalObject | undefined, next: FormalObject): FormalObject {
  if (!prev || prev.kind === 'regex' || prev.kind === 'egrep') return next;
  if (prev.kind === 'grammatik') return next.kind === 'grammatik' ? reconcileGrammar(prev, next) : next;
  if (!isAutomaton(next)) return next;
  return reconcileAutomaton(prev, next);
}

/** Produktionen behalten die ID einer prev-Produktion mit gleichem (left, right); neue IDs kollidieren nicht mit prev. */
function reconcileGrammar(prev: Grammar, next: Grammar): Grammar {
  const queues = new Map<string, string[]>();
  const prevIds = new Set<string>();
  for (const p of prev.productions) {
    prevIds.add(p.id);
    const key = JSON.stringify([p.left, p.right]);
    const q = queues.get(key) ?? [];
    q.push(p.id);
    queues.set(key, q);
  }
  const reserved = new Set(next.productions.map((p) => p.id));
  const claimed = new Set<string>();
  let counter = 0;
  for (const id of [...prevIds, ...reserved]) counter = Math.max(counter, numericSuffix(id, 'p') + 1);
  const productions: Production[] = next.productions.map((p) => {
    let id = queues.get(JSON.stringify([p.left, p.right]))?.shift();
    if (id === undefined) {
      id = p.id;
      if (prevIds.has(id) || claimed.has(id)) {
        while (prevIds.has(`p${counter}`) || claimed.has(`p${counter}`) || reserved.has(`p${counter}`)) counter++;
        id = `p${counter}`;
      }
    }
    claimed.add(id);
    return { ...p, id };
  });
  return { ...next, productions };
}

function reconcileAutomaton(prev: Automaton, next: Automaton): Automaton {
  const prevStateByName = new Map<string, State>();
  for (const s of prev.states) if (!prevStateByName.has(s.name)) prevStateByName.set(s.name, s);
  const prevNames = new Map(prev.states.map((s) => [s.id, s.name]));

  const usedS = new Set<string>(prev.states.map((s) => s.id));
  const reservedS = new Set<string>(next.states.map((s) => s.id));
  let counterS = 0;
  for (const id of [...usedS, ...reservedS]) counterS = Math.max(counterS, numericSuffix(id, 's') + 1);
  const idMap = new Map<string, string>();
  const claimed = new Set<string>();
  const states = next.states.map((s) => {
    const p = prevStateByName.get(s.name);
    let id: string;
    if (p && !claimed.has(p.id)) {
      id = p.id;
      claimed.add(id);
    } else {
      id = s.id;
      if (usedS.has(id) || claimed.has(id)) {
        while (usedS.has(`s${counterS}`) || claimed.has(`s${counterS}`) || reservedS.has(`s${counterS}`)) counterS++;
        id = `s${counterS}`;
      }
      claimed.add(id);
    }
    idMap.set(s.id, id);
    const out = { ...s, id } as State;
    if (out.pos === undefined && p?.pos !== undefined) out.pos = { ...p.pos };
    return out;
  });
  const map = (id: string): string => idMap.get(id) ?? id;

  const queues = new Map<string, string[]>();
  const prevTIds = new Set<string>();
  for (const t of transitionsOf(prev)) {
    prevTIds.add(t.id);
    const key = JSON.stringify([prevNames.get(t.from), prevNames.get(t.to), labelKey(t.label)]);
    const q = queues.get(key) ?? [];
    q.push(t.id);
    queues.set(key, q);
  }
  const nextNames = new Map(next.states.map((s) => [s.id, s.name]));
  let counterT = 0;
  for (const id of [...prevTIds, ...transitionsOf(next).map((t) => t.id)]) {
    counterT = Math.max(counterT, numericSuffix(id, 't') + 1);
  }
  const claimedT = new Set<string>();
  const reservedT = new Set(transitionsOf(next).map((t) => t.id));
  const transitions: AnyTransition[] = transitionsOf(next).map((t) => {
    const key = JSON.stringify([nextNames.get(t.from), nextNames.get(t.to), labelKey(t.label)]);
    const q = queues.get(key);
    let id = q?.shift();
    if (id === undefined) {
      id = t.id;
      if (prevTIds.has(id) || claimedT.has(id)) {
        while (prevTIds.has(`t${counterT}`) || claimedT.has(`t${counterT}`) || reservedT.has(`t${counterT}`)) counterT++;
        id = `t${counterT}`;
      }
    }
    claimedT.add(id);
    return { ...t, id, from: map(t.from), to: map(t.to) };
  });

  return {
    ...next,
    states,
    start: next.start === null ? null : map(next.start),
    accept: next.accept.map(map),
    ...(next.kind === 'tm' ? { reject: next.reject.map(map) } : {}),
    transitions,
  } as Automaton;
}
