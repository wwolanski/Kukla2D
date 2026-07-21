import { describe, expect, it } from 'vitest';
import { computePoseOverrides, interpolateTrack } from '../src/domain/animationEngine.js';
import { expandAnimationForExport } from '../src/domain/animationExportBoomerang.js';

describe('BOOMERANG export expansion parity', () => {
  it('preserves interior poses and reversed easing in generated range', () => {
    const animation = {
      id: 'anim-1',
      name: 'Export parity',
      duration: 1000,
      fps: 1000,
      boomerangTargets: { node1: { sourceEndMs: 600 } },
      tracks: [{
        targetId: 'node1',
        property: 'x',
        keyframes: [
          { time: 0, value: 0, easing: 'ease-in' },
          { time: 300, value: 100, easing: 'ease-out' },
          { time: 600, value: 200, easing: 'linear' },
        ],
      }],
    };

    const expanded = expandAnimationForExport(animation);
    const expandedTrack = expanded.tracks[0];

    expect(expandedTrack.keyframes.map((keyframe) => keyframe.time)).toEqual([0, 300, 600, 800, 1000]);
    expect(expandedTrack.keyframes[2].easing).toBe('ease-in');
    expect(expandedTrack.keyframes[3].easing).toBe('ease-out');
    expect(expandedTrack.keyframes[4].easing).toBe('linear');

    for (const timeMs of [600, 650, 700, 750, 800, 900, 1000]) {
      const runtimeValue = computePoseOverrides(animation, timeMs).get('node1').x;
      const exportedValue = interpolateTrack(expandedTrack.keyframes, timeMs);
      expect(exportedValue).toBeCloseTo(runtimeValue, 8);
    }

    expect(animation.tracks[0].keyframes).toHaveLength(3);
  });
});
