<script lang="ts">
  // Nur lesende Darstellung eines Automaten: Zwischenschritte der Verfahren und Arbeitsfläche.
  // Passt sich per viewBox in den verfügbaren Platz ein; keine Bearbeitung.
  import { autoLayout, type Automaton, type Point, type StateId, type TransitionId } from '../../core/index';
  import { showLabel } from '../lib/labels';
  import { STATE_R, ACCEPT_GAP, edgeBetween, selfLoop, freeAngle, spreadLabels, arrowHead, startArrow, splitSubscript, add } from './geometry';

  let {
    obj,
    highlight = new Set<StateId>(),
    classes = new Map<StateId, number>(),
    added = new Set<TransitionId>(),
    dim = new Set<StateId>(),
    onhover,
    label = 'Zustandsdiagramm',
    posHint,
  }: {
    obj: Automaton;
    highlight?: Set<StateId>;
    /** Klassennummer je Zustand (Minimierung, Potenzmenge): Farbe plus Nummer. */
    classes?: Map<StateId, number>;
    /** Neu entstandene Kanten (schrittweise Verfahren). */
    added?: Set<TransitionId>;
    /** Abgeblendete Zustände (z. B. nicht erreichbar). */
    dim?: Set<StateId>;
    onhover?: (id: StateId | null) => void;
    label?: string;
    /** Positionen nach Zustandsname (Zwischenstände behalten das Bild der Quelle). */
    posHint?: Map<string, Point>;
  } = $props();

  /** Positionen: gespeicherte, fehlende per autoLayout. */
  const positions = $derived.by(() => {
    const hinted = posHint
      ? { ...obj, states: obj.states.map((s) => (posHint.has(s.name) ? { ...s, pos: posHint.get(s.name) } : s)) }
      : obj;
    const useHint = posHint && hinted.states.filter((s) => posHint.has(s.name)).length >= obj.states.length / 2;
    const base = useHint ? (hinted as Automaton) : obj;
    const missing = base.states.some((s) => !s.pos);
    const auto = missing ? autoLayout(base, { keep: true }) : {};
    const m = new Map<StateId, Point>();
    for (const s of base.states) m.set(s.id, s.pos ?? auto[s.id] ?? { x: 0, y: 0 });
    return m;
  });
  const pos = (id: StateId): Point => positions.get(id) ?? { x: 0, y: 0 };
  const acceptSet = $derived(new Set(obj.accept));
  const hasAccept = $derived(obj.kind !== 'mealy' && obj.kind !== 'moore');
  const stacked = $derived(obj.kind === 'nka' || obj.kind === 'tm');

  interface Group {
    key: string;
    from: StateId;
    to: StateId;
    labels: { id: string; text: string; added: boolean }[];
    added: boolean;
  }
  const groups = $derived.by((): Group[] => {
    const map = new Map<string, Group>();
    for (const tr of obj.transitions) {
      const key = `${tr.from}>${tr.to}`;
      let g = map.get(key);
      if (!g) map.set(key, (g = { key, from: tr.from, to: tr.to, labels: [], added: false }));
      const isNew = added.has(tr.id);
      g.labels.push({ id: tr.id, text: showLabel(obj.kind, tr.label), added: isNew });
      if (isNew) g.added = true;
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
  const loopDir = $derived(new Map(obj.states.map((s) => [s.id, freeAngle(pos(s.id), neighbours.get(s.id) ?? [])])));

  const rawGeometry = $derived.by(() => {
    const keys = new Set(groups.map((g) => g.key));
    return groups.map((g) => {
      if (g.from === g.to) return { g, geo: selfLoop(pos(g.from), loopDir.get(g.from) ?? -Math.PI / 2) };
      const both = keys.has(`${g.to}>${g.from}`);
      const text = stacked
        ? Math.max(...g.labels.map((l) => [...l.text].length))
        : g.labels.reduce((n, l) => n + [...l.text].length, 0) + (g.labels.length - 1) * 2;
      return { g, geo: edgeBetween(pos(g.from), pos(g.to), both ? 26 : 0, STATE_R, text * 8.4) };
    });
  });

  /** Beschriftungen nach dem Platzieren entzerren, damit nichts übereinanderliegt. */
  const geometry = $derived.by(() => {
    const boxes = rawGeometry.map(({ g, geo }) => {
      const chars = stacked
        ? Math.max(...g.labels.map((l) => [...l.text].length))
        : g.labels.reduce((n, l) => n + [...l.text].length, 0) + (g.labels.length - 1) * 1.3;
      return {
        at: geo.label,
        w: chars * 8.4,
        h: (stacked ? g.labels.length * 1.3 : 1) * 14 + 2,
        loop: g.from === g.to ? pos(g.from) : undefined,
      };
    });
    const at = spreadLabels(boxes, (obj.states).map((s) => pos(s.id)));
    return rawGeometry.map((x, i) => ({ ...x, geo: { ...x.geo, label: at[i]! } }));
  });

  const startGeo = $derived.by(() => {
    if (!obj.start || !positions.has(obj.start)) return null;
    const c = pos(obj.start);
    const pts = [...(neighbours.get(obj.start) ?? [])];
    if (groups.some((g) => g.from === obj.start && g.to === obj.start)) {
      const a = loopDir.get(obj.start) ?? 0;
      pts.push(add(c, { x: Math.cos(a) * 60, y: Math.sin(a) * 60 }));
    }
    return startArrow(c, freeAngle(c, pts, Math.PI));
  });

  /** Umgebendes Rechteck aller Zustände, Schleifen und Beschriftungen. */
  const box = $derived.by(() => {
    if (obj.states.length === 0) return '0 0 100 60';
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    const take = (p: Point, r: number): void => {
      x0 = Math.min(x0, p.x - r);
      y0 = Math.min(y0, p.y - r);
      x1 = Math.max(x1, p.x + r);
      y1 = Math.max(y1, p.y + r);
    };
    for (const s of obj.states) take(pos(s.id), STATE_R + 14);
    for (const { g, geo } of geometry) {
      const w = g.labels.reduce((n, l) => n + [...l.text].length, 0) * 4.5 + 10;
      take(geo.label, 12);
      x0 = Math.min(x0, geo.label.x - w);
      x1 = Math.max(x1, geo.label.x + w);
    }
    if (startGeo) take(startGeo.tip, STATE_R + 40);
    const pad = 12;
    return `${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`;
  });

  function fontFor(name: string): number {
    const n = [...name].length;
    return n <= 2 ? 19 : n === 3 ? 16 : Math.max(9, 44 / (n * 0.56));
  }
</script>

<svg class="view" viewBox={box} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}>
  {#each geometry as { g, geo } (g.key)}
    {@const side = g.from === g.to ? geo.label.x - pos(g.from).x : 0}
    {@const anchor = side > 20 ? 'start' : side < -20 ? 'end' : 'middle'}
    <g class="edge" class:added={g.added}>
      <path class="line" d={geo.path} />
      <path class="head" d={arrowHead(geo.tip, geo.dir)} />
      {#if stacked}
        {@const first = -((g.labels.length - 1) * 1.3) / 2}
        <text class="label mono" x={geo.label.x} y={geo.label.y} text-anchor={anchor} dominant-baseline="central">
          {#each g.labels as l, i (l.id)}<tspan x={geo.label.x} dy="{i === 0 ? first : 1.3}em" class:on={l.added}>{l.text}</tspan>{/each}
        </text>
      {:else}
        <text class="label mono" x={geo.label.x} y={geo.label.y} text-anchor={anchor} dominant-baseline="central">
          {#each g.labels as l, i (l.id)}{#if i > 0}<tspan class="sep">,&#8239;</tspan>{/if}<tspan class:on={l.added}>{l.text}</tspan>{/each}
        </text>
      {/if}
    </g>
  {/each}

  {#if startGeo}
    <g class="start">
      <path class="line" d={startGeo.path} />
      <path class="head" d={arrowHead(startGeo.tip, startGeo.dir, 10)} />
    </g>
  {/if}

  {#each obj.states as s (s.id)}
    {@const p = pos(s.id)}
    {@const parts = splitSubscript(s.name)}
    {@const cls = classes.get(s.id)}
    <g
      class="state"
      class:hl={highlight.has(s.id)}
      class:dim={dim.has(s.id)}
      class:classed={cls !== undefined}
      style:--cls={cls !== undefined ? `var(--cls-${cls % 8})` : null}
      transform="translate({p.x} {p.y})"
      onpointerenter={() => onhover?.(s.id)}
      onpointerleave={() => onhover?.(null)}
      role="presentation"
    >
      {#if highlight.has(s.id)}<circle class="halo" r={STATE_R + 8} />{/if}
      <circle class="body" r={STATE_R} />
      {#if hasAccept && acceptSet.has(s.id)}<circle class="inner" r={STATE_R - ACCEPT_GAP} />{/if}
      <text class="name" text-anchor="middle" dominant-baseline="central" font-size={fontFor(s.name)}
        >{parts.base}{#if parts.sub}<tspan class="subscript" dy="0.32em" font-size="0.66em">{parts.sub}</tspan>{/if}</text
      >
      {#if cls !== undefined}
        <g class="badge" transform="translate({STATE_R * 0.78} {STATE_R * 0.78})">
          <circle r="9" />
          <text text-anchor="middle" dominant-baseline="central">{cls + 1}</text>
        </g>
      {/if}
    </g>
  {/each}
</svg>

<style>
  .view {
    display: block;
    width: 100%;
    height: 100%;
    user-select: none;
  }
  .edge .line {
    fill: none;
    stroke: var(--ink-2);
    stroke-width: 1.5;
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
  .edge.added .line {
    stroke: var(--signal);
    stroke-width: 2.4;
  }
  .edge.added .head {
    fill: var(--signal);
  }
  .edge .label tspan.on {
    fill: var(--signal);
    font-weight: 700;
  }
  .start .line {
    stroke: var(--ink);
    stroke-width: 2;
  }
  .start .head {
    fill: var(--ink);
  }
  .state .body {
    fill: var(--state-fill);
    stroke: var(--ink);
    stroke-width: 1.8;
  }
  .state.classed .body {
    stroke: var(--cls);
    stroke-width: 3;
    fill: color-mix(in srgb, var(--cls) 12%, var(--state-fill));
  }
  .state .inner {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.4;
  }
  .state.classed .inner {
    stroke: var(--cls);
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
  .state.hl .body {
    stroke: var(--signal);
    stroke-width: 3;
  }
  .state .halo {
    fill: var(--signal-soft);
    stroke: var(--signal);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }
  .state.dim {
    opacity: 0.35;
  }
  .badge circle {
    fill: var(--cls);
    stroke: var(--sheet);
    stroke-width: 2;
  }
  .badge text {
    fill: var(--sheet);
    font: 700 11px var(--font-ui);
  }
</style>
