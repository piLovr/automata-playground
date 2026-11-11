// Wortproblem und Ableitungssuche für beliebige Grammatiken (5.13, 5.14, 7.3).
import { Abort, diag, need } from '../algo/common';
import { applicable, applyProduction } from '../derive/ops';
import { grammarType } from '../model/grammar';
import type {
  Derivation,
  Grammar,
  ProcResult,
  ProductionId,
  Sym,
  Word,
  WordProblemOptions,
  WordProblemResult,
} from '../model/types';

const keyOf = (f: Word): string => f.join('\u0001');

/**
 * Breitensuche über Satzformen ab [S]; liefert die kürzeste Ableitung.
 *
 * - Nicht verkürzende Grammatik (`nonContracting`): Satzformen länger als max(|w|, 1) werden verworfen.
 *   Dann ist die Menge der erreichbaren Satzformen endlich; wurde sie vollständig durchsucht, ist
 *   „nicht ableitbar“ bewiesen (`exact`).
 * - Sonst: Satzformen länger als `maxLength` (Standard |w| + 4) werden verworfen; ein Misserfolg
 *   heißt nur `unknown` – nie `notDerivable`.
 */
export function wordProblem(g: Grammar, w: Word, opts: WordProblemOptions = {}): ProcResult<WordProblemResult> {
  try {
    need('derive', g, ['grammatik']);
  } catch (e) {
    if (e instanceof Abort) return { ok: false, diagnostics: e.diags, steps: [] };
    return { ok: false, diagnostics: [diag('algo.invalid', { diagnostics: 0, reason: String(e) })], steps: [] };
  }
  const maxSteps = opts.maxSteps ?? 200000;
  const exactMode = grammarType(g).nonContracting;
  const maxLength = exactMode ? Math.max(w.length, 1) : (opts.maxLength ?? w.length + 4);
  const S = g.start as Sym;
  const target = keyOf(w);

  interface Node {
    form: Word;
    parent: number;
    step: { production: ProductionId; pos: number } | null;
  }
  const nodes: Node[] = [{ form: [S], parent: -1, step: null }];
  const seen = new Set<string>([keyOf([S])]);
  const build = (i: number): Derivation => {
    const steps: Derivation['steps'] = [];
    for (let k = i; k > 0; k = (nodes[k] as Node).parent) {
      const nd = nodes[k] as Node;
      const st = nd.step as { production: ProductionId; pos: number };
      steps.push({ production: st.production, pos: st.pos, form: nd.form });
    }
    return { start: [S], steps: steps.reverse() };
  };
  const result = (r: Partial<WordProblemResult> & Pick<WordProblemResult, 'verdict'>): ProcResult<WordProblemResult> => ({
    ok: true,
    result: { derivation: null, exact: false, maxLength, explored: nodes.length, limitHit: null, ...r },
    steps: [],
  });

  if (keyOf([S]) === target) return result({ verdict: 'derivable', derivation: build(0), exact: exactMode });
  let generated = 0;
  for (let qi = 0; qi < nodes.length; qi++) {
    const cur = nodes[qi] as Node;
    for (const a of applicable(g, cur.form)) {
      if (++generated > maxSteps) return result({ verdict: 'unknown', limitHit: 'steps' });
      const f = (applyProduction(g, cur.form, a.production, a.pos) as { form: Word }).form;
      if (f.length > maxLength) continue;
      const key = keyOf(f);
      if (seen.has(key)) continue;
      seen.add(key);
      nodes.push({ form: f, parent: qi, step: { production: a.production, pos: a.pos } });
      if (key === target) return result({ verdict: 'derivable', derivation: build(nodes.length - 1), exact: exactMode });
    }
  }
  if (exactMode) return result({ verdict: 'notDerivable', exact: true });
  return result({ verdict: 'unknown', limitHit: 'length' });
}
