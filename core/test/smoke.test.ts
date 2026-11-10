import { describe, expect, it } from 'vitest';
import { CORE_VERSION } from '../index';

describe('core', () => {
  it('hat die Version 1', () => {
    expect(CORE_VERSION).toBe(1);
  });
});
