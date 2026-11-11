export * from './model/types';

export const CORE_VERSION = 1;

// Text
export { parseDocument } from './text/parser';
export { printDocument, printObject } from './text/printer';
export type { PrintOptions } from './text/printer';
export { parseWord, printWord, printSymbol } from './text/word';

// JSON
export { toJSON, fromJSON } from './json/json';

// Modell
export { validate, emptyAutomaton, emptyObject, isAutomaton } from './model/validate';
export { objectHash, isStale } from './model/hash';
export { grammarType, parseGrammarWord, printGrammarWord } from './model/grammar';
export { parseRegex, printRegex, regexSymbols, regexSize, subexprAt, regexSpans } from './model/regex';
export { parseEgrep, printEgrepAst } from './model/egrep';
export { reconcile } from './model/reconcile';
export { freshName } from './model/util';
export * as edit from './model/edit';
export type { Fragment } from './model/edit';
export { kinds, getKind } from './model/kinds';
export type { KindSpec } from './model/kinds';

// Layout
export { autoLayout } from './layout/layout';

// Simulation
export { simulate, runBatch } from './sim/batch';
export { epsilonClosure } from './sim/nea';

export * from './algo/index';
export { METHOD_IDS } from './model/methods';
export * from './export/index';

// Sprachrechner und Explorer (M3)
export { evalLang } from './lang/index';
export { countByLength, wordsPage, outputsTable } from './explore/index';
export { makeMenge } from './model/menge';
