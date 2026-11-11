// Verbindliche Typen der Kernbibliothek (Schnittstelle zur Oberfläche).
// Änderungen nur in Absprache: die Oberfläche baut direkt auf diesen Typen auf.

/** Ein Symbol. Länge 1 = ein Zeichen; Länge > 1 wird im Text als <name> geschrieben. */
export type Sym = string;
/** Ein Wort über Symbolen. Das leere Array ist ε. */
export type Word = Sym[];
/** Stabile interne Zustandskennung, unabhängig vom angezeigten Namen. */
export type StateId = string;
export type TransitionId = string;

export interface Point {
  x: number;
  y: number;
}

export interface State {
  id: StateId;
  /** Angezeigter Name, je Objekt eindeutig. */
  name: string;
  /** Optionale Layout-Angabe; fehlt sie, setzt die Oberfläche autoLayout ein. */
  pos?: Point;
}

export interface Transition<L> {
  id: TransitionId;
  from: StateId;
  to: StateId;
  label: L;
}

/**
 * Gemeinsamer Grundtyp aller Zustandsmaschinen.
 * K: Typkennung, L: Kantenbeschriftung, S: Zusatzfelder je Zustand (z. B. Moore-Ausgabe).
 */
export interface AutomatonBase<K extends string, L, S extends object = object> {
  kind: K;
  name: string;
  /** X; Reihenfolge = Spaltenreihenfolge der Tabelle. */
  alphabet: Sym[];
  /** Z; Reihenfolge = Zeilenreihenfolge der Tabelle. */
  states: (State & S)[];
  /** z0 */
  start: StateId | null;
  /** F */
  accept: StateId[];
  transitions: Transition<L>[];
  /** Herkunft, falls das Objekt durch ein Verfahren entstanden ist (M2). */
  origin?: Origin;
}

/** DEA M = (Z, z0, X, f, F), f : Z × X → Z. Jede Kante trägt genau ein Symbol. */
export type DEA = AutomatonBase<'dea', Sym>;
/** NEA N = (Z, z0, X, g, F), g : Z × X* → 2^Z. Kante trägt ein Wort; [] = ε. */
export type NEA = AutomatonBase<'nea', Word>;

/** Mealy-Automat M = (Z, z0, X, f, Y, g), g : Z × X → Y. Kante trägt Eingabe- und Ausgabesymbol. */
export interface MealyLabel {
  in: Sym;
  out: Sym;
}
export type Mealy = AutomatonBase<'mealy', MealyLabel> & {
  /** Y */
  outputAlphabet: Sym[];
};

/** Moore-Automat M = (Z, z0, X, f, Y, g), g : Z → Y. Ausgabe steht am Zustand; out fehlt = undefiniert. */
export type Moore = AutomatonBase<'moore', Sym, { out?: Sym }> & {
  outputAlphabet: Sym[];
};

/** Kellerautomat: Übergang (z, y, x) → (z', v). read null = ε (kein Eingabesymbol). push: erstes Symbol liegt oben. */
export interface NkaLabel {
  top: Sym;
  read: Sym | null;
  push: Word;
}
export type NKA = AutomatonBase<'nka', NkaLabel> & {
  /** Kelleralphabet Y (enthält y0). */
  stackAlphabet: Sym[];
  /** Anfangskellersymbol y0. */
  y0: Sym;
};

/** Turingmaschine: f : Z × Y → Z × Y × {−1, 0, 1}. accept = F+, reject = F−. alphabet = Eingabealphabet X. */
export interface TmLabel {
  read: Sym;
  write: Sym;
  move: -1 | 0 | 1;
}
export type TM = AutomatonBase<'tm', TmLabel> & {
  /** Bandalphabet Y (enthält X und blank). */
  tapeAlphabet: Sym[];
  blank: Sym;
  /** F− */
  reject: StateId[];
};

export type Automaton = DEA | NEA | Mealy | Moore | NKA | TM;
/** Arten der Zustandsmaschinen (Graph-, Tabellen-Editor, Simulation). */
export type ObjectKind = Automaton['kind'];

// ---------------------------------------------------------------------------
// M2: regulärer Ausdruck (2.21), Grammatik (2.34), Herkunft

/**
 * Regulärer Ausdruck nach 2.21 als Syntaxbaum. ε gibt es nicht als Zeichen;
 * die Eingabe ε wird als (∅*) gelesen.
 */
export type RegExpr =
  | { op: 'empty' } // ∅
  | { op: 'sym'; sym: Sym } // a ∈ A
  | { op: 'union'; left: RegExpr; right: RegExpr } // (R1|R2)
  | { op: 'concat'; left: RegExpr; right: RegExpr } // (R1R2)
  | { op: 'star'; inner: RegExpr }; // (R*)

/**
 * Pfad zu einem Teilausdruck: Folge von Kindindizes ab der Wurzel
 * (0 = left bzw. inner, 1 = right); [] = ganzer Ausdruck.
 */
export type ExprPath = number[];

export interface RegexObj {
  kind: 'regex';
  name: string;
  /** A; ohne `alphabet`-Angabe die Symbole des Ausdrucks in Reihenfolge des ersten Auftretens. */
  alphabet: Sym[];
  /** null = noch kein Ausdruck. */
  expr: RegExpr | null;
  origin?: Origin;
}

export type ProductionId = string;
export interface Production {
  id: ProductionId;
  /** Linke Seite (Typ 0: beliebiges Wort mit mindestens einem Nichtterminal). */
  left: Word;
  /** Rechte Seite; [] = ε. */
  right: Word;
}

/** Grammatik G = (N, T, S, P) nach 2.34. */
export interface Grammar {
  kind: 'grammatik';
  name: string;
  /** N, Reihenfolge = Anzeige. */
  nonterminals: Sym[];
  /** T */
  terminals: Sym[];
  /** S */
  start: Sym | null;
  /** P, Reihenfolge = Anzeige. */
  productions: Production[];
  origin?: Origin;
}

/** Regex in der Schreibweise von egrep (Kapitel 3, POSIX ERE); getrennt vom regulären Ausdruck. */
export interface EgrepObj {
  kind: 'egrep';
  name: string;
  /** Muster genau wie getippt. */
  pattern: string;
  /** Alphabet für `.`, negierte Klassen und die Umwandlung; leer = aus dem Muster abgeleitet. */
  alphabet: Sym[];
  origin?: Origin;
}

/** Syntaxbaum eines egrep-Musters. */
export type EgrepNode =
  | { t: 'char'; c: string }
  | { t: 'any' }
  | { t: 'class'; negated: boolean; chars: string[]; ranges: [string, string][]; named: string[] }
  | { t: 'bol' }
  | { t: 'eol' }
  | { t: 'group'; index: number; inner: EgrepNode }
  | { t: 'backref'; n: number }
  | { t: 'concat'; items: EgrepNode[] }
  | { t: 'alt'; items: EgrepNode[] }
  | { t: 'repeat'; inner: EgrepNode; min: number; max: number | null };

export interface EgrepMatch {
  /** Codepoint-Indizes in der Zeile, to exklusiv. */
  from: number;
  to: number;
  /** groups[0] = Gruppe 1; null = Gruppe nicht beteiligt. */
  groups: ({ from: number; to: number } | null)[];
}

/** Endliche Sprache (Kapitel 1), z. B. {01, 1}. */
export interface MengeObj {
  kind: 'menge';
  name: string;
  /** Alphabet; ohne Angabe die Symbole der Wörter in Reihenfolge des ersten Auftretens. */
  alphabet: Sym[];
  /** Wörter, ohne Doppelte, nach Länge und dann lexikographisch (Alphabetreihenfolge). */
  words: Word[];
  /**
   * Gesetzt, wenn die Menge ein unendliches Ergebnis (L*, L+) bis zu dieser Länge abschneidet;
   * die Menge ist dann nur bis Länge upTo vollständig.
   */
  upTo?: number;
  origin?: Origin;
}

/** Alle Objekte eines Dokuments. */
export type FormalObject = Automaton | RegexObj | Grammar | EgrepObj | MengeObj;
export type FormalKind = FormalObject['kind'];

/** Verfahren, die ein neues Objekt erzeugen (Herkunft). */
export type MethodId =
  | 'nea2dea' // 2.71, 2.72, 2.74
  | 'splitWords' // nur 2.71
  | 'removeEpsilon' // nur 2.72
  | 'powerset' // nur 2.74
  | 'dea2regex' // 2.30
  | 'dea2regexElim' // Zustandselimination, nicht im Skript
  | 'regex2grammar' // 2.52–2.54 (+ Ergänzungen)
  | 'grammar2nea' // 2.69
  | 'dea2grammar' // 2.49/2.50
  | 'thompson' // nicht im Skript
  | 'complement' // 2.33
  | 'intersection' // 2.33
  | 'union' // Produktautomat, nicht im Skript
  | 'reachable' // 2.82
  | 'minimize' // 2.90
  | 'mealy2moore' // nicht im Skript
  | 'moore2mealy' // nicht im Skript
  | 'egrep2regex' // 7.4: Regex (Kap. 3) → regulärer Ausdruck (Kap. 2)
  | 'sprachop'; // Sprachrechner (1.6–1.9): Ergebnis eines Ausdrucks über Mengen

/** Verweis auf ein Element eines Objekts (Hervorhebung, Entsprechungen). */
export type ElemRef =
  | { state: StateId }
  | { transition: TransitionId }
  | { nonterminal: Sym }
  | { production: ProductionId }
  | { subexpr: ExprPath };

/** Element des erzeugten Objekts ↔ Elemente einer Quelle. */
export interface Correspondence {
  target: ElemRef;
  /** Index in Origin.sources. */
  source: number;
  elems: ElemRef[];
}

export interface Origin {
  method: MethodId;
  /** Namen der Quellobjekte. */
  sources: string[];
  /** objectHash der Quellen beim Erzeugen (gleiche Reihenfolge); Abweichung = veraltet. */
  sourceHash: string[];
  corr?: Correspondence[];
}

export interface Document {
  version: 1;
  objects: FormalObject[];
}

// ---------------------------------------------------------------------------
// Meldungen: der Kern liefert nur Code + Parameter, keine Texte.

export type DiagnosticCode =
  // Text/JSON
  | 'syntax.unexpected' // params: { found: string; expected: string[] }
  | 'syntax.unterminated' // params: { what: 'object' | 'label' | 'symbol' }
  | 'syntax.badEscape' // params: { char: string }
  | 'syntax.unknownKind' // params: { kind: string }
  | 'syntax.duplicateObject' // params: { name: string }
  | 'syntax.duplicateStatement' // params: { statement: 'start' }
  | 'syntax.badNumber' // params: { text: string }
  | 'json.invalid' // params: { reason: string }
  | 'json.version' // params: { version: unknown }
  // Modell
  | 'model.noStart'
  | 'model.unknownState' // params: { name: string }
  | 'model.duplicateStateName' // params: { name: string }
  | 'model.symbolNotInAlphabet' // params: { symbol: Sym; transitionId }
  | 'dea.labelLength' // params: { label: Word; transitionId }  (DEA: genau ein Symbol)
  | 'dea.nondeterministic' // params: { state: StateId; symbol: Sym; transitionIds: TransitionId[] }
  | 'dea.missing' // params: { pairs: { state: StateId; symbol: Sym }[] }  (Warnung; auch Mealy/Moore)
  | 'label.shape' // params: { kind: ObjectKind; text: string }  (Beschriftung passt nicht zum Typ)
  | 'moore.missingOut' // params: { states: StateId[] }  (Warnung)
  | 'nka.y0' // params: { transitionId }  (oben y0 gelesen, gekellertes Wort endet nicht auf y0)
  | 'nka.nondeterministic' // params: { transitionIds: TransitionId[] }  (Hinweis: verletzt DKA-Bedingung 4.4; severity 'warning')
  | 'tm.nondeterministic' // params: { state: StateId; symbol: Sym; transitionIds }
  | 'tm.leavesFinal' // params: { state: StateId; transitionIds }  (Endzustände werden nicht verlassen)
  | 'tm.finalOverlap' // params: { states: StateId[] }  (Zustand zugleich in F+ und F−)
  // Regulärer Ausdruck (Parser, Liste 2.22)
  | 'regex.missingOperand' // params: { op: '|' | '*'; side: 'left' | 'right' }  z. B. (|1), *(01), a|
  | 'regex.emptyParens' // ()
  | 'regex.unbalanced' // params: { open: number }  ((01) bzw. 01)
  | 'regex.symbolNotInAlphabet' // params: { symbol: Sym }  (validate, 2.22 „2*“)
  | 'regex.noExpr' // Warnung: Objekt ohne Ausdruck
  // Grammatik
  | 'grammar.noStart' // kein Startsymbol
  | 'grammar.startNotNonterminal' // params: { symbol: Sym }
  | 'grammar.overlap' // params: { symbols: Sym[] }  N ∩ T ≠ ∅
  | 'grammar.leftNoNonterminal' // params: { productionId }  linke Seite ohne Nichtterminal
  | 'grammar.unknownSymbol' // params: { symbol: Sym; productionId }  weder in N noch in T
  // egrep (Kapitel 3)
  | 'egrep.unbalanced' // params: { open: number; col }
  | 'egrep.badClass' // params: { col }
  | 'egrep.badRange' // params: { from: string; to: string; col }
  | 'egrep.badRepeat' // params: { text: string; col }
  | 'egrep.nothingToRepeat' // params: { col }
  | 'egrep.badBackref' // params: { n: number; col }
  | 'egrep.badClassName' // params: { name: string; col }
  | 'egrep.backrefNotRegular' // Warnung: Rückwärtsverweis, Sprache im Allgemeinen nicht regulär (3.25)
  | 'egrep.backref' // Fehler bei der Umwandlung (3.25)
  | 'egrep.anchorInside' // ^ oder $ nicht am Rand einer Alternative
  | 'egrep.alphabetTooLarge' // params: { size: number }
  // Endliche Sprachen und Sprachrechner (Kapitel 1)
  | 'menge.duplicate' // Warnung: params: { word: Word }  Wort mehrfach angegeben
  | 'lang.unknownName' // params: { name: string; col }
  | 'lang.notFinite' // params: { name: string }  Objekt ist keine endliche Menge und kein Typ-3-Objekt
  | 'lang.syntax' // params: { found: string; expected: string[]; col }
  | 'lang.truncated' // Warnung: params: { upTo: number }  L* bzw. L+ nur bis Länge upTo
  | 'lang.tooLarge' // params: { limit: number }  mehr Wörter als erlaubt
  // Verfahren
  | 'algo.wrongKind' // params: { method: MethodId; kind: FormalKind }
  | 'algo.incomplete' // params: { pairs: { state: StateId; symbol: Sym }[] }  DEA nicht total (2.33, 2.90)
  | 'algo.noStart'
  | 'algo.notType3' // params: { productionIds: ProductionId[] }
  | 'algo.invalid' // params: { diagnostics: number }  Quelle hat Fehler laut validate
  | 'algo.alphabetMismatch' // params: { left: Sym[]; right: Sym[] }  Produktautomat
  | 'algo.limit'; // params: { what: 'states' | 'exprSize' | 'words'; limit: number }

export interface Diagnostic {
  severity: 'error' | 'warning';
  code: DiagnosticCode;
  params: Record<string, unknown>;
  objectName?: string;
  stateId?: StateId;
  transitionId?: TransitionId;
  /** Textposition, 1-basiert; nur bei Meldungen aus dem Parser. */
  line?: number;
  col?: number;
  /** Länge des markierten Bereichs in Zeichen (Parser). */
  length?: number;
}

// ---------------------------------------------------------------------------
// Simulation: der vollständige Lauf als Daten; die Oberfläche blättert nur.

/** done: Mealy/Moore haben das ganze Wort gelesen (kein Akzeptanzbegriff). */
export type SimResult = 'accepted' | 'rejected' | 'stuck' | 'limit' | 'done';

/** Ausschnitt eines Turingbands; Bandpositionen sind ganze Zahlen, Eingabe beginnt bei 0. */
export interface TapeView {
  /** Bandposition von cells[0]. */
  origin: number;
  /** Alle bisher besuchten Felder plus die Eingabe, ohne Blanks an den Rändern außerhalb davon. */
  cells: Sym[];
  /** Bandposition des Kopfs. */
  head: number;
}

export interface Explanation {
  key: string; // z. B. 'sim.dea.step', 'sim.nea.epsilon'
  params: Record<string, unknown>;
}

export interface SimStep {
  /** Anzahl bisher gelesener Symbole. */
  pos: number;
  /** DEA: genau ein Zustand (leer, wenn hängengeblieben); NEA: aktuelle Zustandsmenge. */
  active: StateId[];
  /** Kanten, die vom vorigen Schritt zu diesem geführt haben (NEA inkl. ε-Kanten). */
  fired: TransitionId[];
  explanation: Explanation;
  /** Mealy/Moore: bisheriges Ausgabewort. */
  output?: Word;
  /** NKA: Kellerinhalt, oberstes Symbol zuerst. */
  stack?: Word;
  /** TM: Bandinhalt und Kopf nach diesem Schritt. */
  tape?: TapeView;
}

export type TreeStatus = 'open' | 'accepting' | 'rejecting' | 'dead' | 'cycle' | 'limit';

export interface TreeNode {
  id: number;
  parent: number | null;
  state: StateId;
  /** Gelesene Symbole bis zu diesem Knoten. */
  pos: number;
  /** Kante vom Elternknoten hierher; null an der Wurzel. */
  via: TransitionId | null;
  /** accepting/rejecting: Blatt mit pos = |w|; dead: kein passender Übergang mehr;
   *  cycle: (Zustand, pos) wiederholt sich auf demselben Ast; limit: Knotenlimit erreicht. */
  status: TreeStatus;
  /** NKA: Kellerinhalt in diesem Knoten (oberstes zuerst). */
  stack?: Word;
}

export interface Trace {
  word: Word;
  /** steps[0] = Startkonfiguration (beim NEA bereits mit ε-Hülle). */
  steps: SimStep[];
  result: SimResult;
  /** Nur DEA: f**(z0, w) als Zustandsfolge (Länge |w|+1, bzw. kürzer bei stuck). */
  stateSequence?: StateId[];
  /** Nur DEA: f*(z0, w); null bei stuck. */
  finalState?: StateId | null;
  /** NEA, NKA: Berechnungs- bzw. Konfigurationsbaum. */
  tree?: TreeNode[];
  /** Mealy/Moore: vollständiges Ausgabewort. */
  output?: Word;
  /** TM: Anzahl verschiedener besuchter Bandfelder. */
  visited?: number;
}

export interface SimOptions {
  /** Höchstzahl Schritte (DEA) bzw. Baumknoten (NEA). Standard 10000. */
  stepLimit?: number;
}

export interface BatchEntry {
  word: Word;
  /** true = soll ∈ L, false = soll ∉ L, null = ohne Erwartung. */
  expected: boolean | null;
}

export interface BatchResult {
  word: Word;
  expected: boolean | null;
  result: SimResult;
  /** expected === null → null, sonst ob das Ergebnis der Erwartung entspricht. */
  ok: boolean | null;
}

// ---------------------------------------------------------------------------
// Verfahren (M2): Ergebnis und Zwischenschritte als Daten; die Oberfläche rendert nur.

export interface ProcLimits {
  /** Höchstzahl erzeugter Zustände (Potenzmenge, Produkt, Thompson). Standard 2000. */
  maxStates?: number;
  /** Höchstzahl Knoten eines Ausdrucks (2.30). Standard 50000. */
  maxExprSize?: number;
}

export interface ProcOptions {
  /** false: keine Schrittliste aufbauen (Modus „sofort“). Standard true. */
  steps?: boolean;
  limits?: ProcLimits;
  /** Name des Ergebnisobjekts; Standard: Quelle + Suffix je Verfahren. */
  name?: string;
  /** 2.30: einfache Vereinfachungsregeln anwenden (Standard true). */
  simplify?: boolean;
  /** 2.74: volle Potenzmenge statt nur erreichbarer Teilmengen (Standard false). */
  fullPowerset?: boolean;
  /** Fortschritt (z. B. Anzahl erzeugter Zustände); wird höchstens alle ~50 ms aufgerufen. */
  onProgress?: (done: number) => void;
}

export interface StepTable {
  corner?: string;
  colHead: string[];
  rowHead: string[];
  /** Zellen als fertiger mathematischer Text (Zustandsnamen, Ausdrücke, Mengen). */
  cells: string[][];
  /** Zeile, die in diesem Schritt neu ist oder bearbeitet wurde. */
  activeRow?: number;
}

/** Was zu einem Schritt gezeigt wird; alle Teile optional und kombinierbar. */
export interface StepView {
  /** Zwischenstand als Objekt (Graph bzw. Grammatik/Ausdruck). */
  obj?: FormalObject;
  /** Hervorgehobene Elemente in obj. */
  highlight?: ElemRef[];
  /** In diesem Schritt neu entstandene Kanten in obj. */
  added?: TransitionId[];
  table?: StepTable;
  /** Äquivalenzklassen einer Runde ≡k (2.90); Zustände von obj. */
  partition?: { round: number; classes: StateId[][] };
  /** Wachsende Menge (2.82); Zustände von obj. */
  set?: { round: number; items: StateId[] };
}

export interface ProcStep {
  explanation: Explanation;
  view: StepView;
  /** Hervorgehobene Elemente in der Quelle (Index in sources). */
  sourceHighlight?: { source: number; elems: ElemRef[] };
}

export type ProcResult<R> =
  | { ok: true; result: R; steps: ProcStep[] }
  | { ok: false; diagnostics: Diagnostic[]; steps: ProcStep[] };

export interface EquivalenceResult {
  equal: boolean;
  /** Kürzestes, bei gleicher Länge lexikographisch kleinstes Wort in genau einer Sprache. */
  word: Word | null;
  /** In welcher Sprache das Wort liegt (0 = erstes, 1 = zweites Objekt). */
  inLanguage: 0 | 1 | null;
}

export interface GrammarTypeInfo {
  /** Höchster Typ, den die ganze Grammatik erfüllt. */
  type: 0 | 1 | 2 | 3;
  productions: {
    id: ProductionId;
    /** Höchster Typ, den diese Produktion für sich erfüllt. */
    type: 0 | 1 | 2 | 3;
    /** Begründungsschlüssel, Texte in der Oberfläche. */
    reason: 'rightLinear' | 'contextFree' | 'nonShrinking' | 'startEpsilon' | 'shrinking';
  }[];
  /** Typ 1 nur wegen der Sonderregel S → ε (S auf keiner rechten Seite), 5.1. */
  startEpsilonRule: boolean;
}

// ---------------------------------------------------------------------------
// Sprach-Explorer und Export (M3)

export interface LengthCounts {
  /** counts[n] = Anzahl der Wörter der Länge n in der Sprache. */
  counts: bigint[];
  /** true: exakt gezählt; false: Stichprobe über Simulation (Kellerautomat, TM). */
  exact: boolean;
}

export interface WordsPage {
  words: Word[];
  /** Keine weiteren Wörter bis maxLen. */
  done: boolean;
  exact: boolean;
}

export interface TikzOptions {
  /** Vollständiges Dokument mit \documentclass{standalone} (Standard true). */
  standalone?: boolean;
  /** Zentimeter je 100 Pixel Layout (Standard 1.6). */
  scale?: number;
}
