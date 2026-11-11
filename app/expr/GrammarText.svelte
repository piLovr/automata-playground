<script lang="ts">
  // Produktionen einer Grammatik, gruppiert nach linker Seite wie im Skript (X → u | v).
  // Nichtterminale und Produktionen lassen sich zeigen und hervorheben.
  import type { ElemRef, Grammar, GrammarTypeInfo, Production, Sym } from '../../core/index';
  import { showSym } from '../lib/format';

  let {
    g,
    highlight = new Set<string>(),
    onhover,
    types,
    size = 'md',
  }: {
    g: Grammar;
    /** Schlüssel "n:X" bzw. "p:id". */
    highlight?: Set<string>;
    onhover?: (e: ElemRef | null) => void;
    /** Typ je Produktion anzeigen (Hauptansicht). */
    types?: GrammarTypeInfo;
    size?: 'sm' | 'md';
  } = $props();

  const N = $derived(new Set(g.nonterminals));
  const groups = $derived.by(() => {
    const m = new Map<string, { left: Sym[]; prods: Production[] }>();
    for (const p of g.productions) {
      const k = JSON.stringify(p.left);
      const e = m.get(k);
      if (e) e.prods.push(p);
      else m.set(k, { left: p.left, prods: [p] });
    }
    return [...m.values()];
  });
  /** Mehrbuchstabige Nichtterminale wie im Skript: X0 → X₀, Xz → X_z (tiefgestellt). */
  function nt(s: Sym): { base: string; sub: string } {
    const m = /^(\p{Lu})_?(.+)$/u.exec(s);
    return m ? { base: m[1]!, sub: m[2]! } : { base: showSym(s), sub: '' };
  }
  const typeOf = $derived(new Map((types?.productions ?? []).map((x) => [x.id, x])));
</script>

{#snippet word(w: Sym[])}
  {#if w.length === 0}<span class="eps">ε</span>{/if}
  {#each w as s, i (i)}
    {#if N.has(s)}
      <span
        class="nt"
        class:on={highlight.has(`n:${s}`)}
        onpointerenter={(e) => (e.stopPropagation(), onhover?.({ nonterminal: s }))}
        role="presentation">{nt(s).base}{#if nt(s).sub}<sub>{nt(s).sub}</sub>{/if}</span
      >
    {:else}<span class="t">{showSym(s)}</span>{/if}
  {/each}
{/snippet}

<div class="gram {size}" role="presentation" onpointerleave={() => onhover?.(null)}>
  {#if groups.length === 0}<p class="none">P = ∅</p>{/if}
  {#each groups as grp, gi (gi)}
    <div class="rule">
      <span class="left">{@render word(grp.left)}</span>
      <span class="arrow">→</span>
      <span class="rights">
        {#each grp.prods as p, i (p.id)}
          {#if i > 0}<span class="bar">|</span>{/if}
          {@const ty = typeOf.get(p.id)}
          <span
            class="alt"
            class:on={highlight.has(`p:${p.id}`)}
            onpointerenter={() => onhover?.({ production: p.id })}
            role="presentation"
            title={ty ? `Typ ${ty.type}` : undefined}
            >{@render word(p.right)}{#if ty && ty.type < 3}<sup class="ty ty{ty.type}">{ty.type}</sup>{/if}</span
          >
        {/each}
      </span>
    </div>
  {/each}
</div>

<style>
  .gram {
    display: grid;
    gap: 4px;
    font-family: var(--font-math);
  }
  .gram.md {
    font-size: 18px;
  }
  .gram.sm {
    font-size: 14.5px;
  }
  .rule {
    display: grid;
    grid-template-columns: auto auto 1fr;
    align-items: baseline;
    gap: 0 10px;
  }
  .left {
    text-align: right;
  }
  .arrow,
  .bar {
    color: var(--ink-3);
    font-family: var(--font-ui);
  }
  .bar {
    margin: 0 6px;
  }
  .nt {
    font-style: italic;
    color: var(--ink);
    border-radius: 3px;
  }
  .t {
    font-family: var(--font-mono);
    font-size: 0.88em;
    color: var(--select);
  }
  .eps {
    font-style: italic;
    color: var(--ink-2);
  }
  .alt {
    border-radius: 4px;
    padding: 0 2px;
  }
  .alt.on {
    background: var(--signal-soft);
    box-shadow: 0 2px 0 var(--signal);
  }
  .nt.on {
    background: var(--signal-soft);
    color: var(--signal);
    box-shadow: 0 2px 0 var(--signal);
  }
  .ty {
    font: 600 10px var(--font-ui);
    margin-left: 2px;
    color: var(--warn);
  }
  .ty0,
  .ty1 {
    color: var(--bad);
  }
  .none {
    margin: 0;
    color: var(--ink-3);
  }
</style>
