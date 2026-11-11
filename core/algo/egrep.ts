// egrep-Regex (Kapitel 3): Treffersuche nach POSIX (am weitesten links, dann am längsten) und
// Umwandlung in einen regulären Ausdruck nach 2.21 (7.4).
import { classMatches, egrepHasBackref, namedClassChars, parseEgrep, printEgrepAst } from '../model/egrep';
import type { EgrepMatch, EgrepNode, EgrepObj, ProcOptions, ProcResult, RegExpr, RegexObj, Sym } from '../model/types';
import { Rec, abort, guard, limitAbort, limits, mkOrigin, need, newRec, resultName } from './common';
import { EMPTY, EPS, cloneExpr, ctor, size, unionAll } from './rexpr';

// ---------------------------------------------------------------------------
// Matcher

type Span = { from: number; to: number };
type Caps = (Span | null)[];
interface Outcome {
  end: number;
  caps: Caps;
}

class LimitHit extends Error {}

const capsKey = (caps: Caps): string => caps.map((c) => (c ? `${c.from},${c.to}` : '-')).join(';');

class Matcher {
  private readonly cps: string[];
  private readonly memo = new Map<string, Outcome[]>();
  private readonly ids = new Map<EgrepNode, number>();
  private steps = 0;

  constructor(
    line: string,
    private readonly groups: number,
    private readonly track: boolean,
    private readonly stepLimit: number,
  ) {
    this.cps = Array.from(line);
  }

  get length(): number {
    return this.cps.length;
  }

  emptyCaps(): Caps {
    return this.track ? new Array<Span | null>(this.groups).fill(null) : [];
  }

  private id(n: EgrepNode): number {
    let v = this.ids.get(n);
    if (v === undefined) {
      v = this.ids.size;
      this.ids.set(n, v);
    }
    return v;
  }

  private dedupe(list: Outcome[]): Outcome[] {
    if (list.length < 2) return list;
    const seen = new Set<string>();
    const out: Outcome[] = [];
    for (const o of list) {
      const k = `${o.end}|${this.track ? capsKey(o.caps) : ''}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(o);
      }
    }
    return out;
  }

  outs(node: EgrepNode, pos: number, caps: Caps): Outcome[] {
    const key = `${this.id(node)}|${pos}|${this.track ? capsKey(caps) : ''}`;
    const hit = this.memo.get(key);
    if (hit) return hit;
    if (++this.steps > this.stepLimit) throw new LimitHit();
    const r = this.compute(node, pos, caps);
    this.memo.set(key, r);
    return r;
  }

  private compute(node: EgrepNode, pos: number, caps: Caps): Outcome[] {
    const cps = this.cps;
    const n = cps.length;
    switch (node.t) {
      case 'char':
        return pos < n && cps[pos] === node.c ? [{ end: pos + 1, caps }] : [];
      case 'any':
        return pos < n ? [{ end: pos + 1, caps }] : [];
      case 'class':
        return pos < n && classMatches(node, cps[pos] as string) ? [{ end: pos + 1, caps }] : [];
      case 'bol':
        return pos === 0 ? [{ end: pos, caps }] : [];
      case 'eol':
        return pos === n ? [{ end: pos, caps }] : [];
      case 'group': {
        const res = this.outs(node.inner, pos, caps);
        if (!this.track) return res;
        return this.dedupe(
          res.map((o) => {
            const c = o.caps.slice();
            c[node.index - 1] = { from: pos, to: o.end };
            return { end: o.end, caps: c };
          }),
        );
      }
      case 'backref': {
        const g = caps[node.n - 1];
        if (!g) return [];
        const len = g.to - g.from;
        if (pos + len > n) return [];
        for (let k = 0; k < len; k++) if (cps[g.from + k] !== cps[pos + k]) return [];
        return [{ end: pos + len, caps }];
      }
      case 'concat': {
        let cur: Outcome[] = [{ end: pos, caps }];
        for (const item of node.items) {
          const next: Outcome[] = [];
          for (const o of cur) for (const r of this.outs(item, o.end, o.caps)) next.push(r);
          cur = this.dedupe(next);
          if (cur.length === 0) break;
        }
        return cur;
      }
      case 'alt': {
        const all: Outcome[] = [];
        for (const item of node.items) for (const r of this.outs(item, pos, caps)) all.push(r);
        return this.dedupe(all);
      }
      case 'repeat': {
        const { min, max, inner } = node;
        type St = { count: number; end: number; caps: Caps };
        const seen = new Set<string>();
        const queue: St[] = [{ count: 0, end: pos, caps }];
        const keyOf = (s: St): string =>
          `${max === null ? Math.min(s.count, min) : s.count}|${s.end}|${this.track ? capsKey(s.caps) : ''}`;
        seen.add(keyOf(queue[0] as St));
        const res: Outcome[] = [];
        const push = (s: St): void => {
          const k = keyOf(s);
          if (!seen.has(k)) {
            seen.add(k);
            queue.push(s);
          }
        };
        for (let q = 0; q < queue.length; q++) {
          const st = queue[q] as St;
          if (st.count >= min) res.push({ end: st.end, caps: st.caps });
          if (max !== null && st.count >= max) continue;
          for (const o of this.outs(inner, st.end, st.caps)) {
            if (o.end > st.end) push({ count: st.count + 1, end: o.end, caps: o.caps });
            else if (st.count < min) push({ count: st.count + 1, end: o.end, caps: o.caps });
            else if (st.count === 0) res.push({ end: o.end, caps: o.caps });
          }
        }
        return this.dedupe(res);
      }
    }
  }
}

/** a besser als b: längerer Gesamttreffer, dann Gruppen der Reihe nach (links beginnend, dann länger; beteiligt vor nicht beteiligt). */
function better(a: Outcome, b: Outcome): boolean {
  if (a.end !== b.end) return a.end > b.end;
  for (let i = 0; i < a.caps.length; i++) {
    const x = a.caps[i] ?? null;
    const y = b.caps[i] ?? null;
    if (x === null && y === null) continue;
    if (x === null) return false;
    if (y === null) return true;
    if (x.from !== y.from) return x.from < y.from;
    if (x.to !== y.to) return x.to > y.to;
  }
  return false;
}

function search(
  ast: EgrepNode,
  groups: number,
  line: string,
  start: number,
  stepLimit: number,
  track: boolean,
): EgrepMatch | null | 'limit' {
  const m = new Matcher(line, groups, track, stepLimit);
  try {
    for (let s = Math.max(0, start); s <= m.length; s++) {
      const res = m.outs(ast, s, m.emptyCaps());
      if (res.length === 0) continue;
      let best = res[0] as Outcome;
      for (const o of res) if (better(o, best)) best = o;
      return {
        from: s,
        to: best.end,
        groups: track ? best.caps.map((c) => (c ? { from: c.from, to: c.to } : null)) : [],
      };
    }
    return null;
  } catch (e) {
    if (e instanceof LimitHit) return 'limit';
    throw e;
  }
}

/** Erster Treffer ab `start` nach POSIX: am weitesten links, dann am längsten. */
export function egrepFirst(
  ast: EgrepNode,
  groups: number,
  line: string,
  start = 0,
  opts: { stepLimit?: number } = {},
): EgrepMatch | null | 'limit' {
  return search(ast, groups, line, start, opts.stepLimit ?? 200000, groups > 0 || egrepHasBackref(ast));
}

/** Alle nicht überlappenden Treffer von links nach rechts; nach einem leeren Treffer geht es eine Stelle weiter. */
export function egrepAll(
  ast: EgrepNode,
  groups: number,
  line: string,
  opts: { stepLimit?: number } = {},
): EgrepMatch[] | 'limit' {
  const n = Array.from(line).length;
  const out: EgrepMatch[] = [];
  let pos = 0;
  while (pos <= n) {
    const m = egrepFirst(ast, groups, line, pos, opts);
    if (m === 'limit') return 'limit';
    if (m === null) break;
    out.push(m);
    pos = m.to > m.from ? m.to : m.to + 1;
  }
  return out;
}

/** Zeile passt (egrep gibt sie aus)? null bei Syntaxfehler im Muster oder Überschreiten des Limits. */
export function egrepTest(o: EgrepObj, line: string): boolean | null {
  const { ast, groups } = parseEgrep(o.pattern);
  if (ast === null) return null;
  const r = search(ast, groups, line, 0, 200000, egrepHasBackref(ast));
  return r === 'limit' ? null : r !== null;
}

// ---------------------------------------------------------------------------
// Umwandlung (7.4)

const MAX_ALPHABET = 128;

function expandRange(a: string, b: string): string[] {
  const out: string[] = [];
  const hi = b.codePointAt(0) as number;
  for (let k = a.codePointAt(0) as number; k <= hi; k++) out.push(String.fromCodePoint(k));
  return out;
}

function derivedAlphabet(ast: EgrepNode): Sym[] {
  const set = new Set<string>();
  const walk = (n: EgrepNode): void => {
    switch (n.t) {
      case 'char':
        set.add(n.c);
        return;
      case 'class':
        for (const c of n.chars) set.add(c);
        for (const [a, b] of n.ranges) {
          const sz = (b.codePointAt(0) as number) - (a.codePointAt(0) as number) + 1;
          if (sz > MAX_ALPHABET) abort('egrep.alphabetTooLarge', { size: sz });
          for (const c of expandRange(a, b)) set.add(c);
        }
        for (const nm of n.named) for (const c of namedClassChars(nm)) set.add(c);
        return;
      case 'group':
      case 'repeat':
        walk(n.inner);
        return;
      case 'concat':
      case 'alt':
        n.items.forEach(walk);
        return;
      default:
        return;
    }
  };
  walk(ast);
  if (set.size > MAX_ALPHABET) abort('egrep.alphabetTooLarge', { size: set.size });
  return [...set].sort((x, y) => (x.codePointAt(0) as number) - (y.codePointAt(0) as number));
}

function hasAnchor(n: EgrepNode): boolean {
  switch (n.t) {
    case 'bol':
    case 'eol':
      return true;
    case 'group':
    case 'repeat':
      return hasAnchor(n.inner);
    case 'concat':
    case 'alt':
      return n.items.some(hasAnchor);
    default:
      return false;
  }
}

export function egrepToRegex(o: EgrepObj, opts: ProcOptions = {}): ProcResult<RegexObj> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('egrep2regex', o, ['egrep']);
    const ast = parseEgrep(o.pattern).ast as EgrepNode;
    if (egrepHasBackref(ast)) abort('egrep.backref', {}, o.name);
    const alphabet: Sym[] = o.alphabet.length > 0 ? [...o.alphabet] : derivedAlphabet(ast);
    const maxSize = limits(opts).maxExprSize;
    const c = ctor(opts.simplify !== false);
    const name = resultName(opts, o, '_ra');
    const mkObj = (e: RegExpr): RegexObj => ({ kind: 'regex', name, alphabet: alphabet.slice(), expr: cloneExpr(e) });
    const view = (rec2: Rec, key: string, params: Record<string, unknown>, e: RegExpr): void => {
      rec2.add(key, params, () => ({ obj: mkObj(e) }));
    };
    const checkSize = (e: RegExpr): RegExpr => {
      if (size(e) > maxSize) limitAbort('exprSize', maxSize);
      return e;
    };
    const symExpr = (a: Sym): RegExpr => ({ op: 'sym', sym: a });
    const concatAll = (list: RegExpr[]): RegExpr => {
      if (list.length === 0) return EPS;
      let r = list[0] as RegExpr;
      for (let i = 1; i < list.length; i++) r = c.concat(r, list[i] as RegExpr);
      return checkSize(r);
    };
    const sigma = unionAll(c, alphabet.map(symExpr));
    const sigmaStar = c.star(sigma);

    const conv = (n: EgrepNode): RegExpr => {
      switch (n.t) {
        case 'char': {
          return alphabet.includes(n.c) ? symExpr(n.c) : EMPTY;
        }
        case 'any': {
          const e = sigma;
          view(rec, 'proc.egrep.any', { alphabet }, e);
          return e;
        }
        case 'class': {
          const chars = alphabet.filter((a) => classMatches(n, a));
          const e = unionAll(c, chars.map(symExpr));
          view(rec, 'proc.egrep.class', { text: printEgrepAst(n), alphabet: chars }, e);
          return e;
        }
        case 'group':
          return conv(n.inner);
        case 'concat':
          return concatAll(n.items.map(conv));
        case 'alt':
          return checkSize(unionAll(c, n.items.map(conv)));
        case 'repeat': {
          const r = conv(n.inner);
          const opt = (x: RegExpr): RegExpr => c.union(x, EPS);
          let e: RegExpr;
          if (n.min === 0 && n.max === null) e = c.star(r);
          else if (n.min === 1 && n.max === null) {
            e = c.concat(r, c.star(r));
            checkSize(e);
            view(rec, 'proc.egrep.plus', { text: printEgrepAst(n.inner) }, e);
          } else if (n.min === 0 && n.max === 1) {
            e = opt(r);
            view(rec, 'proc.egrep.optional', { text: printEgrepAst(n.inner) }, e);
          } else {
            const parts: RegExpr[] = [];
            for (let k = 0; k < n.min; k++) parts.push(r);
            if (n.max === null) parts.push(c.star(r));
            else for (let k = n.min; k < n.max; k++) parts.push(opt(r));
            e = concatAll(parts);
            view(rec, 'proc.egrep.repeat', { min: n.min, max: n.max, text: printEgrepAst(n.inner) }, e);
          }
          return checkSize(e);
        }
        case 'bol':
        case 'eol':
          return abort('egrep.anchorInside', {}, o.name);
        case 'backref':
          return abort('egrep.backref', {}, o.name);
      }
    };

    const alts = ast.t === 'alt' ? ast.items : [ast];
    const pieces: RegExpr[] = [];
    for (const alt of alts) {
      let seq = alt.t === 'concat' ? alt.items.slice() : [alt];
      const hasBol = seq[0]?.t === 'bol';
      if (hasBol) seq = seq.slice(1);
      const hasEol = seq.length > 0 && seq[seq.length - 1]?.t === 'eol';
      if (hasEol) seq = seq.slice(0, -1);
      if (seq.some(hasAnchor)) abort('egrep.anchorInside', {}, o.name);
      const body = concatAll(seq.map(conv));
      view(rec, 'proc.egrep.anchor', { which: 'start', present: hasBol }, hasBol ? EPS : sigmaStar);
      view(rec, 'proc.egrep.anchor', { which: 'end', present: hasEol }, hasEol ? EPS : sigmaStar);
      pieces.push(concatAll([hasBol ? EPS : sigmaStar, body, hasEol ? EPS : sigmaStar]));
    }
    const expr = checkSize(unionAll(c, pieces));
    view(rec, 'proc.egrep.result', {}, expr);
    const result: RegexObj = { kind: 'regex', name, alphabet: alphabet.slice(), expr: cloneExpr(expr) };
    result.origin = mkOrigin('egrep2regex', [o]);
    return result;
  });
}

/** Alphabet der Umwandlung (oder null, wenn sie nicht möglich ist). */
export function egrepAlphabet(o: EgrepObj): Sym[] | null {
  if (o.alphabet.length > 0) return [...o.alphabet];
  const { ast } = parseEgrep(o.pattern);
  if (!ast) return null;
  try {
    return derivedAlphabet(ast);
  } catch {
    return null;
  }
}

/** Umwandlung ohne Schritte; null bei Fehler (Rückwärtsverweis, Anker mitten im Muster, …). */
export function egrepAsRegex(o: EgrepObj): RegexObj | null {
  const r = egrepToRegex(o, { steps: false });
  return r.ok ? r.result : null;
}
