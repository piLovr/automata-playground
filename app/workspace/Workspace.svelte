<script lang="ts">
  // Sprach-Arbeitsfläche (Abschnitt 8): Objekte nebeneinander, Herkunftskette,
  // Hervorhebung der Entsprechungen, Äquivalenz aller Paare, synchroner Worttest.
  import { accepts, grammarType, type FormalObject } from '../../core/index';
  import { store } from '../lib/store.svelte';
  import { hl } from '../lib/hl.svelte';
  import { procs } from '../lib/procs.svelte';
  import { runner } from '../lib/runner.svelte';
  import { chainEdges } from '../lib/corr';
  import { parseInputWord, showWord } from '../lib/format';
  import ObjectView from '../expr/ObjectView.svelte';
  import { t } from '../i18n';

  const objects = $derived(store.doc.objects);
  const edges = $derived(chainEdges(store.doc));

  /** Tiefe in der Herkunftskette (längster Weg von einer Wurzel). */
  const depth = $derived.by(() => {
    const d = new Map<string, number>(objects.map((o) => [o.name, 0]));
    for (let round = 0; round < objects.length; round++) {
      let changed = false;
      for (const e of edges) {
        const nd = (d.get(e.from) ?? 0) + 1;
        if (nd > (d.get(e.to) ?? 0)) {
          d.set(e.to, nd);
          changed = true;
        }
      }
      if (!changed) break;
    }
    return d;
  });
  const ordered = $derived([...objects].sort((a, b) => (depth.get(a.name) ?? 0) - (depth.get(b.name) ?? 0)));

  // Abhängigkeitsgraph: Spalten nach Tiefe.
  const nodeW = (o: FormalObject): number => 34 + ([...o.name].length + t(`kind.${o.kind}`).length) * 7.6;
  const chain = $derived.by(() => {
    const cols = new Map<number, FormalObject[]>();
    for (const o of ordered) {
      const k = depth.get(o.name) ?? 0;
      (cols.get(k) ?? cols.set(k, []).get(k)!).push(o);
    }
    const pos = new Map<string, { x: number; y: number; w: number }>();
    let rows = 1;
    let x = 4;
    for (const k of [...cols.keys()].sort((a, b) => a - b)) {
      const objs = cols.get(k)!;
      const w = Math.max(...objs.map(nodeW));
      rows = Math.max(rows, objs.length);
      objs.forEach((o, i) => pos.set(o.name, { x: x + w / 2, y: 22 + i * 40, w: nodeW(o) }));
      x += w + 46;
    }
    return { pos, width: x - 42, height: 4 + rows * 40 };
  });

  function isType3(o: FormalObject): boolean {
    if (o.kind === 'dea' || o.kind === 'nea' || o.kind === 'regex') return true;
    return o.kind === 'grammatik' && grammarType(o).type === 3;
  }
  const type3 = $derived(objects.filter(isType3));

  let word = $state('');
  const parsedWord = $derived(word.trim() === '' ? null : parseInputWord(word));
  function verdict(o: FormalObject): boolean | null {
    if (!parsedWord || !isType3(o)) return null;
    return accepts(o, parsedWord);
  }
  const verdicts = $derived(new Map(objects.map((o) => [o.name, verdict(o)])));
  const disagree = $derived(new Set([...verdicts.values()].filter((v) => v !== null)).size > 1);

  function open(name: string): void {
    const i = objects.findIndex((o) => o.name === name);
    if (i >= 0) store.setActive(i);
    store.setView('single');
  }

  const pairs = $derived(Object.entries(procs.matrix));
  /** Objekte, die im Vergleich vorkommen, in Reihenfolge der Arbeitsfläche. */
  const compared = $derived.by(() => {
    const names = new Set(pairs.flatMap(([k]) => k.split('|')));
    return ordered.filter((o) => names.has(o.name)).map((o) => o.name);
  });
  function cell(a: string, b: string) {
    return procs.matrix[`${a}|${b}`] ?? procs.matrix[`${b}|${a}`];
  }
</script>

<div class="ws">
  <div class="bar">
    <div class="chain" aria-label={t('ws.chain')}>
      <p class="eyebrow">{t('ws.chain')}</p>
      {#if edges.length === 0}
        <p class="muted">{t('ws.noChain')}</p>
      {:else}
        <svg viewBox="0 0 {chain.width} {chain.height}" width={chain.width} height={chain.height} role="img" aria-label={t('ws.chain')}>
          <defs>
            <marker id="ws-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" class="ah" />
            </marker>
          </defs>
          {#each edges as e, i (i)}
            {@const a = chain.pos.get(e.from)}
            {@const b = chain.pos.get(e.to)}
            {#if a && b}
              {@const x1 = a.x + a.w / 2}
              {@const x2 = b.x - b.w / 2 - 2}
              <path class="link" d="M{x1},{a.y} C{(x1 + x2) / 2},{a.y} {(x1 + x2) / 2},{b.y} {x2},{b.y}" marker-end="url(#ws-arrow)">
                <title>{t(`method.${e.method}`)}</title>
              </path>
            {/if}
          {/each}
          {#each objects as o (o.name)}
            {@const p = chain.pos.get(o.name)}
            {#if p}
              <g class="cnode" class:on={store.obj?.name === o.name} transform="translate({p.x} {p.y})" onclick={() => open(o.name)} role="presentation">
                <rect x={-p.w / 2} y="-14" width={p.w} height="28" rx="8" />
                <text text-anchor="middle" dominant-baseline="central"><tspan class="k">{t(`kind.${o.kind}`)}</tspan> {o.name}</text>
              </g>
            {/if}
          {/each}
        </svg>
      {/if}
    </div>

    <div class="tools">
      <label class="word">
        <span class="eyebrow">{t('ws.word')}</span>
        <input class="mono field" bind:value={word} placeholder="z. B. 0101" class:invalid={word.trim() !== '' && parsedWord === null} />
      </label>
      {#if disagree}<p class="warn">{t('ws.disagree')}</p>{/if}
      <button class="btn" onclick={() => procs.compareAll(type3)} disabled={type3.length < 2 || !!runner.busy}>{t('ws.compareAll')}</button>
      {#if runner.busy}
        <button class="btn ghost" onclick={() => runner.cancel()}>{t('proc.cancel')}</button>
      {/if}
    </div>
  </div>

  {#if pairs.length}
    <div class="matrix">
      <table>
        <caption>{t('ws.matrix')}</caption>
        <thead>
          <tr><th></th>{#each compared as n (n)}<th scope="col">{n}</th>{/each}</tr>
        </thead>
        <tbody>
          {#each compared as a, i (a)}
            <tr>
              <th scope="row">{a}</th>
              {#each compared as b, j (b)}
                {@const r = i === j ? null : cell(a, b)}
                {#if i === j}
                  <td class="self">—</td>
                {:else if !r || r === 'error'}
                  <td>…</td>
                {:else if r.equal}
                  <td class="ok" title={t('proc.equal', { a, b })}>≡</td>
                {:else}
                  <td class="bad" title={t('ws.cellUnequal', { word: showWord(r.word ?? []), in: r.inLanguage === 0 ? (i < j ? a : b) : i < j ? b : a })}
                    >≢ <span class="mono">{showWord(r.word ?? [])}</span></td
                  >
                {/if}
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <div class="cards">
    {#each ordered as o (o.name)}
      {@const v = verdicts.get(o.name)}
      {@const stale = procs.stale(o)}
      <article class="card" class:active={store.obj?.name === o.name} class:stale>
        <header>
          <span class="kind">{t(`kind.${o.kind}`)}</span>
          <button class="name" onclick={() => open(o.name)} title={t('ws.open')}>{o.name}</button>
          {#if v !== null && v !== undefined}
            <span class="verdict" class:ok={v} class:bad={!v}>{v ? '✓ ∈ L' : '✕ ∉ L'}</span>
          {/if}
        </header>
        {#if o.origin}
          <p class="origin">
            ← {o.origin.sources.join(', ')} · {t(`method.${o.origin.method}`)}
            {#if stale}
              <span class="tag">{t('proc.stale')}</span>
              <button class="btn ghost small" onclick={() => procs.recompute(o.name)} disabled={!!runner.busy}>{t('proc.recompute')}</button>
            {/if}
          </p>
        {/if}
        <div class="body" class:graph={o.kind !== 'regex' && o.kind !== 'grammatik'}>
          <ObjectView obj={o} compact highlight={hl.keysFor(o.name)} onhover={(e) => hl.set(o.name, e)} />
        </div>
      </article>
    {/each}
  </div>
</div>

<style>
  .ws {
    height: 100%;
    overflow: auto;
    background: var(--paper);
    padding: 16px 20px 28px;
    display: grid;
    align-content: start;
    gap: 14px;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 16px 32px;
    align-items: flex-end;
    justify-content: space-between;
  }
  .eyebrow {
    margin: 0 0 6px;
  }
  .muted {
    margin: 0;
    color: var(--ink-3);
    font-size: 13px;
    max-width: 50ch;
  }
  .chain {
    max-width: 100%;
    overflow-x: auto;
  }
  .link {
    fill: none;
    stroke: var(--ink-3);
    stroke-width: 1.5;
  }
  .ah {
    fill: var(--ink-3);
  }
  .cnode {
    cursor: pointer;
  }
  .cnode rect {
    fill: var(--sheet);
    stroke: var(--rule-2);
  }
  .cnode.on rect {
    stroke: var(--signal);
    stroke-width: 2;
  }
  .cnode text {
    font: 600 13px var(--font-ui);
    fill: var(--ink);
  }
  .cnode .k {
    font-size: 10px;
    fill: var(--ink-3);
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 10px;
  }
  .word {
    display: grid;
  }
  .word .field {
    width: 180px;
    height: 32px;
  }
  .field.invalid {
    border-color: var(--bad);
  }
  .warn {
    margin: 0;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--bad-soft);
    color: var(--bad);
    font-weight: 600;
  }
  .matrix {
    overflow-x: auto;
  }
  .matrix table {
    border-collapse: collapse;
    font-size: 13px;
  }
  .matrix caption {
    text-align: left;
    font: 700 11px var(--font-ui);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-3);
    padding-bottom: 6px;
  }
  .matrix th,
  .matrix td {
    padding: 4px 10px;
    border: 1px solid var(--rule);
    text-align: center;
    white-space: nowrap;
  }
  .matrix th {
    font-family: var(--font-math);
    font-style: italic;
    font-weight: 400;
    background: var(--paper-2);
  }
  .matrix td.ok {
    color: var(--ok);
    background: var(--ok-soft);
    font-weight: 700;
  }
  .matrix td.bad {
    color: var(--bad);
    background: var(--bad-soft);
  }
  .matrix td.self {
    color: var(--ink-3);
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
    gap: 14px;
  }
  .card {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    border: 1px solid var(--rule);
    border-radius: 14px;
    background: var(--sheet);
    box-shadow: var(--shadow);
    min-height: 260px;
    overflow: hidden;
  }
  .card.active {
    border-color: var(--ink-2);
  }
  .card.stale {
    border-color: var(--warn);
  }
  .card header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px 4px;
  }
  .kind {
    font: 700 10.5px var(--font-ui);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-3);
  }
  .name {
    border: none;
    background: none;
    padding: 0;
    font: 600 15px var(--font-ui);
    color: var(--ink);
    cursor: pointer;
  }
  .name:hover {
    text-decoration: underline;
  }
  .verdict {
    margin-left: auto;
    font-weight: 700;
    font-size: 12.5px;
  }
  .verdict.ok {
    color: var(--ok);
  }
  .verdict.bad {
    color: var(--bad);
  }
  .origin {
    margin: 0;
    padding: 0 12px 4px;
    font-size: 12px;
    color: var(--ink-3);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .tag {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--warn);
    border: 1px solid var(--warn);
    border-radius: 4px;
    padding: 0 5px;
  }
  .small {
    padding: 2px 8px;
    font-size: 12px;
  }
  .body {
    min-height: 0;
  }
  .body.graph {
    height: 240px;
    padding: 4px;
  }
</style>
