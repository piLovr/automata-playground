import { de, type MsgKey } from './de';

export type { MsgKey };

const table: Record<string, string> = de;

/** Übersetzt einen Schlüssel; unbekannte Schlüssel erscheinen sichtbar als [schlüssel]. */
export function t(key: MsgKey | string, params: Record<string, unknown> = {}): string {
  const raw = table[key];
  if (raw === undefined) return `[${key}]`;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = params[name];
    return v === undefined ? `{${name}}` : String(v);
  });
}
