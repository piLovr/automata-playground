<script lang="ts">
  // Nur lesende Ansicht beliebiger Objekte (Schrittspieler, Arbeitsfläche).
  import { isAutomaton, type ElemRef, type FormalObject, type Point, type StateId, type TransitionId } from '../../core/index';
  import GraphView from '../graph/GraphView.svelte';
  import RegexText from './RegexText.svelte';
  import GrammarText from './GrammarText.svelte';
  import { statesOf } from '../lib/corr';

  let {
    obj,
    highlight = new Set<string>(),
    classes,
    added,
    dim,
    onhover,
    compact = false,
    posHint,
  }: {
    obj: FormalObject;
    /** Elementschlüssel (z:id, n:X, p:id, t:0.1). */
    highlight?: Set<string>;
    classes?: Map<StateId, number>;
    added?: Set<TransitionId>;
    dim?: Set<StateId>;
    onhover?: (e: ElemRef | null) => void;
    compact?: boolean;
    posHint?: Map<string, Point>;
  } = $props();

  const paths = $derived(new Set([...highlight].filter((k) => k.startsWith('t:')).map((k) => k.slice(2))));
</script>

{#if isAutomaton(obj)}
  <GraphView {obj} {posHint} highlight={statesOf(highlight)} {classes} {added} {dim} onhover={(id) => onhover?.(id ? { state: id } : null)} />
{:else if obj.kind === 'regex'}
  <div class="pad">
    <RegexText expr={obj.expr} highlight={paths} size={compact ? 'md' : 'lg'} onhover={(p) => onhover?.(p ? { subexpr: p } : null)} />
  </div>
{:else if obj.kind === 'menge'}
  <div class="pad mono egrep">{obj.words.length === 0 ? '∅' : `{${obj.words.map((w) => (w.length ? w.join('') : 'ε')).join(', ')}}`}</div>
{:else if obj.kind === 'egrep'}
  <div class="pad mono egrep">{obj.pattern}</div>
{:else}
  <div class="pad">
    <GrammarText g={obj} {highlight} size={compact ? 'sm' : 'md'} {onhover} />
  </div>
{/if}

<style>
  .egrep {
    font-size: 16px;
    word-break: break-all;
  }
  .pad {
    padding: 14px 16px;
    overflow: auto;
    max-height: 100%;
  }
</style>
