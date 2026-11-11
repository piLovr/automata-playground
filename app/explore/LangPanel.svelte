<script lang="ts">
  // Reiter „Sprache“ (8.7): Wörter nach Länge und lexikographisch, Anzahl je Länge,
  // Zugehörigkeit. Typ 3 exakt über einen DEA, sonst Stichprobe über die Simulation.
  import { outputsTable, type LengthCounts, type ProcResult, type Word, type WordsPage } from '../../core/index';
  import { store } from '../lib/store.svelte';
  import { explorer } from '../lib/runner.svelte';
  import { diagnosticText, showWord } from '../lib/format';
  import { t } from '../i18n';

  const PAGE = 60;
  const obj = $derived(store.obj);
  const transducer = $derived(obj?.kind === 'mealy' || obj?.kind === 'moore');

  let maxLen = $state(8);
  let counts = $state<LengthCounts | null>(null);
  let words = $state<Word[]>([]);
  let done = $state(false);
  let exact = $state(true);
  let error = $state('');
  let loading = $state(false);
  let token = 0;

  async function load(reset: boolean): Promise<void> {
    const o = store.obj;
    if (!o || transducer) return;
    const my = ++token;
    loading = true;
    error = '';
    const snap = $state.snapshot(o) as typeof o;
    if (reset) {
      const c = await explorer.run<ProcResult<LengthCounts>>(t('lang.counting'), { fn: 'countByLength', sources: [snap], maxLen, opts: {} });
      if (my !== token) return;
      if (c.status === 'done' && c.value.ok) counts = c.value.result;
      else if (c.status === 'done' && !c.value.ok) error = c.value.diagnostics[0] ? diagnosticText(c.value.diagnostics[0]) : '';
      else if (c.status === 'error') error = c.message;
      words = [];
      done = false;
    }
    const p = await explorer.run<ProcResult<WordsPage>>(t('lang.listing'), {
      fn: 'wordsPage',
      sources: [snap],
      maxLen,
      offset: reset ? 0 : words.length,
      limit: PAGE,
      opts: {},
    });
    if (my !== token) return;
    loading = false;
    if (p.status === 'done' && p.value.ok) {
      words = reset ? p.value.result.words : [...words, ...p.value.result.words];
      done = p.value.result.done;
      exact = p.value.result.exact && (counts?.exact ?? true);
    } else if (p.status === 'done' && !p.value.ok) {
      error = p.value.diagnostics[0] ? diagnosticText(p.value.diagnostics[0]) : t('proc.failed');
    }
  }

  // Neu rechnen, wenn sich Objekt oder Länge ändern (kurz entprellt).
  $effect(() => {
    void store.obj;
    void maxLen;
    const id = setTimeout(() => void load(true), 250);
    return () => clearTimeout(id);
  });

  const alphabetSize = $derived(obj && 'alphabet' in obj ? obj.alphabet.length : 0);
  const maxCount = $derived(counts ? counts.counts.reduce((m, c) => (c > m ? c : m), 1n) : 1n);
  /** Balkenlänge logarithmisch, damit auch große Zahlen sichtbar bleiben. */
  const bar = (c: bigint): number => (c === 0n ? 0 : Math.max(2, (Math.log10(Number(c) + 1) / Math.log10(Number(maxCount) + 1)) * 100));
  const power = (n: number): string => (alphabetSize === 0 ? (n === 0 ? '1' : '0') : (BigInt(alphabetSize) ** BigInt(n)).toString());

  const outputs = $derived(obj && (obj.kind === 'mealy' || obj.kind === 'moore') ? outputsTable(obj, Math.min(maxLen, 5), 200) : []);
</script>

<div class="wrap">
  <div class="head">
    <label class="len">
      {t('lang.maxLen')}
      <input type="number" min="0" max="60" bind:value={maxLen} />
    </label>
    {#if !transducer}
      <span class="badge" class:sample={!exact}>{exact ? t('lang.exact') : t('lang.sample')}</span>
    {/if}
    {#if loading}<span class="muted">{t('lang.busy')}</span>{/if}
  </div>
  {#if error}<p class="err">{error}</p>{/if}

  {#if transducer}
    <p class="eyebrow">{t('lang.outputs')}</p>
    <table class="out">
      <thead><tr><th>{t('lang.input')}</th><th>{t('lang.output')}</th></tr></thead>
      <tbody>
        {#each outputs as r, i (i)}
          <tr><td class="mono">{showWord(r.input)}</td><td class="mono">{showWord(r.output)}</td></tr>
        {/each}
      </tbody>
    </table>
  {:else}
    {#if counts}
      <p class="eyebrow">{t('lang.counts')}</p>
      <table class="counts">
        <thead><tr><th>n</th><th>{t('lang.count')}</th><th class="vs">|X|ⁿ</th><th class="barcol"></th></tr></thead>
        <tbody>
          {#each counts.counts as c, n (n)}
            <tr>
              <td>{n}</td>
              <td class="num">{c.toString()}</td>
              <td class="num vs">{power(n)}</td>
              <td class="barcol"><span class="bar" style:width="{bar(c)}%"></span></td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <p class="eyebrow">{t('lang.words')}</p>
    {#if words.length === 0 && !loading}
      <p class="muted">{t('lang.none', { n: maxLen })}</p>
    {:else}
      <ol class="words">
        {#each words as w, i (i)}
          <li><button class="mono" onclick={() => (store.word = w.length === 0 ? 'ε' : w.map((s) => (s.length > 1 ? `<${s}>` : s)).join(''))} title={t('lang.toSim')}>{showWord(w)}</button></li>
        {/each}
      </ol>
      {#if !done}
        <button class="btn" onclick={() => load(false)} disabled={loading}>{t('lang.more')}</button>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .wrap {
    padding: 14px 16px 20px;
    overflow: auto;
    height: 100%;
    display: grid;
    align-content: start;
    gap: 10px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .len {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--ink-2);
  }
  .len input {
    width: 4.5em;
    padding: 4px 6px;
    border: 1px solid var(--rule-2);
    border-radius: 6px;
    background: var(--sheet);
    color: var(--ink);
  }
  .badge {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1.5px solid var(--ok);
    color: var(--ok);
  }
  .badge.sample {
    border-color: var(--warn);
    color: var(--warn);
  }
  .eyebrow {
    margin: 8px 0 0;
  }
  .muted {
    margin: 0;
    color: var(--ink-3);
    font-size: 13px;
  }
  .err {
    margin: 0;
    color: var(--bad);
  }
  table {
    border-collapse: collapse;
    font-size: 13px;
    width: 100%;
  }
  th,
  td {
    padding: 3px 8px;
    border-bottom: 1px solid var(--rule);
    text-align: left;
  }
  th {
    font-size: 11.5px;
    color: var(--ink-3);
  }
  .num {
    font-family: var(--font-mono);
    text-align: right;
  }
  .vs {
    color: var(--ink-3);
  }
  .barcol {
    width: 40%;
  }
  .bar {
    display: block;
    height: 8px;
    border-radius: 4px;
    background: var(--select);
  }
  .words {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .words button {
    padding: 2px 8px;
    border: 1px solid var(--rule-2);
    border-radius: 6px;
    background: var(--sheet);
    color: var(--ink);
    cursor: pointer;
  }
  .words button:hover {
    border-color: var(--ink);
  }
  .out td {
    font-size: 14px;
  }
</style>
