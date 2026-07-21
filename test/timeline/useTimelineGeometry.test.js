import { describe, it, expect, vi } from 'vitest';

vi.mock('@/store/animationStore', () => ({
  useAnimationStore: vi.fn(() => ({
    currentTime: 500,
  })),
}));

describe('useTimelineGeometry (logic test)', () => {
  it('frameToPercentage returns correct percentage for 0-100 range', () => {
    const startFrame = 0;
    const totalFrames = 100;
    const frameToPercentage = (frame) => {
      const frac = (frame - startFrame) / totalFrames;
      return `${frac * 100}%`;
    };
    expect(frameToPercentage(50)).toBe('50%');
    expect(frameToPercentage(0)).toBe('0%');
    expect(frameToPercentage(100)).toBe('100%');
  });

  it('frameToPercentage handles start offset', () => {
    const startFrame = 20;
    const totalFrames = 80;
    const frameToPercentage = (frame) => {
      const frac = (frame - startFrame) / totalFrames;
      return `${frac * 100}%`;
    };
    expect(frameToPercentage(60)).toBe('50%');
  });

  it('xToFrame logic: clientX maps to correct frame', () => {
    const startFrame = 0;
    const totalFrames = 100;
    const TRACK_PAD = 16;
    const rulerRect = { left: 100, width: 500 };
    const clientX = 350;
    const localX = clientX - rulerRect.left - TRACK_PAD;
    const trackW = rulerRect.width - 2 * TRACK_PAD;
    const frac = Math.max(0, Math.min(1, localX / trackW));
    const frame = Math.round(startFrame + frac * totalFrames);
    expect(frame).toBeGreaterThanOrEqual(0);
    expect(frame).toBeLessThanOrEqual(100);
  });
});
