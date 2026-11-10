// Toleranter Parser der Textsprache.
import { findKindByKeyword } from '../model/kinds';
import type { AnyLabel } from '../model/kinds';
import type { Diagnostic, Document, FormalObject, Point, State, Sym, Transition, Word } from '../model/types';
import { labelWord } from '../model/util';
import { KEYWORDS, Scanner, isStateStart } from './lexer';
import { readSymbol } from './word';

interface LabelItem {
  word: Word;
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
    items.push({ word, start, end });
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

function parseBody(sc: Scanner, spec: NonNullable<ReturnType<typeof findKindByKeyword>>, name: string, braceAt: number): FormalObject {
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
    if ((KEYWORDS as readonly string[]).includes(word)) {
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
        case 'states':
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
    const fromStart = stmtStart;
    void fromStart;
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
      const made = spec.makeLabel(item.word);
      if (!made.ok) {
        sc.report(made.code, { label: item.word }, item.start, Math.max(1, item.end - item.start));
        continue;
      }
      transitions.push({ id: `t${transitions.length}`, from: from.id, to: to.id, label: made.label });
    }
  }

  if (alphabet === null) {
    alphabet = [];
    for (const t of transitions) for (const s of labelWord(t.label)) if (!alphabet.includes(s)) alphabet.push(s);
  }
  return { ...spec.empty(name), alphabet, states, start, accept, transitions } as FormalObject;
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
  return { doc: { version: 1, objects }, diagnostics: sc.diagnostics };
}
