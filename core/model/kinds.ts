// Kind-Registry: je Objektart ein Eintrag; Parser, Printer, Validierung, JSON-Prüfung und Simulator
// rufen typspezifische Teile hier ab. Neuer Typ = neuer Eintrag.
import { printSymbol, printWord } from '../text/word';
import { simulateDea } from '../sim/dea';
import { simulateMealy, simulateMoore } from '../sim/mealy';
import { simulateNea } from '../sim/nea';
import { simulateNka } from '../sim/nka';
import { simulateTm } from '../sim/tm';
import { validateDea, validateMealy, validateMoore, validateNea, validateNka, validateTm } from './checks';
import type {
  Automaton,
  Diagnostic,
  MealyLabel,
  NkaLabel,
  ObjectKind,
  SimOptions,
  State,
  StateId,
  Sym,
  TmLabel,
  Trace,
  Transition,
  Word,
} from './types';
import { withLabelSymbols, type AnyLabel } from './util';

export type { AnyLabel };

/** Kopfanweisungen, die nur einzelne Typen kennen (vom Parser gesammelt). */
export interface Extras {
  outputAlphabet: Sym[] | null;
  stackAlphabet: Sym[] | null;
  tapeAlphabet: Sym[] | null;
  y0: Sym | null;
  /** nka: `akzeptanz leer`. */
  acceptBy: 'empty' | null;
  blank: Sym | null;
  reject: StateId[];
  /** tm: Kopfzeile `lba`. */
  bounded?: boolean;
  /** Moore: g(Zustand) = Symbol. */
  out: Map<StateId, Sym>;
}

export interface ParsedBase {
  name: string;
  /** null = keine `alphabet`-Anweisung. */
  alphabet: Sym[] | null;
  states: State[];
  start: StateId | null;
  accept: StateId[];
  transitions: Transition<AnyLabel>[];
}

export type MakeLabelResult =
  | { ok: true; label: AnyLabel }
  | { ok: false; code: 'dea.labelLength' | 'label.shape'; params: Record<string, unknown> };

export interface KindSpec {
  kind: ObjectKind;
  /** Schlüsselwort in der Textsprache. */
  keyword: string;
  /** Zusätzliche Kopfanweisungen dieses Typs (zu alphabet states start accept layout). */
  keywords: readonly string[];
  /** true: Übergänge in Zeilenform (`z, y, x -> z', v`), sonst Kantenform. */
  lineForm: boolean;
  empty(name: string): Automaton;
  /** Kantenform: wandelt ein gelesenes Label (Symbole + Rohtext der Symbole) in die Kantenbeschriftung. */
  makeLabel(word: Word, raws: string[]): MakeLabelResult;
  /** Kantenform: Label als Text. */
  printLabel(label: AnyLabel): string;
  /** Baut das Objekt aus dem Parse-Ergebnis; fehlende Alphabete werden abgeleitet. */
  finish(base: ParsedBase, extras: Extras): Automaton;
  /** Kopfzeilen nach `alphabet`, vor `states` (Ausgabe-/Keller-/Bandalphabet, keller, blank). */
  printHead(obj: Automaton): string[];
  /** Zustände, die nach `accept` in Kopfzeilen vorkommen (in Druckreihenfolge). */
  tailRefs(obj: Automaton): StateId[];
  /** Kopfzeilen nach `accept` (reject, out). */
  printTail(obj: Automaton, nm: (id: StateId) => string): string[];
  validate(obj: Automaton): Diagnostic[];
  /** Prüft die typspezifischen JSON-Felder (Labels, Zusatzfelder); liefert den Grund oder null. */
  checkJson(obj: Record<string, unknown>, ids: ReadonlySet<string>): string | null;
  simulate(obj: Automaton, word: Word, opts: SimOptions): Trace;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

function mismatch(): never {
  throw new Error('kind mismatch');
}

const noHead = (): string[] => [];
const noRefs = (): StateId[] => [];

function jsonLabels(obj: Obj, ok: (l: unknown) => boolean, what: string): string | null {
  const ts = obj.transitions as unknown[];
  for (let i = 0; i < ts.length; i++) {
    if (!ok((ts[i] as Obj).label)) return `transitions[${i}].label: ${what} expected`;
  }
  return null;
}

function inferAlphabet<O extends Automaton>(obj: O, base: ParsedBase): O {
  // Alphabete aus den Übergängen ableiten; explizit gesetzte werden danach wieder eingesetzt.
  const inferred = withLabelSymbols(obj, base.transitions.map((t) => t.label));
  return base.alphabet === null ? inferred : { ...inferred, alphabet: base.alphabet };
}

function baseOf(kind: ObjectKind, base: ParsedBase): Obj {
  return {
    kind,
    name: base.name,
    alphabet: [] as Sym[],
    states: base.states,
    start: base.start,
    accept: base.accept,
    transitions: base.transitions,
  };
}

const deaSpec: KindSpec = {
  kind: 'dea',
  keyword: 'dea',
  keywords: [],
  lineForm: false,
  empty: (name) => ({ kind: 'dea', name, alphabet: [], states: [], start: null, accept: [], transitions: [] }),
  makeLabel: (word) =>
    word.length === 1
      ? { ok: true, label: word[0] as Sym }
      : { ok: false, code: 'dea.labelLength', params: { label: word } },
  printLabel: (label) => (typeof label === 'string' ? printSymbol(label) : printWord(label as Word)),
  finish: (base) => inferAlphabet(baseOf('dea', base) as unknown as Automaton, base),
  printHead: noHead,
  tailRefs: noRefs,
  printTail: noHead,
  validate(obj) {
    if (obj.kind !== 'dea') return mismatch();
    return validateDea(obj);
  },
  checkJson: (obj) => jsonLabels(obj, isStr, 'string'),
  simulate(obj, word, opts) {
    if (obj.kind !== 'dea') return mismatch();
    return simulateDea(obj, word, opts);
  },
};

const neaSpec: KindSpec = {
  kind: 'nea',
  keyword: 'nea',
  keywords: [],
  lineForm: false,
  empty: (name) => ({ kind: 'nea', name, alphabet: [], states: [], start: null, accept: [], transitions: [] }),
  makeLabel: (word) => ({ ok: true, label: word }),
  printLabel: (label) => printWord(typeof label === 'string' ? [label] : (label as Word)),
  finish: (base) => inferAlphabet(baseOf('nea', base) as unknown as Automaton, base),
  printHead: noHead,
  tailRefs: noRefs,
  printTail: noHead,
  validate(obj) {
    if (obj.kind !== 'nea') return mismatch();
    return validateNea(obj);
  },
  checkJson: (obj) => jsonLabels(obj, isStrArr, 'string[]'),
  simulate(obj, word, opts) {
    if (obj.kind !== 'nea') return mismatch();
    return simulateNea(obj, word, opts);
  },
};

/** In Mealy-Labels ist `/` Trennzeichen und als Symbol als `\/` zu schreiben. */
const mealySym = (s: Sym): string => (s === '/' ? '\\/' : printSymbol(s));

const mealySpec: KindSpec = {
  kind: 'mealy',
  keyword: 'mealy',
  keywords: ['ausgabealphabet'],
  lineForm: false,
  empty: (name) => ({
    kind: 'mealy',
    name,
    alphabet: [],
    outputAlphabet: [],
    states: [],
    start: null,
    accept: [],
    transitions: [],
  }),
  makeLabel(word, raws) {
    const shape = { ok: false, code: 'label.shape', params: { kind: 'mealy', text: raws.join('') } } as const;
    const at = raws.indexOf('/');
    if (at < 0 || raws.indexOf('/', at + 1) >= 0 || at !== 1 || raws.length !== 3) return shape;
    return { ok: true, label: { in: word[0] as Sym, out: word[2] as Sym } };
  },
  printLabel(label) {
    const l = label as MealyLabel;
    return `${mealySym(l.in)}/${mealySym(l.out)}`;
  },
  finish(base, extras) {
    const o = { ...baseOf('mealy', base), outputAlphabet: [] as Sym[] } as unknown as Automaton;
    const r = inferAlphabet(o, base) as Automaton & { outputAlphabet: Sym[] };
    return extras.outputAlphabet === null ? r : { ...r, outputAlphabet: extras.outputAlphabet };
  },
  printHead(obj) {
    if (obj.kind !== 'mealy') return mismatch();
    return obj.outputAlphabet.length > 0 ? ['ausgabealphabet ' + obj.outputAlphabet.map(printSymbol).join(' ')] : [];
  },
  tailRefs: noRefs,
  printTail: noHead,
  validate(obj) {
    if (obj.kind !== 'mealy') return mismatch();
    return validateMealy(obj);
  },
  checkJson(obj) {
    if (!isStrArr(obj.outputAlphabet)) return 'outputAlphabet: string[] expected';
    return jsonLabels(obj, (l) => isObj(l) && isStr(l.in) && isStr(l.out), '{in,out}');
  },
  simulate(obj, word, opts) {
    if (obj.kind !== 'mealy') return mismatch();
    return simulateMealy(obj, word, opts);
  },
};

const mooreSpec: KindSpec = {
  kind: 'moore',
  keyword: 'moore',
  keywords: ['ausgabealphabet', 'out'],
  lineForm: false,
  empty: (name) => ({
    kind: 'moore',
    name,
    alphabet: [],
    outputAlphabet: [],
    states: [],
    start: null,
    accept: [],
    transitions: [],
  }),
  makeLabel: deaSpec.makeLabel,
  printLabel: deaSpec.printLabel,
  finish(base, extras) {
    const states = base.states.map((s) => {
      const out = extras.out.get(s.id);
      return out === undefined ? s : { ...s, out };
    });
    const o = { ...baseOf('moore', { ...base, states }), outputAlphabet: [] as Sym[] };
    const r = inferAlphabet(o as unknown as Automaton, base) as Automaton & { outputAlphabet: Sym[] };
    const outs: Sym[] = [];
    for (const s of states) {
      const out = (s as { out?: Sym }).out;
      if (out !== undefined && !outs.includes(out)) outs.push(out);
    }
    return { ...r, outputAlphabet: extras.outputAlphabet ?? outs };
  },
  printHead(obj) {
    if (obj.kind !== 'moore') return mismatch();
    return obj.outputAlphabet.length > 0 ? ['ausgabealphabet ' + obj.outputAlphabet.map(printSymbol).join(' ')] : [];
  },
  tailRefs(obj) {
    if (obj.kind !== 'moore') return mismatch();
    return obj.states.filter((s) => s.out !== undefined).map((s) => s.id);
  },
  printTail(obj, nm) {
    if (obj.kind !== 'moore') return mismatch();
    const pairs = obj.states.filter((s) => s.out !== undefined).map((s) => `${nm(s.id)}=${printSymbol(s.out as Sym)}`);
    return pairs.length > 0 ? ['out ' + pairs.join(' ')] : [];
  },
  validate(obj) {
    if (obj.kind !== 'moore') return mismatch();
    return validateMoore(obj);
  },
  checkJson(obj) {
    if (!isStrArr(obj.outputAlphabet)) return 'outputAlphabet: string[] expected';
    const st = obj.states as Obj[];
    for (let i = 0; i < st.length; i++) {
      const o = (st[i] as Obj).out;
      if (o !== undefined && !isStr(o)) return `states[${i}].out: string expected`;
    }
    return jsonLabels(obj, isStr, 'string');
  },
  simulate(obj, word, opts) {
    if (obj.kind !== 'moore') return mismatch();
    return simulateMoore(obj, word, opts);
  },
};

const DEFAULT_Y0 = '⊥';
const DEFAULT_BLANK = '□';

const nkaSpec: KindSpec = {
  kind: 'nka',
  keyword: 'nka',
  keywords: ['keller', 'kelleralphabet', 'akzeptanz'],
  lineForm: true,
  empty: (name) => ({
    kind: 'nka',
    name,
    alphabet: [],
    stackAlphabet: [DEFAULT_Y0],
    y0: DEFAULT_Y0,
    states: [],
    start: null,
    accept: [],
    transitions: [],
  }),
  makeLabel: () => ({ ok: false, code: 'label.shape', params: { kind: 'nka', text: '' } }),
  printLabel: () => '',
  finish(base, extras) {
    const y0 = extras.y0 ?? DEFAULT_Y0;
    const o = { ...baseOf('nka', base), stackAlphabet: [y0], y0 } as unknown as Automaton;
    const r = inferAlphabet(o, base) as Automaton & { stackAlphabet: Sym[]; acceptBy?: 'empty' };
    const r2 = extras.stackAlphabet === null ? r : { ...r, stackAlphabet: extras.stackAlphabet };
    return extras.acceptBy === 'empty' ? { ...r2, acceptBy: 'empty' as const } : r2;
  },
  printHead(obj) {
    if (obj.kind !== 'nka') return mismatch();
    const out: string[] = [];
    if (obj.stackAlphabet.length > 0) out.push('kelleralphabet ' + obj.stackAlphabet.map(printSymbol).join(' '));
    out.push('keller ' + printSymbol(obj.y0));
    if (obj.acceptBy === 'empty') out.push('akzeptanz leer');
    return out;
  },
  tailRefs: noRefs,
  printTail: noHead,
  validate(obj) {
    if (obj.kind !== 'nka') return mismatch();
    return validateNka(obj);
  },
  checkJson(obj) {
    if (!isStrArr(obj.stackAlphabet)) return 'stackAlphabet: string[] expected';
    if (!isStr(obj.y0)) return 'y0: string expected';
    if (obj.acceptBy !== undefined && obj.acceptBy !== 'final' && obj.acceptBy !== 'empty') return "acceptBy: 'final' | 'empty' expected";
    return jsonLabels(
      obj,
      (l) => isObj(l) && isStr(l.top) && (l.read === null || isStr(l.read)) && isStrArr(l.push),
      '{top,read,push}',
    );
  },
  simulate(obj, word, opts) {
    if (obj.kind !== 'nka') return mismatch();
    return simulateNka(obj, word, opts);
  },
};

/** Bewegung als Text: L N R. */
export function moveLetter(m: -1 | 0 | 1): string {
  return m < 0 ? 'L' : m > 0 ? 'R' : 'N';
}
/** Liest `L N R` (auch klein) bzw. `-1 0 1 +1`; sonst null. */
export function parseMove(text: string): -1 | 0 | 1 | null {
  switch (text) {
    case 'L':
    case 'l':
    case '-1':
      return -1;
    case 'N':
    case 'n':
    case '0':
      return 0;
    case 'R':
    case 'r':
    case '1':
    case '+1':
      return 1;
    default:
      return null;
  }
}

const tmSpec: KindSpec = {
  kind: 'tm',
  keyword: 'tm',
  keywords: ['bandalphabet', 'blank', 'reject', 'lba'],
  lineForm: true,
  empty: (name) => ({
    kind: 'tm',
    name,
    alphabet: [],
    tapeAlphabet: [DEFAULT_BLANK],
    blank: DEFAULT_BLANK,
    states: [],
    start: null,
    accept: [],
    reject: [],
    transitions: [],
  }),
  makeLabel: () => ({ ok: false, code: 'label.shape', params: { kind: 'tm', text: '' } }),
  printLabel: () => '',
  finish(base, extras) {
    const blank = extras.blank ?? DEFAULT_BLANK;
    const o = { ...baseOf('tm', base), tapeAlphabet: [] as Sym[], blank, reject: extras.reject } as unknown as Automaton & {
      tapeAlphabet: Sym[];
    };
    const symbols: Sym[] = [];
    for (const t of base.transitions) {
      const l = t.label as TmLabel;
      for (const s of [l.read, l.write]) if (!symbols.includes(s)) symbols.push(s);
    }
    const input = base.alphabet ?? symbols.filter((s) => s !== blank);
    const tape = extras.tapeAlphabet ?? [...new Set([...input, blank, ...symbols])];
    return { ...o, alphabet: input, tapeAlphabet: tape, ...(extras.bounded ? { bounded: true } : {}) } as Automaton;
  },
  printHead(obj) {
    if (obj.kind !== 'tm') return mismatch();
    const out: string[] = [];
    if (obj.tapeAlphabet.length > 0) out.push('bandalphabet ' + obj.tapeAlphabet.map(printSymbol).join(' '));
    out.push('blank ' + printSymbol(obj.blank));
    if (obj.bounded === true) out.push('lba');
    return out;
  },
  tailRefs(obj) {
    if (obj.kind !== 'tm') return mismatch();
    return obj.reject;
  },
  printTail(obj, nm) {
    if (obj.kind !== 'tm') return mismatch();
    return obj.reject.length > 0 ? ['reject ' + obj.reject.map(nm).join(' ')] : [];
  },
  validate(obj) {
    if (obj.kind !== 'tm') return mismatch();
    return validateTm(obj);
  },
  checkJson(obj, ids) {
    if (!isStrArr(obj.tapeAlphabet)) return 'tapeAlphabet: string[] expected';
    if (!isStr(obj.blank)) return 'blank: string expected';
    if (obj.bounded !== undefined && typeof obj.bounded !== 'boolean') return 'bounded: boolean expected';
    if (!isStrArr(obj.reject) || !obj.reject.every((r) => ids.has(r))) return 'reject: state ids expected';
    return jsonLabels(
      obj,
      (l) => isObj(l) && isStr(l.read) && isStr(l.write) && (l.move === -1 || l.move === 0 || l.move === 1),
      '{read,write,move}',
    );
  },
  simulate(obj, word, opts) {
    if (obj.kind !== 'tm') return mismatch();
    return simulateTm(obj, word, opts);
  },
};

export const kinds: readonly KindSpec[] = [deaSpec, neaSpec, mealySpec, mooreSpec, nkaSpec, tmSpec];

export function getKind(kind: ObjectKind): KindSpec {
  const k = kinds.find((s) => s.kind === kind);
  if (!k) throw new Error(`unknown kind ${kind}`);
  return k;
}

export function findKindByKeyword(keyword: string): KindSpec | undefined {
  return kinds.find((s) => s.keyword === keyword);
}

// Typen, die die Registry für Zeilenform-Parser/Printer nach außen reicht.
export type { NkaLabel, TmLabel };
