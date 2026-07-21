import { describe, it, expect } from 'vitest';
import {
  buildFpsTimingChange,
  formatMs,
  frameToMs,
  msToFrame,
} from '@/features/timeline/domain/timelineTime.js';
import { clamp } from '@/lib/math';

describe('msToFrame', () => {
  it('converts 1000ms at 24fps to 24 frames', () => {
    expect(msToFrame(1000, 24)).toBe(24);
  });

  it('converts 500ms at 24fps to 12 frames', () => {
    expect(msToFrame(500, 24)).toBe(12);
  });

  it('clamps fps to 1 when fps=0', () => {
    expect(msToFrame(1000, 0)).toBe(1);
  });

  it('handles negative fps same as 0', () => {
    expect(msToFrame(1000, -5)).toBe(1);
  });
});

describe('frameToMs', () => {
  it('converts 24 frames at 24fps to 1000ms', () => {
    expect(frameToMs(24, 24)).toBe(1000);
  });

  it('converts 12 frames at 24fps to 500ms', () => {
    expect(frameToMs(12, 24)).toBe(500);
  });

  it('clamps fps to 1 when fps=0', () => {
    expect(frameToMs(1000, 0)).toBe(1000000);
  });
});

describe('formatMs', () => {
  it('formats 1000ms as "1.00"', () => {
    expect(formatMs(1000)).toBe('1.00');
  });

  it('formats with custom decimals', () => {
    expect(formatMs(1500, 1)).toBe('1.5');
  });
});

describe('buildFpsTimingChange', () => {
  it('changes FPS while preserving clip duration', () => {
    expect(buildFpsTimingChange({ id: 'walk', duration: 2000, fps: 24 }, 60)).toEqual({
      animationId: 'walk',
      durationMs: 2000,
      fps: 60,
    });
  });

  it('normalizes FPS to the supported integer range', () => {
    expect(buildFpsTimingChange({ id: 'walk', duration: 2000 }, 0).fps).toBe(1);
    expect(buildFpsTimingChange({ id: 'walk', duration: 2000 }, 240).fps).toBe(120);
  });
});

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

  it('handles NaN (Math.min/max propagation)', () => {
    expect(clamp(NaN, 0, 10)).toBeNaN();
  });
});
