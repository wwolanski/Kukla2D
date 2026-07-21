import { describe, it, expect } from 'vitest';
import { moveKeyframesPreflight } from '@/domain/moveKeyframesPreflight';

describe('moveKeyframesPreflight', () => {
  const animation = {
    duration: 2000,
    tracks: [
      {
        targetId: 'node-1',
        property: 'x',
        keyframes: [
          { time: 0, value: 10 },
          { time: 500, value: 20 },
          { time: 1000, value: 30 },
        ],
      },
      {
        targetId: 'node-1',
        property: 'y',
        keyframes: [
          { time: 0, value: 100 },
          { time: 500, value: 200 },
          { time: 1000, value: 300 },
        ],
      },
    ],
  };

  it('returns valid for simple forward drag', () => {
    const result = moveKeyframesPreflight(animation, {
      keyframes: [{ targetId: 'node-1', property: 'x', timeMs: 500 }],
      deltaMs: 200,
    });
    expect(result.valid).toBe(true);
    expect(result.deltaMs).toBe(200);
    expect(result.targetFrameByAddress).toHaveProperty('node-1::x::500', 700);
  });

  it('moves an authored key independently from its hidden loop-start support', () => {
    const authoredWithSupport = {
      duration: 2000,
      tracks: [{
        targetId: 'bone-5',
        property: 'rotation',
        keyframes: [
          { time: 0, value: 0, authoring: { gestureId: 'g1', role: 'support', source: 'pose.rotate' } },
          { time: 500, value: 30, authoring: { gestureId: 'g1', role: 'authored', source: 'pose.rotate' } },
        ],
      }],
    };

    const result = moveKeyframesPreflight(authoredWithSupport, {
      keyframes: [{ targetId: 'bone-5', property: 'rotation', timeMs: 500 }],
      deltaMs: -250,
    });

    expect(result.valid).toBe(true);
    expect(result.targetFrameByAddress).toEqual({ 'bone-5::rotation::500': 250 });
  });

  it('allows an authored key to replace hidden support at frame 0', () => {
    const authoredWithSupport = {
      duration: 2000,
      tracks: [{
        targetId: 'bone-5',
        property: 'rotation',
        keyframes: [
          { time: 0, value: 0, authoring: { gestureId: 'g1', role: 'support', source: 'pose.rotate' } },
          { time: 500, value: 30, authoring: { gestureId: 'g1', role: 'authored', source: 'pose.rotate' } },
        ],
      }],
    };

    expect(moveKeyframesPreflight(authoredWithSupport, {
      keyframes: [{ targetId: 'bone-5', property: 'rotation', timeMs: 500 }],
      deltaMs: -500,
    }).valid).toBe(true);
  });

  it('returns valid for multi-keyframe group drag', () => {
    const result = moveKeyframesPreflight(animation, {
      keyframes: [
        { targetId: 'node-1', property: 'x', timeMs: 500 },
        { targetId: 'node-1', property: 'y', timeMs: 500 },
      ],
      deltaMs: 100,
    });
    expect(result.valid).toBe(true);
    expect(result.targetFrameByAddress['node-1::x::500']).toBe(600);
    expect(result.targetFrameByAddress['node-1::y::500']).toBe(600);
  });

  it('returns invalid for negative time', () => {
    const result = moveKeyframesPreflight(animation, {
      keyframes: [{ targetId: 'node-1', property: 'x', timeMs: 0 }],
      deltaMs: -100,
    });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('negative_time');
  });

  it('returns invalid for exceeding duration', () => {
    const result = moveKeyframesPreflight(animation, {
      keyframes: [{ targetId: 'node-1', property: 'x', timeMs: 1000 }],
      deltaMs: 2000,
    });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('exceeds_duration');
  });

  it('returns invalid for collision', () => {
    const result = moveKeyframesPreflight(animation, {
      keyframes: [{ targetId: 'node-1', property: 'x', timeMs: 0 }],
      deltaMs: 500,
    });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('collision');
  });

  it('returns invalid for boomerang locked range', () => {
    const animWithBoomerang = {
      duration: 2000,
      boomerangTargets: {
        'node-1': { sourceEndMs: 1000 },
      },
      tracks: [
        {
          targetId: 'node-1',
          property: 'x',
          keyframes: [
            { time: 0, value: 10 },
            { time: 500, value: 20 },
          ],
        },
      ],
    };
    const result = moveKeyframesPreflight(animWithBoomerang, {
      keyframes: [{ targetId: 'node-1', property: 'x', timeMs: 500 }],
      deltaMs: 600,
    });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('boomerang_generated_range');
  });

  it('returns valid for drag with boomerang but staying in authored zone', () => {
    const animWithBoomerang = {
      duration: 2000,
      boomerangTargets: {
        'node-1': { sourceEndMs: 1000 },
      },
      tracks: [
        {
          targetId: 'node-1',
          property: 'x',
          keyframes: [
            { time: 0, value: 10 },
            { time: 500, value: 20 },
          ],
        },
      ],
    };
    const result = moveKeyframesPreflight(animWithBoomerang, {
      keyframes: [{ targetId: 'node-1', property: 'x', timeMs: 500 }],
      deltaMs: 200,
    });
    expect(result.valid).toBe(true);
  });

  it('returns invalid for no animation', () => {
    const result = moveKeyframesPreflight(null, {
      keyframes: [{ targetId: 'node-1', timeMs: 500 }],
      deltaMs: 100,
    });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('no_animation');
  });

  it('returns invalid for empty keyframes', () => {
    const result = moveKeyframesPreflight(animation, {
      keyframes: [],
      deltaMs: 100,
    });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('no_keyframes');
  });

  it('returns invalid for zero delta', () => {
    const result = moveKeyframesPreflight(animation, {
      keyframes: [{ targetId: 'node-1', property: 'x', timeMs: 500 }],
      deltaMs: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('no_delta');
  });
});
