# Skript-Notizen M1 (Skript.pdf, Kapitel 2.1–2.5)

Quelle: Thomas Worsch, "Formale Sprachen und Automaten", Stand 1. November 2010.
Seiten im PDF: 2.2–2.4 S. 8–9, 2.9–2.15 S. 10–11, 2.58–2.66 S. 22–24.
Abschnitte 2.5–2.8 und 2.11 sind in den Umfang aufgenommen, soweit sie Formales enthalten.

## 2.2 Definition (endlicher Automat)

- Z: endliche Zustandsmenge
- z0 ∈ Z: Anfangszustand
- X: Eingabealphabet
- f : Z × X → Z: Überführungsfunktion
- Keine Ausgabe, kein F in dieser Definition.

## 2.3 Beispiel (DEA)

- Z = {A, B, M, Q}
- z0 = A
- X = {0, 1, -}
- F: nicht angegeben (siehe UNKLAR)

Übergangstabelle f (Zeilen = Symbole, Spalten = Zustände):

| x \ z | A | B | M | Q |
|---|---|---|---|---|
| 0 | B | B | B | Q |
| 1 | B | B | B | Q |
| - | M | Q | Q | Q |

Kanten (aus Tabelle und Bild übereinstimmend):

- A -0,1-> B
- A --> M
- M -0,1-> B
- M --> Q
- B -0,1-> B
- B --> Q
- Q -0,1,--> Q

Beispielwörter: keine im Skript genannt.

## 2.4 Definition (f*, f**)

- f* : Z × X* → Z
  - f*(z, ε) = z
  - f*(z, wx) = f(f*(z, w), x) für w ∈ X*, x ∈ X
- f** : Z × X* → Z*
  - f**(z, ε) = z
  - f**(z, wx) = f**(z, w) · f(f*(z, w), x) für w ∈ X*, x ∈ X

## 2.5 Rekursionsprinzip

- Kein formales Objekt. Verweis auf rekursive Definition über die Wortlänge (Basisfall ε, Schritt mit erstem Symbol als Abspaltung).

## 2.6 Beispiel (Beweis)

- Behauptung: für alle z ∈ Z, w ∈ X*: |f**(z, w)| = 1 + |w|
- Beweis per Induktion über n = |w|.

## 2.7 Behauptung (ohne Beispielobjekt)

- Für alle w1, w2 ∈ X*, z ∈ Z: f*(z, w1 w2) = f*(f*(z, w1), w2)

## 2.8 Aufgabe

- Rekursive Definition von f** angeben, die nur auf f und f** (nicht f*) Bezug nimmt.
- Kein Beispielobjekt.

## 2.9 Definition (Mealy- und Moore-Automat)

- Ausgabealphabet Y.
- Mealy: M = (Z, z0, X, f, Y, g), g : Z × X → Y
- Moore: M = (Z, z0, X, f, Y, g), g : Z → Y

## 2.10 Beispiel (Moore-Automat auf Basis 2.3)

- Automat aus 2.3 (Z, z0, X, f wie dort), Y = {0, 1}
- g(B) = 1, g(z) = 0 für alle z ≠ B
- Tabelle g:

| Zustand | A | B | M | Q |
|---|---|---|---|---|
| g | 0 | 1 | 0 | 0 |

- Beispielwörter: keine im Skript genannt.

## 2.11 Aufgabe

- Keine Objekte festgelegt. Aufgabe: Automat aus 2.3 für Gleitkommazahlen erweitern (Dezimalpunkt, danach Suffixe wie E-23). Ausgabefunktion zu wählen.

## 2.12 Definition (Akzeptor)

- Y = {0, 1}, F ⊂ Z mit F = {z ∈ Z | g(z) = 1}.
- Akzeptierende Zustände: F. Grafik: doppelte Kreise.
- Akzeptor = Automat mit Teilmenge F statt Y und g.

## 2.13 Definition (erkannte Sprache)

- Endlicher Akzeptor M = (Z, z0, X, f, F).
- L(M) = {w ∈ X* | f*(z0, w) ∈ F}

## 2.14 Beispiel (DEA-Akzeptor)

- Sprache: L = {0^k 1^l | k, l ∈ N0} = {w ∈ {0,1}* | in w kommen alle 0 vor allen 1 vor}
- Z = {A, B, C}
- z0 = A
- X = {0, 1}
- F = {A, B} (doppelte Kreise im Bild)

| x \ z | A | B | C |
|---|---|---|---|
| 0 | A | C | C |
| 1 | B | B | C |

Kanten: A -0-> A, A -1-> B, B -1-> B, B -0-> C, C -0,1-> C.

Beispielwörter: keine im Skript genannt.

## 2.15 Beispiel (DEA-Akzeptor)

- Sprache: L = {w ∈ {0,1}* | in w kommen vor jeder 1 mindestens zwei 0 vor}
- Z = {0, 1, 2, Q}
- z0 = 0
- X = {0, 1}
- F = {0, 1, 2} (doppelte Kreise im Bild; Q ohne)

| x \ z | 0 | 1 | 2 | Q |
|---|---|---|---|---|
| 0 | 1 | 2 | 2 | Q |
| 1 | Q | Q | 0 | Q |

Kanten: 0 -0-> 1, 0 -1-> Q, 1 -0-> 2, 1 -1-> Q, 2 -0-> 2, 2 -1-> 0, Q -0,1-> Q.

Beispielwörter: keine im Skript genannt.

---

## 2.58 Definition (NEA)

- N = (Z, z0, X, g, F). Skript-Tupel schreibt G (siehe UNKLAR).
- Z: endliche Zustandsmenge
- z0 ∈ Z: Anfangszustand
- X: Eingabealphabet
- F ⊆ Z: akzeptierende Zustände
- g : Z × X* → 2^Z
- Bedingung: nur für endlich viele Paare (z, w) gilt g(z, w) ≠ ∅.

## 2.59 Darstellung (keine Objekte)

- Tabelle: Zeile je Wort w mit mindestens einem z, g(z, w) ≠ ∅; Spalte je Zustand z; Eintrag g(z, w).

## 2.60 Bedeutung (Schreibweise)

- z0 ∈ g(z, w) bedeutet: Im Zustand z kann der NEA bei Eingabe w nach z0 übergehen. Schreibweise z -w-> z0.
- DEA-Fall: g(z, x) = {z'} mit |x| = 1.
- NEA: |w| beliebig, auch ε; mehrere oder keine Nachfolger möglich.

## 2.61 Beispiel (NEA)

- Z = {0, 1, 2}
- z0 = 0
- X = {0, 1}
- F = Z

| x \ z | 0 | 1 | 2 |
|---|---|---|---|
| 0 | {1} | {2} | {2} |
| 1 | ∅ | ∅ | {0} |

Kanten: 0 -0-> 1, 1 -0-> 2, 2 -0-> 2, 2 -1-> 0.
Alle Übergänge mit Einzelsymbolen, kein ε.

Beispielwörter: keine im Skript genannt.

## 2.62 Bemerkung (keine Objekte)

- DEA mit F = Z: L(M) = X*.
- NEA mit F = Z: L nicht zwingend X*, weil g(z, w) = ∅ vorkommen kann (vgl. 2.61).

## 2.63 Idee (keine Definition)

- z = z0 -w1-> z1 -w2-> ... -wk-> zk = z' bei Zerlegung w = w1 w2 ... wk.

## 2.64 Definition (g*, NEA)

- z1 -w->* z2 gilt, falls
  - z1 = z2 und w = ε, oder
  - es gibt z' ∈ Z und w = w' w'' mit z1 -w'->* z' und z' -w''-> z2.
- g* : Z × X* → 2^Z
- g*(z1, w) = {z2 ∈ Z | z1 -w->* z2}

## 2.65 Definition (erkannte Sprache NEA)

- L(N) = {w ∈ X* | g*(z0, w) ∩ F ≠ ∅}

## 2.66 Beispiel (NEA mit ε-Übergängen)

- N = ({0, 1, 2, 3, 4, 5}, 0, {0, 1}, g, {2, 5})
- Z = {0, 1, 2, 3, 4, 5} (Zustände 1, 3, 4 ohne Kanten)
- z0 = 0
- X = {0, 1}
- F = {2, 5} (doppelte Kreise im Bild)

| x \ z | 0 | 2 | 5 |
|---|---|---|---|
| ε | {2, 5} | ∅ | ∅ |
| 01 | ∅ | {2} | ∅ |
| 001 | ∅ | ∅ | {5} |

Kanten:

- 0 -ε-> 2 (ε-Übergang, Wort leer)
- 0 -ε-> 5 (ε-Übergang, Wort leer)
- 2 -01-> 2 (Wortübergang, Länge 2)
- 5 -001-> 5 (Wortübergang, Länge 3)

Beispielwörter im Skript: L(N) = {01}* ∪ {001}* (Herleitung im Text). Keine Einzelwörter genannt.
Regulärer Ausdruck laut Skript: (01)*|(001)*.

---

## UNKLAR

- 2.3: Skript nennt keine akzeptierenden Zustände (F nicht angegeben).
- 2.58: Tupel schreibt "G" statt "g" (Funktion heißt sonst überall g).
