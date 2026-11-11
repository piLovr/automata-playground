// Fleißiger Biber (5.40, 5.41): Aufzählung in Baum-Normalform.
// Festlegungen: Start A, Endzustand Z (F+), Bandalphabet {□, 1}, Bewegung nur L/R.
// Der Halt-Übergang ist fest (Z, 1, R) und zählt einmal. Der erste Übergang (A,□) ist für n >= 2
// fest A -> B,1,R (Spiegelsymmetrie). Neue Zustände nur in Reihenfolge. Ist nur noch ein
// Übergang frei und noch kein Halt-Übergang vorhanden, ist dieser der Halt-Übergang.
// Wiederholungsnachweis: Brent-Verfahren auf der exakten Konfiguration (Zustand, Kopf, Band).

import type { BeaverOptions, BeaverResult, TM, Transition, TmLabel } from '../model/types';

const BLANK = '□';

function stateName(i: number, n: number): string {
  return i === n ? 'Z' : String.fromCharCode(65 + i);
}

// Eintrag: -1 undefiniert, sonst next * 4 + write * 2 + (R ? 1 : 0); next === n heißt Z.
function buildTm(table: Int16Array, n: number): TM {
  const states = [];
  for (let i = 0; i <= n; i++) states.push({ id: stateName(i, n), name: stateName(i, n) });
  const transitions: Transition<TmLabel>[] = [];
  for (let q = 0; q < n; q++) {
    for (let s = 0; s < 2; s++) {
      const e = table[q * 2 + s]!;
      if (e < 0) continue;
      transitions.push({
        id: `t${transitions.length}`,
        from: stateName(q, n),
        to: stateName(e >> 2, n),
        label: { read: s ? '1' : BLANK, write: e & 2 ? '1' : BLANK, move: e & 1 ? 1 : -1 },
      });
    }
  }
  return {
    kind: 'tm',
    name: `Biber${n}`,
    alphabet: ['1'],
    states,
    start: 'A',
    accept: ['Z'],
    transitions,
    tapeAlphabet: [BLANK, '1'],
    blank: BLANK,
    reject: [],
  };
}

/** Baut eine Biber-TM aus einer Tabelle „B1R C1L …“ (Spalten A, B, …; je Zustand erst □, dann 1). */
export function beaverTm(n: number, table: string): TM {
  const cells = table.trim().split(/\s+/).filter((c) => c !== '');
  if (cells.length !== 2 * n) throw new Error(`beaver.table.size: ${cells.length}`);
  const t = new Int16Array(2 * n);
  cells.forEach((c, i) => {
    if (c === '-' || c === '–') {
      t[i] = -1;
      return;
    }
    const m = /^([A-Z])([1□_0])([LR])$/.exec(c);
    const nx = m ? (m[1] === 'Z' ? n : m[1]!.charCodeAt(0) - 65) : -1;
    if (!m || nx < 0 || nx > n) throw new Error(`beaver.table.cell: ${c}`);
    t[i] = nx * 4 + (m[2] === '1' ? 2 : 0) + (m[3] === 'R' ? 1 : 0);
  });
  return buildTm(t, n);
}

export function busyBeaver(
  opts: BeaverOptions,
  onProgress?: (done: number) => boolean | void,
): BeaverResult {
  const n = opts.n;
  const stepLimit = opts.stepLimit ?? 1000;
  const size = 2 * stepLimit + 3;
  const origin = stepLimit + 1;
  const HALT = n * 4 + 3; // (Z, 1, R)

  const res: BeaverResult = {
    n,
    stepLimit,
    enumerated: 0,
    halted: 0,
    provenLoop: 0,
    undecided: 0,
    best: null,
    longest: null,
    complete: true,
  };
  let aborted = false;
  const table = new Int16Array(2 * n).fill(-1);

  function leaf(kind: 0 | 1 | 2, ones: number, steps: number): void {
    res.enumerated++;
    if (kind === 0) {
      res.halted++;
      if (!res.best || ones > res.best.ones) res.best = { tm: buildTm(table, n), ones, steps };
      if (!res.longest || steps > res.longest.steps) res.longest = { tm: buildTm(table, n), ones, steps };
    } else if (kind === 1) res.provenLoop++;
    else res.undecided++;
    if (res.enumerated % 1000 === 0 && onProgress && onProgress(res.enumerated) === true) aborted = true;
  }

  // Führt die Maschine ab der gegebenen Konfiguration aus; verzweigt bei undefiniertem Übergang.
  function run(tape: Int8Array, head: number, state: number, steps: number, ones: number, used: number, free: number, hasHalt: boolean, lo: number, hi: number): void {
    if (aborted) return;
    // Brent
    const snap = new Int8Array(size);
    snap.set(tape);
    let sHead = head;
    let sState = state;
    let power = 1;
    let lam = 0;
    while (true) {
      if (steps >= stepLimit) {
        leaf(2, ones, steps);
        return;
      }
      const sym = tape[head]!;
      const idx = state * 2 + sym;
      const e = table[idx]!;
      if (e < 0) {
        branch(tape, head, state, steps, ones, used, free, hasHalt, idx, lo, hi);
        return;
      }
      const w = (e >> 1) & 1;
      ones += w - sym;
      tape[head] = w;
      head += e & 1 ? 1 : -1;
      state = e >> 2;
      steps++;
      if (state === n) {
        leaf(0, ones, steps);
        return;
      }
      if (head > hi || head < lo) {
        // Der Kopf betritt ein nie besuchtes Feld jenseits des besuchten Bereichs; alles dahinter
        // ist □. Verfolgt man nur die □-Übergänge und laufen sie alle nach außen (weiter in
        // dieselbe Richtung, jedes Mal auf ein frisches □-Feld), so ist der Ablauf allein durch
        // diese Übergänge bestimmt. Kehrt dabei ein Zustand wieder (ohne Z zu erreichen), wiederholt
        // sich die Zustandsfolge endlos, der Kopf kommt nie zurück und Z wird nie erreicht.
        const right = head > hi;
        if (right) hi = head;
        else lo = head;
        const outBit = right ? 1 : 0;
        let seen = 1 << state;
        let q = state;
        while (true) {
          const t = table[q * 2]!;
          if (t < 0 || (t & 1) !== outBit) break;
          q = t >> 2;
          if (q === n) break;
          if (seen & (1 << q)) {
            leaf(1, ones, steps);
            return;
          }
          seen |= 1 << q;
        }
      }
      if (head === sHead && state === sState) {
        let same = true;
        for (let i = 0; i < size; i++) if (tape[i] !== snap[i]) { same = false; break; }
        if (same) {
          leaf(1, ones, steps);
          return;
        }
      }
      if (++lam === power) {
        snap.set(tape);
        sHead = head;
        sState = state;
        power *= 2;
        lam = 0;
      }
    }
  }

  function branch(tape: Int8Array, head: number, state: number, steps: number, ones: number, used: number, free: number, hasHalt: boolean, idx: number, lo: number, hi: number): void {
    const opts2: number[] = [];
    if (!hasHalt) opts2.push(HALT);
    if (!(free === 1 && !hasHalt)) {
      const maxNext = Math.min(used + 1, n) - 1; // höchster erlaubter Folgezustand
      for (let nx = 0; nx <= maxNext; nx++) {
        for (let w = 0; w < 2; w++) for (let d = 0; d < 2; d++) opts2.push(nx * 4 + w * 2 + d);
      }
    }
    for (const o of opts2) {
      if (aborted) break;
      table[idx] = o;
      const nx = o >> 2;
      const isHalt = nx === n;
      run(tape.slice(), head, state, steps, ones, isHalt ? used : Math.max(used, nx + 1), free - 1, hasHalt || isHalt, lo, hi);
    }
    table[idx] = -1;
  }

  const tape = new Int8Array(size);
  if (n >= 2) {
    table[0] = 1 * 4 + 2 + 1; // (A,□) -> B,1,R
    run(tape, origin, 0, 0, 0, 2, 2 * n - 1, false, origin, origin);
  } else {
    run(tape, origin, 0, 0, 0, 1, 2 * n, false, origin, origin);
  }
  res.complete = !aborted;
  return res;
}
