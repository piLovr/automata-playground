// Ausführung eines Verfahrensauftrags (im Worker oder ersatzweise im Hauptthread).
import { equivalent, runMethod, separatingWord, type DEA } from '../../core/index';
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
  }
}
