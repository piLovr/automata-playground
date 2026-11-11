// Sprach-Explorer: Anzahl je Länge, Wörterseiten, Ausgabetabellen.
import { toDea } from '../algo/decide';
import { abort, guard, limitAbort, newRec, safeValidate } from '../algo/common';
import { egrepAlphabet, egrepTest } from '../algo/egrep';
import { enumerate } from '../algo/enumerate';
import { type3Violations } from '../algo/grammarops';
import { cfgWords } from '../derive/search';
import { grammarType } from '../model/grammar';
import { egrepHasBackref, parseEgrep } from '../model/egrep';
import { simulate } from '../sim/batch';
import type {
  DEA,
  FormalObject,
  LengthCounts,
  Mealy,
  Moore,
  ProcResult,
  Sym,
  Word,
  WordsPage,
} from '../model/types';

const MAX_CANDIDATES = 200000;

// ---------------------------------------------------------------------------
// Exakter Weg über den DEA

interface Engine {
  alphabet: Sym[];
  /** next[q * k + a] */
  next: Int32Array;
  accept: Uint8Array;
  start: number;
  states: number;
}

function engineOf(m: DEA): Engine {
  const idx = new Map(m.states.map((s, i) => [s.id, i]));
  const k = m.alphabet.length;
  const ai = new Map(m.alphabet.map((x, i) => [x, i]));
  const next = new Int32Array(m.states.length * k).fill(-1);
  for (const t of m.transitions) {
    const f = idx.get(t.from);
    const to = idx.get(t.to);
    const a = ai.get(t.label);
    if (f !== undefined && to !== undefined && a !== undefined) next[f * k + a] = to;
  }
  const accept = new Uint8Array(m.states.length);
  for (const id of m.accept) {
    const i = idx.get(id);
    if (i !== undefined) accept[i] = 1;
  }
  return { alphabet: m.alphabet, next, accept, start: idx.get(m.start as string) ?? 0, states: m.states.length };
}

function countVectors(e: Engine, maxLen: number): bigint[] {
  const k = e.alphabet.length;
  let v: bigint[] = new Array<bigint>(e.states).fill(0n);
  v[e.start] = 1n;
  const counts: bigint[] = [];
  for (let n = 0; n <= maxLen; n++) {
    let c = 0n;
    for (let q = 0; q < e.states; q++) if (e.accept[q] === 1) c += v[q] as bigint;
    counts.push(c);
    if (n === maxLen) break;
    const w: bigint[] = new Array<bigint>(e.states).fill(0n);
    for (let q = 0; q < e.states; q++) {
      const x = v[q] as bigint;
      if (x === 0n) continue;
      for (let a = 0; a < k; a++) {
        const t = e.next[q * k + a] as number;
        if (t >= 0) w[t] = (w[t] as bigint) + x;
      }
    }
    v = w;
  }
  return counts;
}

/** ways[r][q] = Anzahl Wörter der Länge r, die von q aus zu einem Endzustand führen; null bei zu großer Tabelle. */
function waysTable(e: Engine, maxLen: number, force = false): bigint[][] | null {
  if (!force && (maxLen + 1) * e.states > 2_000_000) return null;
  const k = e.alphabet.length;
  const ways: bigint[][] = [Array.from({ length: e.states }, (_, q) => (e.accept[q] === 1 ? 1n : 0n))];
  for (let r = 1; r <= maxLen; r++) {
    const prev = ways[r - 1] as bigint[];
    const cur: bigint[] = new Array<bigint>(e.states).fill(0n);
    for (let q = 0; q < e.states; q++) {
      let s = 0n;
      for (let a = 0; a < k; a++) {
        const t = e.next[q * k + a] as number;
        if (t >= 0) s += prev[t] as bigint;
      }
      cur[q] = s;
    }
    ways.push(cur);
  }
  return ways;
}

/** Wörter der Länge n ab dem skip-ten (0-basiert), höchstens `want`; Alphabetreihenfolge. */
function wordsOfLength(e: Engine, ways: bigint[][], n: number, skipIn: bigint, want: number): Word[] {
  const k = e.alphabet.length;
  const out: Word[] = [];
  let skip = skipIn;
  const buf: Sym[] = [];
  const dfs = (q: number, r: number): void => {
    if (out.length >= want) return;
    if (r === 0) {
      out.push(buf.slice());
      return;
    }
    for (let a = 0; a < k && out.length < want; a++) {
      const t = e.next[q * k + a] as number;
      if (t < 0) continue;
      const w = (ways[r - 1] as bigint[])[t] as bigint;
      if (w === 0n) continue;
      if (skip >= w) {
        skip -= w;
        continue;
      }
      buf.push(e.alphabet[a] as Sym);
      dfs(t, r - 1);
      buf.pop();
    }
  };
  if ((ways[n] as bigint[])[e.start] !== 0n) dfs(e.start, n);
  return out;
}

/**
 * Alle Wörter der Sprache eines Typ-3-Objekts, Längen-/Alphabetordnung. Bei endlicher Sprache vollständig,
 * sonst bis maxLen. 'invalid': kein Typ-3-Objekt; 'tooLarge': mehr als `max` Wörter.
 */
export function type3Words(
  o: FormalObject,
  maxLen: number,
  max: number,
): { words: Word[]; finite: boolean } | 'invalid' | 'tooLarge' {
  const m = toDea(o);
  if (m === null) return 'invalid';
  const e = engineOf(m);
  const finite = isFinite3(e);
  const bound = finite ? e.states : maxLen;
  const counts = countVectors(e, bound);
  const total = counts.reduce((x, y) => x + y, 0n);
  if (total > BigInt(max)) return 'tooLarge';
  const ways = waysTable(e, bound, true) as bigint[][];
  const words: Word[] = [];
  for (let n = 0; n <= bound; n++) words.push(...wordsOfLength(e, ways, n, 0n, Number(counts[n])));
  return { words, finite };
}

/** Endlich, wenn kein erreichbarer, zu einem Endzustand führender Zustand auf einem Zyklus liegt. */
function isFinite3(e: Engine): boolean {
  const k = e.alphabet.length;
  const reach = new Uint8Array(e.states);
  const stack = [e.start];
  reach[e.start] = 1;
  while (stack.length > 0) {
    const q = stack.pop() as number;
    for (let a = 0; a < k; a++) {
      const t = e.next[q * k + a] as number;
      if (t >= 0 && reach[t] === 0) {
        reach[t] = 1;
        stack.push(t);
      }
    }
  }
  const radj: number[][] = Array.from({ length: e.states }, () => []);
  for (let q = 0; q < e.states; q++) {
    for (let a = 0; a < k; a++) {
      const t = e.next[q * k + a] as number;
      if (t >= 0) (radj[t] as number[]).push(q);
    }
  }
  const live = new Uint8Array(e.states);
  const st: number[] = [];
  for (let q = 0; q < e.states; q++) {
    if (e.accept[q] === 1) {
      live[q] = 1;
      st.push(q);
    }
  }
  while (st.length > 0) {
    const q = st.pop() as number;
    for (const p of radj[q] as number[]) {
      if (live[p] === 0) {
        live[p] = 1;
        st.push(p);
      }
    }
  }
  // Zyklensuche (DFS-Färbung) im Teilgraphen reach ∧ live
  const color = new Uint8Array(e.states);
  const inSub = (q: number): boolean => reach[q] === 1 && live[q] === 1;
  if (!inSub(e.start)) return true;
  const frames: { q: number; a: number }[] = [{ q: e.start, a: 0 }];
  color[e.start] = 1;
  while (frames.length > 0) {
    const f = frames[frames.length - 1] as { q: number; a: number };
    if (f.a >= k) {
      color[f.q] = 2;
      frames.pop();
      continue;
    }
    const t = e.next[f.q * k + f.a++] as number;
    if (t < 0 || !inSub(t)) continue;
    if (color[t] === 1) return false;
    if (color[t] === 0) {
      color[t] = 1;
      frames.push({ q: t, a: 0 });
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Probieren (Kellerautomat, Turingmaschine, egrep mit Rückwärtsverweis, Grammatik Typ < 3)

type Mode = { exact: true; dea: DEA } | { exact: false; test: (w: Word) => boolean; alphabet: Sym[]; list?: Word[]; listExact?: boolean };

function modeOf(o: FormalObject, maxLen: number, stepLimit: number | undefined): Mode {
  const errs = safeValidate(o).filter((d) => d.severity === 'error');
  if (errs.length > 0) abort('algo.invalid', { diagnostics: errs.length }, o.name);
  switch (o.kind) {
    case 'mealy':
    case 'moore':
      return abort('algo.wrongKind', { method: 'sprachop', kind: o.kind }, o.name);
    case 'nka':
    case 'tm':
      return {
        exact: false,
        alphabet: o.alphabet,
        test: (w) => simulate(o, w, stepLimit === undefined ? {} : { stepLimit }).result === 'accepted',
      };
    case 'egrep': {
      const ast = parseEgrep(o.pattern).ast;
      if (ast && egrepHasBackref(ast)) {
        const alphabet = egrepAlphabet(o);
        if (alphabet === null) return abort('algo.invalid', { diagnostics: 1 }, o.name);
        return { exact: false, alphabet, test: (w) => egrepTest(o, w.join('')) === true };
      }
      break;
    }
    case 'grammatik':
      if (type3Violations(o).length > 0) {
        if (grammarType(o).type === 2) {
          const r = cfgWords(o, maxLen);
          const set = new Set(r.words.map((w) => JSON.stringify(w)));
          return { exact: false, alphabet: o.terminals, list: r.words, listExact: r.complete, test: (w) => set.has(JSON.stringify(w)) };
        }
        const list = enumerate(o, maxLen);
        const set = new Set(list.map((w) => JSON.stringify(w)));
        return { exact: false, alphabet: o.terminals, list, test: (w) => set.has(JSON.stringify(w)) };
      }
      break;
    default:
  }
  const m = toDea(o);
  if (m === null) return abort('algo.invalid', { diagnostics: 0 }, o.name);
  return { exact: true, dea: m };
}

/** Kandidaten in Längen-/Alphabetordnung, lazy. */
function* candidates(alphabet: Sym[], maxLen: number): Generator<Word> {
  let total = 0;
  let layer = 1;
  for (let n = 0; n <= maxLen; n++) {
    total += layer;
    if (total > MAX_CANDIDATES) return limitAbort('words', MAX_CANDIDATES);
    layer *= Math.max(alphabet.length, 1);
    if (alphabet.length === 0 && n >= 0) break;
  }
  for (let n = 0; n <= maxLen; n++) {
    if (alphabet.length === 0 && n > 0) return;
    const idx = new Array<number>(n).fill(0);
    for (;;) {
      yield idx.map((i) => alphabet[i] as Sym);
      let p = n - 1;
      while (p >= 0 && (idx[p] as number) === alphabet.length - 1) idx[p--] = 0;
      if (p < 0) break;
      idx[p] = (idx[p] as number) + 1;
    }
  }
}

export function countByLength(o: FormalObject, maxLen: number, opts: { stepLimit?: number } = {}): ProcResult<LengthCounts> {
  return guard(newRec({ steps: false }), () => {
    const mode = modeOf(o, maxLen, opts.stepLimit);
    if (mode.exact) return { counts: countVectors(engineOf(mode.dea), maxLen), exact: true };
    const counts: bigint[] = new Array<bigint>(maxLen + 1).fill(0n);
    for (const w of mode.list ?? candidates(mode.alphabet, maxLen)) {
      if (w.length <= maxLen && mode.test(w)) counts[w.length] = (counts[w.length] as bigint) + 1n;
    }
    return { counts, exact: mode.listExact === true };
  });
}

export function wordsPage(
  o: FormalObject,
  opts: { maxLen: number; offset: number; limit: number; stepLimit?: number },
): ProcResult<WordsPage> {
  return guard(newRec({ steps: false }), () => {
    const { maxLen, offset, limit } = opts;
    const mode = modeOf(o, maxLen, opts.stepLimit);
    if (mode.exact) {
      const e = engineOf(mode.dea);
      const counts = countVectors(e, maxLen);
      const total = counts.reduce((a, b) => a + b, 0n);
      const words: Word[] = [];
      let skip = BigInt(Math.max(0, offset));
      const ways = waysTable(e, maxLen);
      for (let n = 0; n <= maxLen && words.length < limit; n++) {
        const c = counts[n] as bigint;
        if (skip >= c) {
          skip -= c;
          continue;
        }
        if (ways !== null) {
          words.push(...wordsOfLength(e, ways, n, skip, limit - words.length));
        } else {
          // ohne Tabelle: alle Wörter dieser Länge von Hand durchgehen
          let seen = 0n;
          for (const w of candidates(e.alphabet, n)) {
            if (w.length !== n || !runAccepts(e, w)) continue;
            if (seen++ < skip) continue;
            words.push(w);
            if (words.length >= limit) break;
          }
        }
        skip = 0n;
      }
      return { words, done: BigInt(Math.max(0, offset)) + BigInt(words.length) >= total, exact: true };
    }
    const words: Word[] = [];
    let seen = 0;
    let done = true;
    for (const w of mode.list ?? candidates(mode.alphabet, maxLen)) {
      if (w.length > maxLen || !mode.test(w)) continue;
      if (seen++ < offset) continue;
      if (words.length >= limit) {
        done = false;
        break;
      }
      words.push(w);
    }
    return { words, done, exact: mode.listExact === true };
  });
}

function runAccepts(e: Engine, w: Word): boolean {
  const ai = new Map(e.alphabet.map((x, i) => [x, i]));
  let q = e.start;
  for (const x of w) {
    q = e.next[q * e.alphabet.length + (ai.get(x) as number)] as number;
    if (q < 0) return false;
  }
  return e.accept[q] === 1;
}

export function outputsTable(o: Mealy | Moore, maxLen: number, limit = 500): { input: Word; output: Word }[] {
  const out: { input: Word; output: Word }[] = [];
  if (o.start === null) return out;
  const k = o.alphabet.length;
  for (let n = 0; n <= maxLen; n++) {
    if (k === 0 && n > 0) break;
    const idx = new Array<number>(n).fill(0);
    for (;;) {
      if (out.length >= limit) return out;
      const input = idx.map((i) => o.alphabet[i] as Sym);
      out.push({ input, output: simulate(o, input).output ?? [] });
      let p = n - 1;
      while (p >= 0 && (idx[p] as number) === k - 1) idx[p--] = 0;
      if (p < 0) break;
      idx[p] = (idx[p] as number) + 1;
    }
  }
  return out;
}
