import { describe, expect, it } from 'vitest';
import { EXPLANATION_KEYS, METHOD_IDS } from '../../core/index';
import { de } from './de';

// Jeder Erklärungsschlüssel und jedes Verfahren braucht einen Text.
describe('Texte M2', () => {
  const table = de as Record<string, string>;
  it('alle Erklärungsschlüssel der Verfahren', () => {
    const missing = EXPLANATION_KEYS.filter(
      (k) => !(`explain.${k}` in table) && !['proc.phase', 'proc.phase.skip', 'proc.egrep.anchor'].includes(k),
    );
    expect(missing).toEqual([]);
  });
  it('alle Verfahren mit Name und Beschreibung', () => {
    const missing = METHOD_IDS.flatMap((m) => [`method.${m}`, `method.${m}.desc`]).filter((k) => !(k in table));
    expect(missing).toEqual([]);
  });
});

// Formulierungsregel (M6): „hält nicht“ u. a. nur in Schlüsseln mit Präfix halting.
describe('Formulierungsregel Halteaussagen', () => {
  const table = de as Record<string, unknown>;
  const forbidden = /hält nicht|hält nie|läuft endlos|terminiert nicht|hält niemals/i;
  it('verbotene Wendungen nur in halting.-Schlüsseln', () => {
    const bad = Object.entries(table)
      .filter(([k, v]) => typeof v === 'string' && !k.startsWith('halting.') && forbidden.test(v.normalize('NFC')))
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });
});
