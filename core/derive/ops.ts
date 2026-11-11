// Ableitungsschritte (4.17): Anwendbarkeit, Anwendung, Ableitungen verlängern.
import type { Derivation, Diagnostic, Grammar, ProductionId, Sym, Word } from '../model/types';

function matchesAt(form: Word, left: Word, pos: number): boolean {
  if (left.length === 0 || pos < 0 || pos + left.length > form.length) return false;
  for (let k = 0; k < left.length; k++) if (form[pos + k] !== left[k]) return false;
  return true;
}

function notApplicable(production: ProductionId, pos: number): { error: Diagnostic } {
  return { error: { severity: 'error', code: 'derive.notApplicable', params: { production, pos } } };
}

/** Alle (Produktion, Stelle), deren linke Seite in der Satzform an dieser Stelle steht; nach Produktion, dann Stelle. */
export function applicable(g: Grammar, form: Word): { production: ProductionId; pos: number }[] {
  const out: { production: ProductionId; pos: number }[] = [];
  for (const p of g.productions) {
    for (let pos = 0; pos + p.left.length <= form.length; pos++) {
      if (matchesAt(form, p.left, pos)) out.push({ production: p.id, pos });
    }
  }
  return out;
}

export function applyProduction(
  g: Grammar,
  form: Word,
  production: ProductionId,
  pos: number,
): { form: Word } | { error: Diagnostic } {
  const p = g.productions.find((q) => q.id === production);
  if (!p || !matchesAt(form, p.left, pos)) return notApplicable(production, pos);
  return { form: [...form.slice(0, pos), ...p.right, ...form.slice(pos + p.left.length)] };
}

/** Index des linkesten Nichtterminals, sonst null. */
export function leftmostPos(g: Grammar, form: Word): number | null {
  const n = new Set<Sym>(g.nonterminals);
  const i = form.findIndex((s) => n.has(s));
  return i < 0 ? null : i;
}

export function startDerivation(g: Grammar): Derivation {
  return { start: g.start === null ? [] : [g.start], steps: [] };
}

export function extend(
  g: Grammar,
  d: Derivation,
  production: ProductionId,
  pos: number,
): Derivation | { error: Diagnostic } {
  const last = d.steps.length > 0 ? (d.steps[d.steps.length - 1] as { form: Word }).form : d.start;
  const r = applyProduction(g, last, production, pos);
  if ('error' in r) return r;
  return { start: d.start.slice(), steps: [...d.steps.map((s) => ({ ...s, form: s.form.slice() })), { production, pos, form: r.form }] };
}
