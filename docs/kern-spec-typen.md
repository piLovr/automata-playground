# Spezifikation: Mealy, Moore, Kellerautomat, Turingmaschine

Ergänzt `docs/kern-spec-m1.md`. Verbindliche Typen: `core/model/types.ts` (Mealy, Moore,
NKA, TM, MealyLabel, NkaLabel, TmLabel, TapeView, erweiterte SimStep/Trace/TreeNode,
neue DiagnosticCodes, SimResult 'done'). Definitionen aus dem Skript:
`docs/skript-notizen-m1.md` (2.9–2.12) und `docs/skript-notizen-typen.md` (Kap. 4, 5).
Wo das Skript etwas genauer festlegt als diese Datei, gilt das Skript.

Jeder Typ wird ein Eintrag in der Kind-Registry (`core/model/kinds.ts`). Die
Schnittstelle in `core/index.ts` bleibt gleich; alle Funktionen (`parseDocument`,
`printDocument`, `toJSON`/`fromJSON`, `validate`, `emptyAutomaton`, `reconcile`, `edit.*`,
`autoLayout`, `simulate`, `runBatch`) müssen alle sechs Typen beherrschen.

## Textsprache

Neue Objektarten: `mealy`, `moore`, `nka`, `tm`. Gemeinsame Anweisungen wie bisher
(`alphabet`, `states`, `start`, `accept`, `layout`). Neue Anweisungen (zeilengebunden):

| Anweisung | Typen | Bedeutung |
|---|---|---|
| `ausgabealphabet a b …` | mealy, moore | Y |
| `out Z=y Z=y …` | moore | g(Z) = y, je Paar Zustandsname `=` Symbol |
| `keller y0` | nka | Anfangskellersymbol (genau ein Symbol) |
| `kelleralphabet a b …` | nka | Y |
| `bandalphabet a b …` | tm | Y |
| `blank b` | tm | Blanksymbol, Standard `□` |
| `reject Z …` | tm | F− (`accept` ist F+) |

Fehlt eine Alphabet-Anweisung, wird das Alphabet aus Übergängen (und bei NKA aus `keller`,
bei TM aus `alphabet` und `blank`) in Reihenfolge des ersten Auftretens gebildet. Der
Printer gibt alle Alphabete immer explizit aus (kanonisch), leere weglassen.

**Kantenform** (wie DEA/NEA, `Name -labels-> Name`):

- `mealy`: Label `x/y`, z. B. `z0 -0/1,1/0-> z1`. Innerhalb von Mealy-Labels ist `/`
  Trennzeichen und muss als Symbol `\/` geschrieben werden. Genau ein Symbol links und
  rechts, sonst `label.shape`.
- `moore`: Label wie DEA (genau ein Symbol).

**Zeilenform** (neu, für nka und tm; ein Übergang je Zeile, Kommas mit optionalem Leerraum):

- `nka`: `z, y, x -> z', v` — z. B. `z0, *, 0 -> z0, 0*` oder `z1, *, ε -> z+, *`.
  `x` ist ein Symbol oder `ε`/`eps`; `v` ist ein Wort oder `ε`/`eps` (erstes Symbol oben).
- `tm`: `z, y -> z', y', d` — z. B. `r, a -> ra, □, R`. `d` ∈ `L N R` (auch `-1 0 1`
  zulassen; Printer schreibt `L N R`).

Erkennung: Beginnt eine Anweisung mit einem Zustandsnamen, folgt auf ihn `,` → Zeilenform,
sonst Kantenform. Zeilenform ist nur bei nka/tm erlaubt, Kantenform nur bei den übrigen
(sonst `syntax.unexpected`). Symbole in der Zeilenform folgen den Symbolregeln der
Textsprache (`\,` usw.); `□` ist ein gewöhnliches Symbol (kein Sonderzeichen).

Kanonischer Druck nka/tm: je Übergang eine Zeile in Modellreihenfolge, `ε` für leeres
Wort/kein Eingabesymbol. Reihenfolge der Kopfzeilen:
`alphabet`, `ausgabealphabet`/`kelleralphabet`/`bandalphabet`, `keller`/`blank`,
`states` (falls nötig), `start`, `accept`, `reject`, `out`, Übergänge, `layout`.
Moore `out` nur für Zustände mit Ausgabe, in Zustandsreihenfolge.

Round-Trip-Garantien 1–3 aus `kern-spec-m1.md` gelten für alle Typen.

## Modell und Bearbeitung

- `emptyAutomaton(kind, name)`: leere Alphabete; nka `y0 = '⊥'` und
  `stackAlphabet = ['⊥']`; tm `blank = '□'`, `tapeAlphabet = ['□']`, `reject = []`.
- `edit.addTransition`/`setEdgeLabels` nehmen das jeweilige Label und erweitern die
  passenden Alphabete (Mealy: in → X, out → Y; NKA: read → X, top/push → Y; TM: read/write
  → Y, bei Bedarf nicht X).
- Neu: `edit.setOutput(obj: Moore, id, out: Sym | null)`, `edit.setY0(obj: NKA, y0)`,
  `edit.setBlank(obj: TM, blank)`, `edit.setRejecting(obj: TM, id, rejecting)`,
  `edit.setOutputAlphabet`, `edit.setStackAlphabet`, `edit.setTapeAlphabet`.
- `edit.setDeaTarget` gilt sinngemäß auch für Moore (gleiches Labelformat).
  Neu `edit.setMealyCell(obj, from, input, target: { to: StateId; out: Sym } | null)`.
- `removeStates` entfernt Zustände auch aus `reject`.
- `convertKind`: nur dea ↔ nea wie bisher; andere Kombinationen werfen Error.
- `reconcile`: Übergänge gleichen (from-Name, to-Name, Label) behalten ihre ID; Label-
  Vergleich per tiefer Gleichheit.

## Prüfung (`validate`)

- mealy: wie DEA (`dea.missing` als Warnung für fehlende (z, x), `dea.nondeterministic`
  bei zwei Kanten gleicher (z, x)), `model.symbolNotInAlphabet` auch für Y.
- moore: wie DEA, zusätzlich Warnung `moore.missingOut` mit allen Zuständen ohne Ausgabe.
- nka: Fehler `nka.y0` je Übergang mit `top = y0`, dessen `push` nicht auf y0 endet
  (Skript 4.3; y0 bleibt unten liegen, vgl. Übergang `z0, *, 0 -> z0, 0*` in 4.6); Warnung `nka.nondeterministic` je Gruppe von Übergängen, die die
  DKA-Bedingungen aus 4.4 verletzen (gleiche (z, y, x), oder (z, y, ε) neben (z, y, x)).
- tm: Fehler `tm.nondeterministic` (zwei Übergänge gleicher (z, y)), `tm.leavesFinal`
  (Übergang aus einem Zustand in F+ ∪ F−), `tm.finalOverlap`.
- Alle: `model.noStart`, `model.duplicateStateName`.

## Simulation

Gemeinsam: `steps[0]` ist die Startkonfiguration; `explanation` mit Schlüssel und
Parametern (StateIds, keine Namen). `stepLimit` Standard 10000.

**Mealy** (2.9): je gelesenem Symbol ein Schritt, `output` wächst um g(z, x)
(Ausgabewort hat |w| Symbole, `steps[0].output = []`).
Ergebnis `done` nach vollständigem Lesen, `stuck` bei fehlendem Übergang, Trace.output =
Ausgabewort. Schlüssel `sim.mealy.step` {from, symbol, to, out}.

**Moore** (2.9/2.10): Das Skript definiert kein Ausgabewort. Festlegung: Ausgabe =
g angewandt auf f**(z0, w), also |w|+1 Symbole; `steps[0].output = [g(z0)]`, danach je
Schritt g des erreichten Zustands. Zustand ohne Ausgabe liefert kein Symbol (das
Ausgabewort wird dann nicht verlängert). Schlüssel `sim.moore.step` {from, symbol, to, out}.

**NKA** (4.3–4.5): Konfiguration (Zustand, gelesene Länge, Keller). Start (z0, 0, [y0]).
Übergang (z, y, x) → (z', v) anwendbar, wenn oben y liegt und x = ε oder x das nächste
Eingabesymbol ist; Keller: y wird entfernt, v vorne angefügt. Akzeptiert, wenn eine
Konfiguration mit gelesener Länge = |w| und Zustand ∈ F erreichbar ist (4.5). Leerer
Keller: keine Übergänge mehr. Suche: Breitensuche über Konfigurationen, Duplikate
(gleiche Konfiguration) nicht erneut expandieren; Kellerhöhe begrenzt auf
`2·|w| + 2·|Z|·max|v| + 10` (darüber wird der Ast mit status 'limit' abgeschnitten);
insgesamt höchstens `stepLimit` Knoten → Ergebnis 'limit', falls bis dahin keine
akzeptierende Konfiguration gefunden.
- `tree`: alle erzeugten Knoten mit `stack`, `pos`, `via`, Status wie beim NEA
  (`accepting` = akzeptierende Konfiguration, `dead` = keine Übergänge, `cycle` =
  Konfiguration schon besucht, `limit`).
- `steps`: der Weg von der Wurzel zum ersten akzeptierenden Knoten; ohne Akzeptanz zum
  Knoten mit größter gelesener Länge (bei Gleichstand dem zuerst gefundenen). Jeder Schritt
  hat `active = [Zustand]`, `fired = [Übergang]`, `pos`, `stack`.
- Ergebnis: accepted / rejected (Suche erschöpft) / limit.
- Schlüssel `sim.nka.step` {from, top, read (Symbol oder null), to, push}.

**TM** (5.6): deterministisch. Band als Abbildung Position → Symbol, Eingabe ab Position 0,
Kopf auf 0, alle übrigen Felder Blank. Je Schritt: f(z, Band[Kopf]) = (z', y', d),
schreiben, Kopf += d. Ergebnis `accepted` beim Erreichen eines Zustands in F+, `rejected`
in F−, `stuck` wenn kein Übergang existiert (Zustand nicht in F±), `limit` nach stepLimit
Schritten (keine Aussage über Halten). `steps[i].tape`: TapeView über alle bisher
besuchten Positionen und die Eingabe; `Trace.visited` = Anzahl verschiedener Positionen,
auf denen der Kopf stand. Eingabe leer: Band nur Blank. Schlüssel `sim.tm.step` {from,
read, to, write, move}, `sim.tm.stuck` {state, read}.

Die Beispiele aus dem Skript (Verlaufstabelle 4.6, Konfigurationsliste Abb. 5.2) müssen
sich Schritt für Schritt aus den Traces ablesen lassen; die Tests prüfen das.

## Layout

`autoLayout` funktioniert unverändert für alle Typen (Kanten = Übergänge).

## Hinweise zu den Skriptbeispielen

- 4.6 und 4.9 nennen eine Standardregel „in allen anderen Fällen“. Sie wird nicht als
  Übergang modelliert; ohne passenden Übergang endet ein Ast (Status `dead`).
- Abb. 5.2: Bandposition 0 ist das erste Eingabesymbol; die Abbildung zeigt links davon
  ein Blank (dort Index 0, Eingabe ab Index 1). Tests vergleichen Zustand, Kopf relativ
  zum Eingabeanfang und Bandinhalt ohne Rand-Blanks.
