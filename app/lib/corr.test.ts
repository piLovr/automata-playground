import { describe, expect, it } from 'vitest';
import type { Document, FormalObject } from '../../core/index';
import { chainEdges, related } from './corr';

const nea = { kind: 'nea', name: 'N', alphabet: ['a'], states: [{ id: 's0', name: 'A' }, { id: 's1', name: 'B' }], start: 's0', accept: [], transitions: [] } as FormalObject;
const dea = {
  kind: 'dea',
  name: 'M',
  alphabet: ['a'],
  states: [{ id: 's0', name: 'AB' }, { id: 's1', name: 'A' }],
  start: 's0',
  accept: [],
  transitions: [],
  origin: {
    method: 'nea2dea',
    sources: ['N'],
    sourceHash: ['x'],
    corr: [
      { target: { state: 's0' }, source: 0, elems: [{ state: 's0' }, { state: 's1' }] },
      { target: { state: 's1' }, source: 0, elems: [{ state: 's0' }] },
    ],
  },
} as FormalObject;
const min = {
  kind: 'dea',
  name: 'K',
  alphabet: ['a'],
  states: [{ id: 's0', name: 'X' }],
  start: 's0',
  accept: [],
  transitions: [],
  origin: { method: 'minimize', sources: ['M'], sourceHash: ['y'], corr: [{ target: { state: 's0' }, source: 0, elems: [{ state: 's0' }, { state: 's1' }] }] },
} as FormalObject;
const doc: Document = { version: 1, objects: [nea, dea, min] };

describe('Entsprechungen', () => {
  it('läuft aufwärts transitiv bis zur ersten Quelle', () => {
    const r = related(doc, 'K', { state: 's0' });
    expect([...r.get('M')!]).toEqual(['z:s0', 'z:s1']);
    expect([...r.get('N')!].sort()).toEqual(['z:s0', 'z:s1']);
  });
  it('läuft abwärts, ohne über Geschwister zu springen', () => {
    const r = related(doc, 'M', { state: 's1' });
    expect([...r.get('N')!]).toEqual(['z:s0']);
    expect([...r.get('K')!]).toEqual(['z:s0']);
    // nicht zurück zu M.s0 über N.s0
    expect([...r.get('M')!]).toEqual(['z:s1']);
  });
  it('liefert die Kette', () => {
    expect(chainEdges(doc)).toEqual([
      { from: 'N', to: 'M', method: 'nea2dea' },
      { from: 'M', to: 'K', method: 'minimize' },
    ]);
  });
});
