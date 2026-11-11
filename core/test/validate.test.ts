import { describe, expect, it } from 'vitest';
import { parseDocument, validate } from '../index';
import { DEA_23, DEA_UNVOLLSTAENDIG, asAut, asDea, firstObject, idOf } from './fixtures';

describe('validate', () => {
  it('DEA_23 ist ohne Fehler und ohne dea.missing', () => {
    const obj = firstObject(parseDocument(DEA_23).doc);
    const diags = validate(obj);
    expect(diags.filter((d) => d.severity === 'error')).toEqual([]);
    expect(diags.some((d) => d.code === 'dea.missing')).toBe(false);
    expect(diags).toEqual([]);
  });

  it('DEA_UNVOLLSTAENDIG: genau eine Warnung dea.missing mit den drei Paaren in Tabellenreihenfolge', () => {
    const obj = asAut(firstObject(parseDocument(DEA_UNVOLLSTAENDIG).doc));
    const diags = validate(obj);
    expect(diags).toHaveLength(1);
    const [d] = diags;
    expect(d?.code).toBe('dea.missing');
    expect(d?.severity).toBe('warning');
    expect(d?.params.pairs).toEqual([
      { state: idOf(obj, 'x'), symbol: 'b' },
      { state: idOf(obj, 'y'), symbol: 'a' },
      { state: idOf(obj, 'y'), symbol: 'b' },
    ]);
  });

  it('zwei Kanten x -a-> … ergeben dea.nondeterministic', () => {
    const text = 'dea ND {\n  alphabet a\n  start x\n  x -a-> y\n  x -a-> x\n  y -a-> y\n}\n';
    const obj = asDea(firstObject(parseDocument(text).doc));
    const diags = validate(obj);
    const d = diags.find((x) => x.code === 'dea.nondeterministic');
    expect(d).toBeDefined();
    expect(d?.severity).toBe('error');
    expect(d?.params.symbol).toBe('a');
    expect(d?.params.state).toBe(idOf(obj, 'x'));
    expect(d?.params.transitionIds as string[] | undefined).toHaveLength(2);
  });

  it('ohne start ergibt model.noStart', () => {
    const text = 'dea NS {\n  alphabet a\n  A -a-> A\n}\n';
    const diags = validate(firstObject(parseDocument(text).doc));
    expect(diags.some((d) => d.code === 'model.noStart' && d.severity === 'error')).toBe(true);
  });
});
