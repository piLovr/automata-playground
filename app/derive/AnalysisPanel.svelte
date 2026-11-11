<script lang="ts">
  // Syntaxanalyse mit Kellerautomat: top-down nach 4.27/4.28 (Lauf neben der Linksableitung)
  // und bottom-up nach 4.33/4.34 (Schiebe- und Reduktionsschritte, Rechtsableitung).
  import type { Grammar, ParseAction, ParseRun, ProcResult, Word } from '../../core/index';
  import { store } from '../lib/store.svelte';
  import { runner } from '../lib/runner.svelte';
  import { diagnosticText, parseInputWord, showSym, showWord } from '../lib/format';
  import TreeView from './TreeView.svelte';
  import { t } from '../i18n';

  let { g }: { g: Grammar } = $props();

  let word = $state(store.word);
  let mode = $state<'top' | 'bottom'>('top');
  let run = $state<ParseRun | null>(null);
  let runMode = $state<'top' | 'bottom'>('top');
  let error = $state('');

  async function analyse(): Promise<void> {
    const w = parseInputWord(word);
    if (!w) return store.notify(t('error.word'), 'error');
    error = '';
    const out = await runner.run<ProcResult<ParseRun>>(t(mode === 'top' ? 'parse.top' : 'parse.bottom'), {
      fn: mode === 'top' ? 'topDownRun' : 'bottomUpRun',
      sources: [$state.snapshot(g) as Grammar],
      word: w,
      opts: {},
    });
    if (out.status !== 'done') return;
    if (out.value.ok) {
      run = out.value.result;
      runMode = mode;
    } else {
      run = null;
      error = out.value.diagnostics[0] ? diagnosticText(out.value.diagnostics[0]) : t('proc.failed');
    }
  }

  const prodText = (id: string): string => {
    const p = g.productions.find((x) => x.id === id);
    return p ? `${showWord(p.left)} → ${showWord(p.right)}` : id;
  };
  function action(a: ParseAction | null): string {
    if (!a) return '';
    switch (a.kind) {
      case 'start':
        return t('parse.start');
      case 'produce':
      case 'reduce':
        return prodText(a.production);
      case 'read':
      case 'shift':
        return t('parse.read', { x: showSym(a.sym) });
      case 'accept':
        return t('parse.accept');
    }
  }
  const stack = (w: Word): string => (w.length === 0 ? '' : w.map(showSym).join(''));
  const letter = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : String(i + 1));
</script>

<div class="analysis">
  <div class="row">
    <input class="mono word" bind:value={word} placeholder="(())()" aria-label={t('sim.word')} onkeydown={(e) => e.key === 'Enter' && analyse()} />
    <div class="seg" role="group" aria-label={t('parse.mode')}>
      <button aria-pressed={mode === 'top'} onclick={() => (mode = 'top')}>{t('parse.topShort')} <span class="ref">4.27</span></button>
      <button aria-pressed={mode === 'bottom'} onclick={() => (mode = 'bottom')}>{t('parse.bottomShort')} <span class="ref">4.33</span></button>
    </div>
    <button class="btn primary" onclick={analyse} disabled={!!runner.busy}>{t('parse.run')}</button>
  </div>
  {#if error}<p class="err">{error}</p>{/if}

  {#if run}
    <p class="summary" class:ok={run.accepted} class:bad={!run.accepted}>
      {run.accepted ? t('parse.accepted') : t('parse.rejected')}
      <span class="stats">{t('parse.stats', { n: run.explored, d: run.deadEnds })}{#if run.limitHit} · {t('parse.limit')}{/if}</span>
    </p>
    {#if run.rows.length}
      <div class="table-wrap">
        <table>
          <thead>
            {#if runMode === 'top'}
              <tr><th></th><th>{t('parse.read_')}</th><th>{t('parse.state')}</th><th>{t('parse.stackTop')}</th><th>{t('parse.action')}</th><th>{t('parse.form')}</th></tr>
            {:else}
              <tr><th></th><th>{t('parse.stackBottom')}</th><th>{t('parse.state')}</th><th>{t('parse.rest')}</th><th>{t('parse.action')}</th></tr>
            {/if}
          </thead>
          <tbody>
            {#each run.rows as r, i (i)}
              <tr class:final={r.state === 'z+'}>
                <td class="nr">{letter(i)}</td>
                {#if runMode === 'top'}
                  <td class="mono">{showWord(r.read)}</td>
                  <td class="math">{r.state}</td>
                  <td class="mono">{stack(r.stack)}</td>
                  <td class="act">{action(r.action)}</td>
                  <td class="mono form">{showWord(r.form)}</td>
                {:else}
                  <td class="mono">{stack(r.stack)}</td>
                  <td class="math">{r.state}</td>
                  <td class="mono">{r.rest.length ? showWord(r.rest) : '–'}</td>
                  <td class="act">{action(r.action)}</td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
    {#if run.derivation}
      <p class="eyebrow">{runMode === 'top' ? t('parse.leftmost') : t('parse.rightmost')}</p>
      <p class="deriv mono">
        {showWord(run.derivation.start)}{#each run.derivation.steps as st, i (i)} <span class="arrow">⇒</span> {showWord(st.form)}{/each}
      </p>
    {/if}
    {#if run.tree}
      <div class="tree-box"><TreeView tree={run.tree} nonterminals={g.nonterminals} compact /></div>
    {/if}
  {/if}
</div>

<style>
  .analysis {
    display: grid;
    gap: 12px;
  }
  .row {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }
  .word {
    flex: 0 1 240px;
    padding: 7px 10px;
    border: 1px solid var(--rule-2);
    border-radius: 8px;
    background: var(--sheet);
    color: var(--ink);
    font-size: 16px;
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
  .ref {
    font: 500 10.5px var(--font-mono);
    color: var(--ink-3);
  }
  .err {
    margin: 0;
    color: var(--bad);
  }
  .summary {
    margin: 0;
    font-weight: 700;
  }
  .summary.ok {
    color: var(--ok);
  }
  .summary.bad {
    color: var(--bad);
  }
  .stats {
    margin-left: 10px;
    font-weight: 400;
    font-size: 12.5px;
    color: var(--ink-3);
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    font-size: 14px;
  }
  th,
  td {
    padding: 4px 12px;
    border-bottom: 1px solid var(--rule);
    text-align: left;
    white-space: nowrap;
  }
  th {
    font-size: 11.5px;
    color: var(--ink-3);
    font-weight: 600;
  }
  .nr {
    color: var(--ink-3);
    font-size: 12px;
  }
  .math {
    font-family: var(--font-math);
    font-style: italic;
  }
  .act {
    font-family: var(--font-math);
    font-style: italic;
    color: var(--ink-2);
  }
  .form {
    color: var(--ink-3);
  }
  tr.final td {
    background: var(--ok-soft);
  }
  .eyebrow {
    margin: 4px 0 0;
  }
  .deriv {
    margin: 0;
    line-height: 1.8;
  }
  .arrow {
    color: var(--ink-3);
  }
  .tree-box {
    padding: 10px;
    border: 1px solid var(--rule);
    border-radius: 12px;
    background: var(--state-fill);
    max-width: 640px;
  }
</style>
