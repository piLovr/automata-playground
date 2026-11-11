// M3, Teil C: Export (TikZ, LaTeX-Tabelle, LaTeX-Mathe) – Struktur statt Wortlaut.
// Erwartungen aus docs/kern-spec-m3.md (Teil B, C) und den Beispielen in examples/.
// Nur die öffentliche Schnittstelle core/index.ts.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseDocument, toLatex, toLatexTable, toTikz } from '../index';
import type { Automaton, Diagnostic, Document, FormalObject } from '../index';

const EX = fileURLToPath(new URL('../../examples/', import.meta.url));

function loadEx(file: string): Document {
  const { doc, diagnostics } = parseDocument(readFileSync(join(EX, file), 'utf8'));
  expect(diagnostics.filter((d: Diagnostic) => d.severity === 'error')).toEqual([]);
  return doc;
}

function obj<T extends FormalObject = FormalObject>(doc: Document, name: string): T {
  const o = doc.objects.find((x) => x.name === name);
  if (!o) throw new Error(`Objekt ${name} fehlt`);
  return o as T;
}

function parse(text: string): Document {
  const { doc, diagnostics } = parseDocument(text);
  expect(diagnostics.filter((d: Diagnostic) => d.severity === 'error')).toEqual([]);
  return doc;
}

/** Anzahl der Treffer eines Musters im Text. */
const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;

const DEA_23 = obj<Automaton>(loadEx('b2-3.txt'), 'Dualzahl');
const MOORE_210 = obj<Automaton>(loadEx('b2-10.txt'), 'Dualzahl_g');
const NEA_266 = obj<Automaton>(loadEx('b2-66.txt'), 'N2_66');
const NEA_261 = obj<Automaton>(loadEx('b2-61.txt'), 'N2_61');
const MEALY = obj<Automaton>(loadEx('mealy-paritaet.txt'), 'Paritaet');
const NKA_46 = obj<Automaton>(loadEx('b4-6.txt'), 'NullEins');
const TM_INC = obj<Automaton>(loadEx('tm-inc.txt'), 'PlusEins');
const TM_59 = obj<Automaton>(loadEx('b5-9.txt'), 'Palindrom_TM');

// ---------------------------------------------------------------------------
// TikZ: Grundstruktur

describe('toTikz: Grundstruktur (DEA 2.3)', () => {
  const tex = toTikz(DEA_23, { standalone: false });

  it('ist ein tikzpicture ohne Dokumentrahmen, wenn standalone false', () => {
    expect(tex).toMatch(/\\begin\{tikzpicture\}/);
    expect(tex).toMatch(/\\end\{tikzpicture\}/);
    expect(tex).not.toMatch(/\\documentclass/);
  });

  it('standalone (Standard) enthält \\documentclass{standalone} und die Bibliotheken', () => {
    const full = toTikz(DEA_23);
    expect(full).toMatch(/\\documentclass(\[[^\]]*\])?\{standalone\}/);
    expect(full).toMatch(/\\usetikzlibrary\{\s*automata\s*,\s*positioning\s*,\s*arrows\.meta\s*\}/);
  });

  it('vier Knoten, genau ein initial, genau ein accepting (B)', () => {
    expect(count(tex, /\\node\b/g)).toBe(4);
    // "initial text={}" ist eine Stiloption und zählt nicht als Startzustand
    expect(count(tex, /\binitial\b(?!\s*text)/g)).toBe(1);
    expect(count(tex, /\baccepting\b/g)).toBe(1);
  });

  it('sieben Kanten (je Paar (from,to) einmal), zwei Schleifen, keine gebogenen Gegenkanten', () => {
    // Paare: A→B, A→M, M→B, M→Q, B→B, B→Q, Q→Q
    expect(count(tex, /\bedge\b/g)).toBe(7);
    expect(count(tex, /loop above/g)).toBe(2);
    expect(count(tex, /bend left/g)).toBe(0);
  });

  it('Kantenbeschriftung 0,1 steht zusammen (aus dem Graphen übernommen)', () => {
    expect(tex).toMatch(/0\s*,\s*1/);
  });

  it('gleiche Eingabe liefert gleichen Text (deterministisch)', () => {
    expect(toTikz(DEA_23, { standalone: false })).toBe(tex);
    expect(toTikz(obj<Automaton>(loadEx('b2-3.txt'), 'Dualzahl'), { standalone: false })).toBe(tex);
  });
});

describe('toTikz: Positionen aus dem Layout (x = pos.x/100·scale, y = −pos.y/100·scale)', () => {
  it('Standard-Skalierung 1.6: B@240,-80 → (3.84,1.28), M@240,90 → (3.84,-1.44), Q@480,10 → (7.68,-0.16)', () => {
    const tex = toTikz(DEA_23, { standalone: false });
    expect(tex).toMatch(/\(\s*3\.84\s*,\s*1\.28\s*\)/);
    expect(tex).toMatch(/\(\s*3\.84\s*,\s*-1\.44\s*\)/);
    expect(tex).toMatch(/\(\s*7\.68\s*,\s*-0\.16\s*\)/);
  });

  it('A@0,0 → (0.00,0.00)', () => {
    const tex = toTikz(DEA_23, { standalone: false });
    expect(tex).toMatch(/\(\s*0\.00\s*,\s*-?0\.00\s*\)/);
  });

  it('scale 1: B → (2.40,0.80)', () => {
    const tex = toTikz(DEA_23, { standalone: false, scale: 1 });
    expect(tex).toMatch(/\(\s*2\.40\s*,\s*0\.80\s*\)/);
  });

  it('fehlt pos: autoLayout setzt Koordinaten (je Zustand ein at-Ausdruck)', () => {
    const doc = parse(`dea K {
  alphabet 0 1
  start A
  accept B
  A -0,1-> B
  B -0,1-> B
}
`);
    const tex = toTikz(obj<Automaton>(doc, 'K'), { standalone: false });
    expect(count(tex, /\\node\b/g)).toBe(2);
    expect(count(tex, /\bat\s*\(/g)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// TikZ: Kanten, Schleifen, Gegenrichtung, Beschriftung je Art

describe('toTikz: Kanten und Beschriftung', () => {
  it('Mealy (Paritaet): vier Kanten, zwei Schleifen, zwei gebogene Gegenkanten; Beschriftung x/y', () => {
    const tex = toTikz(MEALY, { standalone: false });
    expect(count(tex, /\bedge\b/g)).toBe(4);
    expect(count(tex, /loop above/g)).toBe(2);
    expect(count(tex, /bend left=20/g)).toBe(2);
    for (const lab of ['0/0', '1/1', '0/1', '1/0']) {
      expect(tex).toMatch(new RegExp(lab.replace('/', '\\s*/\\s*')));
    }
  });

  it('Moore 2.10: sieben Kanten; Ausgabe im Zustand (B/1, A/0), kein accepting', () => {
    const tex = toTikz(MOORE_210, { standalone: false });
    expect(count(tex, /\\node\b/g)).toBe(4);
    expect(count(tex, /\bedge\b/g)).toBe(7);
    expect(count(tex, /\baccepting\b/g)).toBe(0);
    expect(count(tex, /\binitial\b(?!\s*text)/g)).toBe(1);
    expect(tex).toMatch(/B\s*\/\s*1/);
    expect(tex).toMatch(/A\s*\/\s*0/);
  });

  it('NEA 2.66: sechs Knoten, zwei Akzeptzustände, ε als \\varepsilon, vier Kanten', () => {
    const tex = toTikz(NEA_266, { standalone: false });
    expect(count(tex, /\\node\b/g)).toBe(6);
    expect(count(tex, /\baccepting\b/g)).toBe(2);
    expect(count(tex, /\bedge\b/g)).toBe(4);
    expect(count(tex, /loop above/g)).toBe(2);
    expect(tex).toMatch(/\\varepsilon/);
  });

  it('NKA 4.6: vier Knoten, vier Kanten (je Paar einmal), zwei Schleifen; Beschriftung mit \\to', () => {
    const tex = toTikz(NKA_46, { standalone: false });
    expect(count(tex, /\\node\b/g)).toBe(4);
    expect(count(tex, /\bedge\b/g)).toBe(4);
    expect(count(tex, /loop above/g)).toBe(2);
    expect(tex).toMatch(/\\to/);
  });

  it('TM tm-inc: Bewegungen R und L als \\mathrm, Blank als \\square', () => {
    const tex = toTikz(TM_INC, { standalone: false });
    expect(tex).toMatch(/\\mathrm\{R\}/);
    expect(tex).toMatch(/\\mathrm\{L\}/);
    expect(tex).toMatch(/\\square/);
  });

  it('TM 5.9 (Palindrom): F+ und F− sind accepting (F− zusätzlich Stil reject)', () => {
    const tex = toTikz(TM_59, { standalone: false });
    expect(count(tex, /\baccepting\b/g)).toBe(2);
    expect(tex).toMatch(/reject\/\.style\s*=\s*\{\s*double\s*,\s*dashed\s*\}/);
    expect(count(tex, /\breject\b/g)).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// TikZ: Zustandsnamen

describe('toTikz: Zustandsnamen', () => {
  it('z12 wird als z_{12} gesetzt', () => {
    const doc = parse(`dea Z {
  alphabet 0
  start z12
  accept z12
  z12 -0-> z12
}
`);
    const tex = toTikz(obj<Automaton>(doc, 'Z'), { standalone: false });
    expect(tex).toMatch(/z_\{12\}/);
  });
});

// ---------------------------------------------------------------------------
// LaTeX-Tabelle

describe('toLatexTable', () => {
  it('DEA 2.3: tabular, alle Zustände, Start und Endzustand markiert', () => {
    const tex = toLatexTable(DEA_23);
    expect(tex).toMatch(/\\begin\{tabular\}/);
    expect(tex).toMatch(/\\end\{tabular\}/);
    for (const z of ['A', 'B', 'M', 'Q']) expect(tex).toMatch(new RegExp(`\\b${z}\\b`));
    // Start-Markierung (→ bzw. \to) und Endzustand * in der Zeile von B
    expect(tex).toMatch(/\\to\b|→|\\rightarrow/);
    const starLines = tex.split('\n').filter((l) => l.includes('*'));
    expect(starLines.some((l) => l.includes('B'))).toBe(true);
  });

  it('NEA 2.61: Mengenzellen als \\{…\\}, fehlende Zellen als --', () => {
    const tex = toLatexTable(NEA_261);
    expect(tex).toMatch(/\\\{1\\\}/);
    expect(tex).toMatch(/--/);
  });

  it('Mealy: Zellen z\'/y (g/0, u/1 kommen vor)', () => {
    const tex = toLatexTable(MEALY);
    expect(tex).toMatch(/g\s*\/\s*0/);
    expect(tex).toMatch(/u\s*\/\s*1/);
  });

  it('deterministisch', () => {
    expect(toLatexTable(DEA_23)).toBe(toLatexTable(DEA_23));
  });
});

// ---------------------------------------------------------------------------
// LaTeX-Mathe für alle Objektarten

describe('toLatex', () => {
  it('regulärer Ausdruck: \\mid und ^{*}', () => {
    const doc = parse('regex R = (0|1)*01\n');
    const tex = toLatex(obj(doc, 'R'));
    expect(tex).toMatch(/\\mid/);
    expect(tex).toMatch(/\^\{\*\}/);
  });

  it('Grammatik 2.36: align*, \\to und \\mid', () => {
    const doc = parse(`grammatik G {
  nichtterminale X
  terminale 0 1
  start X
  X -> 01 | 0X1
}
`);
    const tex = toLatex(obj(doc, 'G'));
    expect(tex).toMatch(/\\begin\{align\*\}/);
    expect(tex).toMatch(/\\to/);
    expect(tex).toMatch(/\\mid/);
  });

  it('endliche Menge: \\{ … \\}', () => {
    const doc = parse('menge L = {01, 1}\n');
    const tex = toLatex(obj(doc, 'L'));
    expect(tex).toMatch(/\\\{/);
    expect(tex).toMatch(/01/);
  });

  it('Automat: Tupel und Tabelle (tabular)', () => {
    expect(toLatex(DEA_23)).toMatch(/\\begin\{tabular\}/);
  });

  it('egrep: \\texttt mit Maskierung von _, %, &', () => {
    const doc = parse('egrep E = a_b%&\n');
    const tex = toLatex(obj(doc, 'E'));
    expect(tex).toMatch(/\\texttt\{/);
    expect(tex).toMatch(/\\_/);
    expect(tex).toMatch(/\\%/);
    expect(tex).toMatch(/\\&/);
  });

  it('egrep mit # (direkt konstruiertes Objekt): \\#', () => {
    const tex = toLatex({ kind: 'egrep', name: 'H', pattern: 'a#b', alphabet: [] });
    expect(tex).toMatch(/\\#/);
  });

  it('deterministisch', () => {
    expect(toLatex(DEA_23)).toBe(toLatex(DEA_23));
  });
});

// ---------------------------------------------------------------------------
// Optional: Kompilieren mit pdflatex (nur wenn installiert)

const HAS_PDFLATEX = spawnSync('pdflatex', ['--version']).status === 0;

describe.skipIf(!HAS_PDFLATEX)('pdflatex kompiliert die TikZ-Ausgabe', () => {
  it('2.3, 2.10, 2.66, 4.6, 5.9 als standalone-Dokument', () => {
    const dir = mkdtempSync(join(tmpdir(), 'm3-tikz-'));
    try {
      const sources: [string, Automaton][] = [
        ['dea23', DEA_23],
        ['moore210', MOORE_210],
        ['nea266', NEA_266],
        ['nka46', NKA_46],
        ['tm59', TM_59],
      ];
      for (const [name, o] of sources) {
        const file = join(dir, `${name}.tex`);
        writeFileSync(file, toTikz(o));
        execFileSync('pdflatex', ['-interaction=nonstopmode', '-halt-on-error', '-output-directory', dir, file], {
          stdio: 'pipe',
        });
        expect(readFileSync(join(dir, `${name}.pdf`)).length).toBeGreaterThan(0);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);
});
