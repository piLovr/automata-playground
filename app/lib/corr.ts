// Entsprechungen über die Herkunftskette (Abschnitt 8.4): Zeigt man auf ein Element,
// leuchten die zugehörigen Elemente in Quellen und abgeleiteten Objekten auf.
// Die Suche läuft entlang der Kette nur aufwärts (zu den Quellen) bzw. nur abwärts
// (zu den Ergebnissen), damit sich eine Menge nicht über Geschwister ausbreitet.
import type { Document, ElemRef } from '../../core/index';

export function elemKey(e: ElemRef): string {
  if ('state' in e) return `z:${e.state}`;
  if ('transition' in e) return `k:${e.transition}`;
  if ('nonterminal' in e) return `n:${e.nonterminal}`;
  if ('production' in e) return `p:${e.production}`;
  return `t:${e.subexpr.join('.')}`;
}

interface Node {
  object: string;
  key: string;
}
const nodeKey = (n: Node): string => `${n.object}\u0000${n.key}`;

/** Kanten Ziel → Quelle (up) und Quelle → Ziel (down) aus allen origin.corr des Dokuments. */
function buildIndex(doc: Document): { up: Map<string, Node[]>; down: Map<string, Node[]> } {
  const up = new Map<string, Node[]>();
  const down = new Map<string, Node[]>();
  const push = (m: Map<string, Node[]>, k: string, n: Node): void => {
    const list = m.get(k);
    if (list) list.push(n);
    else m.set(k, [n]);
  };
  for (const o of doc.objects) {
    const origin = o.origin;
    if (!origin?.corr) continue;
    for (const c of origin.corr) {
      const src = origin.sources[c.source];
      if (src === undefined) continue;
      const target: Node = { object: o.name, key: elemKey(c.target) };
      for (const e of c.elems) {
        const s: Node = { object: src, key: elemKey(e) };
        push(up, nodeKey(target), s);
        push(down, nodeKey(s), target);
      }
    }
  }
  return { up, down };
}

/** Objektname → Menge der Elementschlüssel, die zum Ausgangselement gehören (inklusive). */
export function related(doc: Document, object: string, elem: ElemRef): Map<string, Set<string>> {
  const { up, down } = buildIndex(doc);
  const out = new Map<string, Set<string>>();
  const add = (n: Node): void => {
    const s = out.get(n.object);
    if (s) s.add(n.key);
    else out.set(n.object, new Set([n.key]));
  };
  const start: Node = { object, key: elemKey(elem) };
  add(start);
  for (const dir of [up, down]) {
    const seen = new Set([nodeKey(start)]);
    let frontier = [start];
    while (frontier.length) {
      const next: Node[] = [];
      for (const n of frontier) {
        for (const m of dir.get(nodeKey(n)) ?? []) {
          const k = nodeKey(m);
          if (seen.has(k)) continue;
          seen.add(k);
          add(m);
          next.push(m);
        }
      }
      frontier = next;
    }
  }
  return out;
}

/** Zustands-IDs aus einer Schlüsselmenge. */
export function statesOf(keys: Set<string> | undefined): Set<string> {
  const s = new Set<string>();
  for (const k of keys ?? []) if (k.startsWith('z:')) s.add(k.slice(2));
  return s;
}

/** Herkunftskette: Kanten Quelle → Ergebnis für den Abhängigkeitsgraphen. */
export function chainEdges(doc: Document): { from: string; to: string; method: string }[] {
  const names = new Set(doc.objects.map((o) => o.name));
  const edges: { from: string; to: string; method: string }[] = [];
  for (const o of doc.objects) {
    for (const s of o.origin?.sources ?? []) if (names.has(s)) edges.push({ from: s, to: o.name, method: o.origin!.method });
  }
  return edges;
}
