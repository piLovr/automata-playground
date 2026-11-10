<script lang="ts">
  import { onMount } from 'svelte';
  import { Annotation, EditorState } from '@codemirror/state';
  import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
  import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
  import { StreamLanguage, syntaxHighlighting, HighlightStyle, bracketMatching } from '@codemirror/language';
  import { setDiagnostics, lintGutter, type Diagnostic as CmDiagnostic } from '@codemirror/lint';
  import { tags } from '@lezer/highlight';
  import { parseDocument, printDocument, reconcile, validate, type Document } from '../../core/index';
  import { store, withLayout } from '../lib/store.svelte';
  import { diagnosticText } from '../lib/format';
  import { t } from '../i18n';

  let host: HTMLDivElement | undefined = $state();
  let view: EditorView | undefined;
  let errorCount = $state(0);
  let warnCount = $state(0);
  /** Zuletzt aus dem Modell geschriebener Text; Abweichung = Nutzer tippt. */
  let lastPrinted = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** Markiert Änderungen, die aus dem Modell kommen und nicht zurückgespielt werden. */
  const fromModel = Annotation.define<boolean>();

  // Hervorhebung der Textsprache. Zustandsnamen kursiv wie im Graphen.
  const KEYWORDS = new Set(['alphabet', 'states', 'start', 'accept', 'layout']);
  const KINDS = new Set(['dea', 'nea']);
  const language = StreamLanguage.define<{ inLabel: boolean; afterKind: boolean }>({
    startState: () => ({ inLabel: false, afterKind: false }),
    token(stream, st) {
      if (st.inLabel) {
        if (stream.match('->')) {
          st.inLabel = false;
          return 'operator';
        }
        if (stream.match(/^\\./u)) return 'escape';
        if (stream.match(/^<[\p{L}\p{N}_]+>/u)) return 'string';
        if (stream.eat(',')) return 'punctuation';
        if (stream.match(/^(ε|eps)(?=\s*(,|->))/u)) return 'atom';
        if (stream.match(/^\s+/)) return null;
        stream.next();
        return 'string';
      }
      if (stream.eatSpace()) return null;
      if (stream.peek() === '#') {
        stream.skipToEnd();
        return 'comment';
      }
      if (stream.match(/^\\./u)) return 'escape';
      if (stream.match(/^<[\p{L}\p{N}_]+>/u)) return 'string';
      if (stream.match(/^-(?!>)/)) {
        st.inLabel = true;
        return 'operator';
      }
      if (stream.match(/^[{}]/)) return 'brace';
      if (stream.match(/^@-?\d+(\.\d+)?,-?\d+(\.\d+)?/)) return 'number';
      const word = stream.match(/^[\p{L}\p{N}_+'][\p{L}\p{N}_+'-]*/u) as RegExpMatchArray | null;
      if (word) {
        const w = word[0];
        if (KINDS.has(w)) {
          st.afterKind = true;
          return 'keyword';
        }
        if (KEYWORDS.has(w)) return 'keyword';
        if (st.afterKind) {
          st.afterKind = false;
          return 'typeName';
        }
        return 'variableName';
      }
      stream.next();
      return null;
    },
    tokenTable: { escape: tags.escape, brace: tags.brace },
  });

  const highlight = HighlightStyle.define([
    { tag: tags.keyword, color: 'var(--ink)', fontWeight: '650' },
    { tag: tags.typeName, color: 'var(--signal)', fontWeight: '650' },
    { tag: tags.variableName, fontFamily: 'var(--font-math)', fontStyle: 'italic', fontSize: '1.08em' },
    { tag: tags.operator, color: 'var(--ink-3)' },
    { tag: tags.string, color: 'var(--select)' },
    { tag: tags.escape, color: 'var(--select)', fontWeight: '700' },
    { tag: tags.atom, color: 'var(--select)', fontStyle: 'italic' },
    { tag: tags.number, color: 'var(--ink-3)' },
    { tag: tags.comment, color: 'var(--ink-3)', fontStyle: 'italic' },
    { tag: tags.brace, color: 'var(--ink-2)' },
    { tag: tags.punctuation, color: 'var(--ink-3)' },
  ]);

  const theme = EditorView.theme({
    '&': { height: '100%', fontSize: '13.5px', background: 'transparent', color: 'var(--ink)' },
    '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.65' },
    '.cm-content': { padding: '12px 0', caretColor: 'var(--signal)' },
    '.cm-gutters': { background: 'transparent', border: 'none', color: 'var(--ink-3)' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 14px', fontSize: '11px' },
    '.cm-activeLine': { background: 'color-mix(in srgb, var(--paper-2) 70%, transparent)' },
    '&.cm-focused': { outline: 'none' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { background: 'var(--select-soft) !important' },
    '.cm-cursor': { borderLeftColor: 'var(--signal)', borderLeftWidth: '2px' },
    '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy var(--bad)', textUnderlineOffset: '3px' },
    '.cm-lintRange-warning': { backgroundImage: 'none', textDecoration: 'underline dotted var(--warn)', textUnderlineOffset: '3px' },
    '.cm-tooltip': { background: 'var(--sheet)', border: '1px solid var(--rule)', borderRadius: '8px', boxShadow: 'var(--shadow)' },
    '.cm-diagnostic': { fontFamily: 'var(--font-ui)', padding: '6px 10px' },
    '.cm-diagnostic-error': { borderLeftColor: 'var(--bad)' },
    '.cm-diagnostic-warning': { borderLeftColor: 'var(--warn)' },
  });

  function printed(): string {
    return printDocument(store.doc, { layout: store.showLayout });
  }

  /** Text → Modell. Bei Syntaxfehlern bleibt das Modell auf dem letzten gültigen Stand. */
  function sync(): void {
    if (!view) return;
    const text = view.state.doc.toString();
    const { doc, diagnostics } = parseDocument(text);
    const cm: CmDiagnostic[] = [];
    const lines = view.state.doc;
    const toOffset = (line?: number, col?: number) => {
      if (!line) return 0;
      const l = lines.line(Math.min(Math.max(1, line), lines.lines));
      return Math.min(l.to, l.from + Math.max(0, (col ?? 1) - 1));
    };
    for (const d of diagnostics) {
      const from = toOffset(d.line, d.col);
      cm.push({ from, to: Math.min(lines.length, from + Math.max(1, d.length ?? 1)), severity: d.severity, message: diagnosticText(d) });
    }
    errorCount = diagnostics.filter((d) => d.severity === 'error').length;

    if (errorCount === 0) {
      const prev = new Map(store.doc.objects.map((o) => [o.name, o]));
      const objects = doc.objects.map((o) => withLayout(reconcile(prev.get(o.name), o)));
      const next: Document = { version: 1, objects };
      // Modellwarnungen (z. B. fehlende DEA-Übergänge) an der Kopfzeile des Objekts zeigen.
      let w = 0;
      for (const o of objects) {
        const head = text.search(new RegExp(`^\\s*(dea|nea)\\s+${o.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'm'));
        for (const d of validate(o)) {
          w++;
          const from = head < 0 ? 0 : head + (text.slice(head).match(/^\s*/)?.[0].length ?? 0);
          cm.push({ from, to: Math.min(lines.length, from + 3 + o.name.length + 1), severity: d.severity, message: diagnosticText(d, o) });
        }
      }
      warnCount = w;
      const activeName = store.obj?.name;
      const idx = objects.findIndex((o) => o.name === activeName);
      lastPrinted = text;
      store.commit(next, { fromText: true, coalesce: 'text', active: idx >= 0 ? idx : Math.min(store.active, objects.length - 1) });
    }
    view.dispatch(setDiagnostics(view.state, cm));
  }

  onMount(() => {
    lastPrinted = printed();
    view = new EditorView({
      parent: host!,
      state: EditorState.create({
        doc: lastPrinted,
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          bracketMatching(),
          lintGutter(),
          language,
          syntaxHighlighting(highlight),
          theme,
          EditorView.lineWrapping,
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.contentAttributes.of({ 'aria-label': 'Textform', spellcheck: 'false' }),
          EditorView.updateListener.of((u) => {
            if (!u.docChanged || u.transactions.every((tr) => tr.annotation(fromModel))) return;
            if (timer) clearTimeout(timer);
            timer = setTimeout(sync, 280);
          }),
        ],
      }),
    });
    sync();
    return () => view?.destroy();
  });

  // Modell → Text, wenn die Änderung nicht aus diesem Editor kam.
  $effect(() => {
    void store.externalRevision;
    const text = printed();
    if (!view || text === lastPrinted) return;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    lastPrinted = text;
    const cur = view.state.doc.toString();
    if (cur === text) return;
    view.dispatch({ changes: { from: 0, to: cur.length, insert: text }, annotations: fromModel.of(true) });
    errorCount = 0;
    sync();
  });
</script>

<div class="wrap">
  <div class="bar">
    <span class="status" class:bad={errorCount > 0}>
      {#if errorCount > 0}
        <span class="dot" aria-hidden="true">●</span>{t('text.errors', { n: errorCount })}
      {:else}
        <span class="dot" aria-hidden="true">●</span>{t('text.ok')}{#if warnCount > 0}<span class="warns"> · {warnCount} ⚠</span>{/if}
      {/if}
    </span>
    <label class="toggle">
      <input type="checkbox" bind:checked={store.showLayout} />
      {t('text.layout')}
    </label>
  </div>
  <div class="editor" bind:this={host}></div>
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 14px;
    border-bottom: 1px solid var(--rule);
    font-size: 12px;
    color: var(--ink-2);
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .status .dot {
    color: var(--ok);
    font-size: 9px;
  }
  .status.bad {
    color: var(--bad);
  }
  .status.bad .dot {
    color: var(--bad);
  }
  .warns {
    color: var(--warn);
  }
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }
  .toggle input {
    accent-color: var(--ink);
  }
  .editor {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
</style>
