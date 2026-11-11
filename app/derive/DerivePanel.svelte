<script lang="ts">
  // Ableiten Schritt für Schritt (6.2, 4.13–4.22): Stelle in der Satzform wählen, Produktion
  // anwenden; Linksableitung als Modus; der Ableitungsbaum wächst mit (nur Typ 2).
  import {
    applicable,
    extend,
    grammarType,
    leftmostPos,
    startDerivation,
    treeOf,
    type Derivation,
    type Grammar,
    type ProcResult,
    type ProductionId,
  } from '../../core/index';
  import { store } from '../lib/store.svelte';
  import { runner } from '../lib/runner.svelte';
  import { parseInputWord, showSym, showWord } from '../lib/format';
  import TreeView from './TreeView.svelte';
  import { t } from '../i18n';

  let { g }: { g: Grammar } = $props();

  const type2 = $derived(grammarType(g).type >= 2);
  let leftmostMode = $state(true);
  let derivation = $state<Derivation | null>(null);
  let selected = $state<number | null>(null);
  let target = $state('');
  let message = $state('');

  // Neu beginnen, wenn die Grammatik wechselt oder sich ändert.
  let lastKey = '';
  $effect(() => {
    const key = g.name + '\u0000' + JSON.stringify(g.productions) + g.start;
    if (key !== lastKey) {
      lastKey = key;
      derivation = g.start ? startDerivation(g) : null;
      selected = null;
      message = '';
    }
  });

  const form = $derived(derivation ? (derivation.steps.at(-1)?.form ?? derivation.start) : []);
  const options = $derived(derivation ? applicable(g, form) : []);
  const leftPos = $derived(type2 ? leftmostPos(g, form) : null);
  /** Stellen, an denen etwas angewendet werden darf. */
  const usable = $derived(new Set(options.filter((o) => !(leftmostMode && type2) || o.pos === leftPos).map((o) => o.pos)));
  const atSelected = $derived(options.filter((o) => o.pos === (selected ?? (leftmostMode && type2 ? leftPos : -1))));
  const tree = $derived(derivation && type2 ? treeOf(g, derivation) : null);
  const done = $derived(derivation !== null && form.every((s) => !g.nonterminals.includes(s)));
  const prodText = (id: ProductionId): string => {
    const p = g.productions.find((x) => x.id === id);
    return p ? `${showWord(p.left)} → ${showWord(p.right)}` : id;
  };

  function apply(production: ProductionId, pos: number): void {
    if (!derivation) return;
    const r = extend(g, derivation, production, pos);
    if ('error' in r) return;
    derivation = r;
    selected = null;
    message = '';
  }

  function back(to?: number): void {
    if (!derivation) return;
    const n = to ?? derivation.steps.length - 1;
    derivation = { ...derivation, steps: derivation.steps.slice(0, Math.max(0, n)) };
    selected = null;
  }

  async function search(): Promise<void> {
    const w = parseInputWord(target);
    if (!w) return store.notify(t('error.word'), 'error');
    message = '';
    const out = await runner.run<ProcResult<Derivation>>(t('derive.searching'), { fn: 'findDerivation', sources: [$state.snapshot(g) as Grammar], word: w, opts: {} });
    if (out.status !== 'done') return;
    if (out.value.ok) {
      derivation = out.value.result;
      message = t('derive.found', { n: out.value.result.steps.length });
    } else message = out.value.diagnostics.length ? t('derive.limitHit') : t('derive.notDerivable', { w: showWord(w) });
  }
</script>

{#if !g.start}
  <p class="muted">{t('derive.noStart')}</p>
{:else if derivation}
  <div class="derive" class:withTree={!!tree}>
    <div class="left">
      <div class="bar">
        {#if type2}
          <label class="check"><input type="checkbox" bind:checked={leftmostMode} /> {t('derive.leftmost')}</label>
        {/if}
        <button class="btn ghost small" onclick={() => back()} disabled={derivation.steps.length === 0}>{t('derive.back')}</button>
        <button class="btn ghost small" onclick={() => back(0)} disabled={derivation.steps.length === 0}>{t('derive.restart')}</button>
      </div>

      <p class="eyebrow">{t('derive.form')}</p>
      <div class="form" role="group" aria-label={t('derive.form')}>
        {#if form.length === 0}<span class="eps">ε</span>{/if}
        {#each form as s, i (i)}
          <button
            class="sym"
            class:nt={g.nonterminals.includes(s)}
            class:usable={usable.has(i)}
            class:sel={selected === i || (selected === null && leftmostMode && type2 && i === leftPos)}
            disabled={!usable.has(i)}
            onclick={() => (selected = i)}>{showSym(s)}</button
          >
        {/each}
      </div>
      {#if done}
        <p class="ok">{t('derive.done', { w: showWord(form) })}</p>
      {:else if atSelected.length}
        <div class="prods">
          {#each atSelected as o (o.production)}
            <button class="btn small" onclick={() => apply(o.production, o.pos)}>{prodText(o.production)}</button>
          {/each}
        </div>
      {:else if usable.size}
        <p class="muted">{t('derive.pick')}</p>
      {:else}
        <p class="muted">{t('derive.stuck')}</p>
      {/if}

      <p class="eyebrow">{t('derive.history')}</p>
      <ol class="hist">
        <li><button class="step" onclick={() => back(0)}>{showWord(derivation.start)}</button></li>
        {#each derivation.steps as st, i (i)}
          <li>
            <span class="arrow" title={prodText(st.production)}>⇒</span>
            <button class="step" onclick={() => back(i + 1)}>{showWord(st.form)}</button>
          </li>
        {/each}
      </ol>

      <div class="search">
        <input class="mono" bind:value={target} placeholder={t('derive.target')} aria-label={t('derive.target')} onkeydown={(e) => e.key === 'Enter' && search()} />
        <button class="btn" onclick={search} disabled={!!runner.busy || target.trim() === ''}>{t('derive.search')}</button>
      </div>
      {#if message}<p class="msg">{message}</p>{/if}
    </div>

    {#if tree}
      <div class="right">
        <p class="eyebrow">{t('derive.tree')} <span class="ref">4.19</span></p>
        <TreeView {tree} nonterminals={g.nonterminals} />
      </div>
    {:else if !type2}
      <p class="muted">{t('derive.noTree')}</p>
    {/if}
  </div>
{/if}

<style>
  .derive {
    display: grid;
    gap: 20px;
  }
  .derive.withTree {
    grid-template-columns: minmax(280px, 1fr) minmax(260px, 1.2fr);
    align-items: start;
  }
  @media (max-width: 900px) {
    .derive.withTree {
      grid-template-columns: 1fr;
    }
  }
  .left {
    display: grid;
    gap: 10px;
    align-content: start;
  }
  .bar {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--ink-2);
    margin-right: auto;
  }
  .small {
    padding: 3px 9px;
    font-size: 12.5px;
  }
  .eyebrow {
    margin: 4px 0 0;
  }
  .ref {
    font: 500 11px var(--font-mono);
    color: var(--ink-3);
    text-transform: none;
  }
  .form {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    padding: 10px 12px;
    border: 1px solid var(--rule);
    border-radius: 10px;
    background: var(--state-fill);
    min-height: 52px;
    align-items: center;
  }
  .sym {
    min-width: 28px;
    height: 34px;
    padding: 0 6px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: none;
    font-family: var(--font-mono);
    font-size: 19px;
    color: var(--select);
  }
  .sym.nt {
    font-family: var(--font-math);
    font-style: italic;
    color: var(--ink);
  }
  .sym.usable {
    border-color: var(--rule-2);
    cursor: pointer;
  }
  .sym.usable:hover {
    border-color: var(--ink);
  }
  .sym.sel {
    border-color: var(--signal);
    background: var(--signal-soft);
  }
  .sym:disabled {
    cursor: default;
  }
  .eps {
    font-family: var(--font-math);
    font-style: italic;
    color: var(--ink-3);
  }
  .prods {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .prods .btn {
    font-family: var(--font-math);
    font-style: italic;
  }
  .hist {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 2px 4px;
    align-items: baseline;
  }
  .hist li {
    display: flex;
    gap: 4px;
    align-items: baseline;
  }
  .arrow {
    color: var(--ink-3);
    cursor: help;
  }
  .step {
    border: none;
    background: none;
    padding: 1px 3px;
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 14px;
    color: var(--ink);
    cursor: pointer;
  }
  .step:hover {
    background: var(--paper-2);
  }
  .search {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }
  .search input {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    border: 1px solid var(--rule-2);
    border-radius: 8px;
    background: var(--sheet);
    color: var(--ink);
  }
  .muted,
  .msg {
    margin: 0;
    color: var(--ink-3);
    font-size: 13px;
  }
  .msg {
    color: var(--ink-2);
  }
  .ok {
    margin: 0;
    color: var(--ok);
    font-weight: 600;
  }
  .right {
    display: grid;
    gap: 8px;
    padding: 12px;
    border: 1px solid var(--rule);
    border-radius: 12px;
    background: var(--state-fill);
  }
</style>
