import { describe, expect, it } from 'vitest';
import {
  buildFpsTimingChange,
  formatMs,
  frameToMs,
  msToFrame,
} from '@/features/timeline/domain/timelineTime';
import type { AnimationId } from '@kukla2d/contracts';

describe('msToFrame', () => {
  it('converts 0ms to frame 0', () => {
    expect(msToFrame(0, 24)).toBe(0);
  });

  it('converts 1000ms to frame 24 at 24fps', () => {
    expect(msToFrame(1000, 24)).toBe(24);
  });

  it('rounds to nearest frame', () => {
    expect(msToFrame(20, 24)).toBe(0);
    expect(msToFrame(21, 24)).toBe(1);
  });
});

describe('frameToMs', () => {
  it('converts frame 0 to 0ms', () => {
    expect(frameToMs(0, 24)).toBe(0);
  });

  it('converts frame 24 at 24fps to 1000ms', () => {
    expect(frameToMs(24, 24)).toBe(1000);
  });
});

describe('formatMs', () => {
  it('formats 1000ms as 1.00', () => {
    expect(formatMs(1000)).toBe('1.00');
  });

  it('formats 500ms as 0.50', () => {
    expect(formatMs(500)).toBe('0.50');
  });

  it('respects decimal precision', () => {
    expect(formatMs(1000, 3)).toBe('1.000');
  });
});

describe('buildFpsTimingChange', () => {
  it('returns timing change for valid animation', () => {
    const result = buildFpsTimingChange({ id: 'a1' as AnimationId, duration: 1000 }, 30);
    expect(result).not.toBeNull();
    expect(result!.animationId).toBe('a1');
    expect(result!.fps).toBe(30);
  });

  it('clamps fps to valid range', () => {
    const result = buildFpsTimingChange({ id: 'a1' as AnimationId, duration: 1000 }, 500);
    expect(result!.fps).toBe(120);
  });

  it('returns null for null animation', () => {
    expect(buildFpsTimingChange(null, 30)).toBeNull();
  });

  it('rounds non-integer fps', () => {
    const result = buildFpsTimingChange({ id: 'a1' as AnimationId, duration: 1000 }, 23.7);
    expect(result!.fps).toBe(24);
  });
});
