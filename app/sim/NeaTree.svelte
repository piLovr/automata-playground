<script lang="ts">
  import type { StateId, TreeNode } from '../../core/index';
  import { store } from '../lib/store.svelte';
  import { stateName, showSym } from '../lib/format';
  import { showLabel } from '../lib/labels';
  import { t } from '../i18n';

  let {
    nodes,
    current,
    onhover,
    selected = null,
    stackOf = false,
    onselect,
  }: {
    nodes: TreeNode[];
    current: number;
    onhover: (s: StateId | null) => void;
    /** Gewählter Knoten (Kellerautomat: Ast für den Verlauf). */
    selected?: number | null;
    /** Kellerinhalt unter dem Knoten zeigen. */
    stackOf?: boolean;
    /** Klick auf einen Knoten; ohne Angabe springt die Simulation zur Position. */
    onselect?: (id: number) => void;
  } = $props();

  const MAX = 400;
  const COL = $derived(stackOf ? 88 : 74);
  const ROW = $derived(stackOf ? 40 : 30);

  const shown = $derived(nodes.slice(0, MAX));

  /** Ordentliche Baumanordnung: x = Tiefe, y = Blattreihenfolge, Eltern mittig. */
  const layout = $derived.by(() => {
    const kids = new Map<number, TreeNode[]>();
    let root: TreeNode | undefined;
    for (const n of shown) {
      if (n.parent === null) root = n;
      else (kids.get(n.parent) ?? kids.set(n.parent, []).get(n.parent)!).push(n);
    }
    const pos = new Map<number, { x: number; y: number; depth: number }>();
    let leaf = 0;
    let maxDepth = 0;
    const place = (n: TreeNode, depth: number): number => {
      maxDepth = Math.max(maxDepth, depth);
      const ch = kids.get(n.id) ?? [];
      let y: number;
      if (ch.length === 0) y = leaf++ * ROW;
      else {
        const ys = ch.map((c) => place(c, depth + 1));
        y = (ys[0]! + ys[ys.length - 1]!) / 2;
      }
      pos.set(n.id, { x: depth * COL, y, depth });
      return y;
    };
    if (root) place(root, 0);
    return { pos, w: (maxDepth + 1) * COL, h: Math.max(1, leaf) * ROW };
  });

  const byId = $derived(new Map(shown.map((n) => [n.id, n])));

  function viaLabel(n: TreeNode): string {
    if (!n.via || !store.aut) return '';
    const tr = store.aut.transitions.find((x) => x.id === n.via);
    return tr ? showLabel(store.aut.kind, tr.label) : '';
  }

  const GLYPH: Record<string, string> = { accepting: '✓', rejecting: '✗', dead: '†', cycle: '↻', limit: '…', open: '' };
</script>

<div class="tree">
  <svg width={layout.w + 60} height={layout.h + 16} role="img" aria-label={t('sim.tree')}>
    <g transform="translate(22 14)">
      {#each shown as n (n.id)}
        {#if n.parent !== null && byId.has(n.parent)}
          {@const a = layout.pos.get(n.parent)!}
          {@const b = layout.pos.get(n.id)!}
          <path class="link" class:eps={viaLabel(n) === 'ε'} d="M{a.x + 13},{a.y} C{a.x + COL / 2},{a.y} {b.x - COL / 2},{b.y} {b.x - 13},{b.y}" />
          <text class="via mono" x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 5} text-anchor="middle">{viaLabel(n)}</text>
        {/if}
      {/each}
      {#each shown as n (n.id)}
        {@const p = layout.pos.get(n.id)!}
        <g
          class="node {n.status}"
          class:now={n.pos === current}
          class:picked={n.id === selected}
          transform="translate({p.x} {p.y})"
          role="button"
          tabindex="-1"
          onmouseenter={() => onhover(n.state)}
          onmouseleave={() => onhover(null)}
          onclick={() => (onselect ? onselect(n.id) : (store.simStep = n.pos))}
          onkeydown={() => {}}
        >
          <title>{stateName(store.aut, n.state)} · {n.pos} {t('sim.read')}{n.status !== 'open' ? ` · ${t(`tree.${n.status}`)}` : ''}</title>
          <circle r="12" />
          <text class="math" text-anchor="middle" dominant-baseline="central">{stateName(store.aut, n.state)}</text>
          {#if GLYPH[n.status]}<text class="glyph" x="17" dominant-baseline="central">{GLYPH[n.status]}</text>{/if}
          {#if stackOf && n.stack}<text class="stk mono" y="22" text-anchor="middle">{n.stack.map(showSym).join('')}</text>{/if}
        </g>
      {/each}
    </g>
  </svg>
  {#if nodes.length > MAX}<p class="more">+ {nodes.length - MAX} …</p>{/if}
</div>

<style>
  .tree {
    overflow: auto;
    max-height: 100%;
  }
  svg {
    display: block;
  }
  .link {
    fill: none;
    stroke: var(--rule-2);
    stroke-width: 1.3;
  }
  .link.eps {
    stroke-dasharray: 3 3;
  }
  .via {
    font-size: 10.5px;
    fill: var(--ink-3);
  }
  .node {
    cursor: pointer;
  }
  .node circle {
    fill: var(--state-fill);
    stroke: var(--ink-2);
    stroke-width: 1.3;
  }
  .node text.math {
    font-size: 12.5px;
    fill: var(--ink);
    pointer-events: none;
  }
  .node .glyph {
    font-size: 12px;
    font-weight: 700;
  }
  .node.accepting circle {
    stroke: var(--ok);
    stroke-width: 2;
  }
  .node.accepting .glyph {
    fill: var(--ok);
  }
  .node.rejecting .glyph,
  .node.dead .glyph {
    fill: var(--bad);
  }
  .node.dead circle,
  .node.cycle circle {
    stroke-dasharray: 2.5 2;
  }
  .node.cycle .glyph,
  .node.limit .glyph {
    fill: var(--warn);
  }
  .node .stk {
    font-size: 10px;
    fill: var(--ink-3);
  }
  .node.picked circle {
    stroke: var(--select);
    stroke-width: 2.6;
  }
  .node.now circle {
    fill: var(--signal);
    stroke: var(--signal);
  }
  .node.now text.math {
    fill: var(--signal-ink);
  }
  .node:hover circle {
    stroke-width: 2.4;
  }
  .more {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--ink-3);
  }
</style>
