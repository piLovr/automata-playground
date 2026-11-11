# Spezifikation Kernbibliothek M4

Plan: `docs/plan-m4.md` (Entscheidungen am Ende verbindlich). Skript:
`docs/skript-notizen-m4.md`, `docs/skript-notizen-typen.md`. Typen verbindlich in
`core/model/types.ts`: `DerivStep`, `Derivation`, `DerivTree`, `TreesResult`,
`AmbiguityResult`, `ParseAction`, `ParseRow`, `ParseRun`, `NKA.acceptBy`,
`MethodId 'grammar2nka'`, Codes `derive.*`, `algo.notType2`. Aufbau und Regeln wie M2/M3.

---

## Teil A: Ableitungen, Bäume, Mehrdeutigkeit (kern-entwickler A) — `core/derive/`

```ts
export function applicable(g: Grammar, form: Word): { production: ProductionId; pos: number }[];
export function applyProduction(g: Grammar, form: Word, production: ProductionId, pos: number): { form: Word } | { error: Diagnostic };
export function leftmostPos(g: Grammar, form: Word): number | null;   // Index des linkesten Nichtterminals
export function startDerivation(g: Grammar): Derivation;             // start = [S]
export function extend(g: Grammar, d: Derivation, production: ProductionId, pos: number): Derivation | { error: Diagnostic };
export function treeOf(g: Grammar, d: Derivation): DerivTree | null;  // nur Typ 2, sonst null
export function leftmostOf(g: Grammar, t: DerivTree): Derivation;     // 4.22
export function rightmostOf(g: Grammar, t: DerivTree): Derivation;
export function treeSize(t: DerivTree): number;
export function treeYield(t: DerivTree): Word;                         // Blätter ohne ε
export function sameTree(a: DerivTree, b: DerivTree): boolean;         // Struktur + Produktionen, ids egal
export function findDerivation(g: Grammar, w: Word, opts?: { maxSteps?: number; leftmost?: boolean }): ProcResult<Derivation>;
export function parseTrees(g: Grammar, w: Word, opts?: { maxNodes?: number; maxTrees?: number }): ProcResult<TreesResult>;
export function findAmbiguity(g: Grammar, opts?: { maxLen?: number; maxNodes?: number }): ProcResult<AmbiguityResult>;
export function cfgWords(g: Grammar, maxLen: number, opts?: { maxWork?: number }): { words: Word[]; complete: boolean };
```

- `applicable`/`applyProduction` gelten für alle Typen (Typ 0: linke Seite beliebiges Wort,
  jede Vorkommensstelle). `pos` = Index in der Satzform. ε-Produktion entfernt die Stelle.
- `treeOf`: 4.19 – an das Blatt der ersetzten Stelle werden Kinder mit den Symbolen der
  rechten Seite gehängt, bei ε ein ε-Blatt. Dafür wird je Satzformsymbol der zugehörige
  Baumknoten mitgeführt. Ids in Vorordnung 0, 1, … (nach Fertigstellung neu nummerieren).
- `findDerivation`: Typ 2 als Linksableitung, Typ 0/1 als Breitensuche über Satzformen.
  Grenzen: `maxSteps` (Standard 50 000) und Satzformlänge ≤ |w| + Anzahl ε-fähiger
  Stellen + 2. Ausgänge:
  - gefunden → `ok: true` mit der kürzesten gefundenen Ableitung
  - Grenze erreicht → `ok: false`, Diagnose `derive.limit` (Warnung)
  - Suche vollständig ohne Treffer → `ok: false` mit leerer `diagnostics`-Liste
    (w ist nicht ableitbar); die Oberfläche unterscheidet die beiden Fälle.
- `parseTrees` (nur Typ 2, sonst `derive.notType2`): alle Linksableitungen von w, jede
  ergibt genau einen Baum (4.22). Beschneidung: Terminalpräfix der Satzform muss zu w
  passen; Anzahl Terminale + Anzahl nicht ausleerbarer Nichtterminale ≤ |w|; Baumgröße ≤
  `maxNodes` (Standard 60). Reihenfolge: Baumgröße aufsteigend, dann Reihenfolge der
  Linksableitung (Produktionen in Modellreihenfolge). `maxTrees` Standard 50.
  `infinite`: es gibt ein Nichtterminal X mit X ⇒⁺ X (über ε-fähige Nachbarn, z. B.
  S → SS mit S ⇒* ε), das in einem Baum von w vorkommt. `complete`: Suche ohne Grenze
  fertig (bei `infinite` nie true).
- `findAmbiguity` (Typ 2): Wörter nach Länge 0 … maxLen (Standard 8), je Länge in
  lexikographischer Ordnung (Terminalreihenfolge von T), nur Wörter der Sprache (über
  `cfgWords`), erstes Wort mit ≥ 2 verschiedenen Bäumen (`parseTrees`, maxTrees 2). Ehrlich:
  nie „eindeutig“ behaupten (`found: null`, `checkedUpTo`, `limitHit`).
- `cfgWords` (Typ 2): alle Terminalwörter bis Länge maxLen über Linksableitungen mit
  Beschneidung (wie oben, ohne festes Zielwort: Anzahl Terminale + nicht ausleerbare NT ≤
  maxLen); `complete` false bei `maxWork` (Standard 200 000 Satzformen). Für Typ 3 genügt
  auch der vorhandene Weg; Explorer: Grammatik Typ 2 → `cfgWords`
  (`exact = complete`), Typ 0/1 → bisherige Stichprobe.
- Beispiele 4.17–4.24 exakt; 4.24: `parseTrees(4.16, ()()())` liefert als erste zwei Bäume
  die Bäume A und B aus den Notizen (Größe gleich, Reihenfolge nach Linksableitung),
  `infinite = true`.
- Erklärungsschlüssel nur, falls Schritte geliefert werden (hier keine Pflicht).

## Teil B: Kellerautomat (kern-entwickler B) — `core/algo/`, `core/sim/nka.ts`, Text

```ts
export function grammarToNka(g: Grammar, opts?: ProcOptions): ProcResult<NKA>;          // MethodId grammar2nka, 4.27
export function topDownRun(g: Grammar, w: Word, opts?: { maxConfigs?: number }): ProcResult<ParseRun>;   // Lauf wie 4.28
export function bottomUpRun(g: Grammar, w: Word, opts?: { maxConfigs?: number }): ProcResult<ParseRun>;  // Lauf wie 4.34
```

- `grammarToNka` (Typ 2, sonst `algo.notType2`): Zustände `z0`, `z`, `z+`; Start z0,
  F = {z+}; y0 = `*` (falls `*` ∈ N ∪ T: frisches Symbol wie `⊥`); Kelleralphabet
  {y0} ∪ T ∪ N; Alphabet X = T. Übergänge genau 4.27: (z0, y0, ε) → (z, S y0); je Produktion
  X → w: (z, X, ε) → (z, w); je x ∈ T: (z, x, x) → (z, ε); (z, y0, ε) → (z+, y0).
  Herkunft mit corr: Produktionsübergang ↔ Produktion. Schritte: je Übergang ein Schritt
  `proc.gk.start|produce|read|accept`. Layout: z0, z, z+ nebeneinander.
- `topDownRun`: Suche über Konfigurationen des 4.27-Automaten (wie NKA-Simulation,
  Breitensuche, Duplikate abschneiden, `maxConfigs` Standard 20 000). Bei Akzeptanz der Weg
  als `rows` genau im Format von Tabelle 4.28 (Zeile A bis O für (())() bei Grammatik 4.16,
  einschließlich Akzeptanzzeile mit z+), `form` = gelesen + Keller ohne y0,
  `derivation` = Linksableitung (Satzformen der Produktionszeilen), `tree` daraus.
  `deadEnds` = Blätter der Suche ohne Fortsetzung. Akzeptanz nur bei vollständig
  gelesener Eingabe (4.5).
- `bottomUpRun`: modifizierter Kellerautomat 4.33 (Keller oberstes Symbol rechts, y0 = `*`
  ganz links): Leseschritt kellert das nächste Eingabesymbol; Reduktion ersetzt ein
  Kellerende v durch Y für Y → v (auch v = ε: Y wird gekellert); Akzeptanz, wenn Eingabe
  gelesen und Keller = y0 S (dann Zeile mit z+). Suche: Tiefensuche in der Reihenfolge
  „reduzieren vor lesen; längere rechte Seite zuerst; Produktionen in Modellreihenfolge“,
  mit Grenze für ε-Reduktionen (höchstens |w| + 2 Symbole mehr im Keller als gelesen) und
  `maxConfigs`. Für 4.16 und (())() muss genau die Zeilenfolge aus Tabelle 4.34 entstehen
  – falls die Reihenfolgeregel das nicht liefert, die Regel so wählen, dass 4.34
  herauskommt, und in der Rückmeldung begründen. `derivation` = Rechtsableitung (Reduktionen
  rückwärts, 4.36), `tree` daraus.
- NKA-Option `acceptBy: 'empty'` in `core/sim/nka.ts`: akzeptiert, wenn Eingabe gelesen und
  Keller = [y0] (Zustand egal); Text `akzeptanz leer` (Kopfzeile, nur nka), Printer schreibt
  sie nur bei 'empty'; JSON-Prüfung; `edit.setAcceptBy(obj, mode)`.
- `applicableMethods(grammatik Typ 2)` enthält `grammar2nka`; `runMethod` verteilt.
  `chainPlan` bleibt unverändert.
- Explorer/`accepts`/`enumerate` für NKA wie bisher; für Grammatik Typ 2 über Teil A
  (`cfgWords`) – Abstimmung: Teil A liefert `cfgWords`, Teil B bindet nichts davon an.

## Teil C: Tests (tester)

- 4.17–4.24 Ableitungen und Bäume (Kantenliste 4.20, Klammerform), 4.21 (zwei Ableitungen,
  ein Baum), 4.22 (Links-/Rechtsableitung aus Baum), 4.24 (zwei Bäume, infinite).
- Abnahme: `parseTrees(S → ε | (S) | SS, ()()())` liefert ≥ 2 verschiedene Bäume, die ersten
  beiden sind A und B; `findAmbiguity` findet für 4.16 ein Wort mit zwei Bäumen; für die
  eindeutige Grammatik S → ε | ST, T → (S) bis Länge 8 nichts, Meldung ehrlich.
- 4.28 Zeile für Zeile (gelesen, Zustand, Keller, Aktion) inkl. Linksableitung; 4.34 Zeile
  für Zeile; NKA 4.6 mit 00001111 (schon vorhanden, nur bestätigen).
- Eigenschaft: zufällige kleine Typ-2-Grammatiken (≤ 3 NT, ≤ 6 Produktionen über {a,b}):
  Wörter aus `cfgWords` bis Länge 5 werden vom Automaten aus `grammarToNka` akzeptiert,
  Wörter nicht in der Liste nicht (Stichprobe aller Wörter bis Länge 5); `topDownRun` und
  `bottomUpRun` akzeptieren genau dieselben Wörter (wo ohne Grenze).
- `acceptBy: 'empty'`: kleiner Automat, Round-Trip Text/JSON.
