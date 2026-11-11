<script lang="ts">
  // Reiter „Verfahren“: alle passenden Verfahren aus 7.1, sofort oder schrittweise,
  // dazu Äquivalenztest, trennendes Wort und Herkunft des aktiven Objekts.
  import { applicableMethods, grammarType, type FormalObject, type MethodId } from '../../core/index';
  import { store } from '../lib/store.svelte';
  import { procs } from '../lib/procs.svelte';
  import { runner } from '../lib/runner.svelte';
  import { METHODS, METHOD_ORDER } from '../lib/methods';
  import { parseInputWord, showWord } from '../lib/format';
  import { t } from '../i18n';

  const obj = $derived(store.obj);
  const methods = $derived(obj ? METHOD_ORDER.filter((m) => applicableMethods(obj).includes(m)) : []);

  /** Typ-3-Objekte (für Äquivalenztest und Produkt). */
  function isType3(o: FormalObject): boolean {
    if (o.kind === 'dea' || o.kind === 'nea' || o.kind === 'regex' || o.kind === 'menge' || o.kind === 'egrep') return true;
    return o.kind === 'grammatik' && grammarType(o).type === 3;
  }
  const others = $derived(store.doc.objects.filter((o) => o !== obj && isType3(o)));
  const deas = $derived(store.doc.objects.filter((o) => o !== obj && o.kind === 'dea'));

  let partner = $state<Record<string, string>>({});
  let compareWith = $state('');
  let w1 = $state('');
  let w2 = $state('');

  const origin = $derived(obj?.origin);
  const stale = $derived(obj ? procs.stale(obj) : false);

  function sourcesFor(m: MethodId): FormalObject[] | null {
    if (!obj) return null;
    if (!METHODS[m].binary) return [obj];
    const other = store.doc.objects.find((o) => o.name === (partner[m] ?? deas[0]?.name));
    return other ? [obj, other] : null;
  }

  function start(m: MethodId, mode: 'instant' | 'steps'): void {
    const src = sourcesFor(m);
    if (!src) return store.notify(t('proc.needPartner'), 'error');
    void procs.run(m, src, mode);
  }

  const seconds = $derived(runner.busy ? Math.floor((Date.now() - runner.busy.since) / 1000) : 0);

  function separate(): void {
    const a = parseInputWord(w1);
    const b = parseInputWord(w2);
    if (!a || !b) return store.notify(t('error.word'), 'error');
    void procs.separate(a, b);
  }
</script>

<div class="wrap">
  {#if runner.busy}
    <div class="busy" role="status">
      <span class="spinner" aria-hidden="true"></span>
      <span class="what">{runner.busy.label} …{#if runner.busy.done > 0}<span class="n"> {t('proc.progress', { n: runner.busy.done })}</span>{/if}{#if seconds > 1}<span class="n"> · {seconds} s</span>{/if}</span>
      <button class="btn" onclick={() => runner.cancel()}>{t('proc.cancel')}</button>
    </div>
  {/if}

  {#if obj && origin}
    <section class="origin" class:stale>
      <p class="eyebrow">{t('proc.origin')}</p>
      <p>
        {t('proc.originText', { method: t(`method.${origin.method}`), sources: origin.sources.join(', ') })}
        {#if stale}<span class="tag warn">{t('proc.stale')}</span>{/if}
      </p>
      {#if stale}
        <button class="btn" onclick={() => procs.recompute(obj.name)} disabled={!!runner.busy}>{t('proc.recompute')}</button>
      {/if}
    </section>
  {/if}

  <section>
    <p class="eyebrow">{t('proc.methods')}</p>
    {#if methods.length === 0}
      <p class="empty">{t('proc.none')}</p>
    {/if}
    <ul class="methods">
      {#each methods as m (m)}
        {@const info = METHODS[m]}
        <li>
          <div class="name">
            <span>{t(`method.${m}`)}</span>
            {#if info.ref}
              <span class="ref">{info.ref}</span>
            {:else}
              <span class="tag">{t('proc.notInScript')}</span>
            {/if}
            {#if info.supplement}<span class="tag" title={t('proc.supplementHint')}>{t('proc.supplement')}</span>{/if}
          </div>
          <p class="desc">{t(`method.${m}.desc`)}</p>
          {#if info.binary}
            <label class="partner">
              <span>{t('proc.with')}</span>
              <select bind:value={() => partner[m] ?? deas[0]?.name ?? '', (v) => (partner = { ...partner, [m]: v })}>
                {#each deas as d (d.name)}<option value={d.name}>{d.name}</option>{/each}
              </select>
            </label>
          {/if}
          <div class="go">
            <button class="btn" onclick={() => start(m, 'steps')} disabled={!!runner.busy || (info.binary && deas.length === 0)}>{t('proc.steps')}</button>
            <button class="btn primary" onclick={() => start(m, 'instant')} disabled={!!runner.busy || (info.binary && deas.length === 0)}>{t('proc.instant')}</button>
          </div>
        </li>
      {/each}
    </ul>
  </section>

  {#if obj && isType3(obj)}
    <section>
      <p class="eyebrow">{t('proc.compare')}</p>
      {#if others.length === 0}
        <p class="empty">{t('proc.compareNone')}</p>
      {:else}
        <div class="row">
          <select bind:value={() => compareWith || others[0]?.name || '', (v) => (compareWith = v)} aria-label={t('proc.compareWith')}>
            {#each others as o (o.name)}<option value={o.name}>{o.name}</option>{/each}
          </select>
          <button class="btn" onclick={() => procs.compareActive(compareWith || others[0]!.name)} disabled={!!runner.busy}>{t('proc.equivalence')}</button>
        </div>
        {#if procs.equiv && procs.equiv.a === obj.name}
          {@const e = procs.equiv}
          <p class="result" class:ok={e.res.equal} class:bad={!e.res.equal}>
            {#if e.res.equal}
              ✓ {t('proc.equal', { a: e.a, b: e.b })}
            {:else}
              ✕ {t('proc.unequal', { a: e.a, b: e.b, word: showWord(e.res.word ?? []), in: e.res.inLanguage === 0 ? e.a : e.b, out: e.res.inLanguage === 0 ? e.b : e.a })}
            {/if}
          </p>
        {/if}
        {#if obj.kind === 'regex'}<p class="note">{t('proc.pspace')}</p>{/if}
      {/if}
    </section>
  {/if}

  {#if obj?.kind === 'dea'}
    <section>
      <p class="eyebrow">{t('proc.separatingTitle')} <span class="ref">2.84</span></p>
      <div class="row">
        <input class="mono" bind:value={w1} placeholder="w₁" aria-label="w₁" />
        <input class="mono" bind:value={w2} placeholder="w₂" aria-label="w₂" />
        <button class="btn" onclick={separate} disabled={!!runner.busy}>{t('proc.find')}</button>
      </div>
      {#if procs.separating}
        {@const s = procs.separating}
        <p class="result">
          {#if s.word}
            {t('proc.separates', { w: showWord(s.word), w1: showWord(s.w1), w2: showWord(s.w2) })}
          {:else}
            {t('proc.noSeparator', { w1: showWord(s.w1), w2: showWord(s.w2) })}
          {/if}
        </p>
      {/if}
    </section>
  {/if}

  <details class="limits">
    <summary>{t('proc.settings')}</summary>
    <label class="check"><input type="checkbox" bind:checked={procs.simplify} /> {t('proc.simplify')}</label>
    <label class="check"><input type="checkbox" bind:checked={procs.fullPowerset} /> {t('proc.fullPowerset')}</label>
    <label class="num">{t('proc.maxStates')} <input type="number" min="1" bind:value={procs.maxStates} /></label>
    <label class="num">{t('proc.maxExprSize')} <input type="number" min="1" bind:value={procs.maxExprSize} /></label>
  </details>
</div>

<style>
  .wrap {
    padding: 14px 16px 20px;
    overflow: auto;
    height: 100%;
    display: grid;
    align-content: start;
    gap: 18px;
  }
  section {
    display: grid;
    gap: 8px;
  }
  .eyebrow {
    margin: 0;
  }
  .empty,
  .note {
    margin: 0;
    color: var(--ink-3);
    font-size: 12.5px;
  }
  .busy {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--signal);
    border-radius: var(--radius);
    background: var(--signal-soft);
  }
  .busy .what {
    flex: 1;
    font-weight: 600;
  }
  .busy .n {
    font-weight: 400;
    color: var(--ink-2);
  }
  .spinner {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid var(--signal);
    border-right-color: transparent;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
  .origin {
    padding: 10px 12px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--sheet);
  }
  .origin.stale {
    border-color: var(--warn);
    background: var(--warn-soft);
  }
  .origin p {
    margin: 0;
  }
  .origin .btn {
    justify-self: start;
  }
  .methods {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }
  .methods li {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--rule);
  }
  .name {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
    font-weight: 600;
  }
  .desc {
    grid-column: 1;
    margin: 0;
    color: var(--ink-2);
    font-size: 12.5px;
  }
  .go {
    grid-column: 2;
    grid-row: 1 / span 3;
    align-self: center;
    display: flex;
    gap: 6px;
  }
  .partner {
    grid-column: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: var(--ink-2);
  }
  .ref {
    font: 500 11px var(--font-mono);
    color: var(--ink-3);
  }
  .tag {
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid var(--rule-2);
    color: var(--ink-2);
  }
  .tag.warn {
    border-color: var(--warn);
    color: var(--warn);
  }
  .row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .row input {
    width: 7em;
  }
  input,
  select {
    padding: 5px 8px;
    border: 1px solid var(--rule-2);
    border-radius: 6px;
    background: var(--sheet);
    color: var(--ink);
    font: inherit;
  }
  .result {
    margin: 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--paper-2);
  }
  .result.ok {
    background: var(--ok-soft);
    color: var(--ok);
  }
  .result.bad {
    background: var(--bad-soft);
    color: var(--bad);
  }
  .limits summary {
    cursor: pointer;
    color: var(--ink-2);
    font-weight: 600;
  }
  .limits {
    display: grid;
    gap: 6px;
  }
  .limits label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }
  .limits .num input {
    width: 7em;
  }
</style>
