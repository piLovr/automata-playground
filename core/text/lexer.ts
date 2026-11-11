// Zeichenleser mit Positionsverwaltung für die Textsprache.
import type { Diagnostic, DiagnosticCode } from '../model/types';

/** Anweisungen aller Typen; welche für einen Typ gelten, steht in der Kind-Registry (`keywords`). */
export const COMMON_KEYWORDS = ['alphabet', 'states', 'start', 'accept', 'layout'] as const;
export const KEYWORDS = [
  ...COMMON_KEYWORDS,
  'ausgabealphabet',
  'out',
  'keller',
  'kelleralphabet',
  'bandalphabet',
  'blank',
  'reject',
  'akzeptanz',
] as const;

const SPECIAL = new Set(['-', ',', '<', '>', '#', '\\', '{', '}', 'ε']);

export function isSpecialSymbolChar(c: string): boolean {
  return SPECIAL.has(c);
}
export function isIdentChar(c: string): boolean {
  return c !== '' && /^[\p{L}\p{N}_]$/u.test(c);
}
export function isStateStart(c: string): boolean {
  return c !== '' && (c === '∅' || /^[\p{L}\p{N}_+']$/u.test(c));
}
export function isStateChar(c: string): boolean {
  return c === '-' || c === '\u2212' || isStateStart(c);
}
export function isInlineWs(c: string): boolean {
  return c !== '' && c !== '\n' && /^\s$/u.test(c);
}

export class Scanner {
  i = 0;
  objectName: string | undefined = undefined;
  readonly diagnostics: Diagnostic[] = [];
  private readonly lineStarts: number[] = [0];

  constructor(readonly text: string) {
    for (let k = 0; k < text.length; k++) if (text[k] === '\n') this.lineStarts.push(k + 1);
  }

  eof(): boolean {
    return this.i >= this.text.length;
  }
  /** Zeichen (Codepoint) an der aktuellen Position; '' am Ende. */
  peek(): string {
    return this.peekAt(this.i);
  }
  peekAt(i: number): string {
    const cp = this.text.codePointAt(i);
    return cp === undefined ? '' : String.fromCodePoint(cp);
  }
  startsWith(s: string): boolean {
    return this.text.startsWith(s, this.i);
  }
  advance(): void {
    const c = this.peek();
    this.i += c === '' ? 0 : c.length;
  }

  loc(offset: number): { line: number; col: number } {
    let lo = 0;
    let hi = this.lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((this.lineStarts[mid] ?? 0) <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, col: offset - (this.lineStarts[lo] ?? 0) + 1 };
  }

  report(
    code: DiagnosticCode,
    params: Record<string, unknown>,
    start: number,
    length: number,
    severity: 'error' | 'warning' = 'error',
  ): void {
    const { line, col } = this.loc(start);
    const d: Diagnostic = { severity, code, params, line, col, length };
    if (this.objectName !== undefined) d.objectName = this.objectName;
    this.diagnostics.push(d);
  }

  /** Meldet "unerwartet" an der aktuellen Position. */
  unexpected(expected: string[]): void {
    const c = this.peek();
    const found = c === '' ? '' : c;
    this.report('syntax.unexpected', { found, expected }, this.i, c.length);
  }

  skipInlineWs(): void {
    while (isInlineWs(this.peek())) this.advance();
  }
  /** Leerraum und Kommentare innerhalb einer Zeile (Kommentar bis Zeilenende, Zeilenende bleibt). */
  skipInline(): void {
    for (;;) {
      this.skipInlineWs();
      if (this.peek() === '#') {
        while (!this.eof() && this.peek() !== '\n') this.advance();
      } else return;
    }
  }
  skipWsAndComments(): void {
    for (;;) {
      const c = this.peek();
      if (c !== '' && /^\s$/u.test(c)) this.advance();
      else if (c === '#') {
        while (!this.eof() && this.peek() !== '\n') this.advance();
      } else return;
    }
  }
  /** Überspringt bis zum Zeilenende oder (optional) bis vor das nächste `}`. */
  skipToLineEnd(stopAtBrace: boolean): void {
    while (!this.eof() && this.peek() !== '\n') {
      if (stopAtBrace && this.peek() === '}') return;
      this.advance();
    }
  }
  readStateName(): string {
    if (!isStateStart(this.peek())) return '';
    const start = this.i;
    while (isStateChar(this.peek())) this.advance();
    return this.text.slice(start, this.i);
  }
}
