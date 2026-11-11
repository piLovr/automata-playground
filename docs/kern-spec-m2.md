# Spezifikation Kernbibliothek M2

Ergänzt `docs/kern-spec-m1.md` und `docs/kern-spec-typen.md`. Plan: `docs/plan-m2.md`
(Entscheidungen in Abschnitt 9 sind verbindlich). Skript: `docs/skript-notizen-m2.md`.
Verbindliche Typen: `core/model/types.ts` (Abschnitt „M2“ und „Verfahren“; nicht ändern
ohne Rückfrage). Alles in `core/` bleibt reines TypeScript ohne DOM, Funktionen rein.

`FormalObject = Automaton | RegexObj | Grammar`. `ObjectKind` bleibt die Art der
Zustandsmaschinen; `FormalKind` umfasst alle. Alle Automaten tragen optional `origin`.

---

## Teil A: Ausdruck und Grammatik im Modell (kern-entwickler A)

Dateien: `core/model/*`, `core/text/*`, `core/json/*`, `core/index.ts`, neue Dateien
`core/model/regex.ts`, `core/model/grammar.ts`, `core/model/hash.ts`.
`core/algo/` gehört Agent B; nicht anfassen.

### Öffentliche Schnittstelle (zusätzlich in `core/index.ts`)

```ts
export function isAutomaton(o: FormalObject): o is Automaton;
export function emptyObject(kind: FormalKind, name: string): FormalObject;   // emptyAutomaton bleibt
// Ausdruck
export function parseRegex(text: string, alphabet?: Sym[] | null): { expr: RegExpr | null; diagnostics: Diagnostic[] };
export function printRegex(e: RegExpr, opts?: { strict?: boolean }): string;
export function regexSymbols(e: RegExpr): Sym[];            // Reihenfolge des ersten Auftretens
export function regexSize(e: RegExpr): number;              // Anzahl Knoten
export function subexprAt(e: RegExpr, path: ExprPath): RegExpr | null;
/** Zeichenbereich jedes Teilausdrucks im Ergebnis von printRegex (für Hervorhebung). */
export function regexSpans(e: RegExpr, opts?: { strict?: boolean }): { path: ExprPath; from: number; to: number }[];
// Grammatik
export function grammarType(g: Grammar): GrammarTypeInfo;
export function parseGrammarWord(text: string, g: Pick<Grammar, 'nonterminals' | 'terminals'>): { word: Word; diagnostics: Diagnostic[] };
export function printGrammarWord(w: Word, g: Pick<Grammar, 'nonterminals' | 'terminals'>): string;
// Herkunft
export function objectHash(o: FormalObject): string;        // 8 Hex-Zeichen
export function isStale(o: FormalObject, doc: Document): boolean;   // origin vorhanden und Quelle fehlt oder Hash weicht ab
```

`validate`, `printObject`, `printDocument`, `parseDocument`, `toJSON`, `fromJSON`,
`reconcile` nehmen jetzt jedes `FormalObject`. `simulate`, `runBatch`, `autoLayout`,
`edit.*` bleiben bei `Automaton`. `PrintOptions` bekommt `origin?: boolean`
(Standard true: `herkunft`/`entspricht`-Zeilen ausgeben).

### Textsprache

EBNF-Erweiterung aus `plan-m2.md` Abschnitt 2 nach `core/text/grammatik.ebnf` übernehmen
und schärfen. Präzisierungen:

**Ausdruck**

- Kurzform `regex Name = <ausdruck>` bis Zeilenende (Kommentar `#` beendet). Blockform
  `regex Name { alphabet …  = <ausdruck>  herkunft … }`; `=` darf in der Blockform nur
  einmal vorkommen, der Ausdruck reicht bis Zeilenende.
- Leerraum innerhalb des Ausdrucks wird ignoriert. Operatoren `|`, `(`, `)`, `*`, `∅`.
  Präzedenz `*` vor Konkatenation vor `|`, Konkatenation und `|` linksgeklammert
  (2.21: `R1|R2|R3 = ((R1|R2)|R3)`). `0**` ist erlaubt (2.22).
- Symbole wie in der Textsprache (`readSymbol`), zusätzlich müssen `| ( ) * ∅` als Symbol
  maskiert werden (`\|` usw.). ASCII-Ersatz nur im Ausdruck: `\0` = ∅, `\e` = ε.
  `ε` (oder `\e`) wird als `{op:'star', inner:{op:'empty'}}` gelesen (Entscheidung 1).
  `eps` ist im Ausdruck **kein** ε, sondern drei Symbole.
- Fehler mit Zeile/Spalte nach der Liste 2.22: `(|1)` und `|∅|` → `regex.missingOperand`
  (op `|`, side), `()01` → `regex.emptyParens`, `((01)` → `regex.unbalanced`,
  `*(01)` → `regex.missingOperand` (op `*`, side left), unerwartete Zeichen →
  `syntax.unexpected`. `2*` über {0,1} meldet `validate` (`regex.symbolNotInAlphabet`),
  nicht der Parser. `parseRegex` mit `alphabet` meldet es zusätzlich direkt (für den
  einzeiligen Editor).
- `printRegex` Standardform: nur nötige Klammern nach obiger Präzedenz; strenge Form:
  voll geklammert nach 2.21 (`(R1|R2)`, `(R1R2)`, `(R*)`), Einzelsymbole und ∅ ohne
  Klammern. Rechts verschachtelte gleiche Operatoren brauchen Klammern:
  `0|(1|0)` bleibt `0|(1|0)`, 2.22 `(0|(1|(0|0)))` wird `0|(1|(0|0))`. Beispiele aus
  2.22 als Tests (Spalte „mit Klammern“ = strenge Form, „ohne Klammern“ = Standardform,
  außer der vorletzten Zeile, wo das Skript die äußeren Klammern stehen lässt: Standard-
  form ist dort `0|(1|(0|0))`).
- Printer: Kurzform, wenn `alphabet` gleich `regexSymbols(expr)` ist und kein `origin`
  gedruckt wird; sonst Blockform. `expr: null` → Blockform ohne `=`-Zeile.
- `alphabet` fehlt → `regexSymbols(expr)`.

**Grammatik**

- Kopf `grammatik Name { … }`. Anweisungen (zeilengebunden): `nichtterminale`,
  `terminale`, `start`, Produktionen, `herkunft`, `entspricht`.
- In `nichtterminale` und `terminale` ist jedes durch Leerraum getrennte Token ein Symbol
  (beliebige Länge, `\`-Maskierung und `<name>` erlaubt). `X0 X1` = zwei Symbole.
- Produktion: `links -> rechts | rechts …` (auch `→`). `ε` oder `eps` als ganze
  Alternative = leeres Wort. Leerraum innerhalb einer Seite wird ignoriert.
  Symbolerkennung in Produktionen: an jeder Stelle zuerst das längste deklarierte Symbol
  (aus N und T), sonst `<name>`, `\x` oder ein Zeichen. `-` ist gewöhnliches Symbol, außer
  direkt gefolgt von `>`; `|` trennt Alternativen (`\|` als Symbol).
- Die Deklarationen gelten für die ganze Grammatik, egal ob vor oder nach den
  Produktionen (zwei Durchgänge).
- Ohne `nichtterminale`: N = alle Symbole aus Produktionen, die mit einem Großbuchstaben
  (`\p{Lu}`) beginnen, plus das Startsymbol, in Reihenfolge des ersten Auftretens
  (Skript-Konvention 2.36–2.44). Ohne `terminale`: T = alle übrigen Symbole aus den
  Produktionen. Ohne `start`: linke Seite der ersten Produktion, falls sie ein einzelnes
  Nichtterminal ist, sonst null.
- Produktions-IDs `p0, p1, …` je Alternative in Textreihenfolge.
- Printer (kanonisch):
  ```
  grammatik G {
    nichtterminale S X
    terminale 0 1
    start S
    S -> 0S | 1S | 01
    X -> ε
  }
  ```
  Zeilen `nichtterminale`/`terminale` immer (leer weglassen), `start` falls gesetzt.
  Produktionen gruppiert nach linker Seite in Reihenfolge der ersten Produktion der
  Gruppe. Mehrbuchstabige Symbole ohne `<>`, wenn das Zurücklesen derselben rechten
  Seite mit der Längste-Übereinstimmung-Regel dieselben Symbole ergibt, sonst mit `<>`.
- Round-Trip-Garantien aus M1 gelten (IDs kanonisch, Produktionen nach Gruppen geordnet).

**Herkunft** (alle Objektarten, in Blöcken; bei der Ausdruck-Kurzform nicht möglich)

```
herkunft nea2dea aus N1@3fa2c1d0 N2@0011aabb
entspricht z:AB <- 0 z:A z:B
entspricht n:X <- 0 t:r01
```

- `herkunft <methode> aus <Name>@<hash> …` genau einmal; danach beliebig viele
  `entspricht <ziel> <- <quellindex> <elem> …`.
- Elementschreibweise: `z:<Zustandsname>`, `k:<Übergangs-ID>`, `n:<Symbol>` (Symbol
  wie `printSymbol`), `p:<Produktions-ID>`, `t:r<Ziffern>` (Teilausdruck, `t:r` = Wurzel,
  `t:r01` = Pfad [0, 1]).
- `z:`-Namen beziehen sich beim Ziel auf dieses Objekt, bei den Quellelementen auf die
  Quelle. Beim Lesen werden Namen in IDs übersetzt: Zielzustände über dieses Objekt.
  **Quellzustände** speichert das Modell als StateId der Quelle. Da der Parser die IDs
  der Quelle aus dem Dokument kennt (Objekte gleichen Namens im selben Dokument), werden
  sie nach dem Parsen aller Objekte aufgelöst; fehlt die Quelle, bleibt der Name als ID
  stehen. Der Printer bekommt dazu das Dokument (`printDocument` kennt es; `printObject`
  ohne Dokument druckt IDs).
- `PrintOptions.origin === false` lässt beide Zeilenarten weg (Text-Sicht blendet sie
  standardmäßig aus wie `layout`).
- `objectHash`: FNV-1a (32 Bit) über `printObject(o, { layout: false, origin: false })`
  ohne die erste Zeile (Name egal), als 8 Hex-Zeichen.

**Zustandsnamen**: `∅` ist zusätzlich als Zeichen in Zustandsnamen erlaubt (Potenzmenge:
leere Menge heißt `∅`). Lexer und EBNF anpassen.

### Prüfung

- regex: `regex.symbolNotInAlphabet` (Fehler, je Symbol einmal), `regex.noExpr` (Warnung).
- grammatik: `grammar.noStart`, `grammar.startNotNonterminal`, `grammar.overlap`,
  `grammar.leftNoNonterminal`, `grammar.unknownSymbol` (alle Fehler; `noStart` nur wenn
  Produktionen existieren).

### Typ-Erkennung `grammarType`

Je Produktion v → w (der höchste Typ, den sie erfüllt):
- 3 `rightLinear`: v ∈ N, w ∈ T* ∪ T*N (2.45).
- 2 `contextFree`: v ∈ N.
- 1 `nonShrinking`: |v| ≤ |w|.
- 1 `startEpsilon`: v = S, w = ε und S auf keiner rechten Seite (5.1).
- 0 `shrinking`: sonst.

Gesamttyp: 3, wenn alle Produktionen Typ 3 sind; sonst 2, wenn alle Typ ≥ 2; sonst 1, wenn
alle Produktionen `nonShrinking` oder `startEpsilon` sind (also keine Produktion schrumpft,
ausgenommen S → ε nach 5.1; ε-Produktionen anderer Nichtterminale machen Typ 0); sonst 0.
`startEpsilonRule` = true, wenn der Gesamttyp 1 ist und eine `startEpsilon`-Produktion
existiert. Bei Gesamttyp 2 und 3 ist die ε-Frage egal.

### JSON

Version bleibt 1. `fromJSON` prüft regex (`expr` rekursiv mit gültigen `op`, `alphabet`)
und grammatik (Felder, Produktions-IDs eindeutig, Symbole Strings) sowie `origin` bei
allen Arten (Struktur, `method` aus `MethodId`).

### reconcile

regex: Ergebnis = next. grammatik: Produktionen behalten die ID einer prev-Produktion mit
gleichem (left, right), sonst frische ID. `origin` aus next.

---

## Teil B: Verfahren `core/algo/` (kern-entwickler B)

Nur neue Dateien in `core/algo/`, dazu ein Exportblock in `core/index.ts`
(`export * from './algo/index'`). Import der Typen aus `core/model/types.ts`; aus Teil A
darfst du nur die oben genannten Funktionen (`parseRegex`, `printRegex`, `regexSymbols`,
`regexSize`, `objectHash`, `validate`, `isAutomaton`, `printObject`) und bestehende
M1-Funktionen (`autoLayout`, `epsilonClosure`, `freshName`) verwenden. Solange Teil A
nicht fertig ist: schreibe eigene private Helfer nur dort, wo nötig, oder warte auf die
Datei – nicht in Teil-A-Dateien schreiben.

### Gemeinsames

- Jedes Verfahren: `(sources…, opts?: ProcOptions) => ProcResult<R>`; nie werfen, sondern
  `{ ok: false, diagnostics, steps }`.
- `opts.steps === false` → `steps: []` (schnell). Mit Schritten ist jeder Schritt ein
  **eigenständiger** Snapshot (keine geteilten veränderlichen Objekte).
- Vorbedingungen: falsche Art → `algo.wrongKind`; `validate` meldet Fehler →
  `algo.invalid`; kein Start → `algo.noStart`; DEA nicht total, wo das Skript totale f
  voraussetzt (Komplement, Produkt, 2.30, 2.82, 2.90, Mealy→Moore) → `algo.incomplete`
  mit den Paaren; Grammatik nicht Typ 3 → `algo.notType3`.
- Grenzen (`opts.limits`, Standard maxStates 2000, maxExprSize 50000) → `algo.limit`;
  die bis dahin erzeugten Schritte werden mitgeliefert.
- Ergebnisobjekte: gültig laut `validate`, Positionen per `autoLayout`, `origin` mit
  `method`, `sources` (Namen), `sourceHash` (`objectHash`), `corr` (siehe je Verfahren).
  Name: `opts.name` oder Quelle + Suffix (`_dea`, `_min`, `_ra`, `_g`, `_nea`, `_komp`,
  `_schnitt`, `_ver`, `_err`, `_moore`, `_mealy`).
- Zustandsnamen aus Mengen: Namen der Elemente aneinandergehängt in Zustandsreihenfolge
  der Quelle (`CDG`), mit `_` getrennt, sobald ein Elementname länger als 1 Zeichen ist
  (`z0_z1`); leere Menge `∅`. Bei Namenskonflikt `freshName`.
- `Explanation.params` enthalten Zustands-IDs **des Objekts in `view.obj`** bzw. der
  Quelle (Feldnamen mit `src`-Präfix), Symbole, Wörter, Produktions-IDs, Pfade. Keine
  Texte. Die Schlüssel stehen unten; jeder Schlüssel, den du verwendest, muss in
  `core/algo/keys.ts` als `export const EXPLANATION_KEYS = [...] as const` stehen.

### Verfahren

| Funktion | Ergebnis | Skript / Regeln | Schritte (Schlüssel, params) |
|---|---|---|---|
| `splitWords(n: NEA)` | NEA | 2.71: Kante mit \|w\| ≥ 2 → Kette über neue Zustände (Name `freshName(…, 'h')`) | `proc.split.edge` {transition (alt), word, newStates}; view.obj = NEA danach, `added` |
| `removeEpsilon(n: NEA)` | NEA | 2.72, Entscheidung 4: alle ε-Kanten bleiben, bis R1, R2, F-Regel nichts mehr hinzufügen (Fixpunkt, Reihenfolge: ε-Kanten in Modellreihenfolge, je ε-Kante R1, dann R2, dann F-Regel; Runde wiederholen); danach R3 entfernt alle ε-Kanten. Doppelte Kanten werden nicht angelegt | `proc.eps.r1` {eps, via, added}, `proc.eps.r2` {…}, `proc.eps.f` {state, eps}, `proc.eps.r3` {removed: TransitionId[]}; je hinzugefügter Kante/Endzustand ein Schritt |
| `powerset(n: NEA ohne ε und Wortkanten)` | DEA | 2.74: Start {z0}, f(S,x) = ⋃ g(z,x), F_M = {S \| S ∩ F ≠ ∅}; Standard nur erreichbare Teilmengen in BFS-Reihenfolge (Symbole in Alphabetreihenfolge); ∅ ist Zustand, falls erreicht (Ergebnis total); `fullPowerset`: alle 2^n Teilmengen | `proc.pow.row` {set: src-IDs, targets: src-ID-Mengen je Symbol, newSets}; view.table = Potenzmengentabelle bisher (Zeilen Mengen, Spalten Symbole), `activeRow` |
| `neaToDea(n: NEA \| DEA)` | DEA | die drei Phasen hintereinander; Phase ohne Arbeit liefert einen Schritt `proc.phase.skip` {phase} | `proc.phase` {phase: 1\|2\|3} zu Beginn jeder Phase, dann deren Schritte. corr: DEA-Zustand → Menge der NEA-Zustände **der ursprünglichen Quelle** (Hilfszustände aus 2.71 weglassen) |
| `deaToRegex(m: DEA)` | RegexObj | 2.30: Zustände in Modellreihenfolge z0 … z(m−1), **Startzustand muss Index 0 haben**: ist er es nicht, wird er für die Rechnung nach vorne gezogen (Schritt `proc.lk.order`). L^0_ij = Symbole mit f(z_i,x)=z_j vereinigt, bei i = j zusätzlich ∅*; leere Menge = ∅. Rekursion wörtlich. Ergebnis ⋃ L^m_0j über F in Zustandsreihenfolge; F leer → ∅. `simplify` (Standard true, Entscheidung 2): ∅\|R = R\|∅ = R, ∅R = R∅ = ∅, ∅** = ∅*, (∅*)* = ∅*, ∅*R = R∅* = R, R\|R = R (syntaktisch gleich), nach jedem Aufbau angewandt | `proc.lk.base` (k = 0), `proc.lk.round` {k, via: StateId}, `proc.lk.result` {finals}; view.table = m×m-Tabelle L^k_ij (Zeilen i, Spalten j als Zustandsnamen, Zellen `printRegex`). corr: keine |
| `deaToRegexElim(m: DEA)` | RegexObj | Zustandselimination (nicht im Skript): neuer Start/Ende, Zustände in Modellreihenfolge eliminieren, gleiche Vereinfachung | `proc.elim.state` {state}; view.obj = verallgemeinerter Automat als NEA mit Ausdruck-Labels? → nein: view.table = Kantentabelle (von, nach, Ausdruck) |
| `regexToGrammar(r: RegexObj)` | Grammar | 2.53 a/b, Entscheidung 3 für ∅, a, Stern; Teilausdrücke in Postorder; Nichtterminale `X0, X1, …` in Erzeugungsreihenfolge (frische je Basisgrammatik und je neuem Startsymbol); Vereinigung: neues XV mit XV → X01 \| X02; Konkatenation: jede X → w (w ∈ T*) aus P1 wird X → wX02, Start X01; Stern: neues XS, XS → ε \| X01, jede X → w (w ∈ T*) aus P1 wird X → wXS. T = Alphabet des Ausdrucks | `proc.rg.empty` / `proc.rg.sym` / `proc.rg.union` / `proc.rg.concat` / `proc.rg.star` {path}; view.obj = Grammatik des Teilausdrucks; sourceHighlight = Teilausdruck. corr: Nichtterminal → Teilausdruck, dessen Startsymbol es ist |
| `grammarToNea(g: Grammar Typ 3)` | NEA | 2.69: Zustände z_X je Nichtterminal (Name `z` + Symbol, falls als Zustandsname gültig, sonst `freshName(…, 'z')`), dazu `zf` (neuer Endzustand), g(z_X, w) ∋ z_Y für X → wY, ∋ zf für X → w | `proc.gn.states`, `proc.gn.prod` {production, transition}; corr: z_X → Nichtterminal X, Kante → Produktion |
| `deaToGrammar(m: DEA)` | Grammar | 2.49/2.50: N = {X_z}, Symbolname `X` + Zustandsname (Konflikt mit T → `freshName`), S = X_z0, X_z → xX_z' je Übergang, X_z → ε je z ∈ F. Kein Totalitätszwang | `proc.dg.trans` {transition, production}, `proc.dg.final` {state, production}; corr: Nichtterminal → Zustand, Produktion → Übergang |
| `thompson(r: RegexObj)` | NEA | Thompson (nicht im Skript), ε-Kanten, Zustände `q0, q1, …` | `proc.th.*` wie `proc.rg.*` |
| `complement(m: DEA)` | DEA | 2.33: F' = Z \ F; nur totaler DEA | ein Schritt `proc.compl` |
| `product(a: DEA, b: DEA, op: 'intersection' \| 'union')` | DEA | 2.33 Durchschnitt F1×F2; Vereinigung F1×Z2 ∪ Z1×F2 (nicht im Skript). Gleiche Alphabete (als Mengen) nötig, sonst `algo.alphabetMismatch`; nur erreichbare Paare (BFS) | `proc.prod.pair` {pair: [a, b] src-IDs, targets}; view.table = Paartabelle. corr: Paarzustand → je Quelle ein Zustand (zwei Einträge, source 0 und 1). Name `(A,B)` ist ungültig → `A_B` |
| `reachable(m: DEA)` | DEA | 2.82 wörtlich: S ← {z0}; je Runde S' ← S, S ← S ∪ f(S'×X) bis S' = S; Ergebnis ohne unerreichbare Zustände | `proc.reach.round` {round, added}; view.set; `proc.reach.done` {removed}. corr: Zustand → gleicher Zustand |
| `minimize(m: DEA)` | DEA | erst `reachable` (Schritte übernehmen), dann 2.90: ≡0 = {F, Z\F} (leere Klasse weglassen), Runde i+1 teilt jede Klasse nach den Klassen der Nachfolger (Symbole in Alphabetreihenfolge), Abbruch wenn ≡(i+1) = ≡i. Klassenreihenfolge: nach erstem Zustand in Modellreihenfolge. Ergebnis: Zustand je Klasse, Name aus Mengen-Regel, Start [z0], F_K | `proc.min.eq0` {classes}, `proc.min.round` {round, classes, split: Klassen von ≡(i) die zerfallen sind}, `proc.min.stable` {round}; view.partition, view.table = Zustand × Symbol → Klassennummer des Nachfolgers (Runde i), Spalte „Klasse“. corr: Klasse → Zustände |
| `equivalent(a, b: FormalObject Typ 3)` | EquivalenceResult | beide intern über `toDea` (vollständig gemacht, gemeinsames Alphabet), BFS im Produkt in Symbolreihenfolge (sortiertes vereinigtes Alphabet) → kürzestes, dann lexikographisch kleinstes Wort | `proc.eq.convert` {source}, `proc.eq.result` {equal, word} |
| `separatingWord(m: DEA, w1: Word, w2: Word)` | `{ word: Word \| null }` | 2.84: kürzestes w mit genau einem von w1w, w2w ∈ L (BFS über Zustandspaare ab (f*(z0,w1), f*(z0,w2))); null, wenn keins existiert | `proc.sep.states` {state1, state2}, `proc.sep.result` {word} |
| `mealyToMoore(m: Mealy)` / `mooreToMealy(m: Moore)` | Moore / Mealy | übliche Konstruktion (nicht im Skript): Mealy→Moore Zustände (z, y), Moore→Mealy Ausgabe g(f(z,x)) an die Kante | ein Schritt je Zustand |

Zusätzlich:

```ts
export function toDea(o: FormalObject): DEA | null;       // Typ 3 → totaler DEA (schnellster Weg, ohne Schritte); null bei falscher Art / Fehler
export function enumerate(o: FormalObject, maxLen: number, maxCount?: number): Word[];  // Wörter der Sprache nach Länge, dann lexikographisch (Alphabetreihenfolge); unabhängig implementiert: für regex direkt über die Semantik 2.23, für Grammatik über Ableitungen (Breitensuche mit Längenschranke, nur Typ 3 nötig), für DEA/NEA über simulate
export function accepts(o: FormalObject, w: Word): boolean | null;  // regex/grammatik über toDea
export function applicableMethods(o: FormalObject): MethodId[];
export function runMethod(method: MethodId, sources: FormalObject[], opts?: ProcOptions): ProcResult<FormalObject>;
```

`runMethod` verteilt auf die Funktionen oben (für `intersection`/`union` zwei Quellen).
Der Web Worker ruft nur `runMethod`, `equivalent`, `separatingWord`.

`applicableMethods`: dea → nea2dea? nein: dea → dea2regex, dea2regexElim, dea2grammar,
complement, intersection, union, reachable, minimize; nea → nea2dea, splitWords,
removeEpsilon, powerset; regex → regex2grammar, thompson; grammatik (Typ 3) →
grammar2nea; mealy → mealy2moore; moore → moore2mealy.

### Tests, die Agent B selbst schreibt (klein)

Je Verfahren ein Rauchtest; 2.92 vollständig (Runden und Ergebnis aus den Notizen).
Die großen Tests schreibt der Tester.

---

## Teil C: Tests (tester)

Gegen `core/index.ts`, Erwartungen aus dieser Datei und `skript-notizen-m2.md`.

1. Text: alle Zeilen aus 2.22 (Standard- und strenge Form, Hin- und Rückweg), falsche
   Ausdrücke aus 2.22 mit den Codes, Präzedenz und Linksklammerung, ε → ∅*, `\0`, `\e`,
   Maskierung. Grammatik 2.36, 2.37, 2.38 (mit `<Xz>` oder deklarierten Namen), 2.44
   (S = X0, deklarierte `X0 … X7`), Typ-Erkennung (2.36 Typ 2, 2.37 Typ 0, 2.44 Typ 3,
   S → ε-Sonderregel), Round-Trip Text und JSON für regex, grammatik, `herkunft`.
2. Verfahren an Skriptbeispielen: 2.92 Runde für Runde und Ergebnis; NEA 2.66 → DEA
   akzeptiert genau (01)*|(001)* (Vergleich mit `enumerate` bis Länge 8); 2.69 auf 2.44;
   2.49/2.50 auf 2.14; 2.30 auf einem 2-Zustands-DEA mit Hand-Erwartung (Tabelle k=0,1,2).
3. Eigenschaftsbasiert (fester Seed, je 100 Fälle, kleine Größen): zufällige Ausdrücke
   (Tiefe ≤ 4, Alphabet {a,b}) und zufällige NEA (≤ 4 Zustände, Wort- und ε-Kanten):
   jede Umwandlung in der Kette Ausdruck → Grammatik → NEA → DEA → minimal → Ausdruck
   erhält die Sprache: `enumerate` bis Länge 6 gleich **und** `equivalent` = true.
   Minimierung: Ergebnis hat nie mehr Zustände, ist minimal (zweimal minimieren ändert
   die Zahl nicht), Komplement/Schnitt/Vereinigung stimmen mit Mengenoperationen auf
   `enumerate` überein. `equivalent` liefert bei Ungleichheit ein Wort, das genau ein
   Objekt akzeptiert, und es gibt kein kürzeres (Prüfung über `enumerate`).
4. Jeder Schritt: `view.obj` (falls vorhanden) besteht `validate` ohne Fehler; alle
   Erklärungsschlüssel stehen in `EXPLANATION_KEYS`.
5. Grenzen: Potenzmenge mit maxStates 3 auf einem NEA, der mehr braucht → `algo.limit`.
