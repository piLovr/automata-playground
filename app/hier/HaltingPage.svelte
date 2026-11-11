<script lang="ts">
  // Halteproblem (5.33–5.35) als Erklärseite: Diagonalargument und das Schrittlimit als
  // Anschauung. Formulierungsregel: Nicht-Halten wird nie behauptet, nur „noch nicht gehalten“.
  import { simulate, type TM } from '../../core/index';
  import { store } from '../lib/store.svelte';
  import { parseInputWord } from '../lib/format';
  import { t } from '../i18n';

  // Illustrative Tabelle: Tₓ hält für w? (✓/·), die Diagonale ist hervorgehoben.
  const N = 5;
  const H = [
    [1, 0, 1, 1, 0],
    [0, 0, 1, 0, 1],
    [1, 1, 1, 0, 0],
    [0, 1, 0, 0, 1],
    [1, 0, 0, 1, 1],
  ];
  const sym = (h: number): string => (h ? '✓' : '·');

  const tms = $derived(store.doc.objects.filter((o): o is TM => o.kind === 'tm'));
  let pick = $state('');
  const tm = $derived(tms.find((m) => m.name === pick) ?? tms[0] ?? null);
  let word = $state('');
  let limit = $state(20);
  const run = $derived.by(() => {
    if (!tm) return null;
    const w = parseInputWord(word);
    if (!w) return null;
    const tr = simulate(tm, w, { stepLimit: limit });
    return { result: tr.result, steps: tr.steps.length - 1 };
  });
</script>

<div class="halting">
  <section>
    <h3>{t('halting.title')}</h3>
    <p>{t('halting.def')}</p>
    <p>{t('halting.theorem')}</p>
  </section>

  <section>
    <h3>{t('halting.diagTitle')}</h3>
    <p>{t('halting.diagText')}</p>
    <div class="table-wrap">
      <table class="diag">
        <thead>
          <tr>
            <th></th>
            {#each Array.from({ length: N }, (_, w) => w) as w (w)}<th>w = {w}</th>{/each}
            <th class="v">w = v</th>
          </tr>
        </thead>
        <tbody>
          {#each H as row, x (x)}
            <tr>
              <th>T<sub>{x}</sub></th>
              {#each row as h, w (w)}<td class:d={x === w}>{sym(h)}</td>{/each}
              <td class="muted">…</td>
            </tr>
          {/each}
          <tr class="flip">
            <th>T<sub>v</sub></th>
            {#each H as row, w (w)}<td class="d">{sym(1 - row[w]!)}</td>{/each}
            <td class="contra">?</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="legend">✓ {t('halting.diagHalts')} · · {t('halting.diagRuns')} · {t('halting.diagFlip')} · {t('halting.diagContra')}</p>
  </section>

  <section>
    <h3>{t('halting.tryTitle')}</h3>
    <p>{t('halting.tryText')}</p>
    {#if !tm}
      <p class="muted">
        {t('halting.noTm')}
        <button class="btn small" onclick={() => store.loadExample('b5-9', { activate: false })}>5.9</button>
        <button class="btn small" onclick={() => store.loadExample('b5-41', { activate: false })}>5.41</button>
      </p>
    {:else}
      <div class="row">
        <label>{t('halting.machine')}
          <select bind:value={pick}>
            {#each tms as m (m.name)}<option value={m.name}>{m.name}</option>{/each}
          </select>
        </label>
        <label>{t('halting.word')} <input class="mono" bind:value={word} placeholder="ε" /></label>
        <label class="grow">{t('halting.limit')} <input type="range" min="1" max="2000" bind:value={limit} /> <span class="mono">{limit}</span></label>
      </div>
      {#if run}
        <p class="verdict" class:ok={run.result !== 'limit'}>
          {run.result === 'limit' ? t('halting.notYet', { n: limit }) : t('halting.halted', { n: run.steps, result: t(`result.${run.result}`) })}
        </p>
      {/if}
    {/if}
    <p class="muted">{t('halting.more')}</p>
  </section>
</div>

<style>
  .halting {
    display: grid;
    gap: 22px;
    max-width: 860px;
  }
  section {
    display: grid;
    gap: 8px;
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
  .table-wrap {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    font-size: 13px;
  }
  th,
  td {
    padding: 4px 10px;
    border: 1px solid var(--rule);
    text-align: center;
  }
  th {
    background: var(--paper-2);
    font-weight: 600;
  }
  td.d {
    background: var(--signal-soft);
    font-weight: 700;
  }
  tr.flip th,
  tr.flip td {
    border-top: 2px solid var(--ink);
  }
  td.contra {
    background: var(--bad-soft);
    color: var(--bad);
    font-weight: 700;
  }
  .legend,
  .muted {
    color: var(--ink-3);
    font-size: 12.5px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 18px;
    align-items: center;
    font-size: 13px;
  }
  .row label {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .row input.mono {
    width: 120px;
    padding: 4px 8px;
    border: 1px solid var(--rule-2);
    border-radius: 6px;
    background: var(--sheet);
    color: var(--ink);
  }
  .row select {
    padding: 3px 6px;
  }
  .grow input {
    width: 200px;
    accent-color: var(--ink);
  }
  .verdict {
    font-weight: 700;
    color: var(--warn, var(--ink-2));
  }
  .verdict.ok {
    color: var(--ok);
  }
  .small {
    padding: 2px 8px;
    font-size: 12px;
  }
</style>
