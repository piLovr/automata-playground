import { describe, expect, it } from 'vitest';
import { countByLength, parseDocument, wordsPage } from '../index';

// Fehlerbericht: Tippen von `[0-9]` im egrep-Editor fror die Seite ein. Die Wortprobe lief
// über enumerate (Mengen-Semantik, ~10^6 Wörter je Teilausdruck). Wortprobe und Zählung
// gehen über den DEA und müssen auch bei großem Alphabet sofort fertig sein.
describe('egrep [0-9]: Wortliste und Zählung bleiben schnell', () => {
  const o = parseDocument('egrep E0 = [0-9]\n').doc.objects[0]!;

  it('wordsPage bis Länge 6 in unter einer Sekunde', () => {
    const t0 = performance.now();
    const r = wordsPage(o, { maxLen: 6, offset: 0, limit: 24 });
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(r.ok && r.result.words.slice(0, 3).map((w) => w.join(''))).toEqual(['0', '1', '2']);
  });

  it('countByLength: jede nichtleere Zeile über {0,…,9} passt', () => {
    const r = countByLength(o, 6);
    expect(r.ok && r.result.counts.map(String)).toEqual(['0', '10', '100', '1000', '10000', '100000', '1000000']);
  });
});
