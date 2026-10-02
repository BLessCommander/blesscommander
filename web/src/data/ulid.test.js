import { describe, expect, it } from 'vitest';
import { ulid, ULID_PATTERN } from './ulid.js';

describe('UT-DATA identificativi ULID', () => {
  it('ha 26 caratteri validi', () => {
    expect(ulid()).toMatch(new RegExp(ULID_PATTERN));
  });

  it('è unico anche nello stesso millisecondo', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => ulid(1_700_000_000_000)));
    expect(ids.size).toBe(1000);
  });

  it('si ordina per data', () => {
    expect(ulid(1_700_000_000_000) < ulid(1_700_000_001_000)).toBe(true);
  });

  it('con tempo e casualità fissi dà sempre lo stesso risultato', () => {
    const fixed = () => new Uint8Array(10);
    expect(ulid(0, fixed)).toBe('00000000000000000000000000');
  });
});
