# Skript-Notizen M5 (Skript.pdf, Kapitel 6, 6.1–6.60)

Quelle: Thomas Worsch, "Formale Sprachen und Automaten", Stand 1. November 2010.
Seiten im PDF = Skriptseiten. Umfang: 6.21–6.32 S. 76–79; 6.33–6.38 S. 80–83; 6.39–6.44 S. 84–87; 6.45–6.57 S. 88–94; 6.58–6.60 S. 94–96.
Hinweis: Beispiel 6.45 (Grammatik E/T/F) gehört zum LR-Teil (S. 88), nicht zu Earley. Earley-Beispiel ist 6.44.
Abschnitte 6.1–6.20 (Lexer) nicht enthalten.

## 6.21 Einordnung (S. 76)

- Zwei Wege zu deterministischer Syntaxanalyse: (a) Algorithmen wie CYK (6.5), Earley (6.6); (b) Teilklassen LL(k), LR(k).
- LR(k) = deterministische Bottom-up-Analyse; M5-Stoff: LR(k) mit k ≤ 1.

## 6.5.1 Chomsky-Normalform

### 6.22 Definition CNF (S. 76)

G(N, T, S, P) ist in CNF, wenn gilt:
- Jede Produktion X → w mit X ≠ S hat w ∈ N² oder w ∈ T.
- Wenn S → ε ∈ P, dann kommt S auf keiner rechten Seite vor.

### 6.23 Satz

Zu jeder kontextfreien G gibt es äquivalentes G' (L(G) = L(G')) in CNF.

### 6.24 Lemma (S. 76)

EPS(G) = {X ∈ N | X ⇒* ε} ist berechenbar.

### 6.25 Algorithmus EPS (S. 76)

```
i ← 0
M0 ← {X | X → ε ∈ P}
do
    i ← i+1
    Mi ← Mi−1 ∪ {X | ∃w ∈ Mi−1* : X → w ∈ P}
until Mi = Mi−1
return Mi
```

- ε ∈ L(G) ⇔ S ∈ EPS(G).

### 6.26 Beispiel EPS (S. 76)

G = ({X, Y, Z}, {a}, X, P), P = {X → YZ, Y → ZZ, Z → a | ε}

| Schritt | Menge |
|---|---|
| M0 | {Z} |
| M1 | {Z, Y} (wegen Y → ZZ) |
| M2 | {Z, Y, X} (wegen X → YZ) |
| M3 | {Z, Y, X} (keine Änderung) |

EPS(G) = {X, Y, Z}

### 6.27 Lemma (S. 77)

Zu G = (N, T, S, P) gibt es G' = (N, T, S, P') mit:
- L(G') = L(G) \ {ε}
- keine Produktion von G' hat ε als rechte Seite.

### 6.28 Konstruktion P' (S. 77)

P' enthält X → w' genau dann, wenn w' ≠ ε und es X → w ∈ P gibt, sodass w' aus w entsteht durch Streichen einiger Vorkommen von Symbolen aus EPS(G).

### 6.29 Lemma (S. 77)

Zu G gibt es äquivalentes Ḡ = (N, T, S̄, P̄) mit:
- ε ∉ L(G): Ḡ hat keine Produktion mit rechter Seite ε.
- ε ∈ L(G): S̄ → ε ist die einzige ε-Produktion von Ḡ, und S̄ kommt auf keiner rechten Seite vor.

### 6.30 Beweisskizze (S. 78)

- ε ∉ L(G): Ḡ = G'.
- ε ∈ L(G): neues Startsymbol S̄, P̄ = P' ∪ {S̄ → ε, S̄ → S'}.

## 6.31 Beweis Satz 6.23: Vier Schritte (S. 78)

Ausgangsgrammatik G0 = (N0, T, S, P0).

| Schritt | Grammatik | Konstruktion |
|---|---|---|
| 1 | G1 | Neue Nichtterminale Za für a ∈ T: N1 = N0 ∪ {Za}; P1 = {Za → a} ∪ (P0 mit jedem a durch Za ersetzt) |
| 2 | G2 | G1 nach Lemma 6.29 (ε-Produktionen entfernen). Danach nur noch X → a oder X → Y1…Yk (k ≥ 1), evtl. S → ε |
| 3 | G3 | M(X) = {X' | X ⇒* X'}; Algorithmus: M0(X) = {X}; Mi(X) = Mi−1(X) ∪ {X' | ∃Y ∈ Mi−1(X): Y → X' ∈ P}. P3: alle X → X'-Produktionen streichen; für jede verbleibende X' → Y1…Yk und jedes X mit X' ∈ M(X) füge X → Y1'…Yk' hinzu, wenn Yi' ∈ M(Yi) für alle i |
| 4 | G4 | Jede X → Y1…Yk mit k ≥ 3 ersetzen durch X → Y1 V1, V1 → Y2 V2, …, Vk−1 → Yk−1 Yk (neue Vi) |

Ergebnis: G4 in CNF.

## 6.32 Beispiel CNF (S. 79)

Ausgangsgrammatik: Startsymbol E
- E → E+F | F
- F → (E) | a

### Schritt 1

- E → E Z+ F | F
- F → Z( E Z) | Za
- Z+ → +
- Za → a
- Z( → (
- Z) → )

Schritt 2: keine ε-Produktionen, keine Änderung.

### Schritt 3: Mengen M_i(X)

| X | M0 | M1 | M2 | M3 |
|---|---|---|---|---|
| E | {E} | {E, F} | {E, F, Za} | {E, F, Za} |
| F | {F} | {F, Za} | {F, Za} | {F, Za} |

- Entfernt: E → F, F → Za.
- Neu aus E → E Z+ F: E → E Z+ F | F Z+ F | Za Z+ F | E Z+ Za | F Z+ Za | Za Z+ Za
- Neu aus F → Z( E Z): F → Z( E Z) | Z( F Z) | Z( Za Z)
- Neu (E → Z(EZ)-Familie): E → Z( E Z) | Z( F Z) | Z( Za Z)

### Schritt 4 (vollständig, nach Algorithmus)

Jede Produktion mit 3 Nichtterminalen aufteilen; neue Vi (V1…V24 laut Skript).

### Schritt 4 (sparsam, Skript-Vorschlag)

| Produktionen | |
|---|---|
| E → E V1 \| F V1 \| Za V1 | V1 → Z+ F |
| E → E V2 \| F V2 \| Za V2 | V2 → Z+ Za |
| E → Z( V3 \| Z( V4 \| Z( V5 | V3 → E Z) |
| F → Z( V3 \| Z( V4 \| Z( V5 | V4 → F Z) |
| | V5 → Za Z) |

UNKLAR: 6.32 Schritt 3 überträgt die Terminalproduktion Za → a nicht auf E bzw. F (Produktionen E → a / F → a fehlen in der CNF). Damit erzeugt die angegebene CNF das Wort "a" nicht, obwohl a ∈ L(G). Das Skript sagt dazu nichts. Die Beispiele 6.35/6.38 verwenden genau diese CNF.

## 6.5.2 CYK

### 6.33 Vorbemerkung (S. 80)

- CYK: G in CNF, w ∈ T*, deterministisch.
- Trennstellen 0 … n vor/nach den Symbolen: |x1|x2|…|xn|, Trennstellen 0 bis n.
- w(i, j] = x_{i+1} … x_j für 0 ≤ i < j ≤ n. w(i, i] = ε.
- |w(i, j]| = j − i; w(i, m] w(m, j] = w(i, j] für i ≤ m ≤ j.

### 6.34 Algorithmus CYK, Indizierung (S. 80)

- D[i, j] für 0 ≤ i < j ≤ n ist Teilmenge von N.
- **Indizierung: D[i, j] = Teilwort von Trennstelle i bis Trennstelle j, also w(i, j] = x_{i+1}…x_j, Länge j − i.** (Nicht "ab i der Länge j".)
- Zielzustand: D[i, j] = {X | X ⇒* w(i, j]}.
- x1…xn ∈ L(G) ⇔ S ∈ D[0, n].

Pyramide Abbildung 6.1 (n = 5), Schichten von unten (Länge 1) nach oben (Länge 5):

| Schicht (Länge j−i) | Einträge |
|---|---|
| 1 | D[0,1] D[1,2] D[2,3] D[3,4] D[4,5] |
| 2 | D[0,2] D[1,3] D[2,4] D[3,5] |
| 3 | D[0,3] D[1,4] D[2,5] |
| 4 | D[0,4] D[1,5] |
| 5 | D[0,5] |

### 6.34 Algorithmus (zeilenweise, S. 81)

```
for i ← 0 to n−1 do
    D[i, i+1] = {X | X → x_{i+1} ∈ P}
od
for k ← 2 to n do
    for i ← 0 to n−k do
        D[i, i+k] ← ∅
        for m ← i+1 to i+k−1 do
            if ∃ X → YZ ∈ P mit (Y ∈ D[i, m] ∧ Z ∈ D[m, i+k])
            then D[i, i+k] ← D[i, i+k] ∪ {X}
        od
    od
od
```

- Laufzeit Θ(n³).

### 6.35 Beispiel CYK (S. 81)

Grammatik: CNF aus 6.32 (sparsam). Eingabe (a+a), n = 5, x1…x5 = ( a + a ).

Pyramide Abbildung 6.2 (Inhalt, Index D[i, j]):

| Zelle | Menge |
|---|---|
| D[0,1] | {Z(} |
| D[1,2] | {Za} |
| D[2,3] | {Z+} |
| D[3,4] | {Za} |
| D[4,5] | {Z)} |
| D[1,4] | {E} |
| D[2,4] | {V2} |
| D[3,5] | {V5} |
| D[1,5] | {V3} |
| D[0,5] | {E, F} (laut Abb. 6.2, siehe UNKLAR) |

Alle übrigen D[i, j] = ∅.

Begründung im Text: D[1,5] = {V3} über V3 → E Z) mit m = 4, D[1,4] = {E}, D[4,5] = {Z)}.

UNKLAR: Abb. 6.2 zeigt D[0,5] = {E, F}. Die Markierungsdarstellung Abb. 6.5/6.6 zeigt für D[0,5] nur E (Item E → |0 Z( V3 •). Nach der Sparsam-CNF ist F → Z( V3 mit D[0,1] = {Z(} und D[1,5] = {V3} ableitbar, also F ∈ D[0,5] nach Algorithmus 6.34. Die Darstellung 6.5/6.6 ist daher vermutlich unvollständig. Welche Menge gilt, ist nicht eindeutig.

### 6.36 Spaltenweise Variante (S. 82)

```
for j ← 1 to n do
    D[j−1, j] ← {X | X → x_j ∈ P}
    for i ← j−1 downto 0 do
        D[i, j] ← ∅
        for m ← i+1 to j do
            if ∃ X → YZ ∈ P mit (Y ∈ D[i, m] ∧ Z ∈ D[m, j])
            then D[i, j] ← D[i, j] ∪ {X}
        od
    od
od
```

Reihenfolge: Spalte für Spalte von links nach rechts, innerhalb jeder Spalte von unten nach oben.

### 6.37 Spaltenmengen

- S_j = Vereinigung aller D[i, j] für 0 ≤ i ≤ j−1; S0 = ∅ (leer, zusätzlich hinzugefügt).
- Abbildung 6.4: S_j enthält D[0,j] … D[j−1,j].

### 6.38 Beispiel markierte Darstellung (S. 82–84)

Markierte Produktion: X → |i v1 • v2 in S_j mit Trennstelle i (links) und j = Index von S_j. Der Punkt steht nach dem bereits verarbeiteten Präfix.

Abbildung 6.6 (Zelle S_j, Eintrag = D[i, j]):

| Menge | Eintrag |
|---|---|
| S1 | Z( → |0 ( • 1 (als Z( → (• in D[0,1]) |
| S2 | Za → |1 a • 2 |
| S3 | Z+ → |2 + • 3 |
| S4 | Za → |3 a • 4 ; E → |1 Za V2 • 4 ; V2 → |2 Z+ Za • 4 |
| S5 | Z) → |4 ) • 5 ; V5 → |3 Za Z) • 5 ; V3 → |1 E Z) • 5 ; E → |0 Z( V3 • 5 |

Zuordnung zu D[i, j]:

| Produktion (markiert) | Zelle | Menge |
|---|---|---|
| Z( → ( • | D[0,1] | {Z(} |
| Za → a • | D[1,2] | {Za} |
| Z+ → + • | D[2,3] | {Z+} |
| Za → a • | D[3,4] | {Za} |
| Z) → ) • | D[4,5] | {Z)} |
| E → Za V2 • | D[1,4] | {E} |
| V2 → Z+ Za • | D[2,4] | {V2} |
| V5 → Za Z) • | D[3,5] | {V5} |
| V3 → E Z) • | D[1,5] | {V3} |
| E → Z( V3 • | D[0,5] | {E} (laut Abb. 6.5/6.6) |

Regel (Skript 6.40): X → |i YZ • in S_j, wenn ∃ m: Y → |i v • in S_m und Z → |m v' • in S_j.

## 6.6 Algorithmus von Earley

### 6.39 / 6.40 (S. 84)

- Mengen S0 … Sn mit Items: Produktionen mit Markierungspunkt • und Trennstelle.
- Regel bei CYK (Markierung immer am Ende) wird verallgemeinert.

### 6.41 Definition Item (S. 84)

- Form: X →_i v1 • v2, wobei X → v1 v2 ∈ P und i ≤ j (Item gehört zu S_j, j ≥ i).
- Form X →_i • w ist erlaubt.

### 6.43 Regeln (S. 85)

| Regel | Voraussetzung | Ergebnis |
|---|---|---|
| Lexer | X →_i v1 • a v2 ∈ S_j und a = w(j, j+1] | X →_i v1 a • v2 ∈ S_{j+1} |
| Completer | X →_i v1 • Y v2 ∈ S_m und Y →_m v • ∈ S_j (j > m) | X →_i v1 Y • v2 ∈ S_j |
| Predictor | X →_i v1 • Y v2 ∈ S_j und Y → v ∈ P | Y →_j • v ∈ S_j |

Algorithmus (6.43):
1. S0 = {S →_0 • w | S → w ∈ P}.
2. Auf jedes S_j Regeln Lexer, Completer, Predictor anwenden bis keine Änderung; dann S_{j+1}.
3. Ist ein S_j = ∅: nicht ableitbar.
4. Akzeptanz: S →_0 w • ∈ S_n.

(Variante ohne Look-ahead.)

### 6.44 Beispiel Earley (S. 86–87)

G: N = {S, X, A, B, C}, T = {a, b, c}, Startsymbol S, P = {S → AX, X → BC, A → a, B → b, C → c}. Eingabe abc, n = 3.

| Menge | Items (Trennstelle links unten) |
|---|---|
| S0 | S →_0 • AX ; A →_0 • a |
| S1 | S →_0 A • X ; X →_1 • BC ; B →_1 • b ; A →_0 a • |
| S2 | X →_1 B • C ; C →_2 • c ; B →_1 b • |
| S3 | S →_0 AX • ; X →_1 BC • ; C →_2 c • |

Regelzuordnung (aus Algorithmus abgeleitet, Pfeile in Abb. 6.8 nicht geprüft):

| Item | Menge | Regel | Quelle |
|---|---|---|---|
| S →_0 • AX | S0 | Start | 6.43 Schritt 1 |
| A →_0 • a | S0 | Predictor | aus S →_0 • AX |
| A →_0 a • | S1 | Lexer | a = w(0,1] |
| S →_0 A • X | S1 | Completer | mit A →_0 a • (S1) und S →_0 • AX (S0) |
| X →_1 • BC | S1 | Predictor | aus S →_0 A • X |
| B →_1 • b | S1 | Predictor | aus X →_1 • BC |
| B →_1 b • | S2 | Lexer | b = w(1,2] |
| X →_1 B • C | S2 | Completer | mit B →_1 b • (S2) und X →_1 • BC (S1) |
| C →_2 • c | S2 | Predictor | aus X →_1 B • C |
| C →_2 c • | S3 | Lexer | c = w(2,3] |
| X →_1 BC • | S3 | Completer | mit C →_2 c • (S3) und X →_1 B • C (S2) |
| S →_0 AX • | S3 | Completer | mit X →_1 BC • (S3) und S →_0 A • X (S1) |

Ergebnis: S →_0 AX • ∈ S3, also abc ∈ L(G).

## 6.7 LR Parsing (S. 88–94)

### 6.45 Beispiel Grammatik (S. 88)

G: E → E+T | T ; T → T*F | F ; F → (E) | a ; Startsymbol E. Terminale: * + ( ) a. NT: E, T, F.

### 6.46 Vereinbarung (S. 88)

- Ergänzte Grammatik: neues Startsymbol S' mit genau einer Produktion S' → ⊣ S ⊢ (⊣ = a unten im Symbolkeller, ⊢ = Eingabeende; Skript schreibt ` für ⊢).
- Ergänzte Grammatik 6.45:

| Produktion | Nummer |
|---|---|
| E' → ⊣ E ⊢ | E0 |
| E → E+T | R1 |
| E → T | R2 |
| T → T*F | R3 |
| T → F | R4 |
| F → (E) | R5 |
| F → a | R6 |

### 6.47 Definition LR(k) (S. 88)

G hat LR(k), wenn für zwei Rechtsableitungen
- S' ⇒r* ξ1 A1 ω η1 ⇒r ξ1 γ1 ω η1 ⇒r* α ω η1 (α ∈ T*)
- S' ⇒r* ξ2 A2 τ2 ⇒r ξ1 γ1 ω η2 ⇒r* α ω η2 (α ∈ T*)

mit |ω| = k oder η1 = η2 = ε gilt: ξ2 A2 τ2 = ξ1 A1 ω η2.

### 6.48 (S. 88)

- L steht für Lesen von links, R für Rechtsableitung.
- Skript betrachtet k ≤ 1.
- LR(k) für gegebenes k entscheidbar; "für irgendein k" nicht entscheidbar.

### 6.49 Prinzip (S. 89)

- Funktion act(κ, ω) = nächste Aktion für Kellerinhalt κ und Eingabe-Bruchstück ω.
- Äquivalenzklassen von Kellerinhalten = Zustände; z(κ) = Zustand von κ.
- Endlich viele Zustände; act(z(κ), ω).
- goto(z(κ), X) = z(κX).

Modifizierter Kellerautomat: zweiter Keller für Zustände; Zustandskeller hat Höhe gleich Symbolkeller; i-tes Element z = z(κ) mit κ = untere i Symbole.

| Aktion | Symbolkeller | Zustandskeller |
|---|---|---|
| shift a | κ → κ a | z → z, goto(z, a) |
| reduce A → γ (κ = ξγ) | ξγ → ξA | z'' z_1…z_|γ| → z'' goto(z'', A) |
| accept | — | — |
| error | — | — |

- Start: Symbolkeller ⊣ (unten), Zustand z(⊣) = z0.
- Ende: Symbolkeller ⊣ S ⊢ und Reduktion nach S' (oder ⊣ S, ⊢ als Eingabe).

### 6.50 Beispiel act/goto (S. 90–91, Originaltabelle)

act(z, ω) (Spalten ω = a + * ( ) ⊢) und goto(z, X) (Spalten X = a + * ( ) E T F):

| z | κ | a | + | * | ( | ) | ⊢ | goto a | + | * | ( | ) | E | T | F |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | ⊣ | S | | | S | | | 11 | | | 9 | | 1 | 5 | 8 |
| 1 | ⊣ E | | S | | | | A | | 3 | | | 10 (UNKLAR) | | | |
| 2 | ···(E | | S | | | S | | | 3 | | | | | | |
| 3 | ···E+ | S | | | S | | | 11 | | | 9 | | | 4 | 8 |
| 4 | ···E+T | | R1 | S | | R1 | R1 | | | 6 | | | | | |
| 5 | ⊣T,···(T | | R2 | S | | R2 | R2 | | | 6 | | | | | |
| 6 | ···T* | S | | | S | | | 11 | | | 9 | | | | 7 |
| 7 | ···T*F | | R3 | R3 | | R3 | R3 | | | | | | | | |
| 8 | ···+F, ···(F, ⊣F | | R4 | R4 | | R4 | R4 | | | | | | | | |
| 9 | ···( | S | | | S | | | 11 | | | 9 | | 2 | 5 | 8 |
| 10 | ···(E) | | R5 | R5 | | R5 | R5 | | | | | | | | |
| 11 | ···a | | R6 | R6 | | R6 | R6 | | | | | | | | |

- S = shift, Ri = reduce mit Produktion Ri, A = accept, leer = error.
- |ω| = 1 genügt (Spalten mit einzelnen Symbolen).

UNKLAR: Zeile z1, Spalte ")" steht Goto-Eintrag 10. Da act(1, ")") leer ist, vermutlich gemeint: z2 / ")" → 10 (Verschiebung nach (E)). Im Bild ist die 10 in Zeile z1 eingetragen.

UNKLAR: Die Zustandsnummern in Tabelle 6.50 sind nicht die von 6.53/6.55. Beispiel: 6.50 z2 = ···(E, 6.53 z2 = z(aT); 6.50 goto(0, F) = 8, 6.55 goto(z0, F) = z3; 6.50 goto(0, a) = 11, 6.55 goto(z0, a) = z4. Tabelle 6.1 verwendet die Nummern aus 6.50.

### 6.51 Definition LR(0)-Items (S. 91)

Zu A → X1 … Xk = γ: I(A → γ) = {A → •X1…Xk, A → X1•X2…Xk, …, A → X1…Xk•}.
Zu A → ε: genau ein Item A → •.

Notation im Skript: A → µ • ν mit µν = rechte Seite.

### 6.52 Zustände (S. 91–92)

z(κ) = Menge aller A → µ • ν mit:
- A → µν ∈ P,
- κ = ξµ,
- S' ⇒r* ξ A η für ein η ∈ T*.

kompl(M) (Vervollständigung, Predictor-Regel):
- (i) M ⊆ kompl(M)
- (ii) A → µ • B ν ∈ kompl(M) und B → γ ∈ P ⇒ B → • γ ∈ kompl(M)
- (iii) (ii) iterieren bis keine Änderung.

Konstruktion:
- M0 = {S' → ⊣ • S ⊢} ⊆ z(⊣)
- Zu jeder Menge M: z = kompl(M).
- Aus z(κ): Kern z(κX) = {A → µX • ν | A → µ • X ν ∈ z(κ)}, dann kompl.

### 6.53 Beispielzustände (S. 92–93)

Kürzel: Das Skript schreibt für ⊣ den Buchstaben a und für ⊢ das Zeichen `; hier ⊣ und ⊢ gesetzt.

| Zustand | Inhalt (markierte Produktionen) |
|---|---|
| z0 = z(⊣) | S' → ⊣ • E ⊢; E → •E+T; E → •T; T → •T*F; T → •F; F → •(E); F → •a |
| z1 = z(⊣E) | S' → ⊣E • ⊢; E → E • +T |
| z2 = z(⊣T) | E → T • ; T → T • *F |
| z3 = z(⊣F) | T → F • |
| z4 = z(⊣a) | F → a • |
| z5 = z(⊣() | F → (• E) ; E → •E+T; E → •T; T → •T*F; T → •F; F → •(E); F → •a |
| z6 = z(⊣)) = ∅ | Fehlerzustand |
| z7 = z(⊣E+) | E → E+ • T; T → •T*F; T → •F; F → •(E); F → •a |
| z8 = z(⊣E⊢) | S' → ⊣E⊢ • (akzeptierend) |
| z9 = z(⊣T*) | T → T* • F; F → •(E); F → •a |
| z10 = z(⊣(E) | F → (E • ) ; E → E • +T |
| z11 = z(⊣E+T) | E → E+T • ; T → T • *F |
| z12 = z(⊣T*F) | T → T*F • |
| z13 = z(⊣(E)) | F → (E) • |

Hinweis: Im Skript steht bei z10 "z(⊣(E)" (Präfix-Klammer nicht vollständig gesetzt). Interpretation: ⊣ ( E.

UNKLAR: z8 ist laut Text "akzeptierend (aus z1 durch Fortschreibung)". Die Kerngleichung gibt S' → ⊣E • ⊢ in z1, daraus S' → ⊣E⊢ • in z8. Konsistent, kein Konflikt.

### 6.54 goto-Formel (S. 94)

z(κX) = kompl({A → µX • ν | A → µ • X ν ∈ z(κ)}); definiert goto(z(κ), X).

### 6.55 goto-Tabelle (S. 94)

| z | E | T | F | a | ( | ) | + | * | ⊢ |
|---|---|---|---|---|---|---|---|---|---|
| z0 | z1 | z2 | z3 | z4 | z5 | z6 | z6 | z6 | z6 |
| z1 | z6 | z6 | z6 | z6 | z6 | z6 | z7 | z6 | z8 |
| z2 | z6 | z6 | z6 | z6 | z6 | z6 | z6 | z9 | z6 |
| z3 | z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 |
| z4 | z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 |
| z5 | z10 | z2 | z3 | z4 | z5 | z6 | z6 | z6 | z6 |
| z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 |
| z7 | z6 | z11 | z3 | z4 | z5 | z6 | z6 | z6 | z6 |
| z8 | (leer) | | | | | | | | |
| z9 | z6 | z6 | z12 | z4 | z5 | z6 | z6 | z6 | z6 |
| z10 | z6 | z6 | z6 | z6 | z6 | z13 | z7 | z6 | z6 |
| z11 | z6 | z6 | z6 | z6 | z6 | z6 | z6 | z9 | z6 |
| z12 | z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 |
| z13 | z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 |

### 6.56 Funktion f (S. 94)

Look-ahead-Mengen la(z, A → µ • ν) und la(z, shift), disjunkt je z.

f(z, a) =
- reduce A → γ, falls a ∈ la(z, A → µ •)
- shift, falls a ∈ la(z, shift)
- accept, falls z = z(⊣S⊢•) (oder ⊣S•⊢ ∈ z und a = ⊢)
- error, sonst

UNKLAR: Das Skript gibt keine Konstruktion für la(z, shift) und keine Startwerte für la(z, A → µ •) an; "wir beschränken uns auf folgende Mitteilung" (6.56).

### 6.57 Definition LALR(1) (S. 94)

Grammatik ist LALR(1), wenn für jedes z die la-Mengen paarweise disjunkt sind. Bedingungen:
- la(z, S' → ⊣ • S ⊢) = ∅
- a ∈ la(z, A → µ • B ν) ∧ b ∈ anf(ν a) ⇒ b ∈ la(z, B → • γ)
- a ∈ la(z, A → µ • X ν) ⇒ a ∈ la(goto(z, X), A → µX • ν)

UNKLAR: Die drei Bedingungen beschreiben nur Eigenschaften (Propagation), keine explizite Berechnung; Startmengen für Reduktionsitems fehlen.

### 6.53/6.56 Lauf (Tabelle 6.1, S. 92): Eingabe (a+a)*a ⊢

Spalten: Zustandskeller | Symbolkeller | Eingabe ω | Rest η. Zustandsnummern nach Tabelle 6.50.

| Nr | Zustandskeller | Symbolkeller | ω |
|---|---|---|---|
| 1 | 0 | ⊣ | ( a + a ) * a ⊢ |
| 2 | 0 9 | ⊣ ( | a + a ) * a ⊢ |
| 3 | 0 9 11 | ⊣ ( a | + a ) * a ⊢ |
| 4 | 0 9 8 | ⊣ ( F | + a ) * a ⊢ |
| 5 | 0 9 5 | ⊣ ( T | + a ) * a ⊢ |
| 6 | 0 9 2 | ⊣ ( E | + a ) * a ⊢ |
| 7 | 0 9 2 3 | ⊣ ( E + | a ) * a ⊢ |
| 8 | 0 9 2 3 11 | ⊣ ( E + a | ) * a ⊢ |
| 9 | 0 9 2 3 8 | ⊣ ( E + F | ) * a ⊢ |
| 10 | 0 9 2 3 4 | ⊣ ( E + T | ) * a ⊢ |
| 11 | 0 9 2 | ⊣ ( E | ) * a ⊢ |
| 12 | 0 9 2 10 | ⊣ ( E ) | * a ⊢ |
| 13 | 0 8 | ⊣ F | * a ⊢ |
| 14 | 0 5 | ⊣ T | * a ⊢ |
| 15 | 0 5 6 | ⊣ T * | a ⊢ |
| 16 | 0 5 6 11 | ⊣ T * a | ⊢ |
| 17 | 0 5 6 7 | ⊣ T * F | ⊢ |
| 18 | 0 5 | ⊣ T | ⊢ |
| 19 | 0 1 | ⊣ E | ⊢ (Akzeptieren) |

Aktionsfolge (aus Tabelle 6.1 abgelesen): Zeile 1→2 S, 2→3 S, 3→4 R6 (F→a), 4→5 R4 (T→F), 5→6 R2 (E→T), 6→7 S, 7→8 S, 8→9 R6, 9→10 R4, 10→11 R1 (E→E+T), 11→12 S, 12→13 R5 (F→(E)), 13→14 R4, 14→15 S, 15→16 S, 16→17 R6, 17→18 R3 (T→T*F), 18→19 R2, dann accept.

Hinweis: Die Aktionsfolge ist aus den Zustandswechseln abgeleitet; im Skript ist sie nicht explizit angegeben.

## 6.8 Nach der Syntaxanalyse (S. 94–96)

### 6.58 (S. 94)

Nach Syntaxanalyse: semantische Analyse, Zwischencode, Optimierung, Maschinencode.

### 6.59 Grammatik mit semantischen Aktionen (S. 95)

Produktion: A → {code0} X1 {code1} X2 … Xm {codem}.
- Codefragment am Ende: nach Reduktion nach der Produktion.
- Andere Codefragmente: über neue Nichtterminale M0 … Mm−1 mit Mi → ε {codei}.

### 6.60 Beispiel (S. 95–96)

| Produktion | Aktion |
|---|---|
| E → E+T | printf("Reduktion mit E -> E+T \n") |
| E → T | printf("Reduktion mit E -> T \n") |
| T → T*F | printf("Reduktion mit T -> T*F \n") |
| T → F | printf("Reduktion mit T -> F \n") |
| F → (E) | printf("Reduktion mit F -> (E) \n") |
| F → a | printf("Reduktion mit F -> a \n") |

## UNKLAR-Liste (Zusammenfassung)

1. 6.32 CNF Schritt 3: Terminalproduktion Za → a wird nicht auf E/F übertragen; "a" ist danach nicht ableitbar.
2. Abb. 6.2 D[0,5] = {E, F} vs. Abb. 6.5/6.6 und Text: nur E.
3. Tabelle 6.50: Goto-Eintrag 10 in Zeile z1, Spalte ")" (act leer).
4. Zustandsnummern Tabelle 6.50 ≠ Zustände 6.53/6.55 (verschiedene Nummerierung).
5. 6.56/6.57: la(z, shift) und Startmengen der la-Mengen nicht konstruiert.
6. 6.44: Pfeilzuordnung Abb. 6.8 nicht gegen Bild geprüft (Regeln aus Algorithmus abgeleitet).
7. 6.45 ist LR-Beispiel (nicht Earley).
