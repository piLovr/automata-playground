// LR(0)-/LALR(1)-Automat und LR-Lauf (6.46-6.57, Tabelle 6.1).
import type {
  Diagnostic,
  Grammar,
  LrAction,
  LrAutomaton,
  LrItem,
  LrRunRow,
  LrState,
  ProcOptions,
  ProcResult,
  Production,
  ProductionId,
  Sym,
  Word,
} from '../model/types';
import { abort, guard, need, newRec, uniqueName } from '../algo/common';
import { type2Violations } from '../algo/parsing';

export const LR_START = '__start';
const BOT = '⊣';
const EOI = '⊢';
const HASH = '\u0000#'; // Platzhalter # (Dragon-Book 4.7.5)

const txt = (w: Word): string => w.join(w.every((s) => s.length === 1) ? '' : ' ');

export function lrItemText(p: Production, dot: number, lookahead?: Sym[]): string {
  const parts = [txt(p.right.slice(0, dot)), '•', txt(p.right.slice(dot))].filter((s) => s !== '');
  return `${p.left.join('')} → ${parts.join(' ')}${lookahead && lookahead.length > 0 ? `  [${lookahead.join(', ')}]` : ''}`;
}

/** Warnung `lr.conflict` je Konflikt des Automaten. */
export function lrConflictDiagnostics(a: LrAutomaton): Diagnostic[] {
  return a.conflicts.map((c) => ({
    severity: 'warning' as const,
    code: 'lr.conflict' as const,
    params: { state: c.state, symbol: c.symbol, kinds: c.actions.map((x) => x.kind) },
  }));
}

export function lrAutomaton(g: Grammar, mode: 'LR0' | 'LALR1', opts: ProcOptions = {}): ProcResult<LrAutomaton> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need(mode === 'LR0' ? 'lr0' : 'lalr1', g, ['grammatik']);
    const bad = type2Violations(g);
    if (bad.length > 0) abort('algo.notType2', { productionIds: bad }, g.name);
    if (g.terminals.includes(BOT) || g.terminals.includes(EOI)) {
      abort('algo.invalid', { diagnostics: 0, reason: `Endmarke ${g.terminals.includes(BOT) ? BOT : EOI} ist Terminal` }, g.name);
    }
    const S = g.start as Sym;
    const used = new Set<string>([...g.nonterminals, ...g.terminals, BOT, EOI]);
    const S1 = uniqueName(used, `${S}'`);
    const startProd: Production = { id: LR_START, left: [S1], right: [BOT, S, EOI] };
    const augmented: Grammar = {
      ...g,
      nonterminals: [S1, ...g.nonterminals],
      terminals: [...g.terminals, BOT, EOI],
      start: S1,
      productions: [startProd, ...g.productions.map((p) => ({ ...p, left: p.left.slice(), right: p.right.slice() }))],
    };
    delete augmented.origin;
    const prods = new Map<ProductionId, Production>(augmented.productions.map((p) => [p.id, p]));
    const N = new Set(augmented.nonterminals);
    const byLeft = new Map<Sym, Production[]>();
    for (const p of augmented.productions) byLeft.set(p.left[0] as Sym, [...(byLeft.get(p.left[0] as Sym) ?? []), p]);
    const P = (id: ProductionId): Production => prods.get(id) as Production;
    // Symbolreihenfolge: Terminale, dann ⊢, dann Nichtterminale (BFS wie 6.53/6.55 bis auf Umbenennung)
    const symOrder: Sym[] = [...g.terminals, EOI, ...g.nonterminals];

    // --- LR(0)-Hülle und goto ---
    const itemKey = (i: LrItem): string => `${i.production}:${i.dot}`;
    const closure = (kernel: LrItem[]): LrItem[] => {
      const items = kernel.map((i) => ({ production: i.production, dot: i.dot }));
      const have = new Set(items.map(itemKey));
      for (let k = 0; k < items.length; k++) {
        const it = items[k] as LrItem;
        const nx = P(it.production).right[it.dot];
        if (nx !== undefined && N.has(nx)) {
          for (const q of byLeft.get(nx) ?? []) {
            const ni = { production: q.id, dot: 0 };
            if (!have.has(itemKey(ni))) {
              have.add(itemKey(ni));
              items.push(ni);
            }
          }
        }
      }
      return items;
    };

    const states: LrState[] = [];
    const byKernel = new Map<string, number>();
    const gotoList: { from: number; symbol: Sym; to: number }[] = [];
    const gotoMap = new Map<string, number>();
    const via: ({ from: number; symbol: Sym } | null)[] = [];
    const addState = (kernel: LrItem[], v: { from: number; symbol: Sym } | null): number => {
      const key = kernel.map(itemKey).sort().join(' ');
      const old = byKernel.get(key);
      if (old !== undefined) return old;
      const id = states.length;
      byKernel.set(key, id);
      states.push({ id, kernel: kernel.map((i) => ({ production: i.production, dot: i.dot })), items: closure(kernel) });
      via.push(v);
      return id;
    };
    addState([{ production: LR_START, dot: 1 }], null);
    for (let z = 0; z < states.length; z++) {
      const st = states[z] as LrState;
      for (const X of symOrder) {
        const kern: LrItem[] = [];
        for (const it of st.items) if (P(it.production).right[it.dot] === X) kern.push({ production: it.production, dot: it.dot + 1 });
        if (kern.length === 0) continue;
        const to = addState(kern, { from: z, symbol: X });
        gotoList.push({ from: z, symbol: X, to });
        gotoMap.set(`${z}|${X}`, to);
      }
    }

    // --- LALR(1)-Vorausschau (Berechnung nicht im Skript; Skript: nur Bedingungen 6.57) ---
    // Verfahren: Dragon-Book 4.7.5, spontane Erzeugung und Propagation mit Platzhalter #.
    const la = new Map<string, Set<Sym>>(); // `${state}|${production}:${dot}` -> Vorausschau (Kern-Items)
    if (mode === 'LALR1') {
      const nullable = new Set<Sym>();
      const first = new Map<Sym, Set<Sym>>();
      for (const A of augmented.nonterminals) first.set(A, new Set());
      let changed = true;
      const ins = (set: Set<Sym>, x: Sym): void => {
        if (!set.has(x)) {
          set.add(x);
          changed = true;
        }
      };
      while (changed) {
        changed = false;
        for (const p of augmented.productions) {
          const A = p.left[0] as Sym;
          const fa = first.get(A) as Set<Sym>;
          let allNull = true;
          for (const s of p.right) {
            if (N.has(s)) {
              for (const t of first.get(s) as Set<Sym>) ins(fa, t);
              if (!nullable.has(s)) {
                allNull = false;
                break;
              }
            } else {
              ins(fa, s);
              allNull = false;
              break;
            }
          }
          if (allNull) ins(nullable, A);
        }
      }
      /** FIRST(β a) */
      const firstSeq = (beta: Word, a: Sym): Set<Sym> => {
        const out = new Set<Sym>();
        for (const s of beta) {
          if (N.has(s)) {
            for (const t of first.get(s) as Set<Sym>) out.add(t);
            if (!nullable.has(s)) return out;
          } else {
            out.add(s);
            return out;
          }
        }
        out.add(a);
        return out;
      };
      /** LR(1)-Hülle eines Items mit Vorausschau a. */
      const closure1 = (it: LrItem, a: Sym): { production: ProductionId; dot: number; la: Sym }[] => {
        const out = [{ production: it.production, dot: it.dot, la: a }];
        const have = new Set([`${it.production}:${it.dot}:${a}`]);
        for (let k = 0; k < out.length; k++) {
          const c = out[k] as (typeof out)[number];
          const right = P(c.production).right;
          const B = right[c.dot];
          if (B === undefined || !N.has(B)) continue;
          const f = firstSeq(right.slice(c.dot + 1), c.la);
          for (const q of byLeft.get(B) ?? []) {
            for (const b of f) {
              const key = `${q.id}:0:${b}`;
              if (!have.has(key)) {
                have.add(key);
                out.push({ production: q.id, dot: 0, la: b });
              }
            }
          }
        }
        return out;
      };
      const kk = (z: number, i: LrItem): string => `${z}|${itemKey(i)}`;
      for (const st of states) for (const k of st.kernel) la.set(kk(st.id, k), new Set());
      // Start-Kern-Item hat keine Vorgänger: beliebige Vorausschau säen (Folge ⊢ steht ohnehin in der rechten Seite)
      (la.get(kk(0, (states[0] as (typeof states)[number]).kernel[0] as LrItem)) as Set<Sym>).add(EOI);
      const prop = new Map<string, string[]>();
      for (const st of states) {
        for (const k of st.kernel) {
          for (const c of closure1(k, HASH)) {
            const X = P(c.production).right[c.dot];
            if (X === undefined) continue;
            const to = gotoMap.get(`${st.id}|${X}`) as number;
            const target = kk(to, { production: c.production, dot: c.dot + 1 });
            if (c.la === HASH) prop.set(kk(st.id, k), [...(prop.get(kk(st.id, k)) ?? []), target]);
            else (la.get(target) as Set<Sym>).add(c.la);
          }
        }
      }
      changed = true;
      while (changed) {
        changed = false;
        for (const [from, tos] of prop) {
          for (const to of tos) {
            const dst = la.get(to) as Set<Sym>;
            for (const a of la.get(from) as Set<Sym>) ins(dst, a);
          }
        }
      }
      // Vorausschau aller Items einer Zustandsmenge aus den Kernen
      for (const st of states) {
        const acc = new Map<string, Set<Sym>>();
        for (const k of st.kernel) {
          for (const a of la.get(kk(st.id, k)) as Set<Sym>) {
            for (const c of closure1(k, a)) {
              const key = kk(st.id, c);
              if (!acc.has(key)) acc.set(key, new Set());
              (acc.get(key) as Set<Sym>).add(c.la);
            }
          }
        }
        const order = (set: Set<Sym>): Sym[] => [...set].sort((x, y) => symOrder.indexOf(x) - symOrder.indexOf(y));
        for (const list of [st.kernel, st.items]) {
          for (const it of list) {
            if (it.dot === P(it.production).right.length && it.production !== LR_START) {
              const s = acc.get(kk(st.id, it));
              it.lookahead = s ? order(s) : [];
            }
          }
        }
      }
    }

    // --- Aktionen ---
    const actions: Record<number, Record<Sym, LrAction[]>> = {};
    const conflicts: LrAutomaton['conflicts'] = [];
    const terminalsAndEnd = [...g.terminals, EOI];
    for (const st of states) {
      const row: Record<Sym, LrAction[]> = {};
      const put = (a: Sym, act: LrAction): void => {
        const l = row[a] ?? (row[a] = []);
        if (!l.some((x) => JSON.stringify(x) === JSON.stringify(act))) l.push(act);
      };
      for (const t of g.terminals) {
        const to = gotoMap.get(`${st.id}|${t}`);
        if (to !== undefined) put(t, { kind: 'shift', to });
      }
      for (const it of st.items) {
        const p = P(it.production);
        if (it.production === LR_START) {
          if (it.dot === 2) put(EOI, { kind: 'accept' });
        } else if (it.dot === p.right.length) {
          const syms = mode === 'LR0' ? terminalsAndEnd : (it.lookahead ?? []);
          for (const a of syms) put(a, { kind: 'reduce', production: it.production });
        }
      }
      for (const a of terminalsAndEnd) {
        const l = row[a];
        if (l && l.length > 1) conflicts.push({ state: st.id, symbol: a, actions: l });
      }
      if (Object.keys(row).length > 0) actions[st.id] = row;
    }

    const result: LrAutomaton = { augmented, states, goto: gotoList, actions, conflicts, mode };
    for (const st of states) {
      const v = via[st.id] ?? null;
      rec.add(
        'proc.lr.state',
        { state: st.id, from: v ? v.from : null, symbol: v ? v.symbol : null, kernel: st.kernel.length, items: st.items.length },
        () => ({
          table: {
            corner: `z${st.id}`,
            colHead: mode === 'LALR1' ? ['Item', 'la'] : ['Item'],
            rowHead: st.items.map((_, k) => (k < st.kernel.length ? '•' : '')),
            cells: st.items.map((it) => (mode === 'LALR1' ? [lrItemText(P(it.production), it.dot), (it.lookahead ?? []).join(' ')] : [lrItemText(P(it.production), it.dot)])),
          },
        }),
      );
    }
    return result;
  });
}

export function lrRun(a: LrAutomaton, w: Word, opts: { maxSteps?: number } = {}): { rows: LrRunRow[]; accepted: boolean } {
  const max = opts.maxSteps ?? 10000;
  const prods = new Map<ProductionId, Production>(a.augmented.productions.map((p) => [p.id, p]));
  const gotoMap = new Map<string, number>(a.goto.map((e) => [`${e.from}|${e.symbol}`, e.to]));
  const rows: LrRunRow[] = [];
  let stack: (number | Sym)[] = [0, BOT];
  let rest: Word = [...w, EOI];
  for (let step = 0; ; step++) {
    const z = stack[stack.length - 2] as number;
    const acts = a.actions[z]?.[rest[0] as Sym];
    const act = acts?.[0]; // bei Konflikt die erste Aktion
    const row: LrRunRow = { stack: stack.slice(), rest: rest.slice(), action: step >= max ? null : (act ?? { kind: 'error' }) };
    rows.push(row);
    if (step >= max || !act) return { rows, accepted: false };
    if (act.kind === 'accept') return { rows, accepted: true };
    if (act.kind === 'shift') {
      stack = [...stack, act.to, rest[0] as Sym];
      rest = rest.slice(1);
    } else {
      const p = prods.get(act.production) as Production;
      const base = stack.slice(0, stack.length - 2 * p.right.length);
      const below = base[base.length - 2] as number | undefined;
      const to = below === undefined ? undefined : gotoMap.get(`${below}|${p.left[0]}`);
      if (to === undefined) {
        row.action = { kind: 'error' };
        return { rows, accepted: false };
      }
      stack = [...base, to, p.left[0] as Sym];
    }
  }
}
