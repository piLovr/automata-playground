import LZString from 'lz-string';
import {
  autoLayout,
  edit,
  emptyObject,
  freshName,
  isAutomaton,
  fromJSON,
  parseDocument,
  toJSON,
  type Automaton,
  type Document,
  type FormalKind,
  type FormalObject,
  type StateId,
} from '../../core/index';
import { examples } from './examples';
import { t } from '../i18n';

const STORAGE_KEY = 'automaten-playground:v1';
const HISTORY_MAX = 200;

export interface BatchRow {
  input: string;
  expected: boolean | null;
}

export type Tool = 'select' | 'state' | 'edge';
export type PanelTab = 'table' | 'text' | 'batch' | 'procs';
export type ViewMode = 'single' | 'workspace';
export type Theme = 'auto' | 'light' | 'dark';

/** Kantengruppe im Graphen: alle Übergänge from → to. */
export function edgeKey(from: StateId, to: StateId): string {
  return `${from}>${to}`;
}

interface Snapshot {
  doc: Document;
  active: number;
}

/** Was außer dem Dokument in Link und Autosave wandert. */
interface Persisted {
  v: 1;
  doc: unknown;
  active: number;
  words: Record<string, string>;
  batches: Record<string, BatchRow[]>;
  showLayout?: boolean;
  view?: ViewMode;
  texts?: Record<string, string>;
}

class AppStore {
  doc = $state<Document>({ version: 1, objects: [] });
  active = $state(0);

  selStates = $state<StateId[]>([]);
  selEdges = $state<string[]>([]);
  tool = $state<Tool>('select');
  panel = $state<PanelTab>('table');
  theme = $state<Theme>('auto');
  showLayout = $state(false);
  /** Einzelansicht oder Sprach-Arbeitsfläche (Abschnitt 8). */
  view = $state<ViewMode>('single');

  /** Eingabewort je Objektname (Rohtext). */
  words = $state<Record<string, string>>({});
  batches = $state<Record<string, BatchRow[]>>({});
  /** Prüftext je egrep-Objekt (mehrzeilig, zeilenweise geprüft wie egrep). */
  texts = $state<Record<string, string>>({});
  simStep = $state(0);
  simPlaying = $state(false);
  simSpeed = $state(2); // Schritte pro Sekunde
  simLimit = $state(10000);

  toast = $state<{ text: string; tone: 'info' | 'error'; id: number } | null>(null);

  /** Zähler, der bei jeder Modelländerung außerhalb des Texteditors steigt. */
  externalRevision = $state(0);

  #past = $state<Snapshot[]>([]);
  #future = $state<Snapshot[]>([]);
  #lastCoalesce: { key: string; at: number } | null = null;
  #saveTimer: ReturnType<typeof setTimeout> | null = null;

  get obj(): FormalObject | undefined {
    return this.doc.objects[this.active];
  }
  /** Aktives Objekt, falls es eine Zustandsmaschine ist (Graph, Tabelle, Simulation). */
  get aut(): Automaton | undefined {
    const o = this.obj;
    return o && isAutomaton(o) ? o : undefined;
  }
  get canUndo(): boolean {
    return this.#past.length > 0;
  }
  get canRedo(): boolean {
    return this.#future.length > 0;
  }

  // -------------------------------------------------------------------------
  // Änderungen

  /**
   * Übernimmt ein neues Dokument in die Historie. Gleicher coalesce-Schlüssel
   * innerhalb kurzer Zeit (Tippen, Ziehen) ergibt einen einzigen Undo-Schritt.
   */
  commit(next: Document, opts: { coalesce?: string; fromText?: boolean; active?: number } = {}): void {
    if (next === this.doc) return;
    const now = Date.now();
    const merge =
      opts.coalesce !== undefined &&
      this.#lastCoalesce?.key === opts.coalesce &&
      now - this.#lastCoalesce.at < 1500;
    if (!merge) {
      this.#past = [...this.#past, { doc: this.doc, active: this.active }].slice(-HISTORY_MAX);
    }
    this.#lastCoalesce = opts.coalesce ? { key: opts.coalesce, at: now } : null;
    this.#future = [];
    this.doc = next;
    if (opts.active !== undefined) this.active = opts.active;
    this.active = Math.min(this.active, Math.max(0, next.objects.length - 1));
    if (!opts.fromText) this.externalRevision++;
    this.#pruneSelection();
    this.#scheduleSave();
  }

  /** Ändert das aktive Objekt, falls es ein Automat ist. Fehler der Edit-Funktionen werden als Hinweis gezeigt. */
  update(fn: (o: Automaton) => FormalObject, coalesce?: string): boolean {
    const o = this.aut;
    if (!o) return false;
    return this.updateAny((x) => fn(x as Automaton), coalesce);
  }

  /** Ändert das aktive Objekt beliebiger Art. */
  updateAny(fn: (o: FormalObject) => FormalObject, coalesce?: string): boolean {
    const o = this.obj;
    if (!o) return false;
    let next: FormalObject;
    try {
      next = fn(o);
    } catch (e) {
      this.notify(e instanceof Error ? e.message : String(e), 'error');
      return false;
    }
    if (next === o) return true;
    const objects = this.doc.objects.slice();
    objects[this.active] = next;
    this.commit({ ...this.doc, objects }, { coalesce });
    return true;
  }

  undo(): void {
    const prev = this.#past.at(-1);
    if (!prev) return;
    this.#past = this.#past.slice(0, -1);
    this.#future = [...this.#future, { doc: this.doc, active: this.active }];
    this.doc = prev.doc;
    this.active = prev.active;
    this.#lastCoalesce = null;
    this.externalRevision++;
    this.#pruneSelection();
    this.#scheduleSave();
  }

  redo(): void {
    const next = this.#future.at(-1);
    if (!next) return;
    this.#future = this.#future.slice(0, -1);
    this.#past = [...this.#past, { doc: this.doc, active: this.active }];
    this.doc = next.doc;
    this.active = next.active;
    this.#lastCoalesce = null;
    this.externalRevision++;
    this.#pruneSelection();
    this.#scheduleSave();
  }

  select(states: StateId[], edges: string[] = []): void {
    this.selStates = states;
    this.selEdges = edges;
  }

  setActive(i: number): void {
    if (i === this.active) return;
    this.active = i;
    this.select([]);
    this.simStep = 0;
    this.simPlaying = false;
    this.#scheduleSave();
  }

  addObject(kind: FormalKind): void {
    const names = this.doc.objects.map((o) => o.name);
    const prefix: Record<FormalKind, string> = {
      dea: 'M',
      nea: 'N',
      mealy: 'Mealy',
      moore: 'Moore',
      nka: 'K',
      tm: 'T',
      regex: 'R',
      grammatik: 'G',
      egrep: 'E',
    };
    const name = freshName(names, prefix[kind]);
    const obj = emptyObject(kind, name);
    this.commit({ ...this.doc, objects: [...this.doc.objects, obj] }, { active: this.doc.objects.length });
    this.select([]);
  }

  /** Fügt ein fertiges Objekt an (Ergebnis eines Verfahrens); Name bei Konflikt frisch. */
  insertObject(obj: FormalObject, opts: { activate?: boolean } = {}): string {
    const names = this.doc.objects.map((o) => o.name);
    const name = names.includes(obj.name) ? freshName(names, obj.name + '_') : obj.name;
    const placed = withLayout({ ...obj, name });
    const active = opts.activate === false ? this.active : this.doc.objects.length;
    this.commit({ ...this.doc, objects: [...this.doc.objects, placed] }, { active });
    if (opts.activate !== false) this.select([]);
    return name;
  }

  /** Ersetzt das Objekt mit diesem Namen (Neuberechnung), Name bleibt. */
  replaceObject(name: string, obj: FormalObject): void {
    const i = this.doc.objects.findIndex((o) => o.name === name);
    if (i < 0) return;
    const objects = this.doc.objects.slice();
    objects[i] = withLayout({ ...obj, name });
    this.commit({ ...this.doc, objects });
  }

  setView(v: ViewMode): void {
    this.view = v;
    this.#scheduleSave();
  }

  removeActive(): void {
    const objects = this.doc.objects.filter((_, i) => i !== this.active);
    this.commit({ ...this.doc, objects }, { active: Math.max(0, this.active - 1) });
  }

  renameActive(name: string): void {
    const o = this.obj;
    if (!o || !name || name === o.name) return;
    if (this.doc.objects.some((x) => x.name === name)) {
      this.notify(t('error.rename', { name }), 'error');
      return;
    }
    this.#moveKeyed(o.name, name);
    this.updateAny((x) => ({ ...x, name }));
  }

  loadExample(id: string): void {
    const ex = examples.find((e) => e.id === id);
    if (!ex) return;
    const { doc } = parseDocument(ex.text);
    const incoming = doc.objects[0];
    if (!incoming) return;
    const names = this.doc.objects.map((o) => o.name);
    const name = names.includes(incoming.name) ? freshName(names, incoming.name + '_') : incoming.name;
    const obj = withLayout({ ...incoming, name });
    if (ex.word !== undefined) this.words[name] = ex.word;
    if (ex.testText !== undefined) this.texts[name] = ex.testText;
    this.simStep = 0;
    this.commit({ ...this.doc, objects: [...this.doc.objects, obj] }, { active: this.doc.objects.length });
    this.select([]);
  }

  /** Ersetzt das ganze Dokument (Datei öffnen). */
  replaceDocument(doc: Document): void {
    this.commit({ version: 1, objects: doc.objects.map(withLayout) }, { active: 0 });
    this.select([]);
  }

  // -------------------------------------------------------------------------
  // Simulation und Stapellauf (je Objektname)

  get word(): string {
    const o = this.obj;
    return o ? (this.words[o.name] ?? '') : '';
  }
  set word(v: string) {
    const o = this.obj;
    if (!o) return;
    this.words[o.name] = v;
    this.simStep = 0;
    this.#scheduleSave();
  }

  get text(): string {
    const o = this.obj;
    return o ? (this.texts[o.name] ?? '') : '';
  }
  set text(v: string) {
    const o = this.obj;
    if (!o) return;
    this.texts[o.name] = v;
    this.#scheduleSave();
  }

  get batch(): BatchRow[] {
    const o = this.obj;
    return o ? (this.batches[o.name] ?? []) : [];
  }
  set batch(rows: BatchRow[]) {
    const o = this.obj;
    if (!o) return;
    this.batches[o.name] = rows;
    this.#scheduleSave();
  }

  #moveKeyed(from: string, to: string): void {
    if (from in this.words) {
      this.words[to] = this.words[from]!;
      delete this.words[from];
    }
    if (from in this.texts) {
      this.texts[to] = this.texts[from]!;
      delete this.texts[from];
    }
    if (from in this.batches) {
      this.batches[to] = this.batches[from]!;
      delete this.batches[from];
    }
  }

  // -------------------------------------------------------------------------
  // Speichern, Laden, Teilen

  notify(text: string, tone: 'info' | 'error' = 'info'): void {
    const id = Date.now();
    this.toast = { text, tone, id };
    setTimeout(() => {
      if (this.toast?.id === id) this.toast = null;
    }, 3200);
  }

  #persisted(): Persisted {
    return {
      v: 1,
      doc: JSON.parse(toJSON(this.doc)),
      active: this.active,
      words: { ...this.words },
      batches: JSON.parse(JSON.stringify(this.batches)),
      showLayout: this.showLayout,
      view: this.view,
      texts: { ...this.texts },
    };
  }

  #restore(p: Persisted): boolean {
    if (!p || p.v !== 1) return false;
    const { doc } = fromJSON(JSON.stringify(p.doc));
    if (!doc) return false;
    this.doc = { version: 1, objects: doc.objects.map(withLayout) };
    this.active = Math.min(p.active ?? 0, Math.max(0, doc.objects.length - 1));
    this.words = p.words ?? {};
    this.batches = p.batches ?? {};
    this.showLayout = p.showLayout ?? false;
    this.view = p.view ?? 'single';
    this.texts = p.texts ?? {};
    this.externalRevision++;
    return true;
  }

  shareUrl(): string {
    const data = LZString.compressToEncodedURIComponent(JSON.stringify(this.#persisted()));
    const url = new URL(location.href);
    url.hash = `d=${data}`;
    return url.toString();
  }

  #scheduleSave(): void {
    if (this.#saveTimer) clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#persisted()));
      } catch {
        /* Speicher voll oder gesperrt: Autosave ist eine Bequemlichkeit */
      }
    }, 400);
  }

  /** Reihenfolge: Link im Hash, dann Autosave, dann Beispiel 2.3. */
  init(): void {
    try {
      const t = localStorage.getItem('automaten-playground:theme');
      if (t === 'light' || t === 'dark' || t === 'auto') this.theme = t;
    } catch {
      /* ohne Speicher */
    }
    const hash = location.hash;
    if (hash.startsWith('#d=')) {
      try {
        const json = LZString.decompressFromEncodedURIComponent(hash.slice(3));
        if (json && this.#restore(JSON.parse(json))) {
          history.replaceState(null, '', location.pathname + location.search);
          this.#scheduleSave();
          this.notify(t('info.loadedLink'));
          return;
        }
      } catch {
        /* fällt auf Autosave zurück */
      }
      this.notify(t('error.link'), 'error');
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && this.#restore(JSON.parse(raw))) return;
    } catch {
      /* fällt auf Beispiel zurück */
    }
    const first = examples[0];
    if (first) {
      const { doc } = parseDocument(first.text);
      this.doc = { version: 1, objects: doc.objects.map(withLayout) };
      this.words = { [doc.objects[0]?.name ?? '']: '-101' };
      this.batches = {
        [doc.objects[0]?.name ?? '']: [
          { input: '0', expected: true },
          { input: '-101', expected: true },
          { input: '1-0', expected: false },
          { input: '--1', expected: false },
          { input: 'ε', expected: false },
        ],
      };
      this.externalRevision++;
    }
  }

  setTheme(t: Theme): void {
    this.theme = t;
    try {
      localStorage.setItem('automaten-playground:theme', t);
    } catch {
      /* ohne Speicher */
    }
  }

  #pruneSelection(): void {
    const o = this.obj;
    if (!o || !isAutomaton(o)) {
      this.selStates = [];
      this.selEdges = [];
      return;
    }
    const ids = new Set(o.states.map((s) => s.id));
    const keys = new Set(o.transitions.map((t) => edgeKey(t.from, t.to)));
    if (this.selStates.some((id) => !ids.has(id))) this.selStates = this.selStates.filter((id) => ids.has(id));
    if (this.selEdges.some((k) => !keys.has(k))) this.selEdges = this.selEdges.filter((k) => keys.has(k));
  }
}

/** Ergänzt fehlende Positionen per autoLayout, vorhandene bleiben. */
export function withLayout<T extends FormalObject>(o: T): T {
  if (!isAutomaton(o) || o.states.every((s) => s.pos)) return o;
  const pos = autoLayout(o as Automaton, { keep: true });
  return edit.moveStates(o, pos) as T;
}

export const store = new AppStore();
