// Sprachrechner (1.6–1.9): Ausdrücke über benannten Mengen und Typ-3-Objekten.
import { Rec, mkOrigin } from '../algo/common';
import { toDea } from '../algo/decide';
import { type3Words } from '../explore/index';
import { deriveAlphabet, makeMenge } from '../model/menge';
import { Scanner } from '../text/lexer';
import { readWordSet } from '../text/objects';
import { printWord } from '../text/word';
import type { Diagnostic, Document, FormalObject, MengeObj, ProcStep, StepTable, Sym, Word } from '../model/types';

type Ast =
  | { t: 'name'; name: string; s: number; e: number }
  | { t: 'lit'; words: Word[]; s: number; e: number }
  | { t: 'cat' | 'union'; l: Ast; r: Ast; s: number; e: number }
  | { t: 'pow'; x: Ast; k: number; s: number; e: number }
  | { t: 'star' | 'plus'; x: Ast; s: number; e: number };

class SyntaxFail extends Error {
  constructor(readonly diag: Diagnostic) {
    super('syntax');
  }
}

const NAME_START = /^[\p{L}\p{N}_']$/u;

function parseExpr(sc: Scanner): Ast {
  const fail = (expected: string[]): never => {
    const c = sc.peek();
    throw new SyntaxFail({
      severity: 'error',
      code: 'lang.syntax',
      params: { found: c, expected, col: sc.i + 1 },
    });
  };
  const ws = (): void => {
    while (sc.peek() !== '' && /^\s$/u.test(sc.peek())) sc.advance();
  };
  const atomStart = (): boolean => {
    const c = sc.peek();
    return c === '{' || c === '(' || c === '∅' || (c !== '' && NAME_START.test(c));
  };
  const atom = (): Ast => {
    ws();
    const s = sc.i;
    const c = sc.peek();
    if (c === '(') {
      sc.advance();
      const inner = union();
      ws();
      if (sc.peek() !== ')') fail(['")"']);
      sc.advance();
      return inner;
    }
    if (c === '{') {
      const words = readWordSet(sc) ?? [];
      const bad = sc.diagnostics.find((d) => d.severity === 'error');
      if (bad) {
        const p = bad.params as { found?: string; expected?: string[] };
        throw new SyntaxFail({
          severity: 'error',
          code: 'lang.syntax',
          params: { found: p.found ?? '', expected: p.expected ?? ['"}"'], col: bad.col ?? s + 1 },
        });
      }
      return { t: 'lit', words, s, e: sc.i };
    }
    if (c === '∅') {
      sc.advance();
      return { t: 'lit', words: [], s, e: sc.i };
    }
    if (c !== '' && NAME_START.test(c)) {
      while (sc.peek() !== '' && NAME_START.test(sc.peek())) sc.advance();
      return { t: 'name', name: sc.text.slice(s, sc.i), s, e: sc.i };
    }
    return fail(['Name', '"{"', '"("']);
  };
  const post = (): Ast => {
    let x = atom();
    for (;;) {
      ws();
      const c = sc.peek();
      if (c === '*' || c === '∗') {
        sc.advance();
        x = { t: 'star', x, s: x.s, e: sc.i };
      } else if (c === '+') {
        sc.advance();
        x = { t: 'plus', x, s: x.s, e: sc.i };
      } else if (c === '^') {
        sc.advance();
        ws();
        let d = '';
        while (/^[0-9]$/.test(sc.peek())) {
          d += sc.peek();
          sc.advance();
        }
        if (d === '') fail(['Zahl']);
        x = { t: 'pow', x, k: Number(d), s: x.s, e: sc.i };
      } else return x;
    }
  };
  const concat = (): Ast => {
    let x = post();
    for (;;) {
      ws();
      const c = sc.peek();
      if (c === '·' || c === '.') {
        sc.advance();
      } else if (!atomStart()) return x;
      const y = post();
      x = { t: 'cat', l: x, r: y, s: x.s, e: y.e };
    }
  };
  function union(): Ast {
    let x = concat();
    for (;;) {
      ws();
      const c = sc.peek();
      if (c !== '∪' && c !== '|') return x;
      sc.advance();
      const y = concat();
      x = { t: 'union', l: x, r: y, s: x.s, e: y.e };
    }
  }
  const ast = union();
  ws();
  if (!sc.eof()) fail(['Operator', 'Ende']);
  return ast;
}

// ---------------------------------------------------------------------------
// Auswertung

interface Val {
  words: Word[];
  /** null: vollständig; sonst vollständig nur bis zu dieser Länge. */
  cut: number | null;
  alphabet: Sym[];
}

class Fail extends Error {
  constructor(readonly diag: Diagnostic) {
    super('fail');
  }
}

const key = (w: Word): string => JSON.stringify(w);
const minCut = (a: number | null, b: number | null): number | null => (a === null ? b : b === null ? a : Math.min(a, b));
const mergeAlpha = (a: Sym[], b: Sym[]): Sym[] => [...new Set([...a, ...b])];

export function evalLang(
  expr: string,
  doc: Document,
  opts: { maxLen?: number; maxWords?: number; name?: string } = {},
): { result: MengeObj | null; diagnostics: Diagnostic[]; steps: ProcStep[] } {
  const maxLen = opts.maxLen ?? 6;
  const maxWords = opts.maxWords ?? 5000;
  const rec = new Rec(true);
  const diagnostics: Diagnostic[] = [];
  const sc = new Scanner(expr);
  let ast: Ast;
  try {
    ast = parseExpr(sc);
  } catch (e) {
    if (e instanceof SyntaxFail) return { result: null, diagnostics: [e.diag], steps: [] };
    throw e;
  }
  for (const d of sc.diagnostics) diagnostics.push(d); // Warnungen aus Mengenliteralen (Doppelte)

  // Namen auflösen
  const used: FormalObject[] = [];
  const unknown: Diagnostic[] = [];
  const walk = (n: Ast): void => {
    switch (n.t) {
      case 'name': {
        const o = doc.objects.find((x) => x.name === n.name);
        if (!o) unknown.push({ severity: 'error', code: 'lang.unknownName', params: { name: n.name, col: n.s + 1 } });
        else if (!used.includes(o)) used.push(o);
        return;
      }
      case 'cat':
      case 'union':
        walk(n.l);
        walk(n.r);
        return;
      case 'pow':
      case 'star':
      case 'plus':
        walk(n.x);
        return;
      default:
    }
  };
  walk(ast);
  if (unknown.length > 0) return { result: null, diagnostics: [...diagnostics, ...unknown], steps: [] };

  const text = (n: Ast): string => expr.slice(n.s, n.e).trim();
  const wt = (w: Word): string => printWord(w);

  const table = (words: Word[]): StepTable => {
    const shown = words.slice(0, 30);
    return {
      corner: '',
      colHead: ['w'],
      rowHead: shown.map((_, i) => String(i + 1)),
      cells: shown.map((w) => [wt(w)]),
    };
  };

  const checkSize = (n: number): void => {
    if (n > maxWords) throw new Fail({ severity: 'error', code: 'lang.tooLarge', params: { limit: maxWords } });
  };

  const sorted = (words: Word[], alphabet: Sym[]): Word[] => makeMenge('', words, alphabet).words;

  const cat = (a: Val, b: Val): Val => {
    const cut = minCut(a.cut, b.cut);
    if (a.words.length * b.words.length > 4_000_000) checkSize(Infinity);
    const seen = new Map<string, Word>();
    for (const u of a.words) {
      for (const v of b.words) {
        if (cut !== null && u.length + v.length > cut) continue;
        const w = [...u, ...v];
        seen.set(key(w), w);
        checkSize(seen.size);
      }
    }
    const alphabet = mergeAlpha(a.alphabet, b.alphabet);
    return { words: sorted([...seen.values()], alphabet), cut, alphabet };
  };

  const union = (a: Val, b: Val): Val => {
    const cut = minCut(a.cut, b.cut);
    const seen = new Map<string, Word>();
    for (const w of [...a.words, ...b.words]) if (cut === null || w.length <= cut) seen.set(key(w), w);
    checkSize(seen.size);
    const alphabet = mergeAlpha(a.alphabet, b.alphabet);
    return { words: sorted([...seen.values()], alphabet), cut, alphabet };
  };

  const unit = (alphabet: Sym[]): Val => ({ words: [[]], cut: null, alphabet });

  const power = (a: Val, k: number): Val => {
    let r = unit(a.alphabet);
    let base = a;
    let e = k;
    while (e > 0) {
      if (e & 1) r = cat(r, base);
      e = Math.floor(e / 2);
      if (e > 0) base = cat(base, base);
    }
    if (k === 0 && a.cut !== null) return { ...r, cut: null };
    return r;
  };

  const starBound = (a: Val): number => Math.min(maxLen, a.cut ?? Infinity);

  const closure = (a: Val, B: number): Val => {
    const nonEps = a.words.filter((w) => w.length > 0 && w.length <= B);
    const seen = new Map<string, Word>([[key([]), []]]);
    let frontier: Word[] = [[]];
    while (frontier.length > 0) {
      const next: Word[] = [];
      for (const u of frontier) {
        for (const v of nonEps) {
          if (u.length + v.length > B) continue;
          const w = [...u, ...v];
          const k = key(w);
          if (!seen.has(k)) {
            seen.set(k, w);
            checkSize(seen.size);
            next.push(w);
          }
        }
      }
      frontier = next;
    }
    return { words: sorted([...seen.values()], a.alphabet), cut: B, alphabet: a.alphabet };
  };

  const trivial = (a: Val): boolean => a.cut === null && a.words.every((w) => w.length === 0);

  const warnTrunc = (B: number): void => {
    if (!diagnostics.some((d) => d.code === 'lang.truncated' && (d.params as { upTo: number }).upTo === B)) {
      diagnostics.push({ severity: 'warning', code: 'lang.truncated', params: { upTo: B } });
    }
  };

  const step = (kind: string, params: Record<string, unknown>, words: Word[], tbl?: StepTable): void => {
    rec.add(`proc.lang.${kind}`, { ...params, size: words.length }, () => ({ table: tbl ?? table(words) }));
  };

  const ev = (n: Ast): Val => {
    switch (n.t) {
      case 'lit': {
        const alphabet = deriveAlphabet(n.words);
        const seen = new Map(n.words.map((w) => [key(w), w]));
        return { words: sorted([...seen.values()], alphabet), cut: null, alphabet };
      }
      case 'name': {
        const o = used.find((x) => x.name === n.name) as FormalObject;
        if (o.kind === 'menge') return { words: o.words.map((w) => w.slice()), cut: null, alphabet: [...o.alphabet] };
        if (toDea(o) === null) {
          throw new Fail({ severity: 'error', code: 'lang.notFinite', params: { name: o.name } });
        }
        const r = type3Words(o, maxLen, maxWords);
        if (r === 'invalid') throw new Fail({ severity: 'error', code: 'lang.notFinite', params: { name: o.name } });
        if (r === 'tooLarge') throw new Fail({ severity: 'error', code: 'lang.tooLarge', params: { limit: maxWords } });
        const alphabet = toDea(o)?.alphabet ?? [];
        if (!r.finite) warnTrunc(maxLen);
        return { words: r.words, cut: r.finite ? null : maxLen, alphabet };
      }
      case 'cat': {
        const a = ev(n.l);
        const b = ev(n.r);
        const r = cat(a, b);
        if (r.cut !== null && (a.cut === null || b.cut === null)) warnTrunc(r.cut);
        if (a.words.length <= 8 && b.words.length <= 8 && a.words.length > 0 && b.words.length > 0) {
          step(
            'concat',
            { left: text(n.l), right: text(n.r) },
            r.words,
            {
              corner: '·',
              colHead: b.words.map(wt),
              rowHead: a.words.map(wt),
              cells: a.words.map((u) => b.words.map((v) => wt([...u, ...v]))),
            },
          );
        } else step('concat', { left: text(n.l), right: text(n.r) }, r.words);
        return r;
      }
      case 'union': {
        const r = union(ev(n.l), ev(n.r));
        step('union', { left: text(n.l), right: text(n.r) }, r.words);
        return r;
      }
      case 'pow': {
        const a = ev(n.x);
        const r = power(a, n.k);
        step('power', { left: text(n.x), k: n.k }, r.words);
        return r;
      }
      case 'star':
      case 'plus': {
        const a = ev(n.x);
        let r: Val;
        if (trivial(a)) {
          r = n.t === 'star' ? { words: [[]], cut: null, alphabet: a.alphabet } : a;
        } else {
          const B = starBound(a);
          warnTrunc(B);
          const c = closure(a, B);
          r = n.t === 'star' ? c : cat(a, c);
          r = { ...r, cut: B };
        }
        step(n.t, { left: text(n.x) }, r.words);
        return r;
      }
    }
  };

  let val: Val;
  try {
    val = ev(ast);
  } catch (e) {
    if (e instanceof Fail) return { result: null, diagnostics: [...diagnostics, e.diag], steps: rec.steps };
    throw e;
  }
  const extra: { upTo?: number; origin: NonNullable<MengeObj['origin']> } = { origin: mkOrigin('sprachop', used) };
  if (val.cut !== null) extra.upTo = val.cut;
  const result = makeMenge(opts.name ?? 'L', val.words, val.alphabet, extra);
  return { result, diagnostics, steps: rec.steps };
}
