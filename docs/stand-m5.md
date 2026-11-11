# Stand Meilenstein M5

Plan: `docs/plan-m5.md`, Kernspezifikation: `docs/kern-spec-m5.md`, Skriptnotizen:
`docs/skript-notizen-m5.md`.

## Was steht

- **Chomsky-Normalform** (Reiter „Verfahren“ der Grammatik):
  - EPS(G) und die vier Schritte aus 6.31, einzeln und als Gesamtverfahren, sofort oder
    schrittweise.
  - Schritt 3 zeigt die Mengentabelle M(X) Runde für Runde wie 6.32. Schritt 4 zerlegt
    standardmäßig sparsam wie 6.32; wörtlich nach Algorithmus ist umschaltbar.
  - Standard überträgt in Schritt 3 auch Terminalproduktionen (E → a, F → a). Die Option
    „wörtlich wie 6.32“ lässt sie weg, dann entsteht genau die CNF des Skripts.
- **CYK** (Reiter „CYK“): Pyramide D[i, j] mit Trennstellen wie 6.33, Schichten wie
  Abbildung 6.1.
  - Die Zellen füllen sich schrittweise über einen Regler.
  - Umschalter auf markierte Produktionen (6.36/6.38).
  - Ein Klick auf eine Zelle hebt das Teilwort hervor und zeigt die Zerlegungen samt
    Ableitungsbaum je Nichtterminal (8.4).
  - Ohne CNF bietet der Reiter die schrittweise Umwandlung an.
- **Earley** (Reiter „Earley“): Itemmengen S₀ … Sₙ in der Schreibweise X →ᵢ v₁ • v₂.
  - Jedes Item zeigt die erzeugende Regel (Start, Lexer, Completer, Predictor).
  - Zeigen auf ein Item hebt die auslösenden Items hervor.
  - Ergänzung für ε-Produktionen (nicht im Skript, im Code gekennzeichnet).
- **LR** (Reiter „LR“): LR(0) und LALR(1) über der erweiterten Grammatik S′ → ⊣ S ⊢.
  - Zustände mit Kern-Items und Hülle, act- und goto-Tabelle, Konflikte rot.
  - Lauf auf einem Wort wie Tabelle 6.1.
- **Beispiele**: 6.32, 6.44, 6.45.

## Abnahme (im Browser)

- **6.32 → CNF** in vier Schritten mit „wörtlich wie 6.32“: 27 Schritte, am Ende V1–V5 wie
  im Skript.
- **CYK für `(a+a)`** auf dieser CNF, Zelle für Zelle wie 6.35:
  - Länge 1: D[0,1] = Z(, D[1,2] = Za, D[2,3] = Z+, D[3,4] = Za, D[4,5] = Z)
  - Länge 2: D[2,4] = V2, D[3,5] = V5
  - Länge 3: D[1,4] = E
  - Länge 4: D[1,5] = V3
  - Länge 5: D[0,5] = {E, F}
  - E ∈ D[0,5], das Wort liegt in L(G).
- **Earley 6.44 mit `abc`**: S₀–S₃ wie im Skript, akzeptiert. In S₁ stehen die Lexer-Items
  zuerst; die Menge ist gleich.
- **LR 6.45**: LALR(1) konfliktfrei mit 13 Zuständen; LR(0) hat Konflikte. Der Lauf
  `(a+a)*a` akzeptiert mit der Aktionsfolge aus Tabelle 6.1.

## Prüfungen

984 Tests grün, 2 übersprungen (pdflatex). Grün sind auch Lint, svelte-check und Build.
Der Eigenschaftstest prüft für 60 zufällige Typ-2-Grammatiken:
- toCnf erhält die Sprache bis Länge 5.
- CYK und Earley entscheiden die Zugehörigkeit richtig.
- LALR(1) entscheidet richtig, wo die Grammatik konfliktfrei ist.

Dabei gefunden und behoben: Bei ε-Produktionen am Start fehlte in LALR(1) die Vorausschau,
weil das Start-Item keinen Vorgänger hat. ε wurde dann abgelehnt.

## Anders gelöst, und warum

- **Zustandsnummern** entstehen aus der Konstruktion (Breitensuche). Das Skript nummeriert
  in 6.50 und 6.55 unterschiedlich; Gleichheit gilt bis auf Umbenennung, die Tests vergleichen
  über die Kern-Items.
- **LALR(1)-Vorausschau** nach dem Standardverfahren (spontane Erzeugung und Propagation).
  Das Skript nennt in 6.57 nur die Bedingung.
- **Schritt 4 wörtlich** erzeugt bei 6.32 zwölf V, nicht 24 wie im Skript: Jede der zwölf
  Produktionen mit drei Symbolen braucht genau eines.
- **D[0,5]** enthält E und F (folgt aus der CNF). Abbildung 6.2 zeigt E und F, Text und
  6.5/6.6 nur E.

## Offen

- Schrittspieler für CYK, Earley und LR laufen im eigenen Reiter (Regler bzw. ganze
  Mengen), nicht im allgemeinen Schrittspieler. Die Schritte liefert der Kern aber schon.
