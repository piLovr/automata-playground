<script lang="ts">
  import { edit, freshName, parseWord, type FormalObject, type StateId, type Sym, type Word } from '../../core/index';
  import { store, withLayout } from '../lib/store.svelte';
  import { sim } from '../lib/sim.svelte';
  import { showSym, showWord, splitUnescaped } from '../lib/format';
  import { t } from '../i18n';

  const obj = $derived(store.obj);
  const isDea = $derived(obj?.kind === 'dea');

  /** Vom Nutzer angelegte Wortspalten (NEA), die noch keine Kante haben. */
  let extraWords = $state<Word[]>([]);
  let newSymbol = $state('');
  let newState = $state('');

  const wordKey = (w: Word) => JSON.stringify(w);

  /** Spalten: DEA = Alphabet; NEA = ε, Alphabet, dann benutzte Wörter der Länge ≥ 2. */
  const columns = $derived.by((): Word[] => {
    if (!obj) return [];
    const cols: Word[] = obj.alphabet.map((a) => [a]);
    if (obj.kind === 'dea') return cols;
    const seen = new Set(cols.map(wordKey));
    const out: Word[] = [[]];
    seen.add(wordKey([]));
    out.push(...cols);
    for (const tr of obj.transitions) {
      const w = tr.label as Word;
      if (!seen.has(wordKey(w))) {
        seen.add(wordKey(w));
        out.push(w);
      }
    }
    for (const w of extraWords) {
      if (!seen.has(wordKey(w))) {
        seen.add(wordKey(w));
        out.push(w);
      }
    }
    return out;
  });

  function nameOf(id: StateId): string {
    return obj?.states.find((s) => s.id === id)?.name ?? '?';
  }

  function cellTargets(o: FormalObject, from: StateId, w: Word): StateId[] {
    return o.transitions
      .filter((x) => x.from === from && (o.kind === 'dea' ? w.length === 1 && x.label === w[0] : wordKey(x.label as Word) === wordKey(w)))
      .map((x) => x.to);
  }

  function cellText(from: StateId, w: Word): string {
    return obj ? cellTargets(obj, from, w).map(nameOf).join(', ') : '';
  }

  /** Namen in IDs übersetzen; unbekannte Namen werden als neue Zustände angelegt. */
  function resolve(o: FormalObject, names: string[]): { o: FormalObject; ids: StateId[] } {
    const ids: StateId[] = [];
    for (const name of names) {
      const hit = o.states.find((s) => s.name === name);
      if (hit) ids.push(hit.id);
      else {
        const r = edit.addState(o, name);
        o = r.obj;
        ids.push(r.id);
      }
    }
    return { o, ids };
  }

  function setCell(from: StateId, w: Word, raw: string): void {
    const names = splitUnescaped(raw.replace(/[{}]/g, '')).map((s) => s.trim());
    if (!names.every((n) => /^[\p{L}\p{N}_+'][\p{L}\p{N}_+'-]*$/u.test(n))) {
      store.notify(`Ungültiger Zustandsname in „${raw}"`, 'error');
      return;
    }
    if (isDea && names.length > 1) {
      store.notify('Im DEA hat jede Zelle höchstens einen Zielzustand.', 'error');
      return;
    }
    store.update((o) => {
      const r = resolve(o, names);
      const next =
        r.o.kind === 'dea' ? edit.setDeaTarget(r.o, from, w[0]!, r.ids[0] ?? null) : edit.setNeaTargets(r.o, from, w, r.ids);
      return withLayout(next);
    });
  }

  function literalSymbol(raw: string): Sym | null {
    const s = raw.trim();
    if (s === '') return null;
    if ([...s].length === 1) return s;
    const { word, diagnostics } = parseWord(s);
    if (!diagnostics.some((d) => d.severity === 'error') && word.length === 1) return word[0]!;
    return /^[\p{L}\p{N}_]+$/u.test(s) ? s : null;
  }

  function addColumn(): void {
    const raw = newSymbol.trim();
    if (!raw || !obj) return;
    if (!isDea && (raw === 'ε' || raw === 'eps')) {
      newSymbol = '';
      return;
    }
    const sym = literalSymbol(raw);
    if (sym !== null) {
      if (!obj.alphabet.includes(sym)) store.update((o) => edit.setAlphabet(o, [...o.alphabet, sym]));
    } else if (!isDea) {
      const { word, diagnostics } = parseWord(raw);
      if (diagnostics.some((d) => d.severity === 'error')) {
        store.notify(`„${raw}" ist kein gültiges Wort.`, 'error');
        return;
      }
      extraWords = [...extraWords, word];
      const missing = word.filter((a) => !obj.alphabet.includes(a));
      if (missing.length) store.update((o) => edit.setAlphabet(o, [...o.alphabet, ...new Set(missing)]));
    } else {
      store.notify('Ein Symbol ist ein Zeichen oder ein Name wie zahl.', 'error');
      return;
    }
    newSymbol = '';
  }

  function removeSymbol(sym: Sym): void {
    store.update((o) => {
      const ids = o.transitions.filter((x) => (o.kind === 'dea' ? x.label === sym : (x.label as Word).includes(sym))).map((x) => x.id);
      return edit.setAlphabet(edit.removeTransitions(o, ids), o.alphabet.filter((a) => a !== sym));
    });
  }

  function addRow(): void {
    if (!obj) return;
    const name = newState.trim() || freshName(obj.states.map((s) => s.name), 'z');
    if (!/^[\p{L}\p{N}_+'][\p{L}\p{N}_+'-]*$/u.test(name)) {
      store.notify(`„${name}" ist kein gültiger Zustandsname.`, 'error');
      return;
    }
    if (obj.states.some((s) => s.name === name)) {
      store.notify(t('error.rename', { name }), 'error');
      return;
    }
    store.update((o) => {
      const r = edit.addState(o, name);
      return withLayout(o.start === null ? edit.setStart(r.obj, r.id) : r.obj);
    });
    newState = '';
  }

  function renameRow(id: StateId, raw: string, input: HTMLInputElement): void {
    const name = raw.trim();
    if (!name || name === nameOf(id)) {
      input.value = nameOf(id);
      return;
    }
    if (!store.update((o) => edit.renameState(o, id, name))) input.value = nameOf(id);
  }

  function commitOnEnter(e: KeyboardEvent): void {
    if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
    if (e.key === 'Escape') {
      const el = e.currentTarget as HTMLInputElement;
      el.value = el.defaultValue;
      el.blur();
    }
  }

  const activeSet = $derived(sim.active);
</script>

{#if obj}
  <div class="wrap">
    <div class="scroller">
      <table>
        <thead>
          <tr>
            <th class="corner">
              <span class="math">{isDea ? 'f' : 'g'}</span>
            </th>
            {#each columns as w (wordKey(w))}
              <th class="col" class:word={w.length !== 1}>
                <span class="mono">{showWord(w)}</span>
                {#if w.length === 1}
                  <button class="x" title={t('table.removeSymbol', { symbol: showSym(w[0]!) })} aria-label={t('table.removeSymbol', { symbol: showSym(w[0]!) })} onclick={() => removeSymbol(w[0]!)}>×</button>
                {/if}
              </th>
            {/each}
            <th class="add-col">
              <input
                class="mono"
                bind:value={newSymbol}
                placeholder="+"
                title={isDea ? t('table.addSymbol') : `${t('table.addSymbol')} / ${t('table.addWord')}`}
                aria-label={t('table.addSymbol')}
                onkeydown={(e) => e.key === 'Enter' && addColumn()}
                onblur={addColumn}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {#each obj.states as s (s.id)}
            {@const isStart = obj.start === s.id}
            {@const isAcc = obj.accept.includes(s.id)}
            <tr class:selected={store.selStates.includes(s.id)} class:active={activeSet.has(s.id)}>
              <th class="row">
                <button
                  class="mark"
                  class:on={isStart}
                  title={t('state.start')}
                  aria-label="{t('state.start')}: {s.name}"
                  aria-pressed={isStart}
                  onclick={() => store.update((o) => edit.setStart(o, isStart ? null : s.id))}>→</button
                >
                <button
                  class="mark"
                  class:on={isAcc}
                  title={t('state.accept')}
                  aria-label="{t('state.accept')}: {s.name}"
                  aria-pressed={isAcc}
                  onclick={() => store.update((o) => edit.setAccepting(o, s.id, !isAcc))}>✱</button
                >
                <input
                  class="name math"
                  value={s.name}
                  aria-label={t('table.state')}
                  onfocus={() => store.select([s.id])}
                  onkeydown={commitOnEnter}
                  onchange={(e) => renameRow(s.id, e.currentTarget.value, e.currentTarget)}
                />
              </th>
              {#each columns as w (wordKey(w))}
                {@const v = cellText(s.id, w)}
                <td class:missing={isDea && v === ''}>
                  <input
                    style:width={isDea ? undefined : `${Math.max(4, [...v].length + 2)}ch`}
                    class="cell math"
                    value={v}
                    placeholder={isDea ? '–' : '∅'}
                    title={t(isDea ? 'table.cellHint.dea' : 'table.cellHint.nea')}
                    aria-label="{s.name}, {showWord(w)}"
                    list="state-names"
                    onkeydown={commitOnEnter}
                    onchange={(e) => setCell(s.id, w, e.currentTarget.value)}
                  />
                </td>
              {/each}
              <td class="filler"></td>
            </tr>
          {/each}
          <tr class="add-row">
            <th class="row">
              <input
                class="name math"
                bind:value={newState}
                placeholder="+ {t('table.state')}"
                aria-label={t('table.addState')}
                onkeydown={(e) => e.key === 'Enter' && addRow()}
              />
            </th>
            <td colspan={columns.length + 1}></td>
          </tr>
        </tbody>
      </table>
      <datalist id="state-names">
        {#each obj.states as s (s.id)}<option value={s.name}></option>{/each}
      </datalist>
    </div>
    <p class="legend">{t('table.legend')}</p>
  </div>
{/if}

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }
  .scroller {
    overflow: auto;
    scrollbar-width: thin;
    flex: 1;
    padding: 14px 16px 6px;
  }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 15px;
  }
  th,
  td {
    border-bottom: 1px solid var(--rule);
    padding: 0;
    height: 38px;
  }
  thead th {
    border-bottom: 1.5px solid var(--ink);
    font-weight: 500;
    height: 34px;
  }
  .corner {
    text-align: left;
    padding-left: 50px;
    font-size: 17px;
    color: var(--ink-2);
    position: sticky;
    left: 0;
    background: var(--paper);
    z-index: 2;
  }
  .col {
    min-width: 64px;
    position: relative;
    text-align: center;
    padding: 0 10px;
  }
  .col.word {
    color: var(--ink-2);
    background: repeating-linear-gradient(135deg, transparent 0 6px, var(--paper-2) 6px 7px);
  }
  .col .x {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 16px;
    height: 16px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--ink-3);
    font-size: 12px;
    line-height: 1;
    opacity: 0;
  }
  .col:hover .x,
  .col .x:focus-visible {
    opacity: 1;
  }
  .col .x:hover {
    background: var(--bad-soft);
    color: var(--bad);
  }
  .add-col input {
    width: 34px;
    height: 26px;
    margin-left: 6px;
    border: 1px dashed var(--rule-2);
    border-radius: 6px;
    background: transparent;
    text-align: center;
    outline: none;
  }
  .add-col input:focus {
    border-style: solid;
    border-color: var(--select);
    width: 90px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 2px;
    padding-right: 10px;
    position: sticky;
    left: 0;
    background: var(--paper);
    z-index: 1;
    border-right: 1.5px solid var(--ink);
  }
  .mark {
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--rule-2);
    font-size: 13px;
  }
  .mark:hover {
    color: var(--ink-2);
    background: var(--paper-2);
  }
  .mark.on {
    color: var(--ink);
    font-weight: 700;
  }
  input.name {
    width: 64px;
    height: 28px;
    padding: 0 6px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    font-size: 17px;
    outline: none;
  }
  input.name:hover {
    border-color: var(--rule);
  }
  input.name:focus,
  input.cell:focus {
    border-color: var(--select);
    background: var(--sheet);
    box-shadow: 0 0 0 3px var(--select-soft);
  }
  input.cell {
    width: 100%;
    min-width: 52px;
    height: 37px;
    padding: 0 8px;
    border: 1px solid transparent;
    background: transparent;
    text-align: center;
    font-size: 17px;
    outline: none;
  }
  input.cell::placeholder {
    color: var(--rule-2);
    font-style: normal;
  }
  td.missing input.cell::placeholder {
    color: var(--warn);
  }
  td.missing {
    background: repeating-linear-gradient(135deg, transparent 0 5px, var(--warn-soft) 5px 6px);
  }
  .col,
  td:not(.filler) {
    width: 60px;
  }
  tr.selected .row,
  tr.selected td {
    background-color: var(--select-soft);
  }
  tr.active .row {
    box-shadow: inset 3px 0 0 var(--signal);
  }
  tr.active input.name {
    color: var(--signal);
    font-weight: 650;
  }
  .add-row input.name {
    width: 140px;
    margin-left: 46px;
    font-size: 14px;
    font-family: var(--font-ui);
    font-style: normal;
    color: var(--ink-2);
  }
  .add-row td,
  .add-row th {
    border-bottom: 0;
  }
  .legend {
    margin: 0;
    padding: 8px 16px 12px;
    font-size: 12px;
    color: var(--ink-3);
  }
</style>
