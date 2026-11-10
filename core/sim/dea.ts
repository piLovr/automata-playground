// DEA-Simulation nach Skript 2.4: f*, f**.
import type { DEA, SimOptions, SimStep, StateId, Trace, TransitionId, Word } from '../model/types';

export function simulateDea(obj: DEA, word: Word, opts: SimOptions = {}): Trace {
  const limit = opts.stepLimit ?? 10000;
  const accept = new Set(obj.accept);
  const stateExists = obj.start !== null && obj.states.some((s) => s.id === obj.start);
  if (obj.start === null || !stateExists) {
    return {
      word,
      steps: [{ pos: 0, active: [], fired: [], explanation: { key: 'sim.start', params: { active: [] } } }],
      result: 'stuck',
      stateSequence: [],
      finalState: null,
    };
  }
  const delta = new Map<string, { to: StateId; id: TransitionId }>();
  for (const t of obj.transitions) {
    const key = JSON.stringify([t.from, t.label]);
    if (!delta.has(key)) delta.set(key, { to: t.to, id: t.id });
  }
  const alpha = new Set(obj.alphabet);
  let cur: StateId = obj.start;
  const steps: SimStep[] = [
    { pos: 0, active: [cur], fired: [], explanation: { key: 'sim.start', params: { active: [cur] } } },
  ];
  const seq: StateId[] = [cur];
  for (let i = 0; i < word.length; i++) {
    if (i >= limit) {
      return { word, steps, result: 'limit', stateSequence: seq, finalState: cur };
    }
    const sym = word[i] as string;
    const hit = alpha.has(sym) ? delta.get(JSON.stringify([cur, sym])) : undefined;
    if (!hit) {
      steps.push({
        pos: i + 1,
        active: [],
        fired: [],
        explanation: { key: 'sim.dea.stuck', params: { state: cur, symbol: sym } },
      });
      return { word, steps, result: 'stuck', stateSequence: seq, finalState: null };
    }
    steps.push({
      pos: i + 1,
      active: [hit.to],
      fired: [hit.id],
      explanation: { key: 'sim.dea.step', params: { from: cur, symbol: sym, to: hit.to } },
    });
    cur = hit.to;
    seq.push(cur);
  }
  return {
    word,
    steps,
    result: accept.has(cur) ? 'accepted' : 'rejected',
    stateSequence: seq,
    finalState: cur,
  };
}
