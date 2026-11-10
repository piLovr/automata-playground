# 2.9 Ausgabe von Mealy- und Moore-Automaten

Quelle: Skript S. 9–10.

- Mealy-Automat: M = (Z, z0, X, f, Y, g), g : Z × X → Y
- Moore-Automat: M = (Z, z0, X, f, Y, g), g : Z → Y
- Ausgabe für ganzes Eingabewort w (g*, g**, Ausgabewort): nicht definiert. Skript sagt nur, man könne f*(z0, w) oder f**(z0, w) als Ausgabe betrachten, "üblicherweise" gehe man aber den Weg über g (S. 10).
- Beispiel 2.10 (Moore, g(B) = 1, sonst 0): "liefert ... als letzte Ausgabe eine 1". Keine Formel für die Ausgabefolge.
- Moore-Ausgabelänge (|w| oder |w|+1): UNKLAR. Im Skript nicht definiert.
  - Hinweis, nicht die Ausgabe betreffend: Beispiel 2.6 zeigt |f**(z, w)| = 1 + |w| (f** enthält z0 als erstes Element, Definition 2.4).
- Akzeptor (2.12, 2.13): L(M) = {w ∈ X* | f*(z0, w) ∈ F}

# 4.3 bis 4.5 Kellerautomaten

## 4.3 NKA: Tupel

Skript-Liste (Reihenfolge wie im Skript): Z, z0, Y, y0, X, f, F.

| Komponente | Bedeutung |
|---|---|
| Z | endliche Zustandsmenge |
| z0 ∈ Z | Anfangszustand |
| Y | Kelleralphabet |
| y0 ∈ Y | Anfangskellersymbol |
| X | Eingabealphabet |
| f : Z × Y × (X ∪ {ε}) → 2^(Z × Y*) | Überführungsfunktion |
| F ⊆ Z | akzeptierende Zustände |

- Definitionsbereich von f: Z × Y × (X ∪ {ε})
- Wertebereich von f: Potenzmenge von Z × Y*
- f(z, y, ε): Aktion ohne Eingabesymbol, Menge von (z', v)
- f(z, y, x): Aktion mit Eingabesymbol x, Menge von (z', v)
- (z', v) ∈ Z × Y*: v ist oberstes Symbol zuerst, ersetzt das entfernte y
- Bedingung: Wird y0 entfernt, muss v mit y0 beginnen.

## 4.4 DKA: Bedingungen

- Bei gegebenen z, y: entweder f(z, y, ε) = ∅ oder für alle x ∈ X gilt f(z, y, x) = ∅.
- Ist f(z, y, ε) = ∅: f(z, y, x) enthält für alle x ∈ X genau eine Aktion (z', v).
- Ist f(z, y, ε) ≠ ∅: f(z, y, ε) enthält genau eine Aktion (z', v).

## 4.5 Akzeptanz

- Startkonfiguration: Eingabewort w, Keller enthält nur y0, Zustand z0.
- Akzeptiert, wenn nach einigen Schritten alle Eingabesymbole gelesen sind und die Steuereinheit in einem Zustand aus F ist.
- Bedingung zum Kellerinhalt bei Akzeptanz: nicht genannt.

## Konfiguration und Schrittrelation

- Keine formale Definition für Konfiguration und Schrittrelation im Skript.
- Informelle Notation (S. 47), zwei aufeinanderfolgende Zeilen:
  - (gelesene Eingabe w, Zustand z, Keller yv) → (wx, z', v'v), wenn x gelesen wird
  - (w, z, yv) → (w, z', v'v), wenn kein Eingabesymbol gelesen wird
- Schrittrelation formal: UNKLAR

## 4.6 Beispiel: Kellerautomat für 0^k 1^k

Sprache: {0^k 1^k}, Skript S. 47.

- Z = {z0, z1, z+, z−}
- z0 (Anfangszustand)
- X = {0, 1}
- Y = {*, 0} (Kelleralphabet)
- y0 = * (Anfangskellersymbol)
- F = {z+}

Übergänge (Format z, y, x → z', v; x = ε wenn kein Eingabesymbol gelesen wird):

| # | z | y | x | → z' | v |
|---|---|---|---|---|---|
| 1 | z0 | * | 0 | z0 | 0* |
| 2 | z0 | 0 | 0 | z0 | 00 |
| 3 | z0 | 0 | 1 | z1 | ε |
| 4 | z1 | 0 | 1 | z1 | ε |
| 5 | z1 | * | ε | z+ | * |
| – | z | y | ε | z− | y |

- Anzahl Übergänge: 5 explizit, plus 1 Standardregel "in allen anderen Fällen" (z, y, ε → z−, y)

Verlaufstabelle für Eingabe 00001111 (Skript S. 47):

| # | gelesene Eingabe | neuer Zustand | neuer Kellerinhalt |
|---|---|---|---|
| 0 | (leer) | z0 | * |
| 1 | 0 | z0 | 0* |
| 2 | 00 | z0 | 00* |
| 3 | 000 | z0 | 000* |
| 4 | 0000 | z0 | 0000* |
| 5 | 00001 | z1 | 000* |
| 6 | 000011 | z1 | 00* |
| 7 | 0000111 | z1 | 0* |
| 8 | 00001111 | z1 | * |
| 9 | 00001111 | z+ | * |

- Anzahl Zeilen: 10 (inklusive Startzeile 0)

## 4.7 und 4.8

- Spiegelbild wR: εR = ε, (xw)R = wR x (Definition 4.7).
- Palindrome gerader Länge: Form wwR (4.8, nur Aufgabenstellung).

## 4.9 Beispiel: Palindrome gerader Länge

Sprache: Lpal = {wwR | w ∈ {a, b}*}, Skript S. 48.

- Z = {zin, zout, z−, z+}
- z0 = zin
- X = {a, b}
- Y: nicht explizit angegeben. Aus den Übergängen abgeleitet: {*, a, b}
- y0 = *: aus den Übergängen abgeleitet, nicht explizit angegeben
- F = {z+}

Übergänge (Format z, y, x → z', v; ohne Angabe Standardregel):

| # | z | y | x | → z' | v |
|---|---|---|---|---|---|
| 1 | zin | * | a | zin | a* |
| 2 | zin | * | b | zin | b* |
| 3 | zin | a | a | zin | aa |
| 4 | zin | a | b | zin | ba |
| 5 | zin | b | a | zin | ab |
| 6 | zin | b | b | zin | bb |
| 7 | zin | a | ε | zout | a |
| 8 | zin | b | ε | zout | b |
| 9 | zout | a | a | zout | ε |
| 10 | zout | a | b | z− | ε |
| 11 | zout | b | a | z− | ε |
| 12 | zout | b | b | zout | ε |
| 13 | zout | * | ε | z+ | * |
| – | z | y | ε | z | y |

- Anzahl Übergänge: 13 explizit, plus 1 Standardregel "in allen anderen Fällen" (z, y, ε → z, y)

Verlaufstabelle für Eingabe abaaaaba (Skript S. 48, Zustand und Kellerinhalt aus den Übergängen nachgerechnet):

| # | gelesen | Zustand | Kellerinhalt (oben links) |
|---|---|---|---|
| 0 | (leer) | zin | * |
| 1 | a | zin | a* |
| 2 | b | zin | ba* |
| 3 | a | zin | aba* |
| 4 | a | zin | aaba* |
| 5 | ε | zout | aaba* |
| 6 | a | zout | aba* |
| 7 | a | zout | ba* |
| 8 | b | zout | a* |
| 9 | a | zout | * |
| 10 | ε | z+ | * |

# 5.6 bis 5.12 Turingmaschinen

## 5.6 und 5.7 Definition

Tupel (Skript S. 58):

| Komponente | Bedeutung |
|---|---|
| Z | endliche Zustandsmenge |
| z0 ∈ Z | Anfangszustand |
| Y | Bandalphabet |
| □ ∈ Y | Blanksymbol |
| X ⊆ Y | Eingabealphabet |
| F+ ⊆ Z | nichtleere Menge akzeptierender Endzustände |
| F− ⊆ Z \ F+ | nichtleere Menge ablehnender Endzustände |
| f : Z × Y → Z × Y × {−1, 0, 1} | Überführungsfunktion |

- Für z ∈ F+ ∪ F− und alle y ∈ Y: f(z, y) = (z, y, 0). Die TM hält an.
- f(z, y) = (z', y', d): Zustand z', schreibt y', Kopf bewegt sich d Felder nach rechts (d = −1 links, 0 keine Bewegung, +1 rechts).
- Startkonfiguration: Eingabe w auf |w| Feldern, übrige Felder □, Kopf auf erstem Symbol von w, Zustand z0.
- Akzeptiert: TM erreicht Zustand aus F+.
- Abgelehnt: TM erreicht Zustand aus F−.
- Sonst arbeitet die TM weiter.
- Erkannte Sprache: alle w ∈ X*, bei denen die TM irgendwann in F+ landet.
- Konfigurationsschreibweise und Schrittrelation: nicht im Skript formal definiert. Nur Abbildung 5.2 (siehe unten). UNKLAR.

## 5.8 bis 5.10

- Band formal zweiseitig unendlich (5.8).
- 5.10 rekursiv: TM hält für jedes w ∈ L in F+ und für jedes w ∉ L in F−.
- 5.10 rekursiv aufzählbar: TM hält für jedes w ∈ L in F+; für w ∉ L darf sie in F− landen oder unendlich laufen.

## 5.9 Beispiel: Palindrome über {a, b}

Skript S. 59.

- Z = {r, ra, rb, l, la, lb, f+, f−}
- z0 = r
- X = {a, b}
- Y = X ∪ {□} = {a, b, □}
- □ (Blanksymbol)
- F+ = {f+}
- F− = {f−}

Übergänge (Format z, y → z', y', d; d = −1 links, 0 keine Bewegung, +1 rechts):

| # | z | y | → z' | y' | d |
|---|---|---|---|---|---|
| 1 | r | a | ra | □ | +1 |
| 2 | r | b | rb | □ | +1 |
| 3 | r | □ | f+ | □ | 0 |
| 4 | ra | a | ra | a | +1 |
| 5 | ra | b | ra | b | +1 |
| 6 | ra | □ | la | □ | −1 |
| 7 | rb | a | rb | a | +1 |
| 8 | rb | b | rb | b | +1 |
| 9 | rb | □ | lb | □ | −1 |
| 10 | la | a | l | □ | −1 |
| 11 | la | b | f− | b | 0 |
| 12 | la | □ | f+ | □ | 0 |
| 13 | lb | a | f− | a | 0 |
| 14 | lb | b | l | □ | −1 |
| 15 | lb | □ | f+ | □ | 0 |
| 16 | l | a | l | a | −1 |
| 17 | l | b | l | b | −1 |
| 18 | l | □ | r | □ | +1 |

- Anzahl Übergänge: 18
- Für f+ und f− keine Aktionen angegeben (nach Def. 5.6 eindeutig)

## 5.11 und 5.12

- Jede rekursive Sprache ist rekursiv aufzählbar. Ist L rekursiv, dann ist L̄ rekursiv. Ist L und L̄ rekursiv aufzählbar, dann ist L rekursiv.
- 5.12: Grammatiken aus Definition 2.34 heißen Typ-0-Grammatiken (T0G).

## Abbildung 5.2: Konfigurationsliste zu Eingabe abbba

Skript S. 60. Format: Nummer | Band (□ = Blank, Kopf auf markiertem Feld) | Zustand.

Bandfelder jeweils 0 bis 6, Kopfposition als Feldindex angegeben.

| Nr. | Band | Kopfposition | Zustand |
|---|---|---|---|
| 0 | □ a b b b a □ | 1 | r |
| 1 | □ □ b b b a □ | 2 | ra |
| 2 | □ □ b b b a □ | 3 | ra |
| 3 | □ □ b b b a □ | 4 | ra |
| 4 | □ □ b b b a □ | 5 | ra |
| 5 | □ □ b b b a □ | 6 | ra |
| 6 | □ □ b b b a □ | 5 | la |
| 7 | □ □ b b b □ □ | 4 | l |
| 8 | □ □ b b b □ □ | 3 | l |
| 9 | □ □ b b b □ □ | 2 | l |
| 10 | □ □ b b b □ □ | 1 | l |
| 11 | □ □ b b b □ □ | 2 | r |
| 12 | □ □ □ b b □ □ | 3 | rb |
| 13 | □ □ □ b b □ □ | 4 | rb |
| 14 | □ □ □ b b □ □ | 5 | rb |
| 15 | □ □ □ b b □ □ | 4 | lb |
| 16 | □ □ □ b □ □ □ | 3 | l |
| 17 | □ □ □ b □ □ □ | 2 | l |
| 18 | □ □ □ b □ □ □ | 3 | r |
| 19 | □ □ □ □ □ □ □ | 4 | rb |
| 20 | □ □ □ □ □ □ □ | 3 | lb |
| 21 | □ □ □ □ □ □ □ | 3 | f+ |

- Anzahl Zeilen: 22 eindeutige Konfigurationen (0 bis 21).
- Im Skript erscheint Zeile "11" zweimal (links unten und rechts oben), beide identisch. Sie ist hier einmal aufgeführt.
- Ergebnis: Zustand f+ in Zeile 21, also akzeptiert.

# UNKLAR-Stellen

- UNKLAR: Moore-Ausgabe für Eingabewort w: Länge |w| oder |w|+1 (Skript definiert keine Ausgabe für ganzes Wort).
- UNKLAR: Mealy-Ausgabe für Eingabewort w (g*-Formel) fehlt ebenso.
- UNKLAR: Konfiguration und Schrittrelation für Kellerautomaten: nicht formal definiert.
- UNKLAR: Kellerinhalt-Bedingung bei Akzeptanz in 4.5: nicht genannt.
- UNKLAR: Kelleralphabet Y und Anfangskellersymbol y0 in 4.9: nicht explizit angegeben, aus Übergängen abgeleitet.
- UNKLAR: Konfigurationsschreibweise und Schrittrelation für Turingmaschinen: nicht formal definiert.
- UNKLAR: Abbildung 5.2 enthält Zeile 11 zweimal (identisch). Ob Absicht oder Satzfehler, ist nicht ersichtlich.
