# Spezifikation: egrep-Regex (Anforderungen 3.2, 5.2, 7.4)

Ergänzt `docs/kern-spec-m2.md`. Skript: `docs/skript-notizen-regex.md` (Kapitel 3). Wo das
Skript genauer ist als diese Datei, gilt das Skript; Abweichungen in der Rückmeldung nennen.
Regulärer Ausdruck (Kap. 2, `regex`) und Regex (Kap. 3, `egrep`) bleiben getrennte Arten
mit getrennter Syntax.

## Modell (`core/model/types.ts`, verbindlich)

```ts
export interface EgrepObj {
  kind: 'egrep';
  name: string;
  /** Muster genau wie getippt (die Textform ist das Muster selbst). */
  pattern: string;
  /** Alphabet für `.`, negierte Klassen und die Umwandlung; leer = aus Muster abgeleitet. */
  alphabet: Sym[];
  origin?: Origin;
}
```

`FormalObject` umfasst `EgrepObj`; neue `MethodId` `'egrep2regex'`; neue Diagnosecodes
`egrep.*` (siehe unten).

## Syntax (POSIX ERE wie egrep, so weit das Skript sie verwendet)

```ebnf
egrepobj  = "egrep" , ws , name , ws? , ( "=" , pattern , eol
          | "{" , { ws | comment | "alphabet" , { ws , symbol } | "=" , pattern | origin } , "}" ) ;
pattern   = (* Rest der Zeile, genau so gespeichert; kein Kommentar möglich *) ;
```

Muster-Grammatik (Präzedenz von stark nach schwach: Quantor, Verkettung, `|`):

```
alt     = concat { "|" concat }
concat  = { piece }
piece   = atom { quant }
quant   = "*" | "+" | "?" | "{" n "}" | "{" n ",}" | "{" n "," m "}"
atom    = char | "." | "^" | "$" | class | "(" alt ")" | "\" digit | "\" char
class   = "[" ["^"] ( "]" | item ) { item } "]"
item    = char "-" char | "[:" name ":]" | char
```

- Benannte Klassen: `alpha digit alnum upper lower space punct xdigit blank` (ASCII).
- `\1` … `\9` Rückwärtsverweis; `\` vor anderem Zeichen = dieses Zeichen.
- Leere Alternative (`a|`, `()`) ist nach POSIX erlaubt und passt auf ε.
- Fehler mit Spalte: `egrep.unbalanced` {open}, `egrep.badClass`, `egrep.badRange` {from,to},
  `egrep.badRepeat` {text}, `egrep.nothingToRepeat`, `egrep.badBackref` {n} (Gruppe existiert
  nicht oder ist noch nicht geschlossen), `egrep.badClassName` {name}.
- Gruppen werden nach ihrer öffnenden Klammer nummeriert (3.x).

```ts
export type EgrepNode =
  | { t: 'char'; c: string }
  | { t: 'any' }
  | { t: 'class'; negated: boolean; chars: string[]; ranges: [string, string][]; named: string[] }
  | { t: 'bol' } | { t: 'eol' }
  | { t: 'group'; index: number; inner: EgrepNode }
  | { t: 'backref'; n: number }
  | { t: 'concat'; items: EgrepNode[] }
  | { t: 'alt'; items: EgrepNode[] }
  | { t: 'repeat'; inner: EgrepNode; min: number; max: number | null };
```

## Schnittstelle (`core/index.ts`)

```ts
export function parseEgrep(pattern: string): { ast: EgrepNode | null; groups: number; diagnostics: Diagnostic[] };
export function printEgrepAst(n: EgrepNode): string;           // für Anzeige/Tests, kanonisch
export interface EgrepMatch {
  from: number; to: number;                                   // Codepoint-Indizes in der Zeile, to exklusiv
  groups: ({ from: number; to: number } | null)[];             // groups[0] = Gruppe 1 …
}
/** Erster Treffer ab `start` nach POSIX: am weitesten links, dann am längsten. */
export function egrepFirst(ast: EgrepNode, groups: number, line: string, start?: number, opts?: { stepLimit?: number }): EgrepMatch | null | 'limit';
/** Alle nicht überlappenden Treffer von links nach rechts (wie egrep -o; leerer Treffer → eine Stelle weiter). */
export function egrepAll(ast: EgrepNode, groups: number, line: string, opts?: { stepLimit?: number }): EgrepMatch[] | 'limit';
/** Zeile passt (egrep gibt sie aus)? */
export function egrepTest(o: EgrepObj, line: string): boolean | null;
/** Umwandlung in einen regulären Ausdruck nach 2.21 (7.4). */
export function egrepToRegex(o: EgrepObj, opts?: ProcOptions): ProcResult<RegexObj>;
```

### Treffer (POSIX)

- Zeilenweise; `^` passt nur an Position 0, `$` nur am Zeilenende.
- Gesamttreffer: kleinster Anfang, dann größte Länge.
- Gruppen bei Mehrdeutigkeit nach POSIX: Teilausdrücke in Reihenfolge von links nehmen
  jeweils den am weitesten links beginnenden, dann längsten Teiltreffer, der mit dem
  Gesamttreffer verträglich ist; eine Gruppe in einer Wiederholung hält ihren letzten
  Durchlauf. Wo das Skript ein Beispiel gibt (3.23), muss das Ergebnis genau stimmen.
- Umsetzung frei (Rückverfolgung mit Aufzählung aller Enden ist in Ordnung); Rechenaufwand
  durch `stepLimit` (Standard 200 000) begrenzt → `'limit'`, nie hängen.

### Umwandlung `egrepToRegex` (7.4)

- Alphabet A: `o.alphabet`, wenn nicht leer, sonst alle Zeichen, die im Muster wörtlich
  vorkommen, plus alle Zeichen aus Bereichen und benannten Klassen (geordnet nach Codepoint).
  Bereiche/benannte Klassen, die mehr als 128 Zeichen ergäben, → Diagnose `egrep.alphabetTooLarge`.
- `.` = Vereinigung aller Zeichen aus A; `[…]` / `[^…]` = Vereinigung der passenden Zeichen aus A
  (leer → ∅).
- `R+` = `RR*`, `R?` = `(R|∅*)`, `R{n,m}` ausgeschrieben, `R{n,}` = n-mal R, dann `R*`.
- Sprache = Menge der Zeilen über A, in denen das Muster einen Treffer hat: ohne `^` wird
  `(a|b|…)*` vorangestellt, ohne `$` angehängt. `^` nur am Anfang und `$` nur am Ende jeder
  Alternative der obersten Ebene; sonst Diagnose `egrep.anchorInside`.
- Rückwärtsverweis → Fehler `egrep.backref` (3.25: Sprache im Allgemeinen nicht regulär);
  es wird keine Umwandlung angeboten.
- Schritte: je Umschreibung ein Schritt mit Schlüssel `proc.egrep.class` {text, alphabet},
  `proc.egrep.any`, `proc.egrep.plus`, `proc.egrep.optional`, `proc.egrep.repeat` {min,max},
  `proc.egrep.anchor` {which: 'start'|'end'}, `proc.egrep.result`; view.obj = bisheriger
  RegexObj. Alle Schlüssel in `EXPLANATION_KEYS`.
- Ergebnis: RegexObj mit `origin` (method `egrep2regex`), Name `opts.name` oder Quelle + `_ra`.
- `runMethod('egrep2regex', [o])` und `applicableMethods` (egrep → egrep2regex) ergänzen;
  `toDea`, `accepts`, `equivalent`, `enumerate` behandeln egrep über die Umwandlung
  (mit Rückwärtsverweis: `accepts` über `egrepTest`, `toDea` null).

### Textform, JSON, Prüfung

- Kurzform `egrep R2 = ^[a-z]+$` (Muster bis Zeilenende, roh, inkl. `#`); Blockform mit
  `alphabet` und `herkunft`. Printer: Kurzform ohne alphabet/origin, sonst Block.
- `validate`: Syntaxfehler des Musters als Diagnosen (ohne Zeile/Spalte im Text; mit
  `params.col`); Warnung `egrep.backrefNotRegular` bei Rückwärtsverweisen.
- JSON prüft `pattern` (string) und `alphabet`. Round-Trip wie bisher.
- `objectHash`, `reconcile` (Ergebnis = next) wie bei regex.

## Tests (Tester)

Alle Beispiele aus `skript-notizen-regex.md` (Treffer und Gruppen genau, 3.23
vollständig); Syntaxfehler; POSIX-Fälle: `(a|ab)(c|bcd)(d*)` auf `abcd` → Gesamt `abcd`,
Gruppen `a`/`bcd`/`` nach POSIX-Regel; `(a*)*` auf `b` → leerer Treffer an 0; Anker;
Rückwärtsverweis `(a+)b\1` auf `aabaa`; Umwandlung: für zufällige backref-freie Muster über
{a,b} stimmt `egrepTest` mit `accepts(egrepToRegex(...))` für alle Zeilen bis Länge 6
überein; Round-Trip Text/JSON.
