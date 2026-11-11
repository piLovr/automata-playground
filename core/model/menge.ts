// Endliche Sprache (Kapitel 1): Normalform, Ordnung, Prüfung.
import type { Diagnostic, MengeObj, Sym, Word } from './types';

/** Symbole in Reihenfolge des ersten Auftretens. */
export function deriveAlphabet(words: readonly Word[], base: readonly Sym[] = []): Sym[] {
  const out = [...base];
  const seen = new Set(out);
  for (const w of words) {
    for (const x of w) {
      if (!seen.has(x)) {
        seen.add(x);
        out.push(x);
      }
    }
  }
  return out;
}

/** Längen-/Alphabetordnung; Symbole außerhalb des Alphabets folgen nach Codepoint. */
export function wordComparator(alphabet: readonly Sym[]): (a: Word, b: Word) => number {
  const rank = new Map(alphabet.map((s, i) => [s, i]));
  const r = (s: Sym): number => rank.get(s) ?? alphabet.length;
  return (a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    for (let i = 0; i < a.length; i++) {
      const x = a[i] as Sym;
      const y = b[i] as Sym;
      if (x === y) continue;
      const d = r(x) - r(y);
      if (d !== 0) return d;
      return x < y ? -1 : 1;
    }
    return 0;
  };
}

/** Ohne Doppelte, sortiert. */
export function normalizeWords(words: readonly Word[], alphabet: readonly Sym[]): Word[] {
  const seen = new Set<string>();
  const out: Word[] = [];
  for (const w of words) {
    const k = JSON.stringify(w);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(w.slice());
    }
  }
  return out.sort(wordComparator(alphabet));
}

/** Baut eine Menge in Normalform; `alphabet` null = aus den Wörtern ableiten (in der gegebenen Reihenfolge). */
export function makeMenge(
  name: string,
  words: readonly Word[],
  alphabet: readonly Sym[] | null,
  extra: { upTo?: number; origin?: MengeObj['origin'] } = {},
): MengeObj {
  const alpha = alphabet === null ? deriveAlphabet(words) : [...alphabet];
  const obj: MengeObj = { kind: 'menge', name, alphabet: alpha, words: normalizeWords(words, alpha) };
  if (extra.upTo !== undefined) obj.upTo = extra.upTo;
  if (extra.origin !== undefined) obj.origin = extra.origin;
  return obj;
}

/**
 * Druckreihenfolge für die Kurzform: die Wörter so geordnet, dass das Alphabet beim Wiederlesen
 * (Reihenfolge des ersten Auftretens) gleich bleibt; null, wenn das nicht möglich ist.
 */
export function printOrder(o: MengeObj): Word[] | null {
  const rest = o.words.slice();
  const out: Word[] = [];
  const seen = new Set<Sym>();
  while (rest.length > 0) {
    const i = rest.findIndex((w) => {
      let n = seen.size;
      const here = new Set<Sym>();
      for (const x of w) {
        if (seen.has(x) || here.has(x)) continue;
        if (o.alphabet[n] !== x) return false;
        here.add(x);
        n++;
      }
      return true;
    });
    if (i < 0) return null;
    const [w] = rest.splice(i, 1) as [Word];
    for (const x of w) seen.add(x);
    out.push(w);
  }
  return seen.size === o.alphabet.length ? out : null;
}

export function validateMenge(o: MengeObj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const alpha = new Set(o.alphabet);
  const reported = new Set<Sym>();
  for (const w of o.words) {
    for (const x of w) {
      if (!alpha.has(x) && !reported.has(x)) {
        reported.add(x);
        out.push({ severity: 'error', code: 'model.symbolNotInAlphabet', params: { symbol: x, word: w }, objectName: o.name });
      }
    }
  }
  return out;
}
