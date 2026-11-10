# Plan M1: Automaten-Playground

Entscheidungen: Svelte 5 + Vite + TypeScript, Backslash-Escape für kollidierende Symbole,
Name "Automaten-Playground" (Paket `automaten-playground`).

## 1. Ordnerstruktur

```
core/                    reines TypeScript, kein DOM (eigene tsconfig, lib: ES2022 ohne "dom")
  model/                 Typen, Kind-Registry, Validierung, Edit-Operationen (rein, immutabel)
  text/                  Lexer, Parser, Printer der Textsprache; grammatik.ebnf
  json/                  toJSON / fromJSON mit Versionsfeld und Validierung
  sim/                   DEA- und NEA-Simulator, Stapellauf
  layout/                autoLayout (rein, liefert nur Positionen)
  index.ts               öffentliche Schnittstelle (einziger Import für app/)
  test/                  Vitest, u. a. Round-Trip und Skriptbeispiele
app/                     Svelte-Oberfläche
  lib/store.svelte.ts    Dokument-Zustand, Undo/Redo, Autosave, Link-Teilen
  graph/  table/  text/  sim/  ui/
  i18n/de.ts             alle Oberflächentexte über Schlüssel (Englisch vorbereitet)
examples/                Beispieldateien in der Textsprache (nur mathematische Objekte)
docs/                    skript-notizen-m1.md, plan-m1.md, stand-m1.md
.claude/agents/          Subagenten (siehe 6.)
```

Build: `vite build` mit `vite-plugin-singlefile` → eine `dist/index.html`, die auch per
Doppelklick (file://) läuft. Tests: Vitest. Linter: ESLint (typescript-eslint, svelte).
Texteditor: CodeMirror 6 mit eigener Hervorhebung und Diagnosen (Zeile/Spalte).

## 2. Datenmodell (core/model)

```ts
export type Sym = string;            // ein Symbol; Länge > 1 nur als <name> geschrieben
export type Word = Sym[];            // [] = ε
export type StateId = string;        // stabil, intern (z. B. "s3"); Name ist separat
export interface Point { x: number; y: number }

export interface State {
  id: StateId;
  name: string;                      // im Dokument eindeutig je Objekt
  pos?: Point;                       // optionale Layout-Angabe
}

// Generisch über Kantenbeschriftung L und Zustandszusatz S, damit Mealy/Moore,
// NKA und TM später ohne Umbau dazukommen.
export interface Transition<L> { id: string; from: StateId; to: StateId; label: L }

export interface AutomatonBase<K extends string, L, S = {}> {
  kind: K;
  name: string;
  alphabet: Sym[];                   // X, Reihenfolge = Tabellen-Spaltenreihenfolge
  states: (State & S)[];             // Z, Reihenfolge = Tabellen-Zeilenreihenfolge
  start: StateId | null;             // z0
  accept: StateId[];                 // F
  transitions: Transition<L>[];
}

export type DEA = AutomatonBase<'dea', Sym>;          // f : Z × X → Z
export type NEA = AutomatonBase<'nea', Word>;         // g : Z × X* → 2^Z, [] = ε
// später z. B.: Mealy = AutomatonBase<'mealy', {in: Sym; out: Word}>
//               Moore = AutomatonBase<'moore', Sym, {out: Word}>
//               NKA   = AutomatonBase<'nka', {top: Sym; read: Sym|null; push: Word}> & {stackAlphabet, y0}
//               TM    = AutomatonBase<'tm', {read: Sym; write: Sym; move: -1|0|1}> & {...}
//               Grammatik, Regex: eigene Typen, kein AutomatonBase

export type FormalObject = DEA | NEA;                 // wächst je Meilenstein
export interface Document { version: 1; objects: FormalObject[] }
```

**Kind-Registry** (`core/model/kinds.ts`): je Typ ein Eintrag
`{ kind, keyword, parseBody, printBody, validate, simulate? }`. Parser, Printer, JSON und
Oberfläche fragen die Registry; ein neuer Typ ist ein neuer Eintrag.

**Validierung** liefert `Diagnostic[]` = `{ severity: 'error'|'warning', code, objectName,
ref?: {stateId?|transitionId?}, line?, col?, params }`. Meldungstexte stehen nicht im Kern,
nur `code` + `params`; die Oberfläche übersetzt. DEA-Prüfungen: fehlende Übergänge
(Warnung, mit Liste der Paare (z, x)), doppelte Übergänge (Fehler), Wortlänge ≠ 1 (Fehler),
Symbol nicht im Alphabet (Fehler), kein Startzustand (Fehler).

**Edit-Operationen** (`core/model/edit.ts`), alle rein `(obj, …) → obj`:
`addState, renameState, moveStates, removeStates, setStart, toggleAccept,
addTransition, removeTransition, setEdgeLabels(from, to, labels: Word[]),
setAlphabet, addTrapState (DEA: Fangzustand für alle fehlenden Paare), convertKind`.

## 3. Textsprache (EBNF, M1-Teil)

```ebnf
document    = { ws | comment | object } ;
object      = kind , ws , name , ws? , "{" , body , "}" ;
kind        = "dea" | "nea" ;                         (* später: mealy, moore, nka, tm, regex, grammatik … *)
body        = { ws | comment | statement } ;
statement   = alphabet | states | start | accept | layout | transition ;
alphabet    = "alphabet" , { ws , symbol } ;
states      = "states" , { ws , state } ;             (* nur nötig für Zustände ohne Kanten / Reihenfolge *)
start       = "start" , ws , state ;
accept      = "accept" , { ws , state } ;
layout      = "layout" , { ws , state , "@" , number , "," , number } ;
transition  = state , ws , "-" , labels , "->" , ws , state ;
labels      = label , { ws? , "," , ws? , label } ;
label       = "ε" | "eps" | symbol , { symbol } ;     (* Wort; bei DEA genau ein Symbol *)
symbol      = plainchar | "\" , escchar | "<" , ident , ">" ;
plainchar   = (* jedes Zeichen außer Leerraum und - , < > # \ { } ε *) ;
escchar     = (* jedes Zeichen, z. B. \- \, \< \> \# \\ \{ \} \ε und "\ " für Leerzeichen *) ;
state       = statechar1 , { statechar } ;
statechar1  = letter | digit | "_" | "+" | "'" ;
statechar   = statechar1 | "-" ;                      (* z+ und f- erlaubt; Pfeil nur nach Leerraum *)
name        = ident ;
comment     = "#" , { (* bis Zeilenende *) } ;
```

Beispiel:

```
dea Dualzahl {
  alphabet 0 1 \-
  start A
  accept B
  A -0,1-> B
  A -\--> M
  B -0,1-> B
  layout A@80,120 B@240,120 M@80,260
}
```

Round-Trip-Garantie: `parse(print(m))` ist strukturgleich zu `m` (inkl. Layout, Reihenfolge
von Alphabet, Zuständen und Kanten); `print(parse(t))` ist für kanonischen Text `t` ein
Fixpunkt. Kommentare und freie Formatierung werden in M1 **nicht** erhalten
(Text-Sicht zeigt nach einer Graph-Änderung die kanonische Form). Mehrere Beschriftungen
zwischen denselben Zuständen druckt der Printer zusammengefasst `-0,1->`.

## 4. Schnittstelle Kern ↔ Oberfläche (core/index.ts)

```ts
// Text
parseDocument(text: string): { doc: Document; diagnostics: Diagnostic[] };  // tolerant: bei Fehlern so viel Modell wie möglich
printDocument(doc: Document): string;
printObject(obj: FormalObject): string;
// JSON
toJSON(doc: Document): string;  fromJSON(json: string): { doc?: Document; diagnostics: Diagnostic[] };
// Modell
validate(obj: FormalObject): Diagnostic[];
edit.*                                         // siehe 2.
autoLayout(obj, opts?): Record<StateId, Point>;
// Simulation: der ganze Lauf als Daten, die Oberfläche blättert nur im Array
simulate(obj: FormalObject, word: Word, opts?: { stepLimit?: number }): Trace;
runBatch(obj, entries: { word: Word; expected: boolean | null }[]): BatchResult[];
parseWord(input: string): Word;  printWord(w: Word): string;   // gleiche Symbolregeln wie Text

interface Trace {
  word: Word;
  steps: SimStep[];                 // steps[0] = Startkonfiguration (inkl. ε-Hülle)
  result: 'accepted' | 'rejected' | 'stuck' | 'limit';
  // DEA: Zustandsfolge f**(z0,w) und f*(z0,w); NEA: Berechnungsbaum
  stateSequence?: StateId[];
  finalState?: StateId | null;
  tree?: TreeNode[];
}
interface SimStep {
  pos: number;                      // Anzahl gelesener Symbole
  active: StateId[];                // DEA: genau einer; NEA: Menge
  firedTransitions: string[];       // Kanten, die zu diesem Schritt geführt haben
  explanation: { key: string; params: Record<string, unknown> };
}
interface TreeNode { id: number; parent: number | null; state: StateId; pos: number;
  via: string | null;                // Transition-ID
  status: 'open' | 'accepting' | 'dead' | 'cycle' | 'limit' }
```

NEA-Semantik nach 2.58: Kante mit Wort w führt von Position i nach i+|w|; ε-Kanten
bleiben auf i. Schritt i zeigt alle Zustände, in denen ein Weg nach genau i gelesenen
Symbolen stehen kann. Der Baum schneidet einen Ast ab, wenn sich (Zustand, Position)
auf demselben Ast wiederholt (`cycle`).

## 5. Oberfläche (meine Aufgabe)

Ein Fenster, drei gleichberechtigte Sichten auf das aktive Objekt: Graph (Hauptfläche),
rechts umschaltbar Tabelle | Text, unten die Simulationsleiste mit Eingabewort als
Symbolband, Schrittsteuerung, f**-Folge bzw. NEA-Mengen und Baum; Stapellauf als eigener
Reiter rechts. Undo/Redo als Snapshot-Stapel über das ganze Dokument; Autosave in
localStorage; Teilen per Link mit `lz-string` im Hash (`#d=…`), dazu Datei speichern/laden.
Visuell: eigene, ruhige Gestaltung (kein Komponenten-Kit), Zustände zusätzlich zur Farbe
über Form und Beschriftung unterscheidbar.

## 6. Subagenten

| Agent | Modell | Auftrag in M1 |
|---|---|---|
| `skript-leser` | Haiku | einmal: 2.2–2.15, 2.58–2.66 aus dem PDF → `docs/skript-notizen-m1.md` |
| `geruest` | Haiku | Vite/Svelte/TS-Gerüst, tsconfig für core ohne DOM, Vitest, ESLint, singlefile-Build, README, `examples/*.txt` |
| `kern-entwickler` | Sonnet | `core/` komplett nach Abschnitt 2–4 |
| `tester` | Haiku | Tests für `core/` gegen die Schnittstelle aus 4. (parallel zur Implementierung), danach Tests/Build/Lint ausführen und nur Fehlschläge mit Ursache melden |
| `fehlersucher` | Sonnet | bei roten Tests: Ursache finden und beheben; zweite Instanz, wenn ein Haiku-Ergebnis nicht reicht |

Ablauf: (1) `skript-leser` und `geruest` parallel. (2) `kern-entwickler` und `tester`
parallel, ich baue gleichzeitig die Oberfläche gegen `core/index.ts`. (3) `tester` lässt
alles laufen, `fehlersucher` bei Bedarf. (4) Abnahme im Browser durch mich, dann
`docs/stand-m1.md`.
