# Spezifikation Kernbibliothek M6

Plan: `docs/plan-m6.md` (Entscheidung am Ende verbindlich). Skript: `docs/skript-notizen-m6.md`,
TM-Grundlagen `docs/skript-notizen-typen.md`. Typen verbindlich in `core/model/types.ts`
(Abschnitt „Typ 1 und Typ 0, LBA, …“, dazu `TM.bounded`, `SimResult 'bound'`,
`TapeView.bounds`, `GrammarTypeInfo.reason 'contextSensitive'` und `nonContracting`).
`grammarType` ist bereits umgestellt (Typ 1 nur in der Form uXv → uwv, 5.1). Neues Verzeichnis
`core/m6/` mit `index.ts`, eine Exportzeile in `core/index.ts`.

**Formulierungsregel (MUSS):** Kein Ergebnis darf behaupten, dass eine Maschine nicht hält
oder ein Wort nicht ableitbar ist, außer es ist bewiesen (exakte Suche, wiederholte
Konfiguration). Diagnose-/Ergebnisfelder entsprechend wählen.

---

## Teil A (kern-entwickler A)

### A1 Wortproblem und Ableitungssuche — `core/m6/word.ts`

```ts
export function wordProblem(g: Grammar, w: Word, opts?: WordProblemOptions): ProcResult<WordProblemResult>;
```

- Breitensuche über Satzformen ab [S], kürzeste Ableitung (beliebige Stelle, keine
  Linksableitung), Rückgabe als `Derivation` wie `findDerivation`.
- `grammarType(g).nonContracting` → exakt: Satzformen länger als max(|w|, 1) verwerfen (bei
  S → ε nach 5.1 nur [S] ⇒ []); Suche vollständig ⇒ `notDerivable`, `exact: true`. Schrittlimit
  trotzdem (dann `unknown`, `limitHit: 'steps'`).
- sonst: Längengrenze `maxLength` (Standard |w| + 4). Nichts gefunden ⇒ `unknown`,
  `limitHit: 'length'` (bzw. `'steps'`), nie `notDerivable`.
- Typ 2 und 3 dürfen ebenfalls durch diese Funktion gehen (dann ist nonContracting oft false
  wegen ε-Produktionen; ok – für Typ 2 bleibt `findDerivation` maßgeblich).
- **Fehlerbehebung** in `core/derive/search.ts` `findDerivation`: für Typ < 2 an `wordProblem`
  delegieren. Bei `unknown` `ok: false` mit Warnung `derive.limit` ({what: 'length' | 'steps',
  limit}), bei exakt `notDerivable` `ok: false` ohne Diagnose (wie bisher „nicht ableitbar“).
  Bestehende Tests in `core/test/m4-derive.test.ts` müssen grün bleiben.
- Prüfe `core/algo/enumerate.ts` (Zeile ~85, `nonShrinking ? n : 2*n+4`) und den Sprach-Explorer
  (`core/explore`): Für verkürzende Grammatiken darf keine Wortliste/Anzahl als vollständig gelten.
  Wenn dort ein `complete`/Grenzen-Flag existiert, muss es bei verkürzenden Grammatiken false sein.
  Nur melden, was du geändert hast.

### A2 LBA — `core/sim/tm.ts`

- `tm.bounded === true`: erlaubte Positionen −1 … n (n = |w|; bei n = 0: −1 … 0). Jede `TapeView`
  bekommt `bounds: [-1, n]`, die Zellen umfassen immer das ganze Fenster.
- Bewegt sich der Kopf auf eine Position außerhalb, wird der Schritt noch ausgeführt (Schreiben,
  Zustand), dann hält die Simulation mit `result: 'bound'` und einem Schritt mit Erklärung
  `sim.tm.bound` {head, bounds}. Endzustände haben Vorrang (wird gleichzeitig ein Endzustand
  erreicht, zählt der Endzustand – Festlegung, kommentieren).
- Textform: Kopfzeile `lba` (ohne Argument) in der TM-Deklaration setzt `bounded: true`;
  Drucker gibt sie aus; JSON prüft `bounded` optional boolean. Lexer-Schlüsselwort ergänzen
  (`core/text/lexer.ts`, `parser.ts`, `kinds.ts` tmSpec, `grammatik.ebnf`).
- Alle `switch`/Records über `SimResult` im Kern (z. B. `runBatch`) um `'bound'` ergänzen.

### A3 Hierarchie — `core/m6/hierarchy.ts`

```ts
export function hierarchyPlacement(obj: FormalObject): HierarchyPlacement;
```

DEA → 3 'dea', NEA → 3 'nea', regex → 3 'regex', egrep ohne Rückverweis → 3 'egrep', mit
Rückverweis → 1 'egrepBackref' (exact false), Menge → 3 'menge', Grammatik nach
`grammarType`: 3 'grammar3', 2 'grammar2', 1 'grammar1', 0 'grammar0' – Ausnahme: Typ 0 mit
`nonContracting` → 1 'grammar1' (Sprachklasse gleich, exact false); NKA → 2 'nka'; TM →
`bounded` ? 1 'lba' : 0 'tm'; Mealy/Moore → null 'transducer'. `exact` nur für Stufe 3 true.
Rückverweise: im egrep-AST nachsehen (Knotentyp siehe `core/model/egrep.ts`).

### A4 Zeit und Platz — `core/m6/cost.ts`

```ts
export function tmCost(tm: TM, opts?: TmCostOptions): TmCostRow[];
```

- Wörter: `opts.words` gruppiert nach Länge, sonst alle Wörter über `tm.alphabet` der Längen
  0 … maxLen (Standard 6) in Längen-lexikographischer Reihenfolge, je Länge höchstens
  `perLength` (Standard 2000).
- Je Wort `simulateTm` mit `stepLimit` (Standard 10000). Schritte = steps.length − 1;
  besuchte Felder = `visited`. `halted` zählt alles außer `'limit'`. Maxima nur über haltende.
- Für Geschwindigkeit darf eine schlanke Variante ohne SimStep-Aufzeichnung benutzt werden
  (`runTmFast(tm, w, limit): { result, steps, visited }` in `core/sim/tm.ts`), die exakt dieselben
  Zahlen liefert (Test).

## Teil B (kern-entwickler B) — `core/m6/beaver.ts`

```ts
export function busyBeaver(opts: BeaverOptions, onProgress?: (done: number) => boolean | void): BeaverResult;
export function beaverTm(n: number, table: string): TM; // Hilfsfunktion für Tests/Beispiele, Format wie 5.41: "B1R C1L …"
```

- 5.40: Bandalphabet {□, 1}, Zustände A, B, C, D (n Stück) + Endzustand Z (F+, keine
  Übergänge, F− leer), Start A, leeres Band. Übergänge f(q, y) = (q′, y′, d) mit d ∈ {−1, +1}
  (Bewegung 0 nicht, wie im Biber-Standard und in 5.41), q′ ∈ {A…, Z}.
- Aufzählung in Baum-Normalform: Maschine mit allen Übergängen „undefiniert“ starten, ausführen;
  trifft sie auf einen undefinierten Übergang (q, y), verzweigen in alle Möglichkeiten
  (Halt-Übergang nach Z mit beliebigem Schreibsymbol/Richtung zählt einmal, typisch:
  Z, 1, R) plus neue Zustände nur in Reihenfolge (höchstens den nächsten unbenutzten).
  Erster Übergang (A, □) fest A→B,1,R (Symmetrie, Spiegelung) – nur wenn n ≥ 2;
  dokumentieren. Undefinierter Übergang, für den kein Platz mehr ist (alle Übergänge bis auf
  den Halt-Übergang belegt): Halt-Übergang.
- Ausführung je Maschine bis `stepLimit` (Standard: 1000; n = 4 muss im Test mit 200 unter ~20 s
  bleiben, miss die Laufzeit für 1000 und melde sie). Zählen: Einsen auf dem Band beim Halt
  (der Halt-Übergang schreibt noch). Schritte inklusive des Halt-Übergangs.
- Wiederholungsnachweis `provenLoop`: exakte Wiederholung der Konfiguration (Zustand, Kopf
  relativ, Bandinhalt), z. B. per Hash in Abständen (Brent) – nur exakte Gleichheit zählt.
  Optional „Übersetzungszyklus“ (Kopf läuft auf reinem Blank-Band in derselben
  Zustandsfolge immer weiter): nur, wenn sauber begründbar; sonst `undecided`.
- `onProgress(enumerated)` alle ~1000 Maschinen; liefert er `true`, abbrechen → `complete: false`.
- Erwartung (Test): n = 1, 2, 3 ergibt best.ones = 1, 4, 6 (5.41); n = 4 ergibt 13, sofern
  stepLimit ≥ 107 (Literaturwert S(4) = 107 – nur als Testwissen, nicht in der Oberfläche als Satz).
- `best.tm` als vollständiges `TM`-Objekt (Namen A…, Z, Positionen leer – Layout macht die UI).

## Teil C (tester, danach)

Eigene Datei `core/test/m6.test.ts`: 5.9/Abb. 5.2 erneut (22 Konfigurationen), wordProblem
exakt gegen eine einfache Brute-Force-Aufzählung für zufällige nicht verkürzende Grammatiken,
Typ 0 nie `notDerivable`, LBA-Grenze (Kopf läuft rechts heraus → 'bound', Bänder mit bounds),
Hierarchie-Zuordnungen, tmCost gegen simulateTm, BB(1…3), Formulierungsregel: in
`app/i18n/de.ts` kommen „hält nicht“, „hält nie“, „läuft endlos“, „terminiert nicht“ nur in
Schlüsseln mit Präfix `halting.` vor.
