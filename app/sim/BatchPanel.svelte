<script lang="ts">
  import { store, type BatchRow } from '../lib/store.svelte';
  import { sim } from '../lib/sim.svelte';
  import { t } from '../i18n';

  const PASTE_EXAMPLE = '01 +\n0011 -\nε +';
  let pasting = $state(false);
  let pasteText = $state('');

  const rows = $derived(sim.batch);
  const judged = $derived(rows.filter((r) => r.res && r.res.ok !== null));
  const passed = $derived(judged.filter((r) => r.res!.ok).length);

  function setRows(next: BatchRow[]): void {
    store.batch = next;
  }
  function patch(i: number, p: Partial<BatchRow>): void {
    setRows(store.batch.map((r, k) => (k === i ? { ...r, ...p } : r)));
  }
  function cycle(e: boolean | null): boolean | null {
    return e === true ? false : e === false ? null : true;
  }

  function applyPaste(): void {
    const added: BatchRow[] = [];
    for (const line of pasteText.split('\n')) {
      const s = line.trim();
      if (!s) continue;
      const m = /^(.*?)\s+([+−-]|∈|∉)$/u.exec(s);
      if (m) added.push({ input: m[1]!, expected: m[2] === '+' || m[2] === '∈' });
      else added.push({ input: s, expected: null });
    }
    setRows([...store.batch, ...added]);
    pasteText = '';
    pasting = false;
  }

  function useWord(input: string): void {
    store.word = input;
  }

  const GLYPH = { accepted: '✓', rejected: '✗', stuck: '⊘', limit: '…' } as const;
</script>

<div class="wrap">
  <div class="head">
    <div>
      <p class="eyebrow">{t('batch.title')}</p>
      {#if judged.length}
        <p class="summary" class:allok={passed === judged.length}>
          <span class="bar" style:--p={passed / judged.length}></span>
          {t('batch.summary', { ok: passed, n: judged.length })}
        </p>
      {/if}
    </div>
    <div class="actions">
      <button class="btn" onclick={() => (pasting = !pasting)}>{t('batch.paste')}</button>
      <button class="btn primary" onclick={() => setRows([...store.batch, { input: '', expected: true }])}>+ {t('batch.add')}</button>
    </div>
  </div>

  {#if pasting}
    <div class="paste">
      <p class="hint">{t('batch.pasteHint')}</p>
      <textarea class="mono" rows="5" bind:value={pasteText} placeholder={PASTE_EXAMPLE}></textarea>
      <div class="actions">
        <button class="btn ghost" onclick={() => (pasting = false)}>{t('batch.cancel')}</button>
        <button class="btn primary" onclick={applyPaste}>{t('batch.apply')}</button>
      </div>
    </div>
  {/if}

  {#if rows.length === 0}
    <p class="empty">{t('batch.empty')}</p>
  {:else}
    <ul class="list">
      {#each rows as { row, res }, i (i)}
        {@const state = res === null ? 'err' : res.ok === null ? 'none' : res.ok ? 'ok' : 'bad'}
        <li class={state}>
          <span class="verdict" aria-hidden="true">{state === 'ok' ? '●' : state === 'bad' ? '▲' : state === 'err' ? '!' : '○'}</span>
          <input
            class="mono word"
            value={row.input}
            placeholder="ε"
            aria-label={t('sim.word')}
            oninput={(e) => patch(i, { input: e.currentTarget.value })}
          />
          <button class="expect" onclick={() => patch(i, { expected: cycle(row.expected) })} title={t('batch.expect')}>
            {row.expected === true ? t('batch.in') : row.expected === false ? t('batch.notIn') : t('batch.any')}
          </button>
          <button class="res" onclick={() => useWord(row.input)} title="In der Simulation öffnen">
            {#if res}{GLYPH[res.result]} {t(`result.${res.result}`)}{:else}{t('sim.wordError')}{/if}
          </button>
          <button class="rm" aria-label={t('batch.remove')} title={t('batch.remove')} onclick={() => setRows(store.batch.filter((_, k) => k !== i))}>×</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .wrap {
    padding: 14px 16px;
    overflow: auto;
    height: 100%;
  }
  .head {
    flex-wrap: wrap;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 12px;
  }
  .head .eyebrow {
    margin: 0 0 4px;
  }
  .summary {
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-weight: 600;
    color: var(--bad);
  }
  .summary.allok {
    color: var(--ok);
  }
  .bar {
    width: 60px;
    height: 6px;
    border-radius: 3px;
    background: linear-gradient(90deg, var(--ok) calc(var(--p) * 100%), var(--bad-soft) 0);
  }
  .actions {
    display: flex;
    gap: 6px;
  }
  .paste {
    display: grid;
    gap: 8px;
    margin-bottom: 14px;
    padding: 10px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--sheet);
  }
  .paste .hint {
    margin: 0;
    font-size: 12px;
    color: var(--ink-3);
  }
  .paste textarea {
    resize: vertical;
    padding: 8px;
    border: 1px solid var(--rule);
    border-radius: 6px;
    background: var(--paper);
  }
  .paste .actions {
    justify-content: flex-end;
  }
  .empty {
    color: var(--ink-3);
    max-width: 40ch;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: grid;
    grid-template-columns: 18px 1fr auto auto 22px;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    border-bottom: 1px solid var(--rule);
  }
  .verdict {
    font-size: 11px;
    text-align: center;
  }
  li.ok .verdict {
    color: var(--ok);
  }
  li.bad .verdict,
  li.err .verdict {
    color: var(--bad);
  }
  li.none .verdict {
    color: var(--ink-3);
  }
  li.bad {
    background: linear-gradient(90deg, var(--bad-soft), transparent 70%);
  }
  .word {
    min-width: 0;
    height: 30px;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    font-size: 14px;
    outline: none;
  }
  .word:hover {
    border-color: var(--rule);
  }
  .word:focus {
    border-color: var(--select);
    background: var(--sheet);
  }
  .expect {
    min-width: 54px;
    height: 26px;
    padding: 0 8px;
    border: 1px solid var(--rule);
    border-radius: 13px;
    background: var(--sheet);
    font-size: 12.5px;
    font-family: var(--font-math);
  }
  .res {
    min-width: 108px;
    height: 26px;
    padding: 0 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    font-size: 12.5px;
    text-align: left;
    color: var(--ink-2);
  }
  .res:hover {
    background: var(--paper-2);
  }
  li.ok .res {
    color: var(--ok);
  }
  li.bad .res,
  li.err .res {
    color: var(--bad);
    font-weight: 600;
  }
  .rm {
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--ink-3);
  }
  .rm:hover {
    background: var(--bad-soft);
    color: var(--bad);
  }
</style>
