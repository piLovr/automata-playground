// Grammatik (2.34): Symbolerkennung, Wörter, Typ-Erkennung, Prüfung.
import { Scanner, isIdentChar } from '../text/lexer';
import { readSymbol } from '../text/word';
import type { Diagnostic, Grammar, GrammarTypeInfo, Production, Sym, Word } from './types';

type Decl = Pick<Grammar, 'nonterminals' | 'terminals'>;

/** Deklarierte Symbole, längste zuerst (für die Längste-Übereinstimmung-Regel). */
export function declaredSymbols(g: Decl): Sym[] {
  const all = [...new Set([...g.nonterminals, ...g.terminals])].filter((s) => s !== '');
  return all.sort((a, b) => b.length - a.length);
}

/** Einzelzeichen, die in Produktionen nicht unmaskiert als Symbol stehen können (`-` und `|` gesondert). */
const NOT_PLAIN = new Set([',', '<', '>', '#', '\\', '{', '}', 'ε']);

export function isArrowAt(sc: Scanner, i: number): number {
  if (sc.text.startsWith('->', i)) return 2;
  if (sc.text.startsWith('→', i)) return 1;
  return 0;
}

/**
 * Liest ein Symbol einer Grammatikseite ab sc.i (Leerraum, `|` und Pfeil muss der Aufrufer vorher erkannt haben).
 * `end`: exklusive Obergrenze (Zeilenende). `ε` kommt als Symbol 'ε' mit raw 'ε' zurück.
 */
export function readGrammarSymbol(
  sc: Scanner,
  declared: Sym[],
  end: number,
): { sym: Sym; raw: string } | null {
  const c = sc.peek();
  if (c === '\\' || c === '<') return readSymbol(sc);
  for (const d of declared) {
    if (sc.i + d.length <= end && sc.text.startsWith(d, sc.i) && !/\s/u.test(d) && !d.includes('|')) {
      if (d.startsWith('\\') || d.startsWith('<')) continue;
      sc.i += d.length;
      return { sym: d, raw: d };
    }
  }
  if (c === 'ε') {
    sc.advance();
    return { sym: 'ε', raw: 'ε' };
  }
  if (NOT_PLAIN.has(c)) {
    sc.report('syntax.unexpected', { found: c, expected: ['Symbol'] }, sc.i, c.length);
    return null;
  }
  sc.advance();
  return { sym: c, raw: c };
}

export interface SideItem {
  syms: Word;
  raws: string[];
}

/**
 * Liest Symbole einer Seite bis `|`, Pfeil oder `end`. Leerraum wird ignoriert.
 * null bei Fehler (gemeldet).
 */
export function readSide(sc: Scanner, declared: Sym[], end: number, stopAtArrow: boolean): SideItem | null {
  const syms: Word = [];
  const raws: string[] = [];
  for (;;) {
    while (sc.i < end && /^\s$/u.test(sc.peek())) sc.advance();
    if (sc.i >= end) break;
    const c = sc.peek();
    if (c === '|') break;
    if (isArrowAt(sc, sc.i) > 0) {
      if (stopAtArrow) break;
      sc.report('syntax.unexpected', { found: c === '→' ? '→' : '->', expected: ['Symbol', '"|"'] }, sc.i, 1);
      return null;
    }
    const r = readGrammarSymbol(sc, declared, end);
    if (!r) return null;
    syms.push(r.sym);
    raws.push(r.raw);
  }
  return { syms, raws };
}

/** true, wenn die Rohsymbole die ganze Alternative `ε`/`eps` bilden. */
export function isEpsRaws(raws: string[]): boolean {
  const j = raws.join('');
  return j === 'ε' || j === 'eps';
}

// ---------------------------------------------------------------------------
// Drucken

const ESC = new Set(['|', '\\', '<', '>', '#', '{', '}', ',', 'ε', '→']);

function printPlainSym(s: Sym, bracket: boolean): string {
  const chars = [...s];
  if (chars.length === 1) {
    const c = chars[0] as string;
    if (bracket && isIdentChar(c)) return '<' + c + '>';
    if (ESC.has(c) || /\s/u.test(c)) return '\\' + c;
    return c;
  }
  if (chars.every(isIdentChar)) return bracket ? '<' + s + '>' : s;
  return chars.map((c) => (ESC.has(c) || /\s/u.test(c) ? '\\' + c : c)).join('');
}

function readBack(text: string, declared: Sym[]): Word | null {
  const sc = new Scanner(text);
  const item = readSide(sc, declared, text.length, false);
  if (!item || sc.diagnostics.length > 0) return null;
  return isEpsRaws(item.raws) ? [] : item.syms;
}

/** Eine Seite (links oder eine rechte Alternative) als Text; [] → `ε`. */
export function printGrammarSide(w: Word, g: Decl): string {
  if (w.length === 0) return 'ε';
  const declared = declaredSymbols(g);
  const plain = w.map((s) => printPlainSym(s, false)).join('');
  const back = readBack(plain, declared);
  if (back && back.length === w.length && back.every((s, i) => s === w[i])) return plain;
  return w.map((s) => printPlainSym(s, true)).join('');
}

/** Deklaration (`nichtterminale`, `terminale`, `start`): ein Token je Symbol. */
export function printGrammarDecl(s: Sym): string {
  return [...s].map((c) => (/\s/u.test(c) || c === '\\' || c === '#' || c === '{' || c === '}' || c === '<' || c === '>' ? '\\' + c : c)).join('');
}

/** Liest ein Deklarationstoken (ohne Maskierung des Gesamtausdrucks) zu einem Symbol. */
export function declTokenToSym(tok: string): Sym {
  const m = /^<([\p{L}\p{N}_]+)>$/u.exec(tok);
  if (m) return m[1] as string;
  let out = '';
  const chars = [...tok];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === '\\' && i + 1 < chars.length) i++;
    out += chars[i];
  }
  return out;
}

export function parseGrammarWord(text: string, g: Decl): { word: Word; diagnostics: Diagnostic[] } {
  const t = text.trim();
  if (t === 'ε' || t === 'eps') return { word: [], diagnostics: [] };
  const sc = new Scanner(text);
  const declared = declaredSymbols(g);
  const word: Word = [];
  for (;;) {
    while (!sc.eof() && /^\s$/u.test(sc.peek())) sc.advance();
    if (sc.eof()) break;
    const at = sc.i;
    const r = readGrammarSymbol(sc, declared, text.length);
    if (r) word.push(r.sym);
    else if (sc.i === at) sc.advance();
  }
  return { word, diagnostics: sc.diagnostics };
}

export function printGrammarWord(w: Word, g: Decl): string {
  return printGrammarSide(w, g);
}

// ---------------------------------------------------------------------------
// Typ-Erkennung (2.45, 5.1)

export function grammarType(g: Grammar): GrammarTypeInfo {
  const N = new Set(g.nonterminals);
  const onRight = new Set<Sym>();
  for (const p of g.productions) for (const s of p.right) onRight.add(s);
  const isStartEps = (p: Production): boolean =>
    g.start !== null && p.left.length === 1 && p.left[0] === g.start && p.right.length === 0 && !onRight.has(g.start);

  const rightLinear = (p: Production): boolean => {
    if (p.left.length !== 1 || !N.has(p.left[0] as Sym)) return false;
    for (let i = 0; i < p.right.length - 1; i++) if (N.has(p.right[i] as Sym)) return false;
    return true;
  };

  // 5.1: uXv → uwv mit u, v ∈ V*, X ∈ N, w ∈ V+
  const contextSensitive = (p: Production): boolean => {
    const l = p.left;
    const r = p.right;
    if (r.length < l.length || r.length === 0) return false;
    for (let i = 0; i < l.length; i++) {
      if (!N.has(l[i] as Sym)) continue;
      const v = l.length - i - 1;
      let ok = true;
      for (let k = 0; k < i && ok; k++) if (l[k] !== r[k]) ok = false;
      for (let k = 0; k < v && ok; k++) if (l[l.length - 1 - k] !== r[r.length - 1 - k]) ok = false;
      if (ok && r.length - i - v >= 1) return true;
    }
    return false;
  };

  const per: GrammarTypeInfo['productions'] = g.productions.map((p) => {
    if (rightLinear(p)) return { id: p.id, type: 3, reason: 'rightLinear' };
    if (p.left.length === 1 && N.has(p.left[0] as Sym)) return { id: p.id, type: 2, reason: 'contextFree' };
    if (contextSensitive(p)) return { id: p.id, type: 1, reason: 'contextSensitive' };
    if (isStartEps(p)) return { id: p.id, type: 1, reason: 'startEpsilon' };
    if (p.left.length <= p.right.length) return { id: p.id, type: 0, reason: 'nonShrinking' };
    return { id: p.id, type: 0, reason: 'shrinking' };
  });

  let type: 0 | 1 | 2 | 3;
  if (per.every((x) => x.type === 3)) type = 3;
  else if (per.every((x) => x.type >= 2)) type = 2;
  else if (g.productions.every((p) => (p.right.length > 0 && contextSensitive(p)) || isStartEps(p))) type = 1;
  else type = 0;
  const startEpsilonRule = type === 1 && g.productions.some(isStartEps);
  const nonContracting = g.productions.every((p) => (p.right.length > 0 && p.left.length <= p.right.length) || isStartEps(p));
  return { type, productions: per, startEpsilonRule, nonContracting };
}

// ---------------------------------------------------------------------------
// Prüfung

export function validateGrammar(g: Grammar): Diagnostic[] {
  const out: Diagnostic[] = [];
  const base = { objectName: g.name } as const;
  const N = new Set(g.nonterminals);
  const T = new Set(g.terminals);
  if (g.start === null) {
    if (g.productions.length > 0) out.push({ severity: 'error', code: 'grammar.noStart', params: {}, ...base });
  } else if (!N.has(g.start)) {
    out.push({ severity: 'error', code: 'grammar.startNotNonterminal', params: { symbol: g.start }, ...base });
  }
  const overlap = g.nonterminals.filter((s) => T.has(s));
  if (overlap.length > 0) out.push({ severity: 'error', code: 'grammar.overlap', params: { symbols: overlap }, ...base });
  for (const p of g.productions) {
    if (!p.left.some((s) => N.has(s))) {
      out.push({ severity: 'error', code: 'grammar.leftNoNonterminal', params: { productionId: p.id }, ...base });
    }
    const reported = new Set<Sym>();
    for (const s of [...p.left, ...p.right]) {
      if (!N.has(s) && !T.has(s) && !reported.has(s)) {
        reported.add(s);
        out.push({
          severity: 'error',
          code: 'grammar.unknownSymbol',
          params: { symbol: s, productionId: p.id },
          ...base,
        });
      }
    }
  }
  return out;
}
