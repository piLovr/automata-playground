// Typspezifische und gemeinsame Prüfungen (Teil von validate).
import type { Automaton, DEA, Diagnostic, NEA } from './types';
import { labelWord, transitionsOf } from './util';

function common(obj: Automaton): Diagnostic[] {
  const out: Diagnostic[] = [];
  const base = { objectName: obj.name } as const;
  if (obj.states.length > 0 && obj.start === null) {
    out.push({ severity: 'error', code: 'model.noStart', params: {}, ...base });
  }
  const seen = new Set<string>();
  for (const s of obj.states) {
    if (seen.has(s.name)) {
      out.push({
        severity: 'error',
        code: 'model.duplicateStateName',
        params: { name: s.name },
        stateId: s.id,
        ...base,
      });
    }
    seen.add(s.name);
  }
  const alpha = new Set(obj.alphabet);
  for (const t of transitionsOf(obj)) {
    const reported = new Set<string>();
    for (const sym of labelWord(t.label)) {
      if (!alpha.has(sym) && !reported.has(sym)) {
        reported.add(sym);
        out.push({
          severity: 'error',
          code: 'model.symbolNotInAlphabet',
          params: { symbol: sym, transitionId: t.id },
          transitionId: t.id,
          ...base,
        });
      }
    }
  }
  return out;
}

export function validateDea(obj: DEA): Diagnostic[] {
  const out = common(obj);
  const base = { objectName: obj.name } as const;
  for (const t of obj.transitions) {
    const w = labelWord(t.label);
    if (w.length !== 1) {
      out.push({
        severity: 'error',
        code: 'dea.labelLength',
        params: { label: w, transitionId: t.id },
        transitionId: t.id,
        ...base,
      });
    }
  }
  const groups = new Map<string, { state: string; symbol: string; ids: string[] }>();
  for (const t of obj.transitions) {
    const w = labelWord(t.label);
    if (w.length !== 1) continue;
    const key = JSON.stringify([t.from, w[0]]);
    const g = groups.get(key) ?? { state: t.from, symbol: w[0] ?? '', ids: [] };
    g.ids.push(t.id);
    groups.set(key, g);
  }
  for (const g of groups.values()) {
    if (g.ids.length > 1) {
      out.push({
        severity: 'error',
        code: 'dea.nondeterministic',
        params: { state: g.state, symbol: g.symbol, transitionIds: g.ids },
        stateId: g.state,
        ...base,
      });
    }
  }
  const pairs: { state: string; symbol: string }[] = [];
  for (const s of obj.states) {
    for (const x of obj.alphabet) {
      if (!groups.has(JSON.stringify([s.id, x]))) pairs.push({ state: s.id, symbol: x });
    }
  }
  if (pairs.length > 0) {
    out.push({ severity: 'warning', code: 'dea.missing', params: { pairs }, ...base });
  }
  return out;
}

export function validateNea(obj: NEA): Diagnostic[] {
  return common(obj);
}
