// egrep-Regex (Kapitel 3, POSIX ERE): Parser, Druck, Hilfsfunktionen, Prüfung.
import type { Diagnostic, DiagnosticCode, EgrepNode, EgrepObj } from './types';

export const NAMED_CLASSES = ['alpha', 'digit', 'alnum', 'upper', 'lower', 'space', 'punct', 'xdigit', 'blank'] as const;

const MAX_REPEAT = 255;

/** Gehört das Zeichen zur benannten Klasse (ASCII)? */
export function inNamedClass(name: string, c: string): boolean {
  if (c.length !== 1) return false;
  const k = c.charCodeAt(0);
  const digit = k >= 48 && k <= 57;
  const upper = k >= 65 && k <= 90;
  const lower = k >= 97 && k <= 122;
  switch (name) {
    case 'alpha':
      return upper || lower;
    case 'digit':
      return digit;
    case 'alnum':
      return upper || lower || digit;
    case 'upper':
      return upper;
    case 'lower':
      return lower;
    case 'space':
      return k === 32 || (k >= 9 && k <= 13);
    case 'punct':
      return k > 32 && k < 127 && !(upper || lower || digit);
    case 'xdigit':
      return digit || (k >= 65 && k <= 70) || (k >= 97 && k <= 102);
    case 'blank':
      return k === 32 || k === 9;
    default:
      return false;
  }
}

/** Alle Zeichen einer benannten Klasse (ASCII, aufsteigend). */
export function namedClassChars(name: string): string[] {
  const out: string[] = [];
  for (let k = 0; k < 128; k++) if (inNamedClass(name, String.fromCharCode(k))) out.push(String.fromCharCode(k));
  return out;
}

/** Passt das Zeichen auf die Klasse (negiert berücksichtigt)? */
export function classMatches(n: Extract<EgrepNode, { t: 'class' }>, c: string): boolean {
  let hit = n.chars.includes(c);
  if (!hit) hit = n.ranges.some(([a, b]) => a <= c && c <= b && c.length === 1);
  if (!hit) hit = n.named.some((nm) => inNamedClass(nm, c));
  return hit !== n.negated;
}

export function egrepHasBackref(n: EgrepNode): boolean {
  switch (n.t) {
    case 'backref':
      return true;
    case 'group':
      return egrepHasBackref(n.inner);
    case 'repeat':
      return egrepHasBackref(n.inner);
    case 'concat':
    case 'alt':
      return n.items.some(egrepHasBackref);
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Parser

interface Failure {
  code: DiagnosticCode;
  params: Record<string, unknown>;
}

class Fail extends Error {
  constructor(readonly failure: Failure) {
    super(failure.code);
  }
}

export function parseEgrep(pattern: string): { ast: EgrepNode | null; groups: number; diagnostics: Diagnostic[] } {
  const cs = Array.from(pattern);
  const n = cs.length;
  let i = 0;
  let groups = 0;
  const closed = new Set<number>();
  const diagnostics: Diagnostic[] = [];
  const fail = (code: DiagnosticCode, params: Record<string, unknown>, at: number): never => {
    throw new Fail({ code, params: { ...params, col: at + 1 } });
  };

  const parseClass = (): EgrepNode => {
    const open = i;
    i++; // [
    let negated = false;
    if (cs[i] === '^') {
      negated = true;
      i++;
    }
    const chars: string[] = [];
    const ranges: [string, string][] = [];
    const named: string[] = [];
    let first = true;
    for (;;) {
      if (i >= n) return fail('egrep.badClass', {}, open);
      const c = cs[i] as string;
      if (c === ']' && !first) {
        i++;
        break;
      }
      first = false;
      if (c === '[' && cs[i + 1] === ':') {
        let j = i + 2;
        let name = '';
        while (j < n && cs[j] !== ':' && cs[j] !== ']') name += cs[j++];
        if (cs[j] === ':' && cs[j + 1] === ']') {
          if (!(NAMED_CLASSES as readonly string[]).includes(name)) return fail('egrep.badClassName', { name }, i);
          if (!named.includes(name)) named.push(name);
          i = j + 2;
          continue;
        }
      }
      i++;
      if (cs[i] === '-' && i + 1 < n && cs[i + 1] !== ']') {
        const to = cs[i + 1] as string;
        const at = i - 1;
        i += 2;
        if (c > to) return fail('egrep.badRange', { from: c, to }, at);
        ranges.push([c, to]);
      } else if (!chars.includes(c)) chars.push(c);
    }
    return { t: 'class', negated, chars, ranges, named };
  };

  const parseQuant = (): { min: number; max: number | null } | null => {
    const c = cs[i];
    if (c === '*') {
      i++;
      return { min: 0, max: null };
    }
    if (c === '+') {
      i++;
      return { min: 1, max: null };
    }
    if (c === '?') {
      i++;
      return { min: 0, max: 1 };
    }
    if (c !== '{') return null;
    const start = i;
    let j = i + 1;
    let text = '{';
    while (j < n && cs[j] !== '}') text += cs[j++];
    const closedBrace = cs[j] === '}';
    if (closedBrace) text += '}';
    const m = /^\{(\d+)(?:(,)(\d*))?\}$/.exec(text);
    if (!m) return fail('egrep.badRepeat', { text }, start);
    const min = Number(m[1]);
    const max = m[2] === undefined ? min : m[3] === '' ? null : Number(m[3]);
    if (min > MAX_REPEAT || (max !== null && (max > MAX_REPEAT || max < min))) return fail('egrep.badRepeat', { text }, start);
    i = j + 1;
    return { min, max };
  };

  const parseAtom = (): EgrepNode => {
    const c = cs[i] as string;
    const at = i;
    switch (c) {
      case '(': {
        i++;
        const index = ++groups;
        const inner = parseAlt(1);
        if (cs[i] !== ')') return fail('egrep.unbalanced', { open: 1 }, at);
        i++;
        closed.add(index);
        return { t: 'group', index, inner };
      }
      case '.':
        i++;
        return { t: 'any' };
      case '^':
        i++;
        return { t: 'bol' };
      case '$':
        i++;
        return { t: 'eol' };
      case '[':
        return parseClass();
      case '\\': {
        i++;
        if (i >= n) return { t: 'char', c: '\\' };
        const d = cs[i++] as string;
        if (d >= '1' && d <= '9') {
          const num = Number(d);
          if (!closed.has(num)) return fail('egrep.badBackref', { n: num }, at);
          return { t: 'backref', n: num };
        }
        return { t: 'char', c: d };
      }
      default:
        i++;
        return { t: 'char', c };
    }
  };

  const parsePiece = (): EgrepNode => {
    const c = cs[i];
    if (c === '*' || c === '+' || c === '?' || c === '{') return fail('egrep.nothingToRepeat', {}, i);
    let node = parseAtom();
    for (;;) {
      const q = parseQuant();
      if (!q) break;
      node = { t: 'repeat', inner: node, min: q.min, max: q.max };
    }
    return node;
  };

  const parseConcat = (depth: number): EgrepNode => {
    const items: EgrepNode[] = [];
    while (i < n && cs[i] !== '|' && !(cs[i] === ')' && depth > 0)) {
      if (cs[i] === ')') return fail('egrep.unbalanced', { open: 0 }, i);
      items.push(parsePiece());
    }
    return items.length === 1 ? (items[0] as EgrepNode) : { t: 'concat', items };
  };

  function parseAlt(depth: number): EgrepNode {
    const items: EgrepNode[] = [parseConcat(depth)];
    while (cs[i] === '|') {
      i++;
      items.push(parseConcat(depth));
    }
    return items.length === 1 ? (items[0] as EgrepNode) : { t: 'alt', items };
  }

  try {
    const ast = parseAlt(0);
    if (i < n) fail('egrep.unbalanced', { open: 0 }, i);
    return { ast, groups, diagnostics };
  } catch (e) {
    if (!(e instanceof Fail)) throw e;
    diagnostics.push({ severity: 'error', code: e.failure.code, params: e.failure.params });
    return { ast: null, groups, diagnostics };
  }
}

// ---------------------------------------------------------------------------
// Druck

const META = new Set(['\\', '.', '[', ']', '(', ')', '{', '}', '|', '*', '+', '?', '^', '$']);

export function printEgrepChar(c: string): string {
  return META.has(c) ? '\\' + c : c;
}

function printClass(n: Extract<EgrepNode, { t: 'class' }>): string {
  let chars = [...n.chars];
  const hasBracket = chars.includes(']');
  const hasDash = chars.includes('-');
  chars = chars.filter((c) => c !== ']' && c !== '-');
  const colon = chars.indexOf(':');
  const bracket = chars.indexOf('[');
  if (colon >= 0 && bracket >= 0 && bracket < colon) {
    chars.splice(colon, 1);
    chars.splice(bracket, 0, ':');
  }
  if (!n.negated && chars[0] === '^' && !hasBracket) {
    // ^ nicht an den Anfang
    chars.push(chars.shift() as string);
    if (chars.length === 1 && n.ranges.length === 0 && n.named.length === 0 && !hasDash) return '\\^';
  }
  let body = (hasBracket ? ']' : '') + chars.join('');
  for (const [a, b] of n.ranges) body += `${a}-${b}`;
  for (const nm of n.named) body += `[:${nm}:]`;
  if (hasDash) body += '-';
  return `[${n.negated ? '^' : ''}${body}]`;
}

/** Kanonische Schreibweise (Anzeige, Tests). Gruppen und Verweise bleiben erhalten. */
export function printEgrepAst(n: EgrepNode): string {
  switch (n.t) {
    case 'char':
      return printEgrepChar(n.c);
    case 'any':
      return '.';
    case 'class':
      return printClass(n);
    case 'bol':
      return '^';
    case 'eol':
      return '$';
    case 'group':
      return `(${printEgrepAst(n.inner)})`;
    case 'backref':
      return `\\${n.n}`;
    case 'concat':
      return n.items.map((x) => (x.t === 'alt' ? `(${printEgrepAst(x)})` : printEgrepAst(x))).join('');
    case 'alt':
      return n.items.map(printEgrepAst).join('|');
    case 'repeat': {
      const needParen = n.inner.t === 'concat' || n.inner.t === 'alt';
      const inner = needParen ? `(${printEgrepAst(n.inner)})` : printEgrepAst(n.inner);
      let q: string;
      if (n.min === 0 && n.max === null) q = '*';
      else if (n.min === 1 && n.max === null) q = '+';
      else if (n.min === 0 && n.max === 1) q = '?';
      else if (n.max === null) q = `{${n.min},}`;
      else if (n.max === n.min) q = `{${n.min}}`;
      else q = `{${n.min},${n.max}}`;
      return inner + q;
    }
  }
}

// ---------------------------------------------------------------------------
// Prüfung

export function validateEgrep(o: EgrepObj): Diagnostic[] {
  const { ast, diagnostics } = parseEgrep(o.pattern);
  const out: Diagnostic[] = diagnostics.map((d) => ({ ...d, objectName: o.name }));
  if (ast && egrepHasBackref(ast)) {
    out.push({ severity: 'warning', code: 'egrep.backrefNotRegular', params: {}, objectName: o.name });
  }
  return out;
}
