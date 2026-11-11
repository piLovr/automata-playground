# Stand M6: Turingmaschine, LBA, Typ 0/1, Hierarchie-Landkarte

Plan: `docs/plan-m6.md`, Spezifikation: `docs/kern-spec-m6.md`, Skript: `docs/skript-notizen-m6.md`.

## Abnahme

TM aus 5.9 mit `abbba`: 21 Schritte, also 22 Konfigurationen wie in Abbildung 5.2, akzeptiert
(Test `core/test/examples.test.ts`, im Browser geprüft).

## Umgesetzt

- **Fehler behoben:** Die Ableitungssuche meldete bei Typ-0-Grammatiken „nicht ableitbar“, obwohl
  nur bis zu einer Längengrenze gesucht war. Jetzt `wordProblem` (`core/m6/word.ts`):
  - nicht verkürzende Grammatiken: exakt entschieden (Satzformen bis |w|)
  - sonst: „bis Länge k nicht gefunden – nichts entschieden“
  - `findDerivation` delegiert für Typ < 2 und meldet `derive.limit`.
- **Typ-Erkennung nach 5.1:** Typ 1 nur in der Form uXv → uwv (w ≠ ε) plus X₀ → ε.
  - Nicht verkürzende Produktionen anderer Form (z. B. CB → BC) sind Typ 0 mit dem Hinweis
    „dieselbe Sprachklasse, Wortproblem entscheidbar“ (`GrammarTypeInfo.nonContracting`).
  - Zwei ältere Tests sind entsprechend angepasst.
- **LBA (5.21):** Schalter „linear beschränkt“ an der TM, Textform `lba`.
  - Erlaubt sind die Felder −1 … n; außerhalb ist das Band schraffiert, die Randfelder sind
    gestrichelt.
  - Verlässt der Kopf das Fenster: Ergebnis „Platzschranke verletzt“ (`bound`). Ein gleichzeitig
    erreichter Endzustand hat Vorrang.
- **Zeit/Platz (5.20):** Reiter „Zeit/Platz“ bei TMs (`tmCost`, im Worker).
  - Zeigt t(n) und s(n) als Diagramm und Tabelle mit dem langsamsten Wort.
  - Wörter, die das Schrittlimit erreichen, werden gezählt und nicht mitgerechnet.
- **Ansicht „Hierarchie“** (neben Objekt/Arbeitsfläche):
  - **Landkarte nach 5.25:** alle Sprachen ⊃ Typ 0 ⊃ rekursiv ⊃ Typ 1 ⊃ Typ 2 ⊃ Typ 3.
    - Je Stufe Grammatik, Automat und Beispiel, dazu Knöpfe zum Laden der Beispiele.
    - Objekte werden nach Beschreibungsmittel einsortiert (`hierarchyPlacement`). Nur Typ 3 gilt
      als „genau“, sonst „≥“.
  - **Halteproblem:** H und K (5.33/5.34), Diagonaltabelle 5.35, TM mit Schrittlimit-Regler. Der
    Text sagt „nach N Schritten noch nicht gehalten – kein Beweis“.
  - **Fleißiger Biber:** Aufzählung in Baum-Normalform (`core/m6/beaver.ts`).
    - Ergebnis BB(1…4) = 1, 4, 6, 13 wie 5.41; n = 4 braucht etwa 1 s bei Schrittlimit 200.
    - Nachweis ohne Halt nur bei exakter Wiederholung oder bei einem Lauf nach außen ins leere
      Band. Alles andere heißt „offen“.
    - „Als TM öffnen“.
- **Formulierungsregel:** Ein Test in `app/i18n/de.test.ts` erlaubt „hält nicht“ und ähnliche
  Wendungen nur in `halting.*`.
- **Beispiele:** 5.41 (Biber, 6 Zustände), eigene: Biber 2/3, Typ-1-Grammatik aᵏbᵏcᵏ, Typ-0-Grammatik
  ww, LBA 0ᵏ1ᵏ2ᵏ.
- `$OUT` (Debug-Rest aus M4) entfernt.

## Tests

1044 grün, 2 übersprungen. Lint und svelte-check fehlerfrei.

## Offen / Festlegungen

- Universelle TM: nicht umgesetzt (Entscheidung, das Skript legt keine Gödelisierung fest).
- Biber:
  - Der Wert gilt „unter den Maschinen, die innerhalb des Limits halten“; bei n = 4 bleiben
    rund 300 000 Maschinen offen.
  - Gezählt werden die Einsen auf dem Band beim Halt (UNKLAR 7).
  - Der Halt-Übergang ist fest (Z, 1, R).
- Biber-TMs haben das Eingabealphabet {1}: Ein leeres Eingabealphabet ist in der Textform nicht
  darstellbar, der Lauf startet trotzdem mit ε.
- Zählweise Zeit/Platz: Schritt = Anwendung von f, besuchte Felder = Kopfpositionen (UNKLAR 2/3).
- TM → Typ-0-Grammatik (5.14) nicht umgesetzt.
