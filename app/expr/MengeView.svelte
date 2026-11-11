<script lang="ts">
  // Endliche Sprachen (Kapitel 1): Mengen eingeben und mit dem Sprachrechner verknüpfen
  // (Produkt, Vereinigung, Potenz, L*, L+ nach 1.6–1.9).
  import { evalLang, freshName, type MengeObj, type Word } from '../../core/index';
  import { store } from '../lib/store.svelte';
  import { diagnosticText, parseInputWord, showWord, splitUnescaped } from '../lib/format';
  import { t } from '../i18n';

  const obj = $derived(store.obj as MengeObj);

  let text = $state('');
  let error = $state('');
  let lastName = '';
  let lastRev = -1;
  const toInput = (w: Word): string => (w.length === 0 ? 'ε' : w.map((s) => (s.length > 1 ? `<${s}>` : /[,\\<\s]/u.test(s) ? `\\${s}` : s)).join(''));

  $effect(() => {
    const rev = store.externalRevision;
    if (obj.name !== lastName || rev !== lastRev) {
      lastName = obj.name;
      lastRev = rev;
      text = obj.words.map(toInput).join(', ');
      error = '';
    }
  });

  function onInput(): void {
    const parts = splitUnescaped(text);
    const words: Word[] = [];
    for (const p of parts) {
      const w = parseInputWord(p);
      if (!w) {
        error = t('error.word');
        return;
      }
      if (!words.some((x) => x.join('\u0000') === w.join('\u0000') && x.length === w.length)) words.push(w);
    }
    error = '';
    const alphabet = [...new Set(words.flat())];
    const key = (w: Word): string => w.map((s) => String(alphabet.indexOf(s)).padStart(4, '0')).join('');
    words.sort((a, b) => a.length - b.length || key(a).localeCompare(key(b)));
    store.updateAny((o) => (o.kind === 'menge' ? { ...o, words, alphabet, upTo: undefined } : o), 'menge');
  }

  /** Wörter nach Länge gruppiert, wie man Mengen in Kapitel 1 liest. */
  const byLength = $derived.by(() => {
    const m = new Map<number, Word[]>();
    for (const w of obj.words) (m.get(w.length) ?? m.set(w.length, []).get(w.length)!).push(w);
    return [...m.entries()];
  });

  // Sprachrechner
  let expr = $state('');
  let maxLen = $state(6);
  const calc = $derived.by(() => {
    if (expr.trim() === '') return null;
    try {
      return evalLang(expr, store.doc, { maxLen });
    } catch (e) {
      return { result: null, diagnostics: [], steps: [], crash: e instanceof Error ? e.message : String(e) };
    }
  });
  const calcError = $derived(calc?.diagnostics.find((d) => d.severity === 'error'));
  const truncated = $derived(calc?.diagnostics.find((d) => d.code === 'lang.truncated'));

  function adopt(): void {
    const r = calc?.result;
    if (!r) return;
    const name = freshName(store.doc.objects.map((o) => o.name), 'L');
    store.insertObject({ ...r, name });
    store.notify(t('proc.created', { name }));
  }
</script>

<div class="m-stage">
  <div class="editor">
    <label class="eyebrow" for="m-input">{t('menge.words')}</label>
    <div class="line" class:bad={!!error}>
      <span class="lhs math">{obj.name} = &#123;</span>
      <input id="m-input" class="mono" bind:value={text} oninput={onInput} spellcheck="false" autocomplete="off" placeholder="01, 1, ε" aria-label={t('menge.input')} />
      <span class="lhs math">&#125;</span>
    </div>
    {#if error}<p class="err" role="alert">{error}</p>{/if}
  </div>

  <div class="set" aria-label={obj.name}>
    {#if obj.words.length === 0}
      <p class="muted">{t('menge.empty')}</p>
    {:else}
      {#each byLength as [len, ws] (len)}
        <div class="group">
          <span class="len">|w| = {len}</span>
          <span class="ws">{#each ws as w, i (i)}<span class="w mono">{showWord(w)}</span>{/each}</span>
        </div>
      {/each}
      <p class="muted">|{obj.name}| = {obj.words.length}{#if obj.upTo !== undefined} · {t('menge.upTo', { n: obj.upTo })}{/if}</p>
    {/if}
  </div>

  <section class="calc">
    <p class="eyebrow">{t('menge.calc')} <span class="ref">1.6–1.9</span></p>
    <p class="hint">{t('menge.calcHint')}</p>
    <div class="row">
      <input class="mono expr" bind:value={expr} placeholder="L1 L2" spellcheck="false" aria-label={t('menge.calc')} />
      <label class="len-in">{t('lang.maxLen')} <input type="number" min="0" max="20" bind:value={maxLen} /></label>
    </div>
    {#if calc}
      {#if calcError}
        <p class="err">{diagnosticText(calcError)}</p>
      {:else if 'crash' in calc}
        <p class="err">{calc.crash}</p>
      {:else if calc.result}
        <p class="result mono">
          = {calc.result.words.length === 0 ? '∅' : `{${calc.result.words.map(showWord).join(', ')}}`}
        </p>
        <p class="muted">
          |…| = {calc.result.words.length}{#if truncated}&nbsp;· {t('menge.upTo', { n: maxLen })}{/if}
        </p>
        <button class="btn primary" onclick={adopt}>{t('menge.adopt')}</button>
      {/if}
    {/if}
  </section>
</div>

<style>
  .m-stage {
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
    gap: 8px;
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
    font-size: 20px;
    padding: 6px 0;
    color: var(--ink);
  }
  .err {
    margin: 0;
    color: var(--bad);
  }
  .muted {
    margin: 0;
    color: var(--ink-3);
    font-size: 13px;
  }
  .set {
    display: grid;
    gap: 6px;
  }
  .group {
    display: flex;
    gap: 14px;
    align-items: baseline;
  }
  .len {
    min-width: 5.5em;
    font-size: 12px;
    color: var(--ink-3);
    font-family: var(--font-math);
    font-style: italic;
  }
  .ws {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .w {
    padding: 2px 8px;
    border: 1px solid var(--rule-2);
    border-radius: 6px;
    font-size: 16px;
  }
  .calc {
    display: grid;
    gap: 8px;
    padding: 16px;
    border: 1px solid var(--rule);
    border-radius: 14px;
    background: var(--paper);
    max-width: 900px;
  }
  .hint {
    margin: 0;
    font-size: 12.5px;
    color: var(--ink-2);
  }
  .ref {
    font: 500 11px var(--font-mono);
    color: var(--ink-3);
    text-transform: none;
  }
  .row {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }
  .expr {
    flex: 1;
    min-width: 200px;
    padding: 8px 10px;
    border: 1px solid var(--rule-2);
    border-radius: 8px;
    background: var(--sheet);
    color: var(--ink);
    font-size: 17px;
  }
  .len-in {
    font-size: 13px;
    color: var(--ink-2);
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .len-in input {
    width: 4em;
    padding: 4px 6px;
    border: 1px solid var(--rule-2);
    border-radius: 6px;
    background: var(--sheet);
    color: var(--ink);
  }
  .result {
    margin: 0;
    font-size: 17px;
    word-break: break-word;
  }
  .calc .btn {
    justify-self: start;
  }
</style>
