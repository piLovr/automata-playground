# Plan M3: Sprach-Explorer, Kapitel 1, Beispielbibliothek, Export

Anforderungen Abschnitt 11, M3: „Mealy/Moore, Sprach-Explorer, Beispielbibliothek Kap. 1
und 2, Export SVG/PNG/TikZ“. Abnahme: „Moore-Automat aus 2.10 gibt für Dualzahlen als
letzte Ausgabe 1“. Mealy/Moore samt Simulation und Umwandlung sind schon da (M1-Nachtrag,
M2). Skriptnotizen: `docs/skript-notizen-m3.md` (wird gerade erstellt).

## 1. Sprach-Explorer (8.7, MUSS)

Neuer Reiter „Sprache“ für alle Objekte mit Wortsprache:
- Wörter nach Länge, dann lexikographisch in Alphabetreihenfolge, seitenweise (je 50),
  bis zu einer einstellbaren Länge.
- Anzahl der Wörter je Länge 0 … n als Tabelle und kleines Balkendiagramm. Für Typ-3-Objekte
  wird über den DEA exakt gezählt (Zählung per Dynamik über Zustände, `bigint`, auch für
  n = 60). Daneben steht |X|ⁿ zum Vergleich.
- Zugehörigkeitstest für ein Wort; bei Typ 3 mit Zustandsfolge, sonst Ergebnis des Simulators.
- Kellerautomat und TM: Aufzählung über die Simulation mit Schrittlimit, gekennzeichnet
  als „Stichprobe bis Länge n, Schrittlimit k“. Mealy/Moore: Tabelle Eingabe → Ausgabewort.
- Rechnen im Worker, abbrechbar.

Kern (`core/explore/`):

```ts
countByLength(o: FormalObject, maxLen: number): ProcResult<{ counts: bigint[]; exact: boolean }>;
wordsPage(o: FormalObject, opts: { maxLen: number; offset: number; limit: number; stepLimit?: number }): ProcResult<{ words: Word[]; done: boolean; exact: boolean }>;
outputsTable(o: Mealy | Moore, maxLen: number): { input: Word; output: Word }[];
```

## 2. Kapitel 1: endliche Sprachen und Sprachoperationen (8.8, SOLL, passt zur Abnahme „Kap. 1“)

Neue Objektart **`menge`** (endliche Sprache), Textform `menge L1 = {a, ab, ε}`.
Dazu ein „Sprachrechner“ als Reiter mit Ausdrücken über benannte Mengen und Typ-3-Objekte:
`L1 L2`, `L1 ∪ L2`, `L1^3`, `L1*`, `L1+` (1.6–1.9). Ergebnisse von * und + werden bis
Länge n ausgerechnet und als „bis Länge n“ gekennzeichnet. Das Ergebnis lässt sich als neue
`menge` übernehmen (mit Herkunft). Endliche Mengen sind Typ 3 und nehmen am Äquivalenztest
und an der Arbeitsfläche teil (`toDea` über einen Präfixbaum).

## 3. Beispielbibliothek Kapitel 1 und 2 (9, MUSS)

Neu laut `skript-notizen-m3.md`:
- Kap. 1: 1.4 (Wörter), 1.7 (Produkte und Potenzen endlicher Sprachen) als `menge` plus
  vorbereitete Rechnungen
- Kap. 2: 2.1 (Parkplatz, Mealy), 2.36, 2.37, 2.38 (Grammatiken), 2.78 (unerreichbare
  Zustände), 2.71–2.73 (Zwischenstände NEA 2.66), 2.83 (trennendes Wort am DEA 2.14)
- Vorhanden: 2.3, 2.10, 2.14, 2.15, 2.24, 2.44, 2.61, 2.66, 2.92

- Alle mathematischen Objekte aus den Beispielen in Kap. 1 und 2 als Dateien in
  `examples/` (Mengen aus Kap. 1, DEA/NEA/Mealy/Moore/Grammatiken/Ausdrücke aus Kap. 2),
  kein Skripttext.
- Statt des langen Menüs ein **Bibliotheksdialog**: nach Kapitel gruppiert, sortiert nach
  Nummer, Suchfeld, Art als Kennzeichen; „Öffnen“ oder „Zur Arbeitsfläche hinzufügen“.
- Ein Test prüft, dass jede Beispieldatei fehlerfrei gelesen wird und ihre im Skript
  genannten Wörter (Notizen) richtig erkennt.

## 4. Export (5.3: SVG, PNG MUSS; TikZ, LaTeX-Tabellen SOLL)

- **SVG**: Das gerenderte Diagramm wird als eigenständige SVG-Datei mit eingebetteten
  Stilen ausgegeben, wahlweise hell (Standard für Druck) oder im aktuellen Farbschema; die
  Schriften werden nicht eingebettet, es gibt Ersatzschriften.
- **PNG**: dieselbe SVG, im Browser auf ein Canvas gerastert (Faktor 2 oder 3).
- **TikZ** (`automata`-Bibliothek, im Kern, reine Textfunktion): Positionen aus dem Layout
  (cm, y gespiegelt), `initial`/`accepting`, Schleifen, gebogene Kanten bei Gegenrichtung,
  Beschriftungen in Mathe-Schrift; Mealy `x/y`, Moore Ausgabe im Zustand, NKA/TM in der
  Schreibweise des Graphen. Ausgabe als vollständiges Dokument (`standalone`) oder nur als
  `tikzpicture`.
- **LaTeX-Tabelle**: Übergangstabelle wie in der Tabellen-Sicht (`tabular`), dazu Ausdruck
  und Grammatik als Mathe-Text.
- Menü „Exportieren“ am Objekt, mit Kopieren in die Zwischenablage und Speichern.

## 5. Mealy/Moore abrunden

- Der Stapellauf für Mealy und Moore bekommt eine Spalte „erwartete Ausgabe“, die mit dem
  Ausgabewort verglichen wird (offener Punkt aus M1).
- Abnahme 2.10 als Test und im Browser: für alle Dualzahlen bis Länge 6 ist die letzte
  Ausgabe 1, für ungültige Eingaben 0.

## 6. Agenten

| Schritt | Agent | Auftrag |
|---|---|---|
| 0 | skript-leser | `docs/skript-notizen-m3.md` (läuft) |
| 1 | ich | Typen (`MengeObj`, Explorer-Ergebnisse), `docs/kern-spec-m3.md` |
| 2a | kern-entwickler | `core/explore/`, `menge` in Text/JSON/Prüfung, Sprachoperationen, `toDea` für Mengen |
| 2b | kern-entwickler (zweiter) | `core/export/` TikZ und LaTeX |
| 2c | geruest | Beispieldateien aus den Notizen, Liste mit Kapitel/Nummer/Titel |
| 2d | tester | Tests gegen Spezifikation und Notizen, Zählung gegen `enumerate` |
| 2e | ich | Oberfläche: Reiter „Sprache“, Sprachrechner, Bibliothek, Exportmenü, SVG/PNG, Stapellauf Mealy/Moore |
| 3 | fehlersucher | bei Bedarf |
| 4 | ich | Abnahme im Browser, `docs/stand-m3.md`, Commit, Merge nach main |

## 7. Fragen

1. Endliche Mengen als eigene Objektart `menge` (vorgeschlagen) oder nur als Rechner ohne
   Objekte?
2. TikZ mit den Positionen aus dem Layout (vorgeschlagen, sieht aus wie im Tool) oder mit
   automatischer Platzierung durch TikZ (`right of=`)?
