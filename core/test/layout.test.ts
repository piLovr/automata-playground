import { describe, expect, it } from 'vitest';
import { autoLayout, edit, parseDocument } from '../index';
import { DEA_23, asDea, firstObject, idOf } from './fixtures';

const dea = () => asDea(firstObject(parseDocument(DEA_23).doc));

describe('autoLayout', () => {
  it('liefert für jeden Zustand ganzzahlige Positionen', () => {
    const obj = dea();
    const pos = autoLayout(obj);
    for (const s of obj.states) {
      expect(Number.isInteger(pos[s.id]?.x), `x von ${s.name}`).toBe(true);
      expect(Number.isInteger(pos[s.id]?.y), `y von ${s.name}`).toBe(true);
    }
  });

  it('ist deterministisch', () => {
    const obj = dea();
    expect(autoLayout(obj)).toEqual(autoLayout(obj));
  });

  it('Startzustand liegt in der linken Schicht (kleinstes x)', () => {
    const obj = dea();
    const pos = autoLayout(obj);
    const start = idOf(obj, 'A');
    const startX = pos[start]?.x;
    expect(startX).toBeDefined();
    for (const p of Object.values(pos) as { x: number; y: number }[]) {
      expect(startX).toBeLessThanOrEqual(p.x);
    }
  });

  it('keep: true lässt vorhandene Positionen unverändert und platziert die übrigen', () => {
    const obj = dea();
    const a = idOf(obj, 'A');
    const b = idOf(obj, 'B');
    const placed = edit.moveStates(obj, {
      [a]: { x: 10, y: 20 },
      [b]: { x: 300, y: -40 },
    });
    const pos = autoLayout(placed, { keep: true });
    expect(pos[a]).toEqual({ x: 10, y: 20 });
    expect(pos[b]).toEqual({ x: 300, y: -40 });
    for (const s of obj.states) {
      expect(Number.isInteger(pos[s.id]?.x), `x von ${s.name}`).toBe(true);
      expect(Number.isInteger(pos[s.id]?.y), `y von ${s.name}`).toBe(true);
    }
  });
});
