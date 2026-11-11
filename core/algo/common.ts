// Gemeinsame Hilfen der Verfahren: Schrittliste, Vorbedingungen, Objektbau, Herkunft.
import type {
  Automaton,
  Correspondence,
  DEA,
  Diagnostic,
  DiagnosticCode,
  FormalKind,
  FormalObject,
  MethodId,
  NEA,
  Origin,
  ProcOptions,
  ProcResult,
  ProcStep,
  State,
  StateId,
  StepView,
  Sym,
  Transition,
  Word,
} from '../model/types';
import { validate } from '../model/validate';
import { autoLayout } from '../layout/layout';
import { objectHash } from '../model/hash';

export { printRegex, regexSize, regexSymbols } from '../model/regex';

export function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

export function isAutomatonObj(o: FormalObject): o is Automaton {
  return o.kind !== 'regex' && o.kind !== 'grammatik' && o.kind !== 'egrep';
}

// ---------------------------------------------------------------------------
// Schritte und Abbruch

export class Abort {
  constructor(readonly diags: Diagnostic[]) {}
}

export class Rec {
  readonly steps: ProcStep[] = [];
  constructor(readonly on: boolean) {}
  /** `mk` muss frische (nicht geteilte) Objekte liefern. */
  add(
    key: string,
    params: Record<string, unknown>,
    mk: () => StepView,
    sourceHighlight?: ProcStep['sourceHighlight'],
  ): void {
    if (!this.on) return;
    const step: ProcStep = { explanation: { key, params: clone(params) }, view: mk() };
    if (sourceHighlight) step.sourceHighlight = clone(sourceHighlight);
    this.steps.push(step);
  }
}

export function diag(code: DiagnosticCode, params: Record<string, unknown> = {}, objectName?: string): Diagnostic {
  const d: Diagnostic = { severity: 'error', code, params };
  if (objectName !== undefined) d.objectName = objectName;
  return d;
}

export function abort(code: DiagnosticCode, params: Record<string, unknown> = {}, objectName?: string): never {
  throw new Abort([diag(code, params, objectName)]);
}

export function guard<R>(rec: Rec, fn: () => R): ProcResult<R> {
  try {
    const result = fn();
    return { ok: true, result, steps: rec.steps };
  } catch (e) {
    if (e instanceof Abort) return { ok: false, diagnostics: e.diags, steps: rec.steps };
    return {
      ok: false,
      diagnostics: [diag('algo.invalid', { diagnostics: 0, reason: String(e) })],
      steps: rec.steps,
    };
  }
}

export function newRec(opts: ProcOptions | undefined): Rec {
  return new Rec(opts?.steps !== false);
}

// ---------------------------------------------------------------------------
// Grenzen und Fortschritt

export function limits(opts: ProcOptions | undefined): { maxStates: number; maxExprSize: number } {
  return {
    maxStates: opts?.limits?.maxStates ?? 2000,
    maxExprSize: opts?.limits?.maxExprSize ?? 50000,
  };
}

export class Progress {
  private last = 0;
  constructor(private readonly cb: ((n: number) => void) | undefined) {}
  tick(n: number): void {
    if (!this.cb) return;
    const now = Date.now();
    if (now - this.last >= 50) {
      this.last = now;
      this.cb(n);
    }
  }
}

// ---------------------------------------------------------------------------
// Vorbedingungen

export function safeValidate(o: FormalObject): Diagnostic[] {
  try {
    return validate(o);
  } catch {
    return [];
  }
}

/** Art, gültig laut validate, Start vorhanden (Automaten, Grammatik). */
export function need(method: string, o: FormalObject, kinds: FormalKind[]): void {
  if (!kinds.includes(o.kind)) abort('algo.wrongKind', { method, kind: o.kind }, o.name);
  if (isAutomatonObj(o) && (o.start === null || !o.states.some((s) => s.id === o.start))) {
    abort('algo.noStart', {}, o.name);
  }
  if (o.kind === 'grammatik' && o.start === null) abort('algo.noStart', {}, o.name);
  if (o.kind === 'regex' && o.expr === null) abort('algo.invalid', { diagnostics: 1 }, o.name);
  const errs = safeValidate(o).filter((d) => d.severity === 'error');
  if (errs.length > 0) throw new Abort([diag('algo.invalid', { diagnostics: errs.length }, o.name), ...errs]);
}

export function missingPairs(m: DEA): { state: StateId; symbol: Sym }[] {
  const has = new Set(m.transitions.map((t) => `${t.from}\u0000${t.label}`));
  const out: { state: StateId; symbol: Sym }[] = [];
  for (const s of m.states) for (const x of m.alphabet) if (!has.has(`${s.id}\u0000${x}`)) out.push({ state: s.id, symbol: x });
  return out;
}

export function needTotal(m: DEA): void {
  const pairs = missingPairs(m);
  if (pairs.length > 0) abort('algo.incomplete', { pairs }, m.name);
}

export function limitAbort(what: 'states' | 'exprSize' | 'words', limit: number): never {
  return abort('algo.limit', { what, limit });
}

// ---------------------------------------------------------------------------
// Namen

export function charLen(s: string): number {
  return [...s].length;
}

/** Name einer Zustandsmenge aus den Elementnamen (in der gegebenen Reihenfolge). */
export function setName(names: string[]): string {
  if (names.length === 0) return '∅';
  return names.some((n) => charLen(n) > 1) ? names.join('_') : names.join('');
}

/**
 * Lange Mengennamen sind im Graphen nicht lesbar: Ist einer länger als 6 Zeichen,
 * heißen alle Zustände des Ergebnisses q0, q1, … (die Menge zeigt die Hervorhebung).
 */
export function compactNames<S extends { name: string }>(states: S[]): S[] {
  if (states.every((st) => charLen(st.name) <= 6)) return states;
  return states.map((st, i) => ({ ...st, name: `q${i}` }));
}

/** Mengenschreibweise für Tabellen: {A,B}, leere Menge ∅. */
export function setText(names: string[]): string {
  return names.length === 0 ? '∅' : `{${names.join(',')}}`;
}

/** Eindeutiger Name: `base`, bei Konflikt `base0`, `base1`, … */
export function uniqueName(used: Set<string>, base: string): string {
  let name = base;
  let n = 0;
  while (used.has(name)) name = `${base}${n++}`;
  used.add(name);
  return name;
}

export function isStateName(s: string): boolean {
  return /^[\p{L}\p{N}_+'∅][\p{L}\p{N}_+'∅\-−]*$/u.test(s);
}

// ---------------------------------------------------------------------------
// Objekte bauen

export function mkDea(
  name: string,
  alphabet: Sym[],
  states: State[],
  start: StateId | null,
  accept: StateId[],
  transitions: Transition<Sym>[],
): DEA {
  return { kind: 'dea', name, alphabet: alphabet.slice(), states, start, accept, transitions };
}

export function mkNea(
  name: string,
  alphabet: Sym[],
  states: State[],
  start: StateId | null,
  accept: StateId[],
  transitions: Transition<Word>[],
): NEA {
  return { kind: 'nea', name, alphabet: alphabet.slice(), states, start, accept, transitions };
}

export function layoutAuto<A extends Automaton>(a: A, max = 300): A {
  if (a.states.length === 0 || a.states.length > max) return a;
  const pos = autoLayout(a);
  return { ...a, states: a.states.map((s) => ({ ...s, pos: pos[s.id] })) } as A;
}

/** Eigenständiger Schnappschuss (tiefe Kopie, kleines Layout) für view.obj. */
export function snapAuto<A extends Automaton>(a: A): A {
  const c = clone(a);
  delete c.origin;
  return layoutAuto(c, 40);
}

export function snap<T extends FormalObject>(o: T): T {
  return clone(o);
}

export function mkId(prefix: string, n: number): string {
  return `${prefix}${n}`;
}

// ---------------------------------------------------------------------------
// Herkunft

export function mkOrigin(method: MethodId, sources: FormalObject[], corr: Correspondence[] = []): Origin {
  const o: Origin = { method, sources: sources.map((s) => s.name), sourceHash: sources.map((s) => objectHash(s)) };
  if (corr.length > 0) o.corr = corr;
  return o;
}

export function resultName(opts: ProcOptions | undefined, src: { name: string }, suffix: string): string {
  return opts?.name ?? src.name + suffix;
}

export function key2(a: string, b: string): string {
  return `${a}\u0000${b}`;
}
