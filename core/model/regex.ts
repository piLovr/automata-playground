// Regulärer Ausdruck (2.21): Parser, Printer, Hilfsfunktionen.
import { Scanner, isSpecialSymbolChar } from '../text/lexer';
import { readSymbol } from '../text/word';
import type { Diagnostic, ExprPath, RegExpr, RegexObj, Sym } from './types';

// ---------------------------------------------------------------------------
// Hilfsfunktionen

/** Symbole in Reihenfolge des ersten Auftretens (Vorordnung: links vor rechts). */
export function regexSymbols(e: RegExpr): Sym[] {
  const out: Sym[] = [];
  const seen = new Set<Sym>();
  const walk = (x: RegExpr): void => {
    switch (x.op) {
      case 'empty':
        return;
      case 'sym':
        if (!seen.has(x.sym)) {
          seen.add(x.sym);
          out.push(x.sym);
        }
        return;
      case 'star':
        walk(x.inner);
        return;
      default:
        walk(x.left);
        walk(x.right);
    }
  };
  walk(e);
  return out;
}

/** Anzahl Knoten des Syntaxbaums. */
export function regexSize(e: RegExpr): number {
  switch (e.op) {
    case 'empty':
    case 'sym':
      return 1;
    case 'star':
      return 1 + regexSize(e.inner);
    default:
      return 1 + regexSize(e.left) + regexSize(e.right);
  }
}

export function subexprAt(e: RegExpr, path: ExprPath): RegExpr | null {
  let cur: RegExpr = e;
  for (const i of path) {
    if (cur.op === 'star') {
      if (i !== 0) return null;
      cur = cur.inner;
    } else if (cur.op === 'union' || cur.op === 'concat') {
      if (i === 0) cur = cur.left;
      else if (i === 1) cur = cur.right;
      else return null;
    } else return null;
  }
  return cur;
}

// ---------------------------------------------------------------------------
// Printer

/** Symbol im Ausdruck: wie in der Textsprache, zusätzlich | ( ) * ∅ maskiert. */
export function printRegexSymbol(s: Sym): string {
  if ([...s].length === 1) {
    if (isSpecialSymbolChar(s) || /\s/u.test(s) || '|()*∅'.includes(s)) return '\\' + s;
    return s;
  }
  return '<' + s + '>';
}

// Präzedenzstufen: 1 Vereinigung, 2 Konkatenation, 3 Stern, 4 atomar
function level(e: RegExpr): number {
  switch (e.op) {
    case 'union':
      return 1;
    case 'concat':
      return 2;
    case 'star':
      return 3;
    default:
      return 4;
  }
}

/** Druck mit Teilausdrucks-Bereichen (inklusive eigener Klammern). */
function printWithSpans(
  e: RegExpr,
  strict: boolean,
): { text: string; spans: { path: ExprPath; from: number; to: number }[] } {
  const spans: { path: ExprPath; from: number; to: number }[] = [];
  let text = '';
  // wrap: Klammern um diesen Knoten (Standardform nur wenn nötig, strenge Form bei jedem Operator).
  const emit = (x: RegExpr, path: ExprPath, wrapStd: boolean): void => {
    const from = text.length;
    const wrap = strict ? x.op !== 'empty' && x.op !== 'sym' : wrapStd;
    if (wrap) text += '(';
    switch (x.op) {
      case 'empty':
        text += '∅';
        break;
      case 'sym':
        text += printRegexSymbol(x.sym);
        break;
      case 'star':
        emit(x.inner, [...path, 0], level(x.inner) < 3);
        text += '*';
        break;
      case 'union':
        emit(x.left, [...path, 0], false);
        text += '|';
        emit(x.right, [...path, 1], level(x.right) < 2);
        break;
      case 'concat':
        emit(x.left, [...path, 0], level(x.left) < 2);
        emit(x.right, [...path, 1], level(x.right) < 3);
        break;
    }
    if (wrap) text += ')';
    spans.push({ path, from, to: text.length });
  };
  emit(e, [], false);
  spans.sort((a, b) => a.from - b.from || b.to - a.to);
  return { text, spans };
}

export function printRegex(e: RegExpr, opts: { strict?: boolean } = {}): string {
  return printWithSpans(e, opts.strict === true).text;
}

export function regexSpans(
  e: RegExpr,
  opts: { strict?: boolean } = {},
): { path: ExprPath; from: number; to: number }[] {
  return printWithSpans(e, opts.strict === true).spans;
}

// ---------------------------------------------------------------------------
// Parser

export interface RegexParseOptions {
  /** true: Ausdruck endet am Zeilenende, bei `#` oder (Blockform) bei `}`. */
  inDocument: boolean;
  /** Blockform: auch `}` beendet den Ausdruck. */
  stopAtBrace?: boolean;
  /** Wird für jedes gelesene Symbol aufgerufen (Position im Text). */
  onSymbol?: (sym: Sym, at: number, len: number) => void;
}

/** Liest einen Ausdruck ab sc.i. Meldungen laufen über den Scanner (Zeile/Spalte). null bei Syntaxfehlern oder leerem Ausdruck. */
export function parseRegexScanner(sc: Scanner, o: RegexParseOptions): RegExpr | null {
  let errors = 0;
  const err = (
    code: 'regex.missingOperand' | 'regex.emptyParens' | 'regex.unbalanced',
    params: Record<string, unknown>,
    at: number,
    len: number,
  ): void => {
    errors++;
    sc.report(code, params, at, len);
  };
  const unclosed: number[] = [];

  const atEnd = (): boolean => {
    const c = sc.peek();
    if (c === '') return true;
    if (o.inDocument && (c === '\n' || c === '#')) return true;
    if (o.inDocument && o.stopAtBrace === true && c === '}') return true;
    return false;
  };
  const skipWs = (): void => {
    while (!atEnd() && /^\s$/u.test(sc.peek())) sc.advance();
  };

  /** Atom (Symbol, ∅, ε, Klammerausdruck) oder null, wenn hier keiner beginnt (Position bleibt). */
  const parseAtom = (): RegExpr | null => {
    skipWs();
    if (atEnd()) return null;
    const at = sc.i;
    const c = sc.peek();
    if (c === '(') {
      sc.advance();
      skipWs();
      if (sc.peek() === ')' && !atEnd()) {
        err('regex.emptyParens', {}, at, sc.i + 1 - at);
        sc.advance();
        return { op: 'empty' };
      }
      const inner = parseUnion(true);
      skipWs();
      if (!atEnd() && sc.peek() === ')') {
        sc.advance();
      } else {
        unclosed.push(at);
      }
      return inner ?? { op: 'empty' };
    }
    if (c === '∅') {
      sc.advance();
      return { op: 'empty' };
    }
    if (c === 'ε') {
      sc.advance();
      return { op: 'star', inner: { op: 'empty' } };
    }
    if (c === '\\') {
      const n = sc.peekAt(sc.i + 1);
      if (n === '0') {
        sc.i += 2;
        return { op: 'empty' };
      }
      if (n === 'e') {
        sc.i += 2;
        return { op: 'star', inner: { op: 'empty' } };
      }
    }
    if (c === '|' || c === ')' || c === '*') return null;
    const r = readSymbol(sc);
    if (!r) {
      errors++;
      if (sc.i === at) sc.advance();
      return { op: 'empty' };
    }
    o.onSymbol?.(r.sym, at, sc.i - at);
    return { op: 'sym', sym: r.sym };
  };

  const parseStarred = (): RegExpr | null => {
    let a = parseAtom();
    if (a === null) return null;
    for (;;) {
      skipWs();
      if (!atEnd() && sc.peek() === '*') {
        sc.advance();
        a = { op: 'star', inner: a };
      } else return a;
    }
  };

  const parseConcat = (): RegExpr | null => {
    let acc: RegExpr | null = null;
    for (;;) {
      skipWs();
      if (atEnd()) return acc;
      if (sc.peek() === '*') {
        // Stern ohne Operanden davor
        err('regex.missingOperand', { op: '*', side: 'left' }, sc.i, 1);
        sc.advance();
        continue;
      }
      const next = parseStarred();
      if (next === null) return acc;
      acc = acc === null ? next : { op: 'concat', left: acc, right: next };
    }
  };

  const parseUnion = (inParens: boolean): RegExpr | null => {
    let acc: RegExpr | null = null;
    let first = true;
    let barAt = -1; // Position des vorigen `|`
    for (;;) {
      const operand = parseConcat();
      skipWs();
      const stop = atEnd() ? '' : sc.peek();
      if (operand === null) {
        if (!first) {
          // hinter dem vorigen `|` fehlt der rechte Operand
          err('regex.missingOperand', { op: '|', side: 'right' }, barAt, 1);
        } else if (stop === '|') {
          err('regex.missingOperand', { op: '|', side: 'left' }, sc.i, 1);
        }
      } else {
        acc = acc === null ? operand : { op: 'union', left: acc, right: operand };
      }
      if (stop === '|') {
        barAt = sc.i;
        sc.advance();
        first = false;
        continue;
      }
      if (stop === ')' && !inParens) {
        errors++;
        sc.report('regex.unbalanced', { open: 0 }, sc.i, 1);
        sc.advance();
        continue;
      }
      return acc;
    }
  };

  // Leerer Ausdruck ohne Zeichen: null ohne Meldung.
  skipWs();
  const top = parseUnion(false);
  // Rest (z. B. nicht erwartetes Zeichen) – parseUnion läuft bis zum Ende, daher hier nichts mehr
  if (unclosed.length > 0) {
    errors++;
    const outer = unclosed[unclosed.length - 1] as number;
    sc.report('regex.unbalanced', { open: unclosed.length }, outer, 1);
  }
  return errors > 0 ? null : top;
}

/** Ausdruck aus Text (Editor, einzeilig oder mehrzeilig; Leerraum wird ignoriert). */
export function parseRegex(
  text: string,
  alphabet?: Sym[] | null,
): { expr: RegExpr | null; diagnostics: Diagnostic[] } {
  const sc = new Scanner(text);
  const first = new Map<Sym, { at: number; len: number }>();
  const expr = parseRegexScanner(sc, {
    inDocument: false,
    onSymbol: (sym, at, len) => {
      if (!first.has(sym)) first.set(sym, { at, len });
    },
  });
  if (expr !== null && alphabet) {
    const A = new Set(alphabet);
    for (const s of regexSymbols(expr)) {
      if (A.has(s)) continue;
      const d: Diagnostic = { severity: 'error', code: 'regex.symbolNotInAlphabet', params: { symbol: s } };
      const f = first.get(s);
      if (f) {
        const { line, col } = sc.loc(f.at);
        d.line = line;
        d.col = col;
        d.length = f.len;
      }
      sc.diagnostics.push(d);
    }
  }
  return { expr, diagnostics: sc.diagnostics };
}

/** Prüfung eines Ausdrucks gegen sein Alphabet. */
export function validateRegex(r: RegexObj): Diagnostic[] {
  const base = { objectName: r.name } as const;
  if (r.expr === null) return [{ severity: 'warning', code: 'regex.noExpr', params: {}, ...base }];
  const A = new Set(r.alphabet);
  return regexSymbols(r.expr)
    .filter((s) => !A.has(s))
    .map((s): Diagnostic => ({ severity: 'error', code: 'regex.symbolNotInAlphabet', params: { symbol: s }, ...base }));
}
