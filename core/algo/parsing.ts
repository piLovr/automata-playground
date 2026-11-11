// Kellerautomat aus kontextfreier Grammatik (4.27) und die Analyseläufe 4.28 (top-down) und 4.34 (bottom-up).
import type {
  Correspondence,
  Derivation,
  DerivStep,
  DerivTree,
  Grammar,
  NKA,
  ParseAction,
  ParseRow,
  ParseRun,
  ProcOptions,
  ProcResult,
  Production,
  ProductionId,
  State,
  Sym,
  Transition,
  NkaLabel,
  Word,
} from '../model/types';
import { Rec, abort, clone, guard, mkOrigin, need, newRec, resultName, snapAuto, uniqueName } from './common';

/** Produktionen, deren linke Seite nicht genau ein Nichtterminal ist (kein Typ 2, 4.13). */
export function type2Violations(g: Grammar): ProductionId[] {
  const N = new Set(g.nonterminals);
  return g.productions.filter((p) => !(p.left.length === 1 && N.has(p.left[0] as Sym))).map((p) => p.id);
}

/** Kellerende-Symbol y0: `*`, falls frei, sonst `⊥` (ggf. mit Zusatz). */
function freshY0(g: Grammar): Sym {
  const used = new Set<string>([...g.nonterminals, ...g.terminals]);
  if (!used.has('*')) return '*';
  return uniqueName(used, '⊥');
}

// ---------------------------------------------------------------------------
// 4.27

export function grammarToNka(g: Grammar, opts: ProcOptions = {}): ProcResult<NKA> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('grammar2nka', g, ['grammatik']);
    const bad = type2Violations(g);
    if (bad.length > 0) abort('algo.notType2', { productionIds: bad }, g.name);
    const y0 = freshY0(g);
    const S = g.start as Sym;
    const states: State[] = [
      { id: 's0', name: 'z0', pos: { x: 100, y: 120 } },
      { id: 's1', name: 'z', pos: { x: 300, y: 120 } },
      { id: 's2', name: 'z+', pos: { x: 500, y: 120 } },
    ];
    const nka: NKA = {
      kind: 'nka',
      name: resultName(opts, g, '_nka'),
      alphabet: g.terminals.slice(),
      stackAlphabet: [y0, ...g.terminals, ...g.nonterminals],
      y0,
      states,
      start: 's0',
      accept: ['s2'],
      transitions: [],
    };
    const corr: Correspondence[] = [];
    const add = (from: string, to: string, label: NkaLabel): Transition<NkaLabel> => {
      const t: Transition<NkaLabel> = { id: `t${nka.transitions.length}`, from, to, label };
      nka.transitions.push(t);
      return t;
    };
    const view = (t: Transition<NkaLabel>) => (): { obj: NKA; added: string[]; highlight: { transition: string }[] } => ({
      obj: snapAuto(nka),
      added: [t.id],
      highlight: [{ transition: t.id }],
    });
    const t0 = add('s0', 's1', { top: y0, read: null, push: [S, y0] });
    rec.add('proc.gk.start', { transition: t0.id, symbol: S, y0 }, view(t0));
    for (const p of g.productions) {
      const t = add('s1', 's1', { top: p.left[0] as Sym, read: null, push: p.right.slice() });
      corr.push({ target: { transition: t.id }, source: 0, elems: [{ production: p.id }] });
      rec.add('proc.gk.produce', { transition: t.id, production: p.id, left: p.left[0], right: p.right.slice() }, view(t), {
        source: 0,
        elems: [{ production: p.id }],
      });
    }
    for (const x of g.terminals) {
      const t = add('s1', 's1', { top: x, read: x, push: [] });
      rec.add('proc.gk.read', { transition: t.id, symbol: x }, view(t));
    }
    const ta = add('s1', 's2', { top: y0, read: null, push: [y0] });
    rec.add('proc.gk.accept', { transition: ta.id, y0 }, view(ta));
    return { ...nka, origin: mkOrigin('grammar2nka', [g], corr) };
  });
}

// ---------------------------------------------------------------------------
// gemeinsame Hilfen der Läufe

interface Node {
  state: 'z0' | 'z' | 'z+';
  pos: number;
  /** Top-down: oberstes Symbol vorn, y0 zuletzt. Bottom-up: y0 vorn, oberstes Symbol hinten. */
  stack: Word;
  parent: number;
  action: ParseAction | null;
}

const DEFAULT_MAX = 20000;

/** Baum aus einer Ableitung (links oder rechts): je Satzformsymbol der zugehörige Knoten. */
function buildTree(g: Grammar, d: Derivation): DerivTree | null {
  if (d.start.length !== 1) return null;
  const root: DerivTree = { id: 0, sym: d.start[0] as Sym, children: [] };
  let cur: DerivTree[] = [root];
  for (const st of d.steps) {
    const p = g.productions.find((x) => x.id === st.production);
    const node = cur[st.pos];
    if (!p || !node) return null;
    node.production = p.id;
    const kids: DerivTree[] = p.right.length === 0 ? [{ id: 0, sym: null, children: [] }] : p.right.map((s) => ({ id: 0, sym: s, children: [] }));
    node.children = kids;
    cur = [...cur.slice(0, st.pos), ...(p.right.length === 0 ? [] : kids), ...cur.slice(st.pos + 1)];
  }
  let n = 0;
  const number = (t: DerivTree): void => {
    t.id = n++;
    t.children.forEach(number);
  };
  number(root);
  return root;
}

function pathOf(nodes: Node[], last: number): Node[] {
  const out: Node[] = [];
  for (let i = last; i >= 0; i = (nodes[i] as Node).parent) out.push(nodes[i] as Node);
  return out.reverse();
}

function emptyRun(limitHit: boolean, explored: number, deadEnds: number): ParseRun {
  return { accepted: false, rows: [], derivation: null, tree: null, explored, deadEnds, limitHit };
}


// ---------------------------------------------------------------------------
// 4.28 top-down

export function topDownRun(g: Grammar, w: Word, opts: { maxConfigs?: number } = {}): ProcResult<ParseRun> {
  const rec = new Rec(false);
  return guard(rec, () => {
    need('topDownRun', g, ['grammatik']);
    const bad = type2Violations(g);
    if (bad.length > 0) abort('algo.notType2', { productionIds: bad }, g.name);
    const maxConfigs = opts.maxConfigs ?? DEFAULT_MAX;
    const y0 = freshY0(g);
    const S = g.start as Sym;
    const n = w.length;
    const N = new Set(g.nonterminals);
    // kleinste Länge eines Terminalworts je Symbol
    const minLen = new Map<Sym, number>();
    for (const x of g.terminals) minLen.set(x, 1);
    for (const x of g.nonterminals) minLen.set(x, Infinity);
    for (let ch = true; ch; ) {
      ch = false;
      for (const p of g.productions) {
        const v = p.right.reduce((a, s) => a + (minLen.get(s) ?? 1), 0);
        const l = p.left[0] as Sym;
        if (v < (minLen.get(l) ?? Infinity)) {
          minLen.set(l, v);
          ch = true;
        }
      }
    }
    const need0 = (st: Word): number => {
      let s = 0;
      for (const x of st) if (x !== y0) s += minLen.get(x) ?? 1;
      return s;
    };
    const nodes: Node[] = [{ state: 'z0', pos: 0, stack: [y0], parent: -1, action: null }];
    const seen = new Set<string>([JSON.stringify(['z0', 0, [y0]])]);
    let limitHit = false;
    let dead = 0;
    let found = -1;
    for (let qi = 0; qi < nodes.length && found < 0; qi++) {
      const cur = nodes[qi] as Node;
      let kids = 0;
      const push = (state: Node['state'], pos: number, stack: Word, action: ParseAction): boolean => {
        const rest = n - pos;
        if (need0(stack) > rest) return false;
        if (stack.length - 1 > rest + n + 2) {
          limitHit = true;
          return false;
        }
        const key = JSON.stringify([state, pos, stack]);
        if (seen.has(key)) return false;
        if (nodes.length >= maxConfigs) {
          limitHit = true;
          return false;
        }
        seen.add(key);
        nodes.push({ state, pos, stack, parent: qi, action });
        kids++;
        if (state === 'z+') found = nodes.length - 1;
        return true;
      };
      if (cur.state === 'z0') push('z', 0, [S, y0], { kind: 'start' });
      else if (cur.state === 'z') {
        const top = cur.stack[0] as Sym;
        const below = cur.stack.slice(1);
        if (top === y0) {
          if (cur.pos === n) push('z+', cur.pos, cur.stack, { kind: 'accept' });
        } else if (N.has(top)) {
          for (const p of g.productions) {
            if (p.left[0] !== top) continue;
            push('z', cur.pos, [...p.right, ...below], { kind: 'produce', production: p.id });
            if (found >= 0) break;
          }
        } else if (cur.pos < n && w[cur.pos] === top) {
          push('z', cur.pos + 1, below, { kind: 'read', sym: top });
        }
      }
      if (kids === 0 && found < 0) dead++;
    }
    if (found < 0) return emptyRun(limitHit, nodes.length, dead);
    const path = pathOf(nodes, found);
    const rows: ParseRow[] = path.map((nd, i) => {
      const inner = nd.stack.slice(0, -1);
      return {
        read: w.slice(0, nd.pos),
        rest: w.slice(nd.pos),
        state: nd.state,
        stack: nd.stack.slice(),
        action: i + 1 < path.length ? clone((path[i + 1] as Node).action) : null,
        form: [...w.slice(0, nd.pos), ...inner],
      };
    });
    const steps: DerivStep[] = [];
    for (let i = 0; i + 1 < rows.length; i++) {
      const a = (rows[i] as ParseRow).action;
      if (a?.kind === 'produce') {
        steps.push({ production: a.production, pos: (rows[i] as ParseRow).read.length, form: (rows[i + 1] as ParseRow).form.slice() });
      }
    }
    const derivation: Derivation = { start: [S], steps };
    return { accepted: true, rows, derivation, tree: buildTree(g, derivation), explored: nodes.length, deadEnds: dead, limitHit };
  });
}

// ---------------------------------------------------------------------------
// 4.34 bottom-up

/**
 * Tiefensuche. Reihenfolge der Möglichkeiten je Konfiguration (Abweichung von „reduzieren vor lesen“,
 * damit 4.34 entsteht): Akzeptanz; nichtleere Reduktionen (längere rechte Seite zuerst, dann
 * Modellreihenfolge); Lesen; ε-Reduktionen (Modellreihenfolge).
 */
export function bottomUpRun(g: Grammar, w: Word, opts: { maxConfigs?: number } = {}): ProcResult<ParseRun> {
  const rec = new Rec(false);
  return guard(rec, () => {
    need('bottomUpRun', g, ['grammatik']);
    const bad = type2Violations(g);
    if (bad.length > 0) abort('algo.notType2', { productionIds: bad }, g.name);
    const maxConfigs = opts.maxConfigs ?? DEFAULT_MAX;
    const y0 = freshY0(g);
    const S = g.start as Sym;
    const n = w.length;
    const nonEps: Production[] = g.productions
      .filter((p) => p.right.length > 0)
      .map((p, i) => ({ p, i }))
      .sort((a, b) => b.p.right.length - a.p.right.length || a.i - b.i)
      .map((x) => x.p);
    const eps = g.productions.filter((p) => p.right.length === 0);
    // Kellergrenze (korrekt, schneidet keine Lösung ab). Gibt es einen akzeptierenden Lauf, so gibt es
    // einen zu einem Ableitungsbaum ohne verschachtelte Knoten gleicher (Nichtterminal, Überdeckung):
    // ersetzt man so einen Teilbaum durch den inneren, bleibt der Baum gültig und das Wort gleich.
    // Der Kellerinhalt (ohne y0) besteht aus den bereits fertigen Kindern der noch offenen Vorfahren
    // des nächsten Lesepunkts. Entlang dieser Vorfahrenkette ändert sich die Überdeckung höchstens
    // (2n+1)-mal (Anfang bzw. Ende wandert), je Überdeckung gibt es höchstens |N| Knoten (paarweise
    // verschiedene Nichtterminale). Jeder offene Vorfahr hat höchstens max(r−1,1) fertige Kinder
    // (r = längste rechte Seite). Also Kellerhöhe ≤ max(r−1,1)·|N|·(2n+1); darüber nie nötig.
    const rMax = g.productions.reduce((m, p) => Math.max(m, p.right.length), 0);
    const maxStack = Math.max(rMax - 1, 1) * g.nonterminals.length * (2 * n + 1) + 1;
    // Zweite korrekte Beschneidung: Bei jedem Lauf ist der Keller (ohne y0) ein lebensfähiges Präfix,
    // d. h. Präfix einer Rechtssatzform bis höchstens zum Ende des nächsten Handles (Rückwärtslesen
    // einer Rechtsableitung). Die Menge dieser Präfixe erkennt der Item-NFA (Produktion, Punktposition):
    // Start = alle Items von S mit Punkt 0; ε-Übergang von „Punkt vor B“ zu allen Items von B mit
    // Punkt 0; Lesen von X rückt den Punkt, wenn er vor X steht. Ist der Keller kein solches Präfix,
    // kann er nie zu [y0, S] werden; die Konfiguration abzuschneiden verliert keine Lösung.
    const prods = g.productions;
    const closure = (set: Set<number>, enc: number): void => {
      // Item-Kodierung: produktionsindex · 64 + punkt
      const stack2 = [enc];
      while (stack2.length > 0) {
        const it = stack2.pop() as number;
        if (set.has(it)) continue;
        set.add(it);
        const pr = prods[Math.floor(it / 64)] as Production;
        const dot = it % 64;
        if (dot < pr.right.length) {
          const B = pr.right[dot] as Sym;
          prods.forEach((q, qi) => {
            if (q.left[0] === B) stack2.push(qi * 64);
          });
        }
      }
    };
    const GOAL = -1;
    const GOAL_DONE = -2;
    const viable = (st: Word): boolean => {
      let cur = new Set<number>();
      prods.forEach((q, qi) => {
        if (q.left[0] === S) closure(cur, qi * 64);
      });
      cur.add(GOAL); // erweiterte Grammatik S' → S: Punkt vor S
      for (let k = 1; k < st.length; k++) {
        const X = st[k] as Sym;
        const nxt = new Set<number>();
        for (const it of cur) {
          if (it === GOAL) {
            if (X === S) nxt.add(GOAL_DONE);
            continue;
          }
          if (it === GOAL_DONE) continue;
          const pr = prods[Math.floor(it / 64)] as Production;
          const dot = it % 64;
          if (dot < pr.right.length && pr.right[dot] === X) closure(nxt, it + 1);
        }
        if (nxt.size === 0) return false;
        cur = nxt;
      }
      return true;
    };
    const nodes: Node[] = [{ state: 'z0', pos: 0, stack: [y0], parent: -1, action: null }];
    const seen = new Set<string>();
    let limitHit = false;
    let dead = 0;
    let found = -1;
    const endsWith = (st: Word, v: Word): boolean => {
      if (st.length - 1 < v.length) return false; // y0 nicht Teil von v
      for (let k = 0; k < v.length; k++) if (st[st.length - v.length + k] !== v[k]) return false;
      return true;
    };
    // Rekursion in Schleife: explizite Stapel von Alternativen
    interface Frame {
      idx: number;
      moves: { state: Node['state']; pos: number; stack: Word; action: ParseAction }[];
      next: number;
      kids: number;
    }
    const movesOf = (nd: Node): Frame['moves'] => {
      const out: Frame['moves'] = [];
      if (nd.pos === n && nd.stack.length === 2 && nd.stack[1] === S) out.push({ state: 'z+', pos: nd.pos, stack: nd.stack, action: { kind: 'accept' } });
      for (const p of nonEps) {
        if (endsWith(nd.stack, p.right)) {
          out.push({ state: 'z', pos: nd.pos, stack: [...nd.stack.slice(0, nd.stack.length - p.right.length), p.left[0] as Sym], action: { kind: 'reduce', production: p.id } });
        }
      }
      if (nd.pos < n) {
        const x = w[nd.pos] as Sym;
        out.push({ state: 'z', pos: nd.pos + 1, stack: [...nd.stack, x], action: { kind: 'shift', sym: x } });
      }
      for (const p of eps) out.push({ state: 'z', pos: nd.pos, stack: [...nd.stack, p.left[0] as Sym], action: { kind: 'reduce', production: p.id } });
      return out;
    };
    const stackOf: Frame[] = [];
    seen.add(JSON.stringify([0, [y0]]));
    stackOf.push({ idx: 0, moves: movesOf(nodes[0] as Node), next: 0, kids: 0 });
    while (stackOf.length > 0 && found < 0) {
      const fr = stackOf[stackOf.length - 1] as Frame;
      if (fr.next >= fr.moves.length) {
        if (fr.kids === 0) dead++;
        stackOf.pop();
        continue;
      }
      const m = fr.moves[fr.next++] as Frame['moves'][number];
      if (m.stack.length - 1 > maxStack) continue; // beweisbar nie nötig, siehe maxStack: kein limitHit
      if (m.state !== 'z+' && m.action.kind !== 'shift' && !viable(m.stack)) continue; // kein lebensfähiges Präfix
      const key = JSON.stringify([m.pos, m.stack]);
      if (m.state !== 'z+' && seen.has(key)) continue;
      if (nodes.length >= maxConfigs) {
        limitHit = true;
        break;
      }
      if (m.state !== 'z+') seen.add(key);
      nodes.push({ state: m.state, pos: m.pos, stack: m.stack, parent: fr.idx, action: m.action });
      fr.kids++;
      const idx = nodes.length - 1;
      if (m.state === 'z+') {
        found = idx;
        break;
      }
      stackOf.push({ idx, moves: movesOf(nodes[idx] as Node), next: 0, kids: 0 });
    }
    if (found < 0) return emptyRun(limitHit, nodes.length, dead);
    const path = pathOf(nodes, found);
    const rows: ParseRow[] = path.map((nd, i) => ({
      read: w.slice(0, nd.pos),
      rest: w.slice(nd.pos),
      state: nd.state,
      stack: nd.stack.slice(),
      action: i + 1 < path.length ? clone((path[i + 1] as Node).action) : null,
      form: [...nd.stack.slice(1), ...w.slice(nd.pos)],
    }));
    // Reduktionen rückwärts = Rechtsableitung (4.36)
    const rev: DerivStep[] = [];
    for (let i = rows.length - 2; i >= 0; i--) {
      const row = rows[i] as ParseRow;
      const a = row.action;
      if (a?.kind !== 'reduce') continue;
      const p = g.productions.find((x) => x.id === a.production) as Production;
      rev.push({ production: p.id, pos: row.stack.length - 1 - p.right.length, form: row.form.slice() });
    }
    const derivation: Derivation = { start: [S], steps: rev };
    return { accepted: true, rows, derivation, tree: buildTree(g, derivation), explored: nodes.length, deadEnds: dead, limitHit };
  });
}

