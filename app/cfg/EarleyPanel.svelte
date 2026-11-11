<script lang="ts">
  // Earley (6.39–6.44): Itemmengen S₀ … Sₙ, Items X →ᵢ v₁ • v₂ mit der erzeugenden Regel.
  // Zeigen auf ein Item hebt die auslösenden Items hervor.
  import type { EarleyItem, EarleyResult, Grammar, ProcResult } from '../../core/index';
  import { store } from '../lib/store.svelte';
  import { runner } from '../lib/runner.svelte';
  import { diagnosticText, parseInputWord, showSym, showSymIn, showWordIn } from '../lib/format';
  import { t } from '../i18n';

  let { g }: { g: Grammar } = $props();

  let word = $state(store.word);
  let result = $state<EarleyResult | null>(null);
  let error = $state('');
  let hover = $state<[number, number] | null>(null);

  async function run(): Promise<void> {
    const w = parseInputWord(word);
    if (!w) return store.notify(t('error.word'), 'error');
    error = '';
    const out = await runner.run<ProcResult<EarleyResult>>('Earley', { fn: 'earley', sources: [$state.snapshot(g) as Grammar], word: w, opts: { steps: false } });
    if (out.status !== 'done') return;
    if (out.value.ok) result = out.value.result;
    else error = out.value.diagnostics[0] ? diagnosticText(out.value.diagnostics[0]) : t('proc.failed');
  }

  function parts(it: EarleyItem): { left: string; before: string; after: string } {
    const p = g.productions.find((x) => x.id === it.production);
    if (!p) return { left: '?', before: '', after: '' };
    return {
      left: showWordIn(g.nonterminals, p.left),
      before: p.right.slice(0, it.dot).map(showSym).join(''),
      after: p.right.slice(it.dot).map(showSym).join(''),
    };
  }
  const causes = $derived.by(() => {
    if (!hover || !result) return new Set<string>();
    const it = result.sets[hover[0]]?.[hover[1]];
    return new Set((it?.cause ?? []).map(([s, k]) => `${s}:${k}`));
  });
</script>

<div class="earley">
  <div class="row">
    <input class="mono word" bind:value={word} placeholder="abc" aria-label={t('sim.word')} onkeydown={(e) => e.key === 'Enter' && run()} />
    <button class="btn primary" onclick={run} disabled={!!runner.busy}>{t('earley.run')}</button>
    <span class="legend">
      <span class="rule init">{t('earley.rule.init')}</span>
      <span class="rule lexer">{t('earley.rule.lexer')}</span>
      <span class="rule completer">{t('earley.rule.completer')}</span>
      <span class="rule predictor">{t('earley.rule.predictor')}</span>
    </span>
  </div>
  {#if error}<p class="err">{error}</p>{/if}
  {#if result}
    <p class="summary" class:ok={result.accepted} class:bad={!result.accepted}>
      {result.accepted ? t('earley.accepted', { s: g.start ?? 'S', n: result.word.length }) : t('earley.rejected')}
    </p>
    <div class="sets">
      {#each result.sets as set, j (j)}
        <section class="set">
          <header>
            <span class="name">S<sub>{j}</sub></span>
            {#if j > 0}<span class="mono sym">{showSymIn(g.nonterminals, result.word[j - 1]!)}</span>{/if}
          </header>
          {#if set.length === 0}<p class="muted">∅</p>{/if}
          <ol>
            {#each set as it, k (k)}
              {@const p = parts(it)}
              <li
                class="item {it.rule}"
                class:cause={causes.has(`${j}:${k}`)}
                class:hov={hover?.[0] === j && hover?.[1] === k}
                onpointerenter={() => (hover = [j, k])}
                onpointerleave={() => (hover = null)}
                title={t(`earley.rule.${it.rule}`)}
              >
                <span class="math">{p.left}</span> <span class="arrow">→<sub>{it.origin}</sub></span>
                <span class="rhs">{p.before}<span class="dot">•</span>{p.after}</span>
              </li>
            {/each}
          </ol>
        </section>
      {/each}
    </div>
  {/if}
</div>

<style>
  .earley {
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
  .legend {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 11.5px;
  }
  .rule {
    padding: 1px 7px;
    border-radius: 999px;
    border-left: 4px solid var(--rc);
    background: var(--paper-2);
  }
  .init,
  .item.init {
    --rc: var(--ink-3);
  }
  .lexer,
  .item.lexer {
    --rc: var(--cls-0);
  }
  .completer,
  .item.completer {
    --rc: var(--cls-1);
  }
  .predictor,
  .item.predictor {
    --rc: var(--cls-2);
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
  .sets {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(170px, 1fr);
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 6px;
  }
  .set {
    border: 1px solid var(--rule);
    border-radius: 12px;
    background: var(--state-fill);
    padding: 8px;
    align-self: start;
  }
  .set header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--rule);
    margin-bottom: 6px;
  }
  .name {
    font-family: var(--font-math);
    font-style: italic;
    font-size: 17px;
  }
  .sym {
    color: var(--select);
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 3px;
  }
  .item {
    padding: 3px 6px;
    border-left: 4px solid var(--rc);
    border-radius: 4px;
    font-size: 14px;
    cursor: default;
  }
  .item.hov {
    background: var(--paper-2);
  }
  .item.cause {
    background: var(--signal-soft);
    outline: 1.5px solid var(--signal);
  }
  .math {
    font-family: var(--font-math);
    font-style: italic;
  }
  .arrow {
    color: var(--ink-3);
  }
  .arrow sub {
    font-size: 10px;
  }
  .rhs {
    font-family: var(--font-mono);
  }
  .dot {
    color: var(--signal);
    font-weight: 700;
    margin: 0 1px;
  }
  .muted {
    margin: 0;
    color: var(--ink-3);
  }
</style>
