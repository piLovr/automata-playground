import { describe, expect, it } from 'vitest';
import { spreadLabels, STATE_R } from './geometry';

describe('spreadLabels', () => {
  const box = (x: number, y: number, w = 80) => ({ at: { x, y }, w, h: 16 });

  it('lässt freie Beschriftungen unverändert', () => {
    const out = spreadLabels([box(0, 0), box(0, 100)], []);
    expect(out).toEqual([{ x: 0, y: 0 }, { x: 0, y: 100 }]);
  });

  it('trennt sich überlappende Beschriftungen', () => {
    const [a, b] = spreadLabels([box(0, 0), box(10, 4)], []);
    expect(Math.abs(a!.x - b!.x) >= 80 || Math.abs(a!.y - b!.y) >= 16).toBe(true);
  });

  it('hält Beschriftungen aus Zustandskreisen heraus', () => {
    const [a] = spreadLabels([box(0, 0, 40)], [{ x: 5, y: 3 }]);
    const dx = Math.max(a!.x - 20 - 5, 0, 5 - (a!.x + 20));
    const dy = Math.max(a!.y - 8 - 3, 0, 3 - (a!.y + 8));
    expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(STATE_R);
  });
});
