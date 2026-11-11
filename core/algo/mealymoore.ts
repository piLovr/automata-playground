// Mealy ↔ Moore (nicht im Skript). Moore-Ausgabe des Startzustands entfällt (ungesetzt), damit die Ausgabewörter gleich lang sind.
import type {
  Correspondence,
  Mealy,
  Moore,
  ProcOptions,
  ProcResult,
  State,
  StateId,
  Sym,
  Transition,
} from '../model/types';
import {
  abort,
  diag,
  Abort,
  charLen,
  guard,
  layoutAuto,
  mkOrigin,
  need,
  newRec,
  resultName,
  snapAuto,
  uniqueName,
} from './common';

export function mealyToMoore(m: Mealy, opts: ProcOptions = {}): ProcResult<Moore> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('mealy2moore', m, ['mealy']);
    // Totalität: für jedes (Zustand, Eingabe) genau eine Kante
    const has = new Set(m.transitions.map((t) => `${t.from}\u0000${t.label.in}`));
    const pairs = m.states.flatMap((s) => m.alphabet.filter((x) => !has.has(`${s.id}\u0000${x}`)).map((x) => ({ state: s.id, symbol: x })));
    if (pairs.length > 0) abort('algo.incomplete', { pairs }, m.name);
    const nameOf = (id: StateId): string => (m.states.find((s) => s.id === id) as State).name;
    const delta = new Map<string, Transition<{ in: Sym; out: Sym }>>();
    for (const t of m.transitions) if (!delta.has(`${t.from}\u0000${t.label.in}`)) delta.set(`${t.from}\u0000${t.label.in}`, t);
    // Moore-Zustände: (z, y) mit y = null für den Start
    const list: { z: StateId; y: Sym | null }[] = [{ z: m.start as StateId, y: null }];
    const keyOf = new Map<string, number>([[`${m.start}\u0000`, 0]]);
    const used = new Set<string>();
    const states: (State & { out?: Sym })[] = [];
    const trans: Transition<Sym>[] = [];
    const mk = (): Moore => ({
      kind: 'moore',
      name: m.name,
      alphabet: m.alphabet.slice(),
      outputAlphabet: m.outputAlphabet.slice(),
      states: states.map((s) => ({ ...s })),
      start: 's0',
      accept: [],
      transitions: trans.map((t) => ({ ...t })),
    });
    const nameFor = (e: { z: StateId; y: Sym | null }): string => {
      const zn = nameOf(e.z);
      if (e.y === null) return uniqueName(used, zn);
      return uniqueName(used, charLen(zn) > 1 || charLen(e.y) > 1 ? `${zn}_${e.y}` : `${zn}${e.y}`);
    };
    const corr: Correspondence[] = [];
    for (let k = 0; k < list.length; k++) {
      const e = list[k] as { z: StateId; y: Sym | null };
      const st: State & { out?: Sym } = { id: `s${k}`, name: nameFor(e) };
      if (e.y !== null) st.out = e.y;
      states.push(st);
      corr.push({ target: { state: st.id }, source: 0, elems: [{ state: e.z }] });
      for (const x of m.alphabet) {
        const t = delta.get(`${e.z}\u0000${x}`) as Transition<{ in: Sym; out: Sym }>;
        const key = `${t.to}\u0000${t.label.out}`;
        let i = keyOf.get(key);
        if (i === undefined) {
          i = list.length;
          list.push({ z: t.to, y: t.label.out });
          keyOf.set(key, i);
        }
        trans.push({ id: `t${trans.length}`, from: st.id, to: `s${i}`, label: x });
      }
      rec.add('proc.mealy2moore.state', { state: st.id, srcState: e.z, out: e.y }, () => ({ obj: snapAuto(mk()) }), {
        source: 0,
        elems: [{ state: e.z }],
      });
    }
    const accAll = new Set(m.accept);
    const r: Moore = { ...mk(), name: resultName(opts, m, '_moore') };
    r.accept = list.map((e, i) => (accAll.has(e.z) ? `s${i}` : null)).filter((x): x is string => x !== null);
    return { ...layoutAuto(r), origin: mkOrigin('mealy2moore', [m], corr) };
  });
}

export function mooreToMealy(m: Moore, opts: ProcOptions = {}): ProcResult<Mealy> {
  const rec = newRec(opts);
  return guard(rec, () => {
    need('moore2mealy', m, ['moore']);
    const out = new Map(m.states.map((s) => [s.id, s.out]));
    const missing = [...new Set(m.transitions.map((t) => t.to))].filter((id) => out.get(id) === undefined);
    if (missing.length > 0) throw new Abort([diag('moore.missingOut', { states: missing }, m.name)]);
    const states: State[] = m.states.map((s) => ({ id: s.id, name: s.name }));
    const trans: Transition<{ in: Sym; out: Sym }>[] = [];
    const mk = (): Mealy => ({
      kind: 'mealy',
      name: m.name,
      alphabet: m.alphabet.slice(),
      outputAlphabet: m.outputAlphabet.slice(),
      states: states.map((s) => ({ ...s })),
      start: m.start,
      accept: m.accept.slice(),
      transitions: trans.map((t) => ({ ...t, label: { ...t.label } })),
    });
    const corr: Correspondence[] = [];
    for (const s of m.states) {
      const ids: string[] = [];
      for (const t of m.transitions) {
        if (t.from !== s.id) continue;
        const id = `t${trans.length}`;
        trans.push({ id, from: t.from, to: t.to, label: { in: t.label, out: out.get(t.to) as Sym } });
        corr.push({ target: { transition: id }, source: 0, elems: [{ transition: t.id }, { state: t.to }] });
        ids.push(id);
      }
      corr.push({ target: { state: s.id }, source: 0, elems: [{ state: s.id }] });
      rec.add('proc.moore2mealy.state', { state: s.id, transitions: ids }, () => ({ obj: snapAuto(mk()), added: ids }), {
        source: 0,
        elems: [{ state: s.id }],
      });
    }
    const r: Mealy = { ...mk(), name: resultName(opts, m, '_mealy') };
    return { ...layoutAuto(r), origin: mkOrigin('moore2mealy', [m], corr) };
  });
}

