<script lang="ts">
  import type { StateId, Word } from '../../core/index';
  import { store } from '../lib/store.svelte';
  import { sim } from '../lib/sim.svelte';
  import { explainText, showSet, showSym, stateName } from '../lib/format';
  import { t } from '../i18n';
  import NeaTree from './NeaTree.svelte';

  let { onhover }: { onhover: (s: StateId | null) => void } = $props();

  let view = $state<'sets' | 'tree'>('sets');

  // Ein neuer Lauf beginnt wieder auf dem Weg, den der Kern gewählt hat.
  $effect(() => {
    void sim.trace;
    sim.branch = null;
  });

  const obj = $derived(store.aut);
  const trace = $derived(sim.trace);
  const word = $derived<Word>(sim.parsed.word ?? []);
  const last = $derived(sim.steps.length ? sim.steps.length - 1 : 0);
  const kind = $derived(obj?.kind ?? 'dea');
  const isNea = $derived(kind === 'nea');

  function go(i: number): void {
    store.simStep = Math.max(0, Math.min(last, i));
    if (store.simStep >= last) store.simPlaying = false;
  }

  function togglePlay(): void {
    if (!trace) return;
    if (!store.simPlaying && sim.atEnd) store.simStep = 0;
    store.simPlaying = !store.simPlaying;
  }

  $effect(() => {
    if (!store.simPlaying) return;
    const id = setInterval(() => {
      if (sim.atEnd) store.simPlaying = false;
      else store.simStep = sim.index + 1;
    }, 1000 / store.simSpeed);
    return () => clearInterval(id);
  });

  function onKey(e: KeyboardEvent): void {
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const free = store.selStates.length === 0;
    if (e.key === '.' || (free && e.key === 'ArrowRight')) go(sim.index + 1);
    else if (e.key === ',' || (free && e.key === 'ArrowLeft')) go(sim.index - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(last);
    else if (e.key === 'p') togglePlay();
    else return;
    e.preventDefault();
  }

  /** Beim DEA hängt der letzte Schritt auf dem Symbol, das nicht gelesen werden konnte. */
  const headPos = $derived(sim.step ? Math.min(sim.step.pos, word.length) : 0);
  const stuckAt = $derived(trace?.result === 'stuck' && sim.atEnd && !isNea ? (sim.step?.pos ?? 0) - 1 : -1);

  const resultTone = $derived(
    !trace ? '' : trace.result === 'accepted' ? 'ok' : trace.result === 'limit' || trace.result === 'bound' ? 'warn' : trace.result === 'done' ? 'neutral' : 'bad',
  );
  const GLYPH = { accepted: '✓', rejected: '✗', stuck: '⊘', limit: '…', done: '■', bound: '⇥' } as const;

  /** TM: Band des aktuellen Schritts mit einem Blank Rand links und rechts. */
  const tape = $derived.by(() => {
    const tv = sim.step?.tape;
    if (obj?.kind !== 'tm' || !tv) return null;
    const blank = obj.blank;
    const cells = [blank, ...tv.cells, blank];
    return { cells, origin: tv.origin - 1, head: tv.head, bounds: tv.bounds ?? null };
  });

  /** Konfiguration der TM als Text „u z v“ (Zustand vor dem Feld unter dem Kopf). */
  function tmConfig(i: number): { left: string; state: string; right: string } | null {
    const st = sim.steps[i];
    const tv = st?.tape;
    if (!tv || obj?.kind !== 'tm') return null;
    const k = tv.head - tv.origin;
    const cells = tv.cells.map(showSym);
    while (k >= cells.length) cells.push(showSym(obj.blank));
    const leftCells = k < 0 ? [] : cells.slice(0, k);
    const rightCells = k < 0 ? [...Array(-k).fill(showSym(obj.blank)), ...cells] : cells.slice(k);
    return { left: leftCells.join(''), state: stateName(obj, st.active[0] ?? ''), right: rightCells.join('') };
  }
</script>

<svelte:window onkeydown={onKey} />

<section class="deck" aria-label="Simulation">
  <div class="top">
    <label class="word">
      <span class="eyebrow">{t('sim.word')}</span>
      <input
        class="field mono"
        class:invalid={sim.parsed.error}
        value={store.word}
        oninput={(e) => (store.word = e.currentTarget.value)}
        placeholder={t('sim.wordPlaceholder')}
        spellcheck="false"
        aria-invalid={sim.parsed.error}
      />
    </label>

    <div class="controls" role="group" aria-label="Schrittsteuerung">
      <button class="btn icon ghost" onclick={() => go(0)} disabled={!trace || sim.index === 0} title="{t('sim.first')} (Pos1)" aria-label={t('sim.first')}>
        <svg viewBox="0 0 16 16"><path d="M3 3v10M13 3 6 8l7 5z" /></svg>
      </button>
      <button class="btn icon ghost" onclick={() => go(sim.index - 1)} disabled={!trace || sim.index === 0} title="{t('sim.back')} (,)" aria-label={t('sim.back')}>
        <svg viewBox="0 0 16 16"><path d="M11 3 4 8l7 5z" /></svg>
      </button>
      <button class="btn icon play" onclick={togglePlay} disabled={!trace} title="{store.simPlaying ? t('sim.pause') : t('sim.play')} (P)" aria-label={store.simPlaying ? t('sim.pause') : t('sim.play')}>
        {#if store.simPlaying}
          <svg viewBox="0 0 16 16"><path d="M5 3v10M11 3v10" class="thick" /></svg>
        {:else}
          <svg viewBox="0 0 16 16"><path d="M5 2.5 13 8l-8 5.5z" /></svg>
        {/if}
      </button>
      <button class="btn icon ghost" onclick={() => go(sim.index + 1)} disabled={!trace || sim.atEnd} title="{t('sim.forward')} (.)" aria-label={t('sim.forward')}>
        <svg viewBox="0 0 16 16"><path d="M5 3l7 5-7 5z" /></svg>
      </button>
      <button class="btn icon ghost" onclick={() => go(last)} disabled={!trace || sim.atEnd} title="{t('sim.last')} (Ende)" aria-label={t('sim.last')}>
        <svg viewBox="0 0 16 16"><path d="M13 3v10M3 3l7 5-7 5z" /></svg>
      </button>
      <label class="speed" title={t('sim.speed')}>
        <span class="visually-hidden">{t('sim.speed')}</span>
        <input type="range" min="0.5" max="8" step="0.5" bind:value={store.simSpeed} />
        <span class="mono">{store.simSpeed}×</span>
      </label>
      <label class="limit" title={t('sim.limit')}>
        <span aria-hidden="true">≤</span>
        <span class="visually-hidden">{t('sim.limit')}</span>
        <input class="mono" type="number" min="10" max="1000000" step="100" bind:value={store.simLimit} />
      </label>
    </div>

    <div class="count mono">{trace ? t('sim.step', { i: sim.index, n: last }) : ''}</div>

    {#if trace}
      <div class="result {resultTone}" class:final={sim.atEnd} title={t(`result.${trace.result}.long`)}>
        <span class="glyph" aria-hidden="true">{GLYPH[trace.result]}</span>
        <span>{t(`result.${trace.result}`)}</span>
      </div>
    {:else if sim.parsed.error}
      <div class="result bad">{t('sim.wordError')}</div>
    {/if}
  </div>

  <div class="middle">
    {#if tape}
      <!-- Turingband: Kopf über dem aktuellen Feld, Bandpositionen darunter -->
      <div class="tape tm" aria-label="Band">
        {#each tape.cells as s, i (i)}
          {@const p = tape.origin + i}
          <div
            class="cell mono"
            class:head={p === tape.head}
            class:blank={obj?.kind === 'tm' && s === obj.blank}
            class:out={!!tape.bounds && (p < tape.bounds[0] || p > tape.bounds[1])}
            class:edge={!!tape.bounds && (p === tape.bounds[0] || p === tape.bounds[1])}
          >
            {showSym(s)}
            <span class="idx">{tape.origin + i}</span>
          </div>
        {/each}
      </div>
    {:else}
      <!-- Symbolband: gelesener Teil gedämpft, Kopf über dem nächsten Symbol -->
      <div class="tapes">
        <div class="tape" aria-label="Band">
          {#each word as s, i (i)}
            <div class="cell mono" class:read={i < headPos} class:head={i === headPos && !sim.atEnd} class:stuck={i === stuckAt}>
              {showSym(s)}
              <span class="idx">{i + 1}</span>
            </div>
          {/each}
          {#if word.length === 0}
            <div class="cell mono eps" class:read={true}>ε</div>
          {/if}
          <div class="cell end" class:head={headPos >= word.length && !sim.atEnd} aria-hidden="true"></div>
        </div>
        {#if (kind === 'mealy' || kind === 'moore') && sim.step}
          <div class="outrow" aria-label={t('sim.output')}>
            <span class="eyebrow">{t('sim.output')}</span>
            {#each sim.step.output ?? [] as s, i (i)}<span class="ocell mono" class:fresh={i === (sim.step.output?.length ?? 0) - 1 && sim.index > 0}>{showSym(s)}</span>{/each}
            {#if (sim.step.output ?? []).length === 0}<span class="ocell mono muted">ε</span>{/if}
          </div>
        {/if}
      </div>
    {/if}
    {#if kind === 'nka' && sim.step?.stack}
      <!-- Keller: oberstes Symbol oben -->
      <div class="stack" aria-label={t('sim.stack')}>
        <span class="eyebrow">{t('sim.stack')}</span>
        <div class="stack-cells">
          {#each sim.step.stack as s, i (i)}
            <div class="scell mono" class:top={i === 0}>{showSym(s)}</div>
          {/each}
          {#if sim.step.stack.length === 0}<div class="scell mono muted">leer</div>{/if}
        </div>
      </div>
    {/if}
    {#if sim.step && obj}
      <p class="explain">{explainText(obj, sim.step.explanation.key, sim.step.explanation.params)}</p>
    {:else if obj && !obj.start}
      <p class="explain muted">{t('sim.noStart')}</p>
    {/if}
  </div>

  {#if trace && obj}
    <div class="bottom">
      {#if kind === 'mealy' || kind === 'moore'}
        <div class="seq">
          <span class="label">{t('sim.output')}:</span>
          <span class="outword mono">{(trace.output ?? []).map(showSym).join('') || 'ε'}</span>
          <span class="note">{t(kind === 'moore' ? 'sim.moore.note' : 'sim.mealy.note')}</span>
        </div>
      {:else if kind === 'nka'}
        <div class="nea">
          <div class="tabs" role="tablist">
            <button role="tab" aria-selected={view === 'sets'} class:on={view === 'sets'} onclick={() => (view = 'sets')}>{t('sim.history')}</button>
            <button role="tab" aria-selected={view === 'tree'} class:on={view === 'tree'} onclick={() => (view = 'tree')}>{t('sim.configTree')}</button>
          </div>
          {#if view === 'sets'}
            <table class="hist">
              <thead><tr><th>{t('sim.readInput')}</th><th>{t('sim.state')}</th><th>{t('sim.stackContent')}</th></tr></thead>
              <tbody>
                {#each sim.steps as st, i (i)}
                  <tr class:now={i === sim.index} onclick={() => go(i)}>
                    <td class="mono">{word.slice(0, st.pos).map(showSym).join('') || 'ε'}</td>
                    <td class="math">{stateName(obj, st.active[0] ?? '')}</td>
                    <td class="mono">{(st.stack ?? []).map(showSym).join('')}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {:else}
            <NeaTree
              nodes={trace.tree ?? []}
              current={-1}
              selected={sim.branch}
              stackOf={true}
              {onhover}
              onselect={(id) => {
                sim.branch = id;
                store.simStep = 0;
                view = 'sets';
              }}
            />
          {/if}
        </div>
      {:else if kind === 'tm'}
        <div class="nea">
          <div class="counters">
            <span><strong class="mono">{sim.index}</strong> {t('sim.steps')}</span>
            <span><strong class="mono">{trace.visited ?? 0}</strong> {t('sim.visited')}</span>
          </div>
          <ol class="configs" start="0">
            {#each sim.steps.keys() as i (i)}
              {@const c = tmConfig(i)}
              {#if c}
                <li class:now={i === sim.index}>
                  <button onclick={() => go(i)}>
                    <span class="mono">{c.left}</span><span class="cstate math">{c.state}</span><span class="mono">{c.right}</span>
                  </button>
                </li>
              {/if}
            {/each}
          </ol>
        </div>
      {:else if !isNea}
        <div class="seq">
          <span class="math label">f**(z₀, w) =</span>
          {#each trace.stateSequence ?? [] as id, i (i)}
            <button class="chip math" class:now={i === sim.index} class:past={i < sim.index} onclick={() => go(i)} onmouseenter={() => onhover(id)} onmouseleave={() => onhover(null)}>
              {stateName(obj, id)}
            </button>
          {/each}
          {#if trace.result === 'stuck'}<span class="chip stuck" title={t('result.stuck.long')}>⊘</span>{/if}
          {#if sim.atEnd && trace.finalState}
            <span class="fstar math">f*(z₀, w) = <strong>{stateName(obj, trace.finalState)}</strong></span>
          {/if}
        </div>
      {:else}
        <div class="nea">
          <div class="tabs" role="tablist">
            <button role="tab" aria-selected={view === 'sets'} class:on={view === 'sets'} onclick={() => (view = 'sets')}>{t('sim.sets')}</button>
            <button role="tab" aria-selected={view === 'tree'} class:on={view === 'tree'} onclick={() => (view = 'tree')}>{t('sim.tree')}</button>
          </div>
          {#if view === 'sets'}
            <div class="sets">
              {#each trace.steps as st, i (i)}
                <button class="setcol" class:now={i === sim.index} class:empty={st.active.length === 0} onclick={() => go(i)}>
                  <span class="sym mono">{i === 0 ? '·' : showSym(word[i - 1] ?? '')}</span>
                  <span class="set math">{showSet(obj, st.active)}</span>
                </button>
              {/each}
            </div>
          {:else}
            <NeaTree nodes={trace.tree ?? []} current={sim.index} {onhover} />
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</section>

<style>
  .deck {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 18px 14px;
    background: var(--paper);
    border-top: 1px solid var(--rule);
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }
  .top {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    flex-wrap: wrap;
  }
  .word {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 0 1 280px;
    min-width: 160px;
  }
  .word .field {
    height: 34px;
    font-size: 15px;
  }
  .field.invalid {
    border-color: var(--bad);
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .controls svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linejoin: round;
  }
  .controls svg .thick {
    stroke-width: 2.6;
  }
  .btn.play {
    width: 38px;
    height: 34px;
    margin: 0 4px;
    background: var(--ink);
    border-color: var(--ink);
    color: var(--paper);
    border-radius: 10px;
  }
  .btn.play:hover:not(:disabled) {
    background: var(--signal);
    border-color: var(--signal);
    color: var(--signal-ink);
  }
  .speed {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: 10px;
    font-size: 12px;
    color: var(--ink-3);
  }
  .speed input {
    width: 80px;
    accent-color: var(--ink);
  }
  .limit {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: 8px;
    font-size: 13px;
    color: var(--ink-3);
  }
  .limit input {
    width: 68px;
    height: 26px;
    padding: 0 6px;
    border: 1px solid var(--rule);
    border-radius: 6px;
    background: var(--sheet);
    font-size: 12px;
  }
  .count {
    font-size: 12px;
    color: var(--ink-3);
    padding-bottom: 9px;
  }
  .result {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    padding: 0 14px;
    border-radius: 999px;
    font-weight: 650;
    border: 1.5px solid currentColor;
    opacity: 0.55;
    transition: opacity 0.2s;
  }
  .result.final {
    opacity: 1;
  }
  .result .glyph {
    font-size: 15px;
  }
  .result.ok {
    color: var(--ok);
    background: var(--ok-soft);
  }
  .result.bad {
    color: var(--bad);
    background: var(--bad-soft);
  }
  .result.neutral {
    color: var(--ink-2);
    background: var(--paper-2);
  }
  .result.warn {
    color: var(--warn);
    background: var(--warn-soft);
  }

  .tapes {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .outrow {
    display: flex;
    align-items: center;
    gap: 3px;
    padding-left: 2px;
  }
  .outrow .eyebrow {
    margin-right: 6px;
  }
  .ocell {
    display: inline-grid;
    place-items: center;
    min-width: 22px;
    height: 24px;
    border-radius: 5px;
    background: var(--paper-2);
    font-size: 14px;
  }
  .ocell.fresh {
    background: var(--signal);
    color: var(--signal-ink);
  }
  .muted {
    color: var(--ink-3);
  }
  .tape.tm .cell.blank {
    color: var(--ink-3);
  }
  /* LBA: außerhalb der n + 2 Felder schraffiert, Randfelder gestrichelt */
  .tape.tm .cell.out {
    background: repeating-linear-gradient(135deg, var(--paper-2) 0 4px, transparent 4px 8px);
    opacity: 0.7;
  }
  .tape.tm .cell.edge {
    outline: 1.5px dashed var(--ink-3);
    outline-offset: -3px;
  }
  .stack {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .stack-cells {
    display: flex;
    flex-direction: row;
    gap: 0;
  }
  .scell {
    display: grid;
    place-items: center;
    min-width: 28px;
    height: 32px;
    margin-right: -1.5px;
    border: 1.5px solid var(--ink-2);
    background: var(--sheet);
    font-size: 15px;
  }
  .scell.top {
    border-color: var(--signal);
    box-shadow: inset 0 3px 0 var(--signal);
    z-index: 1;
  }
  .outword {
    font-size: 16px;
    letter-spacing: 0.08em;
  }
  .note {
    margin-left: 12px;
    font-size: 12px;
    color: var(--ink-3);
  }
  .hist {
    border-collapse: collapse;
    font-size: 13px;
  }
  .hist th {
    padding: 2px 14px 4px 0;
    font-weight: 600;
    font-size: 11px;
    color: var(--ink-3);
    text-align: left;
  }
  .hist td {
    padding: 2px 14px 2px 0;
    border-top: 1px solid var(--rule);
    cursor: pointer;
  }
  .hist tr.now td {
    background: var(--signal-soft);
  }
  .counters {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex-shrink: 0;
    font-size: 12px;
    color: var(--ink-3);
  }
  .counters strong {
    color: var(--ink);
    font-size: 15px;
  }
  .configs {
    margin: 0;
    padding: 0 0 0 34px;
    columns: 3 220px;
    font-size: 13px;
  }
  .configs li {
    break-inside: avoid;
    color: var(--ink-3);
  }
  .configs button {
    border: 0;
    background: transparent;
    padding: 1px 4px;
    border-radius: 4px;
    color: var(--ink);
  }
  .configs li.now button {
    background: var(--signal-soft);
  }
  .cstate {
    margin: 0 3px;
    padding: 0 3px;
    border-radius: 3px;
    background: var(--paper-2);
    font-size: 14px;
  }
  .middle {
    display: flex;
    align-items: center;
    gap: 18px;
    min-width: 0;
  }
  .tape {
    display: flex;
    flex-shrink: 0;
    max-width: 60%;
    overflow-x: auto;
    padding: 6px 2px 14px;
  }
  .cell {
    position: relative;
    width: 34px;
    height: 38px;
    display: grid;
    place-items: center;
    margin-right: -1.5px;
    border: 1.5px solid var(--ink);
    background: var(--sheet);
    font-size: 17px;
    transition:
      background 0.15s,
      color 0.15s;
  }
  .cell:first-child {
    border-radius: 6px 0 0 6px;
  }
  .cell.end {
    width: 18px;
    border-style: dashed;
    border-left-style: solid;
    border-radius: 0 6px 6px 0;
    background: transparent;
  }
  .cell.read {
    color: var(--ink-3);
    background: var(--paper-2);
  }
  .cell.eps {
    font-style: italic;
  }
  .cell .idx {
    position: absolute;
    bottom: -15px;
    font-size: 9.5px;
    color: var(--ink-3);
  }
  .cell.head::before {
    content: '';
    position: absolute;
    top: -9px;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: var(--signal);
  }
  .cell.head {
    box-shadow: inset 0 -3px 0 var(--signal);
    z-index: 1;
  }
  .cell.stuck {
    background: var(--bad-soft);
    color: var(--bad);
    text-decoration: line-through;
  }
  .explain {
    margin: 0;
    color: var(--ink-2);
    font-size: 13.5px;
  }
  .explain.muted {
    color: var(--ink-3);
  }

  .bottom {
    min-height: 0;
    flex: 1;
    overflow: auto;
  }
  .seq {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
  }
  .seq .label {
    margin-right: 6px;
    color: var(--ink-2);
    font-size: 15px;
  }
  .chip {
    min-width: 30px;
    height: 28px;
    padding: 0 8px;
    border: 1.5px solid var(--rule-2);
    border-radius: 14px;
    background: var(--sheet);
    font-size: 15px;
  }
  .chip.past {
    border-color: var(--ink-3);
  }
  .chip.now {
    background: var(--signal);
    border-color: var(--signal);
    color: var(--signal-ink);
  }
  .chip.stuck {
    display: inline-grid;
    place-items: center;
    color: var(--bad);
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .fstar {
    margin-left: 14px;
    font-size: 15px;
    color: var(--ink-2);
  }
  .fstar strong {
    color: var(--ink);
  }

  .nea {
    display: flex;
    gap: 14px;
    min-height: 0;
    height: 100%;
  }
  .tabs {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex-shrink: 0;
  }
  .tabs button {
    height: 26px;
    padding: 0 10px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--ink-3);
    font-size: 12px;
    font-weight: 600;
    text-align: left;
  }
  .tabs button.on {
    background: var(--paper-2);
    color: var(--ink);
  }
  .sets {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    align-items: flex-start;
  }
  .setcol {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 5px 9px;
    border: 1.5px solid var(--rule);
    border-radius: 8px;
    background: var(--sheet);
  }
  .setcol .sym {
    font-size: 12px;
    color: var(--ink-3);
  }
  .setcol .set {
    font-size: 15px;
    white-space: nowrap;
  }
  .setcol.empty .set {
    color: var(--ink-3);
  }
  .setcol.now {
    border-color: var(--signal);
    box-shadow: 0 0 0 3px var(--signal-soft);
  }
</style>
