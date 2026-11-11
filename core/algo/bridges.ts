// Brücken: endliche Menge → DEA (Präfixbaum, nicht im Skript) und der Plan einer Kette bis zum minimalen DEA.
import type { DEA, FormalObject, MengeObj, MethodId, ProcOptions, ProcResult, State, StateId, Sym, Transition } from '../model/types';
import { parseEgrep, egrepHasBackref } from '../model/egrep';
import {
  compactNames,
  guard,
  isStateName,
  layoutAuto,
  limitAbort,
  limits,
  missingPairs,
  mkDea,
  mkOrigin,
  need,
  newRec,
  resultName,
  snapAuto,
  uniqueName,
} from './common';
import { type3Violations } from './grammarops';

/** Präfixbaum der Menge, ergänzt um einen Fangzustand (nicht im Skript). */
export function mengeToDea(m: MengeObj, opts: ProcOptions = {}): ProcResult<DEA> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('menge2dea', m, ['menge']);
    const lim = limits(opts).maxStates;
    const X = m.alphabet;
    const prefixes: string[][] = [[]]; // Präfix je Zustand s<k>
    const child = new Map<string, number>();
    const trans: Transition<Sym>[] = [];
    const accept = new Set<number>();
    const states = (): State[] => prefixes.map((_, i) => ({ id: `s${i}`, name: `q${i}` }));
    const mk = (): DEA =>
      mkDea(m.name, X, states(), 's0', [...accept].sort((a, b) => a - b).map((i) => `s${i}`), trans.map((t) => ({ ...t })));
    for (const w of m.words) {
      let cur = 0;
      const newStates: StateId[] = [];
      const added: string[] = [];
      for (const x of w) {
        const k = `${cur}\u0000${x}`;
        let nx = child.get(k);
        if (nx === undefined) {
          if (prefixes.length + 1 > lim) limitAbort('states', lim);
          nx = prefixes.length;
          prefixes.push([...(prefixes[cur] as string[]), x]);
          child.set(k, nx);
          const id = `t${trans.length}`;
          trans.push({ id, from: `s${cur}`, to: `s${nx}`, label: x });
          newStates.push(`s${nx}`);
          added.push(id);
        }
        cur = nx;
      }
      accept.add(cur);
      rec.add('proc.trie.word', { word: w, newStates }, () => ({
        obj: snapAuto(mk()),
        highlight: [...newStates, `s${cur}`].map((s) => ({ state: s })),
        added,
      }));
    }
    // Fangzustand für fehlende Übergänge
    const have = new Set(trans.map((t) => `${t.from}\u0000${t.label}`));
    const missing: { from: number; x: Sym }[] = [];
    prefixes.forEach((_, i) => X.forEach((x) => { if (!have.has(`s${i}\u0000${x}`)) missing.push({ from: i, x }); }));
    // Zustandsnamen
    const raw = prefixes.map((p) => (p.length === 0 ? 'ε' : p.join('')));
    const valid = raw.every(isStateName) && new Set(raw).size === raw.length && !raw.includes('∅');
    const named: State[] = compactNames(prefixes.map((_, i) => ({ id: `s${i}`, name: valid ? (raw[i] as string) : `q${i}` })));
    const used = new Set(named.map((s) => s.name));
    let trapId: StateId;
    let count = missing.length;
    if (m.words.length === 0) {
      trapId = 's0'; // nur der Startzustand, nicht akzeptierend, mit Schleifen
    } else if (missing.length === 0) {
      trapId = '';
    } else {
      if (prefixes.length + 1 > lim) limitAbort('states', lim);
      trapId = `s${prefixes.length}`;
      named.push({ id: trapId, name: uniqueName(used, '∅') });
      for (const x of X) missing.push({ from: prefixes.length, x });
      count = missing.length;
    }
    if (trapId !== '') {
      for (const e of missing) trans.push({ id: `t${trans.length}`, from: `s${e.from}`, to: trapId, label: e.x });
      const finish = (): DEA =>
        mkDea(m.name, X, named.map((s) => ({ ...s })), 's0', [...accept].sort((a, b) => a - b).map((i) => `s${i}`), trans.map((t) => ({ ...t })));
      rec.add('proc.trie.trap', { state: trapId, count }, () => ({
        obj: snapAuto(finish()),
        highlight: [{ state: trapId }],
        added: trans.slice(trans.length - count).map((t) => t.id),
      }));
    }
    const r = mkDea(
      resultName(opts, m, '_dea'),
      X,
      named,
      's0',
      [...accept].sort((a, b) => a - b).map((i) => `s${i}`),
      trans,
    );
    return { ...layoutAuto(r), origin: mkOrigin('menge2dea', [m]) };
  });
}

/** Verfahren, die nacheinander aus `o` einen minimalen DEA machen; null, wenn es keine Kette gibt. */
export function chainPlan(o: FormalObject, opts: { thompson?: boolean } = {}): MethodId[] | null {
  switch (o.kind) {
    case 'egrep': {
      const ast = parseEgrep(o.pattern).ast;
      if (ast === null || egrepHasBackref(ast)) return null;
      return ['egrep2regex', 'regex2grammar', 'grammar2nea', 'nea2dea', 'minimize'];
    }
    case 'regex':
      return opts.thompson === true
        ? ['thompson', 'nea2dea', 'minimize']
        : ['regex2grammar', 'grammar2nea', 'nea2dea', 'minimize'];
    case 'grammatik':
      return type3Violations(o).length === 0 ? ['grammar2nea', 'nea2dea', 'minimize'] : null;
    case 'nea':
      return ['nea2dea', 'minimize'];
    case 'dea':
      return missingPairs(o).length > 0 ? null : ['minimize'];
    case 'menge':
      return ['menge2dea', 'minimize'];
    default:
      return null;
  }
}
