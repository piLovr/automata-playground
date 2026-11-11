// Turingmaschine (deterministisch), Skript 5.6/5.7.
import type { SimOptions, SimStep, StateId, Sym, TapeView, TM, Trace, TransitionId, Word } from '../model/types';

export function simulateTm(obj: TM, word: Word, opts: SimOptions = {}): Trace {
  const limit = opts.stepLimit ?? 10000;
  const n = word.length;
  const tape = new Map<number, Sym>();
  word.forEach((s, i) => tape.set(i, s));
  const known = obj.start !== null && obj.states.some((s) => s.id === obj.start);
  let head = 0;
  // LBA (5.21): Fenster −1 … n, die Zellen umfassen immer das ganze Fenster.
  const bounded = obj.bounded === true;
  const bounds: [number, number] = [-1, n];
  let lo = bounded ? -1 : 0;
  let hi = bounded ? Math.max(n, 0) : Math.max(n - 1, 0);
  const view = (): TapeView => {
    const cells: Sym[] = [];
    for (let i = lo; i <= hi; i++) cells.push(tape.get(i) ?? obj.blank);
    return bounded ? { origin: lo, cells, head, bounds } : { origin: lo, cells, head };
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
    // LBA: Verlässt der Kopf das Fenster, wird der Schritt noch ausgeführt (Schreiben, Zustand);
    // danach hält die Simulation mit 'bound'. Festlegung: Erreicht der Schritt gleichzeitig einen
    // Endzustand (F+ oder F−), hat der Endzustand Vorrang und der Lauf endet als accepted/rejected.
    if (bounded && (head < bounds[0] || head > bounds[1]) && !plus.has(cur) && !minus.has(cur)) {
      steps.push({
        pos: i + 1,
        active: [cur],
        fired,
        tape: view(),
        explanation: { key: 'sim.tm.bound', params: { head, bounds } },
      });
      return finish('bound');
    }
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

/** Schlanke Variante von simulateTm ohne Aufzeichnung; liefert dieselben Zahlen
 *  (steps = Anzahl der Trace-Schritte − 1, visited wie Trace.visited). */
export function runTmFast(
  obj: TM,
  word: Word,
  limit = 10000,
): { result: 'accepted' | 'rejected' | 'stuck' | 'limit' | 'bound'; steps: number; visited: number } {
  const n = word.length;
  if (obj.start === null || !obj.states.some((s) => s.id === obj.start)) return { result: 'stuck', steps: 0, visited: 1 };
  const bounded = obj.bounded === true;
  const tape = new Map<number, Sym>();
  word.forEach((s, i) => tape.set(i, s));
  const plus = new Set(obj.accept);
  const minus = new Set(obj.reject);
  const delta = new Map<string, (typeof obj.transitions)[number]>();
  for (const t of obj.transitions) {
    const key = t.from + '\u0000' + t.label.read;
    if (!delta.has(key)) delta.set(key, t);
  }
  let cur: StateId = obj.start;
  let head = 0;
  const heads = new Set<number>([0]);
  for (let i = 0; ; i++) {
    if (plus.has(cur)) return { result: 'accepted', steps: i, visited: heads.size };
    if (minus.has(cur)) return { result: 'rejected', steps: i, visited: heads.size };
    if (i >= limit) return { result: 'limit', steps: i, visited: heads.size };
    const t = delta.get(cur + '\u0000' + (tape.get(head) ?? obj.blank));
    if (!t) return { result: 'stuck', steps: i + 1, visited: heads.size };
    tape.set(head, t.label.write);
    cur = t.to;
    head += t.label.move;
    heads.add(head);
    if (bounded && (head < -1 || head > n) && !plus.has(cur) && !minus.has(cur)) {
      return { result: 'bound', steps: i + 1, visited: heads.size };
    }
  }
}
