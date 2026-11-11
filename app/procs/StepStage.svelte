<script lang="ts">
  // Hauptfläche während eines schrittweisen Verfahrens: Zwischenstand, Klassen, Tabelle.
  import { isAutomaton, type ElemRef, type StateId } from '../../core/index';
  import { procs } from '../lib/procs.svelte';
  import { elemKey } from '../lib/corr';
  import ObjectView from '../expr/ObjectView.svelte';
  import { t } from '../i18n';

  const step = $derived(procs.step);
  const view = $derived(step?.view);
  const vobj = $derived(view?.obj);

  /** Klassennummer je Zustand aus der Partition ≡k. */
  const classes = $derived.by(() => {
    const m = new Map<StateId, number>();
    view?.partition?.classes.forEach((c, i) => c.forEach((id) => m.set(id, i)));
    return m;
  });

  let hover = $state<ElemRef | null>(null);
  const highlight = $derived.by(() => {
    const s = new Set<string>((view?.highlight ?? []).map(elemKey));
    for (const id of view?.set?.items ?? []) s.add(`z:${id}`);
    if (hover) s.add(elemKey(hover));
    return s;
  });
  /** Bei 2.82: Zustände außerhalb der Menge abblenden. */
  const dim = $derived.by(() => {
    if (!view?.set || !vobj || !isAutomaton(vobj)) return new Set<StateId>();
    const inSet = new Set(view.set.items);
    return new Set(vobj.states.filter((s) => !inSet.has(s.id)).map((s) => s.id));
  });
  const added = $derived(new Set(view?.added ?? []));

  const srcHl = $derived(step?.sourceHighlight);
  const srcObj = $derived(srcHl ? procs.session?.sourceObjs[srcHl.source] : undefined);
  const srcKeys = $derived(new Set((srcHl?.elems ?? []).map(elemKey)));

  /** Tabellenzeile → Klasse, wenn die Zeilenköpfe Zustandsnamen sind (Minimierung). */
  const rowClass = $derived.by(() => {
    const m = new Map<string, number>();
    if (!vobj || !isAutomaton(vobj) || !view?.partition) return m;
    for (const s of vobj.states) {
      const c = classes.get(s.id);
      if (c !== undefined) m.set(s.name, c);
    }
    return m;
  });

  /** Positionen der Quelle nach Name, solange der Zwischenstand ihre Zustände behält. */
  const posHint = $derived.by(() => {
    const src = procs.session?.sourceObjs[0];
    if (!src || !isAutomaton(src)) return undefined;
    return new Map(src.states.filter((s) => s.pos).map((s) => [s.name, s.pos!]));
  });

  const sorted = (ids: StateId[]): StateId[] => {
    if (!vobj || !isAutomaton(vobj)) return ids;
    const at = new Map(vobj.states.map((s, i) => [s.id, i]));
    return [...ids].sort((a, b) => (at.get(a) ?? 0) - (at.get(b) ?? 0));
  };
  const nameOf = (id: StateId): string => (vobj && isAutomaton(vobj) ? (vobj.states.find((s) => s.id === id)?.name ?? id) : id);
</script>

<div class="stage-steps" class:withTable={!!view?.table && !!vobj}>
  {#if srcObj}
    <div class="source">
      <span class="eyebrow">{t('proc.source')} {srcObj.name}</span>
      <div class="src-view"><ObjectView obj={srcObj} highlight={srcKeys} compact /></div>
    </div>
  {/if}

  {#if vobj}
    <div class="main">
      <ObjectView obj={vobj} {posHint} {highlight} {classes} {added} {dim} onhover={(e) => (hover = e)} />
    </div>
  {/if}

  {#if view?.partition}
    <div class="partition" aria-label={t('proc.partition')}>
      <span class="eq">≡<sub>{view.partition.round}</sub></span>
      {#each view.partition.classes as c, i (i)}
        <span class="cls" style:--cls="var(--cls-{i % 8})"><b>{i + 1}</b> {`{${sorted(c).map(nameOf).join(', ')}}`}</span>
      {/each}
    </div>
  {/if}
  {#if view?.set}
    <div class="partition">
      <span class="eq">S<sub>{view.set.round}</sub> =</span>
      <span class="cls plain">{`{${sorted(view.set.items).map(nameOf).join(', ')}}`}</span>
    </div>
  {/if}

  {#if view?.table}
    {@const tb = view.table}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="corner">{tb.corner ?? ''}</th>
            {#each tb.colHead as h, j (j)}<th>{h}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each tb.rowHead as h, i (i)}
            {@const rc = rowClass.get(h)}
            <tr class:active={tb.activeRow === i}>
              <th style:--cls={rc !== undefined ? `var(--cls-${rc % 8})` : null} class:classed={rc !== undefined}>{h}</th>
              {#each tb.cells[i] ?? [] as c, j (j)}<td title={c.length > 60 ? c : undefined}>{c.length > 400 ? c.slice(0, 400) + ' …' : c}</td>{/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if !vobj && !view?.table}
    <p class="empty">{t('proc.noView')}</p>
  {/if}
</div>

<style>
  .stage-steps {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--sheet);
    overflow: hidden;
  }
  .stage-steps > * {
    flex: none;
  }
  .stage-steps > .main {
    flex: 1 1 0;
  }
  .stage-steps:not(:has(.main)) > .table-wrap {
    flex: 1 1 0;
  }
  .source {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--rule);
    background: var(--paper);
    overflow: hidden;
  }
  .source .eyebrow {
    margin: 0;
    white-space: nowrap;
  }
  .src-view {
    min-width: 0;
    flex: 1;
    height: 130px;
  }
  .main {
    min-height: 0;
    padding: 8px;
  }
  .partition {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-top: 1px solid var(--rule);
    font-family: var(--font-math);
  }
  .eq {
    font-size: 18px;
    font-style: italic;
  }
  .cls {
    padding: 2px 8px;
    border-radius: 999px;
    border: 2px solid var(--cls);
    background: color-mix(in srgb, var(--cls) 10%, var(--sheet));
    font-style: italic;
  }
  .cls b {
    font: 700 11px var(--font-ui);
    color: var(--cls);
    margin-right: 2px;
  }
  .cls.plain {
    border-color: var(--rule-2);
    background: none;
  }
  .table-wrap {
    overflow: auto;
    max-height: 40%;
    border-top: 1px solid var(--rule);
    padding: 8px 16px 12px;
  }
  .stage-steps:not(:has(.main)) .table-wrap {
    max-height: none;
  }
  table {
    border-collapse: collapse;
    font-family: var(--font-mono);
    font-size: 13px;
  }
  th,
  td {
    padding: 4px 10px;
    border: 1px solid var(--rule);
    text-align: left;
    vertical-align: top;
  }
  thead th {
    background: var(--paper-2);
    font-weight: 600;
  }
  tbody th {
    font-family: var(--font-math);
    font-style: italic;
    font-weight: 400;
    background: var(--paper);
    white-space: nowrap;
  }
  tbody th.classed {
    box-shadow: inset 4px 0 0 var(--cls);
  }
  td {
    max-width: 40ch;
    overflow-wrap: anywhere;
  }
  tr.active td,
  tr.active th {
    background: var(--signal-soft);
  }
  .empty {
    padding: 24px;
    color: var(--ink-3);
  }
</style>
