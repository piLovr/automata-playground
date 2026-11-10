// Kantenbeschriftungen je Automatentyp: Anzeige, Bearbeitungstext und Einlesen.
// Eingaben sind großzügig wie beim Eingabewort (siehe parseInputWord): `\` maskiert,
// <name> ist ein mehrbuchstabiges Symbol, ε/eps steht für das leere Wort.
import type { Automaton, MealyLabel, NkaLabel, ObjectKind, Sym, TmLabel, Word } from '../../core/index';
import { labelInput, parseInputWord, showSym, showWord, splitUnescaped } from './format';

export type AnyLabel = Automaton['transitions'][number]['label'];

const MOVE_SHOW: Record<number, string> = { [-1]: 'L', 0: 'N', 1: 'R' };

/** Trennzeichen mehrerer Beschriftungen an einer Kante im Eingabefeld. */
export function labelSeparator(kind: ObjectKind): string {
  return kind === 'nka' || kind === 'tm' ? ';' : ',';
}

/** Anzeige im Graphen. */
export function showLabel(kind: ObjectKind, label: AnyLabel): string {
  switch (kind) {
    case 'dea':
    case 'moore':
      return showSym(label as Sym);
    case 'nea':
      return showWord(label as Word);
    case 'mealy': {
      const l = label as MealyLabel;
      return `${showSym(l.in)} / ${showSym(l.out)}`;
    }
    case 'nka': {
      const l = label as NkaLabel;
      return `${showSym(l.top)}, ${l.read === null ? 'ε' : showSym(l.read)} → ${showWord(l.push)}`;
    }
    case 'tm': {
      const l = label as TmLabel;
      return `${showSym(l.read)} → ${showSym(l.write)}, ${MOVE_SHOW[l.move]}`;
    }
  }
}

/** Ein Symbol als bearbeitbarer Text (Maskierung wie labelInput). */
function symInput(s: Sym, extra = ''): string {
  if (s.length > 1) return `<${s}>`;
  if (/[,\\<\s;]/u.test(s) || extra.includes(s) || s === 'ε') return `\\${s}`;
  return s;
}

/** Text im Eingabefeld des Graphen. */
export function editLabel(kind: ObjectKind, label: AnyLabel): string {
  switch (kind) {
    case 'dea':
    case 'moore':
      return symInput(label as Sym);
    case 'nea':
      return labelInput(label as Word);
    case 'mealy': {
      const l = label as MealyLabel;
      return `${symInput(l.in, '/')}/${symInput(l.out, '/')}`;
    }
    case 'nka': {
      const l = label as NkaLabel;
      return `${symInput(l.top)}, ${l.read === null ? 'ε' : symInput(l.read)} -> ${l.push.length ? l.push.map((s) => symInput(s)).join('') : 'ε'}`;
    }
    case 'tm': {
      const l = label as TmLabel;
      return `${symInput(l.read)} -> ${symInput(l.write)}, ${MOVE_SHOW[l.move]}`;
    }
  }
}

export function editLabels(kind: ObjectKind, labels: AnyLabel[]): string {
  return labels.map((l) => editLabel(kind, l)).join(`${labelSeparator(kind)} `);
}

/** Genau ein Symbol (sonst null). */
function oneSym(text: string): Sym | null {
  const w = parseInputWord(text);
  return w && w.length === 1 ? w[0]! : null;
}

/** Teilt an einem unmaskierten Pfeil -> oder →. */
function splitArrow(text: string): [string, string] | null {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') {
      i++;
      continue;
    }
    if (text[i] === '→') return [text.slice(0, i), text.slice(i + 1)];
    if (text[i] === '-' && text[i + 1] === '>') return [text.slice(0, i), text.slice(i + 2)];
  }
  return null;
}

export const LABEL_HINT: Record<ObjectKind, string> = {
  dea: 'a, b',
  nea: 'a, 01, ε',
  mealy: '0/1, 1/0',
  moore: 'a, b',
  nka: '⊥, a -> a⊥; a, b -> ε',
  tm: 'a -> b, R; □ -> □, L',
};

export const LABEL_HELP: Record<ObjectKind, string> = {
  dea: 'Ein Symbol je Beschriftung, mehrere durch Komma.',
  nea: 'Ein Wort je Beschriftung (auch ε), mehrere durch Komma.',
  mealy: 'Eingabe/Ausgabe, z. B. 0/1; mehrere durch Komma.',
  moore: 'Ein Symbol je Beschriftung; die Ausgabe steht am Zustand.',
  nka: 'Kellersymbol oben, Eingabe (oder ε) -> gekellertes Wort (erstes Symbol oben); mehrere durch Semikolon.',
  tm: 'gelesen -> geschrieben, Richtung L/N/R; mehrere durch Semikolon.',
};

/** Liest das Eingabefeld einer Kante in Beschriftungen des Typs. */
export function parseLabelsFor(kind: ObjectKind, input: string): { labels: AnyLabel[]; error?: string } {
  const parts = splitUnescaped(input, labelSeparator(kind));
  const labels: AnyLabel[] = [];
  const bad = (p: string) => ({ labels, error: `„${p}" passt nicht. ${LABEL_HELP[kind]}` });
  for (const p of parts) {
    switch (kind) {
      case 'dea':
      case 'moore': {
        const s = oneSym(p);
        if (s === null) return bad(p);
        labels.push(s);
        break;
      }
      case 'nea': {
        const w = parseInputWord(p);
        if (w === null) return bad(p);
        labels.push(w);
        break;
      }
      case 'mealy': {
        const halves = splitUnescaped(p, '/');
        if (halves.length !== 2) return bad(p);
        const a = oneSym(halves[0]!);
        const b = oneSym(halves[1]!);
        if (a === null || b === null) return bad(p);
        labels.push({ in: a, out: b });
        break;
      }
      case 'nka': {
        const arrow = splitArrow(p);
        if (!arrow) return bad(p);
        const left = splitUnescaped(arrow[0]);
        if (left.length !== 2) return bad(p);
        const top = oneSym(left[0]!);
        const readW = parseInputWord(left[1]!);
        const push = parseInputWord(arrow[1]);
        if (top === null || readW === null || readW.length > 1 || push === null) return bad(p);
        labels.push({ top, read: readW[0] ?? null, push });
        break;
      }
      case 'tm': {
        const arrow = splitArrow(p);
        if (!arrow) return bad(p);
        const right = splitUnescaped(arrow[1]);
        if (right.length !== 2) return bad(p);
        const read = oneSym(arrow[0]);
        const write = oneSym(right[0]!);
        const d = right[1]!.trim().toUpperCase();
        const move = d === 'L' || d === '-1' ? -1 : d === 'N' || d === '0' ? 0 : d === 'R' || d === '1' || d === '+1' ? 1 : null;
        if (read === null || write === null || move === null) return bad(p);
        labels.push({ read, write, move });
        break;
      }
    }
  }
  return { labels };
}
