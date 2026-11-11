/// <reference types="node" />
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isAutomaton, parseDocument, toLatex, toLatexTable, toTikz } from '../index';
import type { Automaton, FormalObject } from '../index';

const load = (file: string): FormalObject[] =>
  parseDocument(readFileSync(new URL(`../../examples/${file}.txt`, import.meta.url), 'utf8')).doc.objects;
const aut = (file: string): Automaton => load(file).find(isAutomaton) as Automaton;
const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;

describe('toTikz', () => {
  it.each(['b2-3', 'b2-10', 'b2-66', 'b4-6', 'b5-9'])('%s: Struktur', (f) => {
    const a = aut(f);
    const t = toTikz(a);
    expect(count(t, /\\node\[/g)).toBe(a.states.length);
    expect(count(t, /initial,/g)).toBe(a.start ? 1 : 0);
    const acc = a.kind === 'mealy' || a.kind === 'moore' ? 0 : a.accept.length + (a.kind === 'tm' ? a.reject.length : 0);
    expect(count(t, /\(s\d+\) at/g)).toBe(a.states.length);
    expect(count(t, /\\node\[[^\]]*accepting/g)).toBe(acc);
    const pairs = new Set(a.transitions.map((x) => `${x.from}>${x.to}`));
    expect(count(t, / edge/g)).toBe(pairs.size);
    expect(t).toContain('\\documentclass');
    expect(toTikz(a)).toBe(t);
  });

  it('Moore-Ausgabe, Schleifen, Gegenrichtung, ohne Dokumentrahmen', () => {
    const t = toTikz(aut('b2-10'), { standalone: false });
    expect(t).not.toContain('\\documentclass');
    expect(t).toContain('$A/0$');
    expect(t).toContain('loop above');
    expect(t).toContain('\\begin{tikzpicture}');
  });

  it('Positionen mit Maßstab, y gespiegelt', () => {
    const t = toTikz(aut('b2-10'), { scale: 2 });
    expect(t).toContain('at (0.00, 0.00)');
    expect(t).toContain('at (4.80, 1.60)'); // B@240,-80
  });

  it('TM: reject-Stil, NKA: mehrere Beschriftungen gestapelt', () => {
    expect(toTikz(aut('b5-9'))).toContain('reject');
    expect(toTikz(aut('b4-6'))).toContain('\\to');
  });
});

describe('toLatexTable / toLatex', () => {
  it.each(['b2-3', 'b2-10', 'b2-66', 'b4-6', 'b5-9'])('%s: tabular', (f) => {
    const t = toLatexTable(aut(f));
    expect(t.startsWith('\\begin{tabular}')).toBe(true);
    expect(t.trimEnd().endsWith('\\end{tabular}')).toBe(true);
    expect(count(t, /\\\\/g)).toBeGreaterThan(1);
  });

  it('DEA: Start und Endzustand markiert', () => {
    const t = toLatexTable(aut('b2-3'));
    expect(t).toContain('\\to');
    expect(t).toContain('{*}');
  });

  it('Regex, Grammatik, egrep', () => {
    const re = toLatex(load('ra-endet01')[0]!);
    expect(re).toContain('\\mid');
    expect(re).toContain('^{*}');
    const g = toLatex(load('b2-44')[0]!);
    expect(g).toContain('\\begin{align*}');
    expect(g).toContain('\\to');
    expect(g).toContain('\\varepsilon');
    expect(toLatex({ kind: 'egrep', name: 'e', pattern: 'a_b#$~^\\{x}', alphabet: [] })).toBe(
      '\\texttt{a\\_b\\#\\$\\textasciitilde{}\\textasciicircum{}\\textbackslash{}\\{x\\}}\n',
    );
  });

  it('Menge', () => {
    const s = toLatex({ kind: 'menge', name: 'L', alphabet: ['0', '1'], words: [[], ['0'], ['1', '0']] });
    expect(s).toContain('\\{\\varepsilon, 0, 10\\}');
  });

  it('Automat: Tupel plus Tabelle', () => {
    const s = toLatex(aut('b2-3'));
    expect(s).toContain('align*');
    expect(s).toContain('\\begin{tabular}');
  });
});

let hasPdflatex = true;
try {
  execFileSync('pdflatex', ['--version'], { stdio: 'ignore' });
} catch {
  hasPdflatex = false;
}

describe('pdflatex', () => {
  (hasPdflatex ? it : it.skip)('standalone-Dokument kompiliert', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tikz-'));
    for (const f of ['b2-3', 'b4-6', 'b5-9']) {
      writeFileSync(join(dir, `${f}.tex`), toTikz(aut(f)));
      execFileSync('pdflatex', ['-interaction=nonstopmode', '-halt-on-error', `${f}.tex`], { cwd: dir, stdio: 'ignore' });
    }
  });
});
