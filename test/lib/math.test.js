import { describe, it, expect } from 'vitest';
import {
  clamp,
  clamp01,
  clampFiniteNumber,
  finiteNumberOr,
  finiteNumberOrUndefined,
  isFiniteNumber,
  lerp,
} from '@/lib/math';

describe('clamp', () => {
  it('returns value within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to min', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });

  it('clamps to max', () => {
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('returns min when value equals min', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it('returns max when value equals max', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('handles NaN (Math.min/max propagation)', () => {
    expect(clamp(NaN, 0, 10)).toBeNaN();
  });

  it('handles negative ranges', () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
  });
});

describe('numeric helpers', () => {
  it('clamps a normalized number', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.25)).toBe(0.25);
    expect(clamp01(2)).toBe(1);
  });

  it('coerces finite values before clamping', () => {
    expect(clampFiniteNumber('0.4', 0, 1)).toBe(0.4);
    expect(clampFiniteNumber('invalid', 0, 1)).toBe(0);
  });

  it('interpolates between numeric values', () => {
    expect(lerp(10, 30, 0.25)).toBe(15);
  });

  it('accepts only finite numbers', () => {
    expect(isFiniteNumber(2)).toBe(true);
    expect(isFiniteNumber(NaN)).toBe(false);
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber('2')).toBe(false);
  });

  it('returns explicit fallbacks for invalid values', () => {
    expect(finiteNumberOrUndefined(NaN)).toBeUndefined();
    expect(finiteNumberOrUndefined(4)).toBe(4);
    expect(finiteNumberOr('4', 12)).toBe(12);
    expect(finiteNumberOr(4, 12)).toBe(4);
  });
});
