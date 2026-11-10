import { describe, expect, it } from 'vitest';
import { edit, parseDocument, validate } from '../index';
import type { DEA, FormalObject, NEA } from '../index';
import {
  DEA_23,
  DEA_UNVOLLSTAENDIG,
  NEA_WORT,
  asDea,
  asNea,
  firstObject,
  idOf,
} from './fixtures';

const dea23 = (): DEA => asDea(firstObject(parseDocument(DEA_23).doc));
const deaUnvoll = (): DEA => asDea(firstObject(parseDocument(DEA_UNVOLLSTAENDIG).doc));
const neaWort = (): NEA => asNea(firstObject(parseDocument(NEA_WORT).doc));

const missingPairs = (o: FormalObject) =>
  validate(o)
    .filter((d) => d.code === 'dea.missing')
    .flatMap((d) => (d.params.pairs as { state: string; symbol: string }[]) ?? []);

describe('addState, renameState', () => {
  it('addState legt einen neuen Zustand mit frischer ID an, Eingabe bleibt', () => {
    const obj = dea23();
    const before = obj.states.length;
    const oldIds = obj.states.map((s) => s.id);
    const { obj: next, id } = edit.addState(obj, 'Z', { x: 1, y: 2 });
    expect(next.states).toHaveLength(before + 1);
    expect(next.states.find((s) => s.id === id)?.name).toBe('Z');
    expect(oldIds).not.toContain(id);
    expect(obj.states).toHaveLength(before);
  });

  it('renameState auf einen vorhandenen Namen wirft', () => {
    const obj = dea23();
    expect(() => edit.renameState(obj, idOf(obj, 'A'), 'B')).toThrow();
  });

  it('renameState ändert nur den Namen, IDs der Kanten bleiben', () => {
    const obj = dea23();
    const next = edit.renameState(obj, idOf(obj, 'A'), 'Start');
    expect(next.states.find((s) => s.id === idOf(obj, 'A'))?.name).toBe('Start');
    expect(next.transitions.map((t) => t.id)).toEqual(obj.transitions.map((t) => t.id));
  });
});

describe('removeStates, setStart, setAccepting', () => {
  it('removeStates entfernt Zustand, zugehörige Kanten und accept-Eintrag', () => {
    const obj = dea23();
    const m = idOf(obj, 'M');
    const next = edit.removeStates(obj, [m]);
    expect(next.states.map((s) => s.name)).toEqual(['A', 'B', 'Q']);
    expect(next.transitions.some((t) => t.from === m || t.to === m)).toBe(false);
    expect(next.start).toBe(idOf(obj, 'A'));
  });

  it('removeStates des Startzustands setzt start auf null', () => {
    const obj = dea23();
    expect(edit.removeStates(obj, [idOf(obj, 'A')]).start).toBeNull();
  });

  it('removeStates des akzeptierenden Zustands leert accept', () => {
    const obj = dea23();
    expect(edit.removeStates(obj, [idOf(obj, 'B')]).accept).toEqual([]);
  });

  it('setStart setzt und löscht den Startzustand', () => {
    const obj = dea23();
    expect(edit.setStart(obj, idOf(obj, 'M')).start).toBe(idOf(obj, 'M'));
    expect(edit.setStart(obj, null).start).toBeNull();
  });

  it('setAccepting nimmt auf und entfernt aus F', () => {
    const obj = dea23();
    const a = idOf(obj, 'A');
    const b = idOf(obj, 'B');
    expect(edit.setAccepting(obj, a, true).accept).toContain(a);
    expect(edit.setAccepting(obj, b, false).accept).not.toContain(b);
  });
});

describe('setDeaTarget, addTrapState', () => {
  it('setDeaTarget setzt eine Tabellenzelle und löscht sie mit null', () => {
    const obj = deaUnvoll();
    const x = idOf(obj, 'x');
    const y = idOf(obj, 'y');

    const set = edit.setDeaTarget(obj, x, 'b', y);
    expect(set.transitions.some((t) => t.from === x && t.label === 'b' && t.to === y)).toBe(true);
    expect(missingPairs(set)).toEqual([
      { state: y, symbol: 'a' },
      { state: y, symbol: 'b' },
    ]);

    const cleared = edit.setDeaTarget(set, x, 'b', null);
    expect(cleared.transitions.some((t) => t.from === x && t.label === 'b')).toBe(false);
    expect(missingPairs(cleared)).toContainEqual({ state: x, symbol: 'b' });
  });

  it('addTrapState auf DEA_UNVOLLSTAENDIG: danach keine dea.missing-Warnung', () => {
    const obj = deaUnvoll();
    const { obj: next, id } = edit.addTrapState(obj);
    expect(next.states.find((s) => s.id === id)?.name).toBe('fang');
    expect(missingPairs(next)).toEqual([]);
    expect(validate(next).some((d) => d.code === 'dea.missing')).toBe(false);
    // Fangzustand hat Schleifen für alle Symbole
    const loops = next.transitions.filter((t) => t.from === id && t.to === id).map((t) => t.label);
    expect(loops.sort()).toEqual(['a', 'b']);
  });
});

describe('convertKind', () => {
  it('dea -> nea -> dea erhält Kanten und Beschriftungen', () => {
    const obj = dea23();
    const nea = edit.convertKind(obj, 'nea') as NEA;
    expect(nea.kind).toBe('nea');
    expect(nea.transitions.map((t) => t.label)).toEqual(obj.transitions.map((t) => [t.label]));
    expect(nea.transitions).toHaveLength(obj.transitions.length);

    const back = edit.convertKind(nea, 'dea') as DEA;
    expect(back.kind).toBe('dea');
    expect(back.transitions.map((t) => t.label)).toEqual(obj.transitions.map((t) => t.label));
  });

  it('nea -> dea mit Wortlänge > 1 wirft', () => {
    expect(() => edit.convertKind(neaWort(), 'dea')).toThrow();
  });
});

describe('Eingabeobjekte bleiben unverändert', () => {
  const ops: [string, (o: DEA) => unknown][] = [
    ['addState', (o) => edit.addState(o, 'Z')],
    ['renameState', (o) => edit.renameState(o, idOf(o, 'A'), 'X')],
    ['moveStates', (o) => edit.moveStates(o, { [idOf(o, 'A')]: { x: 5, y: 6 } })],
    ['removeStates', (o) => edit.removeStates(o, [idOf(o, 'M')])],
    ['setStart', (o) => edit.setStart(o, null)],
    ['setAccepting', (o) => edit.setAccepting(o, idOf(o, 'A'), true)],
    ['addTransition', (o) => edit.addTransition(o, idOf(o, 'A'), idOf(o, 'M'), '1')],
    ['removeTransitions', (o) => edit.removeTransitions(o, [o.transitions[0]?.id ?? 'none'])],
    ['setDeaTarget', (o) => edit.setDeaTarget(o, idOf(o, 'A'), '0', null)],
    ['setAlphabet', (o) => edit.setAlphabet(o, ['0'])],
    ['addTrapState', (o) => edit.addTrapState(o)],
    ['convertKind', (o) => edit.convertKind(o, 'nea')],
  ];
  for (const [name, op] of ops) {
    it(name, () => {
      const obj = dea23();
      const snapshot = structuredClone(obj);
      op(obj);
      expect(obj).toEqual(snapshot);
    });
  }
});
