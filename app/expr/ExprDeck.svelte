<script lang="ts">
  // Untere Leiste für Ausdruck und Grammatik: Zugehörigkeitstest für ein Wort und
  // die kürzesten Wörter der Sprache. Gerechnet wird intern über einen DEA.
  import { accepts, validate, type ProcResult, type Word, type WordsPage } from '../../core/index';
  import { sampler } from '../lib/runner.svelte';
  import { store } from '../lib/store.svelte';
  import { parseInputWord, showWord } from '../lib/format';
  import { t } from '../i18n';

  const obj = $derived(store.obj!);
  const word = $derived(parseInputWord(store.word));
  const broken = $derived(validate(obj).some((d) => d.severity === 'error'));
  const verdict = $derived(word && !broken ? accepts(obj, word) : null);

  // Kurze Wortprobe im Worker über den DEA (im Hauptthread konnte z. B. [0-9] die Seite einfrieren).
  let sample = $state<Word[] | null>(null);
  let token = 0;
  $effect(() => {
    const o = $state.snapshot(obj) as typeof obj;
    const my = ++token;
    if (broken) {
      sample = null;
      return;
    }
    const id = setTimeout(async () => {
      const r = await sampler.run<ProcResult<WordsPage>>(t('lang.listing'), {
        fn: 'wordsPage',
        sources: [o],
        maxLen: 6,
        offset: 0,
        limit: 24,
        opts: {},
      });
      if (my !== token) return;
      sample = r.status === 'done' && r.value.ok ? r.value.result.words : null;
    }, 200);
    return () => clearTimeout(id);
  });
</script>

<section class="deck" aria-label={t('expr.test')}>
  <label class="word">
    <span class="eyebrow">{t('sim.word')}</span>
    <input class="field mono" bind:value={store.word} placeholder="z. B. 0101" class:invalid={word === null} spellcheck="false" />
  </label>
  <p class="verdict" class:ok={verdict === true} class:bad={verdict === false} aria-live="polite">
    {#if verdict === null}
      {word === null ? t('sim.wordError') : broken ? t('expr.broken') : obj.kind === 'grammatik' ? t('expr.notType3') : '—'}
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
