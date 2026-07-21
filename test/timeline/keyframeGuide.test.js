import { describe, it, expect } from 'vitest';
import { buildKeyguideFrames } from '@/features/timeline/application/keyframeGuide';

describe('buildKeyguideFrames', () => {
  it('returns [] when hasVisibleKeyframes is true', () => {
    const result = buildKeyguideFrames({
      startFrame: 0, endFrame: 48, fps: 24, hasVisibleKeyframes: true,
    });
    expect(result).toEqual([]);
  });

  it('24fps 0-48 gives start, half-second guides, end', () => {
    const result = buildKeyguideFrames({
      startFrame: 0, endFrame: 48, fps: 24, hasVisibleKeyframes: false,
    });
    expect(result[0]).toEqual({ frame: 0, label: 'Start' });
    expect(result[result.length - 1]).toEqual({ frame: 48, label: 'End' });
    expect(result.map(f => f.frame)).toEqual([0, 12, 24, 36, 48]);
    expect(result.map(f => f.label)).toEqual(['Start', 'Guide', 'Guide', 'Guide', 'End']);
  });

  it('30fps 0-60 gives start, half-second guides, end', () => {
    const result = buildKeyguideFrames({
      startFrame: 0, endFrame: 60, fps: 30, hasVisibleKeyframes: false,
    });
    expect(result.map(f => f.frame)).toEqual([0, 15, 30, 45, 60]);
  });

  it('short clip 0-6 returns only start and end', () => {
    const result = buildKeyguideFrames({
      startFrame: 0, endFrame: 6, fps: 24, hasVisibleKeyframes: false,
    });
    expect(result.map(f => f.frame)).toEqual([0, 6]);
    expect(result[0].label).toBe('Start');
    expect(result[1].label).toBe('End');
  });

  it('handles nonzero start frame', () => {
    const result = buildKeyguideFrames({
      startFrame: 10, endFrame: 22, fps: 24, hasVisibleKeyframes: false,
    });
    expect(result[0]).toEqual({ frame: 10, label: 'Start' });
    expect(result[result.length - 1]).toEqual({ frame: 22, label: 'End' });
  });

  it('deduplicates when interval aligns with end', () => {
    const result = buildKeyguideFrames({
      startFrame: 0, endFrame: 24, fps: 24, hasVisibleKeyframes: false,
    });
    expect(result.map(f => f.frame)).toEqual([0, 12, 24]);
  });

  it('low fps produces frame 0 step', () => {
    const result = buildKeyguideFrames({
      startFrame: 0, endFrame: 4, fps: 1, hasVisibleKeyframes: false,
    });
    expect(result.map(f => f.frame)).toEqual([0, 1, 2, 3, 4]);
  });
});
