# Stand Meilenstein M1

## Was steht

- **Kernbibliothek `core/`** (reines TypeScript, eigene tsconfig ohne DOM-Typen):
  Datenmodell mit generischem `AutomatonBase<Art, Beschriftung, Zustandszusatz>` und
  Typ-Verzeichnis (`core/model/kinds.ts`), Parser und Printer der Textsprache
  (Grammatik: `core/text/grammatik.ebnf`), JSON, Prüfung, reine Bearbeitungsfunktionen,
  automatisches Layout, DEA- und NEA-Simulation, Stapellauf. Meldungen nur als Code mit
  Parametern, Texte stehen in `app/i18n/de.ts`.
- **Oberfläche `app/`** (Svelte 5), drei gleichwertige Sichten auf dasselbe Modell:
  - Graph: Zustände anlegen, verschieben, umbenennen und löschen; Übergänge vom Zustandsrand
    ziehen, auch als Schleife; Beschriftungen je Kante zusammengefasst; gebogene Kanten bei
    Hin- und Rückrichtung. Außerdem Mehrfachauswahl per Rahmen oder Umschalt, Rückgängig und
    Wiederholen, Kopieren und Einfügen, Zoom und Verschieben, automatisches Anordnen sowie
    Tastenkürzel (`?` zeigt sie).
  - Tabelle: Zustände × Symbole. Beim NEA gibt es zusätzliche Spalten für ε und benutzte
    Wörter, Zellen enthalten Mengen. Neue Zustände und Symbole lassen sich direkt in der
    Tabelle anlegen; unbekannte Zielnamen legen Zustände an.
  - Text: Editor mit Hervorhebung und Fehlermarken an Zeile und Spalte. Ist der Text
    gültig, wird er nach kurzer Pause ins Modell übernommen; bei Fehlern bleibt das letzte
    gültige Modell stehen.
- **Formale Definition** M = (Z, z₀, X, f, F) bzw. N = (Z, z₀, X, g, F) mit den aktuellen
  Mengen über den Sichten.
- **Simulation** mit Schritt vor und zurück, Abspielen mit Tempo, Sprung an Anfang und Ende,
  Symbolband mit Kopf, Erklärung je Schritt und einstellbarem Schrittlimit.
  - DEA: f**(z₀, w) als Folge, f*(z₀, w) am Ende.
  - NEA: Zustandsmenge je Position und Berechnungsbaum aller Wege, mit Markierung für
    Zyklus, Sackgasse und Limit. Fährt man mit der Maus über einen Baumknoten, leuchtet der
    Zustand im Graphen auf.
  - Ergebnisse: akzeptiert, abgelehnt, hängt, Schrittlimit. Aktive Zustände und benutzte
    Kanten sind im Graphen markiert.
- **Stapellauf**: Wortliste mit Soll ∈ L / ∉ L / offen. Sie wird bei jeder Änderung neu
  ausgewertet; Listen lassen sich als Text einfügen.
- **DEA-Prüfung**: fehlende Übergänge werden an drei Stellen angezeigt (Warnzeichen am
  Zustand, schraffierte Zelle, Hinweis). Der Knopf „Fangzustand ergänzen" schließt alle Lücken.
- **Teilen und Speichern**: Der gesamte Stand (Dokument, aktives Objekt, Eingabewörter,
  Wortlisten) liegt komprimiert im Link. Speichern als `.txt` oder `.json`, Öffnen von
  Dateien, automatisches Zwischenspeichern im Browser.
- **Beispiele** 2.3, 2.14, 2.15, 2.61, 2.66 als mathematische Objekte (`examples/`,
  Menü „+").
- **Gestaltung**: helles Farbschema („Papier") und dunkles Farbschema, umschaltbar oder nach
  System. Zustände unterscheiden sich nie nur über die Farbe (Doppelkreis, Startpfeil,
  Auswahlring gestrichelt, aktiver Zustand gefüllt mit Ring). Die schmale Ansicht ordnet die
  Bereiche untereinander an.
- **Build**: eine einzelne `dist/index.html`, die auch per `file://` läuft.

## Abnahme

- Beispiel 2.3 per Graph, per Tabelle und per Text eingegeben: jeweils dieselbe
  Übergangstabelle; Änderungen in jeder Sicht erscheinen sofort in den anderen. Im Browser
  selbst durchgespielt.
- Round-Trip Text → Modell → Text und JSON → Modell → JSON: getestet, auch mit 200
  zufälligen DEA/NEA einschließlich Sonderzeichen und mehrbuchstabiger Symbole
  (`core/test/roundtrip.test.ts`).
- NEA 2.66 mit ε- und Wortübergängen: ε, 01, 0101, 001, 001001 werden akzeptiert,
  0, 01001, 0011 nicht (Test und Browser).
- Typprüfung, Lint und Tests grün, Build läuft als statische Seite.

## Anders gelöst als in den Anforderungen, und warum

- **Kollidierende Symbole** werden mit Backslash maskiert (`\-`, `\,`, `\ `), nicht mit
  Anführungszeichen. Das war die Entscheidung zu Beginn.
- **Eingabewort und Kantenbeschriftung in der Oberfläche sind großzügiger als die
  Textsprache**: `-101` oder `0,1,-` darf ohne Backslash getippt werden. Nur `,` trennt
  Beschriftungen, `\` maskiert, `<name>` ist ein mehrbuchstabiges Symbol. In Dateien gilt
  weiter die strenge Form, damit die Grammatik eindeutig bleibt.
- **Round-Trip ist modell-verlustfrei, nicht zeichengenau**: Kommentare und freie
  Formatierung gehen verloren, die Standardschreibweise bleibt beim erneuten Einlesen
  unverändert. Getrennt geschriebene Übergänge zwischen denselben Zuständen werden zu
  `-a,b->` zusammengefasst.
- **Vor dem Pfeil muss ein Leerzeichen stehen**, weil Zustandsnamen `-` und `+` enthalten
  dürfen (`z+`, `f-` für spätere Kapitel).
- **F in Beispiel 2.3**: Das Skript nennt dort kein F (Definition 2.2 hat keines). F = {B}
  folgt aus g(B) = 1 in 2.10 und passt zu den Anforderungen. Bitte bestätigen.
- **Beispiel 2.66** enthält wie im Skript die Zustände 1, 3, 4 ohne Kanten.
- **Layout im Text**: Positionen stehen in einer `layout`-Zeile. In der Text-Sicht ist sie
  standardmäßig ausgeblendet und lässt sich einblenden. Beim Speichern und Teilen ist sie
  immer enthalten.
- **NEA-Ergebnis „hängt"**: wenn ab einer Position keine Konfiguration mehr erreichbar ist.
  Gibt es noch Wege, die nur nicht in F enden, lautet das Ergebnis „abgelehnt".
- **Kopieren und Einfügen** nutzt eine interne Ablage, nicht die Zwischenablage des Systems.

## Offen

- **SVG- und PNG-Export** (MUSS in 5.3) gehört laut Abschnitt 11 zu M3 und fehlt noch.
- **Web Worker und Abbruch-Knopf**: In M1 sind alle Verfahren linear und durch das
  Schrittlimit begrenzt. Worker und Abbruch kommen mit der Potenzmengenkonstruktion (M2).
- **Englische Oberfläche**: Alle Texte laufen über `app/i18n/de.ts`, eine `en.ts` fehlt.
  Einige Fehlertexte im Graph- und Tabellen-Editor sind noch direkt im Code und müssen in
  die Tabelle.
- **Touch** läuft über Pointer-Events (Ziehen, Doppeltippen), ist aber nicht auf einem
  Tablet getestet. Auf sehr schmalen Bildschirmen wird das Farbschema-Symbol knapp
  abgeschnitten.
- **Größe**: `dist/index.html` ist knapp 1 MB, vor allem durch die eingebetteten
  Schriften (Grotesk, Serif kursiv, Mono). Lässt sich bei Bedarf weiter auf Teilmengen
  zuschneiden.
- **Subagenten** liegen unter `.claude/agents/`. Sie werden erst in einer neuen Sitzung
  geladen; in dieser Sitzung liefen sie als allgemeine Agenten mit festem Modell und
  der jeweiligen Rollendatei.
