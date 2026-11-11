// Nachrichten zwischen Oberfläche und Verfahrens-Worker.
import type { FormalObject, MethodId, ProcOptions, Word } from '../../core/index';

type Opts = Omit<ProcOptions, 'onProgress'>;

export type ProcCall =
  | { id: number; fn: 'runMethod'; method: MethodId; sources: FormalObject[]; opts: Opts }
  | { id: number; fn: 'equivalent'; sources: FormalObject[]; opts: Opts }
  | { id: number; fn: 'separatingWord'; sources: FormalObject[]; words: [Word, Word]; opts: Opts };

export type ProcRequest = ProcCall extends infer C ? (C extends ProcCall ? Omit<C, 'id'> : never) : never;

export type ProcReply =
  | { id: number; type: 'progress'; done: number }
  | { id: number; type: 'done'; value: unknown }
  | { id: number; type: 'error'; message: string };
