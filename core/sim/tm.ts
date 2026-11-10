// Turingmaschine (deterministisch), Skript 5.6/5.7.
import type { SimOptions, SimStep, StateId, Sym, TapeView, TM, Trace, TransitionId, Word } from '../model/types';

export function simulateTm(obj: TM, word: Word, opts: SimOptions = {}): Trace {
  const limit = opts.stepLimit ?? 10000;
  const n = word.length;
  const tape = new Map<number, Sym>();
  word.forEach((s, i) => tape.set(i, s));
  const known = obj.start !== null && obj.states.some((s) => s.id === obj.start);
  let head = 0;
  let lo = 0;
  let hi = Math.max(n - 1, 0);
  const view = (): TapeView => {
    const cells: Sym[] = [];
    for (let i = lo; i <= hi; i++) cells.push(tape.get(i) ?? obj.blank);
    return { origin: lo, cells, head };
  };
  if (obj.start === null || !known) {
    return {
      word,
      steps: [
        { pos: 0, active: [], fired: [], tape: view(), explanation: { key: 'sim.start', params: { active: [] } } },
      ],
      result: 'stuck',
      visited: 1,
    };
  }
  const plus = new Set(obj.accept);
  const minus = new Set(obj.reject);
  const delta = new Map<string, (typeof obj.transitions)[number]>();
  for (const t of obj.transitions) {
    const key = JSON.stringify([t.from, t.label.read]);
    if (!delta.has(key)) delta.set(key, t);
  }
  let cur: StateId = obj.start;
  const heads = new Set<number>([0]);
  const steps: SimStep[] = [
    { pos: 0, active: [cur], fired: [], tape: view(), explanation: { key: 'sim.start', params: { active: [cur] } } },
  ];
  const finish = (result: Trace['result']): Trace => ({ word, steps, result, visited: heads.size });
  for (let i = 0; ; i++) {
    if (plus.has(cur)) return finish('accepted');
    if (minus.has(cur)) return finish('rejected');
    if (i >= limit) return finish('limit');
    const read = tape.get(head) ?? obj.blank;
    const t = delta.get(JSON.stringify([cur, read]));
    if (!t) {
      steps.push({
        pos: i + 1,
        active: [],
        fired: [],
        tape: view(),
        explanation: { key: 'sim.tm.stuck', params: { state: cur, read } },
      });
      return finish('stuck');
    }
    tape.set(head, t.label.write);
    const from = cur;
    cur = t.to;
    head += t.label.move;
    heads.add(head);
    lo = Math.min(lo, head);
    hi = Math.max(hi, head);
    const fired: TransitionId[] = [t.id];
    steps.push({
      pos: i + 1,
      active: [cur],
      fired,
      tape: view(),
      explanation: {
        key: 'sim.tm.step',
        params: { from, read, to: cur, write: t.label.write, move: t.label.move },
      },
    });
  }
}
