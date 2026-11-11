<script lang="ts">
  // Ableitungsbaum nach 4.19: Wurzel oben, Kinder in Reihenfolge der rechten Seite,
  // ε-Blätter kursiv. Blätter gleichmäßig nebeneinander, Eltern mittig darüber.
  import type { DerivTree, Sym } from '../../core/index';

  let {
    tree,
    nonterminals,
    highlight = new Set<number>(),
    onhover,
    compact = false,
  }: {
    tree: DerivTree;
    nonterminals: Sym[];
    /** Knoten-ids, die hervorgehoben werden (z. B. Unterschied zu einem anderen Baum). */
    highlight?: Set<number>;
    onhover?: (id: number | null) => void;
    compact?: boolean;
  } = $props();

  interface Placed {
    id: number;
    label: string;
    sub: string;
    eps: boolean;
    nt: boolean;
    x: number;
    y: number;
    parent: Placed | null;
  }

  const N = $derived(new Set(nonterminals));
  const placed = $derived.by(() => {
    const out: Placed[] = [];
    let leaf = 0;
    let depth = 0;
    const walk = (t: DerivTree, d: number, parent: Placed | null): Placed => {
      depth = Math.max(depth, d);
      const sym = t.sym;
      const m = sym && N.has(sym) ? /^(\p{Lu})_?(.+)$/u.exec(sym) : null;
      const p: Placed = {
        id: t.id,
        label: sym === null ? 'ε' : m ? m[1]! : sym,
        sub: m ? m[2]! : '',
        eps: sym === null,
        nt: sym !== null && N.has(sym),
        x: 0,
        y: d,
        parent,
      };
      out.push(p);
      if (t.children.length === 0) p.x = leaf++;
      else {
        const kids = t.children.map((c) => walk(c, d + 1, p));
        p.x = (kids[0]!.x + kids[kids.length - 1]!.x) / 2;
      }
      return p;
    };
    walk(tree, 0, null);
    return { nodes: out, width: Math.max(1, leaf), depth };
  });

  const DX = $derived(compact ? 30 : 40);
  const DY = $derived(compact ? 42 : 54);
</script>

<svg
  class="tree"
  viewBox="{-DX / 2 - 4} {-20} {placed.width * DX + 8} {(placed.depth + 1) * DY + 4}"
  style:max-width="{placed.width * DX * 1.6 + 40}px"
  role="img"
  aria-label="Ableitungsbaum"
  onpointerleave={() => onhover?.(null)}
>
  {#each placed.nodes as n (n.id)}
    {#if n.parent}
      <line x1={n.parent.x * DX} y1={n.parent.y * DY + 10} x2={n.x * DX} y2={n.y * DY - 12} />
    {/if}
  {/each}
  {#each placed.nodes as n (n.id)}
    <g
      class="node"
      class:nt={n.nt}
      class:eps={n.eps}
      class:on={highlight.has(n.id)}
      transform="translate({n.x * DX} {n.y * DY})"
      onpointerenter={() => onhover?.(n.id)}
      role="presentation"
    >
      {#if highlight.has(n.id)}<circle r="14" class="halo" />{/if}
      <text text-anchor="middle" dominant-baseline="central"
        >{n.label}{#if n.sub}<tspan dy="0.35em" font-size="0.68em">{n.sub}</tspan>{/if}</text
      >
    </g>
  {/each}
</svg>

<style>
  .tree {
    width: 100%;
    height: auto;
    overflow: visible;
    display: block;
  }
  line {
    stroke: var(--rule-2);
    stroke-width: 1.4;
  }
  .node text {
    font-family: var(--font-mono);
    font-size: 16px;
    fill: var(--select);
  }
  .node.nt text {
    font-family: var(--font-math);
    font-style: italic;
    font-size: 18px;
    fill: var(--ink);
  }
  .node.eps text {
    font-family: var(--font-math);
    font-style: italic;
    fill: var(--ink-3);
  }
  .halo {
    fill: var(--signal-soft);
    stroke: var(--signal);
    stroke-width: 1.5;
  }
  .node.on text {
    fill: var(--signal);
    font-weight: 700;
  }
</style>
