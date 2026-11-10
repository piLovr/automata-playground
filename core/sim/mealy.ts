// Mealy- und Moore-Simulation nach Skript 2.9/2.10 (Ausgabe über g).
import type { Mealy, Moore, SimOptions, SimStep, StateId, Sym, Trace, TransitionId, Word } from '../model/types';

type Hit = { to: StateId; id: TransitionId; out?: Sym };

function run(obj: Mealy | Moore, word: Word, opts: SimOptions): Trace {
  const limit = opts.stepLimit ?? 10000;
  const moore = obj.kind === 'moore';
  const outOf = new Map<StateId, Sym | undefined>(
    moore ? (obj as Moore).states.map((s) => [s.id, s.out]) : [],
  );
  const known = obj.start !== null && obj.states.some((s) => s.id === obj.start);
  if (obj.start === null || !known) {
    return {
      word,
      steps: [{ pos: 0, active: [], fired: [], output: [], explanation: { key: 'sim.start', params: { active: [] } } }],
      result: 'stuck',
      stateSequence: [],
      finalState: null,
      output: [],
    };
  }
  const delta = new Map<string, Hit>();
  for (const t of obj.transitions) {
    const sym = typeof t.label === 'string' ? t.label : t.label.in;
    const key = JSON.stringify([t.from, sym]);
    if (delta.has(key)) continue;
    delta.set(key, typeof t.label === 'string' ? { to: t.to, id: t.id } : { to: t.to, id: t.id, out: t.label.out });
  }
  const alpha = new Set(obj.alphabet);
  let cur: StateId = obj.start;
  const output: Word = [];
  if (moore) {
    const g = outOf.get(cur);
    if (g !== undefined) output.push(g);
  }
  const steps: SimStep[] = [
    { pos: 0, active: [cur], fired: [], output: output.slice(), explanation: { key: 'sim.start', params: { active: [cur] } } },
  ];
  const seq: StateId[] = [cur];
  for (let i = 0; i < word.length; i++) {
    if (i >= limit) return { word, steps, result: 'limit', stateSequence: seq, finalState: cur, output };
    const sym = word[i] as Sym;
    const hit = alpha.has(sym) ? delta.get(JSON.stringify([cur, sym])) : undefined;
    if (!hit) {
      steps.push({
        pos: i + 1,
        active: [],
        fired: [],
        output: output.slice(),
        explanation: { key: 'sim.dea.stuck', params: { state: cur, symbol: sym } },
      });
      return { word, steps, result: 'stuck', stateSequence: seq, finalState: null, output };
    }
    let out: Sym | null;
    if (moore) out = outOf.get(hit.to) ?? null;
    else out = hit.out ?? null;
    if (out !== null) output.push(out);
    steps.push({
      pos: i + 1,
      active: [hit.to],
      fired: [hit.id],
      output: output.slice(),
      explanation: {
        key: moore ? 'sim.moore.step' : 'sim.mealy.step',
        params: { from: cur, symbol: sym, to: hit.to, out },
      },
    });
    cur = hit.to;
    seq.push(cur);
  }
  return { word, steps, result: 'done', stateSequence: seq, finalState: cur, output };
}

export const simulateMealy = (obj: Mealy, word: Word, opts: SimOptions = {}): Trace => run(obj, word, opts);
export const simulateMoore = (obj: Moore, word: Word, opts: SimOptions = {}): Trace => run(obj, word, opts);
