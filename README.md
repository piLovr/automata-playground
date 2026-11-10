# Automaten-Playground

Browser-Tool für formale Sprachen und Automaten. Stand: Meilenstein M1 (DEA und NEA).

## Befehle

```sh
npm install      # Abhängigkeiten installieren
npm run dev      # Entwicklungsserver
npm test         # Tests (Vitest)
npm run build    # Build nach dist/
npm run lint     # ESLint
npm run check    # Typprüfung (Kern und Oberfläche)
```

Nach `npm run build` lässt sich `dist/index.html` ohne Server per Doppelklick öffnen.

## Bedienung

- Doppelklick auf die Fläche legt einen Zustand an.
- Vom Rand eines Zustands ziehen erzeugt einen Übergang (auch eine Schleife auf sich selbst).
- `F2` oder `Enter` benennt einen Zustand um bzw. bearbeitet die Beschriftung eines Übergangs.
- `S` setzt den Startzustand, `A` markiert einen akzeptierenden Zustand.
- `Entf` löscht die Auswahl, `Strg+Z` / `Strg+Y` machen bzw. wiederholen, `Strg+C` / `Strg+V` kopieren bzw. einfügen.
- `L` ordnet die Zustände automatisch an, `0` passt die Ansicht ein.
- `?` zeigt alle Tastenkürzel.
- Simulation: `,` einen Schritt zurück, `.` einen Schritt vor, `P` startet bzw. pausiert den Ablauf, `Pos1` springt zum Anfang, `Ende` zum Ende.

## Textformat

Automaten lassen sich als Text eingeben und speichern. Beispiel (Dualzahlen mit Vorzeichen, aus `examples/b2-3.txt`):

```
dea Dualzahl {
  alphabet 0 1 \-
  start A
  accept B
  A -0,1-> B
  A -\--> M
  M -0,1-> B
  M -\--> Q
  B -0,1-> B
  B -\--> Q
  Q -0,1,\--> Q
  layout A@0,0 B@240,-80 M@240,90 Q@480,10
}
```

- `\` maskiert Sonderzeichen: `\-`, `\,`, `\#`, `\ ` (Leerzeichen).
- `<name>` steht für ein mehrbuchstabiges Symbol.
- `ε` oder `eps` steht für das leere Wort.
- Die genaue Grammatik steht in `core/text/grammatik.ebnf`.

Weitere Beispiele liegen in `examples/`.

## Teilen

- **Link teilen:** Der gesamte Zustand wird komprimiert in die URL geschrieben.
- **Speichern:** als `.txt` (Textformat) oder `.json`.
- **Automatisches Zwischenspeichern:** Der Stand bleibt im Browser erhalten.

## Ordnerstruktur

- `core/` – reine TypeScript-Logik ohne DOM (Modell, Text, JSON, Simulation, Layout)
- `app/` – Svelte-Oberfläche (`main.ts`, `App.svelte`, `i18n/`)
- `examples/` – Beispieldateien in der Textsprache
- `docs/` – Pläne und Notizen
