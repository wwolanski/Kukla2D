import { describe, it, expect } from 'vitest';
import { buildTimelineTrackRows } from '@/features/timeline/application/buildTimelineTrackRows';
import {
  createKeyframeAddress,
  parseKeyframeAddress,
  keyframeAddressToString,
  compareKeyframeAddresses,
} from '@/features/timeline/application/keyframeAddress';

describe('buildTimelineTrackRows', () => {
  const clip = {
    id: 'anim-1',
    name: 'Walk',
    duration: 2000,
    fps: 30,
    tracks: [
      { targetId: 'node-1', property: 'x', keyframes: [{ time: 0, value: 0 }, { time: 500, value: 10 }] },
      { targetId: 'node-1', property: 'y', keyframes: [{ time: 0, value: 0 }, { time: 500, value: 20 }] },
      { targetId: 'node-2', property: 'rotation', keyframes: [{ time: 250, value: 45 }] },
    ],
  };

  const descriptors = [
    { id: 'node-1', name: 'Head' },
    { id: 'node-2', name: 'Arm' },
  ];

  it('groups tracks by targetId', () => {
    const rows = buildTimelineTrackRows(clip, descriptors);
    expect(rows).toHaveLength(2);
    expect(rows[0].targetId).toBe('node-1');
    expect(rows[1].targetId).toBe('node-2');
  });

  it('collects all unique times per row sorted ascending', () => {
    const rows = buildTimelineTrackRows(clip, descriptors);
    expect(rows[0].times).toEqual([0, 500]);
    expect(rows[1].times).toEqual([250]);
  });

  it('resolves name from descriptors', () => {
    const rows = buildTimelineTrackRows(clip, descriptors);
    expect(rows[0].name).toBe('Head');
    expect(rows[1].name).toBe('Arm');
  });

  it('falls back to targetId when descriptor is missing', () => {
    const rows = buildTimelineTrackRows(clip, []);
    expect(rows[0].name).toBe('node-1');
    expect(rows[1].name).toBe('node-2');
  });

  it('includes all tracks per target', () => {
    const rows = buildTimelineTrackRows(clip, descriptors);
    expect(rows[0].tracks).toHaveLength(2);
    expect(rows[0].tracks[0].property).toBe('x');
    expect(rows[0].tracks[1].property).toBe('y');
    expect(rows[1].tracks).toHaveLength(1);
  });

  it('returns empty for null clip', () => {
    expect(buildTimelineTrackRows(null, descriptors)).toEqual([]);
  });

  it('returns empty for clip with no tracks', () => {
    expect(buildTimelineTrackRows({ ...clip, tracks: [] }, descriptors)).toEqual([]);
  });

  it('preserves easing from keyframes', () => {
    const c = {
      id: 'a', name: 'a', duration: 1000, fps: 30,
      tracks: [
        { targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 0, easing: 'ease-in' }, { time: 500, value: 10 }] },
      ],
    };
    const rows = buildTimelineTrackRows(c, [{ id: 'n1', name: 'N' }]);
    expect(rows[0].easingByTime[0]).toBe('ease-in');
    expect(rows[0].easingByTime[500]).toBe('ease-both');
  });

  it('handles bone descriptors with prefix', () => {
    const c = {
      id: 'a', name: 'a', duration: 1000, fps: 30,
      tracks: [
        { targetId: 'bone-1', property: 'rotation', keyframes: [{ time: 0, value: 0 }] },
      ],
    };
    const rows = buildTimelineTrackRows(c, [{ id: 'bone-1', name: '🦴 Spine' }]);
    expect(rows[0].name).toBe('🦴 Spine');
  });

  it('handles constraint descriptors with IK prefix', () => {
    const c = {
      id: 'a', name: 'a', duration: 1000, fps: 30,
      tracks: [
        { targetId: 'constraint-1', property: 'ikBlend', keyframes: [{ time: 0, value: 1 }] },
      ],
    };
    const rows = buildTimelineTrackRows(c, [{ id: 'constraint-1', name: 'IK LeftArm' }]);
    expect(rows[0].name).toBe('IK LeftArm');
  });

  it('deterministic row order from map insertion', () => {
    const c = {
      id: 'a', name: 'a', duration: 1000, fps: 30,
      tracks: [
        { targetId: 'z-node', property: 'x', keyframes: [{ time: 0, value: 0 }] },
        { targetId: 'a-node', property: 'x', keyframes: [{ time: 0, value: 0 }] },
        { targetId: 'm-node', property: 'x', keyframes: [{ time: 0, value: 0 }] },
      ],
    };
    const rows1 = buildTimelineTrackRows(c, []);
    const rows2 = buildTimelineTrackRows(c, []);
    expect(rows1.map(r => r.targetId)).toEqual(rows2.map(r => r.targetId));
  });

  it('two properties of same target and same time produce one row with merged times', () => {
    const c = {
      id: 'a', name: 'a', duration: 1000, fps: 30,
      tracks: [
        { targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 0 }, { time: 300, value: 5 }] },
        { targetId: 'n1', property: 'y', keyframes: [{ time: 0, value: 0 }, { time: 300, value: 10 }] },
      ],
    };
    const rows = buildTimelineTrackRows(c, [{ id: 'n1', name: 'N' }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].times).toEqual([0, 300]);
    expect(rows[0].tracks).toHaveLength(2);
  });

  it('deterministic easing when multiple tracks share a time', () => {
    const c = {
      id: 'a', name: 'a', duration: 1000, fps: 30,
      tracks: [
        { targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 0, easing: 'linear' }] },
        { targetId: 'n1', property: 'y', keyframes: [{ time: 0, value: 0, easing: 'ease-out' }] },
      ],
    };
    const rows = buildTimelineTrackRows(c, [{ id: 'n1', name: 'N' }]);
    const easing = rows[0].easingByTime[0];
    expect(easing).toMatch(/^(linear|ease-out)$/);
  });
});

describe('keyframeAddress', () => {
  it('createKeyframeAddress returns structured address', () => {
    const addr = createKeyframeAddress('node-1', 'x', 500);
    expect(addr).toEqual({ targetId: 'node-1', property: 'x', timeMs: 500 });
  });

  it('keyframeAddressToString round-trips with parseKeyframeAddress', () => {
    const addr = createKeyframeAddress('bone-2', 'rotation', 123.456);
    const str = keyframeAddressToString(addr);
    expect(str).toBe('bone-2:rotation:123.456');
    const parsed = parseKeyframeAddress(str);
    expect(parsed).toEqual(addr);
  });

  it('parseKeyframeAddress returns null for invalid format', () => {
    expect(parseKeyframeAddress('invalid')).toBeNull();
    expect(parseKeyframeAddress('a:b')).toBeNull();
    expect(parseKeyframeAddress('')).toBeNull();
  });

  it('parseKeyframeAddress handles colon-delimited blend shape properties', () => {
    const addr = parseKeyframeAddress('n1:blendShape:smile:100');
    expect(addr).toEqual({ targetId: 'n1', property: 'blendShape:smile', timeMs: 100 });
  });

  it('compareKeyframeAddresses sorts by targetId first', () => {
    const a = createKeyframeAddress('a-node', 'x', 0);
    const b = createKeyframeAddress('z-node', 'x', 0);
    expect(compareKeyframeAddresses(a, b)).toBe(-1);
    expect(compareKeyframeAddresses(b, a)).toBe(1);
  });

  it('compareKeyframeAddresses sorts by property when targetId equal', () => {
    const a = createKeyframeAddress('n1', 'alpha', 0);
    const b = createKeyframeAddress('n1', 'beta', 0);
    expect(compareKeyframeAddresses(a, b)).toBe(-1);
    expect(compareKeyframeAddresses(b, a)).toBe(1);
  });

  it('compareKeyframeAddresses sorts by timeMs when targetId and property equal', () => {
    const a = createKeyframeAddress('n1', 'x', 100);
    const b = createKeyframeAddress('n1', 'x', 200);
    expect(compareKeyframeAddresses(a, b)).toBe(-1);
    expect(compareKeyframeAddresses(b, a)).toBe(1);
  });

  it('compareKeyframeAddresses returns 0 for identical addresses', () => {
    const a = createKeyframeAddress('n1', 'x', 100);
    const b = createKeyframeAddress('n1', 'x', 100);
    expect(compareKeyframeAddresses(a, b)).toBe(0);
  });

  it('no address collision between different properties of same target and time', () => {
    const a = createKeyframeAddress('n1', 'x', 100);
    const b = createKeyframeAddress('n1', 'y', 100);
    expect(keyframeAddressToString(a)).not.toBe(keyframeAddressToString(b));
    expect(compareKeyframeAddresses(a, b)).not.toBe(0);
  });
});

describe('timeline provenance filtering (Stage 01)', () => {
  it('filters derived keyframes from visible keyframes in property rows', () => {
    const clip = {
      id: 'anim-1', name: 'Test', duration: 2000, fps: 30,
      tracks: [
        {
          targetId: 'n1', property: 'x',
          keyframes: [
            { time: 0, value: 0, authoring: { gestureId: 'g1', role: 'authored', source: 'pose' } },
            { time: 500, value: 10, authoring: { gestureId: 'g1', role: 'derived', source: 'pose' } },
          ],
        },
      ],
    };

    const rows = buildTimelineTrackRows(clip, [{ id: 'n1', name: 'Node' }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].propertyRows[0].keyframes).toHaveLength(1);
    expect(rows[0].propertyRows[0].keyframes[0].time).toBe(0);
    expect(rows[0].propertyRows[0].times).toEqual([0]);
  });

  it('filters support keyframes from visible times', () => {
    const clip = {
      id: 'anim-1', name: 'Test', duration: 2000, fps: 30,
      tracks: [
        {
          targetId: 'n1', property: 'x',
          keyframes: [
            { time: 0, value: 0, authoring: { gestureId: 'g1', role: 'authored', source: 'pose' } },
            { time: 1000, value: 50, authoring: { gestureId: 'g1', role: 'support', source: 'auto' } },
          ],
        },
      ],
    };

    const rows = buildTimelineTrackRows(clip, [{ id: 'n1', name: 'Node' }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].times).toEqual([0]);
  });

  it('shows legacy keyframes without authoring as visible', () => {
    const clip = {
      id: 'anim-1', name: 'Test', duration: 2000, fps: 30,
      tracks: [
        {
          targetId: 'n1', property: 'x',
          keyframes: [
            { time: 0, value: 0 },
            { time: 500, value: 10 },
          ],
        },
      ],
    };

    const rows = buildTimelineTrackRows(clip, [{ id: 'n1', name: 'Node' }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].propertyRows[0].keyframes).toHaveLength(2);
    expect(rows[0].times).toEqual([0, 500]);
  });

  it('hides target row when all keyframes are derived/support', () => {
    const clip = {
      id: 'anim-1', name: 'Test', duration: 2000, fps: 30,
      tracks: [
        {
          targetId: 'n1', property: 'x',
          keyframes: [
            { time: 0, value: 0, authoring: { gestureId: 'g1', role: 'derived', source: 'pose' } },
          ],
        },
      ],
    };

    const rows = buildTimelineTrackRows(clip, [{ id: 'n1', name: 'Node' }]);
    expect(rows).toHaveLength(0);
  });

  it('hides target when some tracks have derived-only and others have authored', () => {
    const clip = {
      id: 'anim-1', name: 'Test', duration: 2000, fps: 30,
      tracks: [
        {
          targetId: 'n1', property: 'x',
          keyframes: [
            { time: 0, value: 0, authoring: { gestureId: 'g1', role: 'authored', source: 'pose' } },
          ],
        },
        {
          targetId: 'n1', property: 'y',
          keyframes: [
            { time: 0, value: 0, authoring: { gestureId: 'g1', role: 'derived', source: 'pose' } },
          ],
        },
      ],
    };

    const rows = buildTimelineTrackRows(clip, [{ id: 'n1', name: 'Node' }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].propertyRows).toHaveLength(1);
    expect(rows[0].propertyRows[0].property).toBe('x');
  });

  it('preserves original tracks on the target for command expansion', () => {
    const clip = {
      id: 'anim-1', name: 'Test', duration: 2000, fps: 30,
      tracks: [
        {
          targetId: 'n1', property: 'x',
          keyframes: [
            { time: 0, value: 0, authoring: { gestureId: 'g1', role: 'authored', source: 'pose' } },
            { time: 500, value: 10, authoring: { gestureId: 'g1', role: 'derived', source: 'pose' } },
          ],
        },
      ],
    };

    const rows = buildTimelineTrackRows(clip, [{ id: 'n1', name: 'Node' }]);
    expect(rows[0].tracks).toHaveLength(1);
    expect(rows[0].tracks[0].keyframes).toHaveLength(2);
  });
});
