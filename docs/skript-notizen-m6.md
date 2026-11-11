# 5.1 bis 5.4 Kontextsensitive Sprachen

Quelle: Skript S. 57. V = N ∪ T (aus Def. 2.34, im Kap. 5 nicht wiederholt).

## 5.1 Typ-1-Grammatik (T1G)

G = (N, T, X0, P), X0 = Startsymbol.

| Produktionsform | Bedingung |
|---|---|
| uXv → uwv | u, v ∈ V*, w ∈ V+, X ∈ N |
| X0 → ε | nur falls diese Produktion existiert; dann kommt X0 in keiner Produktion rechts vor |

- ε-Produktionen nur als X0 → ε (w ∈ V+ schließt sonst ε aus).
- Sprache vom Typ 1 (kontextsensitiv): es gibt eine T1G, die sie erzeugt.

## 5.2 Kontext

- uXv → uwv: X wird durch w ersetzt, nur wenn links u und rechts v stehen.

## 5.3 Automatenmodell Typ 1

- Linear beschränkter Automat (LBA), Definition erst in 5.21 nachgeholt.

## 5.4 Beispiel und Ausblick

- L = {0^k 1^k 2^k | k ∈ N} ist kontextsensitiv (Aussage ohne Beweis).
- Grammatik für L: nicht angegeben.
- Jede kontextfreie Sprache ist kontextsensitiv.
- Es gibt nicht-kontextsensitive Sprachen.

---

# 5.12 bis 5.14 Typ 0

- 5.12: Typ-0-Grammatik = Grammatik nach Def. 2.34. Bereits in skript-notizen-typen.md.

## 5.13 Satz

L ist von einer Typ-0-Grammatik erzeugbar ⇔ L ist rekursiv aufzählbar.

## 5.14 Beweishinweise

Hinweis 1 (rek. aufzählbar ⇒ Typ-0-Grammatik-Richtung „TM erkennt“):
- Ableitungsfolgen systematisch erzeugen: erst Länge 1, dann Länge 2, Länge 3, usw.
- Irgendwann entsteht w, falls w ∈ L.
- Für w ∉ L: keine Abbruchgarantie (Verweis auf 5.11, zweiter Teil).

Hinweis 2 (TM-Übergang ↔ Produktion):

| TM-Übergang | Produktion |
|---|---|
| f(z, y) = (z', y', +1) | zy → y'z' |
| f(z, y) = (z', y', −1) | ȳzy → z'ȳy' |

---

# 5.15 bis 5.16 Algorithmusbegriff (nur Stichworte)

- Algorithmus: endliche Beschreibung, elementare Schritte, eindeutiger Nachfolgeschritt, richtige Ergebnisse für alle Eingaben, Halt nach endlich vielen Schritten (Skript-Liste).
- Formale Modelle: TM, Registermaschinen, µ-rekursive Funktionen, Markov-Algorithmen (alle äquivalent zu TM, 5.16).

# 5.17 bis 5.18 These von Church-Turing

- Intuitiv berechenbar ⇒ von einer TM berechenbar (These, nicht beweisbar).

---

# 5.19 bis 5.23 Zeit- und Platzbeschränkung

## 5.19 Maß

- Ressourcen: Rechenzeit, Speicherplatz.
- Größe der Eingabe bei Sprachen: |w|.
- Aufwand als f : N → N.

## 5.20 Definition

| Begriff | Bedingung (∀ n ∈ N, ∀ w mit |w| = n) |
|---|---|
| t(n)-zeitbeschränkt | TM macht höchstens t(n) Schritte bis zum Halt |
| s(n)-raumbeschränkt | TM besucht höchstens s(n) Felder des Arbeitsbandes bis zum Halt |

- Gezählt wird: Schritte (Zeit) bzw. besuchte Felder des Arbeitsbandes (Raum).
- UNKLAR: „Schritt“ ist nicht formal definiert. Naheliegend ist eine Anwendung von f (5.7), nicht im Skript belegt.
- UNKLAR: ob die Eingabefelder bei Raum mitzählen. Der Text sagt nur „besucht“; bei 5.21 zählen sie zu n+2.

## 5.21 Definition LBA

- Linear beschränkter Automat = TM, die n+2-platzbeschränkt ist.
- Benutzbare Felder: die n Felder mit den Eingabesymbolen, plus das erste Feld links und das erste Feld rechts davon.
- Randmarken: keine eigenen Symbole genannt. Die zwei Nachbarfelder sind Blankfelder (□), sofern nicht anders gemeint.
- UNKLAR: ob die beiden Nachbarfelder speziell markiert sind (Text nennt keine Randmarken-Symbole).
- LBA-Modell passt genau zu Typ-1-Grammatiken (Aussage ohne Beweis).

## 5.22 Hierarchiesatz (Stichworte)

- Für „hinreichend nette“ f1, f2 mit f1 „etwas schwächer“ wachsend als f2:
  - mit f1-beschränkter TM: echt weniger formale Sprachen als mit f2-beschränkter TM (Zeit und Platz).
- Beispiele: n vs. n²; n² vs. n³; ⌊n^x⌋ vs. ⌊n^y⌋ mit 1 < x < y.
- Gegenstand der Komplexitätstheorie.

## 5.23 Folgerungen

- Platz n² vs. n+2: TMs mit Platz n² erkennen echt mehr rekursive Sprachen.
- Es gibt rekursive Sprachen, die nicht kontextsensitiv sind (ohne Beweis).

---

# 5.24 bis 5.25 Satz und Chomsky-Hierarchie

## 5.24 Satz

- Es gibt formale Sprachen, die nicht rekursiv aufzählbar sind (Kardinalitätsargument, analog Punkt 2.16).

## 5.25 Bild (Abb. S. 63)

Verschachtelung von außen nach innen (alle Inklusionen laut Text echt):

alle formalen Sprachen ⊃ Typ 0 (rekursiv aufzählbar) ⊃ rekursive Sprachen ⊃ Typ 1 (kontextsensitiv) ⊃ Typ 2 (kontextfrei) ⊃ Typ 3 (regulär)

Vollständige Beschriftungsliste der Abbildung:

| Beschriftung im Bild | Rahmen |
|---|---|
| alle formalen Sprachen | schwarz, äußerster Rahmen |
| Typ 0 | grau |
| rekursiv aufzählbare Sprachen | (zu Typ 0, im Rahmen Typ 0) |
| rekursive Sprachen | schwarz, innerhalb Typ 0 |
| Typ 1 | grau |
| kontextsensitive Sprachen | (zu Typ 1) |
| Typ 2 | grau |
| kontextfreie Sprachen | (zu Typ 2) |
| Typ 3 | grau |
| reguläre Sprachen | (zu Typ 3) |

Zuordnung Klasse – Modell (aus dem Skript, Kap. 5 und frühere Kapitel):

| Typ | Klasse | Grammatik | Automat |
|---|---|---|---|
| 0 | rekursiv aufzählbar | T0G (5.12, 5.13) | TM (5.6) |
| – | rekursiv | (keine Grammatikklasse im Bild) | TM, die immer hält (5.10) |
| 1 | kontextsensitiv | T1G (5.1) | LBA (5.21) |
| 2 | kontextfrei | (nicht in Kap. 5) | Kellerautomat (Kap. 4) |
| 3 | regulär | (nicht in Kap. 5) | endlicher Automat (Kap. 2) |

- Deterministisch vs. nichtdeterministisch: in Kap. 5 nicht behandelt. Die TM-Übergangsfunktion (5.6) ist eine Funktion f: Z × Y → Z × Y × {−1,0,1}, also deterministisch.

---

# 5.26 bis 5.30 Jenseits von Typ 0: Kodierung und universelle TM

## 5.26 Mehrere Argumente

- Bandalphabet zusätzlich zu X: [ ; ]
- Eingabe von k Argumenten: [w1;…;wk] (umgeben von Blanks, Kopf auf [).
- Ausgabe f(w1,…,wk): nach Endzustand steht auf dem Band nur [f(w1,…,wk)].
- T(w1,…,wk) = f(w1,…,wk); f heißt (Turing-)berechenbar, wenn eine TM sie so berechnet.

## 5.27 Übung (Ein-/Ausgabeformat)

- Eingabe: [w1;w2] mit w1, w2 binär.
- Ausgabe: [w1+w2] binär.
- Beispiel: [101;1001] → [1110] (5 + 9 = 14).

## 5.28 Gödelisierung

- Jede TM bekommt eine natürliche Zahl als Nummer x; Tx bezeichnet die TM mit Nummer x.
- Die Kodierung ist im Skript nicht angegeben (kein Schema, kein Beispiel).
- UNKLAR: Gödelisierungsschema. Skript sagt nur „das ist tatsächlich möglich“.

## 5.29 Definition universelle TM U

- Eingabealphabet: {0, 1, [, ], ;}
- Eingabe [w0;w1;…;wk]
- U prüft zuerst, ob w0 die Nummer einer TM ist.
- Wenn ja: Funktionswert Tw0(w1,…,wk).
- UNKLAR: Verhalten von U, wenn w0 keine TM-Nummer ist (Definition nicht vollständig, kein Fall angegeben).

## 5.30 Satz

- Es gibt eine universelle TM.
- Beweis nicht geführt (Begründung: Gödelisierung ist nicht festgelegt).

---

# 5.31 bis 5.39 Entscheidbarkeit

## 5.31 Problem

- Problem P: Eingabe z. B. [w] oder [w1;w2]; Frage: erfüllt die Eingabe Eigenschaft E?
- L(P) = Menge der Eingaben, die E erfüllen.

## 5.32 Definition entscheidbar

- P entscheidbar ⇔ L(P) rekursiv.

## 5.33 Definitionen H und K

| Problem | Eingabe | Frage | Sprache |
|---|---|---|---|
| Halteproblem H | [x;y] | x ist Nummer einer TM und Tx hält für Eingabe y? | L(H) = {[x;y] | x ist Nummer einer TM und Tx hält für y} |
| Selbstanwendungsproblem K | x | Tx hält bei Eingabe x? | L(K) nicht explizit notiert (implizit {x | Tx hält für Eingabe x}) |

- UNKLAR: L(K) nicht als Formel angegeben (nur verbal).

## 5.34 Satz

- L(H) und L(K) sind rekursiv aufzählbar.
- L(H) und L(K) sind nicht rekursiv (H und K unentscheidbar).

## 5.35 Beweis (Stichworte)

- L(H) r.a.: TM T simuliert U auf [x;y]; akzeptiert, wenn U hält. Analog für K.
- Annahme: H entscheidbar ⇒ K entscheidbar ⇒ TM für K̄ (Komplement).
- Daraus TM T′, die K̄ akzeptiert und sonst nicht hält. Nummer v.
- Tv hält für w (und akzeptiert) ⇔ Tw hält nicht für w.
- Setze w = v: Tv hält für v ⇔ Tv hält nicht für v. Widerspruch.

## 5.36 Äquivalenzproblem

- Eingabe: x, y (Nummern).
- Frage: halten Tx und Ty für dieselben Eingaben, und liefern sie bei gleicher Eingabe dasselbe Ergebnis?
- Formalisierung (meinerseits, im Skript nur verbal): ∀w: (Tx hält auf w ⇔ Ty hält auf w) ∧ (wenn Halt: Tx(w) = Ty(w)).

## 5.37 Satz

- Äquivalenz von TMs ist unentscheidbar.

## 5.38 Beweis (Reduktion von H, Stichworte)

- Gegeben [x;y]. Konstruiere:
  - T: prüft, ob Eingabe = y; falls ja hält sie, sonst Endlosschleife.
  - M1: arbeitet wie T; wenn T hält, Ausgabe 1.
  - M2: arbeitet wie T; wenn T hält, arbeitet wie Tx; wenn dies hält, Ausgabe 1.
- M1 und M2 halten für Eingaben ≠ y nicht.
- M1 ≡ M2 ⇔ Tx hält für y.
- Ein Äquivalenzentscheider A würde H entscheiden. Widerspruch zu 5.34.

## 5.39 Weitere unentscheidbare Probleme (ohne Beweis)

| # | Problem |
|---|---|
| 1 | Java-Programm P, Eingabe w, Zeilennummer n: erreicht P für w jemals Zeile n? |
| 2 | Java-Programm P, Zeilennummer n: gibt es eine Eingabe, für die P jemals Zeile n erreicht? |
| 3 | TM T: hält T für mindestens eine Eingabe? |
| 4 | TM T: ist L(T) regulär? |

---

# 5.40 bis 5.41 Fleißiger Biber und Busy-beaver-Funktion

## 5.40 Definition

- Fleißiger Biber: TM mit Bandalphabet {□, 1} (□ = Blank).
- Start auf völlig leerem Band (nur □).
- Darf 1en schreiben und danach halten.
- Zustände: n Nichtendzustände und 1 Endzustand (insgesamt n+1).
- BB : N → N, BB(n) = maximale Anzahl der auf das Band geschriebenen 1en.
- Keine Schritte gezählt.
- UNKLAR: ob nur die 1en auf dem Band am Ende oder alle geschriebenen 1en gezählt werden („schreibt“).
- UNKLAR: Startzustand in Def. 5.40 nicht genannt (in der Tabelle A).

## 5.41 Werte und Aussagen

| n | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| BB(n) | 1 | 4 | 6 | 13 | ⩾ 4098 | ⩾ 4.6 · 10^1439 |

- BB ist nicht berechenbar.
- BB wächst schneller als jede berechenbare Funktion (Skript-Aussage, ohne Beweis).
- Weltrekordhalter 6 Zustände: Terry und Shawn Ligocki (Verweis auf Webseite im Skript).

### Tabelle des Bibers mit 6 Nichtendzuständen (Abbildung S. 66)

- Startzustand A, Endzustand Z. Bandalphabet {□, 1}.
- Z-Spalte: keine Übergänge (Endzustand).
- Zelleninhalt: Folgezustand, Schreibsymbol, Kopfbewegung (L/R).
- UNKLAR: Zellformat ist im Skript nicht erklärt. Die Lesart oben folgt aus der Notation (z. B. „Z1R“ = nach Z, schreibe 1, R).
- Anzahl der 1en dieses Bibers: nicht angegeben.

| gelesen \ Zustand | A | B | C | D | E | F | Z |
|---|---|---|---|---|---|---|---|
| □ | B1R | C1L | D1L | E1L | A1L | E1L | – |
| 1 | E□L | A□R | C□R | F□L | C1L | Z1R | – |

---

# 5.4 Ausblick

- Weitere Automatenmodelle (Zellularautomaten, Registermaschinen, alternierend, stochastisch, Quanten) und Erzeugungssysteme (Lindenmayer, Membran) werden erwähnt, nicht behandelt.

---

# UNKLAR-Stellen (Kap. 5, S. 57–67)

1. 5.14 Hinweis 2: Bedeutung von ȳ (vermutlich beliebiges Symbol links vom Kopf) nicht erklärt.
2. 5.20: Begriff „Schritt“ (Zeitmaß) nicht formal definiert.
3. 5.20 / 5.21: ob Eingabefelder bei Raummaß als besucht zählen; Randmarken bei LBA nicht als Symbole genannt, Nachbarfelder nur als „erstes Feld links/rechts“.
4. 5.28: Gödelisierungsschema nicht angegeben.
5. 5.29: Verhalten von U, wenn w0 keine TM-Nummer ist (Satz unvollständig).
6. 5.33: L(K) nur verbal, keine Formel.
7. 5.40: Zählung der 1en (am Ende vs. insgesamt geschrieben); Startzustand nicht in Def.
8. 5.41: Zellformat der Biber-Tabelle (Folgezustand/Schreibsymbol/Bewegung) nicht erklärt.
9. 5.25: Automatenmodelle für Typ 2 und Typ 3 nicht in Kap. 5 genannt (aus frühen Kapiteln übernommen, nicht in S. 57–67 geprüft).
