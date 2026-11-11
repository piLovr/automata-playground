<script lang="ts">
  // Regulärer Ausdruck als Text; Teilausdrücke lassen sich zeigen und hervorheben.
  import { printRegex, regexSpans, type ExprPath, type RegExpr } from '../../core/index';

  let {
    expr,
    strict = false,
    highlight = new Set<string>(),
    onhover,
    size = 'md',
  }: {
    expr: RegExpr | null;
    strict?: boolean;
    /** Pfade als "0.1" ("" = ganzer Ausdruck). */
    highlight?: Set<string>;
    onhover?: (path: ExprPath | null) => void;
    size?: 'sm' | 'md' | 'lg';
  } = $props();

  const text = $derived(expr ? printRegex(expr, { strict }) : '');
  const spans = $derived(expr ? regexSpans(expr, { strict }) : []);
  /** Zeichen des gedruckten Texts als Codepoint-Liste mit Offsets (Spans zählen UTF-16). */
  const chars = $derived.by(() => {
    const out: { ch: string; at: number }[] = [];
    let at = 0;
    for (const ch of text) {
      out.push({ ch, at });
      at += ch.length;
    }
    return out;
  });

  /** Tiefster Teilausdruck, der die Stelle enthält. */
  function deepestAt(at: number): ExprPath | null {
    let best: { path: ExprPath; len: number } | null = null;
    for (const s of spans) {
      if (at >= s.from && at < s.to && (!best || s.to - s.from < best.len)) best = { path: s.path, len: s.to - s.from };
    }
    return best?.path ?? null;
  }

  const lit = $derived.by(() => {
    const on = new Set<number>();
    for (const s of spans) {
      if (!highlight.has(s.path.join('.'))) continue;
      for (let i = s.from; i < s.to; i++) on.add(i);
    }
    return on;
  });

  const OPS = new Set(['|', '*', '(', ')', '∅']);
</script>

<span class="rx {size}" role="presentation" onpointerleave={() => onhover?.(null)}>
  {#if expr === null}
    <span class="none">—</span>
  {:else}
    {#each chars as c, i (i)}<span
        class:op={OPS.has(c.ch)}
        class:on={lit.has(c.at)}
        onpointerenter={() => onhover?.(deepestAt(c.at))}
        role="presentation">{c.ch}</span
      >{/each}
  {/if}
</span>

<style>
  .rx {
    font-family: var(--font-mono);
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--ink);
  }
  .rx.sm {
    font-size: 13px;
  }
  .rx.md {
    font-size: 16px;
  }
  .rx.lg {
    font-size: clamp(20px, 3vw, 30px);
    letter-spacing: 0.02em;
  }
  .op {
    color: var(--ink-3);
  }
  .on {
    background: var(--signal-soft);
    color: var(--signal);
    box-shadow: 0 2px 0 var(--signal);
  }
  .op.on {
    color: var(--signal);
  }
  .none {
    color: var(--ink-3);
  }
</style>
