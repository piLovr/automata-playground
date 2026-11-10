// NEA-Simulation nach Skript 2.58: Konfigurationen (Zustand, Position), Wortkanten und ε-Kanten.
import type {
  NEA,
  SimOptions,
  SimResult,
  SimStep,
  StateId,
  Trace,
  TransitionId,
  TreeNode,
  Word,
} from '../model/types';

function matchesAt(label: Word, word: Word, pos: number): boolean {
  if (pos + label.length > word.length) return false;
  for (let k = 0; k < label.length; k++) if (label[k] !== word[pos + k]) return false;
  return true;
}

export function epsilonClosure(obj: NEA, states: StateId[]): StateId[] {
  const out = new Set<StateId>();
  const stack: StateId[] = [];
  for (const s of states) {
    if (!out.has(s)) {
      out.add(s);
      stack.push(s);
    }
  }
  const eps = new Map<StateId, StateId[]>();
  for (const t of obj.transitions) {
    if (t.label.length === 0) {
      const l = eps.get(t.from) ?? [];
      l.push(t.to);
      eps.set(t.from, l);
    }
  }
  while (stack.length > 0) {
    const s = stack.pop() as StateId;
    for (const n of eps.get(s) ?? []) {
      if (!out.has(n)) {
        out.add(n);
        stack.push(n);
      }
    }
  }
  const order = obj.states.map((s) => s.id).filter((id) => out.has(id));
  for (const s of out) if (!order.includes(s)) order.push(s);
  return order;
}

export function simulateNea(obj: NEA, word: Word, opts: SimOptions = {}): Trace {
  const limit = opts.stepLimit ?? 10000;
  const n = word.length;
  const accept = new Set(obj.accept);
  const stateOrder = new Map(obj.states.map((s, k) => [s.id, k]));
  const tIndex = new Map(obj.transitions.map((t, k) => [t.id, k]));
  const known = (id: StateId | null): id is StateId => id !== null && stateOrder.has(id);

  const byFrom = new Map<StateId, typeof obj.transitions>();
  for (const t of obj.transitions) {
    const l = byFrom.get(t.from) ?? [];
    l.push(t);
    byFrom.set(t.from, l);
  }

  // Erreichbare Konfigurationen je Position.
  const active: Set<StateId>[] = Array.from({ length: n + 1 }, () => new Set<StateId>());
  const fired: Set<TransitionId>[] = Array.from({ length: n + 1 }, () => new Set<TransitionId>());
  if (known(obj.start)) active[0]?.add(obj.start);
  let maxPos = known(obj.start) ? 0 : -1;
  for (let i = 0; i <= n; i++) {
    const cur = active[i] as Set<StateId>;
    // ε-Hülle an Position i
    const stack = [...cur];
    while (stack.length > 0) {
      const s = stack.pop() as StateId;
      for (const t of byFrom.get(s) ?? []) {
        if (t.label.length === 0) {
          (fired[i] as Set<TransitionId>).add(t.id);
          if (!cur.has(t.to)) {
            cur.add(t.to);
            stack.push(t.to);
          }
        }
      }
    }
    if (cur.size > 0) maxPos = Math.max(maxPos, i);
    // Wortkanten nach vorn
    for (const s of cur) {
      for (const t of byFrom.get(s) ?? []) {
        if (t.label.length > 0 && matchesAt(t.label, word, i)) {
          const j = i + t.label.length;
          (active[j] as Set<StateId>).add(t.to);
          (fired[j] as Set<TransitionId>).add(t.id);
        }
      }
    }
  }

  const sortStates = (set: Set<StateId>): StateId[] =>
    [...set].sort((a, b) => (stateOrder.get(a) ?? 0) - (stateOrder.get(b) ?? 0));
  const steps: SimStep[] = [];
  for (let i = 0; i <= n; i++) {
    const act = sortStates(active[i] as Set<StateId>);
    const fi = [...(fired[i] as Set<TransitionId>)].sort((a, b) => (tIndex.get(a) ?? 0) - (tIndex.get(b) ?? 0));
    let explanation;
    if (i === 0) explanation = { key: 'sim.start', params: { active: act } };
    else if (act.length === 0) explanation = { key: 'sim.nea.empty', params: { pos: i } };
    else explanation = { key: 'sim.nea.step', params: { pos: i, symbol: word[i - 1], active: act } };
    steps.push({ pos: i, active: act, fired: fi, explanation });
  }

  const accepted = [...(active[n] as Set<StateId>)].some((s) => accept.has(s));
  let result: SimResult = accepted ? 'accepted' : maxPos < n ? 'stuck' : 'rejected';

  // Berechnungsbaum (Tiefensuche)
  const tree: TreeNode[] = [];
  if (known(obj.start)) {
    interface Pending {
      parent: number | null;
      state: StateId;
      pos: number;
      via: TransitionId | null;
    }
    const todo: Pending[] = [{ parent: null, state: obj.start, pos: 0, via: null }];
    let limited = false;
    while (todo.length > 0 && !limited) {
      const p = todo.pop() as Pending;
      const id = tree.length;
      const node: TreeNode = { id, parent: p.parent, state: p.state, pos: p.pos, via: p.via, status: 'open' };
      tree.push(node);
      if (id >= limit) {
        node.status = 'limit';
        limited = true;
        break;
      }
      // Zyklus auf dem Ast?
      let anc = p.parent;
      let cyc = false;
      while (anc !== null) {
        const a = tree[anc] as TreeNode;
        if (a.state === p.state && a.pos === p.pos) {
          cyc = true;
          break;
        }
        anc = a.parent;
      }
      if (cyc) {
        node.status = 'cycle';
        continue;
      }
      const kids: Pending[] = [];
      for (const t of byFrom.get(p.state) ?? []) {
        if (matchesAt(t.label, word, p.pos)) {
          kids.push({ parent: id, state: t.to, pos: p.pos + t.label.length, via: t.id });
        }
      }
      if (p.pos === n) {
        if (kids.length === 0) node.status = accept.has(p.state) ? 'accepting' : 'rejecting';
        else node.status = accept.has(p.state) ? 'accepting' : 'open';
      } else {
        node.status = kids.length === 0 ? 'dead' : 'open';
      }
      for (let k = kids.length - 1; k >= 0; k--) todo.push(kids[k] as Pending);
    }
    if (limited) result = 'limit';
  }
  return { word, steps, result, tree };
}
