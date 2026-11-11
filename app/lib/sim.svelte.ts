import { accepts, runBatch, simulate, validate, type BatchResult, type Diagnostic, type SimStep, type Trace, type Word } from '../../core/index';
import { store, type BatchRow } from './store.svelte';
import { parseInputWord } from './format';

/** Abgeleitete Sicht auf Simulation, Stapellauf und Prüfung des aktiven Objekts. */
class SimView {
  parsed = $derived.by((): { word: Word | null; error: boolean } => {
    const word = parseInputWord(store.word);
    return { word, error: word === null };
  });

  trace = $derived.by((): Trace | null => {
    const o = store.aut;
    const w = this.parsed.word;
    if (!o || !w || o.start === null) return null;
    return simulate(o, w, { stepLimit: store.simLimit });
  });

  /**
   * Gewählter Ast im Konfigurationsbaum (Kellerautomat). null = der Weg, den der Kern
   * ausgewählt hat (erste akzeptierende bzw. weiteste Konfiguration).
   */
  branch = $state<number | null>(null);

  /** Schrittfolge: die des Kerns oder der Weg zum gewählten Baumknoten. */
  steps = $derived.by((): SimStep[] => {
    const tr = this.trace;
    if (!tr) return [];
    if (this.branch === null || !tr.tree || store.aut?.kind !== 'nka') return tr.steps;
    const byId = new Map(tr.tree.map((n) => [n.id, n]));
    const path = [];
    for (let n = byId.get(this.branch); n; n = n.parent === null ? undefined : byId.get(n.parent)) path.unshift(n);
    if (path.length === 0) return tr.steps;
    return path.map((n, i) => ({
      pos: n.pos,
      active: [n.state],
      fired: n.via ? [n.via] : [],
      stack: n.stack,
      explanation: i === 0 ? { key: 'sim.start', params: { active: [n.state] } } : { key: 'sim.branch', params: { state: n.state, pos: n.pos } },
    }));
  });

  /** Aktueller Schritt, auf den gültigen Bereich begrenzt. */
  index = $derived(Math.max(0, Math.min(store.simStep, this.steps.length - 1)));
  step = $derived(this.steps[this.index]);
  atEnd = $derived(this.index >= this.steps.length - 1);

  active = $derived(new Set(this.step?.active ?? []));
  fired = $derived(new Set(this.step?.fired ?? []));

  diagnostics = $derived.by((): Diagnostic[] => (store.obj ? validate(store.obj) : []));
  errors = $derived(this.diagnostics.filter((d) => d.severity === 'error'));

  /** Zustände mit fehlenden DEA-Übergängen (für das Warnzeichen im Graphen). */
  incomplete = $derived.by(() => {
    const s = new Set<string>();
    for (const d of this.diagnostics) {
      if (d.code !== 'dea.missing') continue;
      for (const p of (d.params.pairs as { state: string }[]) ?? []) s.add(p.state);
    }
    return s;
  });

  batch = $derived.by(() => {
    const o = store.obj;
    if (!o) return [];
    const rows: BatchRow[] = store.batch;
    const parsed = rows.map((r) => parseInputWord(r.input));
    const valid = parsed.flatMap((w, i) => (w ? [{ word: w, expected: rows[i]!.expected }] : []));
    const aut = store.aut;
    // Ausdruck und Grammatik: Zugehörigkeit über den Kern (intern als DEA).
    const results: BatchResult[] = aut
      ? runBatch(aut, valid, { stepLimit: store.simLimit })
      : valid.map(({ word, expected }) => {
          const a = accepts(o, word);
          const result = a === null ? 'stuck' : a ? 'accepted' : 'rejected';
          return { word, expected, result, ok: expected === null || a === null ? null : a === expected };
        });
    let k = 0;
    return rows.map((r, i) => (parsed[i] ? { row: r, res: results[k++]! } : { row: r, res: null }));
  });
}

export const sim = new SimView();
