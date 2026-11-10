<script lang="ts">
  import { edit, autoLayout, freshName, type FormalObject, type Point, type StateId } from '../../core/index';
  import { store, edgeKey } from '../lib/store.svelte';
  import { sim } from '../lib/sim.svelte';
  import { editLabels, parseLabelsFor, showLabel, LABEL_HINT, LABEL_HELP } from '../lib/labels';
  import { t } from '../i18n';
  import {
    STATE_R,
    ACCEPT_GAP,
    edgeBetween,
    selfLoop,
    freeAngle,
    arrowHead,
    startArrow,
    rectContains,
    splitSubscript,
    sub,
    add,
    len,
  } from './geometry';

  let { highlight = new Set<StateId>() }: { highlight?: Set<StateId> } = $props();

  let host: HTMLDivElement | undefined = $state();
  let svg: SVGSVGElement | undefined = $state();
  let width = $state(800);
  let height = $state(600);
  let view = $state({ x: 0, y: 0, k: 1 });
  let spaceDown = $state(false);
  let hoverState = $state<StateId | null>(null);
  let hoverRim = $state(false);

  type Drag =
    | { type: 'move'; startWorld: Point; origin: Record<StateId, Point>; moved: boolean; key: string }
    | { type: 'pan'; startScreen: Point; startView: { x: number; y: number } }
    | { type: 'marquee'; start: Point; cur: Point; additive: boolean; base: StateId[] }
    | { type: 'edge'; from: StateId; cur: Point };
  let drag = $state<Drag | null>(null);

  /** Offene Eingabe direkt im Graphen: Umbenennen oder Beschriftung. */
  type Inline =
    | { type: 'rename'; id: StateId; value: string }
    | { type: 'output'; id: StateId; value: string }
    | { type: 'label'; from: StateId; to: StateId; value: string; isNew: boolean };
  let inline = $state<Inline | null>(null);
  let inlineError = $state('');

  const obj = $derived(store.obj);
  const kind = $derived(obj?.kind ?? 'dea');
  /** Typen mit akzeptierenden Zuständen (Mealy/Moore haben stattdessen Ausgaben). */
  const hasAccept = $derived(kind !== 'mealy' && kind !== 'moore');
  /** Kellerautomat und TM: Beschriftungen untereinander statt durch Komma. */
  const stacked = $derived(kind === 'nka' || kind === 'tm');
  const rejectSet = $derived(new Set(obj?.kind === 'tm' ? obj.reject : []));
  const byId = $derived(new Map((obj?.states ?? []).map((s) => [s.id, s])));
  const acceptSet = $derived(new Set(obj?.accept ?? []));
  const selStates = $derived(new Set(store.selStates));
  const selEdges = $derived(new Set(store.selEdges));

  function pos(id: StateId): Point {
    return byId.get(id)?.pos ?? { x: 0, y: 0 };
  }

  // ---------------------------------------------------------------------------
  // Kanten: Übergänge gleicher Richtung werden zu einer Kante mit mehreren Beschriftungen.

  interface EdgeGroup {
    key: string;
    from: StateId;
    to: StateId;
    labels: { id: string; text: string; fired: boolean }[];
    fired: boolean;
  }

  const groups = $derived.by((): EdgeGroup[] => {
    if (!obj) return [];
    const map = new Map<string, EdgeGroup>();
    for (const tr of obj.transitions) {
      const key = edgeKey(tr.from, tr.to);
      let g = map.get(key);
      if (!g) {
        g = { key, from: tr.from, to: tr.to, labels: [], fired: false };
        map.set(key, g);
      }
      const fired = sim.fired.has(tr.id);
      g.labels.push({ id: tr.id, text: showLabel(obj.kind, tr.label), fired });
      if (fired) g.fired = true;
    }
    return [...map.values()];
  });

  const neighbours = $derived.by(() => {
    const m = new Map<StateId, Point[]>();
    for (const g of groups) {
      if (g.from === g.to) continue;
      (m.get(g.from) ?? m.set(g.from, []).get(g.from)!).push(pos(g.to));
      (m.get(g.to) ?? m.set(g.to, []).get(g.to)!).push(pos(g.from));
    }
    return m;
  });

  const loopDir = $derived.by(() => {
    const m = new Map<StateId, number>();
    for (const s of obj?.states ?? []) m.set(s.id, freeAngle(pos(s.id), neighbours.get(s.id) ?? []));
    return m;
  });

  const geometry = $derived.by(() => {
    const keys = new Set(groups.map((g) => g.key));
    return groups.map((g) => {
      if (g.from === g.to) return { g, geo: selfLoop(pos(g.from), loopDir.get(g.from) ?? -Math.PI / 2) };
      const both = keys.has(edgeKey(g.to, g.from));
      const text = stacked
        ? Math.max(...g.labels.map((l) => [...l.text].length))
        : g.labels.reduce((n, l) => n + [...l.text].length, 0) + (g.labels.length - 1) * 2;
      return { g, geo: edgeBetween(pos(g.from), pos(g.to), both ? 26 : 0, STATE_R, text * 8.4) };
    });
  });

  const startGeo = $derived.by(() => {
    if (!obj?.start || !byId.has(obj.start)) return null;
    const c = pos(obj.start);
    const pts = [...(neighbours.get(obj.start) ?? [])];
    const loop = groups.some((g) => g.from === obj.start && g.to === obj.start);
    if (loop) {
      const a = loopDir.get(obj.start) ?? 0;
      pts.push(add(c, { x: Math.cos(a) * 60, y: Math.sin(a) * 60 }));
    }
    return startArrow(c, freeAngle(c, pts, Math.PI));
  });

  // ---------------------------------------------------------------------------
  // Koordinaten

  function toWorld(e: { clientX: number; clientY: number }): Point {
    const r = svg!.getBoundingClientRect();
    return { x: (e.clientX - r.left - view.x) / view.k, y: (e.clientY - r.top - view.y) / view.k };
  }
  function toScreen(p: Point): Point {
    return { x: p.x * view.k + view.x, y: p.y * view.k + view.y };
  }

  export function fit(): void {
    const states = obj?.states ?? [];
    if (states.length === 0) {
      view = { x: width / 2, y: height / 2, k: 1 };
      return;
    }
    const xs = states.map((s) => s.pos?.x ?? 0);
    const ys = states.map((s) => s.pos?.y ?? 0);
    const pad = 90;
    const x0 = Math.min(...xs) - pad;
    const x1 = Math.max(...xs) + pad;
    const y0 = Math.min(...ys) - pad;
    const y1 = Math.max(...ys) + pad;
    const k = Math.min(1.5, Math.max(0.25, Math.min(width / (x1 - x0), height / (y1 - y0))));
    view = { k, x: width / 2 - ((x0 + x1) / 2) * k, y: height / 2 - ((y0 + y1) / 2) * k };
  }

  function zoomAt(screen: Point, factor: number): void {
    const k = Math.min(3, Math.max(0.2, view.k * factor));
    const f = k / view.k;
    view = { k, x: screen.x - (screen.x - view.x) * f, y: screen.y - (screen.y - view.y) * f };
  }
  export function zoom(factor: number): void {
    zoomAt({ x: width / 2, y: height / 2 }, factor);
  }

  export function layout(): void {
    if (!obj) return;
    const p = autoLayout(obj);
    store.update((o) => edit.moveStates(o, p));
    requestAnimationFrame(fit);
  }

  // Beim Wechsel des Objekts neu einpassen.
  let fittedFor = '';
  $effect(() => {
    const key = `${store.active}:${obj?.name}`;
    if (key !== fittedFor && width > 0 && obj) {
      fittedFor = key;
      queueMicrotask(fit);
    }
  });

  // ---------------------------------------------------------------------------
  // Zeiger

  function snap(p: Point, e: PointerEvent): Point {
    if (e.altKey) return p;
    return { x: Math.round(p.x / 10) * 10, y: Math.round(p.y / 10) * 10 };
  }

  function stateAt(p: Point): StateId | null {
    const states = obj?.states ?? [];
    for (let i = states.length - 1; i >= 0; i--) {
      const s = states[i]!;
      if (len(sub(p, s.pos ?? { x: 0, y: 0 })) <= STATE_R + 4) return s.id;
    }
    return null;
  }

  function onStateDown(e: PointerEvent, id: StateId): void {
    if (e.button !== 0 || spaceDown) return;
    e.stopPropagation();
    commitInline();
    const w = toWorld(e);
    const onRim = len(sub(w, pos(id))) > STATE_R - 8;
    svg!.setPointerCapture(e.pointerId);
    if (store.tool === 'edge' || (store.tool === 'select' && onRim && !e.shiftKey)) {
      drag = { type: 'edge', from: id, cur: w };
      return;
    }
    if (e.shiftKey) {
      store.select(selStates.has(id) ? store.selStates.filter((x) => x !== id) : [...store.selStates, id], store.selEdges);
    } else if (!selStates.has(id)) {
      store.select([id]);
    }
    const origin: Record<StateId, Point> = {};
    for (const s of store.selStates) origin[s] = { ...pos(s) };
    drag = { type: 'move', startWorld: w, origin, moved: false, key: `move:${Date.now()}` };
  }

  function onEdgeDown(e: PointerEvent, key: string): void {
    if (e.button !== 0 || spaceDown) return;
    e.stopPropagation();
    commitInline();
    if (e.shiftKey) {
      store.select(store.selStates, selEdges.has(key) ? store.selEdges.filter((k) => k !== key) : [...store.selEdges, key]);
    } else store.select([], [key]);
  }

  function onBackgroundDown(e: PointerEvent): void {
    commitInline();
    host?.focus({ preventScroll: true });
    svg!.setPointerCapture(e.pointerId);
    if (e.button === 1 || spaceDown || (e.button === 0 && store.tool === 'edge')) {
      drag = { type: 'pan', startScreen: { x: e.clientX, y: e.clientY }, startView: { x: view.x, y: view.y } };
      return;
    }
    if (e.button !== 0) return;
    const w = toWorld(e);
    if (store.tool === 'state') {
      createState(snap(w, e));
      return;
    }
    drag = { type: 'marquee', start: w, cur: w, additive: e.shiftKey, base: e.shiftKey ? store.selStates : [] };
    if (!e.shiftKey) store.select([]);
  }

  function onMove(e: PointerEvent): void {
    const w = toWorld(e);
    if (!drag) {
      const id = stateAt(w);
      hoverState = id;
      hoverRim = !!id && store.tool === 'select' && len(sub(w, pos(id))) > STATE_R - 8;
      return;
    }
    if (drag.type === 'pan') {
      view = { ...view, x: drag.startView.x + e.clientX - drag.startScreen.x, y: drag.startView.y + e.clientY - drag.startScreen.y };
    } else if (drag.type === 'marquee') {
      drag.cur = w;
      const r = { x: drag.start.x, y: drag.start.y, w: w.x - drag.start.x, h: w.y - drag.start.y };
      const inside = (obj?.states ?? []).filter((s) => rectContains(r, s.pos ?? { x: 0, y: 0 })).map((s) => s.id);
      store.select([...new Set([...drag.base, ...inside])]);
    } else if (drag.type === 'edge') {
      drag.cur = w;
      hoverState = stateAt(w);
    } else if (drag.type === 'move') {
      const d = sub(w, drag.startWorld);
      if (!drag.moved && len(d) * view.k < 3) return;
      drag.moved = true;
      const moves: Record<StateId, Point> = {};
      for (const [id, o] of Object.entries(drag.origin)) moves[id] = snap(add(o, d), e);
      store.update((o) => edit.moveStates(o, moves), drag.key);
    }
  }

  function onUp(e: PointerEvent): void {
    const d = drag;
    drag = null;
    if (!d) return;
    if (d.type === 'edge') {
      const w = toWorld(e);
      let target = stateAt(w);
      if (!target) {
        if (len(sub(w, pos(d.from))) < STATE_R + 12) return;
        target = createState(snap(w, e));
        if (!target) return;
      }
      openLabel(d.from, target);
    }
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    const r = svg!.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      zoomAt({ x: e.clientX - r.left, y: e.clientY - r.top }, Math.exp(-e.deltaY * 0.0022));
    } else {
      view = { ...view, x: view.x - e.deltaX, y: view.y - e.deltaY };
    }
  }

  // Wegen setPointerCapture landet auch ein Doppelklick auf einen Zustand hier.
  function onBackgroundDbl(e: MouseEvent): void {
    const w = toWorld(e);
    const hit = stateAt(w);
    if (hit) {
      store.select([hit]);
      inline = { type: 'rename', id: hit, value: byId.get(hit)?.name ?? '' };
      inlineError = '';
      return;
    }
    if (store.tool !== 'select') return;
    createState({ x: Math.round(w.x / 10) * 10, y: Math.round(w.y / 10) * 10 });
  }

  // ---------------------------------------------------------------------------
  // Aktionen

  function createState(p: Point): StateId | null {
    if (!obj) return null;
    const name = freshName(
      obj.states.map((s) => s.name),
      obj.states.length > 0 && obj.states.every((s) => /^\d+$/.test(s.name)) ? '' : 'z',
    );
    let id: StateId | null = null;
    store.update((o) => {
      const r = edit.addState(o, name, p);
      id = r.id;
      return o.start === null ? edit.setStart(r.obj, r.id) : r.obj;
    });
    if (id) store.select([id]);
    return id;
  }

  function labelText(o: FormalObject, from: StateId, to: StateId): string {
    return editLabels(
      o.kind,
      o.transitions.filter((x) => x.from === from && x.to === to).map((x) => x.label),
    );
  }

  function openLabel(from: StateId, to: StateId): void {
    if (!obj) return;
    const value = labelText(obj, from, to);
    inline = { type: 'label', from, to, value, isNew: value === '' };
    inlineError = '';
    store.select([], [edgeKey(from, to)]);
  }

  export function editSelection(): void {
    if (store.selStates.length === 1) {
      const id = store.selStates[0]!;
      inline = { type: 'rename', id, value: byId.get(id)?.name ?? '' };
      inlineError = '';
    } else if (store.selEdges.length === 1) {
      const [from, to] = store.selEdges[0]!.split('>') as [StateId, StateId];
      openLabel(from, to);
    }
  }

  function commitInline(): void {
    const cur = inline;
    if (!cur) return;
    if (cur.type === 'rename') {
      const name = cur.value.trim();
      if (name && name !== byId.get(cur.id)?.name) {
        if (!/^[\p{L}\p{N}_+'][\p{L}\p{N}_+'−-]*$/u.test(name)) {
          inlineError = 'Erlaubt: Buchstaben, Ziffern, _ + \' und - (nicht am Anfang)';
          return;
        }
        if (!store.update((o) => edit.renameState(o, cur.id, name))) return;
      }
      inline = null;
      return;
    }
    if (cur.type === 'output') {
      const raw = cur.value.trim();
      const w = raw === '' ? [] : raw.length === 1 ? [raw] : null;
      if (w === null) {
        inlineError = 'Die Ausgabe ist genau ein Symbol (oder leer).';
        return;
      }
      store.update((o) => (o.kind === 'moore' ? edit.setOutput(o, cur.id, w[0] ?? null) : o));
      inline = null;
      return;
    }
    const { labels, error } = parseLabelsFor(kind, cur.value);
    if (error) {
      inlineError = error;
      return;
    }
    store.update((o) => edit.setEdgeLabels(o, cur.from, cur.to, labels as never));
    inline = null;
  }

  function cancelInline(): void {
    inline = null;
    inlineError = '';
  }

  export function deleteSelection(): void {
    const keys = new Set(store.selEdges);
    const ids = store.selStates;
    if (!obj || (ids.length === 0 && keys.size === 0)) return;
    store.update((o) => {
      const trIds = o.transitions.filter((x) => keys.has(edgeKey(x.from, x.to))).map((x) => x.id);
      let next = trIds.length ? edit.removeTransitions(o, trIds) : o;
      if (ids.length) next = edit.removeStates(next, ids);
      return next;
    });
    store.select([]);
  }

  export function toggleStart(): void {
    const id = store.selStates[0];
    if (!id || !obj) return;
    store.update((o) => edit.setStart(o, o.start === id ? null : id));
  }

  export function toggleReject(): void {
    if (obj?.kind !== 'tm' || store.selStates.length === 0) return;
    const allOn = store.selStates.every((id) => rejectSet.has(id));
    store.update((o) => store.selStates.reduce((acc, id) => (acc.kind === 'tm' ? edit.setRejecting(acc, id, !allOn) : acc), o));
  }

  export function editOutput(): void {
    const id = store.selStates[0];
    if (obj?.kind !== 'moore' || !id) return;
    const s = obj.states.find((x) => x.id === id);
    inline = { type: 'output', id, value: s?.out ?? '' };
    inlineError = '';
  }

  export function toggleAccept(): void {
    if (!obj || !hasAccept || store.selStates.length === 0) return;
    const allOn = store.selStates.every((id) => acceptSet.has(id));
    store.update((o) => store.selStates.reduce((acc, id) => edit.setAccepting(acc, id, !allOn), o));
  }

  let clipboard: ReturnType<typeof edit.copyStates> | null = null;
  let pasteCount = 0;
  function copy(): void {
    if (!obj || store.selStates.length === 0) return;
    clipboard = edit.copyStates(obj, store.selStates);
    pasteCount = 0;
  }
  function paste(): void {
    if (!clipboard || !obj) return;
    pasteCount++;
    let ids: StateId[] = [];
    const frag = clipboard;
    store.update((o) => {
      const r = edit.pasteFragment(o, frag, { x: 40 * pasteCount, y: 40 * pasteCount });
      ids = r.ids;
      return r.obj;
    });
    store.select(ids);
  }

  function nudge(dx: number, dy: number): void {
    if (store.selStates.length === 0) return;
    const moves: Record<StateId, Point> = {};
    for (const id of store.selStates) moves[id] = add(pos(id), { x: dx, y: dy });
    store.update((o) => edit.moveStates(o, moves), 'nudge');
  }

  function isTyping(e: KeyboardEvent): boolean {
    const el = e.target as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === ' ' && !isTyping(e)) {
      spaceDown = e.type === 'keydown';
      if (spaceDown) e.preventDefault();
      return;
    }
    if (e.type !== 'keydown' || isTyping(e)) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z' && !e.shiftKey) store.undo();
    else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) store.redo();
    else if (mod && k === 'c') copy();
    else if (mod && k === 'v') paste();
    else if (mod && k === 'a') store.select((obj?.states ?? []).map((s) => s.id));
    else if (mod) return;
    else if (k === 'v') store.tool = 'select';
    else if (k === 'z') store.tool = 'state';
    else if (k === 'k') store.tool = 'edge';
    else if (k === 's') toggleStart();
    else if (k === 'a') toggleAccept();
    else if (k === 'r') toggleReject();
    else if (k === 'o') editOutput();
    else if (k === 'l') layout();
    else if (k === '0') fit();
    else if (k === '+' || k === '=') zoom(1.2);
    else if (k === '-') zoom(1 / 1.2);
    else if (e.key === 'F2' || e.key === 'Enter') editSelection();
    else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelection();
    else if (e.key === 'Escape') {
      store.select([]);
      store.tool = 'select';
    } else if (e.key.startsWith('Arrow') && store.selStates.length) {
      const s = e.shiftKey ? 50 : 10;
      nudge(e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0, e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0);
    } else return;
    e.preventDefault();
  }

  /** Wert sofort setzen und markieren, damit Tippen den alten Text ersetzt. */
  function focusInput(node: HTMLInputElement, initial: string): void {
    node.value = initial;
    node.focus();
    node.select();
  }

  // ---------------------------------------------------------------------------
  // Darstellungshilfen

  const inlineAnchor = $derived.by((): Point | null => {
    if (!inline) return null;
    if (inline.type === 'rename' || inline.type === 'output') return toScreen(add(pos(inline.id), { x: 0, y: STATE_R + 22 }));
    const g = geometry.find((x) => x.g.from === (inline as { from: string }).from && x.g.to === (inline as { to: string }).to);
    if (g) return toScreen(g.geo.label);
    return toScreen(pos(inline.from));
  });

  const toolbarAnchor = $derived.by((): Point | null => {
    if (drag || inline || store.selStates.length !== 1 || store.selEdges.length) return null;
    return toScreen(add(pos(store.selStates[0]!), { x: 0, y: -STATE_R - 14 }));
  });
  const edgeToolbarAnchor = $derived.by((): Point | null => {
    if (drag || inline || store.selEdges.length !== 1 || store.selStates.length) return null;
    const g = geometry.find((x) => x.g.key === store.selEdges[0]);
    return g ? toScreen(add(g.geo.label, { x: 0, y: -22 })) : null;
  });

  function fontFor(name: string): number {
    const n = [...name].length;
    return n <= 2 ? 19 : n === 3 ? 16 : Math.max(10, 44 / (n * 0.56));
  }

  const ghost = $derived.by(() => {
    if (drag?.type !== 'edge') return null;
    const target = hoverState && hoverState !== drag.from ? pos(hoverState) : drag.cur;
    if (hoverState === drag.from) return selfLoop(pos(drag.from), loopDir.get(drag.from) ?? -Math.PI / 2);
    const geo = edgeBetween(pos(drag.from), target, 0);
    if (!hoverState) {
      const d = sub(drag.cur, pos(drag.from));
      if (len(d) < STATE_R) return null;
      return { ...geo, path: `M${pos(drag.from).x + (d.x / len(d)) * STATE_R},${pos(drag.from).y + (d.y / len(d)) * STATE_R} L${drag.cur.x},${drag.cur.y}`, tip: drag.cur, dir: { x: d.x / len(d), y: d.y / len(d) } };
    }
    return geo;
  });

  const cursor = $derived(
    drag?.type === 'pan' || spaceDown
      ? drag
        ? 'grabbing'
        : 'grab'
      : store.tool === 'state'
        ? 'copy'
        : store.tool === 'edge' || hoverRim || drag?.type === 'edge'
          ? 'crosshair'
          : hoverState
            ? 'move'
            : 'default',
  );
</script>

<svelte:window onkeydown={onKey} onkeyup={onKey} />

<div
  class="canvas"
  bind:this={host}
  bind:clientWidth={width}
  bind:clientHeight={height}
  tabindex="-1"
  role="application"
  aria-label="Zustandsdiagramm"
>
  <svg
    bind:this={svg}
    {width}
    {height}
    style:cursor
    onpointerdown={onBackgroundDown}
    onpointermove={onMove}
    onpointerup={onUp}
    onpointercancel={() => (drag = null)}
    ondblclick={onBackgroundDbl}
    onwheel={onWheel}
    role="presentation"
  >
    <defs>
      <pattern id="dots" width={24 * view.k} height={24 * view.k} patternUnits="userSpaceOnUse" x={view.x} y={view.y}>
        <circle cx={1} cy={1} r={Math.max(0.6, 1 * Math.min(1, view.k))} fill="var(--grid)" />
      </pattern>
    </defs>
    <rect {width} {height} fill="url(#dots)" />

    <g transform="translate({view.x} {view.y}) scale({view.k})">
      <!-- Kanten -->
      {#each geometry as { g, geo } (g.key)}
        {@const selected = selEdges.has(g.key)}
        {@const side = g.from === g.to ? geo.label.x - pos(g.from).x : 0}
        {@const anchor = side > 20 ? 'start' : side < -20 ? 'end' : 'middle'}
        <g
          class="edge"
          class:selected
          class:fired={g.fired}
          onpointerdown={(e) => onEdgeDown(e, g.key)}
          ondblclick={(e) => {
            e.stopPropagation();
            openLabel(g.from, g.to);
          }}
          role="presentation"
        >
          <path class="hit" d={geo.path} />
          <path class="line" d={geo.path} />
          <path class="head" d={arrowHead(geo.tip, geo.dir)} />
          {#if stacked}
            {@const up = g.from === g.to && geo.label.y < pos(g.from).y - 20}
            {@const first = up ? -(g.labels.length - 1) * 1.3 : -((g.labels.length - 1) * 1.3) / 2}
            <text class="label mono" x={geo.label.x} y={geo.label.y} text-anchor={anchor} dominant-baseline="central">
              {#each g.labels as l, i (l.id)}<tspan x={geo.label.x} dy="{i === 0 ? first : 1.3}em" class:on={l.fired}>{l.text}</tspan>{/each}
            </text>
          {:else}
            <text class="label mono" x={geo.label.x} y={geo.label.y} text-anchor={anchor} dominant-baseline="central">
              {#each g.labels as l, i (l.id)}{#if i > 0}<tspan class="sep">,&#8239;</tspan>{/if}<tspan class:on={l.fired}>{l.text}</tspan>{/each}
            </text>
          {/if}
        </g>
      {/each}

      {#if ghost}
        <g class="edge ghost">
          <path class="line" d={ghost.path} />
          <path class="head" d={arrowHead(ghost.tip, ghost.dir)} />
        </g>
      {/if}

      {#if startGeo}
        <g class="start" class:fired={sim.trace && sim.index === 0}>
          <path class="line" d={startGeo.path} />
          <path class="head" d={arrowHead(startGeo.tip, startGeo.dir, 10)} />
        </g>
      {/if}

      <!-- Zustände -->
      {#each obj?.states ?? [] as s (s.id)}
        {@const p = s.pos ?? { x: 0, y: 0 }}
        {@const parts = splitSubscript(s.name)}
        {@const active = sim.active.has(s.id)}
        <g
          class="state"
          class:selected={selStates.has(s.id)}
          class:active
          class:accepting={acceptSet.has(s.id)}
          class:rejecting={rejectSet.has(s.id)}
          class:hl={highlight.has(s.id)}
          class:target={drag?.type === 'edge' && hoverState === s.id}
          transform="translate({p.x} {p.y})"
          onpointerdown={(e) => onStateDown(e, s.id)}
          role="presentation"
        >
          {#if selStates.has(s.id)}<circle class="sel-ring" r={STATE_R + 7} />{/if}
          {#if active}<circle class="halo" r={STATE_R + 9} />{/if}
          <circle class="body" r={STATE_R} />
          {#if hasAccept && acceptSet.has(s.id)}<circle class="inner" r={STATE_R - ACCEPT_GAP} />{/if}
          {#if rejectSet.has(s.id)}
            <!-- F−: innerer Ring gestrichelt, dazu ein Querstrich – nicht nur über Farbe unterscheidbar -->
            <circle class="inner reject" r={STATE_R - ACCEPT_GAP} />
            <path class="reject-bar" d="M{-STATE_R * 0.42},{STATE_R * 0.52} H{STATE_R * 0.42}" />
          {/if}
          {#if obj?.kind === 'moore'}
            {@const out = (s as { out?: string }).out}
            <text class="name" text-anchor="middle" dominant-baseline="central" y="-7" font-size={Math.min(16, fontFor(s.name))}
              >{parts.base}{#if parts.sub}<tspan class="subscript" dy="0.32em" font-size="0.66em">{parts.sub}</tspan>{/if}</text
            >
            <path class="out-rule" d="M{-STATE_R * 0.55},3 H{STATE_R * 0.55}" />
            <text class="out mono" class:missing={out === undefined} text-anchor="middle" dominant-baseline="central" y="13">{out ?? '?'}</text>
          {:else}
            <text class="name" text-anchor="middle" dominant-baseline="central" font-size={fontFor(s.name)}
              >{parts.base}{#if parts.sub}<tspan class="subscript" dy="0.32em" font-size="0.66em">{parts.sub}</tspan>{/if}</text
            >
          {/if}
          {#if sim.incomplete.has(s.id)}
            <g class="warn" transform="translate({STATE_R * 0.72} {-STATE_R * 0.72})">
              <title>Übergänge fehlen</title>
              <circle r="7.5" />
              <text text-anchor="middle" dominant-baseline="central">!</text>
            </g>
          {/if}
        </g>
      {/each}

      {#if drag?.type === 'marquee'}
        <rect
          class="marquee"
          x={Math.min(drag.start.x, drag.cur.x)}
          y={Math.min(drag.start.y, drag.cur.y)}
          width={Math.abs(drag.cur.x - drag.start.x)}
          height={Math.abs(drag.cur.y - drag.start.y)}
        />
      {/if}
    </g>
  </svg>

  {#if obj && obj.states.length === 0}
    <div class="empty">
      <div class="empty-mark" aria-hidden="true">
        <svg viewBox="0 0 120 60" width="120" height="60">
          <path d="M8 30 H28" class="e-line" /><path d="M28 30 l-7 -4 v8 z" class="e-head" />
          <circle cx="48" cy="30" r="17" class="e-state" />
          <path d="M66 30 H86" class="e-line" /><path d="M86 30 l-7 -4 v8 z" class="e-head" />
          <circle cx="104" cy="30" r="13" class="e-state" /><circle cx="104" cy="30" r="9.5" class="e-state" />
        </svg>
      </div>
      <p class="empty-title">{t('canvas.empty.title')}</p>
      <p class="empty-body">{t('canvas.empty.body')}</p>
      <p class="empty-body hint">{t(`kind.${kind}.long`)}: {LABEL_HELP[kind]}</p>
    </div>
  {/if}

  {#if toolbarAnchor}
    {@const id = store.selStates[0]!}
    <div class="float-bar" style:left="{toolbarAnchor.x}px" style:top="{toolbarAnchor.y}px">
      <button class="fb" class:on={obj?.start === id} onclick={toggleStart} title="{t('state.start')} (S)">
        <svg viewBox="0 0 16 16" width="14" height="14"><path d="M1 8h9" /><path d="M10 4.5 14 8l-4 3.5z" class="fill" /></svg>
        {t('state.start')}
      </button>
      {#if hasAccept}
        <button class="fb" class:on={acceptSet.has(id)} onclick={toggleAccept} title="{t('state.accept')} (A)">
          <svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="6.5" /><circle cx="8" cy="8" r="3.8" /></svg>
          {t(kind === 'tm' ? 'state.acceptTm' : 'state.accept')}
        </button>
      {/if}
      {#if kind === 'tm'}
        <button class="fb" class:on={rejectSet.has(id)} onclick={toggleReject} title="{t('state.reject')} (R)">
          <svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="6.5" /><path d="M5 8h6" /></svg>
          {t('state.reject')}
        </button>
      {/if}
      {#if kind === 'moore'}
        <button class="fb" onclick={editOutput} title="{t('state.output')} (O)">{t('state.output')}</button>
      {/if}
      <button class="fb" onclick={editSelection} title="{t('state.rename')} (F2)">{t('state.rename')}</button>
      <button class="fb danger" onclick={deleteSelection} title="{t('state.delete')} (Entf)" aria-label={t('state.delete')}>
        <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 4l8 8M12 4l-8 8" /></svg>
      </button>
    </div>
  {/if}

  {#if edgeToolbarAnchor}
    <div class="float-bar" style:left="{edgeToolbarAnchor.x}px" style:top="{edgeToolbarAnchor.y}px">
      <button class="fb" onclick={editSelection} title="{t('edge.edit')} (F2)">{t('edge.edit')}</button>
      <button class="fb danger" onclick={deleteSelection} aria-label={t('state.delete')} title="{t('state.delete')} (Entf)">
        <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 4l8 8M12 4l-8 8" /></svg>
      </button>
    </div>
  {/if}

  {#if inline && inlineAnchor}
    <div class="inline" style:left="{inlineAnchor.x}px" style:top="{inlineAnchor.y}px">
      <input
        class="mono"
        class:invalid={!!inlineError}
        use:focusInput={inline.value}
        bind:value={inline.value}
        placeholder={inline.type === 'label' ? LABEL_HINT[kind] : inline.type === 'output' ? '0' : ''}
        title={inline.type === 'label' ? LABEL_HELP[kind] : ''}
        aria-label={inline.type === 'label' ? t('edge.edit') : t('state.rename')}
        oninput={() => (inlineError = '')}
        onkeydown={(e) => {
          if (e.key === 'Enter') commitInline();
          else if (e.key === 'Escape') cancelInline();
          e.stopPropagation();
        }}
        onblur={() => {
          if (inline && !inlineError) commitInline();
        }}
      />
      {#if inline.type === 'label' && (kind === 'nea' || kind === 'nka')}
        <button class="eps" tabindex="-1" onmousedown={(e) => e.preventDefault()} onclick={() => inline && (inline.value += 'ε')}>ε</button>
      {/if}
      {#if inline.type === 'label' && kind === 'tm'}
        <button class="eps" tabindex="-1" onmousedown={(e) => e.preventDefault()} onclick={() => inline && (inline.value += '□')}>□</button>
      {/if}
      {#if inline.type === 'label'}<div class="inline-help">{LABEL_HELP[kind]}</div>{/if}
      {#if inlineError}<div class="inline-error">{inlineError}</div>{/if}
    </div>
  {/if}
</div>

<style>
  .canvas {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--sheet);
    outline: none;
    touch-action: none;
    user-select: none;
  }
  svg {
    display: block;
  }

  /* Kanten */
  .edge .hit {
    fill: none;
    stroke: transparent;
    stroke-width: 14;
  }
  .edge .line {
    fill: none;
    stroke: var(--ink-2);
    stroke-width: 1.5;
    transition: stroke 0.15s;
  }
  .edge .head {
    fill: var(--ink-2);
  }
  .edge .label {
    font-size: 14px;
    fill: var(--ink);
    paint-order: stroke;
    stroke: var(--sheet);
    stroke-width: 5px;
    stroke-linejoin: round;
  }
  .edge .label .sep {
    fill: var(--ink-3);
  }
  .edge:hover .line {
    stroke: var(--ink);
  }
  .edge.selected .line {
    stroke: var(--select);
    stroke-width: 2.2;
  }
  .edge.selected .head {
    fill: var(--select);
  }
  .edge.selected .label {
    fill: var(--select);
  }
  .edge.fired .line {
    stroke: var(--signal);
    stroke-width: 2.6;
    stroke-dasharray: 7 5;
    animation: march 0.6s linear infinite;
  }
  .edge.fired .head {
    fill: var(--signal);
  }
  .edge .label tspan.on {
    fill: var(--signal);
    font-weight: 700;
  }
  .edge.ghost .line {
    stroke: var(--select);
    stroke-dasharray: 4 4;
  }
  .edge.ghost .head {
    fill: var(--select);
  }
  @keyframes march {
    to {
      stroke-dashoffset: -12;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .edge.fired .line {
      animation: none;
    }
  }

  .start .line {
    stroke: var(--ink);
    stroke-width: 2;
  }
  .start .head {
    fill: var(--ink);
  }
  .start.fired .line {
    stroke: var(--signal);
  }
  .start.fired .head {
    fill: var(--signal);
  }

  /* Zustände */
  .state .body {
    fill: var(--state-fill);
    stroke: var(--ink);
    stroke-width: 1.8;
    transition:
      fill 0.15s,
      stroke 0.15s;
  }
  .state .inner {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.4;
  }
  .state .name {
    font-family: var(--font-math);
    font-style: italic;
    fill: var(--ink);
    pointer-events: none;
  }
  .state .subscript {
    font-style: normal;
  }
  .state:hover .body {
    stroke-width: 2.4;
  }
  .state .sel-ring {
    fill: var(--select-soft);
    stroke: var(--select);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }
  .state.target .body {
    stroke: var(--select);
    stroke-width: 3;
  }
  .state.hl .body {
    stroke: var(--signal);
    stroke-width: 3;
  }
  .state.active .body {
    fill: var(--signal);
    stroke: var(--signal);
  }
  .state.active .inner {
    stroke: var(--signal-ink);
  }
  .state.active .name {
    fill: var(--signal-ink);
    font-weight: 600;
  }
  .state .halo {
    fill: none;
    stroke: var(--signal);
    stroke-width: 2;
    opacity: 0.45;
  }
  .state .warn circle {
    fill: var(--warn);
    stroke: var(--sheet);
    stroke-width: 2;
  }
  .state .warn text {
    fill: var(--sheet);
    font: 700 11px var(--font-ui);
  }

  .marquee {
    fill: var(--select-soft);
    stroke: var(--select);
    stroke-width: 1;
    stroke-dasharray: 3 3;
    vector-effect: non-scaling-stroke;
  }

  /* Leere Fläche */
  .empty {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 6px;
    text-align: center;
    pointer-events: none;
    color: var(--ink-3);
  }
  .empty-title {
    margin: 10px 0 0;
    font-weight: 650;
    color: var(--ink-2);
  }
  .empty-body {
    margin: 0;
    max-width: 34ch;
  }
  .empty-body.hint {
    max-width: 46ch;
    margin-top: 8px;
    font-size: 12.5px;
  }
  .e-line,
  .e-state {
    fill: none;
    stroke: var(--rule-2);
    stroke-width: 1.6;
  }
  .e-head {
    fill: var(--rule-2);
  }

  /* Schwebende Leisten */
  .float-bar {
    position: absolute;
    transform: translate(-50%, -100%);
    display: flex;
    gap: 2px;
    padding: 3px;
    background: var(--ink);
    border-radius: 9px;
    box-shadow: var(--shadow);
    z-index: 5;
  }
  .fb {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 26px;
    padding: 0 9px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--paper);
    font-size: 12px;
    font-weight: 550;
  }
  .fb svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
  }
  .fb svg .fill {
    fill: currentColor;
    stroke: none;
  }
  .fb:hover {
    background: rgba(255, 255, 255, 0.12);
  }
  .fb.on {
    background: var(--signal);
    color: var(--signal-ink);
  }
  .fb.danger:hover {
    background: var(--bad);
    color: #fff;
  }

  .inline {
    position: absolute;
    transform: translate(-50%, -50%);
    z-index: 6;
    display: flex;
    gap: 4px;
    align-items: flex-start;
  }
  .inline input {
    width: 190px;
    height: 32px;
    padding: 0 10px;
    border: 1.5px solid var(--select);
    border-radius: 8px;
    background: var(--sheet);
    box-shadow:
      0 0 0 4px var(--select-soft),
      var(--shadow);
    font-size: 14px;
    text-align: center;
    outline: none;
  }
  .inline input.invalid {
    border-color: var(--bad);
    box-shadow: 0 0 0 4px var(--bad-soft);
  }
  .inline .eps {
    height: 32px;
    width: 32px;
    border: 1px solid var(--rule);
    border-radius: 8px;
    background: var(--sheet);
    font-family: var(--font-mono);
  }
  .inline-help {
    position: absolute;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    width: max-content;
    max-width: 320px;
    padding: 5px 9px;
    border-radius: 7px;
    background: var(--ink);
    color: var(--paper);
    font-size: 11.5px;
    pointer-events: none;
  }
  .state .inner.reject {
    stroke-dasharray: 4 3;
  }
  .state .reject-bar {
    stroke: var(--ink);
    stroke-width: 1.6;
  }
  .state .out-rule {
    stroke: var(--rule-2);
    stroke-width: 1;
  }
  .state .out {
    font-size: 12.5px;
    fill: var(--ink-2);
    pointer-events: none;
  }
  .state .out.missing {
    fill: var(--warn);
  }
  .state.active .out,
  .state.active .reject-bar {
    fill: var(--signal-ink);
    stroke: var(--signal-ink);
  }
  .inline-error {
    position: absolute;
    top: 38px;
    left: 50%;
    transform: translateX(-50%);
    width: max-content;
    max-width: 280px;
    padding: 6px 9px;
    border-radius: 7px;
    background: var(--bad);
    color: #fff;
    font-size: 12px;
  }
</style>
