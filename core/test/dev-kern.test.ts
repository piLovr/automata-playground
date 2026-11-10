import { describe, expect, it } from 'vitest';
import {
  autoLayout, edit, fromJSON, parseDocument, parseWord, printDocument, printWord, reconcile,
  runBatch, simulate, toJSON, validate, epsilonClosure,
} from '../index';
import type { DEA, NEA } from '../index';

const dual = `
dea Dualzahl {
  alphabet 0 1 \\-
  start A
  accept B
  A -0,1-> B
  A -\\--> M
  B -0,1-> B
  layout A@80,120 B@240,120 M@80,260
}
`;

describe('dev text', () => {
  it('roundtrip', () => {
    const { doc, diagnostics } = parseDocument(dual);
    expect(diagnostics).toEqual([]);
    const o = doc.objects[0] as DEA;
    expect(o.alphabet).toEqual(['0', '1', '-']);
    const t = printDocument(doc);
    expect(parseDocument(t).doc).toEqual(doc);
    expect(printDocument(parseDocument(t).doc)).toBe(t);
    expect(fromJSON(toJSON(doc)).doc).toEqual(doc);
  });
  it('nea mit eps und Wortkanten', () => {
    const { doc, diagnostics } = parseDocument('nea N {\n start a\n accept c\n a -ab,ε-> b\n b -eps-> c\n c -<xy>-> c\n}\n');
    expect(diagnostics).toEqual([]);
    const o = doc.objects[0] as NEA;
    expect(o.transitions.map((t) => t.label)).toEqual([['a', 'b'], [], [], ['xy']]);
    const t = printDocument(doc);
    expect(t).toContain('a -ab,ε-> b');
    expect(printDocument(parseDocument(t).doc)).toBe(t);
    expect(printWord(['e', 'p', 's'])).toBe('\\eps');
    expect(parseWord(printWord(['e', 'p', 's'])).word).toEqual(['e', 'p', 's']);
  });
  it('Fehler', () => {
    const r = parseDocument('dea X {\n start A\n A --> B\n A -0-> \n}\nfoo Y { }\n');
    expect(r.diagnostics.map((d) => d.code)).toContain('syntax.unexpected');
    expect(r.diagnostics.some((d) => d.code === 'syntax.unknownKind')).toBe(true);
    expect(r.diagnostics[0]).toMatchObject({ line: 3, col: 5 });
  });
  it('validate', () => {
    const { doc } = parseDocument('dea X { alphabet a b\n start A\n A -a-> B\n A -a-> A }');
    const codes = validate(doc.objects[0]!).map((d) => d.code);
    expect(codes).toEqual(['dea.nondeterministic', 'dea.missing']);
  });
});

describe('dev sim', () => {
  const nea = parseDocument('nea N { start a\n accept c\n a -ε-> b\n b -ε-> a\n b -xy-> c\n}').doc.objects[0] as NEA;
  it('eps-Zyklus terminiert, Wortkante', () => {
    const tr = simulate(nea, ['x', 'y']);
    expect(tr.result).toBe('accepted');
    expect(tr.steps.map((s) => s.active.length)).toEqual([2, 0, 1]);
    expect(tr.tree!.some((n) => n.status === 'cycle')).toBe(true);
    expect(epsilonClosure(nea, ['s0']).length).toBe(2);
    expect(simulate(nea, ['x']).result).toBe('stuck');
    expect(simulate(nea, ['y', 'y'], { stepLimit: 3 }).result).not.toBe('accepted');
  });
  it('dea', () => {
    const d = parseDocument(dual).doc.objects[0] as DEA;
    const tr = simulate(d, ['1', '0']);
    expect(tr.result).toBe('accepted');
    expect(tr.stateSequence!.length).toBe(3);
    expect(runBatch(d, [{ word: ['1'], expected: false }])[0]!.ok).toBe(false);
  });
});

describe('dev edit', () => {
  it('ops', () => {
    const d = parseDocument(dual).doc.objects[0] as DEA;
    const copy = JSON.stringify(d);
    const { obj, id } = edit.addTrapState(d);
    expect(JSON.stringify(d)).toBe(copy);
    expect(validate(obj).some((x) => x.code === 'dea.missing')).toBe(false);
    expect(id).toBe('s3');
    const n = edit.convertKind(d, 'nea');
    expect(edit.convertKind(n, 'dea')).toEqual(d);
    const frag = edit.copyStates(d, ['s0', 's1']);
    expect(edit.pasteFragment(d, frag, { x: 10, y: 0 }).obj.states.length).toBe(5);
    const p = reconcile(d, parseDocument(dual.replaceAll('A', 'Q')).doc.objects[0]!);
    expect(p.states.length).toBe(3);
    const lay = autoLayout(d);
    expect(Object.keys(lay).length).toBe(3);
    expect(autoLayout(d)).toEqual(lay);
  });
});
