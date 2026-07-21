import { describe, expect, it } from 'vitest';
import { isRecord } from '@/lib/guards';

describe('isRecord', () => {
  it('accepts non-array objects', () => {
    expect(isRecord({ key: 'value' })).toBe(true);
  });

  it('accepts empty objects', () => {
    expect(isRecord({})).toBe(true);
  });

  it('accepts objects with numeric keys', () => {
    expect(isRecord({ 0: 'a', 1: 'b' })).toBe(true);
  });

  it('rejects null', () => {
    expect(isRecord(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isRecord(undefined)).toBe(false);
  });

  it('rejects arrays', () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord([1, 2, 3])).toBe(false);
  });

  it('rejects primitives', () => {
    expect(isRecord('value')).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(true)).toBe(false);
    expect(isRecord(false)).toBe(false);
    expect(isRecord(Symbol('test'))).toBe(false);
  });

  it('rejects functions', () => {
    expect(isRecord(() => {})).toBe(false);
    expect(isRecord(function named() {})).toBe(false);
  });

  it('accepts Date instances as records', () => {
    expect(isRecord(new Date())).toBe(true);
  });

  it('accepts Map and Set as records', () => {
    expect(isRecord(new Map())).toBe(true);
    expect(isRecord(new Set())).toBe(true);
  });

  it('accepts Object.create(null) plain records', () => {
    expect(isRecord(Object.create(null))).toBe(true);
  });
});
