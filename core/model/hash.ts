// Prüfsumme eines Objekts (Herkunft: veraltet erkennen).
import { printObject } from '../text/printer';
import type { Document, FormalObject } from './types';

function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    const bytes =
      cp < 0x80
        ? [cp]
        : cp < 0x800
          ? [0xc0 | (cp >> 6), 0x80 | (cp & 63)]
          : cp < 0x10000
            ? [0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)]
            : [0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)];
    for (const b of bytes) {
      h ^= b;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, '0');
}

/** FNV-1a (32 Bit) über den Druck ohne layout/herkunft und ohne die erste Zeile (Name egal); 8 Hex-Zeichen. */
export function objectHash(o: FormalObject): string {
  if (o.kind === 'egrep') return fnv1a(`${o.pattern}\n${o.alphabet.join(' ')}`);
  const text = printObject(o, { layout: false, origin: false });
  // Kurzform des Ausdrucks hat nur eine Zeile: dort zählt der Teil hinter `=`.
  const body =
    o.kind === 'regex' && text.startsWith(`regex ${o.name} = `)
      ? text.slice(`regex ${o.name} = `.length)
      : o.kind === 'menge' && text.startsWith(`menge ${o.name} = `)
        ? text.slice(`menge ${o.name} = `.length)
        : text.slice(text.indexOf('\n') + 1);
  return fnv1a(body);
}

/** origin vorhanden und (Quelle fehlt oder Hash weicht ab). */
export function isStale(o: FormalObject, doc: Document): boolean {
  const origin = o.origin;
  if (!origin) return false;
  return origin.sources.some((name, i) => {
    const src = doc.objects.find((x) => x.name === name);
    return !src || objectHash(src) !== origin.sourceHash[i];
  });
}
