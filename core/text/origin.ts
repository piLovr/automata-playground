// Herkunft (`herkunft` / `entspricht`) in der Textsprache: Lesen und Drucken.
import { METHOD_IDS } from '../model/methods';
import type { Correspondence, Document, ElemRef, MethodId, Origin } from '../model/types';
import { Scanner, isStateStart } from './lexer';
import { printSymbol, readSymbol } from './word';

/** Zwischenstand beim Lesen einer Herkunft innerhalb eines Objekts. */
export interface OriginAcc {
  origin: Origin | null;
}

export function newOriginAcc(): OriginAcc {
  return { origin: null };
}

function atEol(sc: Scanner): boolean {
  const c = sc.peek();
  return c === '' || c === '\n' || c === '}' || c === '#';
}

function readToken(sc: Scanner): string {
  const start = sc.i;
  while (!atEol(sc) && !/^\s$/u.test(sc.peek())) sc.advance();
  return sc.text.slice(start, sc.i);
}

function readElem(sc: Scanner): ElemRef | null {
  const at = sc.i;
  const prefix = sc.text.slice(sc.i, sc.i + 2);
  switch (prefix) {
    case 'z:': {
      sc.i += 2;
      const n = sc.readStateName();
      if (n === '') {
        sc.unexpected(['Zustandsname']);
        return null;
      }
      return { state: n };
    }
    case 'k:':
    case 'p:': {
      sc.i += 2;
      const id = readToken(sc);
      if (id === '') {
        sc.unexpected(['Kennung']);
        return null;
      }
      return prefix === 'k:' ? { transition: id } : { production: id };
    }
    case 'n:': {
      sc.i += 2;
      const r = readSymbol(sc);
      return r ? { nonterminal: r.sym } : null;
    }
    case 't:': {
      sc.i += 2;
      const tok = readToken(sc);
      if (!/^r[01]*$/.test(tok)) {
        sc.report('syntax.unexpected', { found: tok, expected: ['t:r<Pfad>'] }, at, Math.max(1, sc.i - at));
        return null;
      }
      return { subexpr: [...tok.slice(1)].map(Number) };
    }
    default: {
      const found = readToken(sc);
      sc.report('syntax.unexpected', { found, expected: ['z:', 'k:', 'n:', 'p:', 't:'] }, at, Math.max(1, found.length));
      return null;
    }
  }
}

/** Nach dem Schlüsselwort `herkunft`: `<methode> aus Name@hash …`. Meldet selbst; gibt false bei Fehler zurück. */
export function parseHerkunft(sc: Scanner, acc: OriginAcc, kwStart: number): boolean {
  if (acc.origin !== null) {
    sc.report('syntax.duplicateStatement', { statement: 'herkunft' }, kwStart, 'herkunft'.length);
    sc.skipToLineEnd(true);
    return false;
  }
  sc.skipInlineWs();
  const mAt = sc.i;
  const m = sc.readStateName();
  if (!(METHOD_IDS as readonly string[]).includes(m)) {
    sc.report('syntax.unexpected', { found: m, expected: [...METHOD_IDS] }, mAt, Math.max(1, m.length));
    sc.skipToLineEnd(true);
    return false;
  }
  const origin: Origin = { method: m as MethodId, sources: [], sourceHash: [] };
  sc.skipInlineWs();
  const kwAt = sc.i;
  const aus = sc.readStateName();
  if (aus !== 'aus') {
    sc.report('syntax.unexpected', { found: aus, expected: ['aus'] }, kwAt, Math.max(1, aus.length));
    sc.skipToLineEnd(true);
    return false;
  }
  for (;;) {
    sc.skipInlineWs();
    if (atEol(sc)) break;
    if (!isStateStart(sc.peek())) {
      sc.unexpected(['Objektname']);
      sc.skipToLineEnd(true);
      return false;
    }
    const name = sc.readStateName();
    if (sc.peek() !== '@') {
      sc.unexpected(['"@"']);
      sc.skipToLineEnd(true);
      return false;
    }
    sc.advance();
    const hash = readToken(sc);
    origin.sources.push(name);
    origin.sourceHash.push(hash);
  }
  acc.origin = origin;
  return true;
}

/** Nach dem Schlüsselwort `entspricht`: `<ziel> <- <index> <elem> …`. */
export function parseEntspricht(sc: Scanner, acc: OriginAcc, kwStart: number): void {
  if (acc.origin === null) {
    sc.report('syntax.unexpected', { found: 'entspricht', expected: ['herkunft'] }, kwStart, 'entspricht'.length);
    sc.skipToLineEnd(true);
    return;
  }
  sc.skipInlineWs();
  const target = readElem(sc);
  if (!target) return void sc.skipToLineEnd(true);
  sc.skipInlineWs();
  if (!sc.startsWith('<-')) {
    sc.unexpected(['"<-"']);
    return void sc.skipToLineEnd(true);
  }
  sc.i += 2;
  sc.skipInlineWs();
  const idxAt = sc.i;
  const idxText = readToken(sc);
  if (!/^\d+$/.test(idxText)) {
    sc.report('syntax.badNumber', { text: idxText }, idxAt, Math.max(1, idxText.length));
    return void sc.skipToLineEnd(true);
  }
  const elems: ElemRef[] = [];
  for (;;) {
    sc.skipInlineWs();
    if (atEol(sc)) break;
    const e = readElem(sc);
    if (!e) return void sc.skipToLineEnd(true);
    elems.push(e);
  }
  (acc.origin.corr ??= []).push({ target, source: Number(idxText), elems });
}

/** Übersetzt Namen in `{state}`-Verweisen: Ziel über die Zustände dieses Objekts. */
export function mapStates(corr: Correspondence[], mapTarget: (n: string) => string): Correspondence[] {
  return corr.map((c) => ({ ...c, target: 'state' in c.target ? { state: mapTarget(c.target.state) } : c.target }));
}

/** Übersetzt Quell-Zustandsnamen in IDs, wenn die Quelle im Dokument steht. */
export function resolveSourceStates(doc: Document): void {
  doc.objects.forEach((o, k) => {
    const origin = o.origin;
    if (!origin?.corr) return;
    const corr = origin.corr.map((c) => {
      const srcName = origin.sources[c.source];
      const src = doc.objects.find((x) => x.name === srcName);
      if (!src || !('states' in src)) return c;
      const byName = new Map(src.states.map((s) => [s.name, s.id]));
      return {
        ...c,
        elems: c.elems.map((e): ElemRef => ('state' in e ? { state: byName.get(e.state) ?? e.state } : e)),
      };
    });
    doc.objects[k] = { ...o, origin: { ...origin, corr } };
  });
}

function printElem(e: ElemRef, nameOf: (id: string) => string): string {
  if ('state' in e) return 'z:' + nameOf(e.state);
  if ('transition' in e) return 'k:' + e.transition;
  if ('nonterminal' in e) return 'n:' + printSymbol(e.nonterminal);
  if ('production' in e) return 'p:' + e.production;
  return 't:r' + e.subexpr.join('');
}

/** Zeilen (ohne Einrückung). `nm`: Zustandsname des eigenen Objekts; Quellzustände über `doc`. */
export function printOrigin(origin: Origin, nm: (id: string) => string, doc?: Document): string[] {
  const lines: string[] = [];
  const sources = origin.sources.map((n, i) => `${n}@${origin.sourceHash[i] ?? ''}`);
  lines.push(`herkunft ${origin.method} aus ${sources.join(' ')}`.trimEnd());
  for (const c of origin.corr ?? []) {
    const srcName = origin.sources[c.source];
    const src = doc?.objects.find((x) => x.name === srcName);
    const srcNames = src && 'states' in src ? new Map(src.states.map((s) => [s.id, s.name])) : null;
    const sn = (id: string): string => srcNames?.get(id) ?? id;
    lines.push(
      `entspricht ${printElem(c.target, nm)} <- ${c.source}${c.elems.map((e) => ' ' + printElem(e, sn)).join('')}`,
    );
  }
  return lines;
}
