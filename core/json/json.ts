// JSON-Form des Dokuments: { version: 1, objects: [...] } mit Strukturprüfung.
import { findKindByKeyword } from '../model/kinds';
import type { Diagnostic, Document } from '../model/types';

export function toJSON(doc: Document): string {
  return JSON.stringify(doc, null, 2);
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

class Invalid extends Error {}

function check(cond: boolean, reason: string): void {
  if (!cond) throw new Invalid(reason);
}

function checkObject(o: unknown, path: string): void {
  check(isObj(o), `${path}: object expected`);
  const obj = o as Obj;
  check(isStr(obj.kind), `${path}.kind: string expected`);
  const spec = findKindByKeyword(obj.kind as string);
  check(spec !== undefined, `${path}.kind: unknown kind ${String(obj.kind)}`);
  check(isStr(obj.name), `${path}.name: string expected`);
  check(Array.isArray(obj.alphabet) && obj.alphabet.every(isStr), `${path}.alphabet: string[] expected`);
  check(Array.isArray(obj.states), `${path}.states: array expected`);
  const ids = new Set<string>();
  (obj.states as unknown[]).forEach((s, i) => {
    const p = `${path}.states[${i}]`;
    check(isObj(s), `${p}: object expected`);
    const st = s as Obj;
    check(isStr(st.id), `${p}.id: string expected`);
    check(isStr(st.name), `${p}.name: string expected`);
    check(!ids.has(st.id as string), `${p}.id: duplicate id`);
    ids.add(st.id as string);
    if (st.pos !== undefined) {
      check(isObj(st.pos) && isNum(st.pos.x) && isNum(st.pos.y), `${p}.pos: {x,y} expected`);
    }
  });
  check(obj.start === null || (isStr(obj.start) && ids.has(obj.start)), `${path}.start: unknown state`);
  check(
    Array.isArray(obj.accept) && obj.accept.every((a) => isStr(a) && ids.has(a)),
    `${path}.accept: existing state ids expected`,
  );
  check(Array.isArray(obj.transitions), `${path}.transitions: array expected`);
  const tids = new Set<string>();
  (obj.transitions as unknown[]).forEach((t, i) => {
    const p = `${path}.transitions[${i}]`;
    check(isObj(t), `${p}: object expected`);
    const tr = t as Obj;
    check(isStr(tr.id), `${p}.id: string expected`);
    check(!tids.has(tr.id as string), `${p}.id: duplicate id`);
    tids.add(tr.id as string);
    check(isStr(tr.from) && ids.has(tr.from), `${p}.from: unknown state`);
    check(isStr(tr.to) && ids.has(tr.to), `${p}.to: unknown state`);
  });
  const reason = (spec as NonNullable<typeof spec>).checkJson(obj, ids);
  check(reason === null, `${path}.${reason ?? ''}`);
}

export function fromJSON(json: string): { doc?: Document; diagnostics: Diagnostic[] } {
  const fail = (reason: string): { diagnostics: Diagnostic[] } => ({
    diagnostics: [{ severity: 'error', code: 'json.invalid', params: { reason } }],
  });
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return fail('syntax');
  }
  if (!isObj(data)) return fail('root: object expected');
  if (data.version !== 1) {
    return { diagnostics: [{ severity: 'error', code: 'json.version', params: { version: data.version } }] };
  }
  try {
    check(Array.isArray(data.objects), 'objects: array expected');
    (data.objects as unknown[]).forEach((o, i) => checkObject(o, `objects[${i}]`));
  } catch (e) {
    if (e instanceof Invalid) return fail(e.message);
    throw e;
  }
  return { doc: data as unknown as Document, diagnostics: [] };
}
