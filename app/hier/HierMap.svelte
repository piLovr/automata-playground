<script lang="ts">
  // Chomsky-Hierarchie als Landkarte (8.9, Bild 5.25): verschachtelte Rahmen, je Stufe
  // Grammatikform, Automatenmodell, Beispielsprache; Objekte der Arbeitsfläche einsortiert.
  import { hierarchyPlacement, type FormalObject, type HierarchyLevel, type HierarchyPlacement } from '../../core/index';
  import { store } from '../lib/store.svelte';
  import { examples } from '../lib/examples';
  import { t } from '../i18n';

  type Ring = { id: 'all' | 'l0' | 'rec' | 'l1' | 'l2' | 'l3'; level: HierarchyLevel | null; examples: string[] };
  const RINGS: Ring[] = [
    { id: 'all', level: null, examples: [] },
    { id: 'l0', level: 0, examples: ['typ0-ww'] },
    { id: 'rec', level: null, examples: ['b5-9'] },
    { id: 'l1', level: 1, examples: ['typ1-abc', 'lba-abc'] },
    { id: 'l2', level: 2, examples: ['b4-6', 'b4-9'] },
    { id: 'l3', level: 3, examples: ['b2-3'] },
  ];

  const placed = $derived(store.doc.objects.map((o, i) => ({ o, i, p: hierarchyPlacement(o) })));
  const at = (level: HierarchyLevel | null): { o: FormalObject; i: number; p: HierarchyPlacement }[] =>
    level === null ? [] : placed.filter((x) => x.p.level === level);
  const transducers = $derived(placed.filter((x) => x.p.level === null));

  const exampleTitle = (id: string): string => {
    const e = examples.find((x) => x.id === id);
    return e ? `${e.ref ? e.ref + ' ' : ''}${e.title}` : id;
  };
  const hasExample = (id: string): boolean => examples.some((x) => x.id === id);

  function open(i: number): void {
    store.setActive(i);
    store.setView('single');
  }
  let hover = $state<string | null>(null);
</script>

<div class="map">
  <p class="intro">{t('hier.intro')}</p>

  {#snippet ring(k: number)}
    {@const r = RINGS[k]!}
    <section class="ring {r.id}" class:hot={hover === r.id} aria-label={t(`hier.${r.id}`)}>
      <header>
        <div class="info">
        <h3>{t(`hier.${r.id}`)}</h3>
        {#if r.id === 'all'}
          <p class="fact">{t('hier.all.note')}</p>
        {:else}
          <dl>
            {#if r.id === 'rec'}
              <dt>{t('hier.grammar')}</dt><dd>{t('hier.rec.note')}</dd>
              <dt>{t('hier.automaton')}</dt><dd>{t('hier.rec.automaton')}</dd>
            {:else}
              <dt>{t('hier.grammar')}</dt><dd>{t(`hier.${r.id}.grammar`)}</dd>
              <dt>{t('hier.automaton')}</dt><dd>{t(`hier.${r.id}.automaton`)}</dd>
              <dt>{t('hier.example')}</dt><dd>{t(`hier.${r.id}.example`)}</dd>
            {/if}
          </dl>
        {/if}
        </div>
        <div class="chips">
          {#each at(r.level) as x (x.o.name)}
            <button
              class="obj"
              class:exact={x.p.exact}
              title="{t(`hier.reason.${x.p.reason}`)} · {x.p.exact ? t('hier.exact') : t('hier.atLeast')}"
              onclick={() => open(x.i)}
              onpointerenter={() => (hover = r.id)}
              onpointerleave={() => (hover = null)}
            >
              <span class="kind">{t(`kind.${x.o.kind}`)}</span>
              <span class="name">{x.o.name}</span>
              {#if !x.p.exact}<span class="ge" aria-label={t('hier.atLeast')}>≥</span>{/if}
            </button>
          {/each}
          {#each r.examples.filter(hasExample) as id (id)}
            <button class="ex" title={t('hier.load')} onclick={() => store.loadExample(id, { activate: false })}>+ {exampleTitle(id)}</button>
          {/each}
        </div>
      </header>
      {#if k + 1 < RINGS.length}{@render ring(k + 1)}{/if}
    </section>
  {/snippet}

  {@render ring(0)}

  {#if transducers.length}
    <p class="muted">{t('hier.transducers', { names: transducers.map((x) => x.o.name).join(', ') })}</p>
  {/if}
  {#if store.doc.objects.length === 0}<p class="muted">{t('hier.empty')}</p>{/if}
</div>

<style>
  .map {
    display: grid;
    gap: 12px;
  }
  .intro {
    margin: 0;
    max-width: 80ch;
    color: var(--ink-2);
    font-size: 13.5px;
  }
  .ring {
    --pad: 14px;
    border: 1.5px solid var(--rule-2);
    border-radius: 18px;
    padding: 10px var(--pad) var(--pad);
    display: grid;
    gap: 10px;
    transition: border-color 0.15s;
  }
  .ring.all {
    border-color: var(--ink);
    background: var(--paper);
  }
  .ring.l0,
  .ring.l1,
  .ring.l2,
  .ring.l3 {
    border-color: var(--ink-3);
  }
  .ring.l0 {
    background: var(--paper-2);
  }
  .ring.rec {
    border-color: var(--ink);
    border-style: dashed;
    background: var(--sheet);
  }
  .ring.l1 {
    background: color-mix(in srgb, var(--cls-2) 7%, var(--sheet));
  }
  .ring.l2 {
    background: color-mix(in srgb, var(--cls-1) 9%, var(--sheet));
  }
  .ring.l3 {
    background: color-mix(in srgb, var(--cls-0) 11%, var(--sheet));
  }
  .ring.hot {
    border-color: var(--select);
  }
  header {
    display: grid;
    gap: 6px 18px;
  }
  .info {
    display: grid;
    gap: 4px;
    align-content: start;
  }
  @media (min-width: 900px) {
    header {
      grid-template-columns: minmax(260px, 380px) 1fr;
    }
    .chips {
      align-content: start;
    }
  }
  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 2px 10px;
    margin: 0;
    font-size: 12.5px;
  }
  dt {
    color: var(--ink-3);
  }
  dd {
    margin: 0;
  }
  .fact {
    margin: 0;
    font-size: 12.5px;
    color: var(--ink-2);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chips:empty {
    display: none;
  }
  .obj,
  .ex {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 12.5px;
    cursor: pointer;
  }
  .obj {
    border: 1.5px solid var(--ink);
    background: var(--sheet);
    color: var(--ink);
  }
  .obj:not(.exact) {
    border-style: dashed;
  }
  .obj:hover {
    border-color: var(--select);
  }
  .kind {
    font: 600 10.5px var(--font-mono);
    color: var(--ink-3);
  }
  .name {
    font-weight: 600;
  }
  .ge {
    color: var(--ink-3);
  }
  .ex {
    border: 1px dashed var(--rule-2);
    background: none;
    color: var(--ink-2);
  }
  .ex:hover {
    color: var(--ink);
    border-color: var(--ink-3);
  }
  .muted {
    margin: 0;
    color: var(--ink-3);
    font-size: 13px;
  }
  @media (max-width: 640px) {
    .ring {
      --pad: 8px;
    }
  }
</style>
