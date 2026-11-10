# Anforderungen: Web-Playground für formale Sprachen und Automaten

Dieses Dokument ist die Arbeitsgrundlage für die Umsetzung mit Claude Code.
Es beschreibt ein Browser-Tool im Geist von JFLAP, das die Inhalte der Vorlesung
"Formale Sprachen und Automaten" (Skript von Dr. Thomas Worsch, DHBW Karlsruhe, WS 2010)
vollständig abbildet und die Darstellungsformen miteinander verknüpft.

Prioritäten: **MUSS** (Kern), **SOLL** (wichtig, nach dem Kern), **KANN** (Ausbau).
Verweise wie "(Skript 2.90)" nennen die Nummer im Skript, an der die Definition oder
das Verfahren steht. Wo das Skript ein Verfahren konkret vorgibt, wird **diese Variante**
umgesetzt und nicht eine beliebige Lehrbuchvariante.

---

## 1. Ziel und Leitidee

1. **Eine Sprache, viele Sichten.** Dieselbe formale Sprache lässt sich als Automat,
   regulärer Ausdruck, Grammatik, Tabelle und Text anzeigen. Jede Umwandlung ist ein
   Klick und läuft Schritt für Schritt nachvollziehbar ab.
2. **Alles ist Text.** Jedes Objekt hat eine lesbare Textform. Graph und Text sind
   zwei Editoren desselben Objekts.
3. **Vorlesungstauglich.** Notation, Begriffe und Verfahren folgen dem Skript, damit
   man Beispiele direkt nachbauen und vorführen kann.
4. **Keine Installation.** Läuft vollständig im Browser, ohne Server und ohne Konto.

### Nicht-Ziele

- Kein Backend, keine Benutzerverwaltung, keine Echtzeit-Zusammenarbeit.
- Kein vollwertiger Compiler-Baukasten. Lexer und Parser dienen der Anschauung.
- Keine Automatenmodelle außerhalb des Skripts im Kern (Büchi, Baumautomaten usw.
  höchstens als spätere Erweiterung, siehe Abschnitt 12).

---

## 2. Notation und Begriffe (verbindlich)

Die Oberfläche ist deutsch und verwendet die Begriffe des Skripts.

| Begriff | Notation im Tool | Skript |
|---|---|---|
| Endlicher Akzeptor (DEA) | M = (Z, z0, X, f, F) | 2.2, 2.12 |
| Mealy- / Moore-Automat | M = (Z, z0, X, f, Y, g) | 2.9 |
| NEA | N = (Z, z0, X, g, F), g : Z × X* → 2^Z | 2.58 |
| Kellerautomat (NKA/DKA) | Z, z0, Kelleralphabet Y, y0, X, f, F | 4.3, 4.4 |
| Turingmaschine | Z, z0, Y, Blank □, X, F+, F−, f : Z × Y → Z × Y × {−1, 0, 1} | 5.6 |
| Grammatik | G = (N, T, S, P) | 2.34 |
| Regulärer Ausdruck | Zeichen `\|`, `(`, `)`, `*`, `∅` | 2.21 |
| Erweiterte Zustandsfunktionen | f\* (Endzustand), f\*\* (Zustandsfolge) | 2.4 |

Besonderheiten des Skripts, die das Tool genau so abbilden muss:

- **NEA-Übergänge sind mit Wörtern beschriftet**, nicht nur mit Einzelzeichen oder ε (2.58, 2.60).
- **Kellerautomat akzeptiert über Endzustand**, nachdem die ganze Eingabe gelesen ist (4.5).
  Das Anfangskellersymbol darf nie verschwinden: wird y0 gelesen, muss das gekellerte
  Wort wieder auf y0 enden (4.3). Beim Kellern eines Wortes liegt das erste Symbol oben.
- **Turingmaschine** ist deterministisch, hat ein beidseitig unendliches Band und
  getrennte Mengen akzeptierender (F+) und ablehnender (F−) Endzustände. Endzustände
  werden nicht mehr verlassen (5.6).
- **Regulärer Ausdruck** (Theorie, Kap. 2) und **Regex** (egrep-Praxis, Kap. 3) sind zwei
  getrennte Objekttypen mit getrennter Syntax (siehe 5.2).
- Typ-3-Grammatiken sind **rechtslinear** mit Produktionen X → w oder X → wY, w ∈ T* (2.45).

Englische Oberfläche: KANN. Texte von Anfang an über eine Übersetzungstabelle führen.

---

## 3. Objekttypen

Alle Typen teilen sich Editor, Simulator-Rahmen, Textformat und Speicherung.

### 3.1 MUSS

| Typ | Kernpunkte |
|---|---|
| DEA | totale Überführungsfunktion; Tool warnt bei fehlenden Übergängen und bietet an, einen Fangzustand zu ergänzen |
| NEA | Wort- und ε-Beschriftung, mehrere oder keine Nachfolger |
| Mealy-Automat | Ausgabe an der Kante (`x / y`) |
| Moore-Automat | Ausgabe im Zustand; Akzeptor als Spezialfall Y = {0,1} darstellbar (2.12) |
| Regulärer Ausdruck | strenge Syntax nach 2.21 plus Klammereinsparung (Stern vor Konkatenation vor `\|`, linksgeklammert) |
| Grammatik | Typ 0 bis 3, automatische Typ-Erkennung mit Begründung je Produktion |
| NKA / DKA | Prüfung der DKA-Bedingungen aus 4.4 mit Anzeige der verletzenden Stellen |
| Turingmaschine | ein Band, ein Kopf, Bewegungen −1 / 0 / +1 |

### 3.2 SOLL

| Typ | Kernpunkte |
|---|---|
| Linear beschränkter Automat | TM mit Platzschranke n + 2; Verletzung wird als Fehler angezeigt (5.21) |
| Regex (egrep) | Zeichenklassen, Quantoren, Anker, Gruppen, Rückwärtsverweise (Kap. 3) |
| Lexer-Spezifikation | reguläre Definitionen plus Regeln mit Tokennamen (6.11, 6.12) |
| Attributierte Grammatik | synthetisierte Attribute, semantische Regeln je Produktion (6.63, 6.64) |

### 3.3 KANN

- Zählerautomaten mit einem oder zwei Zählern (im Skript in Kap. 4 als Denkanstoß erwähnt).
- Mehrband-TM, nichtdeterministische TM.
- T-Diagramme für Übersetzer (6.4).

---

## 4. Editor

### 4.1 Graph-Editor (MUSS)

- Zustände anlegen, verschieben, umbenennen, löschen; Anfangszustand (Pfeil) und
  akzeptierende Zustände (Doppelkreis) setzen.
- Kanten ziehen, Schleifen, mehrere Beschriftungen je Kante zusammengefasst, gebogene
  Kanten bei Hin- und Rückrichtung.
- Mehrfachauswahl, Rückgängig/Wiederholen, Kopieren/Einfügen, Zoom und Verschieben.
- Automatisches Layout auf Knopfdruck; manuelle Positionen bleiben erhalten.
- Beschriftung je Typ:
  - DEA/NEA: `a`, `a,b`, `ε`, Wort `abc`
  - Mealy: `x / y`
  - NKA: `y, x → v` (oberstes Kellersymbol, Eingabe oder ε, gekellertes Wort)
  - TM: `y → y', d` mit d ∈ {L, N, R} als Anzeige für −1, 0, +1
- Tastaturbedienung für alle Kernaktionen; Bedienung per Touch SOLL.

### 4.2 Tabellen-Editor (MUSS)

- Überführungstabelle als gleichwertige Sicht, wie im Skript verwendet
  (Zustände × Eingabesymbole; bei NKA Zeilen der Form z, y, x, z', v wie in Beispiel 4.6).
- Änderungen in Tabelle, Graph und Text wirken sofort aufeinander.

### 4.3 Grammatik-, Ausdrucks- und Texteditor (MUSS)

- Produktionen mit `→` und `|`, Eingabe auch als `->`; ε auch als `eps`.
- Syntaxhervorhebung, Fehlermeldungen mit Zeile und Spalte, die sagen, was erwartet wurde
  (Vorbild: die Liste falscher Ausdrücke in 2.22).
- Sonderzeichen-Leiste für ε, ∅, □, →.

---

## 5. Textsprache (Import/Export)

### 5.1 Anforderungen (MUSS)

- Jedes Objekt lässt sich verlustfrei als Text ausgeben und wieder einlesen
  (Round-Trip, inklusive optionaler Layout-Angaben).
- Gut von Hand tippbar, mit ASCII-Ersatz für alle Sonderzeichen.
- Kommentare mit `#`.
- Eine Datei kann mehrere benannte Objekte enthalten, die sich gegenseitig
  referenzieren (z. B. `L(M1) ∩ L(M2)`).
- Formale Grammatik der Sprache liegt im Repository (z. B. als EBNF) und wird getestet.

### 5.2 Entwurf der Syntax (als Ausgangspunkt, Details darf die Umsetzung schärfen)

```
dea Dualzahl {
  alphabet  0 1 -
  start     A
  accept    B
  A -0-> B      A -1-> B      A --> M     # "-" als Symbol: Schreibweise noch festlegen
  B -0,1-> B
}

nea Beispiel {
  start 0
  accept 2 5
  0 -ε-> 1
  0 -01-> 3          # Wort als Beschriftung
}

mealy Wechsler { start z0   z0 -0/1-> z1   z1 -1/0-> z0 }
moore Erkenner { start A    out A=0 B=1    A -1-> B }

regex R1 = (0|1)*01            # regulärer Ausdruck nach Kap. 2
egrep R2 = ^[a-zA-Z][a-zA-Z0-9]*$   # Regex nach Kap. 3

grammatik Klammern {
  start S
  S -> ε | (S) | SS
}

nka NullEins {
  start z0   keller *   accept z+
  z0, *, 0 -> z0, 0*
  z0, 0, 0 -> z0, 00
  z0, 0, 1 -> z1, ε
  z1, 0, 1 -> z1, ε
  z1, *, ε -> z+, *
}

tm Palindrom {
  start r   blank □   accept f+   reject f-
  r, a -> ra, □, R
  ...
}
```

- Mehrbuchstabige Symbole in spitzen Klammern `<zahl>` wie im Skript (Beispiel 2.38);
  sonst gilt ein Zeichen = ein Symbol.

### 5.3 Weitere Formate

| Format | Richtung | Priorität |
|---|---|---|
| JSON (internes Modell) | Import/Export | MUSS |
| SVG, PNG | Export | MUSS |
| LaTeX/TikZ (`automata`-Bibliothek), LaTeX-Tabellen | Export | SOLL |
| Graphviz DOT | Import/Export | SOLL |
| JFLAP `.jff` | Import | SOLL |
| Mermaid | Export | KANN |

---

## 6. Simulation

### 6.1 Gemeinsamer Rahmen (MUSS)

- Eingabewort eingeben, dann: Schritt vor, Schritt zurück, Abspielen mit regelbarem
  Tempo, Sprung an Anfang/Ende.
- Aktive Zustände und zuletzt benutzte Kanten sind im Graphen hervorgehoben.
- Ergebnis klar benannt: akzeptiert, abgelehnt, hängt (kein Übergang), Schrittlimit erreicht.
- **Stapellauf:** Liste von Wörtern mit Soll-Ergebnis (∈ L / ∉ L); Tabelle mit grün/rot,
  wird bei jeder Änderung am Objekt neu ausgewertet.
- Schrittlimit und Abbruch-Knopf für alles, was nicht terminieren muss.

### 6.2 Je Typ

| Typ | Darstellung | Priorität |
|---|---|---|
| DEA | Anzeige von f\*(z0, w) und der Zustandsfolge f\*\*(z0, w) | MUSS |
| Mealy/Moore | Ausgabewort wächst synchron zur Eingabe | MUSS |
| NEA | Menge aktueller Zustände; zusätzlich Berechnungsbaum aller Wege | MUSS |
| NKA | Keller als Stapel; Verlaufstabelle "gelesene Eingabe / Zustand / Kellerinhalt" wie in 4.6; bei Nichtdeterminismus Konfigurationsbaum mit wählbarem Zweig | MUSS |
| TM | Bandfenster mit Kopf; Verlaufsliste der Konfigurationen wie in Abbildung 5.2; Zähler für Schritte und besuchte Felder | MUSS |
| Grammatik | Ableitung Schritt für Schritt (⇒), Wahl der Produktion und der Stelle; Modus Linksableitung; Ableitungsbaum wächst mit | MUSS |
| LBA | wie TM, mit sichtbarer Bandbegrenzung | SOLL |
| Zeit-/Platzbedarf | Diagramm Schritte bzw. Felder über Eingabelänge n für eine Wortliste (5.20) | KANN |

---

## 7. Umwandlungen und Verfahren

Jedes Verfahren gibt es in zwei Modi: **sofort** (Ergebnis als neues Objekt) und
**schrittweise** (Zwischenstände mit kurzer Erklärung je Schritt). Das Ergebnis bleibt
mit der Quelle verknüpft (Abschnitt 8).

### 7.1 Typ 3 (MUSS)

| Verfahren | Vorgabe aus dem Skript |
|---|---|
| NEA → DEA | drei Schritte: Wortübergänge in Einzelzeichen zerlegen (2.71), ε-Übergänge entfernen nach dem Verfahren aus 2.72 samt der dort genannten Sonderfälle, Potenzmengenkonstruktion (2.74). Nur erreichbare Teilmengen erzeugen, volle Potenzmenge optional anzeigbar |
| DEA → regulärer Ausdruck | über die Sprachen L^k_ij (2.30) mit Anzeige der Tabelle für k = 0 … m; zusätzlich Zustandselimination als Alternative (SOLL) |
| Regulärer Ausdruck → Typ-3-Grammatik | Abschlusskonstruktionen für Vereinigung, Konkatenation, Stern (2.52 bis 2.54) |
| Typ-3-Grammatik → NEA | Konstruktion aus 2.69 |
| DEA → Typ-3-Grammatik | Konstruktion aus 2.49/2.50 |
| Regulärer Ausdruck → NEA direkt | Thompson-Konstruktion als Abkürzung (nicht im Skript, als solche kennzeichnen) |
| Komplement, Durchschnitt | Endzustände tauschen bzw. Produktautomat (2.33); Vereinigung analog |
| Erreichbare Zustände | Algorithmus 2.82 mit Anzeige der wachsenden Menge |
| Minimierung | Algorithmus 2.90: Äquivalenzrelationen ≡0, ≡1, … runden­weise, Klassen farbig im Graphen, Tabelle je Runde; vorher unerreichbare Zustände entfernen |
| Äquivalenztest | zwei Objekte vom Typ 3 vergleichen; bei Ungleichheit kürzestes unterscheidendes Wort ausgeben. Hinweis auf PSPACE-Vollständigkeit bei Ausdrücken (2.26) |
| Trennende Wörter | zu w1, w2 ein trennendes w finden (2.84) |
| Mealy ↔ Moore | Umwandlung in beide Richtungen (SOLL, nicht im Skript) |

### 7.2 Typ 2 (MUSS, soweit nicht anders markiert)

| Verfahren | Vorgabe aus dem Skript |
|---|---|
| Grammatik → NKA, top-down | Drei-Zustands-Automat mit Produktions- und Leseschritten (4.27); Lauf neben der Linksableitung anzeigen wie in 4.28 |
| Grammatik → NKA, bottom-up | modifizierter Kellerautomat mit Schiebe- und Reduktionsschritten (4.33, 4.34) |
| Ableitungsbaum | aus Ableitung erzeugen (4.19); alle Bäume für ein Wort aufzählen bis zu einer Grenze |
| Mehrdeutigkeit | Suche nach einem Wort mit zwei Ableitungsbäumen bis Länge n; Ergebnis ehrlich als "gefunden" oder "bis Länge n nichts gefunden" melden (4.23) |
| EPS(G) | Menge der Nichtterminale mit X ⇒* ε (6.24/6.25) |
| Chomsky-Normalform | die vier Schritte aus 6.31 einzeln: Terminale auslagern, ε-Produktionen (6.27, 6.29), Kettenproduktionen X → Y, lange rechte Seiten |
| CYK | Pyramide D[i, j] (Abbildung 6.1), Zellen füllen sich schrittweise, Klick auf eine Zelle zeigt die verwendeten Zerlegungen; daraus Ableitungsbaum |
| CYK, zweite Darstellung | Variante mit markierten Produktionen (6.36, 6.38) — SOLL |
| Earley | Itemmengen S0 … Sn mit Lexer-, Completer- und Predictor-Regel (6.43); je Item anzeigen, welche Regel es erzeugt hat — SOLL |
| LR-Analyse | LR(0)-Items und Zustände (6.51 bis 6.53), goto-Tabelle (6.55), LALR(1)-Vorausschaumengen (6.57), Konflikte markieren, Lauf des Kellerautomaten mit Tabelle — SOLL |

### 7.3 Typ 1 und Typ 0

- Typ-Prüfung kontextsensitiv nach 5.1 inklusive Sonderregel für X0 → ε (MUSS).
- Ableitungssimulation für beliebige Grammatiken mit Breitensuche nach einem Zielwort
  und Schritt-/Längengrenze (MUSS).
- Wortproblem für Typ 1 durch beschränkte Suche (SOLL).
- Universelle TM zum Anfassen: Kodierung einer TM als Wort anzeigen und von einer
  zweiten Maschine ausführen lassen (5.29) (KANN).
- **Fleißiger Biber:** kleine Maschinen aufzählen und ausführen, Bestwerte für n ≤ 4
  nachrechnen (5.40) (KANN).
- Halteproblem: nur als erklärende Seite mit dem Schrittlimit als Anschauung; das Tool
  behauptet nie, Nicht-Halten entschieden zu haben (MUSS als Formulierungsregel).

### 7.4 Regex, Lexer, Übersetzerbau (SOLL)

- **Regex-Tester** nach POSIX-Regeln wie im Skript: längster, am weitesten links
  stehender Treffer; Gruppen nummeriert nach öffnender Klammer; Treffer und Gruppen
  im Text unterstrichen wie in 3.23.
- **Regex → regulärer Ausdruck:** Zeichenklassen, `+`, `?`, `{n,m}` ausschreiben, sodass
  alle Verfahren aus 7.1 anwendbar sind. Bei Rückwärtsverweisen meldet das Tool, dass
  die Sprache im Allgemeinen nicht mehr regulär ist und keine Automatenumwandlung
  angeboten wird (3.25).
- **Lexer-Spielwiese:** reguläre Definitionen ohne Rekursion (6.11), Regeln mit
  Tokennamen; Eingabetext wird in farbige Lexeme zerlegt. Regeln: längster Treffer
  zuerst, bei Gleichstand die erste Regel (6.13). Anzeige des erzeugten NEA und DEA (6.16).
- **Kette Text → Token → Ableitungsbaum:** Tokenstrom des Lexers als Terminalalphabet
  einer Grammatik verwenden (6.6, 6.8).
- **Attribute:** synthetisierte Attribute im Ableitungsbaum von unten nach oben
  auswerten, Werte an den Knoten anzeigen (6.62); abstrakter Syntaxbaum neben dem
  Ableitungsbaum (6.67); einfacher Drei-Adress-Code als Attribut (6.68) (KANN).

---

## 8. Verknüpfung der Darstellungen

Das ist der Kern des Tools und unterscheidet es von JFLAP.

1. **Sprach-Arbeitsfläche (MUSS):** Ein Projekt gruppiert Objekte, die dieselbe Sprache
   beschreiben sollen. Nebeneinander sichtbar, z. B. Ausdruck | NEA | DEA | Minimal-DEA |
   Grammatik.
2. **Herkunft (MUSS):** Jedes erzeugte Objekt kennt Quelle und Verfahren. Ein
   Abhängigkeitsgraph zeigt die Kette, z. B. `R1 → G1 → N1 → M1 → M1min`.
3. **Live-Aktualisierung (SOLL):** Ändert sich die Quelle, werden abgeleitete Objekte
   neu berechnet oder als veraltet markiert (einstellbar).
4. **Entsprechungen hervorheben (MUSS):** Zeigt man auf einen Zustand des DEA, leuchtet
   die zugehörige NEA-Zustandsmenge auf; auf eine Minimierungsklasse, die
   zusammengefassten Zustände; auf ein Nichtterminal, der Zustand z_X; auf eine
   CYK-Zelle, das Teilwort und der Teilbaum.
5. **Synchrone Simulation (SOLL):** Ein Eingabewort läuft gleichzeitig durch alle
   Objekte der Arbeitsfläche; Abweichungen im Ergebnis fallen sofort auf.
6. **Konsistenzanzeige (SOLL):** Für Typ 3 exakter Äquivalenztest zwischen allen
   Objekten der Arbeitsfläche. Für Typ 2 und höher nur Stichprobenvergleich bis Länge n,
   deutlich als Stichprobe gekennzeichnet.
7. **Sprach-Explorer (MUSS):** Wörter der Sprache nach Länge und dann lexikographisch
   aufzählen; Zugehörigkeitstest für einzelne Wörter; Anzahl der Wörter je Länge.
8. **Sprachoperationen (SOLL):** Konkatenation, Potenz, L\*, L+ auf endlichen
   Beispielmengen ausrechnen wie in 1.6 bis 1.9, um Kapitel 1 vorführen zu können.
9. **Chomsky-Hierarchie als Landkarte (SOLL):** Übersicht Typ 3 ⊂ Typ 2 ⊂ Typ 1 ⊂ Typ 0
   mit Grammatikform, Automatenmodell und Beispielsprache je Stufe (0^k1^k, 0^k1^k2^k,
   Palindrome); jedes Objekt des Projekts wird einsortiert.

---

## 9. Lehre und Präsentation

| Funktion | Beschreibung | Priorität |
|---|---|---|
| Beispielbibliothek | Beispiele des Skripts nachgebaut, sortiert nach Kapitel, mit Nummer als Verweis (u. a. 2.3, 2.14, 2.15, 2.61, 2.66, 2.92, 4.6, 4.9, 4.28, 5.9, 6.32, 6.44, 6.45). Nur die mathematischen Objekte, kein Skripttext | MUSS |
| Teilen per Link | gesamter Zustand komprimiert in der URL; zusätzlich Datei speichern/laden | MUSS |
| Präsentationsmodus | große Schrift, Vollbild, Steuerung mit Pfeiltasten, helles und dunkles Farbschema | SOLL |
| Erklärtexte je Schritt | ein bis zwei Sätze, warum der Schritt passiert, ein- und ausblendbar | SOLL |
| "Warum kein DEA?" | geführtes Schubfachargument aus 2.19: Nutzer gibt Zustandszahl m an, Tool zeigt für 0^m 1^m den wiederholten Zustand und das daraus folgende falsch akzeptierte Wort | SOLL |
| Pumping-Lemma-Spiel | regulär und kontextfrei; im Skript nur erwähnt (4.12), daher als Zusatz kennzeichnen | KANN |
| Übungsmodus | Aufgabe "Baue einen DEA für L"; Prüfung gegen Musterlösung per Äquivalenztest, Rückmeldung mit Gegenbeispielwort | SOLL |
| Aufgabenpakete | Dozent exportiert Aufgaben als Datei oder Link; Musterlösung nur verschleiert enthalten | KANN |
| Druckansicht | Objekt mit Tabelle und formaler Definition als Tupel auf einer Seite | KANN |
| Einbettung | einzelnes Objekt samt Simulator per iframe in andere Seiten | KANN |

---

## 10. Technische Anforderungen

### 10.1 Architektur (MUSS)

- Statische Single-Page-App, nach dem Build ohne Server lauffähig, offline nutzbar.
- **Kernbibliothek getrennt von der Oberfläche:** Datenmodell, Parser, Simulatoren und
  Algorithmen als reines TypeScript-Paket ohne DOM-Abhängigkeit, auch per Node/CLI
  nutzbar und einzeln testbar.
- Algorithmen liefern ihre Zwischenschritte als Datenstruktur (Schrittliste mit
  Erklärungsschlüssel); die Oberfläche rendert nur.
- Rechenintensive Verfahren (Potenzmenge, Suche, CYK auf langen Wörtern, Biber) laufen
  in einem Web Worker und sind abbrechbar.
- Vorschlag Stack: TypeScript, Vite, ein Komponenten-Framework nach Wahl, SVG-Rendering
  für Graphen. Abweichungen sind erlaubt, wenn begründet.

### 10.2 Qualität (MUSS)

- Unit-Tests für jedes Verfahren anhand der Skriptbeispiele.
- Eigenschaftsbasierte Tests: für zufällige Automaten/Ausdrücke muss jede Umwandlung
  die Sprache erhalten (Prüfung über Äquivalenztest bzw. Wortaufzählung bis Länge n).
- Round-Trip-Tests für Textformat und JSON.
- Grenzen sind sichtbar und einstellbar: Schrittlimit, maximale Zustandszahl bei
  Potenzmenge, maximale Wortlänge bei Suchen. Kein Einfrieren der Oberfläche.

### 10.3 Bedienbarkeit

- Aktuelle Versionen von Chrome, Firefox, Safari, Edge (MUSS); Tablet mit Touch (SOLL).
- Tastaturbedienung, ausreichende Kontraste, Zustände nie nur über Farbe unterscheiden
  (zusätzlich Form oder Beschriftung) (MUSS).
- Automatisches Zwischenspeichern im Browser, damit nichts verloren geht (MUSS).
- Flüssiges Arbeiten bis etwa 200 Zustände (SOLL).

---

## 11. Umsetzungsreihenfolge

Jeder Meilenstein ist für sich benutzbar.

| Nr. | Inhalt | Abnahme (Beispiele) |
|---|---|---|
| M1 | Kernmodell, Textformat, Graph- und Tabellen-Editor für DEA/NEA, Simulation, Stapellauf, Teilen per Link | Automat aus Beispiel 2.3 lässt sich per Graph, Tabelle und Text eingeben; alle drei Sichten bleiben synchron |
| M2 | Reguläre Ausdrücke, Typ-3-Grammatiken, alle Verfahren aus 7.1, Arbeitsfläche mit Herkunft und Hervorhebung | Aus einem Ausdruck entsteht über Grammatik und NEA ein minimaler DEA; Äquivalenztest bestätigt jede Stufe; Minimierung von Beispiel 2.92 zeigt die Runden ≡0, ≡1, … |
| M3 | Mealy/Moore, Sprach-Explorer, Beispielbibliothek Kap. 1 und 2, Export SVG/PNG/TikZ | Moore-Automat aus 2.10 gibt für Dualzahlen als letzte Ausgabe 1 |
| M4 | Kontextfreie Grammatiken, Ableitungsbäume, NKA/DKA mit Simulation, Grammatik → NKA in beiden Richtungen der Analyse | NKA aus 4.6 akzeptiert 00001111 mit der Konfigurationsfolge aus dem Skript; für S → ε \| (S) \| SS findet das Tool zwei Bäume zu ()()() |
| M5 | CNF, CYK, danach Earley und LR | CNF der Grammatik aus 6.32 in vier Schritten; CYK-Pyramide wie in 6.35 |
| M6 | Turingmaschine, LBA, Typ 0/1, Hierarchie-Landkarte | TM aus 5.9 akzeptiert das Palindrom aus Abbildung 5.2 und zeigt dieselbe Konfigurationsliste |
| M7 | Regex-Tester, Lexer-Spielwiese, Attribute und Syntaxbaum | `erna = hugo + 1;` ergibt die Tokenfolge aus 6.8; 2+3*4 wird im Baum zu 14 ausgewertet (6.62) |
| M8 | Übungsmodus, Präsentationsmodus, Schubfachargument, Biber, übrige KANN-Punkte | BB(n) = 1, 4, 6, 13 für n = 1 … 4 wird nachgerechnet |

---

## 12. Offene Entscheidungen

Mit Vorschlag; bitte vor M1 bestätigen oder ändern.

| Frage | Vorschlag |
|---|---|
| Name des Tools | Arbeitstitel "Automaten-Playground" |
| Framework | React oder Svelte, Entscheidung der Umsetzung |
| Schreibweise von Symbolen, die mit der Textsyntax kollidieren (`-`, `,`, `>`, Leerzeichen) | Anführungszeichen: `A -"-"-> M` |
| Akzeptanz beim Kellerautomaten | Standard Endzustand wie im Skript; "leerer Keller" als abschaltbare Option |
| Abweichungen vom Skript (Thompson, Zustandselimination, Mealy↔Moore, Pumping-Lemma) | anbieten, aber sichtbar als "nicht im Skript" markieren |
| Erweiterungen jenseits der Vorlesung (Büchi, Transducer, zelluläre Automaten, L-Systeme) | erst nach M8; Datenmodell so anlegen, dass neue Typen als Plugin dazukommen |
| Lizenz und Veröffentlichung | Open Source, Hosting als statische Seite |
| Sprache der Oberfläche | Deutsch zuerst, Englisch vorbereitet |

---

## 13. Hinweise für die Umsetzung mit Claude Code

- Zuerst die Kernbibliothek mit Tests, dann die Oberfläche. Kein Verfahren ohne Test.
- Für jedes Verfahren die im Skript beschriebene Variante umsetzen; wo dieses Dokument
  und das Skript nicht eindeutig sind, nachfragen statt raten.
- Texte der Oberfläche und Erklärungen selbst formulieren; keinen Skripttext übernehmen.
- Nach jedem Meilenstein: lauffähiger Build, kurze Notiz zu offenen Punkten.
