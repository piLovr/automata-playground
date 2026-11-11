# Skript-Notizen Regex (Skript.pdf, Kapitel 3, Auszug)

Quelle: Thomas Worsch, "Formale Sprachen und Automaten", Stand 1. November 2010.
Seiten im PDF = Skriptseiten. Umfang: Kapitel 3 vollständig, S. 35–44 (Absätze 3.1–3.29, Abschnitte 3.1–3.7).
Nummern: Absatznummern (3.1–3.29) werden verwendet. Abschnittsnummern (3.1–3.7) stehen in Klammern. Siehe UNKLAR 1.

Variante: GNU egrep, extended regexes (ERE-Syntax: `|`, `()`, `+`, `?`, `{}` unmaskiert). grep/BRE wird im Kapitel nicht behandelt.

## Testdatei `liste` (3.1, S. 36)

| Zeile | Inhalt | Anzahl g |
|---|---|---|
| 0 | huo | 0 |
| 1 | hugo | 1 |
| 2 | huggo | 2 |
| 3 | hugggo | 3 |

Jede Zeile beginnt mit einer Ziffer und endet mit `o`.

## Abschnitt 3.1 Anwendungsszenario (unnummeriert, S. 35)

- Eingabe: Datei (Zeilen = Wörter w), Regex R. Ausgabe: Zeilen, die gematcht werden.
- Match: R matcht in w ⇔ w enthält ein Teilwort v mit v ∈ ⟨R⟩.
- Beispiel: R = 001|11101, w = 11001001000 → Match (001 an 2 Stellen).

## Abschnitt 3.2 Variante (unnummeriert, S. 35–36)

- Keine einheitliche egrep-Implementierung. Skript-Syntax = extended regexes von GNU egrep.

## 3.1 Beispiele Aufruf (S. 36)

Aufruf: `egrep 'Regex' Datei` (Regex in single quotes).

| Muster | Ausgabe (Zeilen-Nr.) |
|---|---|
| `hugo` | 1 |
| `uo\|ggg` | 0, 3 |
| `ggg*` (≡ `gg(g)*`) | 2, 3 |
| `(gg)*` | 0, 1, 2, 3 (leeres Teilwort) |

## 3.2 Übernahme der Syntax (S. 37)

- Die Konstrukte regulärer Ausdrücke (außer Ø) werden von egrep akzeptiert und gleich interpretiert.

## 3.3 Bequemere Notation (S. 37)

| Kurzform | Äquivalent |
|---|---|
| ε | Ø* |
| R+ | RR* |
| R? | R\|ε |

## 3.4 Beispiele Kurzformen (S. 37)

| Muster | Ausgabe | Äquivalent |
|---|---|---|
| `g+` | 1, 2, 3 | `gg*` |
| `g?` | 0, 1, 2, 3 | — |
| `W?` | 0, 1, 2, 3 | — |

## 3.5 Zeichenklassen (S. 37)

- `[x1 … xk]` = x1 | … | xk. Heißt Zeichenklasse.
- Bereich `[a-z]`: nur bei Zeichen mit natürlicher Reihenfolge (z. B. Buchstaben).

## 3.6 Beispiel Zeichenklassen (S. 37)

| Muster | Bedeutung laut Skript |
|---|---|
| `[a-zA-Z][a-zA-Z0-9]*` | C-Variablennamen ohne Unterstrich |

## 3.7 Beispiele Klassen (S. 38)

| Muster | Ausgabe | Hinweis |
|---|---|---|
| `[defg]` | 1, 2, 3 | ≡ `[d-g]` |
| `[d-g]` | 1, 2, 3 | ≡ `[defg]` |

## 3.8 Negierte Zeichenklasse (S. 38)

- `[^x1 … xk]` = alle Zeichen außer x1, …, xk.

## 3.9 Beispiel negiert (S. 38)

| Muster | Ausgabe |
|---|---|
| `[^1234hugo. ]` | 0 |

Zeile 0 (`huo`) enthält ein Zeichen, das nicht in {1,2,3,4,h,u,g,o,.,Leerzeichen} liegt (die 0).

## 3.10 Quantoren mit Zahlen (S. 38)

Für nichtnegative ganze Zahlen x < y:

| Notation | Äquivalent |
|---|---|
| R{x} | (R)…(R), x-mal |
| R{x,} | R{x}R* |
| R{x,y} | (R)…(R) (R?)…(R?), x-mal R, dann (y − x)-mal R? |

Spezialfälle:

| Ausdruck | Äquivalent |
|---|---|
| ε | R{0} |
| R | R{1} |
| R* | R{0,} |
| R+ | R{1,} |
| R? | R{0,1} |

## 3.11 Beispiel Quantor (S. 38–39)

| Muster | Ausgabe | Hinweis |
|---|---|---|
| `[oguh]{5,}` | 2, 3 | Zeile 2: `huggo`, Zeile 3: `hugggo` |
| `[ouh]{5,}` | (leer) | keine Zeile mit 5 direkt folgenden Zeichen aus {o,u,h} |
| `[ogh]{5,}` | (leer) | Zeile 3: längster Lauf aus {o,g,h} = 4 (`ggg`+`o`, nach `u`); Skript-Text nennt `u` (siehe UNKLAR 14) |

## 3.12 Punkt (S. 39)

- `.` steht für ein beliebiges einzelnes Zeichen.

## Abschnitt 3.4 Metazeichen in Zeichenklassen (S. 39–40)

### 3.13 Metazeichen in Klassen

- In Zeichenklassen sind `-`, `^`, `]`, `[` Metazeichen.

### 3.14 Regeln für wörtliche Verwendung (GNU egrep, S. 39)

| Zeichen | Stellung | Bedeutung |
|---|---|---|
| `-` | unmittelbar nach `[` oder nach `[^` | wörtlich |
| `^` | nicht unmittelbar nach `[` | wörtlich |
| `]` | unmittelbar nach `[` oder nach `[^` | wörtlich |
| `[` | unmittelbar nach `[` oder nach `[^` | wörtlich |

### 3.15 Beispiel Klammern (S. 39–40)

Datei `klammern`: Zeile 1 = `[`, Zeile 2 = `]`.

| Muster | Ausgabe |
|---|---|
| `[[]` | `[` |
| `[]]` | `]` |
| `[^[]` | `]` |
| `[^]]` | `[` |
| `[^^]` | `[` und `]` |

## Abschnitt 3.5 Anker (S. 40–41)

### 3.16 Anker

| Anker | Bedeutung |
|---|---|
| `^` | Zeichenkettenanfang |
| `$` | Zeichenkettenende |

- Anker matcht das leere Wort an einer festen Stelle, nicht das Zeichen `^` bzw. `$`.

### 3.17 Beispiele Anker

| Muster | Ausgabe | Hinweis |
|---|---|---|
| `ugg` | 2, 3 | enthält `ugg` |
| `ugg$` | (leer) | keine Zeile endet mit `ugg` |
| `^ugg` | (leer) | keine Zeile beginnt mit `ugg` |
| `ggo$` | 2, 3 | Zeilen enden mit `ggo` |

## Abschnitt 3.6 Gruppierungen und Rückwärtsverweise (S. 41–43)

### 3.18 Mehrdeutigkeiten (Beispiele)

| Nr. | R | w | Frage |
|---|---|---|---|
| 1 | `aa\|bb` | `_aa_bb_` | welches Vorkommen (aa oder bb)? |
| 2 | `bb*` | `abbbbc` | nur ein b, zwei, drei oder vier? |
| 3 | `b\|bbb` | `abbbc` | nur b oder bbb? |

### 3.19 Regel 1

- Ein weiter vorne beginnender exakter Match wird einem weiter hinten beginnenden immer bevorzugt.

### 3.20 Regel 2

| Regel | Inhalt |
|---|---|
| 2a (POSIX) | Bei gleichem Startpunkt wird der längere Match dem kürzeren immer bevorzugt. |
| 2b (z. B. Perl) | Festlegung komplizierter, nicht näher spezifiziert (Verweis auf Friedl). |

### 3.21 Beispiele Regeln

| R | w | Ergebnis | Regel |
|---|---|---|---|
| `aa\|bb` | `_aa_bb_` | `aa` | 1 |
| `bb*` | `abbbbc` | `bbbb` | 2a (Perl ebenfalls `bbbb`) |
| `.*` | beliebig | matcht immer alles | — |

### 3.22 Gruppen

- `( … )` bildet ein Teilausdruck (Gruppe).
- Gruppe 0 = gesamter Regex (auch wenn nicht geklammert).
- Gruppennummer = Nummer der öffnenden Klammer, von links gezählt, einschließlich.
- Implementierungsgrenzen bei Anzahl und Schachtelungstiefe möglich (werkzeugabhängig).

### 3.23 Beispiele Gruppen

**Beispiel 1:** w = `zzbbcbbz`, R = `(bb)c(bb)`. Unterstreichung laut Skript: jedes Teilwort einer Gruppierung, darunter die Gruppennummer.

| Pos | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| w | z | z | b | b | c | b | b | z |
| Gruppe 0 | | | x | x | x | x | x | |
| Gruppe 1 | | | x | x | | | | |
| Gruppe 2 | | | | | | x | x | |

Gruppe 0 = `bbcbb` (Pos 3–7), Gruppe 1 = `bb` (Pos 3–4), Gruppe 2 = `bb` (Pos 6–7).

**Beispiel 2:** w = `zzbbcbbzzzbbcccbb`, R = `(bb)c*(bb)`. Skript zeigt nur den ersten Match.

| Pos | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| w | z | z | b | b | c | b | b |
| Gruppe 0 | | | x | x | x | x | x |
| Gruppe 1 | | | x | x | | | |
| Gruppe 2 | | | | | | x | x |

Gruppe 0 = `bbcbb` (Pos 3–7), Gruppe 1 = `bb` (Pos 3–4), Gruppe 2 = `bb` (Pos 6–7). Der Match endet bei Pos 7, Pos 8 ff. (`zzzbbcccbb`) ist nicht dargestellt.

### 3.24 Beispiel `(.*)(.*)` auf `abcdefg`

| Gruppe | Pos | Teilwort |
|---|---|---|
| 0 | 1–7 | abcdefg |
| 1 | 1–7 | abcdefg (gefräßig, längstmöglich) |
| 2 | — | nichts (leer) |

### 3.25 Rückwärtsverweise

- Nach Abschluss von Gruppe i: `\i` = Teilwort, das genau von Gruppe i gematcht wurde.
- Implementierungseinschränkung (mitunter): nur einstellige Gruppennummern.

### 3.26 Beispiel `(abc|xyz)\1`

| Wort | Match |
|---|---|
| `abcabc` | ja |
| `xyzxyz` | ja |
| `abcxyz` | nein |

Skript verweist zum Vergleich auf `(abc|xyz)(abc|xyz)`; kein Ergebnis angegeben.

### 3.27 Beispiel Rückwärtsverweis mit Gruppen

Datei `liste2`: Zeile k enthält k g (Zeilen 0–8, Zeile 8 mit 8 g).

| Muster | Ausgabe | Gruppen |
|---|---|---|
| `((gg)+)\1` | 4, 5, 6, 7, 8 | 1 = `((gg)+)`, 2 = `(gg)` |
| `u((gg)+)\1o` | 4, 8 | wie oben |

### 3.28 Beispiel `(.*).*(\1)` auf `abcxabca`

Gruppen: 1 = erstes `(.*)`, 2 = `(\1)`. Das `.*` dazwischen ist nicht geklammert.

| Variante | Gruppe 1 | Gruppe 2 | Gruppe 0 (Gesamtmatch) | Länge Gesamt |
|---|---|---|---|---|
| 1 (Gruppe 1 gefräßig) | Pos 1–3 `abc` | Pos 5–7 `abc` | Pos 1–7 `abcxabc` | 7 |
| 2 (Gruppe 1 = `a`) | Pos 1 `a` | Pos 8 `a` | Pos 1–8 `abcxabca` | 8 |

- Gruppe 1 gefräßig → Gesamtmatch kürzer. Gruppenmatch 1 kürzer → Gesamtmatch länger.
- Alle Varianten beginnen bei Pos 1 (Regel 1).

## Abschnitt 3.7 Metazeichen als reguläre Zeichen (S. 44)

### 3.29 Metazeichen und Escape

- Originalmetazeichen: `Ø`, `(`, `)`, `|`, `*`.
- Verallgemeinert (außerhalb von Zeichenklassen): `.`, `+`, `?`, `[`, `]`, `{`, `}`.
- Escape: `\` vor Metazeichen macht es zum Literal. `\` selbst ist dann auch Metazeichen.

---

## UNKLAR

1. Nummerierung: Abschnitt 3.2 (Titel) und Absatz 3.2 (Text) tragen dieselbe Nummer, ebenso 3.1 und 3.3–3.7. Notizen verwenden Absatznummern.
2. 3.12: "für ein x-beliebiges Zeichen steht" (wörtlich). Vermutlich "ein beliebiges Zeichen".
3. 3.18/3.21: In `_aa_bb_` ist `_` Platzhalter für Trennung oder Zeichen? Für das Matchergebnis `aa` irrelevant.
4. 3.18.3 (`b|bbb` auf `abbbc`): Skript nennt kein Ergebnis. Nach Regel 2a wäre `bbb` zu erwarten, aber nicht explizit angegeben.
5. 3.19: "(nahezu?)" – Skript selbst unsicher, ob Regel 1 für alle Werkzeuge gilt.
6. 3.20 2b: Festlegung für "einige andere Werkzeuge (z. B. Perl)" nicht beschrieben.
7. 3.22: Implementierungsgrenzen "bei manchen Werkzeugen" nicht quantifiziert.
8. 3.24: Gruppe 2 "matcht nichts". Unklar, ob sie als leeres Teilwort (ε) gesetzt oder als nicht beteiligt gilt.
9. 3.28: Skript nennt keine Entscheidung, welche Variante (1 oder 2) POSIX liefert. Regel 2a würde Variante 2 (Länge 8) nahelegen, das Skript sagt es nicht explizit.
10. 3.23 Beispiel 2: Skript zeigt nur den ersten Match. Weitere Matches (z. B. ab Pos 11) sind nicht dargestellt.
11. 3.29: Verhalten von `\` innerhalb von Zeichenklassen und vor Buchstaben (z. B. `\d`) nicht spezifiziert.
12. 3.10: Bedingung x < y steht vor allen drei Notationen. Fälle x = y und R{0,} / R{0} werden nicht explizit behandelt (R{0} ≡ ε steht im Skript).
13. 3.14: "anderen Werkzeugen" nicht benannt.
14. 3.11: Text zu `[ogh]{5,}` nennt "Vorkommen der Buchstaben o, u und/oder h", die Klasse enthält aber kein `u`. Widerspruch im Skript.
