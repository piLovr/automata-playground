# Plan M6: Turingmaschine, LBA, Typ 0/1, Hierarchie-Landkarte

Anforderungen 6.2 (TM MUSS, LBA SOLL, Zeit/Platz KANN), 7.3 (Typ 1/0), 8.9 (Landkarte SOLL),
11 (M6). Abnahme: „TM aus 5.9 akzeptiert das Palindrom aus Abbildung 5.2 und zeigt dieselbe
Konfigurationsliste“ – seit dem Nachtrag zu M1 vorhanden und getestet (22 Konfigurationen);
wird in M6 nur noch einmal im Browser abgenommen. Skript: `docs/skript-notizen-m6.md`.

## 0. Befund vorab (Fehler, MUSS)

`findDerivation` sucht bei Nicht-Typ-2-Grammatiken nur bis zur Satzformlänge n + #ε-Prod. + 2
und meldet danach „nicht ableitbar“. Für Typ 0 ist das falsch (Satzformen dürfen wachsen und
wieder schrumpfen). Die Oberfläche schreibt außerdem immer „Linksableitung“.

## 1. Typ 1 und Typ 0 (7.3)

- **Typ-Prüfung 5.1** ist da (inkl. X₀ → ε, X₀ rechts verboten). Ergänzung: Begründung je
  Produktion zeigt bei Typ 1 die Form uXv → uwv nicht – das Skript definiert Typ 1 über diese
  Form, die Erkennung über „|links| ≤ |rechts|“. Beides beschreibt dieselbe Sprachklasse, aber
  nicht dieselben Grammatiken. **Frage 1.**
- **Wortproblem Typ 1 (SOLL)**: exakt. Satzformen werden nie kürzer, also reicht die Suche über
  Satzformen der Länge ≤ |w| (endlich viele). Ergebnis „ableitbar“ mit Ableitung oder
  „nicht ableitbar“ – hier ist das eine echte Entscheidung (Begründung im Text).
- **Ableitungssuche Typ 0 (MUSS)**: Breitensuche mit einstellbarer Längengrenze (Standard
  |w| + 4) und Schrittlimit; Ergebnis nur „gefunden“ oder „bis zur Grenze nicht gefunden – über
  das Wort ist damit nichts gesagt“ (5.13/5.14: nur aufzählbar).
- Ableitungsansicht: Ableitung Schritt für Schritt mit Wahl von Produktion und Stelle gibt es
  seit M4 für alle Typen; Meldungstext je Typ korrigieren.

## 2. Linear beschränkter Automat (5.21, SOLL)

- TM mit Schalter „linear beschränkt“ (kein eigener Objekttyp): Band besteht aus den n
  Eingabefeldern und je einem Feld links und rechts (n + 2, 5.21). Die Grenzen sind im Band
  sichtbar (schraffiert außerhalb).
- Verlässt der Kopf das Fenster, hält die Simulation mit „Platzschranke verletzt“ – die
  Maschine ist dann für dieses Wort kein LBA. **Frage 2.**
- Beispiel (eigenes, als „nicht im Skript“ markiert): LBA für 0^k1^k2^k.

## 3. Zeit- und Platzbedarf (5.20, KANN)

- Für eine TM: Wortliste (alle Wörter bis Länge n oder eigene Liste) im Worker ausführen,
  Diagramm „größte Schrittzahl“ und „größte Zahl besuchter Felder“ über n, dazu Tabelle.
  Wörter, die das Schrittlimit erreichen, werden gezählt und markiert, nicht mitgerechnet.
- Zählung: ein Schritt = eine Anwendung von f; besuchte Felder = alle Felder, auf denen der
  Kopf stand (UNKLAR 2/3 der Notizen, so festgelegt und im Text erklärt).

## 4. Chomsky-Hierarchie als Landkarte (8.9, SOLL)

- Verschachtelte Rahmen wie Bild 5.25: alle Sprachen ⊃ Typ 0 (rekursiv aufzählbar) ⊃ rekursiv
  ⊃ Typ 1 ⊃ Typ 2 ⊃ Typ 3. Je Stufe Grammatikform, Automatenmodell und Beispielsprache
  (Typ 3: z. B. a*b*, Typ 2: 0^k1^k bzw. Palindrome, Typ 1: 0^k1^k2^k, rekursiv/Typ 0: Text
  aus 5.10/5.34). Klick auf eine Beispielsprache lädt das passende Beispiel.
- **Einsortieren** jedes Objekts der Arbeitsfläche nach seinem Beschreibungsmittel: DEA, NEA,
  regulärer Ausdruck, egrep ohne Rückverweis, Menge, Typ-3-Grammatik → Typ 3; Kellerautomat,
  Typ-2-Grammatik → Typ 2; Typ-1-Grammatik, LBA → Typ 1; TM, Typ-0-Grammatik → Typ 0;
  Mealy/Moore erscheinen nicht (keine Sprache). Hinweis im Bild: Einordnung = „Sprache liegt
  mindestens hier“, nicht kleinste Klasse (ob eine kontextfreie Sprache regulär ist, ist nicht
  entscheidbar; bei Typ-3-Objekten ist es exakt).
- Neuer Ansichtsmodus neben „Objekt“ und „Arbeitsfläche“: „Hierarchie“.

## 5. Halteproblem und fleißiger Biber (7.3)

- **Formulierungsregel (MUSS)**: alle Texte prüfen. Bei Schrittlimit heißt es überall „nach N
  Schritten noch nicht gehalten“, nie „hält nicht“. Test über die Texttabelle (verbotene
  Wendungen).
- **Erklärseite Halteproblem**: H und K nach 5.33, Diagonalargument 5.35 als Tabelle
  (Maschinen × Eingaben, Diagonale hervorgehoben), dazu eine kleine TM, die mit
  wachsendem Schrittlimit läuft – Anschauung, dass das Limit nie Gewissheit gibt.
- **Fleißiger Biber (KANN)**: Maschinen mit n ≤ 4 Nichtendzuständen über {□, 1} (5.40) in
  Baum-Normalform aufzählen und ausführen (Worker, abbrechbar). Ergebnis: höchste Zahl der
  Einsen unter den Maschinen, die innerhalb des Schrittlimits halten, dazu Anzahl der
  Maschinen „nach N Schritten noch nicht gehalten“. Für n ≤ 3 sofort, n = 4 dauert länger
  (Fortschrittsbalken). Vergleich mit der Tabelle 5.41 (1, 4, 6, 13). Der Biber mit 6
  Zuständen aus 5.41 als Beispiel (läuft bis zum Limit).
- Gezählt werden die Einsen auf dem Band beim Halten (UNKLAR 7, übliche Lesart).

## 6. Nicht in M6

- Universelle TM (KANN): das Skript legt keine Gödelisierung fest (5.28, 5.30). Eine echte U
  als TM wäre ein großes Objekt ohne Skriptbezug. **Frage 3.**
- TM → Typ-0-Grammatik nach 5.14 (Hinweis 2 ist unvollständig, UNKLAR 1).

## 7. Beispiele

5.9 (vorhanden), 5.41 Biber mit 6 Zuständen, Biber mit 2 und 3 Zuständen (eigene, Bestwerte),
Typ-1-Grammatik 0^k1^k2^k (eigene), Typ-0-Grammatik (eigene, z. B. Verdoppeln ww),
LBA 0^k1^k2^k (eigene). Eigene Beispiele als „nicht im Skript“ markiert.

## 8. Agenten

| Schritt | Agent | Auftrag |
|---|---|---|
| 1 | ich | Typen, `docs/kern-spec-m6.md` |
| 2a | kern-entwickler | Typ-1-Wortproblem, Typ-0-Suche (Fehler aus 0), LBA-Simulation, Einordnung für die Landkarte, Zeit/Platz-Messung |
| 2b | kern-entwickler | Fleißiger Biber: Aufzählung in Baum-Normalform, Ausführung mit Limit |
| 2c | geruest | Beispiele, `$OUT` (Debug-Rest aus M4) entfernen |
| 2d | tester | 5.9/Abb. 5.2 erneut, Typ-1-Entscheidung gegen Brute force, Typ-0 nie „nicht ableitbar“, LBA-Grenze, BB(1…3) = 1, 4, 6, verbotene Wendungen |
| 2e | ich | Oberfläche: LBA-Schalter und Band, Zeit/Platz-Diagramm, Landkarte, Halteproblem-Seite, Biber-Panel |
| 3 | fehlersucher | bei Bedarf |
| 4 | ich | Browser-Abnahme, `docs/stand-m6.md`, Commit, Merge nach Rückfrage |

## 9. Fragen

1. Typ 1: Skript 5.1 verlangt die Form uXv → uwv; das Tool erkennt bisher „nicht verkürzend“
   (|links| ≤ |rechts|). Welche Definition gilt für die Typ-Anzeige?
2. LBA: Was passiert, wenn der Kopf das Fenster n + 2 verlässt? Das Skript sagt dazu nichts
   (eine echte LBA tut es nie).
3. Universelle TM: weglassen oder mit eigenem, gekennzeichnetem Kodierungsschema?

### Entscheidung (2026-11-11)

1. Typ-Anzeige nach Skriptform 5.1: Typ 1 nur für uXv → uwv (w ≠ ε) und X₀ → ε mit der
   Sonderregel. Nicht verkürzende Produktionen anderer Form bekommen den Hinweis „nicht
   verkürzend – beschreibt dieselbe Sprachklasse, ist aber nicht die Form aus 5.1“. Das exakte
   Wortproblem gilt für alle nicht verkürzenden Grammatiken.
2. LBA: Verlässt der Kopf das Fenster n + 2, hält die Simulation mit „Platzschranke verletzt –
   für dieses Wort kein LBA“; Ergebnis weder akzeptiert noch abgelehnt.
3. Universelle TM: nicht in M6.
