// Symbol- und Wortregeln der Textsprache (gemeinsam für Text und Stapellauf).
import type { Diagnostic, Sym, Word } from '../model/types';
import { Scanner, isIdentChar, isSpecialSymbolChar } from './lexer';

/** Anzahl Codepoints. */
function cpLength(s: string): number {
  let n = 0;
  for (const _c of s) {
    void _c;
    n++;
  }
  return n;
}

export function printSymbol(s: Sym): string {
  if (cpLength(s) === 1) {
    if (isSpecialSymbolChar(s) || /\s/u.test(s)) return '\\' + s;
    return s;
  }
  return '<' + s + '>';
}

export function printWord(w: Word): string {
  if (w.length === 0) return 'ε';
  const text = w.map(printSymbol).join('');
  return text === 'eps' ? '\\eps' : text;
}

/** Liest ein Symbol an der aktuellen Position; meldet Fehler selbst und gibt dann null zurück. */
export function readSymbol(sc: Scanner): { sym: Sym; raw: string } | null {
  const start = sc.i;
  const c = sc.peek();
  if (c === '') return null;
  if (c === '\\') {
    sc.advance();
    const n = sc.peek();
    if (n === '' || n === '\n') {
      sc.report('syntax.badEscape', { char: n }, start, 1);
      return null;
    }
    sc.advance();
    return { sym: n, raw: '\\' + n };
  }
  if (c === '<') {
    sc.advance();
    let id = '';
    while (isIdentChar(sc.peek())) {
      id += sc.peek();
      sc.advance();
    }
    if (id === '' || sc.peek() !== '>') {
      sc.report('syntax.unterminated', { what: 'symbol' }, start, sc.i - start);
      return null;
    }
    sc.advance();
    return { sym: id, raw: '<' + id + '>' };
  }
  if (isSpecialSymbolChar(c) || /\s/u.test(c)) {
    sc.report('syntax.unexpected', { found: c, expected: ['Symbol'] }, start, c.length);
    return null;
  }
  sc.advance();
  return { sym: c, raw: c };
}

export function parseWord(input: string): { word: Word; diagnostics: Diagnostic[] } {
  const trimmed = input.trim();
  if (trimmed === 'ε' || trimmed === 'eps') return { word: [], diagnostics: [] };
  const sc = new Scanner(input);
  const word: Word = [];
  for (;;) {
    while (!sc.eof() && /\s/u.test(sc.peek())) sc.advance();
    if (sc.eof()) break;
    const r = readSymbol(sc);
    if (r) word.push(r.sym);
    else if (!sc.eof()) sc.advance();
  }
  return { word, diagnostics: sc.diagnostics };
}
