<script lang="ts">
  import { edit, freshName, parseWord, type FormalObject, type StateId, type Sym, type Word } from '../../core/index';
  import { store, withLayout } from '../lib/store.svelte';
  import { sim } from '../lib/sim.svelte';
  import { showSym, showWord, splitUnescaped } from '../lib/format';
  import { t } from '../i18n';
  import RowTable from './RowTable.svelte';

  const obj = $derived(store.obj);
  /** Deterministische Tabelle Z × X: DEA, Mealy, Moore. */
  const isDea = $derived(obj?.kind === 'dea' || obj?.kind === 'mealy' || obj?.kind === 'moore');
  const isMealy = $derived(obj?.kind === 'mealy');

  /** Vom Nutzer angelegte Wortspalten (NEA), die noch keine Kante haben. */
  let extraWords = $state<Word[]>([]);
  let newSymbol = $state('');
  let newState = $state('');

  const wordKey = (w: Word) => JSON.stringify(w);

  /** Spalten: DEA = Alphabet; NEA = ε, Alphabet, dann benutzte Wörter der Länge ≥ 2. */
  const columns = $derived.by((): Word[] => {
    if (!obj) return [];
    const cols: Word[] = obj.alphabet.map((a) => [a]);
    if (obj.kind !== 'nea') return cols;
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

  function matches(o: FormalObject, label: unknown, w: Word): boolean {
    if (o.kind === 'nea') return wordKey(label as Word) === wordKey(w);
    if (o.kind === 'mealy') return w.length === 1 && (label as { in: Sym }).in === w[0];
    return w.length === 1 && label === w[0];
  }

  function cellTargets(o: FormalObject, from: StateId, w: Word): StateId[] {
    return o.transitions.filter((x) => x.from === from && matches(o, x.label, w)).map((x) => x.to);
  }

  function cellText(from: StateId, w: Word): string {
    if (!obj) return '';
    if (obj.kind === 'mealy') {
      const tr = obj.transitions.find((x) => x.from === from && matches(obj, x.label, w));
      return tr ? `${nameOf(tr.to)} / ${showSym(tr.label.out)}` : '';
    }
    return cellTargets(obj, from, w).map(nameOf).join(', ');
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
    if (obj?.kind === 'mealy') {
      setMealyCell(from, w[0]!, raw);
      return;
    }
    const names = splitUnescaped(raw.replace(/[{}]/g, '')).map((s) => s.trim());
    if (!names.every((n) => /^[\p{L}\p{N}_+'][\p{L}\p{N}_+'−-]*$/u.test(n))) {
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
        r.o.kind === 'nea'
          ? edit.setNeaTargets(r.o, from, w, r.ids)
          : r.o.kind === 'dea' || r.o.kind === 'moore'
            ? edit.setDeaTarget(r.o as never, from, w[0]!, r.ids[0] ?? null)
            : r.o;
      return withLayout(next);
    });
  }

  /** Mealy-Zelle „z' / y“; leer löscht den Übergang. */
  function setMealyCell(from: StateId, input: Sym, raw: string): void {
    const text = raw.trim();
    if (text === '') {
      store.update((o) => (o.kind === 'mealy' ? edit.setMealyCell(o, from, input, null) : o));
      return;
    }
    const parts = splitUnescaped(text, '/');
    const name = parts[0]?.trim() ?? '';
    const out = parts[1] !== undefined ? literalSymbol(parts[1]) : null;
    if (parts.length !== 2 || out === null || !/^[\p{L}\p{N}_+'][\p{L}\p{N}_+'−-]*$/u.test(name)) {
      store.notify('Erwartet: Zielzustand / Ausgabesymbol, z. B. B / 1', 'error');
      return;
    }
    store.update((o) => {
      if (o.kind !== 'mealy') return o;
      const r = resolve(o, [name]);
      return withLayout(edit.setMealyCell(r.o as typeof o, from, input, { to: r.ids[0]!, out }));
    });
  }

  function setOut(id: StateId, raw: string): void {
    const v = raw.trim();
    const sym = v === '' ? null : literalSymbol(v);
    if (v !== '' && sym === null) {
      store.notify('Die Ausgabe ist genau ein Symbol.', 'error');
      return;
    }
    store.update((o) => (o.kind === 'moore' ? edit.setOutput(o, id, sym) : o));
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
      const ids = o.transitions
        .filter((x) =>
          o.kind === 'nea' ? (x.label as Word).includes(sym) : o.kind === 'mealy' ? (x.label as { in: Sym }).in === sym : x.label === sym,
        )
        .map((x) => x.id);
      return edit.setAlphabet(edit.removeTransitions(o, ids), o.alphabet.filter((a) => a !== sym));
    });
  }

  function addRow(): void {
    if (!obj) return;
    const name = newState.trim() || freshName(obj.states.map((s) => s.name), 'z');
    if (!/^[\p{L}\p{N}_+'][\p{L}\p{N}_+'−-]*$/u.test(name)) {
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

{#if obj && (obj.kind === 'nka' || obj.kind === 'tm')}
  <RowTable />
{:else if obj}
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
            {#if obj.kind === 'moore'}<th class="col gcol"><span class="math">g</span></th>{/if}
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
              <th class="row"><div class="rowin">
                <button
                  class="mark"
                  class:on={isStart}
                  title={t('state.start')}
                  aria-label="{t('state.start')}: {s.name}"
                  aria-pressed={isStart}
                  onclick={() => store.update((o) => edit.setStart(o, isStart ? null : s.id))}>→</button
                >
                {#if obj.kind !== 'mealy' && obj.kind !== 'moore'}<button
                  class="mark"
                  class:on={isAcc}
                  title={t('state.accept')}
                  aria-label="{t('state.accept')}: {s.name}"
                  aria-pressed={isAcc}
                  onclick={() => store.update((o) => edit.setAccepting(o, s.id, !isAcc))}>✱</button
                >{/if}
                <input
                  class="name math"
                  value={s.name}
                  aria-label={t('table.state')}
                  onfocus={() => store.select([s.id])}
                  onkeydown={commitOnEnter}
                  onchange={(e) => renameRow(s.id, e.currentTarget.value, e.currentTarget)}
                />
              </div></th>
              {#each columns as w (wordKey(w))}
                {@const v = cellText(s.id, w)}
                <td class:missing={isDea && v === ''}>
                  <input
                    style:width={isDea && !isMealy ? undefined : `${Math.max(4, [...v].length + 2)}ch`}
                    class="cell math"
                    value={v}
                    placeholder={isMealy ? 'z / y' : isDea ? '–' : '∅'}
                    title={t(isDea ? 'table.cellHint.dea' : 'table.cellHint.nea')}
                    aria-label="{s.name}, {showWord(w)}"
                    list={isMealy ? undefined : 'state-names'}
                    onkeydown={commitOnEnter}
                    onchange={(e) => setCell(s.id, w, e.currentTarget.value)}
                  />
                </td>
              {/each}
              {#if obj.kind === 'moore'}
                <td class="gcell">
                  <input
                    class="cell mono"
                    value={(s as { out?: string }).out ?? ''}
                    placeholder="?"
                    aria-label="g({s.name})"
                    onkeydown={commitOnEnter}
                    onchange={(e) => setOut(s.id, e.currentTarget.value)}
                  />
                </td>
              {/if}
              <td class="filler"></td>
            </tr>
          {/each}
          <tr class="add-row">
            <th class="row"><div class="rowin">
              <input
                class="name math"
                bind:value={newState}
                placeholder="+ {t('table.state')}"
                aria-label={t('table.addState')}
                onkeydown={(e) => e.key === 'Enter' && addRow()}
              />
            </div></th>
            <td colspan={columns.length + 1}></td>
          </tr>
        </tbody>
      </table>
      <datalist id="state-names">
        {#each obj.states as s (s.id)}<option value={s.name}></option>{/each}
      </datalist>
    </div>
    <p class="legend">{t(obj.kind === 'mealy' ? 'table.legend.mealy' : obj.kind === 'moore' ? 'table.legend.moore' : 'table.legend')}</p>
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

  .row,
  .corner {
    width: 1%;
    white-space: nowrap;
  }
  .rowin {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .row {
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
  .gcol,
  .gcell {
    border-left: 1.5px solid var(--ink);
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
    width: 100px;
    margin-left: 22px;
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
