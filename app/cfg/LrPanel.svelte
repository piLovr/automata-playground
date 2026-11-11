<script lang="ts">
  // LR (6.45–6.57): LR(0)-Zustände mit Items, goto- und act-Tabelle, Konflikte,
  // LALR(1)-Vorausschau und der Lauf auf einem Wort wie Tabelle 6.1.
  import type { Grammar, LrAction, LrAutomaton, LrItem, LrRunRow, ProcResult, Sym } from '../../core/index';
  import { store } from '../lib/store.svelte';
  import { runner } from '../lib/runner.svelte';
  import { diagnosticText, parseInputWord, showSym, showSymIn, showWordIn } from '../lib/format';
  import { t } from '../i18n';

  let { g }: { g: Grammar } = $props();

  let mode = $state<'LR0' | 'LALR1'>('LALR1');
  let word = $state(store.word);
  let auto = $state<LrAutomaton | null>(null);
  let run = $state<{ rows: LrRunRow[]; accepted: boolean } | null>(null);
  let error = $state('');
  let selState = $state<number | null>(null);

  async function build(withWord: boolean): Promise<void> {
    const w = withWord ? parseInputWord(word) : null;
    if (withWord && !w) return store.notify(t('error.word'), 'error');
    error = '';
    const out = await runner.run<{ automaton: ProcResult<LrAutomaton>; run: { rows: LrRunRow[]; accepted: boolean } | null }>('LR', {
      fn: 'lr',
      sources: [$state.snapshot(g) as Grammar],
      mode,
      word: w,
      opts: { steps: false },
    });
    if (out.status !== 'done') return;
    const a = out.value.automaton;
    if (!a.ok) {
      error = a.diagnostics[0] ? diagnosticText(a.diagnostics[0]) : t('proc.failed');
      return;
    }
    auto = a.result;
    run = out.value.run;
  }

  const prods = $derived(auto ? auto.augmented.productions : []);
  function item(it: LrItem): string {
    const p = prods.find((x) => x.id === it.production);
    if (!p) return '?';
    const r = p.right.map(showSym);
    r.splice(it.dot, 0, '•');
    return `${showWordIn(auto?.augmented.nonterminals ?? [], p.left)} → ${r.join(' ')}${it.lookahead?.length ? `   , {${it.lookahead.map(showSym).join(', ')}}` : ''}`;
  }
  const terminals = $derived(auto ? [...auto.augmented.terminals.filter((x) => x !== '⊣')] : []);
  const nts = $derived(auto ? auto.augmented.nonterminals.filter((x) => x !== auto!.augmented.start) : []);
  const gotoOf = (z: number, x: Sym): number | undefined => auto?.goto.find((e) => e.from === z && e.symbol === x)?.to;
  const prodNo = (id: string): number => prods.findIndex((p) => p.id === id);
  function act(a: LrAction): string {
    if (a.kind === 'shift') return `s${a.to}`;
    if (a.kind === 'accept') return 'acc';
    return `r${prodNo(a.production)}`;
  }
  const prodText = (id: string): string => {
    const p = prods.find((x) => x.id === id);
    return p ? `${showWordIn(auto?.augmented.nonterminals ?? [], p.left)} → ${showWordIn(auto?.augmented.nonterminals ?? [], p.right)}` : id;
  };
  function runAction(a: LrRunRow['action']): string {
    if (!a) return '';
    if (a.kind === 'error') return t('lr.error');
    if (a.kind === 'shift') return t('lr.shift', { z: a.to });
    if (a.kind === 'accept') return t('lr.accept');
    return t('lr.reduce', { p: prodText(a.production) });
  }
</script>

<div class="lr">
  <div class="row">
    <div class="seg" role="group" aria-label={t('lr.mode')}>
      <button aria-pressed={mode === 'LR0'} onclick={() => (mode = 'LR0')}>LR(0)</button>
      <button aria-pressed={mode === 'LALR1'} onclick={() => (mode = 'LALR1')}>LALR(1)</button>
    </div>
    <button class="btn" onclick={() => build(false)} disabled={!!runner.busy}>{t('lr.build')}</button>
    <input class="mono word" bind:value={word} placeholder="(a+a)*a" aria-label={t('sim.word')} onkeydown={(e) => e.key === 'Enter' && build(true)} />
    <button class="btn primary" onclick={() => build(true)} disabled={!!runner.busy}>{t('lr.run')}</button>
  </div>
  {#if error}<p class="err">{error}</p>{/if}

  {#if auto}
    <p class="summary" class:ok={auto.conflicts.length === 0} class:bad={auto.conflicts.length > 0}>
      {auto.conflicts.length === 0 ? t('lr.noConflicts', { n: auto.states.length, mode: auto.mode === 'LR0' ? 'LR(0)' : 'LALR(1)' }) : t('lr.conflicts', { k: auto.conflicts.length, n: auto.states.length })}
    </p>
    <p class="hint">{t('lr.hint')}</p>

    <div class="cols">
      <section>
        <p class="eyebrow">{t('lr.productions')}</p>
        <ol class="prods" start="0">
          {#each prods as p (p.id)}<li class="math">{showWordIn(auto?.augmented.nonterminals ?? [], p.left)} → {showWordIn(auto?.augmented.nonterminals ?? [], p.right)}</li>{/each}
        </ol>
        <p class="eyebrow">{t('lr.states')} <span class="ref">6.52/6.53</span></p>
        <div class="states">
          {#each auto.states as z (z.id)}
            <button class="state" class:sel={selState === z.id} class:conf={auto.conflicts.some((c) => c.state === z.id)} onclick={() => (selState = selState === z.id ? null : z.id)}>
              <span class="zname">z<sub>{z.id}</sub></span>
              {#each z.items as it, k (k)}<span class="it" class:kernel={k < z.kernel.length}>{item(it)}</span>{/each}
            </button>
          {/each}
        </div>
      </section>

      <section>
        <p class="eyebrow">{t('lr.table')} <span class="ref">6.50/6.55</span></p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                {#each terminals as x (x)}<th class="mono">{showSymIn(auto?.augmented.nonterminals ?? [], x)}</th>{/each}
                {#each nts as x (x)}<th class="math">{showSymIn(auto?.augmented.nonterminals ?? [], x)}</th>{/each}
              </tr>
            </thead>
            <tbody>
              {#each auto.states as z (z.id)}
                <tr class:sel={selState === z.id}>
                  <th>z<sub>{z.id}</sub></th>
                  {#each terminals as x (x)}
                    {@const acts = auto.actions[z.id]?.[x] ?? []}
                    <td class:conf={acts.length > 1} class:acc={acts.some((a) => a.kind === 'accept')}>{acts.map(act).join(' / ')}</td>
                  {/each}
                  {#each nts as x (x)}<td class="goto">{gotoOf(z.id, x) ?? ''}</td>{/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="legend">{t('lr.legend')}</p>
      </section>
    </div>

    {#if run}
      <section>
        <p class="eyebrow">{t('lr.runTitle')} <span class="ref">Tab. 6.1</span></p>
        <p class="summary" class:ok={run.accepted} class:bad={!run.accepted}>{run.accepted ? t('parse.accepted') : t('parse.rejected')}</p>
        <div class="table-wrap">
          <table class="run">
            <thead><tr><th>{t('lr.stack')}</th><th>{t('parse.rest')}</th><th>{t('parse.action')}</th></tr></thead>
            <tbody>
              {#each run.rows as r, i (i)}
                <tr>
                  <td class="mono">{#each r.stack as s, k (k)}{#if typeof s === 'number'}<span class="zs">z<sub>{s}</sub></span>{:else}<span class="ss">{showSymIn(auto?.augmented.nonterminals ?? [], s)}</span>{/if}{/each}</td>
                  <td class="mono">{showWordIn(auto?.augmented.nonterminals ?? [], r.rest)}</td>
                  <td>{runAction(r.action)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}
  {/if}
</div>

<style>
  .lr {
    display: grid;
    gap: 14px;
  }
  .row {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
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
  .word {
    flex: 0 1 200px;
    padding: 7px 10px;
    border: 1px solid var(--rule-2);
    border-radius: 8px;
    background: var(--sheet);
    color: var(--ink);
    font-size: 16px;
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
  .hint,
  .legend {
    margin: 0;
    font-size: 12.5px;
    color: var(--ink-3);
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(260px, 1fr) minmax(300px, 1.3fr);
    gap: 20px;
    align-items: start;
  }
  @media (max-width: 1000px) {
    .cols {
      grid-template-columns: 1fr;
    }
  }
  section {
    display: grid;
    gap: 8px;
    min-width: 0;
  }
  .eyebrow {
    margin: 0;
  }
  .ref {
    font: 500 10.5px var(--font-mono);
    color: var(--ink-3);
    text-transform: none;
  }
  .prods {
    margin: 0;
    padding-left: 28px;
    font-size: 14px;
  }
  .math {
    font-family: var(--font-math);
    font-style: italic;
  }
  .states {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 6px;
  }
  .state {
    display: grid;
    gap: 1px;
    padding: 6px 8px;
    border: 1px solid var(--rule-2);
    border-radius: 8px;
    background: var(--state-fill);
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }
  .state.sel {
    border-color: var(--select);
    box-shadow: 0 0 0 2px var(--select-soft);
  }
  .state.conf {
    border-color: var(--bad);
  }
  .zname {
    font-family: var(--font-math);
    font-style: italic;
    font-weight: 600;
  }
  .it {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--ink-3);
    white-space: pre;
  }
  .it.kernel {
    color: var(--ink);
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
    padding: 3px 9px;
    border: 1px solid var(--rule);
    text-align: center;
    white-space: nowrap;
  }
  th {
    background: var(--paper-2);
    font-weight: 600;
  }
  td.conf {
    background: var(--bad-soft);
    color: var(--bad);
    font-weight: 700;
  }
  td.acc {
    color: var(--ok);
    font-weight: 700;
  }
  td.goto {
    color: var(--select);
  }
  tr.sel th,
  tr.sel td {
    box-shadow: inset 0 0 0 100px var(--select-soft);
  }
  .run td {
    text-align: left;
  }
  .zs {
    color: var(--ink-3);
    font-size: 11px;
    margin: 0 2px;
  }
  .ss {
    font-size: 15px;
  }
</style>
