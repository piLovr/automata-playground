// Textsprache für Ausdruck und Grammatik: Lesen und Drucken eines Objekts.
import {
  declTokenToSym,
  declaredSymbols,
  isArrowAt,
  isEpsRaws,
  printGrammarDecl,
  printGrammarSide,
  readSide,
} from '../model/grammar';
import { parseRegexScanner, printRegex, regexSymbols } from '../model/regex';
import type { Document, EgrepObj, Grammar, Production, RegexObj, Sym, Word } from '../model/types';
import { Scanner } from './lexer';
import { newOriginAcc, parseEntspricht, parseHerkunft, printOrigin } from './origin';
import { readSymbol } from './word';
import { printSymbol } from './word';

function atListEnd(sc: Scanner): boolean {
  const c = sc.peek();
  return c === '' || c === '\n' || c === '}';
}

// ---------------------------------------------------------------------------
// Ausdruck

/** Kurzform: sc.i steht hinter dem Namen und `=`. */
export function parseRegexShort(sc: Scanner, name: string): RegexObj {
  const expr = parseRegexScanner(sc, { inDocument: true });
  sc.skipToLineEnd(false);
  return { kind: 'regex', name, alphabet: expr ? regexSymbols(expr) : [], expr };
}

/** Blockform: `{` ist gelesen. */
export function parseRegexBlock(sc: Scanner, name: string, braceAt: number): RegexObj {
  let alphabet: Sym[] | null = null;
  let expr: RegexObj['expr'] = null;
  let exprSeen = false;
  const acc = newOriginAcc();
  for (;;) {
    sc.skipWsAndComments();
    if (sc.eof()) {
      sc.report('syntax.unterminated', { what: 'object' }, braceAt, 1);
      break;
    }
    if (sc.peek() === '}') {
      sc.advance();
      break;
    }
    const stmtStart = sc.i;
    if (sc.peek() === '=') {
      sc.advance();
      if (exprSeen) {
        sc.report('syntax.duplicateStatement', { statement: '=' }, stmtStart, 1);
        sc.skipToLineEnd(true);
        continue;
      }
      exprSeen = true;
      expr = parseRegexScanner(sc, { inDocument: true, stopAtBrace: true });
      sc.skipToLineEnd(true);
      continue;
    }
    const word = sc.readStateName();
    switch (word) {
      case 'alphabet': {
        alphabet ??= [];
        for (;;) {
          sc.skipInline();
          if (atListEnd(sc)) break;
          const r = readSymbol(sc);
          if (!r) {
            sc.skipToLineEnd(true);
            break;
          }
          if (!alphabet.includes(r.sym)) alphabet.push(r.sym);
        }
        break;
      }
      case 'herkunft':
        parseHerkunft(sc, acc, stmtStart);
        break;
      case 'entspricht':
        parseEntspricht(sc, acc, stmtStart);
        break;
      default:
        sc.unexpected(['Anweisung']);
        sc.skipToLineEnd(true);
    }
  }
  const obj: RegexObj = {
    kind: 'regex',
    name,
    alphabet: alphabet ?? (expr ? regexSymbols(expr) : []),
    expr,
  };
  if (acc.origin) obj.origin = acc.origin;
  return obj;
}

export function printRegexObject(obj: RegexObj, opts: { origin: boolean }, doc?: Document): string {
  const syms = obj.expr ? regexSymbols(obj.expr) : [];
  const sameAlphabet = obj.alphabet.length === syms.length && obj.alphabet.every((s, i) => s === syms[i]);
  const withOrigin = opts.origin && obj.origin !== undefined;
  if (obj.expr && sameAlphabet && !withOrigin) return `regex ${obj.name} = ${printRegex(obj.expr)}\n`;
  const lines: string[] = [];
  if (!sameAlphabet) lines.push(('  alphabet ' + obj.alphabet.map(printSymbol).join(' ')).trimEnd());
  if (obj.expr) lines.push('  = ' + printRegex(obj.expr));
  if (withOrigin && obj.origin) for (const l of printOrigin(obj.origin, (id) => id, doc)) lines.push('  ' + l);
  return `regex ${obj.name} {\n${lines.map((l) => l + '\n').join('')}}\n`;
}

// ---------------------------------------------------------------------------
// Grammatik

interface ProdSpan {
  from: number;
  to: number;
}

/** Ende einer zeilengebundenen Anweisung: Zeilenende, `}` oder `#` (maskierte Zeichen zählen nicht). */
function statementEnd(sc: Scanner, from: number): number {
  let i = from;
  for (;;) {
    const c = sc.peekAt(i);
    if (c === '' || c === '\n' || c === '}' || c === '#') return i;
    if (c === '\\') {
      const n = sc.peekAt(i + 1);
      i += 1 + (n === '' || n === '\n' ? 0 : n.length);
    } else i += c.length;
  }
}

function readDeclTokens(sc: Scanner): Sym[] {
  const out: Sym[] = [];
  for (;;) {
    sc.skipInlineWs();
    if (atListEnd(sc) || sc.peek() === '#') break;
    const end = (() => {
      let i = sc.i;
      for (;;) {
        const c = sc.peekAt(i);
        if (c === '' || c === '}' || c === '#' || /^\s$/u.test(c)) return i;
        if (c === '\\') {
          const n = sc.peekAt(i + 1);
          i += 1 + (n === '' || n === '\n' ? 0 : n.length);
        } else i += c.length;
      }
    })();
    const tok = sc.text.slice(sc.i, end);
    sc.i = end;
    const s = declTokenToSym(tok);
    if (s !== '' && !out.includes(s)) out.push(s);
  }
  return out;
}

const G_KEYWORDS = ['nichtterminale', 'terminale', 'start', 'herkunft', 'entspricht'];

export function parseGrammarBlock(sc: Scanner, name: string, braceAt: number): Grammar {
  let declN: Sym[] | null = null;
  let declT: Sym[] | null = null;
  let declStart: Sym | null = null;
  let startSeen = false;
  const acc = newOriginAcc();
  const items: ({ kind: 'start'; sym: Sym } | ({ kind: 'prod' } & ProdSpan))[] = [];

  // Durchgang 1: Deklarationen einsammeln, Produktionszeilen merken.
  for (;;) {
    sc.skipWsAndComments();
    if (sc.eof()) {
      sc.report('syntax.unterminated', { what: 'object' }, braceAt, 1);
      break;
    }
    if (sc.peek() === '}') {
      sc.advance();
      break;
    }
    const stmtStart = sc.i;
    let k = sc.i;
    while (true) {
      const c = sc.peekAt(k);
      if (c === '' || c === '}' || c === '#' || /^\s$/u.test(c)) break;
      k += c.length;
    }
    const kw = sc.text.slice(stmtStart, k);
    let isKw = G_KEYWORDS.includes(kw);
    if (isKw && kw === 'start') {
      let j = k;
      while (sc.peekAt(j) !== '' && sc.peekAt(j) !== '\n' && /^\s$/u.test(sc.peekAt(j))) j++;
      if (isArrowAt(sc, j) > 0) isKw = false;
    }
    if (!isKw) {
      const to = statementEnd(sc, stmtStart);
      items.push({ kind: 'prod', from: stmtStart, to });
      sc.i = to;
      continue;
    }
    sc.i = k;
    switch (kw) {
      case 'nichtterminale': {
        declN ??= [];
        for (const s of readDeclTokens(sc)) if (!declN.includes(s)) declN.push(s);
        break;
      }
      case 'terminale': {
        declT ??= [];
        for (const s of readDeclTokens(sc)) if (!declT.includes(s)) declT.push(s);
        break;
      }
      case 'start': {
        const toks = readDeclTokens(sc);
        if (toks.length !== 1) {
          sc.unexpected(['Symbol']);
          sc.skipToLineEnd(true);
        } else if (startSeen) {
          sc.report('syntax.duplicateStatement', { statement: 'start' }, stmtStart, kw.length);
        } else {
          startSeen = true;
          declStart = toks[0] as Sym;
          items.push({ kind: 'start', sym: declStart });
        }
        break;
      }
      case 'herkunft':
        parseHerkunft(sc, acc, stmtStart);
        break;
      default:
        parseEntspricht(sc, acc, stmtStart);
    }
  }
  const endPos = sc.i;

  // Durchgang 2: Produktionen mit den Deklarationen lesen.
  const declared = declaredSymbols({ nonterminals: declN ?? [], terminals: declT ?? [] });
  const prods: { left: Word; right: Word }[] = [];
  const order: ({ kind: 'start'; sym: Sym } | { kind: 'prod'; left: Word; right: Word })[] = [];
  for (const it of items) {
    if (it.kind === 'start') {
      order.push(it);
      continue;
    }
    sc.i = it.from;
    const parsed = parseProduction(sc, declared, it.to);
    if (!parsed) continue;
    for (const right of parsed.rights) {
      prods.push({ left: parsed.left, right });
      order.push({ kind: 'prod', left: parsed.left, right });
    }
  }
  sc.i = endPos;

  // Mengen ableiten
  const isUpper = (s: Sym): boolean => /^\p{Lu}/u.test(s);
  let nonterminals: Sym[];
  if (declN !== null) nonterminals = declN;
  else {
    nonterminals = [];
    const add = (s: Sym): void => {
      if (!nonterminals.includes(s)) nonterminals.push(s);
    };
    for (const it of order) {
      if (it.kind === 'start') add(it.sym);
      else for (const s of [...it.left, ...it.right]) if (isUpper(s) && !(declT ?? []).includes(s)) add(s);
    }
  }
  let terminals: Sym[];
  if (declT !== null) terminals = declT;
  else {
    terminals = [];
    for (const p of prods) {
      for (const s of [...p.left, ...p.right]) if (!nonterminals.includes(s) && !terminals.includes(s)) terminals.push(s);
    }
  }
  let start: Sym | null = declStart;
  if (!startSeen) {
    const first = prods[0];
    start = first && first.left.length === 1 && nonterminals.includes(first.left[0] as Sym) ? (first.left[0] as Sym) : null;
  }
  const productions: Production[] = prods.map((p, i) => ({ id: `p${i}`, left: p.left, right: p.right }));
  const g: Grammar = { kind: 'grammatik', name, nonterminals, terminals, start, productions };
  if (acc.origin) g.origin = acc.origin;
  return g;
}

function parseProduction(sc: Scanner, declared: Sym[], end: number): { left: Word; rights: Word[] } | null {
  const left = readSide(sc, declared, end, true);
  if (!left) return null;
  while (sc.i < end && /^\s$/u.test(sc.peek())) sc.advance();
  const arrow = sc.i < end ? isArrowAt(sc, sc.i) : 0;
  if (arrow === 0) {
    if (sc.i >= end) sc.report('syntax.unexpected', { found: '', expected: ['"->"'] }, sc.i, 1);
    else sc.report('syntax.unexpected', { found: sc.peek(), expected: ['"->"'] }, sc.i, 1);
    return null;
  }
  if (left.syms.length === 0 || left.raws.includes('ε')) {
    sc.report('syntax.unexpected', { found: left.syms.length === 0 ? sc.text.slice(sc.i, sc.i + arrow) : 'ε', expected: ['Symbol'] }, sc.i, arrow);
    return null;
  }
  sc.i += arrow;
  const rights: Word[] = [];
  for (;;) {
    const altStart = sc.i;
    const item = readSide(sc, declared, end, false);
    if (!item) return null;
    if (isEpsRaws(item.raws)) rights.push([]);
    else if (item.raws.includes('ε') || item.syms.length === 0) {
      sc.report('syntax.unexpected', { found: item.syms.length === 0 ? '' : 'ε', expected: ['Symbol', 'ε'] }, altStart, 1);
      return null;
    } else rights.push(item.syms);
    if (sc.i < end && sc.peek() === '|') {
      sc.advance();
      continue;
    }
    break;
  }
  return { left: left.syms, rights };
}

export function printGrammarObject(g: Grammar, opts: { origin: boolean }, doc?: Document): string {
  const lines: string[] = [];
  if (g.nonterminals.length > 0) lines.push('  nichtterminale ' + g.nonterminals.map(printGrammarDecl).join(' '));
  if (g.terminals.length > 0) lines.push('  terminale ' + g.terminals.map(printGrammarDecl).join(' '));
  if (g.start !== null) lines.push('  start ' + printGrammarDecl(g.start));
  const groups = new Map<string, { left: Word; rights: Word[] }>();
  for (const p of g.productions) {
    const key = JSON.stringify(p.left);
    let grp = groups.get(key);
    if (!grp) {
      grp = { left: p.left, rights: [] };
      groups.set(key, grp);
    }
    grp.rights.push(p.right);
  }
  for (const grp of groups.values()) {
    const left = printGrammarSide(grp.left, g);
    lines.push(`  ${left} -> ${grp.rights.map((r) => printGrammarSide(r, g)).join(' | ')}`);
  }
  if (opts.origin && g.origin) for (const l of printOrigin(g.origin, (id) => id, doc)) lines.push('  ' + l);
  return `grammatik ${g.name} {\n${lines.map((l) => l + '\n').join('')}}\n`;
}

// ---------------------------------------------------------------------------
// egrep-Regex: das Muster ist der Rest der Zeile, roh (kein Kommentar, `}` gehört dazu)

function readRawPattern(sc: Scanner): string {
  const start = sc.i;
  while (!sc.eof() && sc.peek() !== '\n') sc.advance();
  return sc.text.slice(start, sc.i).trim();
}

/** Kurzform: sc.i steht hinter dem Namen und `=`. */
export function parseEgrepShort(sc: Scanner, name: string): EgrepObj {
  return { kind: 'egrep', name, pattern: readRawPattern(sc), alphabet: [] };
}

/** Blockform: `{` ist gelesen. */
export function parseEgrepBlock(sc: Scanner, name: string, braceAt: number): EgrepObj {
  const alphabet: Sym[] = [];
  let pattern = '';
  let patternSeen = false;
  const acc = newOriginAcc();
  for (;;) {
    sc.skipWsAndComments();
    if (sc.eof()) {
      sc.report('syntax.unterminated', { what: 'object' }, braceAt, 1);
      break;
    }
    if (sc.peek() === '}') {
      sc.advance();
      break;
    }
    const stmtStart = sc.i;
    if (sc.peek() === '=') {
      sc.advance();
      const p = readRawPattern(sc);
      if (patternSeen) sc.report('syntax.duplicateStatement', { statement: '=' }, stmtStart, 1);
      else {
        patternSeen = true;
        pattern = p;
      }
      continue;
    }
    const word = sc.readStateName();
    switch (word) {
      case 'alphabet':
        for (;;) {
          sc.skipInline();
          if (atListEnd(sc)) break;
          const r = readSymbol(sc);
          if (!r) {
            sc.skipToLineEnd(true);
            break;
          }
          if (!alphabet.includes(r.sym)) alphabet.push(r.sym);
        }
        break;
      case 'herkunft':
        parseHerkunft(sc, acc, stmtStart);
        break;
      case 'entspricht':
        parseEntspricht(sc, acc, stmtStart);
        break;
      default:
        sc.unexpected(['Anweisung']);
        sc.skipToLineEnd(true);
    }
  }
  const obj: EgrepObj = { kind: 'egrep', name, pattern, alphabet };
  if (acc.origin) obj.origin = acc.origin;
  return obj;
}

export function printEgrepObject(obj: EgrepObj, opts: { origin: boolean }, doc?: Document): string {
  const withOrigin = opts.origin && obj.origin !== undefined;
  if (obj.alphabet.length === 0 && !withOrigin) return `egrep ${obj.name} =${obj.pattern === '' ? '' : ' ' + obj.pattern}\n`;
  const lines: string[] = [];
  if (obj.alphabet.length > 0) lines.push('  alphabet ' + obj.alphabet.map(printSymbol).join(' '));
  lines.push(obj.pattern === '' ? '  =' : '  = ' + obj.pattern);
  if (withOrigin && obj.origin) for (const l of printOrigin(obj.origin, (id) => id, doc)) lines.push('  ' + l);
  return `egrep ${obj.name} {\n${lines.map((l) => l + '\n').join('')}}\n`;
}
