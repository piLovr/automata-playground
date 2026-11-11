# Plan M4: Kontextfreie Grammatiken, Ableitungsbäume, Kellerautomaten

Anforderungen: 6.2 (Grammatik-Simulation), 7.2 (Grammatik → NKA in beiden Richtungen,
Ableitungsbaum, Mehrdeutigkeit), 11 (M4). Abnahme: „NKA aus 4.6 akzeptiert 00001111 mit
der Konfigurationsfolge aus dem Skript; für S → ε | (S) | SS findet das Tool zwei Bäume zu
()()()“. Skriptnotizen: `docs/skript-notizen-m4.md`, `docs/skript-notizen-typen.md`.
Schon vorhanden: Kellerautomat mit Simulation, Verlaufstabelle wie 4.6, Konfigurationsbaum,
Beispiele 4.6/4.9, Grammatik-Objekt mit Typ-Erkennung.

## 1. Ableitungen und Ableitungsbäume (6.2 MUSS, 4.13–4.22)

Kern `core/derive/`:

```ts
interface Derivation { grammar: string; steps: { form: Word; production: ProductionId; pos: number }[] }
interface DerivTree { sym: Sym | null /* null = ε-Blatt */; production?: ProductionId; children: DerivTree[] }
applicable(g, form): { production: ProductionId; pos: number }[]   // alle Stellen, Typ 0–3
apply(g, form, production, pos): Word
leftmost(g, form): …                                                 // nur das linkeste Nichtterminal (Typ 2)
treeOf(g, derivation): DerivTree | null                              // 4.19, nur Typ 2
leftmostOf(tree) / rightmostOf(tree): Derivation                     // 4.22
```

Oberfläche (Grammatik-Ansicht, untere Leiste wird zum Ableitungs-Werkzeug):
- Satzform mit anklickbaren Stellen; die passenden Produktionen erscheinen, ein Klick
  wendet sie an. Schalter „Linksableitung“ beschränkt auf das linkeste Nichtterminal.
- Verlauf `S ⇒ SS ⇒ (S)S ⇒ …` mit Zurück. Daneben wächst der Ableitungsbaum (SVG,
  ε-Blätter wie in 4.20). Klick auf einen Knoten hebt die Teilableitung hervor.
- Zielwort eingeben → „Ableitung suchen“ (Worker): findet eine Linksableitung oder meldet
  ehrlich „nicht gefunden bis Grenze …“.

## 2. Alle Bäume eines Worts, Mehrdeutigkeit (7.2, 4.23–4.24)

- `parseTrees(g, w, limits)`: alle Ableitungsbäume von w über Linksableitungen mit
  Beschneidung (Terminalpräfix muss passen; Satzform darf nicht mehr Terminale und nicht
  ausleerbare Nichtterminale haben als |w|). Ergebnis nach Baumgröße geordnet.
- `findAmbiguity(g, maxLen)`: Wörter nach Länge durchgehen, das erste mit ≥ 2 Bäumen
  liefern. Ergebnis immer ehrlich: „gefunden: w mit zwei Bäumen“ oder „bis Länge n nichts
  gefunden“ – nie „eindeutig“.
- Anzeige: Bäume nebeneinander, Unterschiede hervorgehoben.
- **Frage 1** (unten): Bei 4.16 hat `()()()` unendlich viele Bäume.

## 3. Grammatik → Kellerautomat top-down (4.27, 4.28)

- Verfahren `grammar2nkaTopDown`: Zustände z0, z, z+; Kelleralphabet {*} ∪ T ∪ N; Start-,
  Produktions-, Lese- und Akzeptanzaktionen genau wie 4.27. Ergebnis ist ein gewöhnlicher
  NKA (Objekt mit Herkunft; Entsprechung Übergang ↔ Produktion).
- Akzeptanz nur nach vollständig gelesener Eingabe: Das ist schon die NKA-Semantik des Tools
  (4.5); die Lücke in der Tabelle 4.27 (UNKLAR 1) wird so geschlossen.
- „Lauf neben Linksableitung“ wie 4.28: Tabelle gelesen | Zustand | Keller | Aktion, daneben
  die Satzform αβ (gelesener Teil + Kellerinhalt ohne *) der Linksableitung; Sackgassen
  (falscher Zweig 4.28) im Konfigurationsbaum sichtbar.

## 4. Bottom-up (4.31–4.37)

- **Frage 2** (unten): Wie bilden wir den „modifizierten“ Kellerautomaten ab?
- Vorschlag: als Analyseverfahren der Grammatik mit Lauf wie Tabelle 4.34 (Keller mit
  oberstem Symbol rechts, Zustand, ungelesener Rest, nächste Aktion), Suche über alle
  Schiebe-/Reduktionsentscheidungen (4.37), gefundener Lauf plus Anzahl verworfener Zweige.
  Ausgabe: die Rechtsableitung von hinten nach vorne (4.36), dazu der Baum.

## 5. Kellerautomat abrunden

- Option „Akzeptanz über leeren Keller“ (Abschnitt 12, abschaltbar): Das Skript definiert sie
  nicht; „leer“ heißt bei ihm „nur noch y₀“ (Notizen). Umsetzung: akzeptiert, wenn die
  Eingabe gelesen ist und nur y₀ im Keller liegt; als „nicht im Skript“ markiert.
- DKA-Prüfung bleibt Hinweis (wie bisher).

## 6. Sprach-Explorer für kontextfreie Grammatiken

- Wörter und Anzahlen über die Ableitungssuche aus 2; „exakt bis Länge n“, wenn die Suche
  ohne Grenze fertig wird, sonst „Stichprobe“.
- Äquivalenz für Typ 2 ist unentscheidbar: Vergleich auf der Arbeitsfläche nur als
  Stichprobe bis Länge n (8.6), deutlich so beschriftet. Grammatik ↔ NKA aus 3 lässt sich so
  gegeneinander prüfen.

## 7. Beispiele

4.15–4.18 (Grammatiken), 4.16 (Klammern, mehrdeutig), 4.24 Ende (eindeutige
Klammergrammatik S → ε | ST, T → (S)), 4.28 (NKA aus 4.16 mit Lauf für (())()), 4.34.

## 8. Agenten

| Schritt | Agent | Auftrag |
|---|---|---|
| 1 | ich | Typen, `docs/kern-spec-m4.md` |
| 2a | kern-entwickler | `core/derive/` (Ableitung, Bäume, Suche, Mehrdeutigkeit, Explorer-Anbindung) |
| 2b | kern-entwickler | `core/algo/` Grammatik → NKA top-down, Bottom-up-Analyse, Option leerer Keller in `core/sim/nka.ts` |
| 2c | geruest | Beispieldateien Kapitel 4, Einträge in `examples/index.json` |
| 2d | tester | Tests: 4.20–4.24, 4.28 Zeile für Zeile, 4.34 Zeile für Zeile, Abnahme 4.6 und ()()() |
| 2e | ich | Oberfläche: Ableitungs-Werkzeug, Baum-SVG, Bäume vergleichen, Läufe 4.28/4.34, Optionen |
| 3 | fehlersucher | bei Bedarf |
| 4 | ich | Browser-Abnahme, `docs/stand-m4.md`, Commit, Merge nach Rückfrage |

## 9. Fragen

1. Unendlich viele Bäume (Grammatik 4.16, Wort `()()()`): Vorschlag „alle Bäume bis zu einer
   Knotenzahl, nach Größe geordnet; das Tool zeigt die zwei kleinsten wie in 4.24 und meldet
   ausdrücklich, dass es wegen S ⇒⁺ S unendlich viele gibt“.
2. Bottom-up-Automat: als Analyseverfahren mit Lauf wie 4.34 (Vorschlag) oder als eigene
   Objektart „modifizierter Kellerautomat“ mit Graph und Tabelle?

### Entscheidungen (2026-11-11)

1. Bäume nach Größe aufzählen (einstellbare Knotenzahl), die kleinsten zuerst; bei
   Zyklen (X ⇒⁺ X) steht ausdrücklich der Hinweis, dass es unendlich viele gibt.
2. Bottom-up als Analyseverfahren mit Lauf wie 4.34, keine neue Objektart.
