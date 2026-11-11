<script lang="ts">
  // Regex-Tester (Kapitel 3): egrep-Muster, Prüftext zeilenweise, Treffer nach POSIX
  // (am weitesten links, dann am längsten) unterstrichen, Gruppen nummeriert wie in 3.23.
  import { egrepAll, parseEgrep, type EgrepMatch, type EgrepObj } from '../../core/index';
  import { store } from '../lib/store.svelte';
  import { diagnosticText } from '../lib/format';
  import { t } from '../i18n';

  const obj = $derived(store.obj as EgrepObj);
  const parsed = $derived(parseEgrep(obj.pattern));
  const error = $derived(parsed.diagnostics.find((d) => d.severity === 'error'));
  const hasBackref = $derived(parsed.diagnostics.some((d) => d.code === 'egrep.backrefNotRegular'));

  let pattern = $state('');
  let lastName = '';
  let lastRev = -1;
  $effect(() => {
    const rev = store.externalRevision;
    if (obj.name !== lastName || rev !== lastRev) {
      lastName = obj.name;
      lastRev = rev;
      pattern = obj.pattern;
    }
  });

  function onPattern(): void {
    const p = pattern;
    store.updateAny((o) => (o.kind === 'egrep' ? { ...o, pattern: p } : o), 'egrep');
  }

  function onAlphabet(raw: string): void {
    const syms = [...new Set([...raw.replace(/\s+/g, '')])];
    store.updateAny((o) => (o.kind === 'egrep' ? { ...o, alphabet: syms } : o));
  }

  /** Je Zeile: Treffer oder 'limit'. */
  const lines = $derived.by(() => {
    const text = store.text;
    const rows = text === '' ? [] : text.split('\n');
    return rows.map((line) => {
      if (!parsed.ast) return { line, matches: [] as EgrepMatch[], limit: false };
      const r = egrepAll(parsed.ast, parsed.groups, line);
      return r === 'limit' ? { line, matches: [], limit: true } : { line, matches: r, limit: false };
    });
  });

  let selected = $state(0);
  const sel = $derived(lines[Math.min(selected, lines.length - 1)]);

  /** Zeichen einer Zeile mit Markierung: Treffer und tiefste Gruppe. */
  function marks(line: string, ms: EgrepMatch[]): { ch: string; hit: boolean; group: number }[] {
    const chars = [...line];
    return chars.map((ch, i) => {
      const m = ms.find((x) => i >= x.from && i < x.to);
      let group = 0;
      if (m) {
        let best = Infinity;
        m.groups.forEach((g, k) => {
          if (g && i >= g.from && i < g.to && g.to - g.from <= best) {
            best = g.to - g.from;
            group = k + 1;
          }
        });
      }
      return { ch, hit: !!m, group };
    });
  }

  /** Positionen wie im Skript: ab 1, beide Enden eingeschlossen; leerer Treffer „vor Pos k“. */
  const span = (r: { from: number; to: number }): string =>
    r.to > r.from ? `${r.from + 1}–${r.to}` : t('egrep.emptyAt', { pos: r.from + 1 });
  const slice = (line: string, from: number, to: number): string => [...line].slice(from, to).join('');
</script>

<div class="eg-stage">
  <div class="editor">
    <label class="eyebrow" for="eg-input">{t('egrep.pattern')}</label>
    <div class="line" class:bad={!!error}>
      <span class="lhs mono">egrep</span>
      <input id="eg-input" class="mono" bind:value={pattern} oninput={onPattern} spellcheck="false" autocomplete="off" placeholder="^[a-z]+(\.[a-z]+)*$" aria-invalid={!!error} />
    </div>
    {#if error}
      <p class="err" role="alert">
        {#if typeof error.params.col === 'number'}<span class="col mono">{t('regex.col', { col: error.params.col })}</span>{/if}
        {diagnosticText(error)}
      </p>
    {:else if parsed.ast}
      <p class="meta">{t('egrep.groups', { n: parsed.groups })}{#if hasBackref} · <span class="warn">{t('egrep.notRegular')}</span>{/if}</p>
    {/if}
    <label class="alpha">
      <span>{t('egrep.alphabet')}</span>
      <input class="mono" value={obj.alphabet.join('')} placeholder={t('egrep.alphabetAuto')} onchange={(e) => onAlphabet(e.currentTarget.value)} />
    </label>
  </div>

  <div class="test">
    <label class="eyebrow" for="eg-text">{t('egrep.text')}</label>
    <textarea id="eg-text" class="mono" rows="5" bind:value={store.text} spellcheck="false" placeholder={t('egrep.textHint')}></textarea>
  </div>

  {#if lines.length}
    <div class="results" aria-label={t('egrep.results')}>
      <p class="eyebrow">{t('egrep.results')} <span class="ref">{t('egrep.rule')}</span></p>
      <ol>
        {#each lines as l, i (i)}
          {@const hit = l.matches.length > 0}
          <li class:hit class:sel={i === selected}>
            <button class="row" onclick={() => (selected = i)} aria-pressed={i === selected}>
              <span class="mark" aria-label={hit ? t('egrep.lineHit') : t('egrep.lineMiss')}>{l.limit ? '…' : hit ? '✓' : '·'}</span>
              <span class="txt mono">
                {#each marks(l.line, l.matches) as c, k (k)}<span class:hit={c.hit} class="g{c.group % 6}" class:grp={c.group > 0}>{c.ch === ' ' ? ' ' : c.ch}</span>{/each}
                {#if l.line === ''}<span class="empty">(leere Zeile)</span>{/if}
              </span>
            </button>
          </li>
        {/each}
      </ol>
    </div>

    {#if sel && sel.matches.length}
      {@const chars = [...sel.line]}
      {@const covers = (g: number, i: number) =>
        sel.matches.some((m) => {
          const r = g === 0 ? m : m.groups[g - 1];
          return !!r && i >= r.from && i < r.to;
        })}
      <div class="grid-wrap">
        <p class="eyebrow">{t('egrep.grid')} <span class="ref">3.23</span></p>
        <table class="grid">
          <tbody>
            <tr class="pos"><th>{t('egrep.pos')}</th>{#each { length: chars.length }, i (i)}<td>{i + 1}</td>{/each}</tr>
            <tr class="w"><th>w</th>{#each chars as c, i (i)}<td class="mono">{c === ' ' ? '␣' : c}</td>{/each}</tr>
            {#each { length: parsed.groups + 1 }, g (g)}
              <tr class="bar g{g % 6}">
                <th>{t('egrep.group', { n: g })}</th>
                {#each { length: chars.length }, i (i)}<td class:on={covers(g, i)}></td>{/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="groups">
        <p class="eyebrow">{t('egrep.matchesOf', { n: selected + 1 })}</p>
        <table>
          <thead>
            <tr><th>{t('egrep.match')}</th><th>{t('egrep.whole')}</th>{#each { length: parsed.groups }, g (g)}<th class="g{(g + 1) % 6}">\{g + 1}</th>{/each}</tr>
          </thead>
          <tbody>
            {#each sel.matches as m, k (k)}
              <tr>
                <td>{k + 1}</td>
                <td class="mono">„{slice(sel.line, m.from, m.to)}“ <span class="pos">{span(m)}</span></td>
                {#each m.groups as g, gi (gi)}
                  <td class="mono">{#if g}„{slice(sel.line, g.from, g.to)}“ <span class="pos">{span(g)}</span>{:else}<span class="pos">—</span>{/if}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>

<style>
  .eg-stage {
    height: 100%;
    overflow: auto;
    background: var(--sheet);
    padding: 24px 28px 32px;
    display: grid;
    align-content: start;
    gap: 20px;
  }
  .editor,
  .test {
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
    color: var(--ink-3);
    font-size: 14px;
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
  .col {
    font-size: 12px;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--bad-soft);
  }
  .meta {
    margin: 0;
    font-size: 13px;
    color: var(--ink-2);
  }
  .warn {
    color: var(--warn);
    font-weight: 600;
  }
  .alpha {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--ink-2);
  }
  .alpha input,
  textarea {
    padding: 6px 8px;
    border: 1px solid var(--rule-2);
    border-radius: 8px;
    background: var(--state-fill);
    color: var(--ink);
    font-size: 15px;
  }
  .alpha input {
    flex: 1;
    max-width: 320px;
  }
  textarea {
    resize: vertical;
    line-height: 1.6;
  }
  .ref {
    font: 500 11px var(--font-ui);
    color: var(--ink-3);
    text-transform: none;
    letter-spacing: 0;
  }
  ol {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }
  .row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    width: 100%;
    padding: 6px 8px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: none;
    color: var(--ink-3);
    text-align: left;
    cursor: pointer;
  }
  li.hit .row {
    color: var(--ink);
  }
  li.sel .row {
    border-color: var(--rule-2);
    background: var(--paper);
  }
  .mark {
    width: 1.2em;
    font-weight: 700;
  }
  li.hit .mark {
    color: var(--ok);
  }
  .txt {
    font-size: 18px;
    line-height: 2.1;
    white-space: pre-wrap;
  }
  .txt .hit {
    text-decoration: underline;
    text-decoration-color: var(--signal);
    text-decoration-thickness: 2.5px;
    text-underline-offset: 6px;
    color: var(--ink);
  }
  .txt .grp {
    border-bottom: 2.5px solid var(--gc);
    padding-bottom: 1px;
  }
  .g1 {
    --gc: var(--cls-0);
  }
  .g2 {
    --gc: var(--cls-1);
  }
  .g3 {
    --gc: var(--cls-2);
  }
  .g4 {
    --gc: var(--cls-3);
  }
  .g5 {
    --gc: var(--cls-4);
  }
  .g0 {
    --gc: var(--cls-5);
  }
  th.g1,
  th.g2,
  th.g3,
  th.g4,
  th.g5,
  th.g0 {
    box-shadow: inset 0 -3px 0 var(--gc);
  }
  .empty {
    font-style: italic;
    font-size: 13px;
    color: var(--ink-3);
  }
  .grid-wrap {
    overflow-x: auto;
  }
  table.grid td {
    min-width: 26px;
    text-align: center;
    padding: 3px 4px;
  }
  table.grid tr.pos td {
    font-size: 11px;
    color: var(--ink-3);
  }
  table.grid tr.w td {
    font-size: 16px;
  }
  table.grid tr.bar td {
    height: 14px;
    padding: 0;
  }
  table.grid tr.bar td.on {
    background: var(--gc);
  }
  table.grid tr.bar.g0 {
    --gc: var(--signal);
  }
  table {
    margin-top: 8px;
    border-collapse: collapse;
    font-size: 14px;
  }
  th,
  td {
    padding: 5px 12px;
    border: 1px solid var(--rule);
    text-align: left;
    white-space: nowrap;
  }
  th {
    background: var(--paper-2);
    font-size: 12px;
  }
  .pos {
    font-size: 11px;
    color: var(--ink-3);
  }
</style>
