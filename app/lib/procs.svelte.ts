// Verfahren starten (sofort / schrittweise), Schrittspieler, Neuberechnung veralteter Objekte,
// Äquivalenztest. Gerechnet wird im Worker (runner); hier liegt nur der Zustand der Oberfläche.
import {
  freshName,
  isStale,
  type EquivalenceResult,
  type FormalObject,
  type MethodId,
  type ProcOptions,
  type ProcResult,
  type Word,
} from '../../core/index';
import { store } from './store.svelte';
import { runner } from './runner.svelte';
import { diagnosticText } from './format';
import { t } from '../i18n';

export interface Session {
  method: MethodId;
  /** Namen der Quellen beim Start. */
  sources: string[];
  /** Quellobjekte, wie sie beim Start waren (Hervorhebung in der Quelle). */
  sourceObjs: FormalObject[];
  result: ProcResult<FormalObject>;
  adopted: boolean;
}

class Procs {
  session = $state<Session | null>(null);
  index = $state(0);
  playing = $state(false);
  speed = $state(1.5);

  // Einstellungen (sichtbar im Verfahrensreiter)
  simplify = $state(true);
  fullPowerset = $state(false);
  maxStates = $state(2000);
  maxExprSize = $state(50000);

  /** Letztes Ergebnis eines Äquivalenztests bzw. trennenden Worts (Anzeige im Reiter). */
  equiv = $state<{ a: string; b: string; res: EquivalenceResult } | null>(null);
  separating = $state<{ w1: Word; w2: Word; word: Word | null } | null>(null);
  /** Paarweiser Vergleich auf der Arbeitsfläche: Schlüssel "A|B". */
  matrix = $state<Record<string, EquivalenceResult | 'error'>>({});

  #opts(steps: boolean): Omit<ProcOptions, 'onProgress'> {
    return {
      steps,
      simplify: this.simplify,
      fullPowerset: this.fullPowerset,
      limits: { maxStates: this.maxStates, maxExprSize: this.maxExprSize },
    };
  }

  /** Name des Ergebnisses wie in den Anforderungen: R1 → G1 → N1 → M1 → M1min. */
  #nameFor(method: MethodId, src: FormalObject): string {
    const names = store.doc.objects.map((o) => o.name);
    const suffix: Partial<Record<MethodId, string>> = { minimize: 'min', reachable: 'err', complement: 'komp' };
    const s = suffix[method];
    if (s) return names.includes(src.name + s) ? freshName(names, src.name + s + '_') : src.name + s;
    const prefix: Record<MethodId, string> = {
      nea2dea: 'M',
      menge2dea: 'M',
      powerset: 'M',
      splitWords: 'N',
      removeEpsilon: 'N',
      grammar2nea: 'N',
      thompson: 'N',
      dea2regex: 'R',
      dea2regexElim: 'R',
      regex2grammar: 'G',
      dea2grammar: 'G',
      intersection: 'M',
      union: 'M',
      complement: 'M',
      reachable: 'M',
      minimize: 'M',
      mealy2moore: 'Moore',
      moore2mealy: 'Mealy',
      egrep2regex: 'R',
      sprachop: 'L',
    };
    let n = 1;
    while (names.includes(prefix[method] + n)) n++;
    return prefix[method] + n;
  }

  #failure(r: ProcResult<unknown>): string {
    if (r.ok) return '';
    const d = r.diagnostics[0];
    return d ? diagnosticText(d) : t('proc.failed');
  }

  /** Führt ein Verfahren aus. Sofort: Ergebnis wird neues Objekt. Schrittweise: Spieler öffnet sich. */
  async run(method: MethodId, sources: FormalObject[], mode: 'instant' | 'steps'): Promise<void> {
    const out = await runner.run<ProcResult<FormalObject>>(t(`method.${method}`), {
      fn: 'runMethod',
      method,
      sources,
      opts: { ...this.#opts(mode === 'steps'), name: this.#nameFor(method, sources[0]!) },
    });
    if (out.status === 'cancelled') return store.notify(t('proc.cancelled'));
    if (out.status === 'error') return store.notify(out.message, 'error');
    const r = out.value;
    if (mode === 'instant') {
      if (!r.ok) return store.notify(this.#failure(r), 'error');
      const name = store.insertObject(r.result);
      store.notify(t('proc.created', { name }));
      return;
    }
    if (!r.ok && r.steps.length === 0) return store.notify(this.#failure(r), 'error');
    if (!r.ok) store.notify(this.#failure(r), 'error');
    this.session = { method, sources: sources.map((s) => s.name), sourceObjs: sources, result: r, adopted: false };
    this.index = 0;
    this.playing = false;
  }

  get steps() {
    return this.session?.result.steps ?? [];
  }
  get step() {
    return this.steps[Math.min(this.index, this.steps.length - 1)];
  }

  go(i: number): void {
    this.index = Math.max(0, Math.min(i, this.steps.length - 1));
  }

  adopt(): void {
    const s = this.session;
    if (!s || !s.result.ok || s.adopted) return;
    const name = store.insertObject(s.result.result);
    s.adopted = true;
    store.notify(t('proc.created', { name }));
    this.close();
  }

  close(): void {
    this.session = null;
    this.playing = false;
  }

  /** Laufende Kette: Schritt i von n (Anzeige im Verfahrensreiter). */
  chain = $state<{ step: number; total: number; method: MethodId } | null>(null);

  /**
   * Führt die Verfahren nacheinander aus, bis ein minimaler DEA entsteht. Jedes
   * Zwischenergebnis wird ein Objekt mit Herkunft; am Ende zeigt die Arbeitsfläche die Kette.
   */
  async runChain(src: FormalObject, plan: MethodId[]): Promise<void> {
    let cur = src;
    const made: string[] = [];
    try {
      for (let i = 0; i < plan.length; i++) {
        const method = plan[i]!;
        this.chain = { step: i + 1, total: plan.length, method };
        const out = await runner.run<ProcResult<FormalObject>>(t('proc.chainStep', { i: i + 1, n: plan.length, method: t(`method.${method}`) }), {
          fn: 'runMethod',
          method,
          sources: [cur],
          opts: { ...this.#opts(false), name: this.#nameFor(method, cur) },
        });
        if (out.status === 'cancelled') return store.notify(t('proc.cancelled'));
        if (out.status === 'error') return store.notify(out.message, 'error');
        if (!out.value.ok) return store.notify(`${t(`method.${method}`)}: ${this.#failure(out.value)}`, 'error');
        const name = store.insertObject(out.value.result, { activate: false });
        made.push(name);
        cur = store.doc.objects.find((o) => o.name === name)!;
      }
    } finally {
      this.chain = null;
    }
    const last = made.at(-1);
    if (last) {
      store.setActive(store.doc.objects.findIndex((o) => o.name === last));
      store.setView('workspace');
      store.notify(t('proc.chainDone', { names: made.join(' → ') }));
    }
  }

  /** Veraltetes Objekt mit seinem Verfahren aus den aktuellen Quellen neu berechnen. */
  async recompute(name: string): Promise<void> {
    const o = store.doc.objects.find((x) => x.name === name);
    const origin = o?.origin;
    if (!o || !origin) return;
    const sources = origin.sources.map((n) => store.doc.objects.find((x) => x.name === n));
    if (sources.some((s) => !s)) return store.notify(t('proc.sourceMissing'), 'error');
    const out = await runner.run<ProcResult<FormalObject>>(t(`method.${origin.method}`), {
      fn: 'runMethod',
      method: origin.method,
      sources: sources as FormalObject[],
      opts: { ...this.#opts(false), name },
    });
    if (out.status !== 'done') return;
    if (!out.value.ok) return store.notify(this.#failure(out.value), 'error');
    store.replaceObject(name, out.value.result);
  }

  stale(o: FormalObject): boolean {
    return isStale(o, store.doc);
  }

  async compare(a: FormalObject, b: FormalObject): Promise<EquivalenceResult | null> {
    const out = await runner.run<ProcResult<EquivalenceResult>>(t('proc.equivalence'), {
      fn: 'equivalent',
      sources: [a, b],
      opts: this.#opts(false),
    });
    if (out.status !== 'done') return null;
    if (!out.value.ok) {
      store.notify(this.#failure(out.value), 'error');
      return null;
    }
    return out.value.result;
  }

  async compareActive(other: string): Promise<void> {
    const a = store.obj;
    const b = store.doc.objects.find((o) => o.name === other);
    if (!a || !b) return;
    const res = await this.compare(a, b);
    if (res) this.equiv = { a: a.name, b: b.name, res };
  }

  /** Alle Typ-3-Objekte der Arbeitsfläche paarweise vergleichen. */
  async compareAll(objs: FormalObject[]): Promise<void> {
    const m: Record<string, EquivalenceResult | 'error'> = {};
    this.matrix = {};
    for (let i = 0; i < objs.length; i++) {
      for (let j = i + 1; j < objs.length; j++) {
        const a = objs[i]!;
        const b = objs[j]!;
        const res = await this.compare(a, b);
        // abgebrochen oder fehlgeschlagen: übrige Paare nicht mehr starten
        if (res === null) return;
        m[`${a.name}|${b.name}`] = res;
        this.matrix = { ...m };
      }
    }
  }

  async separate(w1: Word, w2: Word): Promise<void> {
    const a = store.obj;
    if (!a) return;
    const out = await runner.run<ProcResult<{ word: Word | null }>>(t('proc.separating'), {
      fn: 'separatingWord',
      sources: [a],
      words: [w1, w2],
      opts: this.#opts(false),
    });
    if (out.status !== 'done') return;
    if (!out.value.ok) return store.notify(this.#failure(out.value), 'error');
    this.separating = { w1, w2, word: out.value.result.word };
  }
}

export const procs = new Procs();
