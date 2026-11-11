// Erklärungstexte der Verfahrensschritte. Der Kern liefert Schlüssel und Parameter:
// Zustands-IDs beziehen sich auf view.obj, Parameter mit Präfix `src` auf die Quelle.
import {
  isAutomaton,
  printRegex,
  subexprAt,
  type FormalObject,
  type ProcStep,
  type Production,
  type Word,
} from '../../core/index';
import { showSym, showWord } from './format';
import { t } from '../i18n';

function nameIn(obj: FormalObject | undefined, id: string): string | null {
  if (!obj || !isAutomaton(obj)) return null;
  return obj.states.find((s) => s.id === id)?.name ?? null;
}

function set(names: string[]): string {
  return names.length === 0 ? '∅' : `{${names.join(', ')}}`;
}

function production(obj: FormalObject | undefined, id: string): string | null {
  if (!obj || obj.kind !== 'grammatik') return null;
  const p: Production | undefined = obj.productions.find((x) => x.id === id);
  return p ? `${showWord(p.left)} → ${showWord(p.right)}` : null;
}

function transition(obj: FormalObject | undefined, id: string): string | null {
  if (!obj || !isAutomaton(obj)) return null;
  const tr = obj.transitions.find((x) => x.id === id);
  if (!tr) return null;
  const l = tr.label as unknown;
  const lab = typeof l === 'string' ? showSym(l) : Array.isArray(l) ? showWord(l as Word) : '…';
  return `${nameIn(obj, tr.from)} —${lab}→ ${nameIn(obj, tr.to)}`;
}

/** Wert eines Parameters lesbar machen; ctx = Objekt, auf das sich IDs beziehen. */
function show(key: string, v: unknown, ctx: FormalObject | undefined, src: FormalObject | undefined): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? t('yes') : t('no');
  if (typeof v === 'number') return String(v);
  const k = key.replace(/^src/, '').toLowerCase();
  if (k === 'word' || k === 'w' || k === 'w1' || k === 'w2') return Array.isArray(v) ? showWord(v as Word) : String(v);
  if (k === 'path' && Array.isArray(v) && src?.kind === 'regex' && src.expr) {
    const e = subexprAt(src.expr, v as number[]);
    return e ? printRegex(e) : '?';
  }
  if (k === 'symbol' || k === 'sym') return typeof v === 'string' ? showSym(v) : String(v);
  if (typeof v === 'string') {
    return (
      nameIn(ctx, v) ??
      production(ctx, v) ??
      transition(ctx, v) ??
      nameIn(src, v) ??
      production(src, v) ??
      transition(src, v) ??
      (k.includes('state') || k.includes('set') ? v : showSym(v))
    );
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return k === 'word' ? 'ε' : '∅';
    if (v.every((x) => Array.isArray(x))) return (v as unknown[][]).map((x) => show(key, x, ctx, src)).join(', ');
    if (v.every((x) => typeof x === 'string')) {
      const ids = v as string[];
      // Zustandsmengen in Zustandsreihenfolge, wie in den Tabellen.
      const order = (o: FormalObject | undefined): string[] =>
        o && isAutomaton(o) ? [...ids].sort((a, b) => o.states.findIndex((s) => s.id === a) - o.states.findIndex((s) => s.id === b)) : ids;
      const names = order(ctx).map((id) => nameIn(ctx, id) ?? transition(ctx, id) ?? production(ctx, id));
      if (names.every((n) => n !== null)) return set(names as string[]);
      const srcNames = order(src).map((id) => nameIn(src, id));
      if (srcNames.every((n) => n !== null)) return set(srcNames as string[]);
      return showWord(ids);
    }
    return v.map((x) => show(key, x, ctx, src)).join(', ');
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('from' in o && 'to' in o) {
      const sym = 'symbol' in o ? show('symbol', o.symbol, ctx, src) : 'word' in o ? show('word', o.word, ctx, src) : 'ε';
      return `${show('state', o.from, ctx, src)} —${sym}→ ${show('state', o.to, ctx, src)}`;
    }
    return Object.values(o)
      .map((x) => show(key, x, ctx, src))
      .join(', ');
  }
  return String(v);
}

export function explainProc(step: ProcStep, sources: FormalObject[]): string {
  const ctx = step.view.obj;
  const src = sources[0];
  const p: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(step.explanation.params)) {
    const useSrc = k.startsWith('src') ? src : undefined;
    p[k] = show(k, v, useSrc ?? ctx, src);
  }
  const key = step.explanation.key;
  // Phasen von 2.70 haben je einen eigenen Text.
  if (key === 'proc.phase' || key === 'proc.phase.skip') return t(`explain.${key}.${String(step.explanation.params.phase)}`);
  if (key === 'proc.egrep.anchor') {
    const q = step.explanation.params;
    return t(`explain.proc.egrep.anchor.${String(q.which)}.${q.present ? 'drop' : 'pad'}`);
  }
  return t(`explain.${key}`, p);
}
