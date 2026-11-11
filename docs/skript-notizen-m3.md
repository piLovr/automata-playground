# Skript-Notizen M3 (Skript.pdf, Kapitel 1 und 2)

Quelle: Thomas Worsch, "Formale Sprachen und Automaten", Stand 1. November 2010.
Seiten im PDF = Skriptseiten. Umfang: Kap. 1 (S. 3–4), Kap. 2 (S. 7–34).
Nicht übernommen: Kap. 3–6.
"M1", "M2", "Typen", "Regex" = docs/skript-notizen-m1.md, -m2.md, -typen.md, -regex.md.

## Kapitel 1

## 1.1 Beispiel (Zeichensatz), 1.2 Definition (Alphabet, Wort, Sprache), S. 3

| Begriff | Definition |
|---|---|
| Alphabet A | endliche Menge von Zeichen |
| Wort w über A | Folge von Zeichen aus A |
| Länge \|w\| | Anzahl der Zeichen in w |
| leeres Wort ε | \|ε\| = 0; ε ist kein Zeichen aus A |
| A* | Menge aller Wörter über A |
| formale Sprache L über A | beliebige Teilmenge L ⊆ A* |

- 1.1 Beispiel: Java-Zeichensatz A (mehr als ASCII); Java-Programme = Wörter über A.

## 1.3 Definition (Konkatenation, Potenz), S. 3

- w1 · w2 = w1 w2 = a1…ak b1…bl für w1 = a1…ak, w2 = b1…bl
- ε · w = w = w · ε
- Assoziativ: (w1 w2) w3 = w1 (w2 w3)
- w^0 = ε; w^(k+1) = w^k w (k ∈ N0)
- nicht kommutativ (1.4)

## 1.4 Beispiele (Wörter), S. 3

| Ausdruck | Ergebnis |
|---|---|
| 00 · 10 | 0010 |
| 10 · 00 | 1000 |
| 0^5 | 00000 |
| 0^3 1^3 | 000111 |
| 0 1^3 | 0111 |
| (01)^3 | 010101 |
| w^1 | w |
| ε^k (k ∈ N0) | ε |

## 1.5 Längenregeln, S. 3

- \|w1 w2\| = \|w1\| + \|w2\|
- \|w^k\| = k · \|w\|

## 1.6 Definition (Produkt, Potenz von Sprachen), S. 3–4

- L1 · L2 = L1 L2 = { w1 w2 | w1 ∈ L1 ∧ w2 ∈ L2 }
- L^0 = {ε}; L^(k+1) = L^k L (k ∈ N0)

## 1.7 Beispiele (Sprachen), S. 4

| Ausdruck | Ergebnis |
|---|---|
| {01, 1} · {000, 01} | {01000, 0101, 1000, 101} |
| {010, 11}^2 | {010010, 01011, 11010, 1111} |
| {0, 1}^3 | {000, 001, 010, 011, 100, 101, 110, 111} |
| A^k | { w ∈ A* \| \|w\| = k } |

## 1.8 Bemerkung ({ε} als neutrales Element), S. 4

- {ε} · L = L = L · {ε}
- {ε} ≠ ∅ (genau ein Element)

## 1.9 Definition (L+, L*), S. 4

- L+ = ⋃_(k≥1) L^k (ε-freier Konkatenationsabschluss)
- L* = ⋃_(k≥0) L^k = L^0 ∪ L+ = {ε} ∪ L+ (Kleene-Stern)

## 1.10 Bemerkung, S. 4

- L+ = Menge aller Wörter, die sich als Produkt aus ≥ 1 Wörtern aus L schreiben lassen.
- ε ∈ L+ kann gelten, nämlich wenn ε ∈ L.

## 1.11 Beispiel (Java), S. 4

- L_Java ⊂ A* über A = {a…z, A…Z, +, −, ∗, …}; kein konkretes Objekt im Skript.

## Kapitel 1: nicht definiert

- Präfix, Suffix, Teilwort: nicht definiert in Kap. 1 (nur umgangssprachlich in 2.19 bzw. 3.1).
- Lexikographische und längenlexikographische Ordnung: nicht vorhanden.

## Kapitel 2: Übersicht der nummerierten Beispiele und Aufgaben

## 2.1–2.92 Übersicht (Nr., Seite, Objekt, Inhalt, Stand)

| Nr. | S. | Objekt | Inhalt | Stand |
|---|---|---|---|---|
| 2.1 | 7 | Mealy-Automat | Parkplatz, Zähler Z = {0…5} | hier (unten) |
| 2.3 | 8 | DEA | Z = {A,B,M,Q} | M1 (F fehlt, UNKLAR) |
| 2.6 | 9 | Beweisbeispiel | \|f**(z,w)\| = 1 + \|w\| | M1 |
| 2.8 | 9 | Aufgabe | rekursive Def. von f** ohne f* | M1 |
| 2.10 | 10 | Moore-Automat | Automat 2.3 mit g | M1 |
| 2.11 | 10 | Aufgabe | Gleitkomma-Automat | M1 |
| 2.14 | 10–11 | DEA (Akzeptor) | L = {0^k 1^l} | M1 + Zustandsbedeutung (unten) |
| 2.15 | 11 | DEA (Akzeptor) | vor jeder 1 mind. zwei 0 | M1 (F im Bild bestätigt) |
| 2.17 | 11 | Sprache | L = {0^k 1^k} | hier (unten) |
| 2.18 | 12 | Wortbeispiele | ∈ L / ∉ L | hier (unten) |
| 2.19 | 12–13 | Beweis | Schubfachargument | hier (unten) |
| 2.20 | 13 | Sprache | {0^k 1^i 0^k 1^j} | hier (unten) |
| 2.22 | 13–14 | regulär. Ausdrücke | Beispiele und falsche Ausdrücke | M2 |
| 2.24 | 14 | Ausdrücke → Sprachen | 0\|1, (0\|1)*, (0*1*)* | M2 |
| 2.36 | 17 | Grammatik | X → 01 \| 0X1 | M2 |
| 2.37 | 17 | Grammatik | Sprache a^(k²) | M2 |
| 2.38 | 17–18 | Grammatik | Gleitkomma; Variante mit Namen | M2 + Variante (unten) |
| 2.40 | 18 | Ableitung | Xz ⇒* -101 | M2 |
| 2.42 | 19 | Ableitung | L = {0^k 1^k} | M2 |
| 2.43 | 19 | Ableitungen | Grammatik 2.37 | M2 |
| 2.44 | 19–20 | Typ-3-Grammatik | Gleitkomma (gleiche Sprache wie 2.38) | M2 (UNKLAR: S) |
| 2.47 | 20 | Verweis | 2.44 ist Typ 3 | M2 |
| 2.57 | 22 | Potenzmengen | 2^Z für vier Z | hier (unten) |
| 2.61 | 23 | NEA | Z = {0,1,2}, F = Z | M1 |
| 2.66 | 24 | NEA mit ε | L = {01}* ∪ {001}* | M1 + M2 |
| 2.67 | 24 | Aufgabe | DEA für Sprache von 2.66 | keine Lösung im Skript |
| 2.71 | 25 | Bild (Schritt 1) | NEA aus 2.66 ohne Wörter > 1 | hier (unten) |
| 2.72 | 26 | Bild (Schritt 2) | ε-Entfernung, falsch und korrekt | hier (unten) |
| 2.73 | 27 | Bild / Aufgabe | Ergebnis ohne ε-Übergänge | hier (unten) |
| 2.78 | 29 | DEA | unerreichbare Zustände | hier (unten) |
| 2.83 | 30 | unnumm. Beispiel | 000 / 01 mit w = 0 | hier (unten) |
| 2.87 | 30 | Beispiel | Gleichheit als Äquivalenzrelation | hier (unten) |
| 2.88 | 31 | Beispiel | Äquivalenz "gleiche Anzahl Primfaktoren" | hier (unten) |
| 2.92 | 32–34 | DEA | Minimierung | M2 |

Weitere nummerierte Stücke ohne konkretes Objekt: 2.5, 2.16, 2.31, 2.55, 2.62, 2.75, 2.76, 2.77, 2.85 (nur Aussagen oder Verweise).

## 2.1 Beispiel (Parkplatz, Mealy-Automat), S. 7

- Typ: Mealy (Ausgabe an Kante x/y, vgl. 2.9)
- Z = {0, 1, 2, 3, 4, 5} (Zählerstand), z0 = 0
- X = {E, A} (Einfahrt, Ausfahrt)
- Y = {↑, −, ?!, ⊗}

| x \ z | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| E (f) | 1 | 2 | 3 | 4 | 5 | 5 |
| A (f) | 0 | 0 | 1 | 2 | 3 | 4 |
| E (g) | ↑ | ↑ | ↑ | ↑ | ↑ | ⊗ |
| A (g) | ?! | − | − | − | − | − |

- Kanten = Tabelleneinträge (i —x/y→ j).

## 2.14 Ergänzung (Zustandsbedeutung), S. 11

| Zustand | Bedeutung |
|---|---|
| A | noch keine 1 gelesen (w ∈ L) |
| B | mindestens eine 1, danach keine 0 (w ∈ L) |
| C | 10 als Teilwort vorgekommen (w ∉ L, nicht mehr änderbar) |

- F = {A, B} (Doppelkreise, S. 10).

## 2.17 Lemma (Sprache), S. 11

- X = {0, 1}
- L = {0^k 1^k | k ∈ N} = {ε, 01, 0011, 000111, …} (ε ∈ L nach 2.18)
- Aussage: L wird von keinem endlichen Akzeptor erkannt.

## 2.18 Beispiel (Wörter), S. 12

| Wort w | w ∈ L? |
|---|---|
| ε | ja |
| 01 | ja |
| 0011 | ja |
| 000111 | ja |
| 00111 | nein |
| 1010 | nein |

## 2.19 Beweis (Schubfachargument, nur Objekte), S. 12–13

- Annahme: M = (Z, z0, X, f, F) akzeptiert L, m = \|Z\|.
- w = 0^m 1^m ∈ L ⇒ f*(z0, w) = z_f ∈ F.
- Zustandsfolge bei 0^m: z0, z1 = f(z0,0), …, zm = f(z_(m−1),0); f**(z0, 0^m) = z0 z1 … zm (m+1 Einträge, m Zustände).
- Wiederholung: z_i = z_j mit i < j; ℓ = j − i > 0; dann z_(m−ℓ) = z_m.
- w' = 0^(m−ℓ) 1^m: f*(z0, w') = f*(z_m, 1^m) = z_f ∈ F, also w' ∈ L(M).
- Aber w' ∉ L (ungleich viele 0 und 1). Widerspruch.

## 2.20 Beispiel (Sprache), S. 13

- L = {0^k 1^i 0^k 1^j | i, j, k ∈ N}
- UNKLAR: ob 0 ∈ N (siehe UNKLAR-Liste).

## 2.38 Variante mit Nichtterminalnamen, S. 18

| Kürzel in 2.38 | Name im Skript |
|---|---|
| Xz | ⟨zahl⟩ (Startsymbol S) |
| Xm | ⟨opt.minus⟩ |
| Xv | ⟨vorkomma⟩ |
| Xn | ⟨opt.nachkomma⟩ |
| Xe | ⟨opt.exponent⟩ |
| Xb | ⟨bitfolge⟩ |

- N = {⟨zahl⟩, ⟨opt.minus⟩, ⟨vorkomma⟩, ⟨opt.nachkomma⟩, ⟨opt.exponent⟩, ⟨bitfolge⟩}
- T = {0, 1, −, ., E}; S = ⟨zahl⟩
- P:
  - ⟨zahl⟩ → ⟨opt.minus⟩⟨vorkomma⟩⟨opt.nachkomma⟩⟨opt.exponent⟩
  - ⟨opt.minus⟩ → − | ε
  - ⟨vorkomma⟩ → ⟨bitfolge⟩
  - ⟨opt.nachkomma⟩ → .⟨bitfolge⟩ | ε
  - ⟨opt.exponent⟩ → E⟨opt.minus⟩⟨bitfolge⟩ | ε
  - ⟨bitfolge⟩ → 0⟨bitfolge⟩ | 1⟨bitfolge⟩ | 0 | 1

## 2.57 Beispiel (Potenzmengen), S. 22

| Z | 2^Z |
|---|---|
| {0} | {∅, {0}} |
| {0, 1} | {∅, {0}, {1}, {0,1}} |
| {0, 1, 2} | {∅, {0}, {1}, {2}, {0,1}, {0,2}, {1,2}, {0,1,2}} |
| ∅ | {∅} |

- \|2^Z\| = 2^\|Z\|

## 2.71 Bild (Schritt 1 auf NEA aus 2.66), S. 25

- Zustände: {0, 1, 2, 3, 4, 5}; z0 = 0; F = {2, 5}
- Kanten:
  - 0 —ε→ 2
  - 0 —ε→ 5
  - 2 —0→ 1
  - 1 —1→ 2
  - 5 —0→ 3
  - 3 —0→ 4
  - 4 —1→ 5

## 2.72 Bilder (Schritt 2, ε-Entfernung), S. 26

Falscher NEA (ohne F-Regel):

- Zustände {0,…,5}; z0 = 0; F = {2, 5}
- Kanten: 0 —0→ 1, 0 —0→ 3, 1 —1→ 2, 2 —0→ 1, 3 —0→ 4, 4 —1→ 5, 5 —0→ 3
- Folge: leeres Wort ∉ L(N).

NEA mit vergrößertem F (vor Entfernung der ε-Übergänge):

- F = {0, 2, 5}
- Kanten: wie oben, plus 0 —ε→ 2, 0 —ε→ 5

## 2.73 Bild (ohne ε), S. 27

- Zustände {0,…,5}; z0 = 0; F = {0, 2, 5}
- Kanten: 0 —0→ 1, 0 —0→ 3, 1 —1→ 2, 2 —0→ 1, 3 —0→ 4, 4 —1→ 5, 5 —0→ 3
- Enthält nichtdeterministische Übergänge (zwei Kanten 0 —0→ aus Zustand 0).

## 2.78 Beispiel (unerreichbare Zustände), S. 29

- M = ({A, B, C, D}, A, {0, 1}, f, {A}), f(z, x) = z für alle z, x
- Erreichbar von A: {A}; unerreichbar: B, C, D.

## 2.83 Beispiel (unnummeriert, im Abschnitt 2.83), S. 30

- DEA aus 2.14; w1 = 000, w2 = 01, Trennwort w = 0.
- w1 w = 0000 ∈ L; w2 w = 010 ∉ L; also w trennt w1 und w2.

## 2.87 Beispiel (Äquivalenzrelation), S. 30

- Gleichheit = (x ≡ y ⇔ x = y) ist Äquivalenzrelation auf jeder Menge.
- Klassen: [x] = {x}.

## 2.88 Beispiel (Äquivalenz nach Primfaktoranzahl), S. 31

- x ≡ y ⇔ x und y haben gleich viele Primfaktoren (Zählung: siehe UNKLAR).
- 6 ≡ 77 (6 = 2·3, 77 = 7·11); 41 ≡ 13 (Primzahlen).
- [2] = {2, 3, 5, 7, 11, 13, 17, …} = [3] = [5] = [7] = …
- 2^1, 2^2, 2^3, 2^4 liegen in paarweise verschiedenen Klassen.

## UNKLAR

- 2.20 (und 2.17): N mit 0? 2.18 nennt ε ∈ L, was 0 ∈ N für k impliziert; in 2.20 steht nur "i, j, k, ∈ N" (Komma-Tippfehler).
- 2.88: "Anzahl von Primfaktoren" nicht ausdrücklich mit Vielfachheit gezählt; nur aus 2^1…2^4 (verschiedene Anzahl) geschlossen.
- 2.83: Beispiel steht im Fließtext des Abschnitts, nicht als nummerierter Eintrag.
- 2.71–2.73: NEA-Kanten nur aus Bildern abgelesen (grafisch, keine Tabelle).
- 2.1: Mealy-Zuordnung nur über Kantenbeschriftung x/y, nicht ausdrücklich als "Mealy" benannt.
- Übrige UNKLAR-Stellen aus M1/M2 (2.3 F, 2.44 S = X_n, 2.58 "G" statt "g", 2.74 "⊂" statt "⊆") gelten weiter.
