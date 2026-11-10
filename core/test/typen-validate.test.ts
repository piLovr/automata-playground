import { describe, expect, it } from 'vitest';
import { validate } from '../index';
import type { Diagnostic } from '../index';
import {
  MEALY_PARITAET,
  MOORE_210,
  NKA_46,
  NKA_49,
  TM_59,
  asNka,
  asTm,
  idOf,
  parseFirst,
} from './typen-fixtures';

const errors = (ds: Diagnostic[]): Diagnostic[] => ds.filter((d) => d.severity === 'error');

describe('NKA-Prüfung', () => {
  it('Übergang z0, *, 0 -> z0, 0 (Keller verliert *) ergibt Fehler nka.y0', () => {
    const text = `nka Y0Verlust {
  alphabet 0
  kelleralphabet * 0
  keller *
  states z0
  start z0
  accept z0
  z0, *, 0 -> z0, 0
}
`;
    const obj = asNka(parseFirst(text));
    const diags = validate(obj);
    const hit = diags.find((d) => d.code === 'nka.y0');
    expect(hit?.severity).toBe('error');
    expect(hit?.params.transitionId).toBe(obj.transitions[0]?.id);
  });

  it('NKA_49 liefert Warnung nka.nondeterministic (zin hat für a ε- und Leseübergänge)', () => {
    const diags = validate(asNka(parseFirst(NKA_49)));
    const hit = diags.find((d) => d.code === 'nka.nondeterministic');
    expect(hit?.severity).toBe('warning');
  });

  it('NKA_46 ohne Fehler', () => {
    expect(errors(validate(asNka(parseFirst(NKA_46))))).toEqual([]);
  });
});

describe('TM-Prüfung', () => {
  it('zwei Übergänge gleicher (z, y) ergeben tm.nondeterministic', () => {
    const text = `tm Doppelt {
  alphabet a
  bandalphabet a □
  blank □
  states r f+ f-
  start r
  accept f+
  reject f-
  r, a -> r, a, R
  r, a -> f+, a, N
}
`;
    const diags = validate(asTm(parseFirst(text)));
    expect(diags.some((d) => d.code === 'tm.nondeterministic')).toBe(true);
  });

  it('Übergang aus f+ ergibt tm.leavesFinal', () => {
    const text = `tm Verlaesst {
  alphabet a
  bandalphabet a □
  blank □
  states r f+ f-
  start r
  accept f+
  reject f-
  r, a -> f+, a, N
  f+, a -> r, a, R
}
`;
    const obj = asTm(parseFirst(text));
    const diags = validate(obj);
    const hit = diags.find((d) => d.code === 'tm.leavesFinal');
    expect(hit).toBeDefined();
    expect(hit?.params.state).toBe(idOf(obj, 'f+'));
  });

  it('TM_59 ohne Fehler', () => {
    expect(errors(validate(asTm(parseFirst(TM_59))))).toEqual([]);
  });
});

describe('Moore-Prüfung', () => {
  it('Zustand ohne out ergibt Warnung moore.missingOut', () => {
    const text = `moore OhneOut {
  alphabet 0
  ausgabealphabet 0 1
  states A B
  start A
  A -0-> B
  B -0-> A
  out A=0
}
`;
    const obj = parseFirst(text);
    const diags = validate(obj);
    const hit = diags.find((d) => d.code === 'moore.missingOut');
    expect(hit?.severity).toBe('warning');
    expect(hit?.params.states).toEqual([idOf(obj, 'B')]);
  });

  it('MOORE_210 ohne Fehler', () => {
    expect(errors(validate(parseFirst(MOORE_210)))).toEqual([]);
  });
});

describe('Mealy-Prüfung', () => {
  it('MEALY_PARITAET ohne Fehler', () => {
    expect(errors(validate(parseFirst(MEALY_PARITAET)))).toEqual([]);
  });
});
