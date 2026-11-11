<script lang="ts">
  // Ansicht „Hierarchie“ (Kapitel 5): Landkarte, Halteproblem, fleißiger Biber.
  import HierMap from './HierMap.svelte';
  import HaltingPage from './HaltingPage.svelte';
  import BeaverPanel from './BeaverPanel.svelte';
  import { t } from '../i18n';

  type Tab = 'map' | 'halting' | 'beaver';
  let tab = $state<Tab>('map');
</script>

<div class="hier">
  <div class="tabs" role="tablist">
    {#each ['map', 'halting', 'beaver'] as const as x (x)}
      <button role="tab" aria-selected={tab === x} class:on={tab === x} onclick={() => (tab = x)}>{t(`hier.tabs.${x}`)}</button>
    {/each}
  </div>
  {#if tab === 'map'}
    <h2>{t('hier.title')}</h2>
    <HierMap />
  {:else if tab === 'halting'}
    <HaltingPage />
  {:else}
    <BeaverPanel />
  {/if}
</div>

<style>
  .hier {
    height: 100%;
    overflow: auto;
    background: var(--paper);
    padding: 16px 20px 28px;
    display: grid;
    align-content: start;
    gap: 14px;
  }
  h2 {
    margin: 0;
    font-size: 17px;
  }
  .tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--rule);
  }
  .tabs button {
    padding: 6px 12px;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    color: var(--ink-2);
    font-weight: 600;
    cursor: pointer;
  }
  .tabs button.on {
    color: var(--ink);
    border-bottom-color: var(--ink);
  }
</style>
