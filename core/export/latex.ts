// LaTeX-Export: Tabellen der Automaten, Ausdrücke, Grammatiken, Mengen, egrep-Muster.
import type { Automaton, FormalObject, Grammar, MengeObj, RegExpr, Word } from '../model/types';
import { latexEscape, mathLabel, mathSet, mathState, mathStateOf, mathSym, mathWord } from './tex';

const wordKey = (w: Word): string => JSON.stringify(w);

/** Zustandsmarken wie in der Tabellen-Sicht: → für Start, * für F. */
function rowHead(o: Automaton, id: string): string {
  const acc = o.kind !== 'mealy' && o.kind !== 'moore' && o.accept.includes(id);
  const pre = (o.start === id ? '\\to' : '') + (acc ? '{*}' : '');
  const name = mathStateOf(o, id);
  return pre === '' ? name : `${pre}\\,${name}`;
}

const MISSING = '--';

export function toLatexTable(o: Automaton): string {
  if (o.kind === 'nka' || o.kind === 'tm') {
    const cols = o.kind === 'tm' ? ['z', 'y', "z'", "y'", 'd'] : ['z', 'y', 'x', "z'", 'v'];
    const lines = [`\\begin{tabular}{lll|ll}`];
    lines.push(cols.map((c) => `$${c}$`).join(' & ') + ' \\\\ \\hline');
    for (const t of o.transitions) {
      const from = mathStateOf(o, t.from);
      const to = mathStateOf(o, t.to);
      let cells: string[];
      if (o.kind === 'tm') {
        const l = t.label as { read: string; write: string; move: number };
        cells = [from, mathSym(l.read), to, mathSym(l.write), `\\mathrm{${l.move < 0 ? 'L' : l.move > 0 ? 'R' : 'N'}}`];
      } else {
        const l = t.label as { top: string; read: string | null; push: Word };
        cells = [from, mathSym(l.top), l.read === null ? '\\varepsilon' : mathSym(l.read), to, mathWord(l.push)];
      }
      lines.push(cells.map((c) => `$${c}$`).join(' & ') + ' \\\\');
    }
    lines.push('\\end{tabular}');
    return lines.join('\n') + '\n';
  }

  // Spalten: Wörter; NEA = ε, Alphabet, weitere benutzte Wörter
  const cols: Word[] = o.alphabet.map((a) => [a]);
  if (o.kind === 'nea') {
    const seen = new Set([wordKey([]), ...cols.map(wordKey)]);
    const extra: Word[] = [];
    for (const t of o.transitions) {
      if (!seen.has(wordKey(t.label))) {
        seen.add(wordKey(t.label));
        extra.push(t.label);
      }
    }
    cols.unshift([]);
    cols.push(...extra);
  }
  const matches = (label: unknown, w: Word): boolean =>
    o.kind === 'nea'
      ? wordKey(label as Word) === wordKey(w)
      : w.length === 1 && (o.kind === 'mealy' ? (label as { in: string }).in : label) === w[0];

  const moore = o.kind === 'moore';
  const spec = 'l|' + 'c'.repeat(cols.length) + (moore ? '|c' : '');
  const lines = [`\\begin{tabular}{${spec}}`];
  const head = [o.kind === 'nea' ? '$g$' : '$f$', ...cols.map((w) => `$${mathWord(w)}$`)];
  if (moore) head.push('$g$');
  lines.push(head.join(' & ') + ' \\\\ \\hline');
  for (const s of o.states) {
    const cells = cols.map((w) => {
      const trs = o.transitions.filter((t) => t.from === s.id && matches(t.label, w));
      if (trs.length === 0) return MISSING;
      if (o.kind === 'nea') return `$${mathSet(trs.map((t) => mathStateOf(o, t.to)))}$`;
      if (o.kind === 'mealy') {
        return '$' + trs.map((t) => `${mathStateOf(o, t.to)}/${mathLabel('dea', (t.label as { out: string }).out)}`).join(', ') + '$';
      }
      return '$' + trs.map((t) => mathStateOf(o, t.to)).join(', ') + '$';
    });
    const row = [`$${rowHead(o, s.id)}$`, ...cells];
    if (moore) {
      const out = (s as { out?: string }).out;
      row.push(out === undefined ? MISSING : `$${mathSym(out)}$`);
    }
    lines.push(row.join(' & ') + ' \\\\');
  }
  lines.push('\\end{tabular}');
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------

function exprLevel(e: RegExpr): number {
  return e.op === 'union' ? 1 : e.op === 'concat' ? 2 : e.op === 'star' ? 3 : 4;
}

function regexMath(e: RegExpr, parent = 0): string {
  let s: string;
  switch (e.op) {
    case 'empty':
      s = '\\emptyset';
      break;
    case 'sym':
      s = mathSym(e.sym);
      break;
    case 'union':
      s = `${regexMath(e.left, 1)} \\mid ${regexMath(e.right, 2)}`;
      break;
    case 'concat':
      s = `${regexMath(e.left, 2)}${regexMath(e.right, 3)}`;
      break;
    case 'star':
      s = `${regexMath(e.inner, 4)}^{*}`;
      break;
  }
  return exprLevel(e) < parent ? `(${s})` : s;
}

function nameMath(name: string): string {
  return `\\mathrm{${latexEscape(name)}}`;
}

function grammarLatex(g: Grammar): string {
  const lines = ['\\begin{align*}'];
  lines.push(`N &= ${mathSet(g.nonterminals.map(mathSym))} \\\\`);
  lines.push(`T &= ${mathSet(g.terminals.map(mathSym))} \\\\`);
  lines.push(`S &= ${g.start === null ? '\\emptyset' : mathSym(g.start)}`);
  lines.push('\\end{align*}');
  // Regeln mit gleicher linker Seite zusammenfassen (Reihenfolge der ersten Nennung)
  const groups = new Map<string, { left: Word; rights: Word[] }>();
  for (const p of g.productions) {
    const k = wordKey(p.left);
    const grp = groups.get(k);
    if (grp) grp.rights.push(p.right);
    else groups.set(k, { left: p.left, rights: [p.right] });
  }
  if (groups.size > 0) {
    lines.push('\\begin{align*}');
    const rows = [...groups.values()].map((grp) => `${mathWord(grp.left)} &\\to ${grp.rights.map(mathWord).join(' \\mid ')}`);
    lines.push(rows.join(' \\\\\n'));
    lines.push('\\end{align*}');
  }
  return lines.join('\n') + '\n';
}

function mengeLatex(m: MengeObj): string {
  const items = m.words.map(mathWord);
  if (m.upTo !== undefined) items.push('\\dots');
  return `\\[ ${nameMath(m.name)} = ${mathSet(items)} \\]\n`;
}

const TUPLE: Record<Automaton['kind'], string> = {
  dea: '(Z, z_0, X, f, F)',
  nea: '(Z, z_0, X, g, F)',
  mealy: '(Z, z_0, X, f, Y, g)',
  moore: '(Z, z_0, X, f, Y, g)',
  nka: '(Z, z_0, X, Y, y_0, f, F)',
  tm: '(Z, z_0, X, Y, f, F_{+}, F_{-})',
};

function automatonLatex(o: Automaton): string {
  const ids = (xs: string[]) => mathSet(xs.map((id) => mathStateOf(o, id)));
  const rows = [
    `M &= ${TUPLE[o.kind]}`,
    `Z &= ${mathSet(o.states.map((s) => mathState(s.name)))}`,
    `z_0 &= ${o.start === null ? '\\emptyset' : mathStateOf(o, o.start)}`,
    `X &= ${mathSet(o.alphabet.map(mathSym))}`,
  ];
  if (o.kind === 'mealy' || o.kind === 'moore') rows.push(`Y &= ${mathSet(o.outputAlphabet.map(mathSym))}`);
  if (o.kind === 'nka') rows.push(`Y &= ${mathSet(o.stackAlphabet.map(mathSym))}`, `y_0 &= ${mathSym(o.y0)}`);
  if (o.kind === 'tm') {
    rows.push(`Y &= ${mathSet(o.tapeAlphabet.map(mathSym))}`, `F_{-} &= ${ids(o.reject)}`);
  }
  if (o.kind !== 'mealy' && o.kind !== 'moore') rows.push(`${o.kind === 'tm' ? 'F_{+}' : 'F'} &= ${ids(o.accept)}`);
  return `\\begin{align*}\n${rows.join(' \\\\\n')}\n\\end{align*}\n\n${toLatexTable(o)}`;
}

export function toLatex(o: FormalObject): string {
  switch (o.kind) {
    case 'regex':
      return `\\[ ${nameMath(o.name)} = ${o.expr === null ? '\\emptyset' : regexMath(o.expr)} \\]\n`;
    case 'grammatik':
      return grammarLatex(o);
    case 'menge':
      return mengeLatex(o);
    case 'egrep':
      return `\\texttt{${latexEscape(o.pattern)}}\n`;
    default:
      return automatonLatex(o);
  }
}
