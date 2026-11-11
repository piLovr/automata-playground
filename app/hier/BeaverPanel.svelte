<script lang="ts">
  // Fleißiger Biber (5.40, 5.41): alle Maschinen mit n Nichtendzuständen aufzählen und bis zum
  // Schrittlimit ausführen. Aussagen gelten nur unter den haltenden Maschinen.
  import type { BeaverResult } from '../../core/index';
  import { store } from '../lib/store.svelte';
  import { runner } from '../lib/runner.svelte';
  import { t } from '../i18n';

  const SCRIPT = [1, 4, 6, 13, '⩾ 4098', '⩾ 4,6 · 10¹⁴³⁹'];

  let n = $state<1 | 2 | 3 | 4>(3);
  let limit = $state(200);
  let result = $state<BeaverResult | null>(null);

  async function run(): Promise<void> {
    result = null;
    const out = await runner.run<BeaverResult>(t('beaver.running'), { fn: 'busyBeaver', n, stepLimit: limit, opts: {} });
    if (out.status === 'done') result = out.value;
  }

  function open(): void {
    if (!result?.best) return;
    store.insertObject({ ...result.best.tm, name: `BB${result.n}` });
    store.setView('single');
  }
</script>

<div class="beaver">
  <h3>{t('beaver.title')}</h3>
  <p>{t('beaver.intro')}</p>

  <div class="row">
    <div class="seg" role="group" aria-label={t('beaver.n')}>
      {#each [1, 2, 3, 4] as const as k (k)}
        <button aria-pressed={n === k} onclick={() => (n = k)}>n = {k}</button>
      {/each}
    </div>
    <label>{t('beaver.limit')} <input class="mono" type="number" min="10" max="100000" step="10" bind:value={limit} /></label>
    <button class="btn primary" onclick={run} disabled={!!runner.busy}>{t('beaver.run')}</button>
    {#if n === 4}<span class="muted">{t('beaver.slow')}</span>{/if}
  </div>

  {#if result}
    <div class="result">
      <dl class="counts">
        <dt>{t('beaver.enumerated')}</dt><dd class="mono">{result.enumerated.toLocaleString('de-DE')}</dd>
        <dt>{t('beaver.halted')}</dt><dd class="mono">{result.halted.toLocaleString('de-DE')}</dd>
        <dt>{t('beaver.loop')}</dt><dd class="mono">{result.provenLoop.toLocaleString('de-DE')}</dd>
        <dt>{t('beaver.undecided', { limit: result.stepLimit })}</dt><dd class="mono">{result.undecided.toLocaleString('de-DE')}</dd>
      </dl>
      {#if result.best}
        <p class="best">{t('beaver.best', { ones: result.best.ones, steps: result.best.steps })}</p>
        {#if result.longest}<p>{t('beaver.longest', { steps: result.longest.steps })}</p>{/if}
        <p class={result.undecided === 0 ? 'ok' : 'caveat'}>
          {result.undecided === 0 ? t('beaver.allDecided', { n: result.n }) : t('beaver.caveat', { limit: result.stepLimit, k: result.undecided.toLocaleString('de-DE') })}
        </p>
        <p class="muted">{t('beaver.script', { n: result.n, v: SCRIPT[result.n - 1] })}</p>
        <button class="btn" onclick={open}>{t('beaver.open')}</button>
      {/if}
    </div>
  {/if}

  <div>
    <p class="eyebrow">{t('beaver.table')}</p>
    <table>
      <tbody>
        <tr><th>n</th>{#each [...SCRIPT.keys()] as i (i)}<td>{i + 1}</td>{/each}</tr>
        <tr><th>BB(n)</th>{#each SCRIPT as v, i (i)}<td class="mono">{v}</td>{/each}</tr>
      </tbody>
    </table>
    <button class="btn small ghost" onclick={() => store.loadExample('b5-41', { activate: false })}>+ 5.41</button>
  </div>
</div>

<style>
  .beaver {
    display: grid;
    gap: 14px;
    max-width: 860px;
  }
  h3 {
    margin: 0;
    font-size: 15px;
  }
  p {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.5;
  }
  .row {
    display: flex;
    gap: 10px 16px;
    align-items: center;
    flex-wrap: wrap;
    font-size: 13px;
  }
  .row input {
    width: 90px;
    padding: 4px 8px;
    border: 1px solid var(--rule-2);
    border-radius: 6px;
    background: var(--sheet);
    color: var(--ink);
  }
  .seg {
    display: inline-flex;
    padding: 2px;
    border: 1px solid var(--rule);
    border-radius: 9px;
    background: var(--paper-2);
  }
  .seg button {
    padding: 4px 10px;
    border: none;
    border-radius: 7px;
    background: none;
    color: var(--ink-2);
    font-weight: 600;
    cursor: pointer;
  }
  .seg button[aria-pressed='true'] {
    background: var(--sheet);
    color: var(--ink);
    box-shadow: var(--shadow);
  }
  .result {
    display: grid;
    gap: 8px;
    padding: 12px;
    border: 1px solid var(--rule);
    border-radius: 12px;
    background: var(--paper);
  }
  .result .btn {
    justify-self: start;
  }
  .counts {
    display: grid;
    grid-template-columns: max-content max-content;
    gap: 2px 14px;
    margin: 0;
    font-size: 13px;
  }
  .counts dt {
    color: var(--ink-2);
  }
  .counts dd {
    margin: 0;
    text-align: right;
  }
  .best {
    font-weight: 700;
  }
  .ok {
    color: var(--ok);
  }
  .caveat {
    color: var(--warn);
  }
  .muted {
    color: var(--ink-3);
    font-size: 12.5px;
  }
  table {
    border-collapse: collapse;
    font-size: 13px;
    margin: 4px 0 8px;
  }
  th,
  td {
    padding: 3px 10px;
    border: 1px solid var(--rule);
    text-align: center;
  }
  th {
    background: var(--paper-2);
  }
  .small {
    padding: 2px 8px;
    font-size: 12px;
  }
</style>
