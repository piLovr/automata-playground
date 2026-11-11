<script lang="ts">
  // Untere Leiste im Schrittmodus: Steuerung, Erklärung je Schritt, Übernehmen.
  import { procs } from '../lib/procs.svelte';
  import { METHODS } from '../lib/methods';
  import { explainProc } from '../lib/explain';
  import { t } from '../i18n';

  const s = $derived(procs.session!);
  const steps = $derived(procs.steps);
  const last = $derived(steps.length - 1);
  const atEnd = $derived(procs.index >= last);
  const info = $derived(METHODS[s.method]);
  const text = $derived(procs.step ? explainProc(procs.step, s.sourceObjs) : '');

  function togglePlay(): void {
    if (!procs.playing && atEnd) procs.go(0);
    procs.playing = !procs.playing;
  }

  $effect(() => {
    if (!procs.playing) return;
    const id = setInterval(() => {
      if (procs.index >= procs.steps.length - 1) procs.playing = false;
      else procs.go(procs.index + 1);
    }, 1000 / procs.speed);
    return () => clearInterval(id);
  });

  function onKey(e: KeyboardEvent): void {
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '.' || e.key === 'ArrowRight') procs.go(procs.index + 1);
    else if (e.key === ',' || e.key === 'ArrowLeft') procs.go(procs.index - 1);
    else if (e.key === 'Home') procs.go(0);
    else if (e.key === 'End') procs.go(last);
    else if (e.key === 'p') togglePlay();
    else if (e.key === 'Escape') procs.close();
    else return;
    e.preventDefault();
  }
</script>

<svelte:window onkeydown={onKey} />

<section class="deck" aria-label={t('proc.player')}>
  <div class="top">
    <div class="title">
      <p class="eyebrow">{t('proc.player')} · {s.sources.join(', ')}</p>
      <h2>
        {t(`method.${s.method}`)}
        {#if info.ref}<span class="ref">{info.ref}</span>{:else}<span class="tag">{t('proc.notInScript')}</span>{/if}
      </h2>
    </div>

    <div class="controls" role="group" aria-label="Schrittsteuerung">
      <button class="btn icon ghost" onclick={() => procs.go(0)} disabled={procs.index === 0} title="{t('sim.first')} (Pos1)" aria-label={t('sim.first')}>
        <svg viewBox="0 0 16 16"><path d="M3 3v10M13 3 6 8l7 5z" /></svg>
      </button>
      <button class="btn icon ghost" onclick={() => procs.go(procs.index - 1)} disabled={procs.index === 0} title="{t('sim.back')} (,)" aria-label={t('sim.back')}>
        <svg viewBox="0 0 16 16"><path d="M11 3 4 8l7 5z" /></svg>
      </button>
      <button class="btn icon play" onclick={togglePlay} title="{procs.playing ? t('sim.pause') : t('sim.play')} (P)" aria-label={procs.playing ? t('sim.pause') : t('sim.play')}>
        {#if procs.playing}
          <svg viewBox="0 0 16 16"><path d="M5 3v10M11 3v10" class="thick" /></svg>
        {:else}
          <svg viewBox="0 0 16 16"><path d="M5 2.5 13 8l-8 5.5z" /></svg>
        {/if}
      </button>
      <button class="btn icon ghost" onclick={() => procs.go(procs.index + 1)} disabled={atEnd} title="{t('sim.forward')} (.)" aria-label={t('sim.forward')}>
        <svg viewBox="0 0 16 16"><path d="M5 3l7 5-7 5z" /></svg>
      </button>
      <button class="btn icon ghost" onclick={() => procs.go(last)} disabled={atEnd} title="{t('sim.last')} (Ende)" aria-label={t('sim.last')}>
        <svg viewBox="0 0 16 16"><path d="M13 3v10M3 3l7 5-7 5z" /></svg>
      </button>
      <label class="speed" title={t('sim.speed')}>
        <span class="visually-hidden">{t('sim.speed')}</span>
        <input type="range" min="0.5" max="6" step="0.5" bind:value={procs.speed} />
        <span class="mono">{procs.speed}×</span>
      </label>
      <span class="count mono">{t('proc.stepOf', { i: procs.index + 1, n: steps.length })}</span>
    </div>

    <div class="end">
      {#if s.result.ok}
        <button class="btn primary" onclick={() => procs.adopt()}>{t('proc.adopt')}</button>
      {/if}
      <button class="btn ghost" onclick={() => procs.close()} title="Esc">{t('proc.close')}</button>
    </div>
  </div>

  <p class="explain" aria-live="polite">{text}</p>

  <div class="timeline" role="group" aria-label={t('proc.steps')}>
    {#each { length: steps.length }, i (i)}
      <button class="dot" class:now={i === procs.index} class:past={i < procs.index} onclick={() => procs.go(i)} aria-label={t('proc.stepOf', { i: i + 1, n: steps.length })}></button>
    {/each}
  </div>
</section>

<style>
  .deck {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 18px 14px;
    background: var(--paper);
    border-top: 1px solid var(--rule);
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
  .top {
    display: flex;
    align-items: flex-end;
    gap: 18px;
    flex-wrap: wrap;
  }
  .title .eyebrow {
    margin: 0 0 2px;
  }
  h2 {
    margin: 0;
    font-size: 17px;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .ref {
    font: 500 12px var(--font-mono);
    color: var(--ink-3);
  }
  .tag {
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    padding: 1px 6px;
    border: 1px solid var(--rule-2);
    border-radius: 4px;
    color: var(--ink-2);
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
  .count {
    margin-left: 12px;
    font-size: 12px;
    color: var(--ink-3);
  }
  .end {
    margin-left: auto;
    display: flex;
    gap: 6px;
  }
  .explain {
    margin: 0;
    font-size: 15px;
    line-height: 1.5;
    max-width: 90ch;
    min-height: 3em;
  }
  .timeline {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    overflow: auto;
  }
  .dot {
    width: 12px;
    height: 12px;
    padding: 0;
    border-radius: 50%;
    border: 1.5px solid var(--ink-3);
    background: transparent;
    cursor: pointer;
  }
  .dot.past {
    background: var(--ink-3);
  }
  .dot.now {
    border-color: var(--signal);
    background: var(--signal);
    transform: scale(1.25);
  }
</style>
