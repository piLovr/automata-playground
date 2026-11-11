// Führt Verfahren im Web Worker aus: ein Auftrag zur Zeit, abbrechbar, mit Fortschritt.
// Lässt sich kein Worker starten (manche Browser bei file://), läuft der Kern im
// Hauptthread mit denselben Grenzen.
import ProcWorker from './proc.worker?worker&inline';
import { execute } from './proc.worker-exec';
import type { ProcCall, ProcReply, ProcRequest } from './proc-protocol';

export type RunOutcome<T> = { status: 'done'; value: T } | { status: 'cancelled' } | { status: 'error'; message: string };

class Runner {
  /** Laufender Auftrag (für Anzeige und Abbrechen-Knopf). */
  busy = $state<{ label: string; done: number; since: number } | null>(null);

  #worker: Worker | null = null;
  #workerBroken = false;
  #nextId = 1;
  #pending: { id: number; resolve: (r: RunOutcome<unknown>) => void } | null = null;

  #ensureWorker(): Worker | null {
    if (this.#worker || this.#workerBroken) return this.#worker;
    try {
      const w = new ProcWorker();
      w.onmessage = (e: MessageEvent<ProcReply>) => this.#onReply(e.data);
      w.onerror = (e) => {
        e.preventDefault();
        this.#finish({ status: 'error', message: e.message || 'Worker' });
        this.#worker?.terminate();
        this.#worker = null;
      };
      this.#worker = w;
    } catch {
      this.#workerBroken = true;
    }
    return this.#worker;
  }

  #onReply(r: ProcReply): void {
    if (!this.#pending || r.id !== this.#pending.id) return;
    if (r.type === 'progress') {
      if (this.busy) this.busy = { ...this.busy, done: r.done };
      return;
    }
    this.#finish(r.type === 'done' ? { status: 'done', value: r.value } : { status: 'error', message: r.message });
  }

  #finish(r: RunOutcome<unknown>): void {
    const p = this.#pending;
    this.#pending = null;
    this.busy = null;
    p?.resolve(r);
  }

  /** Startet einen Auftrag; ein noch laufender wird abgebrochen. */
  run<T>(label: string, req: ProcRequest): Promise<RunOutcome<T>> {
    this.cancel();
    const id = this.#nextId++;
    const call = { ...req, id } as ProcCall;
    this.busy = { label, done: 0, since: Date.now() };
    return new Promise((resolve) => {
      this.#pending = { id, resolve: resolve as (r: RunOutcome<unknown>) => void };
      const w = this.#ensureWorker();
      if (w) {
        w.postMessage($state.snapshot(call));
        return;
      }
      // Hauptthread: kurz warten, damit die Anzeige „läuft …“ erscheint.
      setTimeout(() => {
        try {
          this.#finish({ status: 'done', value: execute(call) });
        } catch (err) {
          this.#finish({ status: 'error', message: err instanceof Error ? err.message : String(err) });
        }
      }, 16);
    });
  }

  cancel(): void {
    if (!this.#pending) return;
    if (this.#worker) {
      this.#worker.terminate();
      this.#worker = null;
    }
    this.#finish({ status: 'cancelled' });
  }
}

export const runner = new Runner();
/** Eigener Worker für den Sprach-Explorer, damit er laufende Verfahren nicht abbricht. */
export const explorer = new Runner();
