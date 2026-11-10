import { runBatch, simulate, validate, type Diagnostic, type Trace, type Word } from '../../core/index';
import { store, type BatchRow } from './store.svelte';
import { parseInputWord } from './format';

/** Abgeleitete Sicht auf Simulation, Stapellauf und Prüfung des aktiven Objekts. */
class SimView {
  parsed = $derived.by((): { word: Word | null; error: boolean } => {
    const word = parseInputWord(store.word);
    return { word, error: word === null };
  });

  trace = $derived.by((): Trace | null => {
    const o = store.obj;
    const w = this.parsed.word;
    if (!o || !w) return null;
    return simulate(o, w, { stepLimit: store.simLimit });
  });

  /** Aktueller Schritt, auf den gültigen Bereich begrenzt. */
  index = $derived(this.trace ? Math.min(store.simStep, this.trace.steps.length - 1) : 0);
  step = $derived(this.trace?.steps[this.index]);
  atEnd = $derived(!this.trace || this.index >= this.trace.steps.length - 1);

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
    const results = runBatch(o, valid, { stepLimit: store.simLimit });
    let k = 0;
    return rows.map((r, i) => (parsed[i] ? { row: r, res: results[k++]! } : { row: r, res: null }));
  });
}

export const sim = new SimView();
