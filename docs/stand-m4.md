# Stand Meilenstein M4

Plan: `docs/plan-m4.md`, Kernspezifikation: `docs/kern-spec-m4.md`, Skriptnotizen:
`docs/skript-notizen-m4.md`.

## Was steht

Grammatik-Ansicht mit vier Reitern:

- **Produktionen**: wie bisher, mit Typ-Erkennung.
- **Ableiten** (6.2):
  - Eine Stelle der Satzform anklicken, eine Produktion wählen. Der Modus „Linksableitung“
    lässt nur das linkeste Nichtterminal zu.
  - Der Verlauf `S ⇒ SS ⇒ …` ist anklickbar und springt zurück.
  - Bei Typ 2 wächst daneben der Ableitungsbaum wie in 4.19/4.20.
  - Zu einem Zielwort sucht das Tool eine Linksableitung. Bei kontextfreien Grammatiken
    prüft es vorher genau, ob das Wort ableitbar ist; „nicht ableitbar“ und „Grenze
    erreicht“ werden unterschieden.
- **Bäume** (4.22–4.24):
  - zählt alle Ableitungsbäume eines Worts auf, kleinste zuerst, bis zu einer einstellbaren
    Knotenzahl
  - meldet bei Zyklen X ⇒⁺ X ausdrücklich, dass es unendlich viele gibt
  - Mehrdeutigkeitssuche nach Wortlänge; ohne Fund lautet die Antwort „bis Länge n nichts
    gefunden“, nie „eindeutig“
- **Analyse**, Kellerautomat-Läufe als Tabellen:
  - top-down nach 4.27/4.28: gelesen, Zustand, Keller (oben links), Aktion, Satzform
  - bottom-up nach 4.33/4.34: Keller (oben rechts), Zustand, ungelesen, Aktion
  - darunter die Links- bzw. Rechtsableitung (4.30, 4.36) und der Baum
  - Anzahl der untersuchten Konfigurationen und Sackgassen

Weitere Funktionen:

- **Verfahren „Grammatik → Kellerautomat“** (4.27): drei Zustände, ein gewöhnlicher
  Kellerautomat mit Herkunft (Übergang ↔ Produktion), sofort oder schrittweise.
- **Kellerautomat**: Die Akzeptanz lässt sich zwischen Endzustand (4.5) und leerem Keller
  umschalten. Leerer Keller heißt „nur noch y₀“, nicht im Skript; Textform `akzeptanz leer`.
- **Worttest und Sprach-Explorer** entscheiden bei Typ-2-Grammatiken jetzt über die
  Ableitungssuche, nicht mehr über eine Stichprobe.
- **Beispiele**: 4.15, 4.16 (mehrdeutige Klammergrammatik), eindeutige Klammergrammatik
  aus 4.24.

## Abnahme (im Browser)

- **`()()()` mit 4.16**: Die ersten beiden Bäume sind genau A und B aus 4.24, in der
  Reihenfolge B, A. Dazu kommt der Hinweis auf unendlich viele Bäume.
- **Mehrdeutigkeit von 4.16**: Das kürzeste mehrdeutige Wort ist ε (S → ε bzw.
  S → SS → εε).
- **(())() top-down**: genau die Zeilen A–O aus Tabelle 4.28 mit der Linksableitung.
- **(())() bottom-up**: genau Tabelle 4.34 mit der Rechtsableitung.
- **Kellerautomat 4.6 mit `00001111`**: von M1 her im Test, unverändert grün.

## Entscheidungen (mit dir geklärt)

- Bäume nach Größe mit Hinweis auf unendlich viele.
- Bottom-up als Analyseverfahren, keine neue Objektart.

## Anders gelöst, und warum

- **Akzeptanz in 4.27** nur bei vollständig gelesener Eingabe; die Tabelle im Skript lässt
  das offen (UNKLAR in den Notizen), 4.5 verlangt es.
- **Bottom-up-Reihenfolge**: Akzeptanz, dann nichtleere Reduktionen, dann Lesen, zuletzt
  ε-Reduktionen. Mit „reduzieren vor lesen“ entstünde nicht Tabelle 4.34.
- **Reihenfolge der Bäume A/B**: Gleich große Bäume stehen in der Reihenfolge ihrer
  Linksableitung; dadurch steht B vor A.

- **Bottom-up-Suche** beschneidet über eine begründete Kellerhöhe und lebensfähige
  Präfixe (Item-Automat). Im Eigenschaftstest (60 zufällige Grammatiken, alle Wörter bis
  Länge 5) stößt sie nie an die Grenze; vorher bei 62 von 226 Wörtern aus L.

## Prüfungen

848 Tests grün, 2 übersprungen (pdflatex). Grün sind auch Lint, svelte-check und Build.
Der Eigenschaftstest prüft für zufällige Typ-2-Grammatiken:
- Der Kellerautomat aus 4.27 lehnt nie ein Wort aus L ab und akzeptiert nie eines außerhalb.
- Bottom-up akzeptiert genau L.
- Top-down akzeptiert alle Wörter, bei denen die Simulation „Schrittlimit“ meldet.

## Offen

- **Linksrekursion**: Der Kellerautomat aus „Grammatik → Kellerautomat“ meldet bei
  linksrekursiven Grammatiken in der normalen Simulation oft „Schrittlimit“ (4.31: top-down
  und Linksrekursion vertragen sich schlecht). Die Analyse im Reiter „Analyse“ beschneidet
  besser und entscheidet diese Fälle.
