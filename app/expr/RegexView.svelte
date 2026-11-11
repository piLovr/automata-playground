<script lang="ts">
  // Hauptfläche für reguläre Ausdrücke: Eingabe mit Fehlern nach 2.22, Standard- und
  // strenge Form (2.21), Syntaxbaum. Zeigen auf Teilausdrücke hebt sie überall hervor.
  import { parseRegex, printRegex, regexSymbols, type ExprPath, type RegExpr, type RegexObj } from '../../core/index';
  import { store } from '../lib/store.svelte';
  import { hl } from '../lib/hl.svelte';
  import { diagnosticText } from '../lib/format';
  import RegexText from './RegexText.svelte';
  import { t } from '../i18n';

  const obj = $derived(store.obj as RegexObj);
  /** Alphabet folgt dem Ausdruck, solange es nicht ausdrücklich gesetzt ist. */
  const autoAlphabet = $derived(obj.expr === null || sameList(obj.alphabet, regexSymbols(obj.expr)));

  function sameList(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }

  let input: HTMLInputElement | undefined = $state();
  let text = $state('');
  let error = $state<{ msg: string; col: number } | null>(null);
  let lastName = '';
  let lastRev = -1;

  // Text aus dem Modell, wenn das Objekt wechselt oder sich von außen ändert.
  $effect(() => {
    const rev = store.externalRevision;
    if (obj.name !== lastName || rev !== lastRev) {
      lastName = obj.name;
      lastRev = rev;
      text = obj.expr ? printRegex(obj.expr) : '';
      error = null;
    }
  });

  function onInput(): void {
    const src = text;
    if (src.trim() === '') {
      error = null;
      store.updateAny((o) => (o.kind === 'regex' ? { ...o, expr: null, alphabet: autoAlphabet ? [] : o.alphabet } : o), 'regex');
      return;
    }
    const r = parseRegex(src, autoAlphabet ? null : obj.alphabet);
    const err = r.diagnostics.find((d) => d.severity === 'error');
    if (err || !r.expr) {
      error = err ? { msg: diagnosticText(err), col: err.col ?? 1 } : { msg: t('regex.invalid'), col: 1 };
      return;
    }
    error = null;
    const expr: RegExpr = r.expr;
    store.updateAny(
      (o) => (o.kind === 'regex' ? { ...o, expr, alphabet: autoAlphabet ? regexSymbols(expr) : o.alphabet } : o),
      'regex',
    );
  }

  function insert(s: string): void {
    if (!input) return;
    const a = input.selectionStart ?? text.length;
    const b = input.selectionEnd ?? text.length;
    text = text.slice(0, a) + s + text.slice(b);
    queueMicrotask(() => {
      input?.focus();
      input?.setSelectionRange(a + s.length, a + s.length);
    });
    onInput();
  }

  // Syntaxbaum: Blätter von links nach rechts, Eltern mittig darüber.
  interface TNode {
    path: ExprPath;
    label: string;
    x: number;
    y: number;
    kids: TNode[];
  }
  const tree = $derived.by(() => {
    if (!obj.expr) return null;
    let leaf = 0;
    let depth = 0;
    const build = (e: RegExpr, path: ExprPath, d: number): TNode => {
      depth = Math.max(depth, d);
      const kids: TNode[] = [];
      if (e.op === 'union' || e.op === 'concat') kids.push(build(e.left, [...path, 0], d + 1), build(e.right, [...path, 1], d + 1));
      if (e.op === 'star') kids.push(build(e.inner, [...path, 0], d + 1));
      const label = e.op === 'empty' ? '∅' : e.op === 'sym' ? (e.sym.length > 1 ? `⟨${e.sym}⟩` : e.sym) : e.op === 'union' ? '|' : e.op === 'concat' ? '·' : '*';
      const x = kids.length === 0 ? leaf++ : kids.reduce((s, k) => s + k.x, 0) / kids.length;
      return { path, label, x, y: d, kids };
    };
    const root = build(obj.expr, [], 0);
    return { root, width: Math.max(1, leaf), depth };
  });
  const all = $derived.by(() => {
    const out: TNode[] = [];
    const walk = (n: TNode): void => {
      out.push(n);
      n.kids.forEach(walk);
    };
    if (tree) walk(tree.root);
    return out;
  });

  /** Zeichen, die man aus egrep kennt, die hier aber gewöhnliche Symbole sind (2.21 kennt nur | * ( ) ∅). */
  const egrepChars = $derived([...new Set([...text].filter((c) => '^$.+?[]{}'.includes(c)))]);

  const DX = 44;
  const DY = 54;
  const mine = $derived(hl.keysFor(obj.name));
  const paths = $derived(new Set([...mine].filter((k) => k.startsWith('t:')).map((k) => k.slice(2))));
  const hover = (p: ExprPath | null): void => hl.set(obj.name, p ? { subexpr: p } : null);
</script>

<div class="rx-stage">
  <div class="editor">
    <label class="eyebrow" for="rx-input">{t('regex.input')}</label>
    <div class="line" class:bad={!!error}>
      <span class="lhs math">{obj.name} =</span>
      <input
        id="rx-input"
        bind:this={input}
        class="mono"
        bind:value={text}
        oninput={onInput}
        spellcheck="false"
        autocomplete="off"
        placeholder="(0|1)*01"
        aria-invalid={!!error}
        aria-describedby="rx-err"
      />
    </div>
    <div class="tools" role="toolbar" aria-label={t('regex.specials')}>
      {#each ['ε', '∅', '|', '*', '(', ')'] as c (c)}
        <button class="key mono" onclick={() => insert(c)} title={c === 'ε' ? t('regex.epsHint') : c === '∅' ? t('regex.emptyHint') : c}>{c}</button>
      {/each}
      <span class="hint">{t('regex.precedence')}</span>
    </div>
    {#if egrepChars.length && !error}
      <p class="note" role="note">{t('regex.egrepHint', { chars: egrepChars.join(' ') })}</p>
    {/if}
    {#if error}
      <p class="err" id="rx-err" role="alert"><span class="col mono">{t('regex.col', { col: error.col })}</span> {error.msg}</p>
    {/if}
  </div>

  {#if obj.expr}
    <div class="forms">
      <div class="form">
        <span class="eyebrow">{t('regex.standard')}</span>
        <RegexText expr={obj.expr} size="lg" highlight={paths} onhover={hover} />
      </div>
      <div class="form">
        <span class="eyebrow">{t('regex.strict')} <span class="ref">2.21</span></span>
        <RegexText expr={obj.expr} strict size="md" highlight={paths} onhover={hover} />
      </div>
    </div>

    {#if tree}
      <div class="tree" aria-label={t('regex.tree')}>
        <svg viewBox="{-DX / 2} {-24} {tree.width * DX} {(tree.depth + 1) * DY}" style:max-width="{tree.width * DX * 1.4}px" role="img" aria-label={t('regex.tree')}>
          {#each all as n (n.path.join('.'))}
            {#each n.kids as k (k.path.join('.'))}
              <line x1={n.x * DX} y1={n.y * DY} x2={k.x * DX} y2={k.y * DY} />
            {/each}
          {/each}
          {#each all as n (n.path.join('.'))}
            <g
              class="node"
              class:leaf={n.kids.length === 0}
              class:on={paths.has(n.path.join('.'))}
              transform="translate({n.x * DX} {n.y * DY})"
              onpointerenter={() => hover(n.path)}
              onpointerleave={() => hover(null)}
              role="presentation"
            >
              <circle r="15" />
              <text text-anchor="middle" dominant-baseline="central">{n.label}</text>
            </g>
          {/each}
        </svg>
      </div>
    {/if}
  {:else}
    <p class="empty">{t('regex.empty')}</p>
  {/if}
</div>

<style>
  .rx-stage {
    height: 100%;
    overflow: auto;
    background: var(--sheet);
    padding: 24px 28px 32px;
    display: grid;
    align-content: start;
    gap: 22px;
  }
  .editor {
    display: grid;
    gap: 8px;
    max-width: 900px;
  }
  .eyebrow {
    margin: 0;
  }
  .line {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    border: 1.5px solid var(--rule-2);
    border-radius: 12px;
    background: var(--state-fill);
  }
  .line:focus-within {
    border-color: var(--ink);
  }
  .line.bad {
    border-color: var(--bad);
  }
  .lhs {
    font-family: var(--font-math);
    font-style: italic;
    font-size: 22px;
    color: var(--ink-2);
    white-space: nowrap;
  }
  .line input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: 22px;
    padding: 6px 0;
    color: var(--ink);
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }
  .key {
    min-width: 32px;
    height: 30px;
    border: 1px solid var(--rule-2);
    border-radius: 6px;
    background: var(--sheet);
    color: var(--ink);
    font-size: 15px;
    cursor: pointer;
  }
  .key:hover {
    border-color: var(--ink);
  }
  .hint {
    margin-left: 10px;
    font-size: 12px;
    color: var(--ink-3);
  }
  .err {
    margin: 0;
    color: var(--bad);
  }
  .note {
    margin: 0;
    padding: 8px 12px;
    border-left: 3px solid var(--warn);
    background: var(--warn-soft);
    border-radius: 0 8px 8px 0;
    max-width: 72ch;
  }
  .err .col {
    font-size: 12px;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--bad-soft);
  }
  .forms {
    display: grid;
    gap: 14px;
  }
  .form {
    display: grid;
    gap: 4px;
  }
  .ref {
    font: 500 11px var(--font-mono);
    color: var(--ink-3);
    text-transform: none;
    letter-spacing: 0;
  }
  .tree svg {
    width: 100%;
    height: auto;
    overflow: visible;
  }
  .tree line {
    stroke: var(--rule-2);
    stroke-width: 1.5;
  }
  .node circle {
    fill: var(--paper-2);
    stroke: var(--ink-3);
    stroke-width: 1.2;
  }
  .node.leaf circle {
    fill: var(--state-fill);
    stroke: var(--select);
  }
  .node text {
    font: 600 14px var(--font-mono);
    fill: var(--ink);
    pointer-events: none;
  }
  .node.on circle {
    fill: var(--signal-soft);
    stroke: var(--signal);
    stroke-width: 2.4;
  }
  .empty {
    color: var(--ink-3);
  }
</style>
