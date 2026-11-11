// Web Worker für rechenintensive Verfahren. Nimmt Aufträge an, ruft den Kern und
// schickt Ergebnis oder Fortschritt zurück. Abbrechen = der Hauptthread beendet den Worker.
import { execute } from './proc.worker-exec';
import type { ProcCall, ProcReply } from './proc-protocol';

let lastProgress = 0;

self.onmessage = (e: MessageEvent<ProcCall>) => {
  const { id } = e.data;
  const post = (reply: ProcReply): void => (self as unknown as Worker).postMessage(reply);
  const onProgress = (done: number): void => {
    const now = Date.now();
    if (now - lastProgress < 50) return;
    lastProgress = now;
    post({ id, type: 'progress', done });
  };
  try {
    post({ id, type: 'done', value: execute(e.data, onProgress) });
  } catch (err) {
    post({ id, type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
