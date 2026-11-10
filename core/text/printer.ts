// Kanonischer Druck der Textsprache.
import { getKind } from '../model/kinds';
import type { Document, FormalObject } from '../model/types';
import { transitionsOf } from '../model/util';
import { printSymbol } from './word';

export interface PrintOptions {
  /** Standard true: layout-Zeile ausgeben, falls Positionen vorhanden. */
  layout?: boolean;
}

export function formatNumber(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(r === 0 ? 0 : r);
}


export function printObject(obj: FormalObject, opts: PrintOptions = {}): string {
  const spec = getKind(obj.kind);
  const nameOf = new Map(obj.states.map((s) => [s.id, s.name]));
  const nm = (id: string): string => nameOf.get(id) ?? id;
  const lines: string[] = [];
  if (obj.alphabet.length > 0) lines.push('  alphabet ' + obj.alphabet.map(printSymbol).join(' '));

  // Gruppen (from, to) in Reihenfolge des ersten Übergangs
  const groups = new Map<string, { from: string; to: string; labels: string[] }>();
  for (const t of transitionsOf(obj)) {
    const key = JSON.stringify([t.from, t.to]);
    let g = groups.get(key);
    if (!g) {
      g = { from: t.from, to: t.to, labels: [] };
      groups.set(key, g);
    }
    g.labels.push(spec.printLabel(t.label));
  }

  // Reihenfolge des ersten Auftretens nach dem Parse-Schema (ohne states-Zeile)
  const order: string[] = [];
  const seen = new Set<string>();
  const see = (id: string): void => {
    if (!seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  };
  if (obj.start !== null && nameOf.has(obj.start)) see(obj.start);
  for (const id of obj.accept) if (nameOf.has(id)) see(id);
  for (const g of groups.values()) {
    see(g.from);
    see(g.to);
  }
  const modelOrder = obj.states.map((s) => s.id);
  const needStates =
    order.length !== modelOrder.length || order.some((id, k) => id !== modelOrder[k]);
  if (needStates && obj.states.length > 0) lines.push('  states ' + obj.states.map((s) => s.name).join(' '));

  if (obj.start !== null && nameOf.has(obj.start)) lines.push('  start ' + nm(obj.start));
  const acc = obj.accept.filter((id) => nameOf.has(id));
  if (acc.length > 0) lines.push('  accept ' + acc.map(nm).join(' '));
  for (const g of groups.values()) {
    lines.push(`  ${nm(g.from)} -${g.labels.join(',')}-> ${nm(g.to)}`);
  }
  if (opts.layout !== false) {
    const parts = obj.states
      .filter((s) => s.pos !== undefined)
      .map((s) => `${s.name}@${formatNumber(s.pos?.x ?? 0)},${formatNumber(s.pos?.y ?? 0)}`);
    if (parts.length > 0) lines.push('  layout ' + parts.join(' '));
  }
  return `${spec.keyword} ${obj.name} {\n${lines.map((l) => l + '\n').join('')}}\n`;
}

export function printDocument(doc: Document, opts: PrintOptions = {}): string {
  return doc.objects.map((o) => printObject(o, opts)).join('\n');
}
