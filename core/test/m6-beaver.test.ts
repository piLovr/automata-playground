import { describe, expect, it } from 'vitest';
import { beaverTm, busyBeaver } from '../m6/beaver';

describe('Fleißiger Biber', () => {
  it('BB(1..3) = 1, 4, 6', () => {
    expect(busyBeaver({ n: 1, stepLimit: 200 }).best?.ones).toBe(1);
    expect(busyBeaver({ n: 2, stepLimit: 200 }).best?.ones).toBe(4);
    expect(busyBeaver({ n: 3, stepLimit: 200 }).best?.ones).toBe(6);
  });
  it('n = 4, stepLimit 200 ergibt 13', () => {
    const t = Date.now();
    const r = busyBeaver({ n: 4, stepLimit: 200 });
    expect(r.best?.ones).toBe(13);
    expect(r.best?.steps).toBe(107);
    expect(r.complete).toBe(true);
    expect(r.halted + r.provenLoop + r.undecided).toBe(r.enumerated);
    expect(Date.now() - t).toBeLessThan(20000);
  }, 60000);
  it('Abbruch', () => {
    const r = busyBeaver({ n: 4, stepLimit: 50 }, () => true);
    expect(r.complete).toBe(false);
  });
  it('6-Zustands-Biber aus 5.41', () => {
    const tm = beaverTm(6, 'B1R E□L C1L A□R D1L C□R E1L F□L A1L C1L E1L Z1R');
    expect(tm.states.length).toBe(7);
    expect(tm.transitions.length).toBe(12);
    expect(tm.start).toBe('A');
    expect(tm.accept).toEqual(['Z']);
  });
});
