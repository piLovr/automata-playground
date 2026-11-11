// Konstruktoren für Ausdrücke mit optionaler Vereinfachung (Entscheidung 2) und Größenverwaltung.
import type { RegExpr } from '../model/types';

const sizes = new WeakMap<RegExpr, number>();

export function size(e: RegExpr): number {
  const c = sizes.get(e);
  if (c !== undefined) return c;
  let s: number;
  switch (e.op) {
    case 'empty':
    case 'sym':
      s = 1;
      break;
    case 'star':
      s = 1 + size(e.inner);
      break;
    default:
      s = 1 + size(e.left) + size(e.right);
  }
  sizes.set(e, s);
  return s;
}

export const EMPTY: RegExpr = { op: 'empty' };
export const EPS: RegExpr = { op: 'star', inner: EMPTY };

export const isEmpty = (e: RegExpr): boolean => e.op === 'empty';
export const isEps = (e: RegExpr): boolean => e.op === 'star' && e.inner.op === 'empty';

export function eq(a: RegExpr, b: RegExpr): boolean {
  if (a === b) return true;
  if (size(a) !== size(b) || a.op !== b.op) return false;
  switch (a.op) {
    case 'empty':
      return true;
    case 'sym':
      return a.sym === (b as typeof a).sym;
    case 'star':
      return eq(a.inner, (b as typeof a).inner);
    default:
      return eq(a.left, (b as typeof a).left) && eq(a.right, (b as typeof a).right);
  }
}

export interface Ctor {
  union(a: RegExpr, b: RegExpr): RegExpr;
  concat(a: RegExpr, b: RegExpr): RegExpr;
  star(a: RegExpr): RegExpr;
}

export function ctor(simplify: boolean): Ctor {
  return {
    union(a, b) {
      if (simplify) {
        if (isEmpty(a)) return b;
        if (isEmpty(b)) return a;
        if (eq(a, b)) return a;
      }
      return { op: 'union', left: a, right: b };
    },
    concat(a, b) {
      if (simplify) {
        if (isEmpty(a) || isEmpty(b)) return EMPTY;
        if (isEps(a)) return b;
        if (isEps(b)) return a;
      }
      return { op: 'concat', left: a, right: b };
    },
    star(a) {
      if (simplify && isEps(a)) return a;
      return { op: 'star', inner: a };
    },
  };
}

export function unionAll(c: Ctor, list: RegExpr[]): RegExpr {
  if (list.length === 0) return EMPTY;
  let r = list[0] as RegExpr;
  for (let i = 1; i < list.length; i++) r = c.union(r, list[i] as RegExpr);
  return r;
}

export function cloneExpr(e: RegExpr): RegExpr {
  switch (e.op) {
    case 'empty':
      return { op: 'empty' };
    case 'sym':
      return { op: 'sym', sym: e.sym };
    case 'star':
      return { op: 'star', inner: cloneExpr(e.inner) };
    default:
      return { op: e.op, left: cloneExpr(e.left), right: cloneExpr(e.right) };
  }
}
