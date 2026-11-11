// Toleranter Parser der Textsprache.
import { findKindByKeyword, parseMove } from '../model/kinds';
import type { AnyLabel, Extras, KindSpec } from '../model/kinds';
import type { Automaton, Diagnostic, Document, FormalObject, NkaLabel, Point, State, Sym, TmLabel, Transition, Word } from '../model/types';
import { COMMON_KEYWORDS, Scanner, isStateStart } from './lexer';
import { parseEgrepBlock, parseEgrepShort, parseGrammarBlock, parseMengeBlock, parseMengeShort, parseRegexBlock, parseRegexShort } from './objects';
import { mapStates, newOriginAcc, parseEntspricht, parseHerkunft, resolveSourceStates } from './origin';
import { readSymbol } from './word';

interface LabelItem {
  word: Word;
  raws: string[];
  start: number;
  end: number;
}

/** Liest Labels nach dem einleitenden `-` bis einschließlich `->`. null = Fehler (bereits gemeldet). */
function parseLabels(sc: Scanner): LabelItem[] | null {
  const items: LabelItem[] = [];
  sc.skipInlineWs();
  if (sc.startsWith('->')) {
    sc.report('syntax.unexpected', { found: '->', expected: ['Symbol', '\\-'] }, sc.i, 2);
    return null;
  }
  for (;;) {
    sc.skipInlineWs();
    const start = sc.i;
    const syms: Sym[] = [];
    const raws: string[] = [];
    let epsAt = -1;
    for (;;) {
      sc.skipInlineWs();
      const c = sc.peek();
      if (c === '' || c === '\n' || c === ',' || sc.startsWith('->')) break;
      if (c === '-') {
        sc.unexpected(['"->"', 'Symbol']);
        return null;
      }
      if (c === 'ε') {
        if (epsAt < 0) epsAt = sc.i;
        raws.push('ε');
        sc.advance();
        continue;
      }
      const r = readSymbol(sc);
      if (!r) return null;
      syms.push(r.sym);
      raws.push(r.raw);
    }
    const end = sc.i;
    let word: Word;
    if (raws.length === 1 && raws[0] === 'ε') word = [];
    else if (raws.length === 3 && raws.join('') === 'eps') word = [];
    else if (epsAt >= 0) {
      sc.report('syntax.unexpected', { found: 'ε', expected: ['Symbol'] }, epsAt, 1);
      return null;
    } else if (syms.length === 0) {
      sc.unexpected(['Symbol']);
      return null;
    } else word = syms;
    items.push({ word, raws, start, end });
    sc.skipInlineWs();
    if (sc.peek() === ',') {
      sc.advance();
      continue;
    }
    if (sc.startsWith('->')) {
      sc.i += 2;
      return items;
    }
    sc.unexpected(['"->"', '","']);
    return null;
  }
}

function parseNumber(sc: Scanner, stops: string[]): number | null {
  const start = sc.i;
  while (!sc.eof()) {
    const c = sc.peek();
    if (/^\s$/u.test(c) || c === '}' || c === '#' || stops.includes(c)) break;
    sc.advance();
  }
  const text = sc.text.slice(start, sc.i);
  if (text === '') {
    sc.unexpected(['Zahl']);
    return null;
  }
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(text)) {
    sc.report('syntax.badNumber', { text }, start, text.length);
    return null;
  }
  return Number(text);
}

function atListEnd(sc: Scanner): boolean {
  const c = sc.peek();
  return c === '' || c === '\n' || c === '}';
}

interface SymSeq {
  syms: Sym[];
  raws: string[];
  start: number;
  end: number;
}

/** Liest Symbole bis `,`, `->`, Zeilenende, `}`, `#` oder Dateiende. null = Fehler (gemeldet). */
function readSymSeq(sc: Scanner): SymSeq | null {
  sc.skipInlineWs();
  const start = sc.i;
  const syms: Sym[] = [];
  const raws: string[] = [];
  for (;;) {
    sc.skipInlineWs();
    const c = sc.peek();
    if (c === '' || c === '\n' || c === ',' || c === '}' || c === '#' || sc.startsWith('->')) break;
    if (c === 'ε') {
      raws.push('ε');
      sc.advance();
      continue;
    }
    const r = readSymbol(sc);
    if (!r) return null;
    syms.push(r.sym);
    raws.push(r.raw);
  }
  if (raws.includes('ε') && raws.length > 1) {
    sc.report('syntax.unexpected', { found: 'ε', expected: ['Symbol'] }, start, Math.max(1, sc.i - start));
    return null;
  }
  return { syms, raws, start, end: sc.i };
}

const isEps = (raws: string[]): boolean => raws.join('') === 'ε' || raws.join('') === 'eps';

function expectChar(sc: Scanner, ch: string): boolean {
  sc.skipInlineWs();
  if (sc.peek() === ch) {
    sc.advance();
    return true;
  }
  sc.unexpected([`"${ch}"`]);
  return false;
}

function expectArrow(sc: Scanner): boolean {
  sc.skipInlineWs();
  if (sc.startsWith('->')) {
    sc.i += 2;
    return true;
  }
  sc.unexpected(['"->"']);
  return false;
}

/** Genau ein Symbol (oder, mit allowEps, ε → null); meldet label.shape sonst. */
function oneSymbol(sc: Scanner, kind: string, allowEps: boolean): { sym: Sym | null } | null {
  const seq = readSymSeq(sc);
  if (!seq) return null;
  if (allowEps && isEps(seq.raws)) return { sym: null };
  if (seq.syms.length !== 1) {
    sc.report('label.shape', { kind, text: seq.raws.join('') }, seq.start, Math.max(1, seq.end - seq.start));
    return null;
  }
  return { sym: seq.syms[0] as Sym };
}

function readTarget(sc: Scanner): string | null {
  sc.skipInlineWs();
  if (!isStateStart(sc.peek())) {
    sc.unexpected(['Zustandsname']);
    return null;
  }
  return sc.readStateName();
}

/** Zeilenform nka: `z, y, x -> z', v` (nach `z` und `,`). */
function parseNkaLine(sc: Scanner): { to: string; label: NkaLabel } | null {
  const top = oneSymbol(sc, 'nka', false);
  if (!top || !expectChar(sc, ',')) return null;
  const read = oneSymbol(sc, 'nka', true);
  if (!read || !expectArrow(sc)) return null;
  const to = readTarget(sc);
  if (to === null || !expectChar(sc, ',')) return null;
  const v = readSymSeq(sc);
  if (!v) return null;
  const push = isEps(v.raws) ? [] : v.syms;
  if (push.length === 0 && !isEps(v.raws)) {
    sc.unexpected(['Wort', 'ε']);
    return null;
  }
  return { to, label: { top: top.sym as Sym, read: read.sym, push } };
}

/** Zeilenform tm: `z, y -> z', y', d` (nach `z` und `,`). */
function parseTmLine(sc: Scanner): { to: string; label: TmLabel } | null {
  const read = oneSymbol(sc, 'tm', false);
  if (!read || !expectArrow(sc)) return null;
  const to = readTarget(sc);
  if (to === null || !expectChar(sc, ',')) return null;
  const write = oneSymbol(sc, 'tm', false);
  if (!write || !expectChar(sc, ',')) return null;
  sc.skipInlineWs();
  const at = sc.i;
  while (!sc.eof() && !/^\s$/u.test(sc.peek()) && sc.peek() !== '}' && sc.peek() !== '#') sc.advance();
  const text = sc.text.slice(at, sc.i);
  const move = parseMove(text);
  if (move === null) {
    sc.report('syntax.unexpected', { found: text, expected: ['L', 'N', 'R'] }, at, Math.max(1, text.length));
    return null;
  }
  return { to, label: { read: read.sym as Sym, write: write.sym as Sym, move } };
}

function parseSymbolList(sc: Scanner): Sym[] {
  const list: Sym[] = [];
  for (;;) {
    sc.skipInline();
    if (atListEnd(sc)) break;
    const r = readSymbol(sc);
    if (!r) {
      sc.skipToLineEnd(true);
      break;
    }
    if (!list.includes(r.sym)) list.push(r.sym);
  }
  return list;
}

function parseBody(sc: Scanner, spec: KindSpec, name: string, braceAt: number): Automaton {
  const originAcc = newOriginAcc();
  const states: State[] = [];
  const byName = new Map<string, State>();
  const mention = (n: string): State => {
    let s = byName.get(n);
    if (!s) {
      s = { id: `s${states.length}`, name: n };
      states.push(s);
      byName.set(n, s);
    }
    return s;
  };
  let alphabet: Sym[] | null = null;
  let start: string | null = null;
  let startSeen = false;
  const accept: string[] = [];
  const transitions: Transition<AnyLabel>[] = [];
  const extras: Extras = {
    outputAlphabet: null,
    stackAlphabet: null,
    tapeAlphabet: null,
    y0: null,
    acceptBy: null,
    blank: null,
    reject: [],
    out: new Map(),
  };
  const isKeyword = (w: string): boolean =>
    (COMMON_KEYWORDS as readonly string[]).includes(w) || spec.keywords.includes(w);

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
    const word = sc.readStateName();
    if (word === '') {
      sc.unexpected(['Anweisung']);
      sc.skipToLineEnd(true);
      continue;
    }
    if (word === 'herkunft') {
      parseHerkunft(sc, originAcc, stmtStart);
      continue;
    }
    if (word === 'entspricht') {
      parseEntspricht(sc, originAcc, stmtStart);
      continue;
    }
    if (isKeyword(word)) {
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
        case 'lba':
          if (extras.bounded) sc.report('syntax.duplicateStatement', { statement: word }, stmtStart, word.length);
          extras.bounded = true;
          break;
        case 'ausgabealphabet':
          extras.outputAlphabet = parseSymbolList(sc);
          break;
        case 'kelleralphabet':
          extras.stackAlphabet = parseSymbolList(sc);
          break;
        case 'bandalphabet':
          extras.tapeAlphabet = parseSymbolList(sc);
          break;
        case 'akzeptanz': {
          sc.skipInline();
          const at = sc.i;
          const v = sc.readStateName();
          if (v !== 'leer') {
            sc.report('syntax.unexpected', { found: v === '' ? sc.peek() : v, expected: ['leer'] }, at, Math.max(1, v.length));
            sc.skipToLineEnd(true);
            break;
          }
          if (extras.acceptBy !== null) sc.report('syntax.duplicateStatement', { statement: word }, stmtStart, word.length);
          else extras.acceptBy = 'empty';
          break;
        }
        case 'keller':
        case 'blank': {
          sc.skipInline();
          if (atListEnd(sc)) {
            sc.unexpected(['Symbol']);
            break;
          }
          const r = readSymbol(sc);
          if (!r) {
            sc.skipToLineEnd(true);
            break;
          }
          const field = word === 'keller' ? 'y0' : 'blank';
          if (extras[field] !== null) sc.report('syntax.duplicateStatement', { statement: word }, stmtStart, word.length);
          else extras[field] = r.sym;
          break;
        }
        case 'out': {
          for (;;) {
            sc.skipInline();
            if (atListEnd(sc)) break;
            if (!isStateStart(sc.peek())) {
              sc.unexpected(['Zustandsname']);
              sc.skipToLineEnd(true);
              break;
            }
            const n = sc.readStateName();
            if (sc.peek() !== '=') {
              sc.unexpected(['"="']);
              sc.skipToLineEnd(true);
              break;
            }
            sc.advance();
            const r = readSymbol(sc);
            if (!r) {
              sc.skipToLineEnd(true);
              break;
            }
            extras.out.set(mention(n).id, r.sym);
          }
          break;
        }
        case 'states':
        case 'reject':
        case 'accept': {
          for (;;) {
            sc.skipInline();
            if (atListEnd(sc)) break;
            if (!isStateStart(sc.peek())) {
              sc.unexpected(['Zustandsname']);
              sc.skipToLineEnd(true);
              break;
            }
            const s = mention(sc.readStateName());
            if (word === 'accept' && !accept.includes(s.id)) accept.push(s.id);
            if (word === 'reject' && !extras.reject.includes(s.id)) extras.reject.push(s.id);
          }
          break;
        }
        case 'start': {
          sc.skipInline();
          if (!isStateStart(sc.peek())) {
            sc.unexpected(['Zustandsname']);
            sc.skipToLineEnd(true);
            break;
          }
          const n = sc.readStateName();
          if (startSeen) {
            sc.report('syntax.duplicateStatement', { statement: 'start' }, stmtStart, word.length);
          } else {
            startSeen = true;
            start = mention(n).id;
          }
          break;
        }
        case 'layout': {
          for (;;) {
            sc.skipInline();
            if (atListEnd(sc)) break;
            if (!isStateStart(sc.peek())) {
              sc.unexpected(['Zustandsname']);
              sc.skipToLineEnd(true);
              break;
            }
            const n = sc.readStateName();
            if (sc.peek() !== '@') {
              sc.unexpected(['"@"']);
              sc.skipToLineEnd(true);
              break;
            }
            sc.advance();
            const x = parseNumber(sc, [',']);
            if (x === null) {
              sc.skipToLineEnd(true);
              break;
            }
            if (sc.peek() !== ',') {
              sc.unexpected(['","']);
              sc.skipToLineEnd(true);
              break;
            }
            sc.advance();
            const y = parseNumber(sc, []);
            if (y === null) {
              sc.skipToLineEnd(true);
              break;
            }
            const pos: Point = { x, y };
            mention(n).pos = pos;
          }
          break;
        }
      }
      continue;
    }
    // Übergang: Name ws "-" labels "->" Name
    if (spec.lineForm) {
      sc.skipInlineWs();
      if (sc.peek() !== ',') {
        sc.unexpected(['","']);
        sc.skipToLineEnd(true);
        continue;
      }
      sc.advance();
      const parsed = spec.kind === 'nka' ? parseNkaLine(sc) : parseTmLine(sc);
      if (!parsed) {
        sc.skipToLineEnd(true);
        continue;
      }
      const from = mention(word);
      const to = mention(parsed.to);
      transitions.push({ id: `t${transitions.length}`, from: from.id, to: to.id, label: parsed.label });
      continue;
    }
    while (/^\s$/u.test(sc.peek())) sc.advance();
    if (sc.peek() !== '-') {
      sc.unexpected(['"-"']);
      sc.skipToLineEnd(true);
      continue;
    }
    sc.advance();
    const labels = parseLabels(sc);
    if (!labels) {
      sc.skipToLineEnd(true);
      continue;
    }
    while (/^\s$/u.test(sc.peek())) sc.advance();
    if (!isStateStart(sc.peek())) {
      sc.unexpected(['Zustandsname']);
      sc.skipToLineEnd(true);
      continue;
    }
    const toName = sc.readStateName();
    const from = mention(word);
    const to = mention(toName);
    for (const item of labels) {
      const made = spec.makeLabel(item.word, item.raws);
      if (!made.ok) {
        sc.report(made.code, made.params, item.start, Math.max(1, item.end - item.start));
        continue;
      }
      transitions.push({ id: `t${transitions.length}`, from: from.id, to: to.id, label: made.label });
    }
  }

  const obj = spec.finish({ name, alphabet, states, start, accept, transitions }, extras);
  if (originAcc.origin) {
    const ids = new Map(obj.states.map((st) => [st.name, st.id]));
    const origin = originAcc.origin;
    if (origin.corr) origin.corr = mapStates(origin.corr, (n) => ids.get(n) ?? n);
    return { ...obj, origin } as Automaton;
  }
  return obj;
}

/** Überspringt ein unbekanntes Objekt: `{ … }` mit Klammerzählung oder den Rest der Zeile. */
function skipUnknown(sc: Scanner): void {
  while (!sc.eof() && sc.peek() !== '\n' && sc.peek() !== '{') sc.advance();
  if (sc.peek() !== '{') return;
  let depth = 0;
  while (!sc.eof()) {
    const c = sc.peek();
    sc.advance();
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return;
    }
  }
}

export function parseDocument(text: string): { doc: Document; diagnostics: Diagnostic[] } {
  const sc = new Scanner(text);
  const objects: FormalObject[] = [];
  const names = new Set<string>();
  for (;;) {
    sc.skipWsAndComments();
    if (sc.eof()) break;
    const kwStart = sc.i;
    const kw = sc.readStateName();
    if (kw === '') {
      sc.unexpected(['Objektart']);
      sc.skipToLineEnd(false);
      continue;
    }
    if (kw === 'regex' || kw === 'grammatik' || kw === 'egrep' || kw === 'menge') {
      sc.skipWsAndComments();
      const nameStart = sc.i;
      const name = sc.readStateName();
      if (name === '') sc.unexpected(['Name']);
      sc.skipInline();
      sc.objectName = name;
      let obj: FormalObject | null = null;
      if ((kw === 'regex' || kw === 'egrep' || kw === 'menge') && sc.peek() === '=') {
        sc.advance();
        obj =
          kw === 'regex'
            ? parseRegexShort(sc, name)
            : kw === 'menge'
              ? parseMengeShort(sc, name)
              : parseEgrepShort(sc, name);
      } else {
        sc.skipWsAndComments();
        if (sc.peek() !== '{') {
          sc.unexpected(kw !== 'grammatik' ? ['"="', '"{"'] : ['"{"']);
          sc.skipToLineEnd(false);
        } else {
          const braceAt = sc.i;
          sc.advance();
          obj =
            kw === 'regex'
              ? parseRegexBlock(sc, name, braceAt)
              : kw === 'egrep'
                ? parseEgrepBlock(sc, name, braceAt)
                : kw === 'menge'
                  ? parseMengeBlock(sc, name, braceAt)
                  : parseGrammarBlock(sc, name, braceAt);
        }
      }
      sc.objectName = undefined;
      if (obj) {
        if (names.has(name)) sc.report('syntax.duplicateObject', { name }, nameStart, Math.max(1, name.length));
        else {
          names.add(name);
          objects.push(obj);
        }
      }
      continue;
    }
    const spec = findKindByKeyword(kw);
    if (!spec) {
      sc.report('syntax.unknownKind', { kind: kw }, kwStart, kw.length);
      skipUnknown(sc);
      continue;
    }
    sc.skipWsAndComments();
    const nameStart = sc.i;
    const name = sc.readStateName();
    if (name === '') sc.unexpected(['Name']);
    sc.skipWsAndComments();
    if (sc.peek() !== '{') {
      sc.unexpected(['"{"']);
      sc.skipToLineEnd(false);
      continue;
    }
    const braceAt = sc.i;
    sc.advance();
    sc.objectName = name;
    const obj = parseBody(sc, spec, name, braceAt);
    sc.objectName = undefined;
    if (names.has(name)) {
      sc.report('syntax.duplicateObject', { name }, nameStart, Math.max(1, name.length));
    } else {
      names.add(name);
      objects.push(obj);
    }
  }
  const doc: Document = { version: 1, objects };
  resolveSourceStates(doc);
  return { doc, diagnostics: sc.diagnostics };
}
