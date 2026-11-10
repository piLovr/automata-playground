// Typspezifische und gemeinsame Prüfungen (Teil von validate).
import type { Automaton, DEA, Diagnostic, Mealy, Moore, NEA, NKA, TM, TransitionId } from './types';
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
  const report = (sym: string, t: { id: string }): void => {
    out.push({
      severity: 'error',
      code: 'model.symbolNotInAlphabet',
      params: { symbol: sym, transitionId: t.id },
      transitionId: t.id,
      ...base,
    });
  };
  const missing = (sym: string, extra: Record<string, unknown> = {}): void => {
    out.push({ severity: 'error', code: 'model.symbolNotInAlphabet', params: { symbol: sym, ...extra }, ...base });
  };
  const X = new Set(obj.alphabet);
  const Y = new Set<string>(
    obj.kind === 'mealy' || obj.kind === 'moore'
      ? obj.outputAlphabet
      : obj.kind === 'nka'
        ? obj.stackAlphabet
        : obj.kind === 'tm'
          ? obj.tapeAlphabet
          : [],
  );
  for (const t of transitionsOf(obj)) {
    const l = t.label;
    const reported = new Set<string>();
    const check = (sym: string, set: Set<string>): void => {
      if (!set.has(sym) && !reported.has(sym)) {
        reported.add(sym);
        report(sym, t);
      }
    };
    if (typeof l === 'object' && !Array.isArray(l)) {
      if ('in' in l) {
        check(l.in, X);
        check(l.out, Y);
      } else if ('top' in l) {
        if (l.read !== null) check(l.read, X);
        check(l.top, Y);
        for (const y of l.push) check(y, Y);
      } else {
        check(l.read, Y);
        check(l.write, Y);
      }
    } else {
      for (const sym of labelWord(l)) check(sym, X);
    }
  }
  if (obj.kind === 'moore') {
    for (const s of obj.states) {
      if (s.out !== undefined && !Y.has(s.out)) missing(s.out, { stateId: s.id });
    }
  } else if (obj.kind === 'nka') {
    if (!Y.has(obj.y0)) missing(obj.y0);
  } else if (obj.kind === 'tm') {
    if (!Y.has(obj.blank)) missing(obj.blank);
  }
  return out;
}

export function validateDea(obj: DEA | Moore): Diagnostic[] {
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

export function validateMoore(obj: Moore): Diagnostic[] {
  const out = validateDea(obj);
  const none = obj.states.filter((s) => s.out === undefined).map((s) => s.id);
  if (none.length > 0) {
    out.push({ severity: 'warning', code: 'moore.missingOut', params: { states: none }, objectName: obj.name });
  }
  return out;
}

export function validateMealy(obj: Mealy): Diagnostic[] {
  const out = common(obj);
  const base = { objectName: obj.name } as const;
  const groups = new Map<string, { state: string; symbol: string; ids: string[] }>();
  for (const t of obj.transitions) {
    const key = JSON.stringify([t.from, t.label.in]);
    const g = groups.get(key) ?? { state: t.from, symbol: t.label.in, ids: [] };
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
  if (pairs.length > 0) out.push({ severity: 'warning', code: 'dea.missing', params: { pairs }, ...base });
  return out;
}

export function validateNka(obj: NKA): Diagnostic[] {
  const out = common(obj);
  const base = { objectName: obj.name } as const;
  for (const t of obj.transitions) {
    if (t.label.top === obj.y0 && t.label.push[t.label.push.length - 1] !== obj.y0) {
      out.push({
        severity: 'error',
        code: 'nka.y0',
        params: { transitionId: t.id },
        transitionId: t.id,
        ...base,
      });
    }
  }
  // DKA-Bedingungen (4.4), je Gruppe (z, y)
  const groups = new Map<string, typeof obj.transitions>();
  for (const t of obj.transitions) {
    const key = JSON.stringify([t.from, t.label.top]);
    const g = groups.get(key) ?? [];
    g.push(t);
    groups.set(key, g);
  }
  for (const g of groups.values()) {
    const eps = g.filter((t) => t.label.read === null);
    const bad = new Set<TransitionId>();
    if (eps.length > 1) eps.forEach((t) => bad.add(t.id));
    if (eps.length > 0 && eps.length < g.length) g.forEach((t) => bad.add(t.id));
    const byX = new Map<string, TransitionId[]>();
    for (const t of g) {
      if (t.label.read === null) continue;
      const l = byX.get(t.label.read) ?? [];
      l.push(t.id);
      byX.set(t.label.read, l);
    }
    for (const ids of byX.values()) if (ids.length > 1) ids.forEach((id) => bad.add(id));
    if (bad.size > 0) {
      const ids = g.filter((t) => bad.has(t.id)).map((t) => t.id);
      out.push({
        severity: 'warning',
        code: 'nka.nondeterministic',
        params: { transitionIds: ids },
        stateId: g[0]?.from,
        ...base,
      });
    }
  }
  return out;
}

export function validateTm(obj: TM): Diagnostic[] {
  const out = common(obj);
  const base = { objectName: obj.name } as const;
  const groups = new Map<string, { state: string; symbol: string; ids: string[] }>();
  for (const t of obj.transitions) {
    const key = JSON.stringify([t.from, t.label.read]);
    const g = groups.get(key) ?? { state: t.from, symbol: t.label.read, ids: [] };
    g.ids.push(t.id);
    groups.set(key, g);
  }
  for (const g of groups.values()) {
    if (g.ids.length > 1) {
      out.push({
        severity: 'error',
        code: 'tm.nondeterministic',
        params: { state: g.state, symbol: g.symbol, transitionIds: g.ids },
        stateId: g.state,
        ...base,
      });
    }
  }
  const finals = new Set([...obj.accept, ...obj.reject]);
  for (const s of obj.states) {
    if (!finals.has(s.id)) continue;
    const ids = obj.transitions.filter((t) => t.from === s.id).map((t) => t.id);
    if (ids.length > 0) {
      out.push({
        severity: 'error',
        code: 'tm.leavesFinal',
        params: { state: s.id, transitionIds: ids },
        stateId: s.id,
        ...base,
      });
    }
  }
  const both = obj.states.filter((s) => obj.accept.includes(s.id) && obj.reject.includes(s.id)).map((s) => s.id);
  if (both.length > 0) out.push({ severity: 'error', code: 'tm.finalOverlap', params: { states: both }, ...base });
  return out;
}
