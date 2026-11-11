# Plan M5: Chomsky-Normalform, CYK, Earley, LR

Anforderungen 7.2 (CNF, CYK MUSS; CYK markierte Produktionen, Earley, LR SOLL), 8.4 (CYK-Zelle
↔ Teilwort/Teilbaum), 11 (M5). Abnahme: „CNF der Grammatik aus 6.32 in vier Schritten;
CYK-Pyramide wie in 6.35“. Skript: `docs/skript-notizen-m5.md`.

## 1. EPS(G) und Chomsky-Normalform (6.24–6.32)

- `eps(g)`: Mengenfolge bis zum Fixpunkt (6.24/6.25), schrittweise.
- `toCnf(g, opts)`: die vier Schritte aus 6.31 einzeln und zusammen, jeweils als eigenes
  Verfahren und als Kette mit Zwischenobjekten (G1 … G4), schrittweise mit Erklärung:
  1. Terminale auslagern (Z_a → a)
  2. ε-Produktionen entfernen nach 6.27/6.29 (ggf. S → ε)
  3. Kettenproduktionen über M(X) = {X' | X ⇒* X'} mit Mengentabelle M₀, M₁, … wie 6.32
  4. lange rechte Seiten: „sparsam“ wie im Skriptbeispiel (gleiche Endstücke teilen ein
     V) oder wörtlich nach Algorithmus (V1 … Vk je Produktion); Standard sparsam
- Herkunft mit Entsprechungen (Z_a ↔ a, V_i ↔ Teilwort der rechten Seite).
- **Frage 1** (unten): Skriptbeispiel 6.32 verliert E → a und F → a.

## 2. CYK (6.33–6.38)

- Pyramide D[i, j] mit D[i, j] = Nichtterminale für w(i, j] (Trennstellen 0 … n, wie im
  Skript), Schichten nach Länge; Zellen füllen sich schrittweise in der Reihenfolge des
  Algorithmus 6.34, je Schritt die geprüfte Zerlegung m und die gefundenen Produktionen.
- Klick auf eine Zelle: Teilwort hervorheben, verwendete Zerlegungen auflisten, daraus
  einen Ableitungsbaum für X ⇒* w(i, j] zeigen (8.4).
- Zweite Darstellung mit markierten Produktionen (6.36/6.38, SOLL): Einträge X → Y Z mit
  Trennstelle, Baum direkt ablesbar.
- Nur für CNF; für andere Typ-2-Grammatiken bietet die Ansicht „erst in CNF umwandeln“
  an (Kette aus 1).

## 3. Earley (6.39–6.44, SOLL)

- Itemmengen S₀ … Sₙ mit Items X →ᵢ v₁ • v₂ in der Schreibweise des Skripts; je Item die
  erzeugende Regel (Lexer, Completer, Predictor) und das auslösende Item. Schrittweise je
  Regelanwendung. Akzeptanz S →₀ w • ∈ Sₙ. Für beliebige Typ-2-Grammatiken (ε eingeschlossen,
  mit der üblichen Ergänzung für ε-Completion – im Skript nicht behandelt, so kennzeichnen).

## 4. LR (6.45–6.57, SOLL)

- Erweiterte Grammatik S′ → ⊣ S ⊢ wie 6.46.
- LR(0)-Items, Hülle, goto; Zustände als Graph (Zustand = Itemmenge) und als Liste wie 6.53;
  goto-Tabelle wie 6.55; act-Tabelle (shift/reduce/accept), Konflikte rot markiert.
- LALR(1)-Vorausschaumengen nach 6.57 (Propagation; im Skript nur als Bedingung, die
  Berechnung ergänze ich nach Standardverfahren und kennzeichne sie).
- Lauf des LR-Automaten auf einem Wort als Tabelle wie Tabelle 6.1 (Keller mit Zuständen,
  Rest, Aktion).
- Zustandsnummern entstehen aus der Konstruktion in Breitensuche-Reihenfolge; das Skript
  nummeriert in 6.50 und 6.55 unterschiedlich (UNKLAR 4) – Gleichheit nur bis auf Umbenennung.

## 5. Beispiele

6.32 (E → E+F | F, F → (E) | a), 6.35/6.38 (Wort aus den Notizen), 6.44 (S → AX, X → BC,
…), 6.45 (E/T/F-Grammatik für LR), Lauf Tabelle 6.1 (`(a+a)*a`).

## 6. Agenten

| Schritt | Agent | Auftrag |
|---|---|---|
| 1 | ich | Typen, `docs/kern-spec-m5.md` |
| 2a | kern-entwickler | `core/cfg/`: EPS, CNF-Schritte, CYK (beide Darstellungen) |
| 2b | kern-entwickler | `core/cfg/`: Earley, LR(0), LALR(1), LR-Lauf |
| 2c | geruest | Beispiele Kapitel 6 |
| 2d | tester | Tests: 6.32 Schritt für Schritt, 6.35 Zelle für Zelle, 6.44 Itemmengen, 6.53/6.55 bis auf Umbenennung, Lauf 6.1 |
| 2e | ich | Oberfläche: Reiter „CYK“, „Earley“, „LR“ in der Grammatik-Ansicht, Pyramide mit Hervorhebung, Itemmengen, Zustandsgraph und Tabellen |
| 3 | fehlersucher | bei Bedarf |
| 4 | ich | Browser-Abnahme, `docs/stand-m5.md`, Commit, Merge nach Rückfrage |

## 7. Frage

1. Im Skriptbeispiel 6.32 überträgt Schritt 3 die Terminalproduktion Z_a → a nicht auf E und F.
   Die CNF dort erzeugt das Wort `a` nicht, obwohl a ∈ L(G); die Pyramide 6.35 beruht auf
   genau dieser CNF.

### Entscheidung (2026-11-11)

1. Schritt 3 überträgt standardmäßig auch Terminalproduktionen (X → a für jedes X mit
   Z_a ∈ M(X)); Hinweis auf den Unterschied zu 6.32. Option `skriptWörtlich` lässt sie weg
   und reproduziert genau die CNF aus 6.32 und damit die Pyramide 6.35, mit Warnung, dass
   die Sprache sich ändert.
