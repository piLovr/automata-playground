<script lang="ts">
  // Zeit- und Platzbedarf einer TM (5.20): t(n) und s(n) als Diagramm und Tabelle.
  import type { TM, TmCostRow } from '../../core/index';
  import { runner } from '../lib/runner.svelte';
  import { showWord } from '../lib/format';
  import { t } from '../i18n';

  let { tm }: { tm: TM } = $props();

  let maxLen = $state(6);
  let limit = $state(10000);
  let rows = $state<TmCostRow[] | null>(null);
  let forName = $state('');

  async function run(): Promise<void> {
    const out = await runner.run<TmCostRow[]>(t('cost.running'), { fn: 'tmCost', sources: [$state.snapshot(tm) as TM], maxLen, stepLimit: limit, opts: {} });
    if (out.status !== 'done') return;
    rows = out.value;
    forName = tm.name;
  }
  const shown = $derived(forName === tm.name ? rows : null);
  const notHalted = $derived(shown ? shown.reduce((a, r) => a + r.words - r.halted, 0) : 0);

  // Diagramm: zwei Linien über n, eigene y-Achse je Linie wäre unruhig – gemeinsame Skala.
  const W = 420;
  const Hh = 180;
  const P = { l: 40, r: 12, t: 12, b: 26 };
  const chart = $derived.by(() => {
    if (!shown || shown.length === 0) return null;
    const maxN = Math.max(1, ...shown.map((r) => r.n));
    const maxY = Math.max(1, ...shown.map((r) => Math.max(r.maxSteps ?? 0, r.maxVisited ?? 0)));
    const x = (n: number): number => P.l + (n / maxN) * (W - P.l - P.r);
    const y = (v: number): number => Hh - P.b - (v / maxY) * (Hh - P.t - P.b);
    const line = (f: (r: TmCostRow) => number | null): string =>
      shown
        .filter((r) => f(r) !== null)
        .map((r, i) => `${i ? 'L' : 'M'}${x(r.n).toFixed(1)},${y(f(r)!).toFixed(1)}`)
        .join('');
    const ticks = [0, Math.round(maxY / 2), maxY];
    return { x, y, steps: line((r) => r.maxSteps), visited: line((r) => r.maxVisited), ticks, maxN };
  });
</script>

<div class="cost">
  <p class="eyebrow">{t('cost.title')}</p>
  <p class="intro">{t('cost.intro')}</p>
  {#if tm.alphabet.length === 0}
    <p class="muted">{t('cost.noAlphabet')}</p>
  {:else}
    <div class="row">
      <label>{t('cost.maxLen')} <input class="mono" type="number" min="0" max="12" bind:value={maxLen} /></label>
      <label>{t('sim.limit')} <input class="mono" type="number" min="10" step="100" bind:value={limit} /></label>
      <button class="btn primary" onclick={run} disabled={!!runner.busy}>{t('cost.run')}</button>
    </div>
  {/if}

  {#if shown && chart}
    <svg viewBox="0 0 {W} {Hh}" class="chart" role="img" aria-label={t('cost.title')}>
      {#each chart.ticks as v (v)}
        <line x1={P.l} x2={W - P.r} y1={chart.y(v)} y2={chart.y(v)} class="grid" />
        <text x={P.l - 6} y={chart.y(v) + 4} class="tick" text-anchor="end">{v}</text>
      {/each}
      {#each shown as r (r.n)}
        <text x={chart.x(r.n)} y={Hh - 8} class="tick" text-anchor="middle">{r.n}</text>
      {/each}
      <path d={chart.steps} class="l steps" />
      <path d={chart.visited} class="l visited" />
      {#each shown as r (r.n)}
        {#if r.maxSteps !== null}<circle cx={chart.x(r.n)} cy={chart.y(r.maxSteps)} r="3" class="steps" />{/if}
        {#if r.maxVisited !== null}<circle cx={chart.x(r.n)} cy={chart.y(r.maxVisited)} r="3" class="visited" />{/if}
      {/each}
    </svg>
    <p class="key"><span class="sw steps"></span>{t('cost.steps')} <span class="sw visited"></span>{t('cost.visited')}</p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>{t('cost.n')}</th><th>{t('cost.words')}</th><th>{t('cost.halted')}</th><th>{t('cost.steps')}</th><th>{t('cost.visited')}</th><th>{t('cost.worst')}</th></tr>
        </thead>
        <tbody>
          {#each shown as r (r.n)}
            <tr>
              <td>{r.n}</td><td>{r.words}</td><td class:warn={r.halted < r.words}>{r.halted}</td>
              <td class="mono">{r.maxSteps ?? '–'}</td><td class="mono">{r.maxVisited ?? '–'}</td>
              <td class="mono">{r.worstWord ? showWord(r.worstWord) : '–'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if notHalted > 0}<p class="warn">{t('cost.notHalted', { k: notHalted, limit })}</p>{/if}
    <p class="muted">{t('cost.counting')}</p>
  {/if}
</div>

<style>
  .cost {
    display: grid;
    gap: 10px;
  }
  .eyebrow {
    margin: 0;
  }
  .intro,
  .muted {
    margin: 0;
    font-size: 12.5px;
    color: var(--ink-2);
  }
  .muted {
    color: var(--ink-3);
  }
  .row {
    display: flex;
    gap: 8px 14px;
    flex-wrap: wrap;
    align-items: center;
    font-size: 13px;
  }
  .row input {
    width: 76px;
    padding: 4px 6px;
    border: 1px solid var(--rule-2);
    border-radius: 6px;
    background: var(--sheet);
    color: var(--ink);
  }
  .chart {
    width: 100%;
    max-width: 460px;
  }
  .grid {
    stroke: var(--rule);
  }
  .tick {
    font: 10px var(--font-mono);
    fill: var(--ink-3);
  }
  .l {
    fill: none;
    stroke-width: 2;
  }
  .l.steps {
    stroke: var(--cls-0);
  }
  .l.visited {
    stroke: var(--cls-2);
  }
  circle.steps {
    fill: var(--cls-0);
  }
  circle.visited {
    fill: var(--cls-2);
  }
  .key {
    margin: 0;
    font-size: 12px;
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .sw {
    width: 14px;
    height: 3px;
    border-radius: 2px;
    display: inline-block;
  }
  .sw.steps {
    background: var(--cls-0);
  }
  .sw.visited {
    background: var(--cls-2);
    margin-left: 10px;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    font-size: 12.5px;
  }
  th,
  td {
    padding: 3px 8px;
    border: 1px solid var(--rule);
    text-align: right;
  }
  th {
    background: var(--paper-2);
    font-weight: 600;
  }
  .warn {
    color: var(--warn);
    margin: 0;
    font-size: 12.5px;
  }
</style>
