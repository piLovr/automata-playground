# Spezifikation Kernbibliothek M1

Ergänzt `docs/plan-m1.md` (Abschnitte 2–4). Verbindliche Typen: `core/model/types.ts`
(nicht ändern ohne Rückfrage). Alles in `core/` ist reines TypeScript ohne DOM.

## Öffentliche Schnittstelle `core/index.ts`

```ts
export * from './model/types';

// Text
export function parseDocument(text: string): { doc: Document; diagnostics: Diagnostic[] };
export function printDocument(doc: Document, opts?: PrintOptions): string;
export function printObject(obj: FormalObject, opts?: PrintOptions): string;
export interface PrintOptions { layout?: boolean }   // Standard true: layout-Zeile ausgeben, falls Positionen vorhanden
export function parseWord(input: string): { word: Word; diagnostics: Diagnostic[] };
export function printWord(w: Word): string;            // [] → "ε"
export function printSymbol(s: Sym): string;           // mit Escapes bzw. <name>

// JSON
export function toJSON(doc: Document): string;         // JSON.stringify(doc, null, 2)
export function fromJSON(json: string): { doc?: Document; diagnostics: Diagnostic[] };

// Modell
export function validate(obj: FormalObject): Diagnostic[];
export function emptyAutomaton(kind: ObjectKind, name: string): FormalObject;
export function reconcile(prev: FormalObject | undefined, next: FormalObject): FormalObject;
export function freshName(existing: string[], prefix: string): string;   // "z0","z1",… erster freier
export * as edit from './model/edit';

// Layout
export function autoLayout(obj: Automaton, opts?: { keep?: boolean }): Record<StateId, Point>;

// Simulation
export function simulate(obj: Automaton, word: Word, opts?: SimOptions): Trace;
export function runBatch(obj: Automaton, entries: BatchEntry[], opts?: SimOptions): BatchResult[];
export function epsilonClosure(obj: NEA, states: StateId[]): StateId[];
```

## Textsprache

Grammatik: `docs/plan-m1.md` Abschnitt 3; lege sie zusätzlich als `core/text/grammatik.ebnf` ab.
Präzisierungen:

- Zeilen sind ohne Bedeutung; Anweisungen werden durch Leerraum getrennt. Eine Anweisung
  beginnt mit einem Schlüsselwort (`alphabet states start accept layout`) oder einem
  Zustandsnamen (dann Übergang). Schlüsselwort-Listen enden am nächsten Zeilenende
  (`alphabet`, `states`, `accept`, `layout` sind zeilengebunden; `start` nimmt genau einen Namen).
- Übergang: `Name ws "-" labels "->" ws Name`. Mehrere Übergänge in einer Zeile erlaubt.
- Zustandsnamen: `[\p{L}\p{N}_+'][\p{L}\p{N}_+'\-]*`. Schlüsselwörter sind als Zustandsnamen
  nicht erlaubt.
- Label-Inhalt zwischen `-` und `->`: Folge von Symbolen; `,` trennt Labels (Leerraum um `,`
  erlaubt); `ε` oder `eps` als ganzes Label = leeres Wort. Ein unmaskiertes `-` im Label
  ist nur als Beginn von `->` zulässig. Leeres Label (`A --> B`) ist ein Syntaxfehler mit
  Hinweis in `expected` auf `\-`.
- Symbol: einzelnes Zeichen außer Leerraum, `- , < > # \ { } ε`; oder `\` + beliebiges Zeichen
  (`\ ` = Leerzeichen, `\ε` = Symbol ε); oder `<ident>` = mehrbuchstabiges Symbol `ident`
  (ident = `[\p{L}\p{N}_]+`). Ein Symbol der Länge 1 wird nie als `<x>` gedruckt.
- `alphabet` fehlt → Alphabet = Symbole der Übergänge in Reihenfolge des ersten Auftretens.
  `alphabet` vorhanden → genau diese Liste (Symbole außerhalb ergeben Diagnose
  `model.symbolNotInAlphabet` aus `validate`, nicht aus dem Parser).
- Zustände: Reihenfolge des ersten Auftretens in `states`, `start`, `accept`, Übergängen,
  `layout` (in Textreihenfolge). Zustands-IDs vergibt der Parser als `s0, s1, …` in dieser
  Reihenfolge; Übergangs-IDs `t0, t1, …` je Label (ein `A -0,1-> B` ergibt zwei Übergänge).
- `layout Name@x,y …` mit Zahlen (auch negativ, Dezimalpunkt). Printer rundet auf ganze Zahlen
  nicht; er gibt Zahlen mit höchstens 2 Nachkommastellen ohne überflüssige Nullen aus.
  Round-Trip-Tests nutzen ganzzahlige Positionen.
- Fehlerbehandlung: Parser bricht nicht ab, überspringt bis zum Zeilenende bzw. `}` und meldet
  `Diagnostic` mit `line`, `col` (1-basiert), `length`, `params.expected` (Liste lesbarer
  Token-Beschreibungen wie `"->"`, `"Zustandsname"`, `"}"`).
- Unbekannte Objektart → `syntax.unknownKind`, Objekt wird übersprungen.
- DEA-spezifische Prüfungen (Labellänge ≠ 1) macht `validate`, nicht der Parser: der Parser
  erzeugt für `dea` Übergänge mit `label = word[0]` nur wenn |word| = 1; sonst trotzdem
  Übergang anlegen? **Nein**: bei `dea` meldet der Parser `dea.labelLength` mit Position
  und übernimmt den Übergang nicht.

Kanonischer Druck (`printObject`):

```
dea Name {
  alphabet a b
  start z0
  accept z1 z2
  z0 -a,b-> z1
  z1 -a-> z1
  layout z0@80,120 z1@240,120
}
```

- Zeile `states …` nur, wenn es Zustände gibt, die in keinem Übergang/start/accept vorkommen,
  oder wenn die Reihenfolge des ersten Auftretens nach obigem Schema nicht der
  `states`-Reihenfolge des Modells entspricht; dann alle Zustände in Modellreihenfolge.
- `alphabet` immer ausgeben (auch leer weglassen: bei leerem Alphabet keine Zeile).
- `accept` nur bei nichtleerem F; `start` nur wenn gesetzt.
- Übergänge gruppiert nach (from, to) in Reihenfolge des ersten Übergangs der Gruppe;
  Labels in Modellreihenfolge, durch `,` getrennt; ε als `ε`.
- Dokument: Objekte durch eine Leerzeile getrennt, Datei endet mit `\n`.

Round-Trip-Garantien (werden getestet):
1. Für jedes gültige Modell m (IDs kanonisch s0…/t0…, Übergänge so geordnet, dass Gruppen
   zusammenhängend sind): `parseDocument(printDocument(m)).doc` deep-equal `m`.
2. Für jeden Text t: `printDocument(parse(printDocument(parse(t))))` === `printDocument(parse(t))`.
3. `fromJSON(toJSON(d)).doc` deep-equal `d` für jedes Dokument, auch mit beliebigen IDs.

## JSON

`{ "version": 1, "objects": [...] }` genau wie die Typen. `fromJSON` prüft Struktur
(Felder, Typen, Referenzen auf existierende StateIds) und meldet `json.invalid` mit Grund
bzw. `json.version`.

## validate

Fehler: `model.noStart` (wenn Zustände existieren und start null), `model.duplicateStateName`,
`model.symbolNotInAlphabet`, `dea.labelLength`, `dea.nondeterministic` (zwei Übergänge
gleicher (from, symbol)). Warnung: `dea.missing` mit allen fehlenden Paaren (state, symbol)
in Tabellenreihenfolge. Für NEA keine Vollständigkeitswarnung.

## edit (`core/model/edit.ts`)

Alle Funktionen rein, geben neues Objekt zurück (Eingabe unverändert), IDs neuer Elemente
eindeutig (`s<n>`/`t<n>` mit n = max vorhandene + 1).

```ts
addState(obj, name: string, pos?: Point): { obj; id: StateId }
renameState(obj, id, name): obj                 // wirft Error bei Namenskonflikt
moveStates(obj, moves: Record<StateId, Point>): obj
removeStates(obj, ids: StateId[]): obj          // entfernt auch Kanten, start, accept
setStart(obj, id | null): obj
setAccepting(obj, id, accepting: boolean): obj
addTransition(obj, from, to, label): { obj; id }   // label: Sym bei DEA, Word bei NEA; erweitert Alphabet um neue Symbole
removeTransitions(obj, ids: TransitionId[]): obj
setEdgeLabels(obj, from, to, labels): obj       // ersetzt alle Kanten from→to; neue IDs nur für neue Labels, bestehende behalten ihre ID; erweitert Alphabet
setDeaTarget(obj: DEA, from, symbol, to | null): obj   // Tabellenzelle; null löscht
setNeaTargets(obj: NEA, from, word, targets: StateId[]): obj // Tabellenzelle (Menge)
setAlphabet(obj, alphabet: Sym[]): obj          // entfernt keine Kanten
addTrapState(obj: DEA, name?: string): { obj; id }  // neuer Zustand (Name freshName(…,'∅')? nein: Standard "fang", sonst freshName), ergänzt alle fehlenden (z, x) inkl. Fangzustand selbst
convertKind(obj, kind): obj                     // dea→nea: label a → [a]; nea→dea nur wenn alle Labels Länge 1, sonst Error
copyStates(obj, ids): Fragment                  // Zustände + Kanten zwischen ihnen
pasteFragment(obj, frag, offset: Point): { obj; ids: StateId[] }  // Namen bei Konflikt mit freshName
```

`Fragment = { kind: ObjectKind; states: State[]; transitions: Transition<unknown>[] }`.

## reconcile(prev, next)

Für Synchronisation Text → Modell: übernimmt aus `prev` die IDs von Zuständen gleichen
Namens und die Positionen, wenn `next` für den Zustand keine `pos` hat; Übergänge
behalten die ID eines prev-Übergangs mit gleichem (from-Name, to-Name, Label). Neue
Elemente bekommen frische IDs, die in prev nicht vorkommen. Ergebnis sonst = next.

## autoLayout

Rein deterministisch. Schichten per BFS ab Startzustand (unerreichbare danach), Schichten
von links nach rechts mit Abstand 160 px, innerhalb einer Schicht vertikal 120 px,
zentriert um y = 0; danach 60 Iterationen einfacher Kräfte (Abstoßung zwischen Zuständen,
Federn entlang Kanten), Ergebnis auf ganze Zahlen gerundet. `keep: true` → Zustände mit
`pos` bleiben, nur Zustände ohne `pos` werden platziert (neben die bestehenden).

## Simulation

DEA (`simulate` mit kind 'dea'): steps[0] = { pos 0, active [z0], fired [] }, je gelesenem
Symbol ein Schritt. Kein Übergang → Schritt mit active [] und `result 'stuck'`. Symbol nicht
im Alphabet → ebenfalls 'stuck'. `stateSequence` = f**(z0, w), `finalState` = f*(z0, w).
Ohne Startzustand: steps = [{pos 0, active [], …}], result 'stuck'.

NEA (2.58): Konfiguration (Zustand, Position). Kante mit Wort u von z nach z' ist von (z, i)
aus benutzbar, wenn w[i..i+|u|) = u; Ziel (z', i+|u|). ε-Kanten: (z', i).
- `steps[i].active` = alle Zustände z, so dass (z, i) von (z0, 0) erreichbar ist (i = 0…|w|).
- `steps[i].fired` = alle Kanten, die auf einem Weg von (z0,0) mit Ziel bei Position i
  liegen und in Position i enden (Wortkanten von j<i nach i sowie ε-Kanten bei i).
- `result`: 'accepted' wenn active(|w|) ∩ F ≠ ∅; 'stuck' wenn ein active(i) für i ≤ |w| leer
  ist **und** keine Wortkante über i hinwegspringt (d. h. keine erreichbare Konfiguration
  mit Position ≥ i); sonst 'rejected'. Hinweis: Wortkanten können Positionen überspringen,
  daher kann active(i) leer sein, ohne dass der Lauf hängt.
- `tree`: Tiefensuche ab (z0, 0) über alle Kanten; Kind je benutzbarer Kante. Blatt-Status:
  pos = |w| und keine weitere ε-Kante nutzbar → 'accepting'/'rejecting' nach F (ein Knoten mit
  pos = |w| und ausgehenden ε-Kanten bekommt Kinder und ist selbst 'open', außer er ist in F,
  dann 'accepting' mit Kindern). Kein nutzbarer Übergang und pos < |w| → 'dead'.
  (Zustand, pos) schon auf dem Ast vom Wurzelknoten → 'cycle', keine Kinder.
  Mehr als stepLimit Knoten → letzter Knoten 'limit', Abbruch, Trace.result 'limit'.
- Erklärungen: Schlüssel `sim.start`, `sim.dea.step` (params from, symbol, to),
  `sim.dea.stuck` (params state, symbol), `sim.nea.step` (params pos, symbol, active),
  `sim.nea.empty` (params pos). Parameter enthalten StateIds, nicht Namen.

`runBatch`: `simulate` je Eintrag; `ok` = (result === 'accepted') === expected.
