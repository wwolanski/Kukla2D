import { describe, it, expect } from 'vitest';
import { computeRulerTicks } from '@/features/timeline/application/rulerTicks';

describe('computeRulerTicks', () => {
  it('returns ticks for 0-6 wide enough for step 1', () => {
    const ticks = computeRulerTicks({ startFrame: 0, endFrame: 6, widthPx: 7 * 36 });
    expect(ticks.length).toBeGreaterThanOrEqual(6);
    const labels = ticks.filter(t => t.label !== null).map(t => t.label);
    expect(labels).toContain('0');
    expect(labels).toContain('6');
    expect(labels).toContain('3');
  });

  it('every tick has a unique frame (no duplicates)', () => {
    const ticks = computeRulerTicks({ startFrame: 0, endFrame: 100, widthPx: 800 });
    const frames = ticks.map(t => t.frame);
    expect(new Set(frames).size).toBe(frames.length);
  });

  it('monotonically increasing frames', () => {
    const ticks = computeRulerTicks({ startFrame: 0, endFrame: 100, widthPx: 800 });
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].frame).toBeGreaterThan(ticks[i - 1].frame);
    }
  });

  it('start and end always have labels', () => {
    const ticks = computeRulerTicks({ startFrame: 10, endFrame: 55, widthPx: 400 });
    const labeled = ticks.filter(t => t.label !== null);
    const labelSet = new Set(labeled.map(t => t.label));
    expect(labelSet).toContain('10');
    expect(labelSet).toContain('55');
  });

  it('cap prevents O(totalFrames) for large range', () => {
    const ticks = computeRulerTicks({ startFrame: 0, endFrame: 100000, widthPx: 1200 });
    expect(ticks.length).toBeLessThan(3000);
    expect(ticks.length).toBeGreaterThan(0);
  });

  it('widthPx affects major step', () => {
    const narrow = computeRulerTicks({ startFrame: 0, endFrame: 100, widthPx: 100 });
    const wide = computeRulerTicks({ startFrame: 0, endFrame: 100, widthPx: 2000 });
    const narrowLabels = narrow.filter(t => t.label !== null).length;
    const wideLabels = wide.filter(t => t.label !== null).length;
    expect(wideLabels).toBeGreaterThanOrEqual(narrowLabels);
  });

  it('uses an endpoint-aligned four-frame grid for 24 and 32 frames', () => {
    for (const endFrame of [24, 32]) {
      const labels = computeRulerTicks({ startFrame: 0, endFrame, widthPx: 1200 })
        .filter(t => t.label !== null)
        .map(t => Number(t.label));
      expect(labels).toEqual(Array.from({ length: endFrame / 4 + 1 }, (_, index) => index * 4));
    }
  });

  it('anchors ticks to exact nonzero start and end frames', () => {
    const ticks = computeRulerTicks({ startFrame: 10, endFrame: 34, widthPx: 1200 });
    expect(ticks[0]).toMatchObject({ frame: 10, major: true, label: '10' });
    expect(ticks.at(-1)).toMatchObject({ frame: 34, major: true, label: '34' });
  });

  it('startFrame > endFrame swaps bounds', () => {
    const ticks = computeRulerTicks({ startFrame: 48, endFrame: 0, widthPx: 600 });
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks[0].frame).toBeGreaterThanOrEqual(0);
    expect(ticks[ticks.length - 1].frame).toBeLessThanOrEqual(48);
  });

  it('NaN startFrame falls back to 0', () => {
    const ticks = computeRulerTicks({ startFrame: NaN, endFrame: 24, widthPx: 600 });
    expect(ticks.length).toBeGreaterThan(0);
  });

  it('Infinity endFrame falls back to 48', () => {
    const ticks = computeRulerTicks({ startFrame: 0, endFrame: Infinity, widthPx: 600 });
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks[ticks.length - 1].frame).toBeLessThanOrEqual(48);
  });

  it('widthPx 0 falls back to 200', () => {
    const ticks = computeRulerTicks({ startFrame: 0, endFrame: 48, widthPx: 0 });
    expect(ticks.length).toBeGreaterThan(0);
  });

  it('returns empty array for zero range', () => {
    const ticks = computeRulerTicks({ startFrame: 10, endFrame: 10, widthPx: 600 });
    expect(ticks).toEqual([]);
  });

  it('major ticks at every step for 0-6 with sufficient width', () => {
    const ticks = computeRulerTicks({ startFrame: 0, endFrame: 6, widthPx: 400, minLabelPx: 36 });
    expect(ticks.some(t => t.major)).toBe(true);
  });

  it('DTO shape is { frame, major, label }', () => {
    const ticks = computeRulerTicks({ startFrame: 0, endFrame: 10, widthPx: 600 });
    for (const t of ticks) {
      expect(t).toHaveProperty('frame');
      expect(t).toHaveProperty('major');
      expect(t).toHaveProperty('label');
      expect(typeof t.frame).toBe('number');
      expect(typeof t.major).toBe('boolean');
    }
  });

  it('minLabelPx affects tick density', () => {
    const dense = computeRulerTicks({ startFrame: 0, endFrame: 100, widthPx: 800, minLabelPx: 20 });
    const sparse = computeRulerTicks({ startFrame: 0, endFrame: 100, widthPx: 800, minLabelPx: 100 });
    expect(dense.length).toBeGreaterThanOrEqual(sparse.length);
  });

  it('fractional start/end snap correctly', () => {
    const ticks = computeRulerTicks({ startFrame: 1.5, endFrame: 8.7, widthPx: 800 });
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks[0].frame).toBeGreaterThanOrEqual(1);
  });
});
