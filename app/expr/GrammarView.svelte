<script lang="ts">
  // Hauptfläche für Grammatiken: Produktionen wie im Skript, Typ-Erkennung mit Begründung
  // je Produktion (Abschnitt 3.1). Bearbeitet wird in der Text-Sicht.
  import { grammarType, type Grammar } from '../../core/index';
  import { store } from '../lib/store.svelte';
  import { hl } from '../lib/hl.svelte';
  import { showWord } from '../lib/format';
  import GrammarText from './GrammarText.svelte';
  import DerivePanel from '../derive/DerivePanel.svelte';
  import TreesPanel from '../derive/TreesPanel.svelte';
  import AnalysisPanel from '../derive/AnalysisPanel.svelte';
  import { t } from '../i18n';

  const g = $derived(store.obj as Grammar);
  const info = $derived(grammarType(g));
  const keys = $derived(hl.keysFor(g.name));

  type Tab = 'prods' | 'derive' | 'trees' | 'parse';
  let tab = $state<Tab>('prods');
  const TABS: Tab[] = ['prods', 'derive', 'trees', 'parse'];
  /** Bäume und Kellerautomaten-Analyse gibt es nur für Typ 2 und 3. */
  const needsType2 = (x: Tab): boolean => x === 'trees' || x === 'parse';
</script>

<div class="g-stage">
  <div class="tabs" role="tablist" aria-label={t('grammar.views')}>
    {#each TABS as x (x)}
      <button role="tab" aria-selected={tab === x} class:on={tab === x} disabled={needsType2(x) && info.type < 2} title={needsType2(x) && info.type < 2 ? t('grammar.needsType2') : undefined} onclick={() => (tab = x)}>{t(`grammar.tab.${x}`)}</button>
    {/each}
  </div>

  {#if tab === 'derive'}
    <DerivePanel {g} />
  {:else if tab === 'trees' && info.type >= 2}
    <TreesPanel {g} />
  {:else if tab === 'parse' && info.type >= 2}
    <AnalysisPanel {g} />
  {:else}
  <header>
    <p class="eyebrow">{t('grammar.productions')}</p>
    <p class="type">
      <span class="badge t{info.type}">{t('grammar.type', { n: info.type })}</span>
      <span>{t(`grammar.type${info.type}.desc`)}</span>
      {#if info.startEpsilonRule}<span class="note">{t('grammar.startEps')}</span>{/if}
    </p>
  </header>

  <div class="rules">
    <GrammarText {g} types={info} highlight={keys} onhover={(e) => hl.set(g.name, e)} />
  </div>

  {#if g.productions.length}
    <details class="why" open={info.type < 3}>
      <summary>{t('grammar.why')}</summary>
      <table>
        <thead><tr><th>{t('grammar.production')}</th><th>{t('grammar.maxType')}</th><th>{t('grammar.reason')}</th></tr></thead>
        <tbody>
          {#each info.productions as p (p.id)}
            {@const prod = g.productions.find((x) => x.id === p.id)}
            <tr
              class:on={keys.has(`p:${p.id}`)}
              onpointerenter={() => hl.set(g.name, { production: p.id })}
              onpointerleave={() => hl.set(g.name, null)}
            >
              <td class="math">{prod ? `${showWord(prod.left)} → ${showWord(prod.right)}` : p.id}</td>
              <td><span class="badge t{p.type}">{p.type}</span></td>
              <td>{t(`grammar.reason.${p.reason}`)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </details>
  {:else}
    <p class="empty">{t('grammar.empty')}</p>
  {/if}
  {/if}
</div>

<style>
  .tabs {
    display: flex;
    gap: 2px;
    border-bottom: 1px solid var(--rule);
    margin: -8px 0 0;
  }
  .tabs button {
    padding: 8px 14px;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    color: var(--ink-2);
    font-weight: 600;
    cursor: pointer;
  }
  .tabs button.on {
    color: var(--ink);
    border-bottom-color: var(--signal);
  }
  .tabs button:disabled {
    color: var(--ink-3);
    cursor: not-allowed;
  }
  .g-stage {
    height: 100%;
    overflow: auto;
    background: var(--sheet);
    padding: 24px 28px 32px;
    display: grid;
    align-content: start;
    gap: 20px;
  }
  header .eyebrow {
    margin: 0 0 6px;
  }
  .type {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    color: var(--ink-2);
  }
  .badge {
    display: inline-block;
    min-width: 22px;
    padding: 2px 8px;
    border-radius: 999px;
    font: 700 12px var(--font-ui);
    text-align: center;
    border: 1.5px solid currentColor;
  }
  .badge.t3 {
    color: var(--ok);
  }
  .badge.t2 {
    color: var(--select);
  }
  .badge.t1 {
    color: var(--warn);
  }
  .badge.t0 {
    color: var(--bad);
  }
  .note {
    font-size: 12.5px;
    color: var(--ink-3);
  }
  .rules {
    font-size: 20px;
    padding: 14px 18px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--state-fill);
    justify-self: start;
    min-width: min(100%, 420px);
  }
  .why summary {
    cursor: pointer;
    font-weight: 600;
    color: var(--ink-2);
  }
  table {
    margin-top: 10px;
    border-collapse: collapse;
    font-size: 14px;
  }
  th,
  td {
    padding: 5px 12px;
    border-bottom: 1px solid var(--rule);
    text-align: left;
  }
  th {
    font-size: 12px;
    color: var(--ink-3);
    font-weight: 600;
  }
  td.math {
    font-family: var(--font-math);
    font-style: italic;
  }
  tr.on td {
    background: var(--signal-soft);
  }
  .empty {
    color: var(--ink-3);
  }
</style>
