// Kellerautomat (nichtdeterministisch), Skript 4.3–4.5: Breitensuche über Konfigurationen.
import type {
  NKA,
  SimOptions,
  SimResult,
  SimStep,
  StateId,
  Trace,
  TransitionId,
  TreeNode,
  Word,
} from '../model/types';

export function simulateNka(obj: NKA, word: Word, opts: SimOptions = {}): Trace {
  const limit = opts.stepLimit ?? 10000;
  const n = word.length;
  const known = obj.start !== null && obj.states.some((s) => s.id === obj.start);
  if (obj.start === null || !known) {
    return {
      word,
      steps: [{ pos: 0, active: [], fired: [], stack: [], explanation: { key: 'sim.start', params: { active: [] } } }],
      result: 'stuck',
      tree: [],
    };
  }
  const accept = new Set(obj.accept);
  const byEmpty = obj.acceptBy === 'empty';
  // 'final': Endzustand (4.5); 'empty' (nicht im Skript): nur noch y0 im Keller, Zustand egal.
  const isAcc = (state: StateId, st: Word): boolean =>
    byEmpty ? st.length === 1 && st[0] === obj.y0 : accept.has(state);
  const byFrom = new Map<StateId, typeof obj.transitions>();
  for (const t of obj.transitions) {
    const l = byFrom.get(t.from) ?? [];
    l.push(t);
    byFrom.set(t.from, l);
  }
  const maxPush = obj.transitions.reduce((m, t) => Math.max(m, t.label.push.length), 0);
  const maxHeight = 2 * n + 2 * obj.states.length * maxPush + 10;
  const keyOf = (s: StateId, pos: number, st: Word): string => JSON.stringify([s, pos, st]);

  const tree: TreeNode[] = [];
  const mk = (parent: number | null, state: StateId, pos: number, via: TransitionId | null, stack: Word): TreeNode => {
    const node: TreeNode = { id: tree.length, parent, state, pos, via, status: 'open', stack };
    tree.push(node);
    return node;
  };
  const visited = new Set<string>();
  const queue: number[] = [];
  const root = mk(null, obj.start, 0, null, [obj.y0]);
  visited.add(keyOf(root.state, 0, root.stack ?? []));
  let found: TreeNode | null = null;
  let cut = false;
  let nodeLimit = false;
  if (n === 0 && isAcc(root.state, root.stack ?? [])) {
    root.status = 'accepting';
    found = root;
  } else queue.push(root.id);

  for (let qi = 0; qi < queue.length && !found && !nodeLimit; qi++) {
    const node = tree[queue[qi] as number] as TreeNode;
    const stack = node.stack ?? [];
    let kids = 0;
    if (stack.length > 0) {
      const top = stack[0] as string;
      for (const t of byFrom.get(node.state) ?? []) {
        if (t.label.top !== top) continue;
        if (t.label.read !== null && !(node.pos < n && word[node.pos] === t.label.read)) continue;
        kids++;
        const pos = node.pos + (t.label.read === null ? 0 : 1);
        const st = [...t.label.push, ...stack.slice(1)];
        if (tree.length > limit) {
          nodeLimit = true;
          break;
        }
        const child = mk(node.id, t.to, pos, t.id, st);
        if (tree.length > limit) {
          child.status = 'limit';
          nodeLimit = true;
          break;
        }
        if (st.length > maxHeight) {
          child.status = 'limit';
          cut = true;
          continue;
        }
        const key = keyOf(t.to, pos, st);
        if (visited.has(key)) {
          child.status = 'cycle';
          continue;
        }
        visited.add(key);
        if (pos === n && isAcc(t.to, st)) {
          child.status = 'accepting';
          found = child;
          break;
        }
        queue.push(child.id);
      }
    }
    if (kids === 0) node.status = 'dead';
  }

  // Weg wählen
  let end: TreeNode = found ?? (tree[0] as TreeNode);
  if (!found) for (const t of tree) if (t.pos > end.pos) end = t;
  const path: TreeNode[] = [];
  for (let cur: TreeNode | undefined = end; cur; cur = cur.parent === null ? undefined : tree[cur.parent]) path.push(cur);
  path.reverse();
  const steps: SimStep[] = path.map((nd, k) => {
    const prev = k > 0 ? (path[k - 1] as TreeNode) : null;
    const t = nd.via === null ? undefined : obj.transitions.find((x) => x.id === nd.via);
    return {
      pos: nd.pos,
      active: [nd.state],
      fired: nd.via === null ? [] : [nd.via],
      stack: (nd.stack ?? []).slice(),
      explanation:
        prev === null || !t
          ? { key: 'sim.start', params: { active: [nd.state] } }
          : {
              key: 'sim.nka.step',
              params: { from: prev.state, top: t.label.top, read: t.label.read, to: nd.state, push: t.label.push.slice() },
            },
    };
  });
  const result: SimResult = found ? 'accepted' : nodeLimit || cut ? 'limit' : 'rejected';
  return { word, steps, result, tree };
}
