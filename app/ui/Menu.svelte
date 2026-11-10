<script lang="ts">
  import type { Snippet } from 'svelte';

  let { label, children, align = 'left', title }: { label: Snippet; children: Snippet<[() => void]>; align?: 'left' | 'right'; title?: string } =
    $props();

  let open = $state(false);
  let root: HTMLDivElement | undefined = $state();

  function close(): void {
    open = false;
  }

  function onDoc(e: PointerEvent): void {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }
</script>

<svelte:document onpointerdown={onDoc} onkeydown={(e) => e.key === 'Escape' && close()} />

<div class="menu" bind:this={root}>
  <button class="btn ghost trigger" aria-haspopup="menu" aria-expanded={open} {title} onclick={() => (open = !open)}>
    {@render label()}
    <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" /></svg>
  </button>
  {#if open}
    <div class="pop" class:right={align === 'right'} role="menu">
      {@render children(close)}
    </div>
  {/if}
</div>

<style>
  .menu {
    position: relative;
  }
  .trigger svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    opacity: 0.6;
  }
  .pop {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 30;
    min-width: 270px;
    padding: 5px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--sheet);
    box-shadow: var(--shadow);
  }
  .pop.right {
    left: auto;
    right: 0;
  }
  .pop :global(.item) {
    display: flex;
    align-items: baseline;
    gap: 10px;
    width: 100%;
    padding: 7px 10px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    text-align: left;
    font-size: 13px;
  }
  .pop :global(.item:hover),
  .pop :global(.item:focus-visible) {
    background: var(--paper-2);
  }
  .pop :global(.item .ref) {
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--signal);
    min-width: 30px;
  }
  .pop :global(.item .sub) {
    margin-left: auto;
    font-size: 11px;
    color: var(--ink-3);
  }
  .pop :global(.item.danger) {
    color: var(--bad);
  }
  .pop :global(hr) {
    margin: 4px 2px;
    border: 0;
    border-top: 1px solid var(--rule);
  }
</style>
