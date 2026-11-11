// Zeit- und Platzbedarf einer TM je Eingabelänge (5.20).
import { runTmFast } from '../sim/tm';
import type { TM, TmCostOptions, TmCostRow, Word } from '../model/types';

/** Schritte = Anzahl der Anwendungen von f (Trace-Schritte − 1); Felder = alle Felder, auf denen der Kopf stand. */
export function tmCost(tm: TM, opts: TmCostOptions = {}): TmCostRow[] {
  const stepLimit = opts.stepLimit ?? 10000;
  const perLength = opts.perLength ?? 2000;
  const byLen = new Map<number, Word[]>();
  if (opts.words) {
    for (const w of opts.words) {
      const l = byLen.get(w.length) ?? [];
      l.push(w);
      byLen.set(w.length, l);
    }
  } else {
    const maxLen = opts.maxLen ?? 6;
    const alpha = tm.alphabet;
    for (let n = 0; n <= maxLen; n++) {
      const list: Word[] = [];
      if (n === 0) list.push([]);
      else if (alpha.length > 0) {
        // Längen-lexikographisch: Zähler zur Basis |alphabet|, höchstens perLength Wörter
        const idx = new Array<number>(n).fill(0);
        for (;;) {
          list.push(idx.map((i) => alpha[i] as string));
          if (list.length >= perLength) break;
          let k = n - 1;
          while (k >= 0 && (idx[k] as number) === alpha.length - 1) idx[k--] = 0;
          if (k < 0) break;
          idx[k] = (idx[k] as number) + 1;
        }
      }
      byLen.set(n, list);
    }
  }
  const rows: TmCostRow[] = [];
  for (const n of [...byLen.keys()].sort((a, b) => a - b)) {
    const ws = (byLen.get(n) as Word[]).slice(0, opts.words ? undefined : perLength);
    const row: TmCostRow = { n, words: ws.length, halted: 0, maxSteps: null, maxVisited: null, worstWord: null };
    for (const w of ws) {
      const r = runTmFast(tm, w, stepLimit);
      if (r.result === 'limit') continue;
      row.halted++;
      if (row.maxSteps === null || r.steps > row.maxSteps) {
        row.maxSteps = r.steps;
        row.worstWord = w;
      }
      if (row.maxVisited === null || r.visited > row.maxVisited) row.maxVisited = r.visited;
    }
    rows.push(row);
  }
  return rows;
}
