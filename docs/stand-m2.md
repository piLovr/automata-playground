# Stand Meilenstein M2

Plan: `docs/plan-m2.md`, Kernspezifikation: `docs/kern-spec-m2.md`, Skriptnotizen:
`docs/skript-notizen-m2.md`.

## Was steht

- **Neue Objektarten** im Kern und in der Textsprache (`core/text/grammatik.ebnf`):
  - `regex R = (0|1)*01`: regulärer Ausdruck nach 2.21. Gelesen wird mit Klammereinsparung
    (Stern vor Hintereinanderschreiben vor `|`, links geklammert). Fehlermeldungen folgen der
    Liste falscher Ausdrücke in 2.22. Gedruckt wird in Standard- oder voll geklammerter Form.
  - `grammatik G { … }` mit `nichtterminale`, `terminale`, `start` und Produktionen
    `X -> w | …`. Die Typ-Erkennung 0–3 begründet jede Produktion einzeln, einschließlich
    der Sonderregel S → ε.
  - `herkunft … aus Name@hash` und `entspricht …` halten Herkunft und Entsprechungen im
    Text verlustfrei fest. Die Text-Sicht blendet sie zusammen mit `layout` aus.
- **Alle Verfahren aus 7.1** in `core/algo/`. Jedes ist sofort oder schrittweise aufrufbar
  und liefert Zwischenschritte als Daten (Zwischenobjekt, Partition, wachsende Menge,
  Tabelle):

  | Verfahren | Skriptstelle |
  |---|---|
  | NEA → DEA in drei Phasen | 2.71, 2.72, 2.74 |
  | DEA → Ausdruck über L^k_ij mit Tabelle je k | 2.30 |
  | Zustandselimination | nicht im Skript |
  | Ausdruck → Grammatik | 2.52–2.54 mit Ergänzung |
  | Grammatik → NEA | 2.69 |
  | DEA → Grammatik | 2.49/2.50 |
  | Thompson | nicht im Skript |
  | Komplement, Durchschnitt | 2.33 |
  | Vereinigung | nicht im Skript |
  | Erreichbare Zustände | 2.82 |
  | Minimierung | 2.90 |
  | Äquivalenztest mit kürzestem unterscheidendem Wort | – |
  | Trennendes Wort | 2.84 |
  | Mealy ↔ Moore | nicht im Skript |

- **Web Worker** (`app/lib/runner.svelte.ts`, im Build eingebettet). Er zeigt den
  Fortschritt und lässt sich abbrechen. Die Grenzen für Zustände und Ausdrucksgröße sind im
  Reiter „Verfahren“ einstellbar. Startet kein Worker, rechnet der Hauptthread mit
  denselben Grenzen.
- **Oberfläche**
  - Ausdruck: Eingabezeile mit Sonderzeichenleiste und Fehlern an der Spalte, darunter
    beide Schreibweisen und der Syntaxbaum.
  - Grammatik: Produktionen wie im Skript, Typ mit Begründungstabelle.
  - Untere Leiste für Ausdruck und Grammatik: Worttest und Wörter bis Länge 6. Der
    Stapellauf funktioniert auch hier.
  - Reiter „Verfahren“: passende Verfahren mit Skriptnummer oder „nicht im Skript“, dazu
    Herkunft, „veraltet“ samt „Neu berechnen“, Äquivalenztest und trennendes Wort.
  - Schrittspieler: Zwischenstand als Graph mit neuen Kanten. Klassen ≡k sind farbig und
    zusätzlich nummeriert. Dazu kommen die Tabelle je Runde bzw. die Potenzmengen- und
    L^k_ij-Tabelle, die Quelle mit hervorgehobenem Teil, Erklärung je Schritt,
    Pfeiltasten und „Als Objekt übernehmen“.
  - Arbeitsfläche (Umschalter „Objekt | Arbeitsfläche“):
    - alle Objekte als Karten, darüber die Herkunftskette als Graph
    - Hervorhebung der Entsprechungen aufwärts und abwärts entlang der Kette
    - Äquivalenzmatrix über alle Typ-3-Objekte
    - ein Wort für alle Objekte, mit Warnung, wenn die Objekte sich widersprechen (SOLL 8.5)
- **Beispiele**:
  - neu im Skript: 2.24 (Ausdruck), 2.44 (Typ-3-Grammatik, S = X0), 2.66 als Ausdruck,
    2.92 (Minimierung)
  - eigenes Beispiel „endet auf 01“ für die Abnahme

## Abnahme (im Browser durchgespielt)

1. `(0|1)*01` → Grammatik (Sofort) → NEA (Sofort) → DEA (schrittweise, 37 Schritte; die
   Potenzmengentabelle hat 4 Teilmengen) → Minimieren (3 Zustände). „Alle vergleichen“
   bestätigt: Ausdruck ≡ Grammatik ≡ NEA ≡ DEA ≡ Minimal-DEA.
2. 2.92 schrittweise:
   - Erreichbarkeit: S₀ … S₄, nichts wird entfernt.
   - ≡₀ = {A,B,E,F}{C,D,G}
   - ≡₁ = {A,E}{C,D,G}{B}{F}
   - ≡₂ = {A}{C,D,G}{B}{F}{E}
   - ≡₃ = ≡₂, Abbruch
   - Ergebnis: 5 Zustände wie im Skript. Zeigt man auf [CDG], leuchten C, D und G in 2.92 auf.
3. Worker im Build (`vite preview`): Bei 2000 Zuständen meldet die Grenze sauber. Mit
   500 000 Zuständen rechnet der Worker; die Oberfläche bleibt bedienbar, der Fortschritt
   zeigt 131 073 Zustände, und „Abbrechen“ beendet den Auftrag.
4. 494 Tests grün:
   - Skriptbeispiele, Round-Trip Text/JSON für die neuen Arten
   - eigenschaftsbasiert: 100 zufällige Ausdrücke und NEA je Kette, Sprache gleich laut
     `enumerate` bis Länge 6 **und** laut `equivalent`
   - kürzestes Gegenbeispiel, Grenzen
   Dazu grün: Typprüfung, svelte-check, Lint und Build (eine `dist/index.html`).

## Entscheidungen (mit dir geklärt, siehe plan-m2.md Abschnitt 9)

- ε im Ausdruck ist eine Abkürzung für ∅* und wird als ∅* gespeichert und gedruckt.
- 2.30 vereinfacht standardmäßig (∅|R = R, ∅R = ∅, ∅*R = R …). Das lässt sich abschalten.
- 2.54: Basisfälle ∅ und a sowie der Stern sind ergänzt und als „Ergänzung“ markiert.
- 2.72: R1, R2 und die F-Regel laufen bis zum Fixpunkt, danach entfernt R3 alle ε-Kanten.

## Anders gelöst als geplant, und warum

- **Lange Mengennamen**: Zustände aus Potenzmenge und Minimierung heißen nach ihren
  Elementen (`CDG`, `z0_z1`). Ist ein Name länger als 6 Zeichen, heißen alle Zustände des
  Ergebnisses `q0, q1, …`. Sonst wären die Namen im Graphen unlesbar. Die Menge bleibt in
  der Tabelle sichtbar und leuchtet beim Zeigen auf.
- **Ergebnisnamen** folgen der Kette `R1 → G1 → N1 → M1 → M1min`. Die Oberfläche vergibt
  sie frisch; der Kern hängt ohne Vorgabe Endungen an.
- **Klassenreihenfolge bei ≡k**: nach erstem Zustand in Modellreihenfolge. Die Mengen
  stimmen mit dem Skript überein, die Reihenfolge der Klassen nicht immer.
- **2.30 und 2.82** laufen auch auf nicht vollständigen DEA, weil fehlende Übergänge dort
  einfach leere Mengen sind. Minimierung, Komplement und Produkt verlangen weiterhin einen
  vollständigen DEA; der Hinweis bietet dann den Fangzustand an.
- **Vereinigung** (Produkt mit F₁×Z₂ ∪ Z₁×F₂) steht nicht im Skript und ist so markiert.
- **Äquivalenztest** entscheidet über DEA (auch bei Ausdrücken). Beim Ausdruck steht der
  Hinweis auf PSPACE-Vollständigkeit (2.26).
- **Mehrbuchstabige Nichtterminale** wie `X0` werden längstmöglich erkannt, wenn sie
  deklariert sind. Angezeigt werden sie wie im Skript als X₀.
- **Hinweis zu egrep**: Tippt man `^ $ . + ? [ ] { }` in einen Ausdruck, erklärt ein
  Hinweis, dass das hier gewöhnliche Symbole sind und egrep-Regex erst mit M7 kommen.
  Anlass war ein Test im Browser: `^1234huo.` beschreibt genau ein Wort.

## Offen

- **`file://`**: In der Browser-Ansicht dieser Sitzung nicht prüfbar, sie öffnet keine
  Dateien. Getestet wurde der gebaute Stand über `vite preview`. Der Worker ist als Blob
  eingebettet; scheitert er, rechnet der Hauptthread.
- **Live-Aktualisierung** (SOLL 8.3): Veraltete Objekte werden markiert und lassen sich
  per Knopf neu berechnen. Automatisches Neuberechnen fehlt noch.
- **Entsprechungen über Hilfszustände**: Die in 2.71 erzeugten Hilfszustände haben keine
  Entsprechung. In der Potenzmengentabelle erscheinen sie mit ihrem Namen.
- **Zwischenstände im Schrittspieler** übernehmen die Positionen der Quelle nur für
  gleichnamige Zustände; neue Zustände legt das automatische Layout.
- **Äquivalenzmatrix** wächst quadratisch mit der Zahl der Objekte. Bei vielen Objekten
  wäre eine Auswahl sinnvoll.
- **Beispielmenü**: Die Einträge sind nach Kapitel sortiert, aber nicht streng nach Nummer.

## Nachtrag: egrep-Regex (vorgezogen aus M7) und Docker

Spezifikation: `docs/kern-spec-regex.md`, Skriptnotizen: `docs/skript-notizen-regex.md`.

- **Neue Objektart `egrep`** (`egrep R = (bb)c*(bb)`), getrennt vom regulären Ausdruck.
  - Unterstützt wird POSIX ERE wie egrep: Klassen `[…]`, `[^…]`, Bereiche, `[:digit:]` usw.
    (benannte Klassen stehen nicht im Skript), Punkt, `^ $`, `* + ? {n} {n,} {n,m}`,
    Gruppen, `|` und `\1`–`\9`.
  - Syntaxfehler werden mit Spalte gemeldet.
- **Regex-Tester**: Prüftext zeilenweise wie egrep. Treffer werden unterstrichen und folgen
  POSIX (am weitesten links, dann am längsten; Gruppen nach Reihenfolge, die nächste
  jeweils so früh und so lang wie möglich). Für die gewählte Zeile gibt es ein
  Gruppenraster wie in 3.23 und eine Tabelle der Treffer mit Positionen ab 1.
  - Beispiele 3.23 und 3.24 liegen im Menü. 3.23 stimmt Feld für Feld mit dem Skript
    überein.
  - Bei 3.24 ist Gruppe 2 ein leerer Treffer am Ende, nicht „unbeteiligt“.
- **Regex → regulärer Ausdruck** (7.4), sofort oder schrittweise:
  - Klassen und Punkt werden zu Vereinigungen über das Alphabet, `+`, `?` und `{n,m}`
    werden ausgeschrieben.
  - Ohne Anker wird `(a|b|…)*` davor bzw. dahinter ergänzt.
  - Mit Rückwärtsverweis gibt es keine Umwandlung (3.25), stattdessen einen Hinweis.
  - Danach stehen alle Verfahren aus 7.1 offen, auch der Äquivalenztest mit anderen
    Typ-3-Objekten.
  - Ohne ausdrückliches Alphabet nimmt die Umwandlung nur die Zeichen aus dem Muster.
    `.` und `[^…]` beziehen sich dann nur auf diese Zeichen. Das Alphabet lässt sich in der
    Ansicht setzen.
- **POSIX statt Spezifikation**: Für `(a|ab)(c|bcd)(d*)` auf `abcd` liefert der Matcher
  `ab`/`c`/`d`, also die POSIX-Antwort wie bei glibc. Meine Spezifikation hatte hier
  falsch `a`/`bcd`/`` erwartet.
- **Docker**:
  - `Dockerfile`: Node baut, nginx liefert aus; mit `/healthz` und `Cache-Control:
    no-cache` für `index.html`.
  - `.github/workflows/docker.yml`: erst Typprüfung, Lint und Tests, dann ein Image für
    amd64 und arm64 nach `ghcr.io/pilovr/automata-playground` (`latest` auf `main`,
    Kurz-SHA, Tags `v*`).
  - `docker-compose.yml` für Portainer.
  - Lokal gebaut und gestartet: 77 MB, Seite und Healthcheck antworten.
- **Tests**: 565, alle grün.
