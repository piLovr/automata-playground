<script lang="ts">
  // Alle Ableitungsbäume eines Worts (nach Größe) und Suche nach Mehrdeutigkeit (4.23, 4.24).
  // Das Tool behauptet nie „eindeutig“, sondern nennt die geprüfte Länge.
  import type { AmbiguityResult, Grammar, ProcResult, TreesResult } from '../../core/index';
  import { store } from '../lib/store.svelte';
  import { runner } from '../lib/runner.svelte';
  import { diagnosticText, parseInputWord, showWordIn } from '../lib/format';
  import TreeView from './TreeView.svelte';
  import { t } from '../i18n';

  let { g }: { g: Grammar } = $props();

  let word = $state(store.word);
  let maxNodes = $state(40);
  let trees = $state<TreesResult | null>(null);
  let treesWord = $state('');
  let shown = $state(4);
  let error = $state('');

  let maxLen = $state(8);
  let amb = $state<AmbiguityResult | null>(null);

  async function findTrees(): Promise<void> {
    const w = parseInputWord(word);
    if (!w) return store.notify(t('error.word'), 'error');
    error = '';
    const out = await runner.run<ProcResult<TreesResult>>(t('trees.searching'), { fn: 'parseTrees', sources: [$state.snapshot(g) as Grammar], word: w, limit: maxNodes, opts: {} });
    if (out.status !== 'done') return;
    if (out.value.ok) {
      trees = out.value.result;
      treesWord = showWordIn(g.nonterminals, w);
      shown = 4;
    } else error = out.value.diagnostics[0] ? diagnosticText(out.value.diagnostics[0]) : t('proc.failed');
  }

  async function findAmb(): Promise<void> {
    const out = await runner.run<ProcResult<AmbiguityResult>>(t('trees.ambSearching'), { fn: 'findAmbiguity', sources: [$state.snapshot(g) as Grammar], maxLen, limit: maxNodes, opts: {} });
    if (out.status !== 'done') return;
    if (out.value.ok) amb = out.value.result;
    else error = out.value.diagnostics[0] ? diagnosticText(out.value.diagnostics[0]) : t('proc.failed');
  }
</script>

<div class="trees">
  <section>
    <p class="eyebrow">{t('trees.title')} <span class="ref">4.22–4.24</span></p>
    <div class="row">
      <input class="mono word" bind:value={word} placeholder="()()()" aria-label={t('sim.word')} onkeydown={(e) => e.key === 'Enter' && findTrees()} />
      <label class="lim">{t('trees.maxNodes')} <input type="number" min="5" max="400" bind:value={maxNodes} /></label>
      <button class="btn primary" onclick={findTrees} disabled={!!runner.busy}>{t('trees.find')}</button>
    </div>
    {#if error}<p class="err">{error}</p>{/if}
    {#if trees}
      <p class="summary">
        {#if trees.trees.length === 0}
          {t('trees.none', { w: treesWord })}
        {:else}
          {t(trees.complete ? 'trees.count' : 'trees.countFirst', { n: trees.trees.length, w: treesWord })}
          {#if trees.infinite}<span class="warn">{t('trees.infinite')}</span>{:else if !trees.complete}<span class="warn">{t('trees.incomplete', { n: maxNodes })}</span>{/if}
        {/if}
      </p>
      <div class="grid">
        {#each trees.trees.slice(0, shown) as tr, i (i)}
          <figure>
            <figcaption>{t('trees.tree', { n: i + 1 })}</figcaption>
            <TreeView tree={tr} nonterminals={g.nonterminals} compact />
          </figure>
        {/each}
      </div>
      {#if trees.trees.length > shown}
        <button class="btn" onclick={() => (shown += 4)}>{t('trees.more')}</button>
      {/if}
    {/if}
  </section>

  <section>
    <p class="eyebrow">{t('trees.ambTitle')} <span class="ref">4.23</span></p>
    <div class="row">
      <label class="lim">{t('lang.maxLen')} <input type="number" min="0" max="20" bind:value={maxLen} /></label>
      <button class="btn" onclick={findAmb} disabled={!!runner.busy}>{t('trees.ambFind')}</button>
    </div>
    {#if amb}
      {#if amb.found}
        <p class="summary bad">{t('trees.ambFound', { w: showWordIn(g.nonterminals, amb.found.word) })}</p>
        <div class="grid two">
          {#each amb.found.trees as tr, i (i)}
            <figure>
              <figcaption>{t('trees.tree', { n: i + 1 })}</figcaption>
              <TreeView tree={tr} nonterminals={g.nonterminals} compact />
            </figure>
          {/each}
        </div>
      {:else}
        <p class="summary">{t('trees.ambNone', { n: amb.checkedUpTo })}{#if amb.limitHit} <span class="warn">{t('trees.ambLimit')}</span>{/if}</p>
      {/if}
    {/if}
  </section>
</div>

<style>
  .trees {
    display: grid;
    gap: 28px;
  }
  section {
    display: grid;
    gap: 10px;
  }
  .eyebrow {
    margin: 0;
  }
  .ref {
    font: 500 11px var(--font-mono);
    color: var(--ink-3);
    text-transform: none;
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
  .lim {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 13px;
    color: var(--ink-2);
  }
  .lim input {
    width: 4.5em;
    padding: 4px 6px;
    border: 1px solid var(--rule-2);
    border-radius: 6px;
    background: var(--sheet);
    color: var(--ink);
  }
  .summary {
    margin: 0;
    font-weight: 600;
  }
  .summary.bad {
    color: var(--bad);
  }
  .warn {
    display: block;
    margin-top: 2px;
    font-weight: 400;
    font-size: 13px;
    color: var(--warn);
  }
  .err {
    margin: 0;
    color: var(--bad);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  }
  figure {
    margin: 0;
    padding: 10px;
    border: 1px solid var(--rule);
    border-radius: 12px;
    background: var(--state-fill);
  }
  figcaption {
    font-size: 12px;
    color: var(--ink-3);
    margin-bottom: 4px;
  }
</style>
