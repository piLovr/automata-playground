# Plan M2: Reguläre Ausdrücke, Typ-3-Grammatiken, Verfahren aus 7.1, Arbeitsfläche

Grundlage: Anforderungen Abschnitte 2, 3, 7.1, 8, 10, 11; Skriptnotizen
`docs/skript-notizen-m2.md`. Entscheidungen aus M1 (`docs/stand-m1.md`) gelten weiter.

## 1. Neue Objektarten

`FormalObject = Automaton | Ausdruck | Grammatik`. Ausdruck und Grammatik sind **keine**
`AutomatonBase`; die Registry bekommt dafür einen zweiten Eintragstyp (`ExprKindSpec`),
der Parser verzweigt nach dem Schlüsselwort.

```ts
/** Regulärer Ausdruck nach 2.21 als Syntaxbaum. */
export type RegExpr =
  | { op: 'empty' }                         // ∅
  | { op: 'sym'; sym: Sym }                 // x ∈ A
  | { op: 'union'; left: RegExpr; right: RegExpr }   // (R1|R2)
  | { op: 'concat'; left: RegExpr; right: RegExpr }  // (R1R2)
  | { op: 'star'; inner: RegExpr };          // (R*)
  // 2.21 kennt kein ε. Eingabe ε/eps wird als Abkürzung für ∅* gelesen (Entscheidung 1).

export interface Ausdruck {
  kind: 'regex';
  name: string;
  alphabet: Sym[];            // A; ohne Angabe = Symbole des Ausdrucks
  expr: RegExpr | null;       // null = leer / ungültig
  source: string;             // Eingabetext wie getippt (für den Editor; Round-Trip kanonisch)
  origin?: Origin;
}

export interface Production { id: string; left: Word; right: Word }   // Typ 0 erlaubt beliebige linke Seiten
export interface Grammatik {
  kind: 'grammar';
  name: string;
  nonterminals: Sym[];        // N, Reihenfolge = Anzeige
  terminals: Sym[];           // T
  start: Sym | null;          // S
  productions: Production[];  // P
  origin?: Origin;
}
```

Typ-Erkennung (Abschnitt 3.1, jetzt schon, weil billig): `grammarType(g)` liefert
`{ type: 0|1|2|3, perProduction: { id, maxType, reason }[] }`. In M2 rechnen alle
Verfahren nur mit Typ 3 (rechtslinear nach 2.45: X → w, X → wY, w ∈ T*); andere Typen
lassen sich anlegen und anzeigen, Ableitungssimulation folgt in M4.

### Herkunft und Entsprechungen (Abschnitt 8)

Jedes Objekt (auch Automaten) bekommt ein optionales Feld `origin`:

```ts
export interface Origin {
  method: MethodId;           // z. B. 'nea2dea', 'minimize', 'regex2grammar'
  sources: string[];          // Objektnamen der Quellen
  sourceHash: string[];       // Prüfsumme der Quellen beim Erzeugen → „veraltet“ erkennen
  params?: Record<string, unknown>;
  /** Element des Ergebnisses → Elemente der Quelle (Hervorhebung). */
  corr?: Correspondence[];
}
export interface Correspondence {
  target: ElemRef;            // z. B. { state: 's3' } oder { nonterminal: 'X' }
  source: { object: string; elems: ElemRef[] };
}
export type ElemRef = { state: StateId } | { transition: TransitionId }
                    | { nonterminal: Sym } | { production: string } | { subexpr: number[] };
```

Beispiele: DEA-Zustand ↔ NEA-Zustandsmenge (2.74), Minimalzustand ↔ Klasse (2.90),
NEA-Zustand z_X ↔ Nichtterminal X (2.69), Nichtterminal ↔ Teilausdruck (2.52–2.54).
Die Hervorhebung läuft transitiv über die Kette.

## 2. Textsprache (EBNF-Erweiterung)

```ebnf
kind        = "dea" | "nea" | "mealy" | "moore" | "nka" | "tm" ;   (* Automaten, wie bisher *)
object      = automaton | regexobj | grammarobj ;

(* Regulärer Ausdruck: Kurzform in einer Zeile oder Blockform mit Kopfangaben *)
regexobj    = "regex" , ws , name , ws? , ( "=" , regex , eol
            | "{" , { ws | comment | "alphabet" , { ws , symbol } | "=" , regex | origin } , "}" ) ;
regex       = union ;
union       = concat , { "|" , concat } ;            (* linksgeklammert *)
concat      = starred , { starred } ;                (* linksgeklammert *)
starred     = atom , { "*" } ;
atom        = symbol | "∅" | "\0" | "ε" | "eps" | "(" , regex , ")" ;   (* ε = ∅*, Entscheidung 1 *)
(* Sonderzeichen | ( ) * ∅ als Symbol mit Backslash: \| \( \) \* \∅ ; Leerraum wird ignoriert,
   Leerzeichen als Symbol "\ " ; ASCII-Ersatz für ∅: \0 *)

grammarobj  = "grammatik" , ws , name , ws? , "{" , { ws | comment | gstmt } , "}" ;
gstmt       = "nichtterminale" , { ws , symbol }
            | "terminale" , { ws , symbol }
            | "start" , ws , symbol
            | production | origin ;
production  = gword , ws? , ( "->" | "→" ) , ws? , alt , { ws? , "|" , ws? , alt } ;
alt         = "ε" | "eps" | gword ;
gword       = symbol , { symbol } ;                  (* Leerraum innerhalb eines Worts erlaubt *)

origin      = "herkunft" , ws , method , ws , "aus" , ws , name , { ws , name } , eol ,
              { "entspricht" , ws , elem , ws , "=" , ws , elem , { ws , elem } , eol } ;
```

- **Nichtterminale**: alles, was in `nichtterminale` steht oder auf einer linken Seite
  vorkommt; ohne `terminale` sind alle übrigen Symbole Terminale. Mehrbuchstabige Symbole
  wie bisher als `<Xz>`; zusätzlich gilt in Produktionen: deklarierte Nichtterminale werden
  längstmöglich erkannt, damit `X0 -> -X1 | X1` (2.44) ohne spitze Klammern tippbar ist.
  Der Printer schreibt mehrbuchstabige Nichtterminale nur dann ohne `<>`, wenn das eindeutig
  zurückgelesen wird.
- **Klammereinsparung**: Stern vor Konkatenation vor `|`, beides linksgeklammert. Der
  Printer schreibt in der Standardform nur nötige Klammern; „strenge Form“ (voll
  geklammert nach 2.21) als Ansicht und Druckoption `strict`.
- **Fehlermeldungen** im Stil der Liste falscher Ausdrücke 2.22 (z. B. `()`, `|a`, `a||b`,
  `*a`): Code `regex.*` mit Zeile/Spalte und erwartetem Token.
- `herkunft`/`entspricht` machen Herkunft und Entsprechungen textuell verlustfrei
  (Round-Trip). Die Text-Sicht blendet sie standardmäßig aus wie `layout`.

Beispiel:

```
regex R1 = (0|1)*01

grammatik G1 {
  start S
  S -> 0S | 1S | 01
  herkunft regex2grammar aus R1
}
```

## 3. Verfahren (core/algo)

Gemeinsame Form, sofort und schrittweise aus **einer** Implementierung:

```ts
export interface ProcResult<R> {
  result: R;                 // Ergebnisobjekt (mit origin) oder Antwort (Äquivalenz, Wort)
  steps: ProcStep[];         // leer im Modus „sofort“, wenn opts.steps === false
  status: 'ok' | 'limit' | 'cancelled';
}
export interface ProcStep {
  explanation: Explanation;  // Schlüssel + Parameter (Texte in de.ts)
  view: StepView;            // was die Oberfläche zeigt
  highlight?: ElemRef[];
}
export type StepView =
  | { kind: 'object'; obj: FormalObject }                       // Zwischenobjekt (2.71, 2.72, 2.69 …)
  | { kind: 'partition'; round: number; classes: StateId[][] }  // ≡k bei 2.90
  | { kind: 'set'; label: string; items: StateId[] }            // wachsende Menge 2.82
  | { kind: 'table'; rows: string[]; cols: string[]; cells: string[][] }  // L^k_ij, Potenzmenge
  | { kind: 'product'; pairs: [StateId, StateId][] };           // Produktautomat
```

| Verfahren | Funktion | Skript | Schritte |
|---|---|---|---|
| NEA → DEA | `neaToDea(n, {fullPowerset?})` | 2.71, 2.72, 2.74 | Phase 1 Wortkanten zerlegen (Objekt), Phase 2 ε entfernen (Objekt je Regel), Phase 3 eine Zeile der Potenzmengentabelle je neuer Teilmenge |
| DEA → Ausdruck | `deaToRegex(m)` | 2.30 | Tabelle L^k_ij für k = 0 … m, Ergebnis als Vereinigung über F |
| Zustandselimination | `deaToRegexElim(m)` | – | als „nicht im Skript“ markiert (SOLL) |
| Ausdruck → Grammatik | `regexToGrammar(r)` | 2.52–2.54 | je Teilausdruck von innen nach außen eine Grammatik |
| Grammatik → NEA | `grammarToNea(g)` | 2.69 | eine Kante je Produktion |
| DEA → Grammatik | `deaToGrammar(m)` | 2.49/2.50 | eine Produktion je Übergang/Endzustand |
| Ausdruck → NEA | `thompson(r)` | – | „nicht im Skript“ |
| Komplement / Durchschnitt / Vereinigung | `complement`, `product(m1, m2, op)` | 2.33 | Paare in BFS-Reihenfolge |
| Erreichbare Zustände | `reachable(m)` | 2.82 | Mengen R0 ⊆ R1 ⊆ … |
| Minimierung | `minimize(m)` | 2.90 | erst 2.82, dann Runden ≡0, ≡1, … bis stabil, Tabelle je Runde |
| Äquivalenztest | `equivalent(a, b)` | 2.26 (Hinweis) | beide zu DEA, BFS im Produkt → kürzestes (dann lexikographisch kleinstes) unterscheidendes Wort |
| Trennendes Wort | `separatingWord(m, w1, w2)` | 2.84 | aus der Minimierungsrunde, in der sich die Zustände trennen |
| Mealy ↔ Moore | `mealyToMoore`, `mooreToMealy` | – | „nicht im Skript“ (SOLL) |

Jedes Verfahren prüft seine Vorbedingung (z. B. DEA vollständig, Grammatik Typ 3) und
liefert sonst eine Diagnose statt einer Ausnahme. Kein Skripttext; Erklärungen formuliere
ich selbst in `de.ts`.

Hilfsfunktion für Tests und Oberfläche: `toDea(obj)` wandelt jedes Typ-3-Objekt intern
in einen DEA (Ausdruck über Thompson, schnellster Weg); `enumerate(obj, n)` zählt Wörter
bis Länge n auf (unabhängiges Orakel für eigenschaftsbasierte Tests).

## 4. Web Worker und Abbruch

- `core/algo` bleibt synchron und rein. `app/lib/worker.ts` führt Verfahren im Worker
  aus (`?worker&inline`, damit der Singlefile-Build und `file://` funktionieren).
  Protokoll: `{ id, method, args, opts }` → `{ id, result }` / `{ id, error }`.
- Abbruch = `worker.terminate()` und neuer Worker. Fortschritt meldet der Worker
  in Abständen (Anzahl erzeugter Teilmengen u. ä.).
- Grenzen sichtbar und einstellbar: höchstens Zustände bei der Potenzmenge (Standard 2000),
  Ausdrucksgröße bei 2.30 (Standard 50 000 Knoten), Wortlänge bei Suchen.
- Fallback: Lässt sich kein Worker starten, läuft das Verfahren im Hauptthread mit
  denselben Grenzen.

## 5. Oberfläche (meine Aufgabe)

- **Editoren**: Ausdruck einzeilig mit Hervorhebung, Fehlern an Spalte, Sonderzeichen-
  Leiste (ε, ∅, →), Syntaxbaum darunter, Umschalter Standardform/strenge Form.
  Grammatik als Texteditor plus Tabelle der Produktionen mit Typ und Begründung je Zeile.
- **Verfahren**: neuer Reiter rechts „Verfahren“ mit den für das aktive Objekt
  passenden Verfahren; je Verfahren „sofort“ und „schrittweise“. Schrittweise öffnet
  den Schrittspieler (wie die Simulationsleiste: vor, zurück, Anfang, Ende, Abspielen),
  der die `StepView` rendert: Zwischenobjekt als Graph, Partition als farbige Klassen im
  Graphen (zusätzlich Klassennummer am Zustand, nicht nur Farbe) plus Tabelle je Runde,
  L^k_ij-Tabelle mit k-Schieber. Am Ende „Als Objekt übernehmen“.
- **Arbeitsfläche**: Umschalter Einzelansicht ↔ Arbeitsfläche. Die Arbeitsfläche zeigt
  die Objekte nebeneinander (2–4 Spalten, kompakte Graphen bzw. Ausdruck/Grammatik),
  darüber die Herkunftskette als kleiner Abhängigkeitsgraph (`R1 → G1 → N1 → M1 → M1min`).
  Zeigen auf ein Element hebt die Entsprechungen in allen Spalten hervor.
- **Veraltet**: Ändert sich eine Quelle, wird das abgeleitete Objekt als veraltet markiert
  (Prüfsumme), mit Knopf „neu berechnen“ (SOLL 8.3, nur Markierung + Knopf).
- **Äquivalenz**: Knopf auf der Arbeitsfläche „alle vergleichen“, Ergebnis als Matrix
  mit ✓ bzw. unterscheidendem Wort.
- Simulation und Stapellauf für Ausdruck und Typ-3-Grammatik über `toDea` (nur Ergebnis,
  ohne Zustandsanzeige).
- Beispiele: 2.92 (Minimierung) und je ein Ausdruck/eine Grammatik aus den Notizen.

## 6. Subagenten und Ablauf

| Schritt | Agent | Auftrag |
|---|---|---|
| 0 | skript-leser (Haiku) | Notizen `docs/skript-notizen-m2.md` (läuft bereits) |
| 1 | ich | `core/model/types.ts` erweitern (verbindlich), `docs/kern-spec-m2.md` schreiben |
| 2a | kern-entwickler A (Sonnet) | Ausdruck und Grammatik: Typen in Registry, Parser/Printer, EBNF, JSON, `validate`, `grammarType`, `herkunft`; Dateien `core/text/*`, `core/model/*` |
| 2b | kern-entwickler B (Sonnet) | alle Verfahren in `core/algo/*` (nur neue Dateien) |
| 2c | tester (Haiku) | Tests gegen die Spezifikation: Skriptbeispiele (2.92 Runde für Runde), Round-Trip, eigenschaftsbasiert (zufällige DEA/NEA/Ausdrücke, jede Umwandlung erhält die Sprache, Orakel `enumerate` bis Länge 6) |
| 2d | ich | Oberfläche gegen `core/index.ts`, Worker |
| 3 | tester / fehlersucher (Sonnet) | alles laufen lassen, rote Tests beheben |
| 4 | ich | Abnahme im Browser, `docs/stand-m2.md` |

2a und 2b arbeiten auf getrennten Dateien; 2b importiert nur die Typen aus Schritt 1.

## 7. Abnahme

1. `regex R = (0|1)*01` → „Grammatik (2.52–2.54)“ → „NEA (2.69)“ → „DEA (2.71/2.72/2.74)“ →
   „Minimieren (2.90)“; die Arbeitsfläche zeigt die Kette, der Äquivalenztest bestätigt
   jedes Paar.
2. Beispiel 2.92 schrittweise: Runden ≡0, ≡1, … wie im Skript, Klassen im Graphen.
3. Tests grün, Lint und Typprüfung grün, Build als eine `dist/index.html`, Worker läuft
   auch per `file://`.

## 8. Nicht in M2

Sprach-Explorer, Export SVG/PNG/TikZ (M3); Ableitungssimulation und Typ-2-Verfahren (M4);
egrep-Regex (M7).

## 9. Präzisierungen und Lücken im Skript (Notizen `skript-notizen-m2.md`)

| Stelle | Befund | Umsetzung |
|---|---|---|
| 2.21 | ε ist kein Zeichen; {ε} nur als ∅* | Entscheidung 1 |
| 2.30 | Zustände z0 … z(m−1), k = 0 … m; L^0_ii enthält ε, Ergebnis ⋃ L^m_0j über F; kein Beispiel | ε als ∅*; Ausdrücke wachsen stark → Entscheidung 2 |
| 2.33 | Vereinigung nicht konstruiert, nur Komplement und Durchschnitt | Produkt mit F = F1×Z2 ∪ Z1×F2, markiert „nicht im Skript“ |
| 2.44 | Startsymbol als „Xn“ gedruckt, N = {X0 … X7} | Beispiel mit S = X0 |
| 2.53/2.54 | Konkatenation und Vereinigung gegeben; Stern und Basisfälle ∅, a fehlen (Übung) | Entscheidung 3 |
| 2.72 | Reihenfolge und Wiederholung von R1–R3 und F-Regel offen; bei Ketten ε ε hängt das Ergebnis von der Reihenfolge ab | Entscheidung 4 |
| 2.74 | Z_M = volle Potenzmenge, ∅ eingeschlossen | nur erreichbare Teilmengen (Anforderung), ∅ erscheint als Zustand, wenn erreichbar; volle Potenzmenge zuschaltbar |
| 2.90 | Pseudocode erhöht i nicht | i ← i+1 je Runde; Klassen heißen wie im Beispiel [A], [CDG] |
| 2.92 | Runden ≡0 = {CDG}{ABEF}, ≡1 = {AE}{B}{F}{CDG}, ≡2 = ≡3, 5 Klassen | Test Runde für Runde |

### Entscheidungen (2026-11-10)

1. **ε im Ausdruck** ist eine Abkürzung für ∅*: es darf getippt werden, intern wird ∅* gespeichert und gedruckt.
2. **2.30 vereinfachen**: einfache Regeln (∅|R = R, ∅R = R∅ = ∅, ∅** = ∅*, R|R = R), standardmäßig an.
   Ausgeschaltet zeigt die Tabelle die Rekursion wörtlich.
3. **2.54 ergänzen**, markiert als „Ergänzung, im Skript Übung“: ∅ wird zu S ohne Produktionen, a zu S → a.
   Stern: neues S' mit S' → ε | S₀, und jedes X → w (w ∈ T*) wird zu X → wS'.
4. **2.72**: R1, R2 und die F-Regel auf alle ε-Kanten anwenden, bis nichts mehr dazukommt; danach entfernt
   R3 alle ε-Kanten. Jede neue Kante ist ein eigener Schritt.
