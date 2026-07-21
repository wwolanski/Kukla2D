import { describe, it, expect } from 'vitest';
import {
  evaluateCubicBezier,
  evaluateEasing,
  interpolateTrack,
  interpolateMeshVerts,
  computePoseOverrides,
  evaluateAnimationPose,
  upsertKeyframe,
  getNodePropertyValue,
} from '../src/domain/animationEngine.js';

describe('evaluateCubicBezier', () => {
  it('returns 0 at boundary x=0', () => {
    expect(evaluateCubicBezier(0, 0.42, 0, 0.58, 1)).toBe(0);
  });

  it('returns 0 for negative x', () => {
    expect(evaluateCubicBezier(-0.5, 0.42, 0, 0.58, 1)).toBe(0);
  });

  it('returns 1 at boundary x=1', () => {
    expect(evaluateCubicBezier(1, 0.42, 0, 0.58, 1)).toBe(1);
  });

  it('returns 1 for x > 1', () => {
    expect(evaluateCubicBezier(1.5, 0.42, 0, 0.58, 1)).toBe(1);
  });

  it('returns linear shortcut when cx1===cy1 && cx2===cy2', () => {
    expect(evaluateCubicBezier(0.5, 0.25, 0.25, 0.75, 0.75)).toBe(0.5);
    expect(evaluateCubicBezier(0.3, 0.5, 0.5, 0.5, 0.5)).toBeCloseTo(0.3, 4);
  });

  it('evaluates a known curve point for standard ease', () => {
    const result = evaluateCubicBezier(0.5, 0.42, 0, 0.58, 1);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
    expect(result).toBeCloseTo(0.5, 0);
  });
});

describe('evaluateEasing', () => {
  it('linear returns t directly', () => {
    expect(evaluateEasing(0.5, 'linear')).toBe(0.5);
    expect(evaluateEasing(0, 'linear')).toBe(0);
    expect(evaluateEasing(1, 'linear')).toBe(1);
  });

  it('stepped returns 0', () => {
    expect(evaluateEasing(0.5, 'stepped')).toBe(0);
    expect(evaluateEasing(0, 'stepped')).toBe(0);
    expect(evaluateEasing(1, 'stepped')).toBe(0);
  });

  it('ease produces a value between 0 and 1 for t in (0,1)', () => {
    const result = evaluateEasing(0.5, 'ease');
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it('ease-both produces a value between 0 and 1 for t in (0,1)', () => {
    const result = evaluateEasing(0.5, 'ease-both');
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it('ease-in produces a value between 0 and 1 for t in (0,1)', () => {
    const result = evaluateEasing(0.5, 'ease-in');
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it('ease-out produces a value between 0 and 1 for t in (0,1)', () => {
    const result = evaluateEasing(0.5, 'ease-out');
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it('unknown easing returns t', () => {
    expect(evaluateEasing(0.5, 'unknown')).toBe(0.5);
    expect(evaluateEasing(0.3, 'bogus')).toBe(0.3);
  });

  it('null/undefined easing defaults to ease-both', () => {
    const result = evaluateEasing(0.5, null);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
    expect(evaluateEasing(0.5, undefined)).toBe(result);
  });

  it('custom bezier array easing works', () => {
    const result = evaluateEasing(0.5, [0.25, 0.1, 0.25, 1]);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });
});

describe('interpolateTrack', () => {
  it('returns undefined for empty keyframes', () => {
    expect(interpolateTrack([], 100)).toBeUndefined();
    expect(interpolateTrack(null, 100)).toBeUndefined();
  });

  it('returns single keyframe value at any time', () => {
    const kfs = [{ time: 500, value: 42, easing: 'linear' }];
    expect(interpolateTrack(kfs, 0)).toBe(42);
    expect(interpolateTrack(kfs, 500)).toBe(42);
    expect(interpolateTrack(kfs, 1000)).toBe(42);
  });

  it('returns first value before first keyframe', () => {
    const kfs = [
      { time: 200, value: 10, easing: 'linear' },
      { time: 800, value: 50, easing: 'linear' },
    ];
    expect(interpolateTrack(kfs, 0)).toBe(10);
    expect(interpolateTrack(kfs, 100)).toBe(10);
  });

  it('returns last value after last keyframe', () => {
    const kfs = [
      { time: 200, value: 10, easing: 'linear' },
      { time: 800, value: 50, easing: 'linear' },
    ];
    expect(interpolateTrack(kfs, 900)).toBe(50);
    expect(interpolateTrack(kfs, 2000)).toBe(50);
  });

  it('linear lerp between two keyframes', () => {
    const kfs = [
      { time: 0, value: 0, easing: 'linear' },
      { time: 1000, value: 100, easing: 'linear' },
    ];
    expect(interpolateTrack(kfs, 500)).toBe(50);
    expect(interpolateTrack(kfs, 250)).toBe(25);
    expect(interpolateTrack(kfs, 750)).toBe(75);
  });

  it('stepped easing returns first keyframe value between keyframes', () => {
    const kfs = [
      { time: 0, value: 10, easing: 'stepped' },
      { time: 1000, value: 50, easing: 'linear' },
    ];
    expect(interpolateTrack(kfs, 500)).toBe(10);
    expect(interpolateTrack(kfs, 999)).toBe(10);
  });

  it('boolean keyframes return discrete start value', () => {
    const kfs = [
      { time: 0, value: true, easing: 'linear' },
      { time: 1000, value: false, easing: 'linear' },
    ];
    expect(interpolateTrack(kfs, 500)).toBe(true);
    expect(interpolateTrack(kfs, 0)).toBe(true);
  });

  it('loop keyframes wrap around correctly', () => {
    const kfs = [
      { time: 0, value: 0, easing: 'linear' },
      { time: 500, value: 100, easing: 'linear' },
    ];
    const result = interpolateTrack(kfs, 750, true, 1000);
    expect(result).toBeCloseTo(50, 0);
  });

  it('loop keyframes returns last value when loopKeyframes is false', () => {
    const kfs = [
      { time: 0, value: 0, easing: 'linear' },
      { time: 500, value: 100, easing: 'linear' },
    ];
    expect(interpolateTrack(kfs, 750, false, 1000)).toBe(100);
  });
});

describe('interpolateMeshVerts', () => {
  it('returns undefined for empty keyframes', () => {
    expect(interpolateMeshVerts([], 100)).toBeUndefined();
    expect(interpolateMeshVerts(null, 100)).toBeUndefined();
  });

  it('returns single keyframe value', () => {
    const verts = [{ x: 10, y: 20 }];
    const kfs = [{ time: 500, value: verts, easing: 'linear' }];
    expect(interpolateMeshVerts(kfs, 0)).toEqual(verts);
  });

  it('lerps between two keyframes per vertex', () => {
    const kfs = [
      { time: 0, value: [{ x: 0, y: 0 }], easing: 'linear' },
      { time: 1000, value: [{ x: 100, y: 200 }], easing: 'linear' },
    ];
    const result = interpolateMeshVerts(kfs, 500);
    expect(result).toEqual([{ x: 50, y: 100 }]);
  });

  it('lerps multiple vertices correctly', () => {
    const kfs = [
      { time: 0, value: [{ x: 0, y: 0 }, { x: 10, y: 20 }], easing: 'linear' },
      { time: 1000, value: [{ x: 100, y: 200 }, { x: 30, y: 60 }], easing: 'linear' },
    ];
    const result = interpolateMeshVerts(kfs, 500);
    expect(result[0]).toEqual({ x: 50, y: 100 });
    expect(result[1]).toEqual({ x: 20, y: 40 });
  });

  it('returns first value before first keyframe', () => {
    const verts = [{ x: 5, y: 10 }];
    const kfs = [{ time: 500, value: verts, easing: 'linear' }];
    expect(interpolateMeshVerts(kfs, 0)).toEqual(verts);
  });

  it('returns last value after last keyframe', () => {
    const verts = [{ x: 5, y: 10 }];
    const kfs = [{ time: 0, value: verts, easing: 'linear' }];
    expect(interpolateMeshVerts(kfs, 1000)).toEqual(verts);
  });

  it('loop keyframes wrap mesh vertices', () => {
    const kfs = [
      { time: 0, value: [{ x: 0, y: 0 }], easing: 'linear' },
      { time: 500, value: [{ x: 100, y: 0 }], easing: 'linear' },
    ];
    const result = interpolateMeshVerts(kfs, 750, true, 1000);
    expect(result[0].x).toBeCloseTo(50, 0);
    expect(result[0].y).toBeCloseTo(0, 0);
  });
});

describe('computePoseOverrides', () => {
  it('returns empty Map for null animation', () => {
    const result = computePoseOverrides(null, 500);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('maps multiple tracks to correct targetId and property', () => {
    const animation = {
      tracks: [
        {
          targetId: 'node1',
          property: 'x',
          keyframes: [
            { time: 0, value: 0, easing: 'linear' },
            { time: 1000, value: 100, easing: 'linear' },
          ],
        },
        {
          targetId: 'node1',
          property: 'opacity',
          keyframes: [
            { time: 0, value: 1, easing: 'linear' },
            { time: 1000, value: 0.5, easing: 'linear' },
          ],
        },
        {
          targetId: 'node2',
          property: 'y',
          keyframes: [
            { time: 0, value: 20, easing: 'linear' },
            { time: 1000, value: 80, easing: 'linear' },
          ],
        },
      ],
    };
    const result = computePoseOverrides(animation, 500);
    expect(result.get('node1').x).toBe(50);
    expect(result.get('node1').opacity).toBeCloseTo(0.75, 2);
    expect(result.get('node2').y).toBe(50);
  });

  it('samples the rendered pose on animation FPS boundaries', () => {
    const animation = {
      fps: 10,
      tracks: [{
        targetId: 'node1',
        property: 'x',
        keyframes: [
          { time: 0, value: 0, easing: 'linear' },
          { time: 1000, value: 100, easing: 'linear' },
        ],
      }],
    };

    expect(computePoseOverrides(animation, 149).get('node1').x).toBe(10);
    expect(computePoseOverrides(animation, 199).get('node1').x).toBe(10);
    expect(computePoseOverrides(animation, 200).get('node1').x).toBe(20);
  });

  it('handles mesh_verts track separately', () => {
    const animation = {
      tracks: [
        {
          targetId: 'node1',
          property: 'mesh_verts',
          keyframes: [
            { time: 0, value: [{ x: 0, y: 0 }], easing: 'linear' },
            { time: 1000, value: [{ x: 100, y: 200 }], easing: 'linear' },
          ],
        },
      ],
    };
    const result = computePoseOverrides(animation, 500);
    expect(result.get('node1').mesh_verts).toEqual([{ x: 50, y: 100 }]);
  });

  it('skips tracks with no keyframes', () => {
    const animation = {
      tracks: [
        {
          targetId: 'node1',
          property: 'x',
          keyframes: [],
        },
      ],
    };
    const result = computePoseOverrides(animation, 500);
    expect(result.size).toBe(0);
  });

  it('rounds drawOrder to integer', () => {
    const animation = {
      tracks: [
        {
          targetId: 'node1',
          property: 'drawOrder',
          keyframes: [
            { time: 0, value: 0, easing: 'linear' },
            { time: 1000, value: 10, easing: 'linear' },
          ],
        },
      ],
    };
    const result = computePoseOverrides(animation, 500);
    expect(result.get('node1').drawOrder).toBe(5);
  });
});

describe('upsertKeyframe', () => {
  it('inserts new keyframe and maintains sorted order', () => {
    const kfs = [
      { time: 0, value: 0, easing: 'linear' },
      { time: 1000, value: 100, easing: 'linear' },
    ];
    upsertKeyframe(kfs, 500, 50, 'ease-in');
    expect(kfs.length).toBe(3);
    expect(kfs[1].time).toBe(500);
    expect(kfs[1].value).toBe(50);
    expect(kfs[1].easing).toBe('ease-in');
    expect(kfs[0].time).toBe(0);
    expect(kfs[2].time).toBe(1000);
  });

  it('updates existing keyframe at the same time', () => {
    const kfs = [
      { time: 0, value: 0, easing: 'linear' },
      { time: 500, value: 50, easing: 'linear' },
      { time: 1000, value: 100, easing: 'linear' },
    ];
    upsertKeyframe(kfs, 500, 75, 'ease-out');
    expect(kfs.length).toBe(3);
    expect(kfs[1].value).toBe(75);
    expect(kfs[1].easing).toBe('ease-out');
  });

  it('inserts at beginning and end maintaining order', () => {
    const kfs = [{ time: 500, value: 50, easing: 'linear' }];
    upsertKeyframe(kfs, 0, 0, 'linear');
    upsertKeyframe(kfs, 1000, 100, 'linear');
    expect(kfs[0].time).toBe(0);
    expect(kfs[1].time).toBe(500);
    expect(kfs[2].time).toBe(1000);
  });
});

describe('getNodePropertyValue', () => {
  it('reads transform properties', () => {
    const node = { transform: { x: 10, y: 20, rotation: 45, scaleX: 1.5, scaleY: 2 } };
    expect(getNodePropertyValue(node, 'x')).toBe(10);
    expect(getNodePropertyValue(node, 'y')).toBe(20);
    expect(getNodePropertyValue(node, 'rotation')).toBe(45);
    expect(getNodePropertyValue(node, 'scaleX')).toBe(1.5);
    expect(getNodePropertyValue(node, 'scaleY')).toBe(2);
  });

  it('returns 0 for missing transform property', () => {
    const node = { transform: {} };
    expect(getNodePropertyValue(node, 'x')).toBe(0);
  });

  it('returns 0 when transform is missing', () => {
    const node = {};
    expect(getNodePropertyValue(node, 'x')).toBe(0);
  });

  it('reads opacity from node', () => {
    const node = { opacity: 0.7 };
    expect(getNodePropertyValue(node, 'opacity')).toBe(0.7);
  });

  it('returns default opacity of 1 when missing', () => {
    const node = {};
    expect(getNodePropertyValue(node, 'opacity')).toBe(1);
  });

  it('reads visible from node', () => {
    const node = { visible: false };
    expect(getNodePropertyValue(node, 'visible')).toBe(false);
  });

  it('returns default visible of true when missing', () => {
    const node = {};
    expect(getNodePropertyValue(node, 'visible')).toBe(true);
  });

  it('reads blend shape values', () => {
    const node = { blendShapeValues: { smile: 0.8, blink: 0.3 } };
    expect(getNodePropertyValue(node, 'blendShape:smile')).toBe(0.8);
    expect(getNodePropertyValue(node, 'blendShape:blink')).toBe(0.3);
  });

  it('returns 0 for missing blend shape', () => {
    const node = { blendShapeValues: {} };
    expect(getNodePropertyValue(node, 'blendShape:nose')).toBe(0);
  });

  it('returns 0 for blend shape when blendShapeValues is missing', () => {
    const node = {};
    expect(getNodePropertyValue(node, 'blendShape:test')).toBe(0);
  });
});

describe('evaluateAnimationPose', () => {
  it('returns empty Map for null clip', () => {
    const result = evaluateAnimationPose(null, { timeMs: 500 });
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('returns empty Map for clip with no tracks', () => {
    const result = evaluateAnimationPose({ tracks: [] }, { timeMs: 500 });
    expect(result.size).toBe(0);
  });

  it('maps tracks to targetId → property overrides', () => {
    const clip = {
      tracks: [
        { targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 0 }, { time: 100, value: 50 }] },
        { targetId: 'n1', property: 'opacity', keyframes: [{ time: 0, value: 1 }, { time: 100, value: 0.3 }] },
        { targetId: 'n2', property: 'y', keyframes: [{ time: 0, value: 10 }, { time: 100, value: 90 }] },
      ],
    };
    const result = evaluateAnimationPose(clip, { timeMs: 50 });
    expect(result.get('n1').x).toBe(25);
    expect(result.get('n1').opacity).toBeCloseTo(0.65, 2);
    expect(result.get('n2').y).toBe(50);
  });

  it('is pure — does not mutate clip', () => {
    const clip = {
      tracks: [
        { targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 0 }, { time: 100, value: 100 }] },
      ],
    };
    const snapshot = JSON.stringify(clip);
    evaluateAnimationPose(clip, { timeMs: 50 });
    expect(JSON.stringify(clip)).toBe(snapshot);
  });

  it('accepts default opts', () => {
    const clip = {
      tracks: [
        { targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 0 }, { time: 100, value: 100 }] },
      ],
    };
    const result = evaluateAnimationPose(clip);
    expect(result.get('n1').x).toBe(0);
  });

  it('delegates loop to interpolation', () => {
    const clip = {
      tracks: [
        { targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 0 }, { time: 500, value: 100 }] },
      ],
    };
    const result = evaluateAnimationPose(clip, { timeMs: 750, loopKeyframes: true, endMs: 1000 });
    expect(result.get('n1').x).toBeCloseTo(50, 0);
  });
});
