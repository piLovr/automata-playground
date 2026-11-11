# Spezifikation Kernbibliothek M3

Plan: `docs/plan-m3.md` (Entscheidungen: Mengen als eigene Objektart, TikZ mit Positionen
aus dem Layout). Skript: `docs/skript-notizen-m3.md`. Typen verbindlich in
`core/model/types.ts`: `MengeObj`, `MethodId 'sprachop'`, Codes `menge.*` und `lang.*`,
`LengthCounts`, `WordsPage`, `TikzOptions`. Aufbau wie M2 (`docs/kern-spec-m2.md`).

---

## Teil A: Mengen, Sprachrechner, Explorer (kern-entwickler A)

Dateien: neu `core/model/menge.ts`, `core/lang/` (Sprachrechner), `core/explore/`;
Einbindung in Text/JSON/validate/reconcile/hash/emptyObject/isAutomaton (wie bei egrep)
und in `core/algo` (`toDea`, `accepts`, `enumerate`, `equivalent`, `applicableMethods`).

### Objektart `menge`

- Text: Kurzform `menge L1 = {01, 1, ε}`; Blockform
  `menge L { alphabet 0 1  = {…}  bis 6  herkunft … }`. Wörter nach den Symbolregeln der
  Textsprache (`readSymbol`, `<name>`, `\x`), `ε`/`eps` = leeres Wort, Trenner `,`.
  `{}` oder `∅` = leere Menge. `bis n` setzt `upTo`.
- Modell: `words` ohne Doppelte (Warnung `menge.duplicate` beim Lesen), sortiert nach Länge,
  dann lexikographisch nach Alphabetreihenfolge. Printer schreibt Kurzform, wenn Alphabet
  abgeleitet, kein `upTo`, kein `origin`.
- `toDea`: Präfixbaum + Fangzustand; Typ 3 für Äquivalenz, Arbeitsfläche, Explorer.
  Mit `upTo` ist die Sprache die endliche Menge selbst (der Hinweis steht in der Oberfläche).

### Sprachrechner `evalLang(expr, doc, opts)`

```ts
export function evalLang(expr: string, doc: Document, opts?: { maxLen?: number; maxWords?: number }):
  { result: MengeObj | null; diagnostics: Diagnostic[]; steps: ProcStep[] };
```

- Ausdruck: Namen von Objekten (Mengen und andere Typ-3-Objekte), Mengenliterale `{a, ab}`,
  Konkatenation durch Hintereinanderschreiben oder `·`/`.`, Vereinigung `∪` oder `|`,
  Potenz `^k` (k ∈ ℕ₀), `*`, `+`, Klammern. Präzedenz: `^ * +` vor Konkatenation vor `∪`.
- Semantik nach 1.6/1.9: L^0 = {ε}, L^(k+1) = L^k L; L* = ⋃ L^k, L+ = ⋃_{k≥1} L^k.
  Unendliche Ergebnisse (Stern, Plus mit nichtleerem Nicht-ε-Wort, Typ-3-Objekt mit
  unendlicher Sprache) werden auf Wörter bis `maxLen` (Standard 6) geschnitten,
  `result.upTo = maxLen`, Warnung `lang.truncated`. Typ-3-Objekte gehen über `enumerate`.
- Mehr als `maxWords` (Standard 5000) Wörter → `lang.tooLarge`.
- Schritte: je Operation ein Schritt `proc.lang.concat|union|power|star|plus` mit
  `{left, right?, k?, size}` (left/right als Text des Teilausdrucks), view.table = Paare bzw.
  Ergebnisliste (kurz). Ergebnis hat `origin` mit method `sprachop`, sources = benutzte
  Namen, `params`? → nein, Ausdruck steht nicht im Origin (Typ hat kein Feld); die
  Oberfläche zeigt ihn beim Übernehmen im Namen nicht – genügt.
- Beispiele 1.4 und 1.7 müssen exakt herauskommen.

### Explorer (`core/explore/`)

```ts
export function countByLength(o: FormalObject, maxLen: number, opts?: { stepLimit?: number }): ProcResult<LengthCounts>;
export function wordsPage(o: FormalObject, opts: { maxLen: number; offset: number; limit: number; stepLimit?: number }): ProcResult<WordsPage>;
export function outputsTable(o: Mealy | Moore, maxLen: number, limit?: number): { input: Word; output: Word }[];
```

- Typ 3 (dea, nea, regex, grammatik Typ 3, egrep ohne Rückwärtsverweis, menge): exakt über
  `toDea`: Anzahl je Länge per Dynamik über Zustände (bigint), Wörter per Tiefensuche in
  Längen-/Alphabetordnung mit Abschneiden toter Zustände (effizient auch für große Sprachen,
  `offset` wird übersprungen, ohne alle vorherigen Wörter zu speichern, wo möglich).
- nka, tm, egrep mit Rückwärtsverweis, Grammatik Typ < 3: alle Wörter über dem Alphabet bis
  maxLen durchprobieren mit `simulate`/`egrepTest` (stepLimit je Wort), `exact: false`.
  Ergebnis „limit“ eines Worts zählt als nicht enthalten, aber `exact` bleibt false.
  Mehr als 200 000 Kandidaten → `algo.limit`.
- Mealy/Moore: `outputsTable` zählt Eingaben in Längen-/Alphabetordnung auf (Standard
  limit 500) mit dem Ausgabewort aus `simulate`.
- Alle drei Funktionen sind im Worker aufrufbar (reine Daten).

---

## Teil B: Export (kern-entwickler B)

Dateien: neu `core/export/tikz.ts`, `core/export/latex.ts`, Export in `core/index.ts`.

```ts
export function toTikz(o: Automaton, opts?: TikzOptions): string;
export function toLatexTable(o: Automaton): string;          // tabular wie die Tabellen-Sicht
export function toLatex(o: FormalObject): string;            // regex/grammatik/menge/egrep als Mathe; Automaten = Tupel + Tabelle
```

- TikZ mit `\usetikzlibrary{automata,positioning,arrows.meta}`, Knoten `state` mit
  `initial`, `accepting`; F₋ der TM als `accepting` mit `dashed`-Innenring-Ersatz:
  Stil `reject/.style={double, dashed}`.
  Positionen: x = pos.x/100·scale, y = −pos.y/100·scale (cm), auf 2 Nachkommastellen.
  Fehlt pos: `autoLayout`.
- Kanten: gleiche (from,to) zusammengefasst wie im Graphen (`a,b`); Gegenrichtung beide mit
  `bend left=20`; Schleifen `loop above`; Beschriftung `node[auto]{$…$}`.
  Beschriftung je Art wie `showLabel` der Oberfläche: Mealy `x/y`, NKA `y,x\to v`
  (mehrere als `\shortstack`/`\\` getrennt), TM `y\to y',\mathrm{R}`; ε als `\varepsilon`,
  □ als `\square`, ∅ als `\emptyset`.
- Zustandsnamen: `z12` → `z_{12}`, sonst mathematisch maskiert; Moore: `z/y` im Knoten
  (`\shortstack`-frei: `$z_0/1$`).
- LaTeX-Maskierung aller Sonderzeichen (`# $ % & _ { } ~ ^ \`), Symbole außerhalb ASCII
  sinnvoll ersetzen (`ε→\varepsilon`, `∅→\emptyset`, `□→\square`, `−→-`).
- `toLatexTable`: Zeilen = Zustände (→ für Start, * für F wie in der Tabellen-Sicht),
  Spalten = Symbole; NEA-Zellen als Mengen `\{…\}`, fehlend `--`; Mealy `z'/y`; NKA/TM als
  Zeilentabelle wie in 4.6.
- `toLatex`: regex mit `\mid`, `^{*}`, ∅; Grammatik als `align*` mit `\to` und `\mid`;
  Menge als `\{\dots\}`; egrep als `\texttt{…}` mit Maskierung.
- Tests (eigene): 2.3, 2.10, 2.66, 4.6, 5.9 lassen sich exportieren; Ausgabe enthält
  erwartete Knoten/Kanten; deterministisch (gleiche Eingabe → gleicher Text). Optional,
  wenn `pdflatex` installiert ist (`which pdflatex`): ein kompilierender Test, sonst
  übersprungen.

---

## Teil C: Tests (tester)

- `menge`: Text-Round-Trip, Duplikate, Sortierung; 1.4 und 1.7 über `evalLang` exakt;
  1.8 ({ε}L = L), L* bis Länge 4 über {0,1} = alle Wörter, ε ∈ L+ ⇔ ε ∈ L (1.10).
- Explorer: `countByLength` stimmt mit `enumerate` überein (zufällige NEA/Ausdrücke, Länge
  ≤ 7); (0|1)*01: counts = 0,0,1,2,4,8,…; `wordsPage` liefert dieselbe Reihenfolge wie
  `enumerate`, auch über Seitengrenzen; NKA 4.6 Stichprobe enthält 0011, 000111, nicht 0101.
- Abnahme 2.10: Für alle Wörter über {0,1,-} bis Länge 6 gilt: letzte Ausgabe des Moore-
  Automaten 2.10 ist 1 genau dann, wenn das Wort eine Dualzahl (mit optionalem Vorzeichen)
  nach 2.3 ist (= von DEA 2.3 akzeptiert).
- Export: Struktur statt Wortlaut prüfen (Anzahl `\node`, `initial`, `accepting`, Kanten).

---

## Nachtrag: Brücken (Menge → DEA, Kette bis zum minimalen DEA)

### `mengeToDea(m: MengeObj, opts?: ProcOptions): ProcResult<DEA>` (MethodId `menge2dea`)

- Präfixbaum (nicht im Skript, so kennzeichnen): ein Zustand je Präfix eines Worts der Menge
  in Längen-/Alphabetordnung, Start = ε, F = Präfixe, die Wörter der Menge sind; danach ein
  Fangzustand für alle fehlenden (z, x), damit das Ergebnis vollständig ist (Minimierung,
  Komplement). Leere Menge: nur Start (nicht akzeptierend) mit Schleifen. Alphabet = Alphabet
  der Menge.
- Zustandsnamen: das Präfix als Wort (ε heißt `ε`), falls als Zustandsname gültig
  (`isStateName`), sonst `q<k>`; mit `compactNames` wie bei der Potenzmenge; Fangzustand
  `∅` bzw. frisch.
- `upTo` gesetzt: trotzdem die endliche Menge (wie `toDea`), Diagnose als Warnung
  `lang.truncated` {upTo} in den Schritten ist nicht nötig – die Oberfläche weist hin.
- Schritte: je Wort `proc.trie.word` {word, newStates: StateId[]} mit view.obj (Baum bisher,
  neue Kanten in `added`), dann `proc.trie.trap` {state, count} (Anzahl ergänzter Übergänge).
- corr: keine (die Zustände sind die Präfixe selbst).
- `applicableMethods(menge)` → `['menge2dea']`; `runMethod` verteilt.

### `chainPlan(o: FormalObject, opts?: { thompson?: boolean }): MethodId[] | null`

Reine Hilfsfunktion: die Verfahren, die nacheinander aus `o` einen minimalen DEA machen
(jedes Verfahren auf das Ergebnis des vorigen):

| Art | Plan |
|---|---|
| egrep (ohne Rückwärtsverweis) | egrep2regex, regex2grammar, grammar2nea, nea2dea, minimize |
| regex | regex2grammar, grammar2nea, nea2dea, minimize (mit `thompson`: thompson, nea2dea, minimize) |
| grammatik Typ 3 | grammar2nea, nea2dea, minimize |
| nea | nea2dea, minimize |
| dea | minimize; ist er unvollständig: null (die Oberfläche bietet den Fangzustand an) |
| menge | menge2dea, minimize |
| sonst (oder egrep mit Rückwärtsverweis, Grammatik Typ < 3) | null |

Test: Für zufällige Ausdrücke und alle Typ-3-Beispiele aus `examples/` führt die Kette per
`runMethod` ohne Fehler zu einem DEA, der `equivalent` zur Quelle ist und unter erneutem
`minimize` gleich viele Zustände behält.
