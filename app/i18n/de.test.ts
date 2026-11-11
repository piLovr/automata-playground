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
