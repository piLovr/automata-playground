# Stand Meilenstein M3

Plan: `docs/plan-m3.md`, Kernspezifikation: `docs/kern-spec-m3.md`, Skriptnotizen:
`docs/skript-notizen-m3.md`.

## Was steht

- **Sprach-Explorer** (Reiter „Sprache“, eigener Worker):
  - zählt die Wörter je Länge und stellt |X|ⁿ samt Balken daneben
  - zählt bei Typ-3-Objekten exakt über einen DEA (`bigint`), bei Kellerautomat und TM als
    gekennzeichnete Stichprobe
  - listet die Wörter nach Länge und dann lexikographisch, seitenweise; ein Klick übernimmt
    ein Wort als Eingabewort
  - zeigt bei Mealy und Moore eine Tabelle Eingabe → Ausgabewort
- **Endliche Sprachen** (neue Objektart `menge`, `menge L1 = {01, 1}`):
  - eigene Ansicht, die Wörter nach Länge gruppiert
  - Sprachrechner für `L1 L2`, `∪`, `^k`, `*` und `+` nach 1.6–1.9; unendliche Ergebnisse
    werden bis Länge n berechnet und so gekennzeichnet
  - Ergebnisse lassen sich als Objekt mit Herkunft übernehmen
  - Mengen sind Typ 3: Äquivalenztest, Arbeitsfläche, Explorer
- **Beispielbibliothek**:
  - Dialog nach Kapitel und Skriptnummer, mit Suche und Kennzeichen für die Objektart;
    „Öffnen“ oder „Hinzufügen“ (für die Arbeitsfläche)
  - einzige Quelle: `examples/*.txt` und `examples/index.json`; App und Tests lesen
    dieselben Dateien
  - neu: 1.4, 1.7 (drei Operanden in einer Datei), 2.1 (Parkplatz), 2.36, 2.37, 2.38, 2.71,
    2.73, 2.78
- **Export** (Menü am Objekt):
  - Diagramm als SVG und PNG, standardmäßig hell, wahlweise im aktuellen Farbschema
  - TikZ-Dokument (`automata`, Positionen aus dem Layout) und TikZ-Bild zum Kopieren
  - Übergangstabelle als LaTeX und formale Definition als LaTeX für alle Objektarten
- **Mealy/Moore**: Der Stapellauf vergleicht mit dem erwarteten Ausgabewort (Einfügen als
  `Eingabe / Ausgabe`).

## Abnahme

- **2.10**: Ein Test prüft alle 1092 Wörter über {0,1,-} bis Länge 6. Die letzte Ausgabe
  ist genau dann 1, wenn das Wort eine Dualzahl nach 2.3 ist. Im Browser liefert der
  Stapellauf für `-101` das Ausgabewort `00111`, für `101` das Wort `0111`.
- **1.7** im Sprachrechner exakt wie im Skript:
  - {01, 1}·{000, 01} = {01000, 0101, 1000, 101}
  - {010, 11}² = {010010, 01011, 11010, 1111}
  - {0,1}³ ergibt alle acht Wörter
  - {ε}L = L (1.8)
- **Explorer**: Für `(0|1)*01` lauten die Anzahlen 0, 0, 1, 2, 4, 8, … („exakt“).
- **Export im Browser**: SVG, PNG und TikZ-Datei werden erzeugt; das SVG wurde angesehen.
- **Prüfungen**: 731 Tests grün, 2 übersprungen (Kompilieren mit `pdflatex`, das hier
  nicht installiert ist). Lint, svelte-check und Build sind grün.

## Entscheidungen

- Mengen sind eine eigene Objektart (mit dir geklärt).
- TikZ nimmt die Positionen aus dem Layout (mit dir geklärt).
- Skript.pdf ist nur noch lokal und aus der Git-Historie entfernt. GitHub hält alte
  Commits eventuell noch über ihre ID erreichbar, bis der Support sie löscht.

## Anders gelöst, und warum

- **SVG-Export im hellen Schema**: Während des Auslesens werden CSS-Übergänge abgeschaltet.
  Sonst landen die dunklen Zwischenfarben im Bild.
- **Sprachrechner**: Namen bestehen aus Buchstaben, Ziffern, `_` und `'`, Verkettung von
  Namen braucht ein Leerzeichen (`L1 L2`).
- **Grammatiken mit Typ < 3** zählt der Explorer über `enumerate` und kennzeichnet das
  Ergebnis als Stichprobe.
- **2.72** fehlt in der Bibliothek: Das Skript zeigt zwei widersprüchliche Bilder.

## Offen

- Kompilieren des TikZ-Exports mit `pdflatex` ist nicht geprüft (der Test läuft, sobald
  `pdflatex` installiert ist).
- Der PNG-Export nutzt die Systemschriften des Browsers. Die eingebetteten Schriften der
  App kommen im Bild nur an, wenn sie dort installiert sind.
- Der Sprachrechner hat noch keinen eigenen Schrittspieler. Die Schritte liefert der Kern
  bereits (`proc.lang.*`).

## Nachtrag: Brücken zwischen den Darstellungen

- **Menge → DEA** (Präfixbaum, nicht im Skript): ein Zustand je Präfix, Start ε, dazu der
  Fangzustand ∅, damit das Ergebnis vollständig ist und sich minimieren lässt. Sofort und
  schrittweise (ein Schritt je Wort).
- **Kette bis zum minimalen DEA**: Der Reiter „Verfahren“ zeigt den Weg vom aktiven Objekt
  und erzeugt mit einem Klick alle Zwischenobjekte mit Herkunft. Danach öffnet sich die
  Arbeitsfläche.
  - Für egrep, regulären Ausdruck, Typ-3-Grammatik, NEA, DEA und Menge.
  - Bei Ausdrücken wahlweise über Thompson.
  - Ein unvollständiger DEA bekommt den Hinweis auf den Fangzustand.
  - Beispiel 3.23: B3_23 → R1 → G1 → N1 → M1 → M1min.
- **Absicherung**:
  - Der Kettentest prüft für 40 zufällige Ausdrücke (mit und ohne Thompson) und alle
    Typ-3-Beispiele der Kapitel 1–3 Äquivalenz zur Quelle und Minimalität.
  - Die Testzeitgrenze ist auf 30 s gesetzt, weil die Eigenschaftstests auf CI-Runnern sonst
    knapp würden.
- **Behoben**: egrep `[0-9]` fror die Seite ein. Die Wortprobe unten lief im Hauptthread
  über die Mengen-Semantik; jetzt läuft sie im Worker über den DEA.
