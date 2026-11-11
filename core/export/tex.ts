// Gemeinsame LaTeX-Hilfen: Maskierung und mathematische Schreibweise von Symbolen, Wörtern, Zustandsnamen.
import type { Automaton, MealyLabel, NkaLabel, State, StateId, Sym, TmLabel, Word } from '../model/types';

/** Nicht-ASCII-Zeichen im Mathemodus. */
const MATH_UNI: Record<string, string> = {
  ε: '\\varepsilon',
  '□': '\\square',
  '∅': '\\emptyset',
  '−': '-',
  '–': '-',
  '⊥': '\\bot',
  '⊤': '\\top',
  '→': '\\to',
  '␣': '\\sqcup',
  '⊔': '\\sqcup',
  '∞': '\\infty',
  α: '\\alpha',
  β: '\\beta',
  γ: '\\gamma',
  δ: '\\delta',
  λ: '\\lambda',
  μ: '\\mu',
  π: '\\pi',
  σ: '\\sigma',
  τ: '\\tau',
  φ: '\\varphi',
  ω: '\\omega',
  Σ: '\\Sigma',
  Γ: '\\Gamma',
  Δ: '\\Delta',
  Ω: '\\Omega',
};

const ASCII_SPECIAL: Record<string, string> = {
  '#': '\\#',
  $: '\\$',
  '%': '\\%',
  '&': '\\&',
  _: '\\_',
  '{': '\\{',
  '}': '\\}',
};

/** Ein Zeichen im Mathemodus. */
function mathChar(c: string): string {
  const a = ASCII_SPECIAL[c];
  if (a !== undefined) return a;
  if (c === '~') return '\\sim{}';
  if (c === '^') return '\\mathord{\\wedge}';
  if (c === '\\') return '\\backslash{}';
  if (c === ' ') return '\\sqcup';
  return MATH_UNI[c] ?? c;
}

/** Text im Mathemodus (zeichenweise maskiert). */
export function mathText(s: string): string {
  return [...s].map(mathChar).join('');
}

/** Ein Symbol im Mathemodus; mehrbuchstabige Symbole als \mathrm{…}. */
export function mathSym(s: Sym): string {
  const cps = [...s];
  if (cps.length === 1) return mathChar(s);
  return `\\mathrm{${mathText(s)}}`;
}

/** Wort im Mathemodus; ε für das leere Wort. */
export function mathWord(w: Word): string {
  return w.length === 0 ? '\\varepsilon' : w.map(mathSym).join('');
}

/** Text im Textmodus: alle Sonderzeichen maskiert. */
export function latexEscape(s: string): string {
  let out = '';
  for (const c of s) {
    const a = ASCII_SPECIAL[c];
    if (a !== undefined) out += a;
    else if (c === '~') out += '\\textasciitilde{}';
    else if (c === '^') out += '\\textasciicircum{}';
    else if (c === '\\') out += '\\textbackslash{}';
    else if (c === '−' || c === '–') out += '-';
    else if (MATH_UNI[c] !== undefined) out += `\\ensuremath{${MATH_UNI[c]}}`;
    else out += c;
  }
  return out;
}

/** Zustandsname im Mathemodus: z12 → z_{12}, q_1 → q_{1}, sonst maskiert. */
export function mathState(name: string): string {
  const prime = /^(.*?)('*)$/u.exec(name) as RegExpExecArray;
  const base = prime[1] as string;
  const primes = prime[2] as string;
  const us = /^([^_]+)_(.+)$/u.exec(base);
  if (us) return `${mathBase(us[1] as string)}_{${mathText(us[2] as string)}}${primes}`;
  const m = /^(\p{L}+)(\d+)$/u.exec(base);
  if (m) return `${mathBase(m[1] as string)}_{${m[2]}}${primes}`;
  return mathBase(base) + primes;
}

function mathBase(s: string): string {
  return [...s].length > 1 && /^\p{L}+$/u.test(s) ? `\\mathrm{${s}}` : mathText(s);
}

export function stateNameOf(o: Automaton, id: StateId): string {
  return o.states.find((s: State) => s.id === id)?.name ?? '?';
}

export function mathStateOf(o: Automaton, id: StateId): string {
  return mathState(stateNameOf(o, id));
}

const MOVE: Record<number, string> = { [-1]: 'L', 0: 'N', 1: 'R' };

/** Beschriftung einer Kante im Mathemodus (wie showLabel der Oberfläche). */
export function mathLabel(kind: Automaton['kind'], label: unknown): string {
  switch (kind) {
    case 'dea':
    case 'moore':
      return mathSym(label as Sym);
    case 'nea':
      return mathWord(label as Word);
    case 'mealy': {
      const l = label as MealyLabel;
      return `${mathSym(l.in)}/${mathSym(l.out)}`;
    }
    case 'nka': {
      const l = label as NkaLabel;
      return `${mathSym(l.top)},${l.read === null ? '\\varepsilon' : mathSym(l.read)}\\to ${mathWord(l.push)}`;
    }
    case 'tm': {
      const l = label as TmLabel;
      return `${mathSym(l.read)}\\to ${mathSym(l.write)},\\mathrm{${MOVE[l.move]}}`;
    }
  }
}

/** Menge im Mathemodus: \{a, b\}; leer = \emptyset. */
export function mathSet(items: string[]): string {
  return items.length === 0 ? '\\emptyset' : `\\{${items.join(', ')}\\}`;
}
