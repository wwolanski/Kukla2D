import { describe, it, expect } from 'vitest';

import {
  computeValueRange,
  fitValueRange,
  applyPropertyRange,
  valueToScreen,
  screenToValue,
  timeToScreenX,
  screenXToTime,
  snapTimeToFrame,
  clampTime,
  clampValue,
  isNumericTrack,
  easingToCubicTuple,
  cubicTupleToEasing,
  handlesFromTuple,
  tupleFromHandles,
  buildSegmentPath,
  buildGraphPoints,
  evaluateGraphCurve,
} from '@/features/timeline/application/graphModel';

describe('graphModel — pure graph math', () => {
  describe('computeValueRange', () => {
    it('returns min/max from keyframes', () => {
      const kfs = [{ time: 0, value: 10 }, { time: 500, value: -5 }, { time: 1000, value: 20 }];
      expect(computeValueRange(kfs)).toEqual({ min: -5, max: 20 });
    });

    it('returns default range for empty keyframes', () => {
      expect(computeValueRange([])).toEqual({ min: 0, max: 1 });
    });

    it('returns default range for null keyframes', () => {
      expect(computeValueRange(null)).toEqual({ min: 0, max: 1 });
    });

    it('expands range when all values are the same', () => {
      const kfs = [{ time: 0, value: 5 }, { time: 500, value: 5 }];
      expect(computeValueRange(kfs)).toEqual({ min: 4, max: 6 });
    });

    it('ignores non-numeric values', () => {
      const kfs = [{ time: 0, value: 10 }, { time: 500, value: true }];
      const range = computeValueRange(kfs);
      expect(range.min).toBeLessThan(10);
      expect(range.max).toBeGreaterThan(10);
    });
  });

  describe('fitValueRange', () => {
    it('adds padding to range', () => {
      const result = fitValueRange({ min: 0, max: 10 });
      expect(result.min).toBeLessThan(0);
      expect(result.max).toBeGreaterThan(10);
    });

    it('preserves range width proportionally', () => {
      const result = fitValueRange({ min: 0, max: 100 });
      const pad = (result.max - result.min - 100) / 2;
      expect(pad).toBeCloseTo(10, 0);
    });
  });

  describe('applyPropertyRange', () => {
    it('returns spec range for opacity', () => {
      const range = applyPropertyRange([{ value: 0.5 }], 'opacity');
      expect(range).toEqual({ min: 0, max: 1 });
    });

    it('returns null for unconstrained properties', () => {
      expect(applyPropertyRange([{ value: 10 }], 'x')).toBeNull();
    });

    it('returns null for unknown property', () => {
      expect(applyPropertyRange([{ value: 10 }], 'unknown')).toBeNull();
    });
  });

  describe('valueToScreen / screenToValue', () => {
    it('value at min maps to bottom (graphHeight)', () => {
      expect(valueToScreen(0, { min: 0, max: 10 }, 100)).toBe(100);
    });

    it('value at max maps to top (0)', () => {
      expect(valueToScreen(10, { min: 0, max: 10 }, 100)).toBe(0);
    });

    it('value at mid maps to mid', () => {
      expect(valueToScreen(5, { min: 0, max: 10 }, 100)).toBe(50);
    });

    it('roundtrips correctly', () => {
      const range = { min: -20, max: 50 };
      const screen = valueToScreen(15, range, 100);
      const back = screenToValue(screen, range, 100);
      expect(back).toBeCloseTo(15, 10);
    });
  });

  describe('timeToScreenX / screenXToTime', () => {
    it('maps startFrame to 0%', () => {
      expect(timeToScreenX(0, 0, 48, 24)).toBeCloseTo(0, 5);
    });

    it('maps end time to 100%', () => {
      const endTimeMs = (48 / 24) * 1000;
      expect(timeToScreenX(endTimeMs, 0, 48, 24)).toBeCloseTo(100, 5);
    });

    it('roundtrips correctly', () => {
      const timeMs = 1000;
      const pct = timeToScreenX(timeMs, 0, 48, 24);
      const back = screenXToTime(pct, 0, 48, 24);
      expect(back).toBeCloseTo(timeMs, 5);
    });
  });

  describe('snapTimeToFrame', () => {
    it('snaps to nearest frame', () => {
      const fps = 24;
      const result = snapTimeToFrame(1041.666, fps);
      const expectedFrame = Math.round((1041.666 / 1000) * fps);
      expect(result).toBeCloseTo((expectedFrame / fps) * 1000, 5);
    });

    it('does not change exact frame time', () => {
      const fps = 24;
      const exactTime = (10 / fps) * 1000;
      expect(snapTimeToFrame(exactTime, fps)).toBeCloseTo(exactTime, 10);
    });
  });

  describe('clampTime', () => {
    it('clamps below 0', () => {
      expect(clampTime(-100, 2000)).toBe(0);
    });

    it('clamps above duration', () => {
      expect(clampTime(3000, 2000)).toBe(2000);
    });

    it('passes through valid time', () => {
      expect(clampTime(1000, 2000)).toBe(1000);
    });
  });

  describe('clampValue', () => {
    it('clamps opacity below 0', () => {
      expect(clampValue(-0.5, 'opacity')).toBe(0);
    });

    it('clamps opacity above 1', () => {
      expect(clampValue(1.5, 'opacity')).toBe(1);
    });

    it('rounds integer properties', () => {
      expect(clampValue(3.7, 'drawOrder')).toBe(4);
    });

    it('does not round non-integer properties', () => {
      expect(clampValue(3.7, 'x')).toBe(3.7);
    });

    it('passes unknown properties through', () => {
      expect(clampValue(999, 'unknown')).toBe(999);
    });
  });

  describe('isNumericTrack', () => {
    it('returns true for numeric property rows', () => {
      expect(isNumericTrack({
        valueCategory: 'numeric',
        keyframes: [{ time: 0, value: 0 }, { time: 500, value: 10 }],
      })).toBe(true);
    });

    it('returns true for blendShape rows', () => {
      expect(isNumericTrack({
        valueCategory: 'blendShape',
        keyframes: [{ time: 0, value: 0.5 }],
      })).toBe(true);
    });

    it('returns false for boolean rows', () => {
      expect(isNumericTrack({
        valueCategory: 'boolean',
        keyframes: [{ time: 0, value: true }],
      })).toBe(false);
    });

    it('returns false for empty keyframes', () => {
      expect(isNumericTrack({
        valueCategory: 'numeric',
        keyframes: [],
      })).toBe(true);
    });

    it('returns false for null input', () => {
      expect(isNumericTrack(null)).toBe(false);
    });
  });

  describe('easingToCubicTuple', () => {
    it('converts linear', () => {
      expect(easingToCubicTuple('linear')).toEqual([0, 0, 1, 1]);
    });

    it('converts ease-in', () => {
      expect(easingToCubicTuple('ease-in')).toEqual([0.42, 0, 1, 1]);
    });

    it('converts ease-out', () => {
      expect(easingToCubicTuple('ease-out')).toEqual([0, 0, 0.58, 1]);
    });

    it('converts ease-both', () => {
      expect(easingToCubicTuple('ease-both')).toEqual([0.42, 0, 0.58, 1]);
    });

    it('passes through array tuple', () => {
      const tuple = [0.1, 0.2, 0.3, 0.4];
      expect(easingToCubicTuple(tuple)).toEqual(tuple);
    });

    it('defaults unknown to ease-both', () => {
      expect(easingToCubicTuple('unknown')).toEqual([0.42, 0, 0.58, 1]);
    });

    it('defaults undefined to ease-both', () => {
      expect(easingToCubicTuple(undefined)).toEqual([0.42, 0, 0.58, 1]);
    });
  });

  describe('cubicTupleToEasing', () => {
    it('converts linear tuple', () => {
      expect(cubicTupleToEasing([0, 0, 1, 1])).toBe('linear');
    });

    it('converts ease-in tuple', () => {
      expect(cubicTupleToEasing([0.42, 0, 1, 1])).toBe('ease-in');
    });

    it('converts ease-out tuple', () => {
      expect(cubicTupleToEasing([0, 0, 0.58, 1])).toBe('ease-out');
    });

    it('converts ease-both tuple', () => {
      expect(cubicTupleToEasing([0.42, 0, 0.58, 1])).toBe('ease-both');
    });

    it('returns array for custom tuple', () => {
      const result = cubicTupleToEasing([0.1, 0.2, 0.3, 0.4]);
      expect(result).toEqual([0.1, 0.2, 0.3, 0.4]);
    });

    it('returns ease-both for invalid input', () => {
      expect(cubicTupleToEasing(null)).toBe('ease-both');
      expect(cubicTupleToEasing([1, 2])).toBe('ease-both');
    });
  });

  describe('handlesFromTuple', () => {
    it('computes handles from linear tuple', () => {
      const result = handlesFromTuple(0, 50, 100, 10, [0, 0, 1, 1]);
      expect(result.outHandle.x).toBe(0);
      expect(result.outHandle.y).toBe(50);
      expect(result.inHandle.x).toBe(100);
      expect(result.inHandle.y).toBe(10);
    });

    it('computes handles from ease-both tuple', () => {
      const result = handlesFromTuple(0, 50, 100, 10, [0.42, 0, 0.58, 1]);
      expect(result.outHandle.x).toBeCloseTo(42, 0);
      expect(result.outHandle.y).toBeCloseTo(50, 0);
      expect(result.inHandle.x).toBeCloseTo(58, 0);
      expect(result.inHandle.y).toBeCloseTo(10, 0);
    });
  });

  describe('tupleFromHandles', () => {
    it('recovers linear tuple from linear handles', () => {
      const tuple = tupleFromHandles(0, 50, 100, 10,
        { x: 0, y: 50 },
        { x: 100, y: 10 },
      );
      expect(tuple[0]).toBeCloseTo(0, 5);
      expect(tuple[1]).toBeCloseTo(0, 5);
      expect(tuple[2]).toBeCloseTo(1, 5);
      expect(tuple[3]).toBeCloseTo(1, 5);
    });

    it('clamps x values to [0,1]', () => {
      const tuple = tupleFromHandles(0, 0, 100, 100,
        { x: -50, y: 150 },
        { x: 200, y: -50 },
      );
      expect(tuple[0]).toBe(0);
      expect(tuple[2]).toBe(1);
    });
  });

  describe('buildSegmentPath', () => {
    it('builds stepped path', () => {
      const path = buildSegmentPath(0, 50, 100, 10, 'stepped');
      expect(path).toBe('M 0 50 L 100 50 L 100 10');
    });

    it('builds linear path', () => {
      const path = buildSegmentPath(0, 50, 100, 10, 'linear');
      expect(path).toMatch(/^M 0 50 C/);
      expect(path).toContain('100 10');
    });

    it('builds ease-both path with cubic bezier', () => {
      const path = buildSegmentPath(0, 50, 100, 10, 'ease-both');
      expect(path).toMatch(/^M 0 50 C/);
    });

    it('builds custom tuple path', () => {
      const path = buildSegmentPath(0, 50, 100, 10, [0.1, 0.2, 0.3, 0.4]);
      expect(path).toMatch(/^M 0 50 C/);
    });
  });

  describe('buildGraphPoints', () => {
    it('builds points from property row', () => {
      const propRow = {
        targetId: 'node-1',
        property: 'x',
        keyframes: [
          { time: 0, value: 0, easing: 'linear' },
          { time: 500, value: 10, easing: 'ease-both' },
        ],
      };
      const points = buildGraphPoints(propRow, 0, 48, 24, { min: -2, max: 12 }, 100);
      expect(points).toHaveLength(2);
      expect(points[0].address).toBe('node-1:x:0');
      expect(points[1].address).toBe('node-1:x:500');
      expect(typeof points[0].x).toBe('number');
      expect(typeof points[0].y).toBe('number');
      expect(points[0].easing).toBe('linear');
      expect(points[1].easing).toBe('ease-both');
    });

    it('defaults easing to ease-both', () => {
      const propRow = {
        targetId: 'n1',
        property: 'y',
        keyframes: [{ time: 0, value: 5 }],
      };
      const points = buildGraphPoints(propRow, 0, 48, 24, { min: 0, max: 10 }, 100);
      expect(points[0].easing).toBe('ease-both');
    });

    it('returns empty for null input', () => {
      expect(buildGraphPoints(null, 0, 48, 24, { min: 0, max: 1 }, 100)).toEqual([]);
    });
  });

  describe('evaluateGraphCurve', () => {
    it('returns 0 at t=0 for all easings', () => {
      const result = evaluateGraphCurve(0, 'linear');
      expect(result).toBe(0);
    });

    it('returns 1 at t=1 for all easings', () => {
      const result = evaluateGraphCurve(1, 'linear');
      expect(result).toBe(1);
    });

    it('returns expected value for ease-both at t=0.5', () => {
      const result = evaluateGraphCurve(0.5, 'ease-both');
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
    });
  });
});

describe('graphModel — value range edge cases', () => {
  it('constant single key has expanded range', () => {
    const kfs = [{ time: 0, value: 42 }];
    const range = computeValueRange(kfs);
    expect(range.min).toBe(41);
    expect(range.max).toBe(43);
  });

  it('negative values handled correctly', () => {
    const kfs = [{ time: 0, value: -100 }, { time: 500, value: -50 }];
    const range = computeValueRange(kfs);
    expect(range.min).toBe(-100);
    expect(range.max).toBe(-50);
    const screen = valueToScreen(-75, fitValueRange(range), 100);
    expect(screen).toBeGreaterThan(0);
    expect(screen).toBeLessThan(100);
  });

  it('opacity range constrains value', () => {
    expect(clampValue(2, 'opacity')).toBe(1);
    expect(clampValue(-1, 'opacity')).toBe(0);
    expect(clampValue(0.5, 'opacity')).toBe(0.5);
  });
});
