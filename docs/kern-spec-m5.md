# Spezifikation Kernbibliothek M5

Plan: `docs/plan-m5.md` (Entscheidung am Ende verbindlich). Skript: `docs/skript-notizen-m5.md`.
Typen verbindlich in `core/model/types.ts` (Abschnitt „Chomsky-Normalform, CYK, Earley, LR“,
MethodIds `cnfTerminals`, `cnfEpsilon`, `cnfChains`, `cnfLong`, `toCnf`, Codes `cnf.*`,
`lr.conflict`). Aufbau wie M2–M4 (ProcResult, Schritte, EXPLANATION_KEYS, Herkunft). Neues
Verzeichnis `core/cfg/`, Export über `core/cfg/index.ts` und eine Zeile in `core/index.ts`.

---

## Teil A: EPS, CNF, CYK (kern-entwickler A) — `core/cfg/cnf.ts`, `core/cfg/cyk.ts`

```ts
export function epsSet(g: Grammar, opts?: ProcOptions): ProcResult<Sym[]>;            // 6.24/6.25, Schritt je Runde
export function isCnf(g: Grammar): { ok: boolean; productionIds: ProductionId[] };    // X → YZ, X → a, S → ε (S nicht rechts)
export function cnfTerminals(g: Grammar, opts?: CnfOptions): ProcResult<Grammar>;     // Schritt 1
export function cnfEpsilon(g: Grammar, opts?: CnfOptions): ProcResult<Grammar>;       // Schritt 2 (6.27/6.29)
export function cnfChains(g: Grammar, opts?: CnfOptions): ProcResult<Grammar>;        // Schritt 3
export function cnfLong(g: Grammar, opts?: CnfOptions): ProcResult<Grammar>;          // Schritt 4
export function toCnf(g: Grammar, opts?: CnfOptions): ProcResult<Grammar>;            // alle vier, Schritte mit Phase
export function cyk(g: Grammar, w: Word, opts?: ProcOptions): ProcResult<CykResult>;  // 6.34
export function cykTree(g: Grammar, r: CykResult, i: number, j: number, x: Sym): DerivTree | null;
```

- Nur Typ 2 (`algo.notType2`). Schritte genau in der Reihenfolge des Skripts, Notizen 6.31/6.32.
- Schritt 1: neue Nichtterminale `Z<a>` (Name `Z` + Terminal als mehrbuchstabiges Symbol,
  bei Konflikt frisch). Wie in 6.32 wird jedes Vorkommen eines Terminals in jeder rechten
  Seite durch Z_a ersetzt (auch X → a wird zu X → Z_a), dazu kommt Z_a → a. Maßgeblich ist
  das Ergebnis in den Notizen 6.32, Schritt 1.
- Schritt 2: EPS(G) nach 6.24, dann je Produktion alle Varianten ohne Teilmengen ε-fähiger
  Vorkommen, ε-Produktionen streichen; ist S ∈ EPS: neues Startsymbol S′ → S | ε (6.29;
  genaue Form aus den Notizen). Kein Einfluss bei 6.32.
- Schritt 3: Mengen M₀(X), M₁(X), … bis zum Fixpunkt als Schritte mit Tabelle (Zeilen X,
  Spalten M₀ …) wie 6.32. Neue Produktionen: für X, jedes X′ ∈ M(X) mit X′ → Y₁…Y_k (k ≥ 2)
  und alle Kombinationen Yᵢ′ ∈ M(Yᵢ): X → Y₁′…Y_k′. **Zusätzlich (Entscheidung):**
  X → a für jedes X′ ∈ M(X) mit X′ → a; mit `scriptLiteral: true` nicht (dann Diagnose
  `cnf.scriptLiteral` als Warnung). Doppelte Produktionen nicht anlegen. Reihenfolge der
  Produktionen so, dass 6.32 Schritt 3 in der Reihenfolge der Notizen erscheint.
- Schritt 4: `sparse` (Standard): je verschiedenem Endstück Y₂…Y_k ein V (geteilt, wie
  6.32 sparsam: V1 → Z+ F, …); sonst wörtlich V₁ … je Produktion. Namen `V1, V2, …` in
  Erzeugungsreihenfolge. 6.32 sparsam muss die Tabelle der Notizen (V1–V5) ergeben, mit
  `scriptLiteral: true` exakt.
- Ergebnisse mit `origin`; Entsprechungen Z_a ↔ (keine Quelle nötig), V_i ↔ Produktion der
  Quelle, aus der es entstand. Schritte `proc.cnf.*` (Schlüssel frei wählen, in
  EXPLANATION_KEYS, Liste in der Rückmeldung).
- CYK nach 6.34 (Trennstellen 0 … n, D[i, i+1] aus X → x_{i+1}, dann Länge 2 … n,
  Zerlegung m von i+1 bis j−1 aufsteigend). Ein Schritt je Zelle: `proc.cyk.cell` {i, j,
  nonterminals, splits: {m, production}[]}. `marks` für 6.36/6.38. `accepted` = S ∈ D[0, n]
  (ε: S → ε). Nur für CNF (`cnf.notCnf`). `cykTree`: ein Ableitungsbaum aus den Marks.
- Abnahme: Pyramide 6.35 mit `scriptLiteral: true` Zelle für Zelle wie in den Notizen
  (D[0,5] dort nur E bzw. E, F laut UNKLAR – Test mit der Variante, die aus der CNF folgt).

## Teil B: Earley und LR (kern-entwickler B) — `core/cfg/earley.ts`, `core/cfg/lr.ts`

```ts
export function earley(g: Grammar, w: Word, opts?: ProcOptions): ProcResult<EarleyResult>;
export function lrAutomaton(g: Grammar, mode: 'LR0' | 'LALR1', opts?: ProcOptions): ProcResult<LrAutomaton>;
export function lrRun(a: LrAutomaton, w: Word, opts?: { maxSteps?: number }): { rows: LrRunRow[]; accepted: boolean };
```

- Earley nach 6.43 genau (Init, dann je S_j Lexer/Completer/Predictor bis zum Fixpunkt,
  Items ohne Doppelte, Reihenfolge des Hinzufügens). ε-Produktionen: Completer auch für
  Items, die in derselben Menge vollständig werden (Standardergänzung, nicht im Skript –
  in einem Kommentar kennzeichnen). Ein Schritt je hinzugefügtem Item `proc.earley.item`
  {set, item-Index}. 6.44 exakt (Itemmengen S0–S3 wie in den Notizen).
- LR nach 6.46–6.55: erweiterte Grammatik S′ → ⊣ S ⊢ (Endmarken `⊣`, `⊢` als Terminale;
  Kollision mit T → Fehler), Items, Hülle, goto, Zustände in Breitensuche (Symbole in der
  Reihenfolge: Terminale T, dann ⊢, dann Nichtterminale – so, dass 6.53/6.55 bis auf
  Umbenennung herauskommen). act: shift bei goto über Terminal, reduce bei vollständigem
  Item (LR0: für alle Terminale und ⊢; LALR1: nur für die Vorausschau), accept bei
  S′ → ⊣ S • ⊢ und ⊢. Konflikte sammeln (`lr.conflict` als Warnung je Konflikt).
- LALR(1): Vorausschau nach dem Standardverfahren (spontane Erzeugung + Propagation über
  LR(1)-Hülle mit Platzhalter, Dragon-Book 4.7.5) – im Skript nur als Bedingung 6.57;
  Kommentar „Berechnung nicht im Skript“.
- `lrRun`: Tabelle 6.1 (Keller mit Zuständen und Symbolen, Rest, Aktion), deterministisch
  mit der ersten Aktion bei Konflikt (Hinweis in der Oberfläche); Eingabe ⊣ w ⊢.
- Schritte `proc.lr.state` {state} je neuem Zustand (view.table: Items).
- Tests eigene: 6.44 Itemmengen, 6.45-Grammatik: Zustandszahl und goto-Tabelle bis auf
  Umbenennung wie 6.55, Lauf (a+a)*a akzeptiert mit der Aktionsfolge aus Tabelle 6.1.

## Teil C: Tests (tester)

6.32 jeder Schritt (G1, Mengentabelle, G3, G4 sparsam/wörtlich, mit und ohne
scriptLiteral), 6.35 Zelle für Zelle, 6.38 Marks, 6.44, 6.53/6.55 bis auf Umbenennung, Lauf
Tabelle 6.1. Eigenschaft: zufällige Typ-2-Grammatiken: L(toCnf(G)) = L(G) bis Länge 5
(`cfgWords`), CYK auf toCnf(G) ⇔ Zugehörigkeit, Earley ⇔ Zugehörigkeit, für
konfliktfreie LALR(1)-Grammatiken lrRun ⇔ Zugehörigkeit.
