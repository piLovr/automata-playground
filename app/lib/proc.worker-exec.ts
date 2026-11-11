// Ausführung eines Verfahrensauftrags (im Worker oder ersatzweise im Hauptthread).
import {
  bottomUpRun,
  countByLength,
  equivalent,
  findAmbiguity,
  findDerivation,
  parseTrees,
  runMethod,
  separatingWord,
  topDownRun,
  wordsPage,
  type DEA,
  type Grammar,
} from '../../core/index';
import type { ProcCall } from './proc-protocol';

export function execute(call: ProcCall, onProgress?: (done: number) => void): unknown {
  const opts = { ...call.opts, onProgress };
  switch (call.fn) {
    case 'runMethod':
      return runMethod(call.method, call.sources, opts);
    case 'equivalent':
      return equivalent(call.sources[0]!, call.sources[1]!, opts);
    case 'separatingWord':
      return separatingWord(call.sources[0] as DEA, call.words[0], call.words[1], opts);
    case 'countByLength':
      return countByLength(call.sources[0]!, call.maxLen);
    case 'wordsPage':
      return wordsPage(call.sources[0]!, { maxLen: call.maxLen, offset: call.offset, limit: call.limit });
    case 'findDerivation':
      return findDerivation(call.sources[0] as Grammar, call.word, { leftmost: true });
    case 'parseTrees':
      return parseTrees(call.sources[0] as Grammar, call.word, { maxNodes: call.limit });
    case 'topDownRun':
      return topDownRun(call.sources[0] as Grammar, call.word);
    case 'bottomUpRun':
      return bottomUpRun(call.sources[0] as Grammar, call.word);
    case 'findAmbiguity':
      return findAmbiguity(call.sources[0] as Grammar, { maxLen: call.maxLen, maxNodes: call.limit });
  }
}
