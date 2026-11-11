// JSON-Form des Dokuments: { version: 1, objects: [...] } mit Strukturprüfung.
import { findKindByKeyword } from '../model/kinds';
import { METHOD_IDS } from '../model/methods';
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

const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

function checkExpr(e: unknown, path: string): void {
  check(isObj(e), `${path}: object expected`);
  const x = e as Obj;
  switch (x.op) {
    case 'empty':
      return;
    case 'sym':
      check(isStr(x.sym), `${path}.sym: string expected`);
      return;
    case 'star':
      checkExpr(x.inner, `${path}.inner`);
      return;
    case 'union':
    case 'concat':
      checkExpr(x.left, `${path}.left`);
      checkExpr(x.right, `${path}.right`);
      return;
    default:
      check(false, `${path}.op: empty, sym, union, concat or star expected`);
  }
}

function checkElem(e: unknown, path: string): void {
  check(isObj(e), `${path}: object expected`);
  const x = e as Obj;
  const keys = ['state', 'transition', 'nonterminal', 'production'].filter((k) => k in x);
  if (keys.length === 1) {
    check(isStr(x[keys[0] as string]), `${path}.${keys[0]}: string expected`);
  } else {
    check(
      keys.length === 0 && Array.isArray(x.subexpr) && x.subexpr.every((n) => typeof n === 'number' && Number.isInteger(n)),
      `${path}: element reference expected`,
    );
  }
}

function checkOrigin(v: unknown, path: string): void {
  if (v === undefined) return;
  check(isObj(v), `${path}: object expected`);
  const o = v as Obj;
  check(isStr(o.method) && (METHOD_IDS as readonly string[]).includes(o.method), `${path}.method: known method expected`);
  check(isStrArr(o.sources), `${path}.sources: string[] expected`);
  check(isStrArr(o.sourceHash), `${path}.sourceHash: string[] expected`);
  if (o.corr !== undefined) {
    check(Array.isArray(o.corr), `${path}.corr: array expected`);
    (o.corr as unknown[]).forEach((c, i) => {
      const p = `${path}.corr[${i}]`;
      check(isObj(c), `${p}: object expected`);
      const cc = c as Obj;
      checkElem(cc.target, `${p}.target`);
      check(typeof cc.source === 'number' && Number.isInteger(cc.source), `${p}.source: integer expected`);
      check(Array.isArray(cc.elems), `${p}.elems: array expected`);
      (cc.elems as unknown[]).forEach((e, k) => checkElem(e, `${p}.elems[${k}]`));
    });
  }
}

function checkObject(o: unknown, path: string): void {
  check(isObj(o), `${path}: object expected`);
  const obj = o as Obj;
  check(isStr(obj.kind), `${path}.kind: string expected`);
  if (obj.kind === 'regex') {
    check(isStr(obj.name), `${path}.name: string expected`);
    check(isStrArr(obj.alphabet), `${path}.alphabet: string[] expected`);
    if (obj.expr !== null) checkExpr(obj.expr, `${path}.expr`);
    checkOrigin(obj.origin, `${path}.origin`);
    return;
  }
  if (obj.kind === 'egrep') {
    check(isStr(obj.name), `${path}.name: string expected`);
    check(isStr(obj.pattern), `${path}.pattern: string expected`);
    check(isStrArr(obj.alphabet), `${path}.alphabet: string[] expected`);
    checkOrigin(obj.origin, `${path}.origin`);
    return;
  }
  if (obj.kind === 'menge') {
    check(isStr(obj.name), `${path}.name: string expected`);
    check(isStrArr(obj.alphabet), `${path}.alphabet: string[] expected`);
    check(Array.isArray(obj.words) && obj.words.every(isStrArr), `${path}.words: string[][] expected`);
    check(obj.upTo === undefined || (typeof obj.upTo === 'number' && Number.isInteger(obj.upTo) && obj.upTo >= 0), `${path}.upTo: integer expected`);
    checkOrigin(obj.origin, `${path}.origin`);
    return;
  }
  if (obj.kind === 'grammatik') {
    check(isStr(obj.name), `${path}.name: string expected`);
    check(isStrArr(obj.nonterminals), `${path}.nonterminals: string[] expected`);
    check(isStrArr(obj.terminals), `${path}.terminals: string[] expected`);
    check(obj.start === null || isStr(obj.start), `${path}.start: string or null expected`);
    check(Array.isArray(obj.productions), `${path}.productions: array expected`);
    const pids = new Set<string>();
    (obj.productions as unknown[]).forEach((p, i) => {
      const q = `${path}.productions[${i}]`;
      check(isObj(p), `${q}: object expected`);
      const pr = p as Obj;
      check(isStr(pr.id), `${q}.id: string expected`);
      check(!pids.has(pr.id as string), `${q}.id: duplicate id`);
      pids.add(pr.id as string);
      check(isStrArr(pr.left), `${q}.left: string[] expected`);
      check(isStrArr(pr.right), `${q}.right: string[] expected`);
    });
    checkOrigin(obj.origin, `${path}.origin`);
    return;
  }
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
  checkOrigin(obj.origin, `${path}.origin`);
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
