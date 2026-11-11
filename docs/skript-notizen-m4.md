# Skript-Notizen M4 (Skript.pdf, Kapitel 4, 4.1–4.37)

Quelle: Thomas Worsch, "Formale Sprachen und Automaten", Stand 1. November 2010.
Seiten im PDF = Skriptseiten. Umfang: 4.1–4.2 S. 45–46, 49; 4.3–4.9 S. 46–48 (siehe unten); 4.10–4.37 S. 49–56. Kapitelende = 4.37 (S. 56), 5.1 beginnt S. 57.
Abschnitte 4.3–4.9 (Kellerautomat, DKA, Akzeptanz, Beispiele 4.6/4.9) stehen in docs/skript-notizen-typen.md; hier nur Verweise und Ergänzungen.

## 4.1 Kellerautomaten (Abschnitt, S. 45–46)

- Absatz 4.1: Bei Kellerautomaten unterscheiden sich DKA und NKA in der Erkennungsmächtigkeit (bei endlichen Akzeptoren nicht).
- Absatz 4.2: Speichererweiterung; Kellerautomat = Zugriffsbeschränkung: nur das zuletzt abgelegte Datum ist lesbar.
- Alternative Zugriffsbeschränkung im Skript: Zähler (nur Test auf Zählerinhalt 0); ein vs. zwei Zähler unterschiedlich mächtig (Text, kein Beweis).

## 4.2 Kontextfreie Grammatiken (S. 49–50)

- 4.13 Definition: Typ-2-Grammatik (T2G) = kontextfreie Grammatik. Jede Produktion hat linke Seite aus genau einem Nichtterminal (X → w, X ∈ N, w ∈ V*). Sprache: kontextfrei, wenn von T2G erzeugt.
- Grammatik-Tupel wie 2.34: G = (N, T, S, P).
- 4.14: T3G ⊂ T2G (jede Produktion X → wY, X ∈ N).

| Nr | Grammatik | kontextfrei |
|---|---|---|
| 4.14 | 2.36, 2.38 | ja |
| 4.14 | 2.37 (Produktion XB → Q) | nein |
| 4.15 | G = ({X, Y0, Y1}, {0, 1}, X, P), P = {X → 0Y0 \| 1Y1, Y0 → X0, Y1 → X1} | ja, nicht Typ 3 |
| 4.16 | G = ({S}, {(, )}, S, {S → ε \| (S) \| SS}) | ja |

### Ableitungsschritte (4.17, S. 49)

- Ableitungsschritt: uXu' ⇒ uwu' falls X → w ∈ P (u, u' ∈ V*).
- Linksableitungsschritt: uXu' ⇒ℓ uwu' falls u ∈ T* (X ist am weitesten links stehendes Nichtterminal).
- Ableitungsfolge w0 ⇒ w1 ⇒ … ⇒ wk; Linksableitung: w0 ⇒ℓ* wk (jeder Schritt Linksableitungsschritt).
- Rechtsableitungsschritt: ⇒r; Rechtsableitung: ⇒r*.

### Beispiel 4.18 (Grammatik 4.16)

| Ableitungsfolge | Linksableitung | Rechtsableitung |
|---|---|---|
| S ⇒ SS ⇒ S(S) ⇒ (S) ⇒ () | nein (2. Schritt ersetzt nicht das linkeste NT) | nein (3. Schritt ersetzt nicht das rechteste NT) |
| S ⇒ SS ⇒ S ⇒ (S) ⇒ () | ja | (nicht angegeben) |
| S ⇒ SS ⇒ S(S) ⇒ S() ⇒ () | (nicht angegeben) | ja |

## 4.19 Ableitungsbaum (Definition, S. 50)

- Ableitungsbaum zu einer Ableitung X ⇒* w: Graph, Knoten beschriftet mit N, T oder ε.
- Wurzel: X.
- Blätter von links nach rechts ergeben w.
- Erweiterung: Gehört zu X ⇒* wYw' der Baum B', dann gehört zu X ⇒* wYw' ⇒ wvw' (letzte Produktion Y → v) der Baum B, der aus B' entsteht, indem an das Blatt Y Kinder mit den Symbolen von v (in dieser Reihenfolge) angehängt werden.
- ε-Kinder: Y → ε ergibt ein Kind mit Beschriftung ε (ε-Blatt, trägt kein Symbol).

## 4.20 Beispiel (Grammatik 4.16, S. 50)

Ableitung S ⇒ SS ⇒ S(S) ⇒ (S) ⇒ () ergibt schrittweise Bäume (von links): S; S → S S; S → [S, S] mit rechtem S → (S); S → [S, S] mit linkem S → ε; S → [S, S] mit rechtem S → (S), inneres S → ε.

Endbaum als Kantenliste (Blätter links→rechts: ε ( ε ) = "()"):

- S → S1 S2
- S1 → ε
- S2 → ( S3 )
- S3 → ε

Klammerform: S[ S[ε] S[ ( S[ε] ) ] ]

## 4.21 und 4.22 (S. 50)

- 4.21: Ableitungen S ⇒ SS ⇒ S ⇒ (S) ⇒ () und S ⇒ SS ⇒ S(S) ⇒ S() ⇒ () liefern denselben Endbaum aus 4.20. Der Baum ist allgemeiner als die Ableitung.
- 4.22: Aus jedem Ableitungsbaum genau eine Linksableitung und genau eine Rechtsableitung ablesbar. Zu jeder Ableitung gibt es eine äquivalente Links- bzw. Rechtsableitung.

## 4.23 Mehrdeutigkeit (Definition, S. 50)

- T2G mehrdeutig ⇔ es gibt ein Wort mit mindestens zwei verschiedenen Ableitungsbäumen (äquivalent: zwei verschiedene Linksableitungen bzw. Rechtsableitungen). Sonst eindeutig.
- Kontextfreie Sprache inhärent mehrdeutig ⇔ jede sie erzeugende T2G mehrdeutig ist.

## 4.24 Beispiel (Grammatik 4.16, Wort ()()(), S. 50–51)

| Ableitung (Skript) | Baum | Struktur |
|---|---|---|
| S ⇒ SS ⇒ SSS ⇒* ()SS ⇒* ()()() | A | S → [S → [S → (S), S → (S)], S → (S)], innere S → ε |
| S ⇒ SS ⇒* ()()S ⇒* ()()() | B | S → [S → (S), S → [S → (S), S → (S)]], innere S → ε |

- Grammatik 4.16 ist mehrdeutig.
- Die Klammersprache ist nicht inhärent mehrdeutig (siehe 4.24 Ende).

Eindeutige Grammatik für die Klammersprache (S. 51): G = ({S, T}, {(, )}, S, {S → ε | ST, T → (S)}).

## 4.25 Inhärent mehrdeutige Sprache (S. 51)

- Sprache L = {a^i b^j c^k | i = j oder j = k oder i = k} über {a, b, c} ist inhärent mehrdeutig.
- Beweis im Skript ausgelassen (Aussage ohne Beweis).

## 4.26 und 4.27 Konstruktion Grammatik → Kellerautomat (top-down, S. 51–52)

- 4.26 Satz: Sprache von KA erkannt ⇔ von T2G erzeugt. Beweis ausgelassen.
- 4.27 Konstruktion für G = (N, T, X0, P):
  - Zustände: {z0, z, z+}; Anfangszustand z0; Endzustand z+
  - Kelleralphabet: {*} ∪ T ∪ N; Kelleranfangssymbol *
  - Oberstes Kellersymbol steht links im Wort (w = v1 v2 … : v1 oben)

| Aktion | Bedingung | Übergang |
|---|---|---|
| Start | – | f(z0, *, ε) = {(z, X0 *)} |
| Produktionsschritt | X → w ∈ P, oberstes Kellersymbol X | (z, w) ∈ f(z, X, ε) (kein Eingabesymbol) |
| Leseschritt | x ∈ T, oberstes Kellersymbol x | (z, ε) ∈ f(z, x, x) |
| Sackgasse | x ≠ x' | f(z, x, x') = ∅ |
| Akzeptanz | oberstes Kellersymbol * | f(z, *, ε) = {(z+, *)} |

- Produktionsschritt ist nichtdeterministisch bei mehreren Produktionen mit gleicher linker Seite.
- Beweisidee: Linksableitung in G ⇔ Berechnung von K mit Akzeptanz (nur skizziert).
- UNKLAR: Die Akzeptanzaktion f(z, *, ε) = {(z+, *)} ist ohne Prüfung formuliert, ob die Eingabe vollständig gelesen ist. Der Beweistext sagt "Eingabe vollständig gelesen"; 4.5 verlangt es ebenfalls. Nach den notierten Aktionen wäre Akzeptanz mit Restinput möglich.

## 4.28 Beispiel (Grammatik 4.16, S. 52–53)

Linksableitung: S ⇒ SS ⇒ (S)S ⇒ ((S))S ⇒ (())S ⇒ (())(S) ⇒ (())()
Produktionen in dieser Reihenfolge: SS, (S), (S), ε, (S), ε.

Lauf (Eingabe (())(), Keller links oben, Produktion = angewandt, um zur nächsten Zeile zu kommen):

| # | gelesen | Zustand | Keller | Aktion |
|---|---|---|---|---|
| A | ε | z0 | * | f(z0, *, ε) |
| B | ε | z | S* | S → SS |
| C | ε | z | SS* | S → (S) |
| D | ε | z | (S)S* | lesen "(" |
| E | ( | z | S)S* | S → (S) |
| F | ( | z | (S))S* | lesen "(" |
| G | (( | z | S))S* | S → ε |
| H | (( | z | ))S* | lesen ")" |
| I | (() | z | )S* | lesen ")" |
| J | (()) | z | S* | S → (S) |
| K | (()) | z | (S)* | lesen "(" |
| L | (())( | z | S)* | S → ε |
| M | (())( | z | )* | lesen ")" |
| N | (())() | z | * | f(z, *, ε) |
| O | (())() | z+ | * | akzeptiert |

Falscher Zweig (Nichtdeterminismus, S. 53): ab Zeile G statt S → ε die Produktion S → (S): Keller (S)))S*. Nächstes Eingabesymbol ")" ≠ oberstes Kellersymbol "(" → Sackgasse.

## 4.29 und 4.30 Top-down-Syntaxanalyse (S. 53)

- Zerlegung: α gelesener Teil, ω ungelesener Teil, κ Kellerinhalt.
- Invariante: S ⇒ℓ* ακ. Zu prüfen bleibt κ ⇒ℓ* ω, dann S ⇒ℓ* αω.
- Ausgabe (erlaubt): z. B. die angewandte Produktion.
- 4.30: Top-down-Analyse erzeugt eine Linksableitung.

## 4.31 Auswege bei nichtdeterministischem KA (S. 53–54)

- Simulation durch systematische Suche (Backtracking); Zeitaufwand und Datenstrukturen problematisch.
- Einschränkung auf DKA (Extremfall) oder Vorausschau (Lookahead): Skript verweist auf "nächstes Kapitel" (siehe UNKLAR).
- Verzicht auf KA: andere Algorithmen (Kapitel 6).

## 4.32 Bottom-up (S. 54)

- Bottom-up-Analyse mit NKA; Einordnung: Top-down und Bottom-up haben unterschiedliche Leistungsfähigkeit bei DKA mit Vorausschau.

## 4.33 Modifizierter Kellerautomat (S. 54)

- Modifikation 1: Lesen mehrerer oberster Kellersymbole in einem Schritt (konstante Anzahl). Nachbildbar durch Vergrößerung der Zustandsmenge.
- Modifikation 2: Wort "auslesen": oberstes Kellersymbol = letztes Wortsymbol, zweitoberstes = vorletztes usw. Im Keller steht das oberste Symbol rechts.
- Nur einzelne Symbole werden gekellert (Terminal oder Nichtterminal).
- Schritte (4.34/4.35):
  - Leseschritt: nächstes Eingabesymbol kellern.
  - Reduktionsschritt: stehen oben die Symbole der rechten Seite Y → v, werden sie durch Y ersetzt.
- Akzeptanz: Zustand z+, wenn im Keller nur noch das Startsymbol steht (4.34). Siehe UNKLAR.

## 4.34 Beispiel (Bottom-up, Grammatik 4.16, Eingabe (())(), S. 54–55)

Keller (oberstes Symbol rechts) | Zustand | noch ungelesen | danach
---|---|---|---
* | z0 | (())() | lesen "("
*( | z | ())() | lesen "("
*(( | z | ))() | S → ε
*((S | z | ))() | lesen ")"
*((S) | z | )() | S → (S)
*(S | z | )() | lesen ")"
*(S) | z | () | S → (S)
*S | z | () | lesen "("
*S( | z | ) | S → ε
*S(S | z | ) | lesen ")"
*S(S) | z | – | S → (S)
*SS | z | – | S → SS
*S | z | – | Übergang nach z+
*S | z+ | – | akzeptiert

## 4.35 Bottom-up-Syntaxanalyse, allgemein (S. 55–56)

- Zerlegung: α gelesen, ω ungelesen, κ Kellerinhalt.
- Invariante: κ ⇒r* α.
- Ziel: S ⇒r* κω. Mit κ = S und ω = ε: S ⇒r* α = w, also Rechtsableitung von w.
- Leseschritt erhält Invariante (Symbol wird an α und κ angehängt).
- Reduktionsschritt erhält Invariante: κ = κ'γ, Y → γ ⇒ κ'Y ⇒r κ'γ = κ.
- Vorgehen: Leseschritt, solange oben keine rechte Seite liegt; Reduktionsschritt, wenn oben die rechte Seite mindestens einer Produktion liegt.

## 4.36 und 4.37 (S. 56)

- 4.36: Bottom-up findet die Produktionen einer Rechtsableitung von hinten nach vorne.
- 4.37 Freiheitsgrade des Bottom-up-KA:
  - Lese- oder Reduktionsschritt möglich.
  - Unterschiedlich lange Kellerenden reduzierbar.
  - Bei gleicher rechter Seite mehrere Produktionen wählbar.
- Für einen deterministischen Algorithmus muss die Grammatik entsprechend konstruiert werden.

## 4.10 bis 4.12 Grenzen des Kellerautomaten (S. 49)

- 4.10: Übungsaufgaben (Umschalten zum falschen Zeitpunkt; Eingaben, die keine Palindrome sind).
- 4.11: Lpal ist von NKA, aber nicht von DKA erkennbar. Unendlich viele weitere Sprachen ebenso. Echter Mächtigkeitsunterschied DKA ⊊ NKA (Aussage ohne Beweis).
- 4.12: L = {0^k 1^k 2^k | k ∈ N} wird von keinem NKA erkannt (Aussage ohne Beweis).
- Pumping-Lemma: im Skript nur genannt (Bar-Hillel, Ogden), keine Formulierung.

## Akzeptanzmodus (Gesamtkapitel)

- Akzeptanz über Endzustand (4.5, 4.27, 4.34).
- Akzeptanz über leeren Keller: im Skript nicht definiert. Die Notation "Keller leer" meint nur bis auf das Kellerendsymbol *.

## Verweise auf andere Abschnitte

- 4.3–4.9 (Definition KA, DKA-Bedingungen, Akzeptanz, Beispiele 0^k 1^k und Lpal): docs/skript-notizen-typen.md
- 4.13–4.37: diese Datei

## UNKLAR

- UNKLAR: 4.27, Akzeptanzaktion f(z, *, ε) = {(z+, *)} prüft nicht, ob die Eingabe vollständig gelesen ist. Der Text fordert das (4.5, Beweisidee 4.27). Nach den notierten Aktionen wäre Akzeptanz mit Restinput möglich.
- UNKLAR: 4.31, Verweis "im nächsten Kapitel" auf Vorausschau (Lookahead). Kapitel 5 (Typ 1 / Typ 0) behandelt das nicht; vermutlich ist Kapitel 6 gemeint.
- UNKLAR: 4.33 / 4.34, Akzeptanzbedingung bei Bottom-up nennt nur "im Keller nur das Startsymbol". Dass die Eingabe vollständig gelesen sein muss, steht nicht im Text (in der Tabelle ist sie leer).
- UNKLAR: 4.24, die zweite Ableitung ist im Skript mit ⇒* abgekürzt; die Einzelschritte sind nicht ausgeschrieben.
- UNKLAR: 4.4 / 4.5, "Kellerinhalt bei Akzeptanz" wird nicht genannt (siehe typen.md).
