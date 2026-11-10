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
export type ObjectKind = Automaton['kind'];
/** Alle Objekte eines Dokuments; wächst je Meilenstein (Grammatik, Ausdruck, …). */
export type FormalObject = Automaton;

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
  | 'tm.finalOverlap'; // params: { states: StateId[] }  (Zustand zugleich in F+ und F−)

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
