# Skript-Notizen M2 (Skript.pdf, Kapitel 2.2–2.6, Auszug)

Quelle: Thomas Worsch, "Formale Sprachen und Automaten", Stand 1. November 2010.
Seiten im PDF = Skriptseiten. Umfang: 2.21–2.27 S. 13–15, 2.29–2.33 S. 15–16, 2.34–2.44 S. 17–20, 2.45–2.55 S. 20–22, 2.58–2.76 S. 22–28, 2.78–2.92 S. 28–34.
Nicht übernommen: Abschnitte 3.x (Regex in Werkzeugen), Kapitel 5/6 (Kellerautomaten, CYK), Bildbeispiele 2.71/2.72 (nur grafisch).

## 2.21 Definition (regulärer Ausdruck)

- Alphabet A mit A ∩ Z = ∅
- Z = {|, (, ), *, ∅} (fünf Zeichen; ∅ ist Zeichen des Ausdrucks)
- Induktive Syntax:
  1. ∅ ist regulärer Ausdruck.
  2. a ∈ A ⇒ a ist regulärer Ausdruck.
  3. R1, R2 regulär ⇒ (R1|R2) und (R1R2) regulär.
  4. R regulär ⇒ (R*) regulär.
  5. Nichts anderes.
- ε kommt nicht als Zeichen vor (weder in Z noch als Ausdruck).

Klammereinsparung (2.21):

| Regel | Inhalt |
|---|---|
| Präzedenz | * vor Konkatenation vor \| |
| Gleiche binäre Operatoren | links geklammert |

- Beispiel: R1|R2R3* = (R1|(R2(R3*))); R1|R2|R3 = ((R1|R2)|R3)

## 2.22 Beispiele (reguläre Ausdrücke über {0,1})

Ausdrücke mit Klammern → nach Klammereinsparung:

| Mit Klammern | Ohne Klammern |
|---|---|
| ∅ | ∅ |
| 0, 1 | 0, 1 |
| (01) | 01 |
| ((01)0) | 010 |
| (((01)0)0) | 0100 |
| ((01)(00)) | 01(00) |
| (∅\|1) | ∅\|1 |
| (0\|1) | 0\|1 |
| ((0(0\|1))\|1) | 0(0\|1)\|1 |
| (0\|(1\|(0\|0))) | (0\|(1\|(0\|0))) |
| (∅*) | ∅* |
| (0*) | 0* |
| ((10)(1*)) | 101* |
| (((10)1)*) | (101)* |
| ((0*)*) | 0** |
| (((((01)1)*)*)\|(∅*)) | (011)**\|∅* |

Falsche Ausdrücke (Skript-Begründung):

| Zeichenkette | Grund |
|---|---|
| (\|1) | vor \| fehlt Ausdruck |
| \|∅\| | vor und hinter \| muss je ein Ausdruck stehen |
| ()01 | zwischen ( und ) fehlt Ausdruck |
| ((01) | Klammern nicht gepaart |
| *(01) | vor * fehlt Ausdruck |
| 2* | 2 ist kein Zeichen des Alphabets |

## 2.23 Definition (beschriebene Sprache ⟨R⟩)

- ⟨∅⟩ = ∅ = {}
- ⟨a⟩ = {a} für a ∈ A
- ⟨R1|R2⟩ = ⟨R1⟩ ∪ ⟨R2⟩
- ⟨R1R2⟩ = ⟨R1⟩ · ⟨R2⟩
- ⟨R*⟩ = ⟨R⟩*
- w passt zu R / R matcht w ⇔ w ∈ ⟨R⟩
- Im Skript nicht ausgewertet: ⟨∅*⟩ (folgt formal aus ⟨R*⟩ = ⟨R⟩*, Wert nicht angegeben).

## 2.24 Beispiele (Sprachen)

| R | ⟨R⟩ |
|---|---|
| 0\|1 | {0} ∪ {1} = {0,1} |
| (0\|1)* | {0,1}* |
| (0*1*)* | ({0}*{1}*)* = {0,1}* |

## 2.25 / 2.26 (Äquivalenz regulärer Ausdrücke)

- Gleiche Sprache durch verschiedene Ausdrücke beschreibbar (2.24).
- Fragen: (1) Welche Sprachen sind durch reguläre Ausdrücke beschreibbar? (2) Ist ⟨R1⟩ = ⟨R2⟩ algorithmisch entscheidbar? Antwort auf (2): ja (folgt aus 2.27).
- Äquivalenzproblem für reguläre Ausdrücke: PSPACE-vollständig.
- Bekannte Algorithmen: Laufzeit wächst stark exponentiell in der Länge n des Ausdrucks (z. B. 2^(n²) o. ä.).

## 2.27 / 2.28 Satz und Definition

- Satz 2.27: Für jede Sprache L äquivalent:
  1. L von einem endlichen Akzeptor erkannt.
  2. L durch regulären Ausdruck beschrieben.
- Definition 2.28: reguläre Sprache = Sprache mit Eigenschaften aus 2.27.
- Richtung 2 ⇒ 1 wird später nachgeholt (2.48 / 2.76).

## 2.29 / 2.30 Konstruktion DEA → regulärer Ausdruck

Gegeben: M = (Z, z0, X, f, F), m = |Z|.

Indizierung:
- Zustände: z0, z1, …, z(m−1) (Indizierung 0..m−1, nicht 1..m)
- i, j ∈ {0, …, m−1}; k ∈ {0, …, m}
- Z_k = {z_l | l < k}; Z_0 = ∅; Z_m = Z

Sprachen:

    L^k_ij = { w ∈ X* | f**(z_i, w) ∈ {z_i} Z_k* {z_j} ∨ (i = j ∧ w = ε) }

Ergebnis:

    L(M) = ⋃_{j ∈ I_F} L^m_0j      mit I_F = { j | z_j ∈ F }

Basisfall k = 0 (Z_0* = {ε}), für alle i, j:

    L^0_ij = { x ∈ X | f(z_i, x) = z_j } ∪ {ε}   falls i = j
    L^0_ij = { x ∈ X | f(z_i, x) = z_j }         falls i ≠ j   (Skript: ∪ {})

Rekursion für k = 1, …, m (alle i, j):

    L^k_ij = L^(k−1)_ij ∪ L^(k−1)_{i,k−1} · (L^(k−1)_{k−1,k−1})* · L^(k−1)_{k−1,j}

Ablauf:
1. Reguläre Ausdrücke für alle L^0_ij (endliche Mengen aus Symbolen, ggf. ε).
2. Für k = 1..m die L^k_ij aus L^(k−1) über die Rekursion bilden.
3. Ausdruck für L(M) = Vereinigung über j ∈ I_F von L^m_0j.

- Skript gibt kein Beispiel mit Tabelle zu 2.30 an.
- Korrektheit: Beweis ausgelassen (Übung).

## 2.31 / 2.32 Satz (Abschluss)

- Komplement und Durchschnitt sind nicht als Operatoren in der RA-Definition nötig.
- Satz 2.32: L1, L2 regulär über A ⇒ A* \ L1 und L1 ∩ L2 regulär.
- Beweis über Satz 2.27 (Automaten).

## 2.33 Konstruktionen

Gegeben: M1 = (Z1, z01, A, f1, F1), M2 = (Z2, z02, A, f2, F2).

| Operation | Automat | Zustände | Start | Endzustände | Übergang |
|---|---|---|---|---|---|
| Komplement A* \ L1 | M' = (Z1, z01, A, f1, Z1 \ F1) | Z1 | z01 | Z1 \ F1 | f1 |
| Durchschnitt L1 ∩ L2 | M = (Z1 × Z2, (z01, z02), A, f, F1 × F2) | Z1 × Z2 | (z01, z02) | F1 × F2 | f((z1,z2), a) = (f1(z1,a), f2(z2,a)) |

- Vereinigung über Produktautomat: im Skript nicht konstruiert (siehe UNKLAR).

## 2.34 Definition (Grammatik)

- G = (N, T, S, P)
- N: Alphabet der Nichtterminalsymbole
- T: Alphabet der Terminalsymbole, N ∩ T = ∅
- S ∈ N: Startsymbol
- P ⊂ V* N V* × V*: endliche Menge von Produktionen, V = N ∪ T
- Produktion v → w: linke Seite enthält mind. ein Nichtterminal; rechte Seite beliebiges Wort aus V* (auch ε)
- Kurzschreibweise (2.35): v → w1 | w2 | w3 für mehrere Produktionen mit gleicher linker Seite

## 2.36–2.38 Beispiele (Grammatiken)

| Bsp. | N | T | S | P |
|---|---|---|---|---|
| 2.36 | {X} | {0,1} | X | X → 01, X → 0X1 |
| 2.37 | {B,Q,S,X,Y,Z} | {a} | S | S → aXBZ, XB → Q, QB → Q, QZ → ε, XB → aXYB, YB → aaBY, YZ → BZ, Xa → aX, Ba → aB |

Beispiel 2.38 (Gleitkommazahl, Nichtterminale Xz, Xm, Xv, Xn, Xe, Xb):
- N = {Xz, Xm, Xv, Xn, Xe, Xb}, T = {0, 1, -, ., E}, S = Xz
- Xz → XmXvXnXe
- Xm → - | ε
- Xv → Xb
- Xn → .Xb | ε
- Xe → EXmXb | ε
- Xb → 0Xb | 1Xb | 0 | 1

## 2.39 Definition (Ableitung)

- w1 ⇒ w2, falls w1 = u v u', w2 = u w u' und v → w ∈ P (u, u' ∈ V*).
- w1 ⇒* w2: reflexiv-transitive Hülle von ⇒ (0 Schritte eingeschlossen).

## 2.40 Beispiel (Ableitung in 2.38)

- Xz ⇒ XmXvXnXe ⇒ -XvXnXe ⇒ -XvεXe ⇒ -XbXe ⇒ -1XbXe ⇒ -10XbXe ⇒ -101Xe ⇒ -101
- Also Xz ⇒* -101.
- Behauptung: für k ∈ N und w ∈ T^k gilt Xb ⇒* w und Xb ⇒* wXb (Beweis per Induktion, Anfang k = 1).

## 2.41 Definition (erzeugte Sprache)

    L(G) = { w ∈ T* | S ⇒* w }

## 2.42 Beispiel

- G aus 2.36: L(G) = { 0^k 1^k | k ∈ N }
- Ableitung: X ⇒ 0X1 ⇒ 00X11 ⇒ … ⇒ 0^(k−1) X 1^(k−1) ⇒ 0^k 1^k

## 2.43 Beispiel (G aus 2.37)

- Ableitungen (Behauptungen):
  - XB^k Z ⇒* ε für alle k ∈ N
  - XB^k Z ⇒* a^(2k+1) XB^(k+1) Z für alle k ∈ N
  - a^(k²) XB^k Z ⇒* a^((k+1)²) XB^(k+1) Z für alle k ∈ N (wegen k² + 2k + 1 = (k+1)²)
- Übung im Skript: L(G) = { a^(k²) | k ∈ N } zeigen.

## 2.44 Beispiel (Typ-3-Grammatik, gleiche Sprache wie 2.38)

- N = {X0, X1, X2, X3, X4, X5, X6, X7}
- T = {0, 1, -, ., E}
- S = Xn (UNKLAR, siehe Liste)
- P:
  - X0 → -X1 | X1
  - X1 → 0X2 | 1X2
  - X2 → 0X2 | 1X2 | ε | X3
  - X3 → .0X4 | .1X4 | X5
  - X4 → 0X4 | 1X4 | ε | X5
  - X5 → E-X6 | EX6
  - X6 → 0X7 | 1X7
  - X7 → 0X7 | 1X7 | ε

## 2.45 Definition (Typ-3-Grammatik)

- Jede Produktion hat die Form X → w oder X → wY mit w ∈ T*, X, Y ∈ N.
- 2.46: höchstens ein Nichtterminal rechts, und nur als letztes Symbol (rechtslinear); Typ-3 = rechtslineare Grammatik.
- 2.47: Grammatik aus 2.44 ist Typ 3.

## 2.48 Satz (Erweiterung von 2.27)

Für jede Sprache L äquivalent:
1. L von endlichem Akzeptor erkannt.
2. L durch regulären Ausdruck beschrieben.
3. L von Typ-3-Grammatik erzeugt.

Beweisteile: 1 ⇒ 2 (2.30), 1 ⇒ 3 (2.49/2.50). Rest später.

## 2.49 / 2.50 Konstruktion DEA → Typ-3-Grammatik

Gegeben: M = (Z, z0, X, f, F) endlicher Akzeptor.

    G = (N, T, S, P)
    N = { X_z | z ∈ Z }
    T = X
    S = X_z0
    P = { X_z → x X_z' | f(z, x) = z' } ∪ { X_z → ε | z ∈ F }

- Bedeutung: f(z,x) = z' ⇔ Produktion X_z → x X_z'.
- Endzustand z ∈ F ⇔ Produktion X_z → ε.
- Gleichheit L(G) = L(M): Beweis ausgelassen (Übung).

## 2.51 Typ-3 in Normalform

- Rechte Seite jeder Produktion: ε oder ein Terminal gefolgt von einem Nichtterminal (x Y, x ∈ T, Y ∈ N).
- Nicht vorkommend: X → Y und X → wY mit |w| ≥ 2 (Skript: "Keine rechte Seite besteht nur aus Terminalsymbolen").
- Skript-Aussage: Für Simulation von DEA reicht Normalform; allgemein gilt, dass Typ-3 nicht mehr kann (2.52–2.53).

## 2.52 Lemma (Abschluss Typ 3)

Gegeben: G1 = (N1, T1, X01, P1), G2 = (N2, T2, X02, P2) Typ 3. Dann existieren Typ-3-Grammatiken GV, GK, GS mit:
- a) L(GV) = L(G1) ∪ L(G2)
- b) L(GK) = L(G1) · L(G2)
- c) L(GS) = L(G1)*

## 2.53 Beweisskizze (Konstruktionen, o.B.d.A. N1 ∩ N2 = ∅)

a) Vereinigung:
- GV = (NV, TV, XV, PV)
- NV = N1 ∪ N2 ∪ {XV} (XV neu, Startsymbol)
- TV = T1 ∪ T2
- PV = P1 ∪ P2 ∪ {XV → X01 | X02}

b) Konkatenation:
- GK = (NK, TK, X01, PK)
- NK = N1 ∪ N2, TK = T1 ∪ T2, Startsymbol X01
- PK = ((P1 ∪ P2) \ { X → w | w ∈ T1* ∧ X → w ∈ P1 }) ∪ { X → wX02 | w ∈ T1* ∧ X → w ∈ P1 }

c) Stern: Konstruktion als Übung (keine Angabe im Skript).

## 2.54 Korollar

- Zu jedem regulären Ausdruck r gibt es Typ-3-Grammatik G mit L(G) = ⟨r⟩.
- Konstruktion im Skript: nicht angegeben (Basisfälle ∅ und a fehlen, siehe UNKLAR).

## 2.55 Aufgabe

- Offen: Basisfälle und Stern-Konstruktion (2.53 c) selbst ausarbeiten.

## 2.58 Definition (NEA)

    N = (Z, z0, X, g, F)

- Z: endliche Zustandsmenge
- z0 ∈ Z: Anfangszustand
- X: Eingabealphabet
- F ⊆ Z: akzeptierende Zustände
- g : Z × X* → 2^Z
- Bedingung: nur für endlich viele Paare (z, w) gilt g(z, w) ≠ ∅

## 2.59 Darstellung (tabellarisch)

- Zeile je Wort w mit mindestens einem z: g(z, w) ≠ ∅
- Spalte je Zustand z; Eintrag = g(z, w)

## 2.60 Bedeutung

- z' ∈ g(z, w) ⇔ z —w→ z' (NEA kann von z bei Eingabe w nach z' gehen)
- DEA-Spezialfall: g(z, x) = {z'} für x ∈ X.
- NEA: |w| ≥ 0 erlaubt, mehrere oder keine Nachfolger erlaubt.

## 2.63 / 2.64 Definition (g*)

- z1 —w→* z2 gilt, falls
  - z1 = z2 und w = ε, oder
  - w = w' w'' und es gibt z' mit z1 —w'→* z' —w''→ z2
- g*(z1, w) = { z2 | z1 —w→* z2 }

## 2.65 Definition (erkannte Sprache NEA)

    L(N) = { w ∈ X* | g*(z0, w) ∩ F ≠ ∅ }

## 2.66 Beispiel (NEA)

- N = ({0,1,2,3,4,5}, 0, {0,1}, g, {2,5})
- Übergangstabelle g (nur Zeilen mit Einträgen):

| w \ z | 0 | 2 | 5 |
|---|---|---|---|
| ε | {2,5} | ∅ | ∅ |
| 01 | ∅ | {2} | ∅ |
| 001 | ∅ | ∅ | {5} |

- L(N) = {01}* ∪ {001}*; Ausdruck laut Skript: (01)*|(001)*

## 2.68 Lemma

- Zu jeder Typ-3-Grammatik G gibt es NEA N mit L(N) = L(G).

## 2.69 Konstruktion Typ-3-Grammatik → NEA

Gegeben: G = (N, T, X0, P) Typ 3.

    N = (Z, z0, X, g, F)
    Z = { z_X | X ∈ N } ∪ { z_f }     (z_f: neuer Endzustand)
    z0 = z_X0
    X = T
    F = { z_f }
    g(z_X, w) = { z_Y | X → wY ∈ P } ∪ { z_f | X → w ∈ P }

- Beweis (L(N) = L(G)): Übung.

## 2.70 Lemma (NEA → DEA, Schritte)

1. Übergänge z —w→ z' mit |w| ≥ 2 beseitigen.
2. ε-Übergänge beseitigen (F ggf. anpassen).
3. Echten Nichtdeterminismus beseitigen (|g(z,x)| ≥ 2) und Fälle g(z,x) = ∅ mit (Potenzmengenkonstruktion).

## 2.71 Schritt 1 (|w| ≥ 2)

- Für z —x1…xk→ z' mit k ≥ 2:
  - neue Zustände z1, …, z(k−1)
  - Übergang z —w→ z' streichen
  - ersetzen durch: z —x1→ z1, z1 —x2→ z2, …, z(k−1) —xk→ z'

## 2.72 Schritt 2 (ε-Übergänge entfernen)

Für jeden Übergang z —ε→ z':
- R1: Für jede Situation z —ε→ z' —a→ z'' füge z —a→ z'' hinzu.
- R2: Für jede Situation z'' —a→ z —ε→ z' füge z'' —a→ z' hinzu.
- R3: Entferne z —ε→ z'.
- Sonderfall F (vor Entfernung, Skript-Achtung): Ist z —ε→ z' und z' ∈ F, dann füge z zu F hinzu (falls nicht schon z ∈ F).
- Ohne F-Regel: falscher NEA (leeres Wort geht verloren).

## 2.73 Übungsaussagen zu 2.72

1. Vergrößerung von F nach der F-Regel ändert die akzeptierte Sprache nicht.
2. Umgekehrte Vergrößerung falsch: z ∈ F und z —ε→ z' ⇒ z' zu F hinzufügen kann die Sprache ändern.
3. Entfernen der ε-Übergänge mit R1–R3 ändert die Sprache nicht.

## 2.74 Schritt 3 (Potenzmengenkonstruktion, Beweisskizze)

Gegeben: NEA N = (Z_N, z0_N, X, g, F_N) ohne ε- und Mehrfachübergänge (nach Schritt 2).

    DEA M = (Z_M, z0_M, X, f, F_M)
    Z_M    = 2^(Z_N)                         (alle Teilmengen von Z_N)
    z0_M   = { z0_N }
    F_M    = { S ⊆ Z_N | S ∩ F_N ≠ ∅ }        (Skript: "⊂", vermutlich ⊆)
    f(S, x) = ⋃_{z ∈ S} g(z, x)

- Aus der Formel folgt: ∅ ∈ Z_M, f(∅, x) = ∅, ∅ ∉ F_M (Skript nennt ∅ nicht gesondert).
- Beweisziel: g*(S, w) = f*(S, w) für alle S ⊆ Z_N, w ∈ X* (Beweis ausgelassen).

## 2.75 Zustandszahl

- NEA mit k Zuständen → äquivalenter DEA mit 2^k Zuständen (Potenzmenge).
- Für manche Sprachen: kleinster NEA m Zustände, kleinster DEA 2^m Zustände (m beliebig groß).

## 2.76 Zusammenfassung Kreis

- DEA → regulärer Ausdruck (2.30)
- regulärer Ausdruck → Typ-3-Grammatik (2.54)
- Typ-3-Grammatik → NEA (2.69)
- NEA → DEA (2.70–2.74)

## 2.78–2.81 Erreichbarkeit

- 2.78: Unerreichbare Zustände können entfernt werden; ab jetzt: alle Zustände von z0 erreichbar.
- 2.79 Lemma: Ist f*(z, w) = z', dann gibt es w' mit f*(z, w') = z' und |w'| ≤ |Z| − 1.
- 2.81 Korollar: z von z0 erreichbar ⇔ f*(z0, w) = z für ein w ∈ ⋃_{i=0}^{|Z|−1} X^i.

## 2.82 Algorithmus (erreichbare Zustände)

    S ← {z0}
    repeat
        S' ← S
        for each (z, x) ∈ S' × X do
            S ← S ∪ {f(z, x)}
        od
    until S' = S

- Ergebnis: S = Menge der von z0 erreichbaren Zustände.

## 2.84 Definition (trennendes Wort)

- w1, w2, w Wörter mit w1 w ∈ L und w2 w ∉ L ⇒ w trennt w1 und w2 (bzgl. L).
- 2.83: Trennt w die Wörter w1, w2, dann gilt für einen DEA M für L: f*(z0, w1) ≠ f*(z0, w2).
- Beispiel 2.83: Beispiel-DEA aus 2.14 trennt 000 und 01 durch w = 0 (000·0 ∈ L, 01·0 ∉ L).

## 2.85 Behauptung

- Trennt w die Wörter w1, w2, dann trennt auch ein w' mit |w'| < |Z| (Beweis ausgelassen).

## 2.86 Definition (Äquivalenzrelation)

R ⊆ M × M heißt Äquivalenzrelation, wenn gilt:
- reflexiv: ∀x: x ≡ x
- symmetrisch: x ≡ y ⇒ y ≡ x
- transitiv: x ≡ y ∧ y ≡ z ⇒ x ≡ z

- Klasse: [x] = { y | y ≡ x }; Menge der Klassen: M/≡
- 2.88 Beispiel: "gleiche Anzahl Primfaktoren" ist Äquivalenzrelation auf ℕ.

## 2.89 Relationen ≡_i (Minimierung)

Definition:

    z ≡_i z' ⇔ für alle w ∈ A* mit |w| ≤ i gilt: f*(z, w) ∈ F ⇔ f*(z', w) ∈ F

Rekursion:

    z ≡_0 z'   ⇔ (z ∈ F ⇔ z' ∈ F)
    z ≡_(i+1) z' ⇔ z ≡_i z' ∧ für alle x ∈ X: f(z, x) ≡_i f(z', x)

- ≡_(i+1) verfeinert ≡_i (jede Klasse von ≡_i zerfällt in Klassen von ≡_(i+1)).

## 2.90 Algorithmus (Minimalautomat)

Gegeben: DEA M = (Z_M, z0_M, X, f_M, F_M).

Start:

    [z]_0 = F_M          falls z ∈ F_M
    [z]_0 = Z_M \ F_M    falls z ∉ F_M

Schleife:

    i ← 0
    repeat
        for each Paar (z, z') mit z ≡_i z' do
            z ≡_(i+1) z'  falls für alle x ∈ X: f(z, x) ≡_i f(z', x)
        od
    until ≡_(i+1) stimmt mit ≡_i überein

Ergebnis K = (Z_K, z0_K, X, f_K, F_K):
- Z_K = Menge der Klassen der zuletzt berechneten ≡_i
- z0_K = [z0_M]_i
- f_K([z]_i, x) = [f_M(z, x)]_i
- F_K = { [z]_i | z ∈ F_M }

- Minimalität von K: Beweis ausgelassen (2.91).
- Wohldefiniertheit von f_K: Übung (2.90).

## 2.92 Beispiel (vollständig)

Gegeben: M = ({A,B,C,D,E,F,G}, A, {a,b}, f, {C,D,G})

| x \ z | A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|---|
| a | B | C | D | C | E | E | G |
| b | F | E | D | D | E | G | C |

Kanten (aus Tabelle): A-a→B, A-b→F, B-a→C, B-b→E, C-a→D, C-b→D, D-a→C, D-b→D, E-a→E, E-b→E, F-a→E, F-b→G, G-a→G, G-b→C.

Runden:

- ≡0: Z/≡0 = { {C,D,G}, {A,B,E,F} }
- ≡1 (Paarprüfung, Nachfolgerpaare für a / b):

| Paar | a | b | Ergebnis |
|---|---|---|---|
| C,D | (D,C) ≡0 | (D,D) ≡0 | C ≡1 D |
| D,G | (C,G) ≡0 | (D,C) ≡0 | D ≡1 G |
| C,G | – | – | C ≡1 G (transitiv über D) |
| A,B | (B,C) ≢0 | (F,E) ≡0 | A ≢1 B |
| A,E | (B,E) ≡0 | (F,E) ≡0 | A ≡1 E |
| A,F | (B,E) ≡0 | (F,G) ≢0 | A ≢1 F |
| B,E | – | – | B ≢1 E (wegen A ≡1 E, A ≢1 B) |
| E,F | – | – | E ≢1 F (wegen A ≡1 E, A ≢1 F) |
| B,F | (C,E) ≢0 | (E,G) ≢0 | B ≢1 F |

  Z/≡1 = { {A,E}, {B}, {F}, {C,D,G} }

- ≡2:
  - {C,D,G} bleibt (alle Nachfolger in der Klasse).
  - {A,E}: a: (B,E) mit B ≢1 E ⇒ A ≢2 E.
  - Z/≡2 = { {A}, {B}, {E}, {F}, {C,D,G} }
- ≡3 = ≡2 ⇒ Abbruch.

Ergebnis (reduzierter DEA K):

- Z_K = { [A], [B], [E], [F], [CDG] }
- z0_K = [A]
- F_K = { [CDG] }

| Zustand | a | b | akzeptierend |
|---|---|---|---|
| [A] | [B] | [F] | nein |
| [B] | [CDG] | [E] | nein |
| [E] | [E] | [E] | nein |
| [F] | [E] | [CDG] | nein |
| [CDG] | [CDG] | [CDG] | ja |

## UNKLAR

- 2.33: Vereinigung über Produktautomat nicht im Skript (nur Durchschnitt, F = F1 × F2). Angefragt war "Produktautomat (Vereinigung)".
- 2.44: S = X_n, aber n ∉ N = {X0..X7} (vermutlich X0 gemeint).
- 2.52 c / 2.53 c: Konstruktion für Stern GS fehlt (Übung).
- 2.53 a: Produktion als "X → X01 | X02" geschrieben, linke Seite vermutlich XV.
- 2.54 / 2.55: Basisgrammatiken für ∅ und einzelnes Zeichen a nicht angegeben; Konstruktion RA → Typ 3 nicht ausgeführt.
- 2.58: Tupelsymbol "G" statt "g" für die Übergangsfunktion (vermutlich Tippfehler).
- 2.40 / 2.42 / 2.43: "k ∈ N" mit Induktionsanfang k = 1; ob k = 0 (Wort ε) eingeschlossen ist, bleibt offen.
- 2.30: Umsetzung der Mengen {x | f(z_i,x) = z_j} und der leeren Menge in RA-Syntax nur verbal ("leicht durch reguläre Ausdrücke beschreibbar"); kein Beispiel mit Tabelle.
- 2.72: Umgang mit Ketten von ε-Übergängen und Iteration von R1–R3 sowie der F-Regel nicht ausdrücklich geregelt.
- 2.74: F_M mit Symbol "⊂" geschrieben (gemeint wohl ⊆).
- 2.82: Fußnote 4 "An dieser Stelle sind wir ungenau" (Begriff "Symbole, die zu Schleifen gehören") nicht präzisiert.
- 2.89: Alphabet einmal A (A*), einmal X (f(z,x)) bezeichnet; Gleichheit angenommen.
- 2.90: Pseudocode erhöht i nicht (kein i ← i+1 in der Schleife); Namen "zOK" und "Fm" als Druckfehler (vermutlich z0K und F_K).
