<script lang="ts">
  // Untere Leiste für Ausdruck und Grammatik: Zugehörigkeitstest für ein Wort und
  // die kürzesten Wörter der Sprache. Gerechnet wird intern über einen DEA.
  import { accepts, enumerate } from '../../core/index';
  import { store } from '../lib/store.svelte';
  import { parseInputWord, showWord } from '../lib/format';
  import { t } from '../i18n';

  const obj = $derived(store.obj!);
  const word = $derived(parseInputWord(store.word));
  const verdict = $derived(word ? accepts(obj, word) : null);
  const sample = $derived.by(() => {
    try {
      return enumerate(obj, 6, 24);
    } catch {
      return null;
    }
  });
</script>

<section class="deck" aria-label={t('expr.test')}>
  <label class="word">
    <span class="eyebrow">{t('sim.word')}</span>
    <input class="field mono" bind:value={store.word} placeholder="z. B. 0101" class:invalid={word === null} spellcheck="false" />
  </label>
  <p class="verdict" class:ok={verdict === true} class:bad={verdict === false} aria-live="polite">
    {#if verdict === null}
      {word === null ? t('sim.wordError') : obj.kind === 'regex' ? '—' : t('expr.notType3')}
    {:else}
      {verdict ? '✓' : '✕'} {showWord(word ?? [])} {verdict ? '∈' : '∉'} L({obj.name})
    {/if}
  </p>
  <div class="sample">
    <span class="eyebrow">{t('expr.sample')}</span>
    {#if sample === null}
      <span class="muted">—</span>
    {:else if sample.length === 0}
      <span class="muted">{t('expr.emptyLang')}</span>
    {:else}
      <span class="words">
        {#each sample as w, i (i)}
          <button class="chip mono" onclick={() => (store.word = showWord(w) === 'ε' ? 'ε' : w.join(''))}>{showWord(w)}</button>
        {/each}
      </span>
    {/if}
  </div>
</section>

<style>
  .deck {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 14px 24px;
    padding: 14px 18px;
    background: var(--paper);
    border-top: 1px solid var(--rule);
    height: 100%;
    overflow: auto;
    align-content: flex-start;
  }
  .word {
    display: grid;
    gap: 4px;
    flex: 0 1 280px;
  }
  .eyebrow {
    margin: 0;
  }
  .field {
    height: 34px;
    font-size: 15px;
  }
  .field.invalid {
    border-color: var(--bad);
  }
  .verdict {
    margin: 0 0 6px;
    font-size: 16px;
    font-weight: 650;
  }
  .verdict.ok {
    color: var(--ok);
  }
  .verdict.bad {
    color: var(--bad);
  }
  .sample {
    flex-basis: 100%;
    display: grid;
    gap: 6px;
  }
  .words {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .chip {
    padding: 2px 8px;
    border: 1px solid var(--rule-2);
    border-radius: 6px;
    background: var(--sheet);
    color: var(--ink);
    cursor: pointer;
  }
  .muted {
    color: var(--ink-3);
  }
</style>
