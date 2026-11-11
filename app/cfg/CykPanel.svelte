<script lang="ts">
  // CYK (6.33–6.38): Pyramide D[i, j] für w(i, j], Schichten nach Länge wie Abbildung 6.1.
  // Schrittweise füllen, Zelle anklicken: Teilwort, Zerlegungen, Ableitungsbaum (8.4).
  import { cykTree, isCnf, type CykCell, type CykResult, type Grammar, type ProcResult, type Sym } from '../../core/index';
  import { store } from '../lib/store.svelte';
  import { runner } from '../lib/runner.svelte';
  import { procs } from '../lib/procs.svelte';
  import { diagnosticText, parseInputWord, showSym, showSymIn, showWordIn } from '../lib/format';
  import TreeView from '../derive/TreeView.svelte';
  import { t } from '../i18n';

  let { g }: { g: Grammar } = $props();

  const cnf = $derived(isCnf(g).ok);
  let word = $state(store.word);
  let result = $state<CykResult | null>(null);
  let shownCells = $state(0);
  let marksMode = $state(false);
  let sel = $state<{ i: number; j: number } | null>(null);
  let selX = $state<Sym | null>(null);
  let error = $state('');

  async function run(): Promise<void> {
    const w = parseInputWord(word);
    if (!w) return store.notify(t('error.word'), 'error');
    error = '';
    const out = await runner.run<ProcResult<CykResult>>('CYK', { fn: 'cyk', sources: [$state.snapshot(g) as Grammar], word: w, opts: { steps: false } });
    if (out.status !== 'done') return;
    if (!out.value.ok) {
      error = out.value.diagnostics[0] ? diagnosticText(out.value.diagnostics[0]) : t('proc.failed');
      return;
    }
    result = out.value.result;
    shownCells = result.cells.length;
    sel = null;
    selX = null;
  }

  const n = $derived(result?.word.length ?? 0);
  /** Zellen bis zum aktuellen Schritt (Reihenfolge von 6.34: nach Länge, dann i). */
  const filled = $derived(new Set((result?.cells ?? []).slice(0, shownCells).map((c) => `${c.i},${c.j}`)));
  const cellAt = (i: number, j: number): CykCell | undefined => result?.cells.find((c) => c.i === i && c.j === j);
  const current = $derived(result && shownCells > 0 && shownCells < result.cells.length + 1 ? result.cells[shownCells - 1] : undefined);
  const selCell = $derived(sel ? cellAt(sel.i, sel.j) : undefined);
  const tree = $derived(result && sel && selX ? cykTree(g, result, sel.i, sel.j, selX) : null);
  const prodText = (id: string): string => {
    const p = g.productions.find((x) => x.id === id);
    return p ? `${showWordIn(g.nonterminals, p.left)} → ${showWordIn(g.nonterminals, p.right)}` : id;
  };
  const inSel = (k: number): boolean => !!sel && k >= sel.i && k < sel.j;
</script>

{#if !cnf}
  <div class="note">
    <p>{t('cyk.needCnf')}</p>
    <button class="btn primary" onclick={() => procs.run('toCnf', [g], 'steps')} disabled={!!runner.busy}>{t('cyk.toCnf')}</button>
  </div>
{:else}
  <div class="cyk">
    <div class="row">
      <input class="mono word" bind:value={word} placeholder="(a+a)" aria-label={t('sim.word')} onkeydown={(e) => e.key === 'Enter' && run()} />
      <button class="btn primary" onclick={run} disabled={!!runner.busy}>{t('cyk.run')}</button>
      <label class="check"><input type="checkbox" bind:checked={marksMode} /> {t('cyk.marks')} <span class="ref">6.36</span></label>
    </div>
    {#if error}<p class="err">{error}</p>{/if}

    {#if result}
      <div class="steps">
        <button class="btn ghost small" onclick={() => (shownCells = 0)}>⏮</button>
        <button class="btn ghost small" onclick={() => (shownCells = Math.max(0, shownCells - 1))}>◀</button>
        <input type="range" min="0" max={result.cells.length} bind:value={shownCells} aria-label={t('cyk.step')} />
        <button class="btn ghost small" onclick={() => (shownCells = Math.min(result!.cells.length, shownCells + 1))}>▶</button>
        <button class="btn ghost small" onclick={() => (shownCells = result!.cells.length)}>⏭</button>
        <span class="mono count">{shownCells} / {result.cells.length}</span>
      </div>
      {#if current && shownCells < result.cells.length}
        <p class="explain">{t('cyk.cellStep', { i: current.i, j: current.j, w: showWordIn(g.nonterminals, result.word.slice(current.i, current.j)), set: current.nonterminals.length ? current.nonterminals.map(showSym).join(', ') : '∅' })}</p>
      {/if}

      <div class="pyramid" style:--n={n} aria-label={t('cyk.pyramid')}>
        {#each Array.from({ length: n }, (_, k) => n - k) as len (len)}
          <div class="layer" style:--len={len}>
            {#each Array.from({ length: n - len + 1 }, (_, i) => i) as i (i)}
              {@const c = cellAt(i, i + len)}
              {@const shown = filled.has(`${i},${i + len}`)}
              <button
                class="cell"
                class:sel={sel?.i === i && sel?.j === i + len}
                class:start={shown && i === 0 && len === n && !!g.start && (c?.nonterminals.includes(g.start) ?? false)}
                class:now={current?.i === i && current?.j === i + len && shownCells < result.cells.length}
                onclick={() => ((sel = { i, j: i + len }), (selX = c?.nonterminals[0] ?? null))}
                title="D[{i}, {i + len}]"
              >
                <span class="idx">{i},{i + len}</span>
                {#if shown && c}
                  {#if marksMode}
                    {#each c.marks as m, k (k)}<span class="mark">{prodText(m.production)}{#if m.split !== null}<sub>{m.split}</sub>{/if}</span>{/each}
                  {:else}
                    <span class="set">{c.nonterminals.length ? c.nonterminals.map(showSym).join(' ') : '∅'}</span>
                  {/if}
                {/if}
              </button>
            {/each}
          </div>
        {/each}
        <div class="word-row">
          {#each result.word as s, k (k)}<span class="sym mono" class:on={inSel(k)}>{showSymIn(g.nonterminals, s)}</span>{/each}
        </div>
      </div>

      <p class="summary" class:ok={result.accepted && shownCells === result.cells.length} class:bad={!result.accepted && shownCells === result.cells.length}>
        {#if shownCells === result.cells.length}{result.accepted ? t('cyk.accepted', { s: g.start ?? 'S' }) : t('cyk.rejected', { s: g.start ?? 'S' })}{/if}
      </p>

      {#if sel && selCell}
        <div class="detail">
          <p class="eyebrow">D[{sel.i}, {sel.j}] · w({sel.i}, {sel.j}] = {showWordIn(g.nonterminals, result.word.slice(sel.i, sel.j))}</p>
          {#if selCell.marks.length === 0}
            <p class="muted">{t('cyk.empty')}</p>
          {:else}
            <ul class="marks">
              {#each selCell.marks as m, k (k)}
                <li>{prodText(m.production)}{#if m.split !== null} <span class="muted">{t('cyk.split', { m: m.split, a: showWordIn(g.nonterminals, result.word.slice(sel.i, m.split)), b: showWordIn(g.nonterminals, result.word.slice(m.split, sel.j)) })}</span>{/if}</li>
              {/each}
            </ul>
            <div class="pick">
              {#each selCell.nonterminals as x (x)}
                <button class="btn small" class:primary={selX === x} onclick={() => (selX = x)}>{t('cyk.treeFor', { x: showSymIn(g.nonterminals, x) })}</button>
              {/each}
            </div>
            {#if tree}<div class="tree-box"><TreeView {tree} nonterminals={g.nonterminals} compact /></div>{/if}
          {/if}
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .cyk,
  .note {
    display: grid;
    gap: 12px;
  }
  .note p {
    margin: 0;
    color: var(--ink-2);
  }
  .note .btn {
    justify-self: start;
  }
  .row,
  .steps {
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
  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--ink-2);
  }
  .ref {
    font: 500 10.5px var(--font-mono);
    color: var(--ink-3);
  }
  .small {
    padding: 3px 8px;
    font-size: 12.5px;
  }
  .steps input[type='range'] {
    width: 200px;
    accent-color: var(--ink);
  }
  .count {
    font-size: 12px;
    color: var(--ink-3);
  }
  .explain {
    margin: 0;
    font-size: 14px;
  }
  .err {
    margin: 0;
    color: var(--bad);
  }
  .pyramid {
    --cw: clamp(64px, calc(100% / var(--n)), 120px);
    display: grid;
    gap: 4px;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .layer {
    display: flex;
    gap: 4px;
    padding-left: calc((var(--len) - 1) * (var(--cw) + 4px) / 2);
  }
  .cell {
    position: relative;
    width: var(--cw);
    min-width: var(--cw);
    min-height: 48px;
    padding: 14px 4px 4px;
    border: 1px solid var(--rule-2);
    border-radius: 8px;
    background: var(--state-fill);
    color: var(--ink);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    cursor: pointer;
  }
  .cell:hover {
    border-color: var(--ink);
  }
  .cell.sel {
    border-color: var(--select);
    box-shadow: 0 0 0 2px var(--select-soft);
  }
  .cell.now {
    border-color: var(--signal);
    background: var(--signal-soft);
  }
  .cell.start {
    border-color: var(--ok);
    border-width: 2px;
  }
  .idx {
    position: absolute;
    top: 2px;
    left: 5px;
    font: 500 9.5px var(--font-mono);
    color: var(--ink-3);
  }
  .set {
    font-family: var(--font-math);
    font-style: italic;
    font-size: 15px;
  }
  .mark {
    font-family: var(--font-math);
    font-style: italic;
    font-size: 11.5px;
    white-space: nowrap;
  }
  .word-row {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }
  .word-row .sym {
    width: var(--cw);
    min-width: var(--cw);
    text-align: center;
    padding: 4px 0;
    border-top: 2px solid var(--rule-2);
    font-size: 17px;
  }
  .word-row .sym.on {
    border-top-color: var(--select);
    background: var(--select-soft);
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
  .detail {
    display: grid;
    gap: 8px;
    padding: 12px;
    border: 1px solid var(--rule);
    border-radius: 12px;
    background: var(--paper);
  }
  .eyebrow {
    margin: 0;
  }
  .marks {
    margin: 0;
    padding-left: 18px;
    font-family: var(--font-math);
    font-style: italic;
  }
  .muted {
    color: var(--ink-3);
    font-style: normal;
    font-family: var(--font-ui);
    font-size: 12.5px;
  }
  .pick {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .tree-box {
    max-width: 560px;
  }
</style>
