<script lang="ts">
  // Beispielbibliothek (Abschnitt 9): nach Kapitel gruppiert, nach Skriptnummer sortiert,
  // mit Suche. Nur die mathematischen Objekte, kein Skripttext.
  import { parseDocument } from '../../core/index';
  import { examples } from '../lib/examples';
  import { store } from '../lib/store.svelte';
  import { t } from '../i18n';

  let { onclose }: { onclose: () => void } = $props();

  let query = $state('');
  let input: HTMLInputElement | undefined = $state();
  $effect(() => input?.focus());

  /** Art(en) des Beispiels aus der ersten Zeile jedes Objekts. */
  const kinds = new Map(examples.map((e) => [e.id, [...new Set(parseDocument(e.text).doc.objects.map((o) => o.kind))]]));

  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return examples.filter(
      (e) => !q || e.title.toLowerCase().includes(q) || e.ref.includes(q) || (kinds.get(e.id) ?? []).some((k) => t(`kind.${k}.long`).toLowerCase().includes(q)),
    );
  });
  const chapters = $derived([...new Set(filtered.map((e) => e.chapter))].sort((a, b) => a - b));

  function open(id: string, activate: boolean): void {
    store.loadExample(id, { activate });
    if (activate) store.setView('single');
    store.notify(t('library.loaded'));
    onclose();
  }
</script>

<div class="scrim" role="presentation" onclick={onclose}>
  <div
    class="lib"
    role="dialog"
    aria-modal="true"
    aria-label={t('library.title')}
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === 'Escape' && onclose()}
  >
    <header>
      <h2>{t('library.title')}</h2>
      <input bind:this={input} bind:value={query} placeholder={t('library.search')} aria-label={t('library.search')} />
      <button class="btn ghost" onclick={onclose} aria-label={t('proc.close')}>✕</button>
    </header>
    <div class="list">
      {#each chapters as ch (ch)}
        <section>
          <h3>{t('library.chapter', { n: ch })}</h3>
          <ul>
            {#each filtered.filter((e) => e.chapter === ch) as e (e.id)}
              <li>
                <span class="ref">{e.ref || '·'}</span>
                <span class="title">
                  {e.title}
                  {#if !e.ref}<span class="tag">{t('proc.notInScript')}</span>{/if}
                  {#if e.note}<span class="note" title={e.note}>ⓘ</span>{/if}
                </span>
                <span class="kinds">{#each kinds.get(e.id) ?? [] as k (k)}<span class="kind">{t(`kind.${k}`)}</span>{/each}</span>
                <span class="go">
                  <button class="btn ghost small" onclick={() => open(e.id, false)} title={t('library.addHint')}>{t('library.add')}</button>
                  <button class="btn small" onclick={() => open(e.id, true)}>{t('library.open')}</button>
                </span>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
      {#if filtered.length === 0}<p class="empty">{t('library.none')}</p>{/if}
    </div>
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: start center;
    padding: 6vh 16px;
    background: color-mix(in srgb, var(--ink) 35%, transparent);
  }
  .lib {
    width: min(760px, 100%);
    max-height: 86vh;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    border: 1px solid var(--rule);
    border-radius: 16px;
    background: var(--sheet);
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--rule);
  }
  h2 {
    margin: 0;
    font-size: 16px;
    white-space: nowrap;
  }
  header input {
    flex: 1;
    min-width: 0;
    padding: 7px 10px;
    border: 1px solid var(--rule-2);
    border-radius: 8px;
    background: var(--paper);
    color: var(--ink);
  }
  .list {
    overflow: auto;
    padding: 6px 16px 16px;
  }
  h3 {
    margin: 14px 0 6px;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-3);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: grid;
    grid-template-columns: 3.4em 1fr auto auto;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    border-bottom: 1px solid var(--rule);
  }
  .ref {
    font: 600 12px var(--font-mono);
    color: var(--signal);
  }
  .title {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: baseline;
  }
  .tag {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--ink-3);
    border: 1px solid var(--rule-2);
    border-radius: 4px;
    padding: 0 5px;
  }
  .note {
    color: var(--warn);
    cursor: help;
  }
  .kinds {
    display: flex;
    gap: 4px;
  }
  .kind {
    padding: 1px 5px;
    border-radius: 5px;
    background: var(--paper-2);
    font-size: 10px;
    font-weight: 700;
    color: var(--ink-2);
  }
  .go {
    display: flex;
    gap: 4px;
  }
  .small {
    padding: 3px 9px;
    font-size: 12.5px;
  }
  .empty {
    color: var(--ink-3);
  }
  @media (max-width: 560px) {
    li {
      grid-template-columns: 3em 1fr;
    }
    .kinds,
    .go {
      grid-column: 2;
    }
  }
</style>
