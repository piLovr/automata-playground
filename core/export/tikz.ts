// TikZ-Export eines Automaten (Bibliotheken automata, positioning, arrows.meta).
import { autoLayout } from '../layout/layout';
import type { Automaton, Point, TikzOptions, Transition } from '../model/types';
import { mathLabel, mathState } from './tex';

function num(v: number): string {
  const s = (Math.round(v * 100) / 100).toFixed(2);
  return s === '-0.00' ? '0.00' : s;
}

const HAS_STACK_LABELS = new Set(['nka', 'tm']);

export function toTikz(o: Automaton, opts: TikzOptions = {}): string {
  const standalone = opts.standalone ?? true;
  const scale = opts.scale ?? 1.6;
  const layout = o.states.some((s) => s.pos === undefined) ? autoLayout(o, { keep: true }) : {};
  const posOf = (id: string): Point => o.states.find((s) => s.id === id)?.pos ?? layout[id] ?? { x: 0, y: 0 };
  const index = new Map(o.states.map((s, i) => [s.id, i]));
  const node = (id: string): string => `s${index.get(id) ?? 0}`;
  const rejects = o.kind === 'tm' ? new Set(o.reject) : new Set<string>();
  const accepts = o.kind === 'mealy' || o.kind === 'moore' ? new Set<string>() : new Set(o.accept);

  const lines: string[] = [];
  if (standalone) {
    lines.push('\\documentclass[tikz,border=4pt]{standalone}');
    lines.push('\\usepackage{amssymb}');
    lines.push('\\usetikzlibrary{automata,positioning,arrows.meta}');
    lines.push('\\begin{document}');
  } else {
    lines.push('% benötigt \\usepackage{tikz,amssymb} und \\usetikzlibrary{automata,positioning,arrows.meta}');
  }
  lines.push('\\begin{tikzpicture}[>={Stealth[round]}, shorten >=1pt, auto, semithick,');
  lines.push('  reject/.style={double, dashed}]');

  for (const s of o.states) {
    const opt = ['state'];
    if (o.start === s.id) opt.push('initial', 'initial text={}');
    if (accepts.has(s.id)) opt.push('accepting');
    if (rejects.has(s.id)) opt.push('accepting', 'reject');
    const p = posOf(s.id);
    let text = mathState(s.name);
    if (o.kind === 'moore') {
      const out = (s as { out?: string }).out;
      text += `/${out === undefined ? '?' : mathLabel('dea', out)}`;
    }
    lines.push(`  \\node[${opt.join(', ')}] (${node(s.id)}) at (${num((p.x / 100) * scale)}, ${num((-p.y / 100) * scale)}) {$${text}$};`);
  }

  // Kanten mit gleichem (from, to) zusammenfassen
  const groups = new Map<string, { from: string; to: string; labels: unknown[] }>();
  for (const t of o.transitions as Transition<unknown>[]) {
    const key = `${t.from}\u0000${t.to}`;
    const g = groups.get(key);
    if (g) g.labels.push(t.label);
    else groups.set(key, { from: t.from, to: t.to, labels: [t.label] });
  }
  if (groups.size > 0) {
    lines.push('  \\path[->]');
    for (const g of groups.values()) {
      const opt: string[] = [];
      if (g.from === g.to) opt.push('loop above');
      else if (groups.has(`${g.to}\u0000${g.from}`)) opt.push('bend left=20');
      const parts = g.labels.map((l) => mathLabel(o.kind, l));
      const text =
        HAS_STACK_LABELS.has(o.kind) && parts.length > 1
          ? `\\shortstack{${parts.map((p) => `$${p}$`).join('\\\\')}}`
          : `$${parts.join(',')}$`;
      lines.push(`    (${node(g.from)}) edge${opt.length ? `[${opt.join(', ')}]` : ''} node[auto]{${text}} (${node(g.to)})`);
    }
    lines[lines.length - 1] += ';';
  }
  lines.push('\\end{tikzpicture}');
  if (standalone) lines.push('\\end{document}');
  return lines.join('\n') + '\n';
}
