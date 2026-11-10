<script lang="ts">
  // Übergangstabelle in Zeilenform wie im Skript: Kellerautomat z, y, x → z', v (Beispiel 4.6),
  // Turingmaschine z, y → z', y', d (Beispiel 5.9). Jede Zeile ist ein Übergang.
  import { edit, type NKA, type NkaLabel, type StateId, type TM, type TmLabel } from '../../core/index';
  import { store, withLayout } from '../lib/store.svelte';
  import { sim } from '../lib/sim.svelte';
  import { parseInputWord, showSym, showWord } from '../lib/format';

  const obj = $derived(store.obj as NKA | TM | undefined);
  const isTm = $derived(obj?.kind === 'tm');
  const MOVE = { [-1]: 'L', 0: 'N', 1: 'R' } as Record<number, string>;

  const cols = $derived(isTm ? ['z', 'y', "z'", "y'", 'd'] : ['z', 'y', 'x', "z'", 'v']);

  function nameOf(id: StateId): string {
    return obj?.states.find((s) => s.id === id)?.name ?? '?';
  }

  /** Zellen einer Zeile als Text. */
  function cells(tr: { from: StateId; to: StateId; label: unknown }): string[] {
    if (isTm) {
      const l = tr.label as TmLabel;
      return [nameOf(tr.from), showSym(l.read), nameOf(tr.to), showSym(l.write), MOVE[l.move]!];
    }
    const l = tr.label as NkaLabel;
    return [nameOf(tr.from), showSym(l.top), l.read === null ? 'ε' : showSym(l.read), nameOf(tr.to), showWord(l.push)];
  }

  function oneSym(text: string): string | null {
    const w = parseInputWord(text);
    return w && w.length === 1 ? w[0]! : null;
  }

  /** Liest eine bearbeitete Zeile; legt unbekannte Zustände an. Gibt Fehlertext zurück. */
  function commitRow(id: string | null, values: string[]): string | null {
    const v = values.map((x) => x.trim());
    // TM: [z, y, z', y', d]   NKA: [z, y, x, z', v]
    const fromName = v[0]!;
    const toName = isTm ? v[2]! : v[3]!;
    if (!fromName || !toName) return 'Zustand fehlt.';
    const nameOk = (n: string) => /^[\p{L}\p{N}_+'][\p{L}\p{N}_+'−-]*$/u.test(n);
    if (!nameOk(fromName) || !nameOk(toName)) return 'Ungültiger Zustandsname.';
    let label: TmLabel | NkaLabel;
    if (isTm) {
      const read = oneSym(v[1]!);
      const write = oneSym(v[3]!);
      const d = v[4]!.toUpperCase();
      const move = d === 'L' || d === '-1' ? -1 : d === 'N' || d === '0' ? 0 : d === 'R' || d === '1' ? 1 : null;
      if (read === null || write === null || move === null) return 'Erwartet: Symbol, Symbol, Richtung L/N/R.';
      label = { read, write, move };
    } else {
      const top = oneSym(v[1]!);
      const readW = parseInputWord(v[2]!);
      const push = parseInputWord(v[4]!);
      if (top === null || readW === null || readW.length > 1 || push === null) return 'Erwartet: Kellersymbol, Eingabe oder ε, Wort oder ε.';
      label = { top, read: readW[0] ?? null, push };
    }
    store.update((o) => {
      let next = o;
      const ensure = (n: string): StateId => {
        const hit = next.states.find((s) => s.name === n);
        if (hit) return hit.id;
        const r = edit.addState(next, n);
        next = next.start === null ? edit.setStart(r.obj, r.id) : r.obj;
        return r.id;
      };
      const from = ensure(fromName);
      const to = ensure(toName);
      if (id) next = edit.removeTransitions(next, [id]);
      next = edit.addTransition(next, from, to, label as never).obj;
      return withLayout(next);
    });
    return null;
  }

  let draft = $state<string[]>(['', '', '', '', '']);
  let error = $state('');

  function onRowChange(id: string, row: HTMLElement): void {
    const values = [...row.querySelectorAll('input')].map((i) => i.value);
    const err = commitRow(id, values);
    error = err ?? '';
  }

  function addDraft(): void {
    if (draft.every((v) => v.trim() === '')) return;
    const err = commitRow(null, draft);
    if (err) {
      error = err;
      return;
    }
    error = '';
    draft = ['', '', '', '', ''];
  }

  const firedSet = $derived(sim.fired);
</script>

{#if obj}
  <div class="wrap">
    <div class="scroller">
      <table>
        <thead>
          <tr>
            {#each cols as c, i (c)}
              <th class:arrow={i === (isTm ? 2 : 3)} class="math">{c}</th>
            {/each}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each obj.transitions as tr (tr.id)}
            {@const vals = cells(tr)}
            <tr class:fired={firedSet.has(tr.id)} onchange={(e) => onRowChange(tr.id, e.currentTarget as HTMLElement)}>
              {#each vals as v, i (i)}
                <td class:arrow={i === (isTm ? 2 : 3)}>
                  <input class:math={i === 0 || i === (isTm ? 2 : 3)} class:mono={!(i === 0 || i === (isTm ? 2 : 3))} value={v} aria-label={cols[i]} />
                </td>
              {/each}
              <td>
                <button class="rm" aria-label="Übergang löschen" title="Übergang löschen" onclick={() => store.update((o) => edit.removeTransitions(o, [tr.id]))}>×</button>
              </td>
            </tr>
          {/each}
          <tr class="draft">
            {#each draft.keys() as i (i)}
              <td class:arrow={i === (isTm ? 2 : 3)}>
                <input
                  class:math={i === 0 || i === (isTm ? 2 : 3)}
                  class:mono={!(i === 0 || i === (isTm ? 2 : 3))}
                  bind:value={draft[i]}
                  placeholder={i === 0 ? '+' : ''}
                  aria-label="Neuer Übergang: {cols[i]}"
                  onkeydown={(e) => e.key === 'Enter' && addDraft()}
                />
              </td>
            {/each}
            <td><button class="btn add" onclick={addDraft}>+</button></td>
          </tr>
        </tbody>
      </table>
      {#if error}<p class="error">{error}</p>{/if}
    </div>
    <p class="legend">
      {#if isTm}
        Je Zeile ein Übergang: im Zustand z das Symbol y lesen → Zustand z', y' schreiben, Kopf L/N/R. Blank: {showSym(obj.kind === 'tm' ? obj.blank : '□')}.
      {:else}
        Je Zeile ein Übergang: im Zustand z mit y oben, Eingabe x (oder ε) → Zustand z', v kellern (erstes Symbol oben).
      {/if}
    </p>
  </div>
{/if}

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .scroller {
    flex: 1;
    overflow: auto;
    padding: 14px 16px 6px;
  }
  table {
    border-collapse: collapse;
    font-size: 15px;
  }
  th {
    padding: 0 6px 6px;
    border-bottom: 1.5px solid var(--ink);
    font-weight: 500;
    color: var(--ink-2);
    text-align: center;
  }
  td {
    border-bottom: 1px solid var(--rule);
    padding: 0;
  }
  th.arrow,
  td.arrow {
    border-left: 1.5px solid var(--ink);
  }
  td input {
    width: 58px;
    height: 34px;
    padding: 0 6px;
    border: 1px solid transparent;
    background: transparent;
    text-align: center;
    font-size: 15px;
    outline: none;
  }
  td input:focus {
    border-color: var(--select);
    background: var(--sheet);
    box-shadow: 0 0 0 3px var(--select-soft);
  }
  tr.fired td {
    background: var(--signal-soft);
  }
  .draft input::placeholder {
    color: var(--ink-3);
  }
  .rm {
    width: 22px;
    height: 22px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--ink-3);
  }
  .rm:hover {
    background: var(--bad-soft);
    color: var(--bad);
  }
  .btn.add {
    height: 24px;
    padding: 0 8px;
  }
  .error {
    color: var(--bad);
    font-size: 12.5px;
  }
  .legend {
    margin: 0;
    padding: 8px 16px 12px;
    font-size: 12px;
    color: var(--ink-3);
  }
</style>
