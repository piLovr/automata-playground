# Automaten-Playground

Browser-Tool für formale Sprachen und Automaten. Stand: Meilenstein M2 (reguläre Ausdrücke, Typ-3-Grammatiken, Verfahren aus 7.1, Arbeitsfläche) und egrep-Regex.

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

## Automatentypen anlegen

Über **+** in der Kopfleiste: neuer DEA, NEA, Mealy-, Moore-, Kellerautomat oder
Turingmaschine, oder ein fertiges Beispiel (2.3, 2.10, 2.14, 2.15, 2.61, 2.66, 4.6, 4.9, 5.9
und zwei eigene Beispiele). Jeder Typ lässt sich im Graphen, in der Tabelle und als Text
bearbeiten.

| Typ | Kante im Graphen | Tabelle | Text |
|---|---|---|---|
| DEA | `a, b` | Zustände × Symbole | `A -a,b-> B` |
| NEA | `a, 01, ε` | Spalten auch für ε und Wörter | `A -01,ε-> B` |
| Mealy | `0/1, 1/0` (Eingabe/Ausgabe) | Zelle `B / 1` | `A -0/1-> B` |
| Moore | wie DEA; Ausgabe am Zustand (Taste **O**) | Spalte g | `out A=0 B=1` |
| Kellerautomat | `*, 0 -> 0*; 0, ε -> ε` (oben, Eingabe → kellern) | eine Zeile je Übergang | `z0, *, 0 -> z0, 0*` |
| Turingmaschine | `a -> □, R; b -> b, L` (lesen → schreiben, Richtung) | eine Zeile je Übergang | `r, a -> ra, □, R` |

### Beispiel: eine Turingmaschine Schritt für Schritt

1. **+ → Neue Turingmaschine.** Das Blank ist `□` (in der Definition rechts änderbar).
2. **Zustände:** Doppelklick auf die freie Fläche legt einen Zustand an; der erste wird
   Startzustand. Mit **F2** umbenennen, mit **A** als akzeptierend (F₊) und mit **R** als
   ablehnend (F₋) markieren.
3. **Übergänge:** Vom Rand eines Zustands zum Ziel ziehen (zum selben Zustand für eine
   Schleife) und die Beschriftung eingeben, z. B. `a -> □, R`. Mehrere Übergänge auf
   derselben Kante durch `;` trennen. Die Knöpfe neben dem Feld fügen `□` bzw. `ε` ein.
4. **Alternativ in der Tabelle:** In der letzten Zeile `z, y, z', y', d` eintragen,
   z. B. `r | a | ra | □ | R`, und mit Enter übernehmen. Unbekannte Zustände werden
   angelegt.
5. **Alternativ als Text:** Reiter *Text*, z. B.

   ```
   tm PlusEins {
     alphabet 0 1
     blank □
     start r
     accept f+
     r, 0 -> r, 0, R
     r, 1 -> r, 1, R
     r, □ -> c, □, L
     c, 1 -> c, 0, L
     c, 0 -> f+, 1, N
     c, □ -> f+, 1, N
   }
   ```

6. **Simulieren:** Eingabewort unten eintragen (z. B. `1011`) und mit ▶ oder **.** Schritt
   für Schritt laufen lassen. Angezeigt werden das Band mit Kopf, die Liste der
   Konfigurationen, die Zahl der Schritte und der besuchten Felder sowie das Ergebnis
   (akzeptiert, abgelehnt, hängt oder Schrittlimit). Das Schrittlimit ist einstellbar.

Beim Kellerautomaten zeigt die Simulation den Keller und die Verlaufstabelle (gelesene
Eingabe, Zustand, Kellerinhalt). Unter *Konfigurationen* lässt sich ein anderer Ast des
Konfigurationsbaums wählen. Mealy und Moore zeigen das Ausgabewort, das mit jedem Schritt
wächst.

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

## Docker und Portainer

Bei jedem Push auf `main` baut GitHub Actions (`.github/workflows/docker.yml`) nach Tests,
Typprüfung und Lint ein Image für `linux/amd64` und `linux/arm64` und legt es unter
`ghcr.io/pilovr/automata-playground` ab (`latest`, Kurz-SHA, bei Tags `v*` auch die
Versionsnummer). Das Image liefert die statische Seite mit nginx auf Port 80 aus.

Stack für Portainer (auch als `docker-compose.yml` im Repository):

```yaml
services:
  automaten-playground:
    image: ghcr.io/pilovr/automata-playground:latest
    container_name: automaten-playground
    restart: unless-stopped
    ports:
      - "8080:80"
```

Lokal bauen und starten:

```sh
docker build -t automaten-playground .
docker run --rm -p 8080:80 automaten-playground
```
