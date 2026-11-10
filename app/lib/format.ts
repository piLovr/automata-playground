import { type Diagnostic, type FormalObject, type StateId, type Sym, type Word } from '../../core/index';
import { t } from '../i18n';

export function stateName(obj: FormalObject | undefined, id: StateId): string {
  return obj?.states.find((s) => s.id === id)?.name ?? '?';
}

/** Symbol zur Anzeige (ohne Text-Maskierung). */
export function showSym(s: Sym): string {
  if (s === ' ') return '␣';
  return s.length > 1 ? `⟨${s}⟩` : s;
}

export function showWord(w: Word): string {
  return w.length === 0 ? 'ε' : w.map(showSym).join('');
}

export function showSet(obj: FormalObject | undefined, ids: StateId[]): string {
  return ids.length === 0 ? '∅' : `{${ids.map((id) => stateName(obj, id)).join(', ')}}`;
}

/**
 * Eingabewort für Simulation und Stapellauf: großzügiger als die Textsprache.
 * Jedes Zeichen ist ein Symbol (auch - , #), Leerraum wird ignoriert,
 * <name> ist ein mehrbuchstabiges Symbol, \x maskiert (z. B. "\ " für Leerzeichen).
 * "ε", "eps" oder leer = leeres Wort.
 */
export function parseInputWord(raw: string): Word | null {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === 'ε' || trimmed === 'eps') return [];
  // Ungekürzt weiterlesen: ein maskiertes Leerzeichen am Ende gehört zum Wort,
  // unmaskierter Leerraum wird unten ohnehin übersprungen.
  const out: Word = [];
  const chars = [...raw];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    if (c === '\\') {
      const n = chars[i + 1];
      if (n === undefined) return null;
      out.push(n);
      i++;
    } else if (c === '<') {
      const end = chars.indexOf('>', i + 1);
      const name = end > i + 1 ? chars.slice(i + 1, end).join('') : '';
      if (/^[\p{L}\p{N}_]+$/u.test(name)) {
        out.push(name);
        i = end;
      } else out.push(c);
    } else if (!/\s/u.test(c)) out.push(c);
  }
  return out;
}

/** Teilt an unmaskierten Kommas, Leerraum außen wird entfernt. */
export function splitUnescaped(input: string, sep = ','): string[] {
  const parts: string[] = [];
  let cur = '';
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (c === '\\' && i + 1 < input.length) {
      cur += c + input[i + 1];
      i++;
    } else if (c === sep) {
      parts.push(cur);
      cur = '';
    } else cur += c;
  }
  parts.push(cur);
  return parts.map((p) => p.replace(/^\s+/, '').replace(/(?<!\\)\s+$/, '')).filter((p) => p.length > 0);
}

/** Liest eine Kantenbeschriftung wie "a, 01, ε" in Wörter (Regeln wie parseInputWord, "," trennt). */
export function parseLabels(input: string): { labels: Word[]; error?: string } {
  const labels: Word[] = [];
  for (const part of splitUnescaped(input)) {
    const word = parseInputWord(part);
    if (word === null) return { labels, error: `„${part}" ist keine gültige Beschriftung` };
    labels.push(word);
  }
  return { labels };
}

/** Gegenstück zu parseLabels: Wort als bearbeitbarer Text. */
export function labelInput(w: Word): string {
  if (w.length === 0) return 'ε';
  return w
    .map((s) => (s.length > 1 ? `<${s}>` : /[,\\<\s]/u.test(s) ? `\\${s}` : s === 'ε' ? '\\ε' : s))
    .join('');
}

export function diagnosticText(d: Diagnostic, obj?: FormalObject): string {
  const p: Record<string, unknown> = { ...d.params };
  const name = (id: unknown) => (typeof id === 'string' ? stateName(obj, id) : String(id));
  if (Array.isArray(p.expected)) p.expected = (p.expected as string[]).join(', ');
  if (typeof p.found === 'string') p.found = p.found === '' ? 'Ende' : `„${p.found}"`;
  if (typeof p.what === 'string') p.what = t(`what.${p.what}`);
  if (Array.isArray(p.label)) p.label = showWord(p.label as Word);
  if (typeof p.symbol === 'string') p.symbol = showSym(p.symbol);
  if (d.code === 'dea.nondeterministic') p.state = name(p.state);
  if (d.code === 'dea.missing' && Array.isArray(p.pairs)) {
    const pairs = p.pairs as { state: StateId; symbol: Sym }[];
    const shown = pairs.slice(0, 6).map((x) => `(${name(x.state)}, ${showSym(x.symbol)})`);
    p.pairs = shown.join(', ') + (pairs.length > 6 ? ` … (+${pairs.length - 6})` : '');
  }
  return t(`diag.${d.code}`, p);
}

/** Erklärungstext eines Simulationsschritts; StateIds werden zu Namen. */
export function explainText(obj: FormalObject | undefined, key: string, params: Record<string, unknown>): string {
  const p: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (k === 'symbol' && typeof v === 'string') p[k] = showSym(v);
    else if (Array.isArray(v)) p[k] = showSet(obj, v as StateId[]);
    else if (typeof v === 'string' && obj?.states.some((s) => s.id === v)) p[k] = stateName(obj, v);
    else p[k] = v;
  }
  return t(`explain.${key}`, p);
}
