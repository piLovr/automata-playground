<script lang="ts">
  import { edit, fromJSON, parseDocument, printDocument, toJSON, type StateId } from '../core/index';
  import { store } from './lib/store.svelte';
  import { sim } from './lib/sim.svelte';
  import { examples } from './lib/examples';
  import { diagnosticText, showSym, stateName } from './lib/format';
  import { t } from './i18n';
  import GraphEditor from './graph/GraphEditor.svelte';
  import TableEditor from './table/TableEditor.svelte';
  import TextEditor from './text/TextEditor.svelte';
  import SimDeck from './sim/SimDeck.svelte';
  import BatchPanel from './sim/BatchPanel.svelte';
  import Menu from './ui/Menu.svelte';

  store.init();

  let graph: ReturnType<typeof GraphEditor> | undefined = $state();
  let hover = $state<StateId | null>(null);
  const highlight = $derived(new Set(hover ? [hover] : []));
  let sideWidth = $state(440);
  let showKeys = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();

  const obj = $derived(store.obj);

  $effect(() => {
    const root = document.documentElement;
    if (store.theme === 'auto') root.removeAttribute('data-theme');
    else root.dataset.theme = store.theme;
  });

  // ---------------------------------------------------------------------------
  // Datei und Link

  function download(name: string, text: string, type: string): void {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function baseName(): string {
    return obj?.name ?? 'automaten';
  }

  async function openFile(e: Event): Promise<void> {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    (e.currentTarget as HTMLInputElement).value = '';
    if (!file) return;
    const text = await file.text();
    if (text.trimStart().startsWith('{') && /"version"/.test(text)) {
      const { doc, diagnostics } = fromJSON(text);
      if (!doc) {
        store.notify(diagnostics[0] ? diagnosticText(diagnostics[0]) : t('error.file'), 'error');
        return;
      }
      store.replaceDocument(doc);
    } else {
      const { doc, diagnostics } = parseDocument(text);
      const err = diagnostics.find((d) => d.severity === 'error');
      if (err || doc.objects.length === 0) {
        store.notify(err ? `Zeile ${err.line}: ${diagnosticText(err)}` : t('error.file'), 'error');
        return;
      }
      store.replaceDocument(doc);
    }
    requestAnimationFrame(() => graph?.fit());
  }

  async function share(): Promise<void> {
    const url = store.shareUrl();
    history.replaceState(null, '', url);
    try {
      await navigator.clipboard.writeText(url);
      store.notify(t('menu.shareCopied'));
    } catch {
      store.notify(t('menu.shareFailed'));
    }
  }

  function renameObject(): void {
    const name = prompt(t('prompt.objectName'), obj?.name ?? '');
    if (name === null) return;
    const clean = name.trim();
    if (!/^[\p{L}\p{N}_+'][\p{L}\p{N}_+'-]*$/u.test(clean)) {
      store.notify('Erlaubt: Buchstaben, Ziffern, _ + \' und -', 'error');
      return;
    }
    store.renameActive(clean);
  }

  function convert(): void {
    if (!obj) return;
    const target = obj.kind === 'dea' ? 'nea' : 'dea';
    if (!store.update((o) => edit.convertKind(o, target))) store.notify(t('error.convert'), 'error');
  }

  function addTrap(): void {
    store.update((o) => (o.kind === 'dea' ? edit.addTrapState(o).obj : o));
    requestAnimationFrame(() => graph?.layout());
  }

  // ---------------------------------------------------------------------------
  // Seitenleiste in der Breite ziehen

  function startResize(e: PointerEvent): void {
    const startX = e.clientX;
    const startW = sideWidth;
    const move = (ev: PointerEvent) => (sideWidth = Math.min(760, Math.max(300, startW - (ev.clientX - startX))));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function onKey(e: KeyboardEvent): void {
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    if (e.key === '?') {
      showKeys = !showKeys;
      e.preventDefault();
    }
  }

  const set = (items: string[]) => (items.length ? `{${items.join(', ')}}` : '∅');
  const missing = $derived(sim.diagnostics.some((d) => d.code === 'dea.missing'));
</script>

<svelte:window onkeydown={onKey} />

<div class="app" style:--side="{sideWidth}px">
  <!-- Kopfleiste -->
  <header class="top">
    <div class="brand" aria-label={t('app.title')}>
      <svg class="logo" viewBox="0 0 34 22" width="34" height="22" aria-hidden="true">
        <path d="M1 11h6" /><path d="M7 11l-3-2.2v4.4z" class="f" />
        <circle cx="13" cy="11" r="5.5" />
        <path d="M18.5 11h5" />
        <circle cx="28" cy="11" r="5" /><circle cx="28" cy="11" r="2.8" class="f" />
      </svg>
      <span class="name">Automaten<span class="dash">-</span>Playground</span>
    </div>

    <nav class="objects" aria-label="Objekte">
      {#each store.doc.objects as o, i (i)}
        <button class="obj" class:on={i === store.active} onclick={() => store.setActive(i)} ondblclick={renameObject}>
          <span class="kind">{t(`kind.${o.kind}`)}</span>
          <span class="oname">{o.name}</span>
        </button>
      {/each}
    </nav>
    <Menu title={t('menu.new')}>
      {#snippet label()}<span class="plus">+</span>{/snippet}
      {#snippet children(close)}
        <button class="item" onclick={() => (store.addObject('dea'), close())}>{t('menu.new.dea')}</button>
        <button class="item" onclick={() => (store.addObject('nea'), close())}>{t('menu.new.nea')}</button>
        <hr />
        {#each examples as ex (ex.id)}
          <button class="item" onclick={() => (store.loadExample(ex.id), close())}>
            <span class="ref">{ex.ref}</span>{ex.title}
          </button>
        {/each}
      {/snippet}
    </Menu>

    <div class="actions">
      <button class="btn ghost icon" onclick={() => store.undo()} disabled={!store.canUndo} title="{t('menu.undo')} (Strg+Z)" aria-label={t('menu.undo')}>
        <svg viewBox="0 0 16 16"><path d="M5 4 2 7l3 3" /><path d="M2 7h7.5a4 4 0 0 1 0 8H7" /></svg>
      </button>
      <button class="btn ghost icon" onclick={() => store.redo()} disabled={!store.canRedo} title="{t('menu.redo')} (Strg+Y)" aria-label={t('menu.redo')}>
        <svg viewBox="0 0 16 16"><path d="M11 4l3 3-3 3" /><path d="M14 7H6.5a4 4 0 0 0 0 8H9" /></svg>
      </button>
      <span class="divider"></span>
      <button class="btn ghost" onclick={() => fileInput?.click()}>{t('menu.open')}</button>
      <input bind:this={fileInput} type="file" accept=".txt,.json,.aut,text/plain,application/json" hidden onchange={openFile} />
      <Menu align="right">
        {#snippet label()}{t('menu.save')}{/snippet}
        {#snippet children(close)}
          <button class="item" onclick={() => (download(`${baseName()}.txt`, printDocument(store.doc), 'text/plain'), close())}>
            {t('menu.saveText')}
          </button>
          <button class="item" onclick={() => (download(`${baseName()}.json`, toJSON(store.doc), 'application/json'), close())}>
            {t('menu.saveJson')}
          </button>
        {/snippet}
      </Menu>
      <button class="btn primary" onclick={share}>
        <svg viewBox="0 0 16 16" width="14" height="14"><path d="M6.5 9.5l3-3" /><path d="M7 4.5 8.5 3a2.8 2.8 0 0 1 4 4L11 8.5M9 11.5 7.5 13a2.8 2.8 0 0 1-4-4L5 7.5" /></svg>
        {t('menu.share')}
      </button>
      <Menu align="right" title={t('menu.theme')}>
        {#snippet label()}<svg viewBox="0 0 16 16" aria-label={t('menu.theme')}><circle cx="8" cy="8" r="6" /><path d="M8 2a6 6 0 0 0 0 12z" class="fillc" /></svg>{/snippet}
        {#snippet children(close)}
          {#each ['auto', 'light', 'dark'] as const as th (th)}
            <button class="item" onclick={() => (store.setTheme(th), close())}>
              {t(`menu.theme.${th}`)}{#if store.theme === th}<span class="sub">✓</span>{/if}
            </button>
          {/each}
          <hr />
          <button class="item" onclick={() => ((showKeys = true), close())}>{t('keys.title')}<span class="sub">?</span></button>
        {/snippet}
      </Menu>
    </div>
  </header>

  <!-- Zeichenfläche -->
  <main class="stage">
    {#if obj}
      <GraphEditor bind:this={graph} {highlight} />

      <div class="palette" role="toolbar" aria-label="Werkzeuge">
        <button class="tool" aria-pressed={store.tool === 'select'} onclick={() => (store.tool = 'select')} title="{t('tool.select')} (V)">
          <svg viewBox="0 0 18 18"><path d="M4 2.5v12l3.3-3.2 2.2 4.7 2-1-2.1-4.6h4.6z" /></svg>
          <span class="visually-hidden">{t('tool.select')}</span>
        </button>
        <button class="tool" aria-pressed={store.tool === 'state'} onclick={() => (store.tool = 'state')} title="{t('tool.state')} (Z)">
          <svg viewBox="0 0 18 18"><circle cx="9" cy="9" r="6" /></svg>
          <span class="visually-hidden">{t('tool.state')}</span>
        </button>
        <button class="tool" aria-pressed={store.tool === 'edge'} onclick={() => (store.tool = 'edge')} title="{t('tool.edge')} (K)">
          <svg viewBox="0 0 18 18"><path d="M3 13.5C6 5 11 4 15 5.5" /><path d="M15.5 5.6l-4.2-2 .9 4.3z" class="f" /></svg>
          <span class="visually-hidden">{t('tool.edge')}</span>
        </button>
        <span class="sep"></span>
        <button class="tool" onclick={() => graph?.layout()} title="{t('tool.layout')} (L)">
          <svg viewBox="0 0 18 18"><circle cx="4" cy="9" r="2.2" /><circle cx="14" cy="4.5" r="2.2" /><circle cx="14" cy="13.5" r="2.2" /><path d="M6 8l6-2.6M6 10l6 2.6" /></svg>
          <span class="visually-hidden">{t('tool.layout')}</span>
        </button>
      </div>

      <div class="zoom" role="group" aria-label="Ansicht">
        <button class="tool" onclick={() => graph?.zoom(1 / 1.2)} title={t('tool.zoomOut')} aria-label={t('tool.zoomOut')}>−</button>
        <button class="tool" onclick={() => graph?.fit()} title="{t('tool.fit')} (0)" aria-label={t('tool.fit')}>
          <svg viewBox="0 0 18 18"><path d="M3 7V3h4M11 3h4v4M15 11v4h-4M7 15H3v-4" /></svg>
        </button>
        <button class="tool" onclick={() => graph?.zoom(1.2)} title={t('tool.zoomIn')} aria-label={t('tool.zoomIn')}>+</button>
      </div>

      <div class="obj-menu">
        <Menu align="right">
          {#snippet label()}<span class="kind-long">{t(`kind.${obj.kind}.long`)}</span>{/snippet}
          {#snippet children(close)}
            <button class="item" onclick={() => (renameObject(), close())}>{t('menu.rename')}</button>
            <button class="item" onclick={() => (convert(), close())}>{t(obj.kind === 'dea' ? 'menu.convert.nea' : 'menu.convert.dea')}</button>
            <hr />
            <button
              class="item danger"
              onclick={() => {
                close();
                if (confirm(t('confirm.delete', { name: obj.name }))) store.removeActive();
              }}>{t('menu.delete')}</button
            >
          {/snippet}
        </Menu>
      </div>
    {:else}
      <div class="nothing">
        <p>Noch kein Objekt.</p>
        <div class="row">
          <button class="btn primary" onclick={() => store.addObject('dea')}>{t('menu.new.dea')}</button>
          <button class="btn" onclick={() => store.addObject('nea')}>{t('menu.new.nea')}</button>
          <button class="btn" onclick={() => store.loadExample('b2-3')}>Beispiel 2.3</button>
        </div>
      </div>
    {/if}
  </main>

  <!-- Seitenleiste -->
  <div class="resizer" role="separator" aria-orientation="vertical" onpointerdown={startResize}></div>
  <aside class="side">
    {#if obj}
      <section class="definition" aria-label={t('panel.definition')}>
        <p class="tuple math">{t(obj.kind === 'dea' ? 'def.dea' : 'def.nea')}</p>
        <dl class="math">
          <dt>Z</dt>
          <dd>{set(obj.states.map((s) => s.name))}</dd>
          <dt>z₀</dt>
          <dd>{obj.start ? stateName(obj, obj.start) : '—'}</dd>
          <dt>X</dt>
          <dd class="mono-set">{set(obj.alphabet.map(showSym))}</dd>
          <dt>F</dt>
          <dd>{set(obj.accept.map((id) => stateName(obj, id)))}</dd>
        </dl>
      </section>

      <div class="tabs" role="tablist">
        {#each [['table', t('panel.table')], ['text', t('panel.text')], ['batch', t('panel.batch')]] as [id, label] (id)}
          <button role="tab" aria-selected={store.panel === id} class:on={store.panel === id} onclick={() => (store.panel = id as typeof store.panel)}>
            {label}
            {#if id === 'batch' && sim.batch.some((r) => r.res?.ok === false || r.res === null)}<span class="badge bad">!</span>{/if}
          </button>
        {/each}
      </div>

      <div class="panel">
        {#if store.panel === 'table'}
          <TableEditor />
        {:else if store.panel === 'text'}
          <TextEditor />
        {:else}
          <BatchPanel />
        {/if}
      </div>

      {#if sim.diagnostics.length}
        <section class="hints" aria-label={t('panel.hints')}>
          {#each sim.diagnostics as d, i (i)}
            <p class={d.severity}>
              <span class="sign" aria-hidden="true">{d.severity === 'error' ? '✕' : '⚠'}</span>
              <span>{diagnosticText(d, obj)}</span>
              {#if d.code === 'dea.missing' && missing}
                <button class="btn" onclick={addTrap}>{t('hint.trap')}</button>
              {/if}
            </p>
          {/each}
        </section>
      {/if}
    {/if}
  </aside>

  <!-- Simulation -->
  <footer class="deck">
    {#if obj}<SimDeck onhover={(s) => (hover = s)} />{/if}
  </footer>

  {#if store.toast}
    {#key store.toast.id}
      <div class="toast {store.toast.tone}" role="status">{store.toast.text}</div>
    {/key}
  {/if}

  {#if showKeys}
    <div class="scrim" role="presentation" onclick={() => (showKeys = false)}>
      <div class="keys" role="dialog" aria-modal="true" aria-label={t('keys.title')} tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && (showKeys = false)}>
        <h2>{t('keys.title')}</h2>
        <dl>
          <dt><span class="kbd">V</span> <span class="kbd">Z</span> <span class="kbd">K</span></dt>
          <dd>{t('keys.v')} · {t('keys.z')} · {t('keys.k')}</dd>
          <dt><span class="kbd">S</span></dt>
          <dd>{t('keys.s')}</dd>
          <dt><span class="kbd">A</span></dt>
          <dd>{t('keys.a')}</dd>
          <dt><span class="kbd">F2</span> <span class="kbd">↵</span></dt>
          <dd>{t('keys.f2')}</dd>
          <dt><span class="kbd">Entf</span></dt>
          <dd>{t('keys.del')}</dd>
          <dt><span class="kbd">Strg Z</span> <span class="kbd">Strg Y</span></dt>
          <dd>{t('keys.undo')}</dd>
          <dt><span class="kbd">Strg C</span> <span class="kbd">Strg V</span></dt>
          <dd>{t('keys.copy')}</dd>
          <dt><span class="kbd">Strg A</span></dt>
          <dd>{t('keys.all')}</dd>
          <dt><span class="kbd">L</span> <span class="kbd">0</span></dt>
          <dd>{t('keys.l')} · {t('keys.zero')}</dd>
          <dt><span class="kbd">←</span> <span class="kbd">→</span> <span class="kbd">↑</span> <span class="kbd">↓</span></dt>
          <dd>{t('keys.arrows')}</dd>
          <dt><span class="kbd">,</span> <span class="kbd">.</span> <span class="kbd">P</span></dt>
          <dd>{t('keys.sim')} · {t('sim.play')}</dd>
          <dt><span class="kbd">Leer</span></dt>
          <dd>{t('keys.pan')}</dd>
        </dl>
      </div>
    </div>
  {/if}
</div>

<style>
  .app {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 6px var(--side);
    grid-template-rows: 52px minmax(0, 1fr) 216px;
    grid-template-areas:
      'top top top'
      'stage resizer side'
      'deck deck side';
    height: 100vh;
    height: 100dvh;
  }

  /* Kopfleiste */
  .top {
    grid-area: top;
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 0 12px 0 16px;
    border-bottom: 1px solid var(--rule);
    background: var(--paper);
    min-width: 0;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .logo {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.5;
  }
  .logo .f {
    fill: var(--signal);
    stroke: none;
  }
  .brand .name {
    font-weight: 750;
    letter-spacing: -0.01em;
    font-size: 15px;
  }
  .brand .dash {
    color: var(--signal);
  }
  .objects {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .obj {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 32px;
    padding: 0 12px 0 6px;
    border: 1px solid transparent;
    border-radius: 9px;
    background: transparent;
    white-space: nowrap;
  }
  .obj:hover {
    background: var(--paper-2);
  }
  .obj.on {
    background: var(--sheet);
    border-color: var(--rule);
    box-shadow: var(--shadow);
  }
  .obj .kind {
    padding: 2px 5px;
    border-radius: 5px;
    background: var(--paper-2);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--ink-2);
  }
  .obj.on .kind {
    background: var(--ink);
    color: var(--paper);
  }
  .obj .oname {
    font-family: var(--font-math);
    font-style: italic;
    font-size: 15px;
  }
  .plus {
    font-size: 17px;
    line-height: 1;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    margin-left: auto;
  }
  .actions svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    width: 15px;
    height: 15px;
  }
  .actions :global(.fillc) {
    fill: currentColor;
    stroke: none;
  }
  .divider {
    width: 1px;
    height: 20px;
    margin: 0 4px;
    background: var(--rule);
  }

  /* Zeichenfläche */
  .stage {
    grid-area: stage;
    position: relative;
    min-height: 0;
    min-width: 0;
    background: var(--sheet);
  }
  .palette,
  .zoom {
    position: absolute;
    display: flex;
    gap: 2px;
    padding: 4px;
    border: 1px solid var(--rule);
    border-radius: 12px;
    background: var(--paper);
    box-shadow: var(--shadow);
  }
  .palette {
    top: 14px;
    left: 14px;
    flex-direction: column;
  }
  .zoom {
    bottom: 14px;
    left: 14px;
  }
  .tool {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--ink-2);
    font-size: 17px;
  }
  .tool svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linejoin: round;
  }
  .tool svg .f {
    fill: currentColor;
    stroke: none;
  }
  .tool:hover {
    background: var(--paper-2);
    color: var(--ink);
  }
  .tool[aria-pressed='true'] {
    background: var(--ink);
    color: var(--paper);
  }
  .palette .sep {
    height: 1px;
    margin: 3px 5px;
    background: var(--rule);
  }
  .obj-menu {
    position: absolute;
    top: 12px;
    right: 12px;
  }
  .kind-long {
    font-size: 12px;
    color: var(--ink-3);
  }
  .nothing {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    justify-items: center;
    color: var(--ink-3);
  }
  .nothing .row {
    display: flex;
    gap: 8px;
  }

  /* Seitenleiste */
  .resizer {
    grid-area: resizer;
    cursor: col-resize;
    background: var(--paper);
    border-left: 1px solid var(--rule);
  }
  .resizer:hover {
    background: var(--paper-2);
  }
  .side {
    grid-area: side;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--paper);
  }
  .definition {
    padding: 16px 18px 12px;
    border-bottom: 1px solid var(--rule);
  }
  .tuple {
    margin: 0 0 8px;
    font-size: 19px;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 10px;
    margin: 0;
    font-size: 15px;
  }
  dt {
    color: var(--ink-3);
  }
  dt::after {
    content: ' =';
  }
  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  dd.mono-set {
    font-family: var(--font-mono);
    font-style: normal;
    font-size: 13.5px;
  }
  .tabs {
    display: flex;
    gap: 2px;
    padding: 8px 12px 0;
    border-bottom: 1px solid var(--rule);
  }
  .tabs button {
    position: relative;
    height: 34px;
    padding: 0 12px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--ink-3);
    font-weight: 600;
    font-size: 13px;
    margin-bottom: -1px;
  }
  .tabs button:hover {
    color: var(--ink);
  }
  .tabs button.on {
    color: var(--ink);
    border-bottom-color: var(--signal);
  }
  .badge {
    display: inline-grid;
    place-items: center;
    width: 15px;
    height: 15px;
    margin-left: 4px;
    border-radius: 50%;
    font-size: 10px;
    color: #fff;
  }
  .badge.bad {
    background: var(--bad);
  }
  .panel {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .hints {
    border-top: 1px solid var(--rule);
    padding: 8px 16px 10px;
    max-height: 140px;
    overflow: auto;
  }
  .hints p {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin: 4px 0;
    font-size: 12.5px;
  }
  .hints .sign {
    font-weight: 700;
  }
  .hints .warning {
    color: var(--warn);
  }
  .hints .error {
    color: var(--bad);
  }
  .hints .btn {
    height: 24px;
    font-size: 12px;
    color: var(--ink);
  }

  .deck {
    grid-area: deck;
    min-height: 0;
    min-width: 0;
  }

  .toast {
    position: fixed;
    left: 50%;
    bottom: 232px;
    transform: translateX(-50%);
    z-index: 50;
    padding: 9px 16px;
    border-radius: 10px;
    background: var(--ink);
    color: var(--paper);
    box-shadow: var(--shadow);
    font-size: 13px;
    animation: rise 0.18s ease-out;
  }
  .toast.error {
    background: var(--bad);
    color: #fff;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translate(-50%, 6px);
    }
  }

  .scrim {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    background: rgba(18, 21, 27, 0.35);
  }
  .keys {
    width: min(520px, calc(100vw - 32px));
    padding: 20px 24px;
    border-radius: 14px;
    background: var(--sheet);
    box-shadow: var(--shadow);
  }
  .keys h2 {
    margin: 0 0 14px;
    font-size: 16px;
  }
  .keys dl {
    grid-template-columns: max-content 1fr;
    gap: 8px 16px;
    font-family: var(--font-ui);
    font-size: 13px;
  }
  .keys dt::after {
    content: '';
  }

  @media (max-width: 900px) {
    .top {
      flex-wrap: wrap;
      gap: 6px 10px;
      padding: 8px 10px;
    }
    .objects {
      order: 3;
      flex: 1 1 100%;
    }
    .app {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(360px, 60dvh) auto minmax(360px, auto);
      grid-template-areas: 'top' 'stage' 'deck' 'side';
      height: auto;
      min-height: 100dvh;
    }
    .resizer {
      display: none;
    }
    .brand .name {
      display: none;
    }
  }
</style>
