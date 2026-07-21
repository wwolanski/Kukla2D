import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  buildTimelineTrackRows,
  getAuthorablePropertiesForTarget,
  getMissingProperties,
  flattenVisibleRows,
} from '@/features/timeline/application/buildTimelineTrackRows';
import {
  keyframeAddressToString,
} from '@/features/timeline/application/keyframeAddress';

describe('buildTimelineTrackRows — property-level K6', () => {
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
    { id: 'node-1', name: 'Head', kind: 'node' },
    { id: 'node-2', name: 'Arm', kind: 'node' },
  ];

  it('creates propertyRows per track', () => {
    const rows = buildTimelineTrackRows(clip, descriptors);
    expect(rows[0].propertyRows).toHaveLength(2);
    expect(rows[1].propertyRows).toHaveLength(1);
  });

  it('groups position channels into one semantic dope-sheet row', () => {
    const rows = buildTimelineTrackRows(clip, descriptors);
    expect(rows[0].semanticRows).toHaveLength(1);
    expect(rows[0].semanticRows[0]).toMatchObject({
      label: 'Position',
      properties: ['x', 'y'],
      semantic: true,
    });
    expect(rows[0].semanticRows[0].times).toEqual([0, 500]);
    expect(rows[1].semanticRows[0]).toMatchObject({
      label: 'rotation',
      properties: ['rotation'],
      semantic: false,
    });
  });

  it('groups scale and IK target channels while retaining raw graph rows', () => {
    const groupedClip = {
      ...clip,
      tracks: [
        { targetId: 'node-1', property: 'scaleX', keyframes: [{ time: 0, value: 1 }] },
        { targetId: 'node-1', property: 'scaleY', keyframes: [{ time: 0, value: 1 }] },
        { targetId: 'ik-1', property: 'targetX', keyframes: [{ time: 0, value: 1 }] },
        { targetId: 'ik-1', property: 'targetY', keyframes: [{ time: 100, value: 2 }] },
      ],
    };
    const rows = buildTimelineTrackRows(groupedClip, [
      { id: 'node-1', name: 'Head', kind: 'node' },
      { id: 'ik-1', name: 'Arm IK', kind: 'constraint' },
    ]);
    expect(rows[0].semanticRows[0].label).toBe('Scale');
    expect(rows[1].semanticRows[0].label).toBe('IK Target');
    expect(rows[1].semanticRows[0].times).toEqual([0, 100]);
    expect(rows[0].propertyRows.map(row => row.property)).toEqual(['scaleX', 'scaleY']);
  });

  it('property row IDs are canonical targetId:property', () => {
    const rows = buildTimelineTrackRows(clip, descriptors);
    expect(rows[0].propertyRows[0].id).toBe('node-1:x');
    expect(rows[0].propertyRows[1].id).toBe('node-1:y');
    expect(rows[1].propertyRows[0].id).toBe('node-2:rotation');
  });

  it('property rows have valueCategory from K1', () => {
    const rows = buildTimelineTrackRows(clip, descriptors);
    expect(rows[0].propertyRows[0].valueCategory).toBe('numeric');
    expect(rows[0].propertyRows[1].valueCategory).toBe('numeric');
    expect(rows[1].propertyRows[0].valueCategory).toBe('numeric');
  });

  it('property rows have sorted keyframes', () => {
    const rows = buildTimelineTrackRows(clip, descriptors);
    expect(rows[0].propertyRows[0].keyframes[0].time).toBe(0);
    expect(rows[0].propertyRows[0].keyframes[1].time).toBe(500);
  });

  it('property rows have per-keyframe easing', () => {
    const c = {
      id: 'a', name: 'a', duration: 1000, fps: 30,
      tracks: [
        { targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 0, easing: 'ease-in' }, { time: 500, value: 10 }] },
      ],
    };
    const rows = buildTimelineTrackRows(c, [{ id: 'n1', name: 'N', kind: 'node' }]);
    expect(rows[0].propertyRows[0].easingByTime[0]).toBe('ease-in');
    expect(rows[0].propertyRows[0].easingByTime[500]).toBe('ease-both');
  });

  it('target parent preserves tracks for backward compat', () => {
    const rows = buildTimelineTrackRows(clip, descriptors);
    expect(rows[0].tracks).toHaveLength(2);
    expect(rows[0].times).toEqual([0, 500]);
  });

  it('target parent has kind from descriptor', () => {
    const rows = buildTimelineTrackRows(clip, descriptors);
    expect(rows[0].kind).toBe('node');
    expect(rows[1].kind).toBe('node');
  });

  it('returns empty for null clip', () => {
    expect(buildTimelineTrackRows(null, descriptors)).toEqual([]);
  });

  it('returns empty for clip with no tracks', () => {
    expect(buildTimelineTrackRows({ ...clip, tracks: [] }, descriptors)).toEqual([]);
  });

  it('two properties of same target produce separate property rows with distinct IDs', () => {
    const rows = buildTimelineTrackRows(clip, descriptors);
    const ids = rows[0].propertyRows.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('node-1:x');
    expect(ids).toContain('node-1:y');
  });

  it('each property row has exactly one keyframe per time for its track only', () => {
    const rows = buildTimelineTrackRows(clip, descriptors);
    const xRow = rows[0].propertyRows.find(r => r.property === 'x');
    const yRow = rows[0].propertyRows.find(r => r.property === 'y');
    expect(xRow.keyframes).toHaveLength(2);
    expect(yRow.keyframes).toHaveLength(2);
    expect(xRow.keyframes[0].value).toBe(0);
    expect(yRow.keyframes[0].value).toBe(0);
    expect(xRow.keyframes[1].value).toBe(10);
    expect(yRow.keyframes[1].value).toBe(20);
  });
});

describe('getAuthorablePropertiesForTarget', () => {
  it('returns node-authorable properties', () => {
    const props = getAuthorablePropertiesForTarget('node');
    const names = props.map(p => p.property);
    expect(names).toContain('x');
    expect(names).toContain('y');
    expect(names).toContain('rotation');
    expect(names).toContain('opacity');
    expect(names).toContain('visible');
    expect(names).toContain('mesh_verts');
    expect(names).toContain('drawOrder');
  });

  it('returns bone-authorable properties', () => {
    const props = getAuthorablePropertiesForTarget('bone');
    const names = props.map(p => p.property);
    expect(names).toContain('x');
    expect(names).toContain('y');
    expect(names).toContain('rotation');
    expect(names).not.toContain('opacity');
  });

  it('returns constraint-authorable properties', () => {
    const props = getAuthorablePropertiesForTarget('constraint');
    const names = props.map(p => p.property);
    expect(names).toContain('targetX');
    expect(names).toContain('targetY');
    expect(names).toContain('mix');
  });
});

describe('getMissingProperties', () => {
  it('returns authorable properties not in existing set', () => {
    const missing = getMissingProperties('node', ['x', 'y']);
    const names = missing.map(p => p.property);
    expect(names).toContain('rotation');
    expect(names).toContain('opacity');
    expect(names).not.toContain('x');
    expect(names).not.toContain('y');
  });

  it('returns empty when all authorable properties exist', () => {
    const allNodeProps = getAuthorablePropertiesForTarget('node').map(s => s.property);
    const missing = getMissingProperties('node', allNodeProps);
    expect(missing).toHaveLength(0);
  });
});

describe('flattenVisibleRows', () => {
  const clip = {
    id: 'a', name: 'a', duration: 1000, fps: 30,
    tracks: [
      { targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 0 }] },
      { targetId: 'n1', property: 'y', keyframes: [{ time: 0, value: 0 }] },
      { targetId: 'n2', property: 'rotation', keyframes: [{ time: 0, value: 0 }] },
    ],
  };
  const descriptors = [
    { id: 'n1', name: 'N1', kind: 'node' },
    { id: 'n2', name: 'N2', kind: 'node' },
  ];

  it('returns target rows when nothing expanded', () => {
    const rows = buildTimelineTrackRows(clip, descriptors);
    const flat = flattenVisibleRows(rows, new Set());
    expect(flat.every(e => e.type === 'target')).toBe(true);
    expect(flat).toHaveLength(2);
  });

  it('returns target + property rows when expanded', () => {
    const rows = buildTimelineTrackRows(clip, descriptors);
    const flat = flattenVisibleRows(rows, new Set(['n1']));
    expect(flat).toHaveLength(3);
    expect(flat[0].type).toBe('target');
    expect(flat[1].type).toBe('property');
    expect(flat[1].row.id).toBe('n1:group:position');
    expect(flat[1].row.properties).toEqual(['x', 'y']);
    expect(flat[2].type).toBe('target');
  });

  it('all expanded shows all rows', () => {
    const rows = buildTimelineTrackRows(clip, descriptors);
    const flat = flattenVisibleRows(rows, new Set(['n1', 'n2']));
    expect(flat).toHaveLength(4);
    const propRows = flat.filter(e => e.type === 'property');
    expect(propRows).toHaveLength(2);
  });
});

describe('TrackList shell boundary', () => {
  const src = readFileSync(resolve(import.meta.dirname, '../../src/features/timeline/components/TrackList.jsx'), 'utf8');

  it('does not import useProjectStore', () => {
    expect(src).not.toMatch(/import.*useProjectStore/);
  });

  it('does not import useAnimationStore', () => {
    expect(src).not.toMatch(/import.*useAnimationStore/);
  });

  it('does not import useEditorStore', () => {
    expect(src).not.toMatch(/import.*useEditorStore/);
  });

  it('imports buildTimelineTrackRows helpers', () => {
    expect(src).toContain('getMissingProperties');
  });

  it('renders property rows via PropertyRow component', () => {
    expect(src).toContain('PropertyRow');
  });

  it('renders target header with expand/collapse', () => {
    expect(src).toContain('TargetHeader');
    expect(src).toContain('expanded');
  });

  it('keeps playback frame state outside the memoized track tree', () => {
    expect(src).toContain('export const TrackList = memo(TrackListImpl)');
    expect(src).not.toContain('currentFrame');
  });
});

describe('dope sheet canonical address integrity', () => {
  it('two properties at same target and time have two distinct addresses', () => {
    const clip = {
      id: 'a', name: 'a', duration: 1000, fps: 30,
      tracks: [
        { targetId: 'n1', property: 'x', keyframes: [{ time: 100, value: 0 }] },
        { targetId: 'n1', property: 'y', keyframes: [{ time: 100, value: 0 }] },
      ],
    };
    const rows = buildTimelineTrackRows(clip, [{ id: 'n1', name: 'N', kind: 'node' }]);
    const propRows = rows[0].propertyRows;
    const addr1 = keyframeAddressToString({ targetId: propRows[0].targetId, property: propRows[0].property, timeMs: 100 });
    const addr2 = keyframeAddressToString({ targetId: propRows[1].targetId, property: propRows[1].property, timeMs: 100 });
    expect(addr1).not.toBe(addr2);
    expect(addr1).toBe('n1:x:100');
    expect(addr2).toBe('n1:y:100');
  });

  it('each property row diamond represents exactly one address', () => {
    const clip = {
      id: 'a', name: 'a', duration: 1000, fps: 30,
      tracks: [
        { targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 0 }, { time: 500, value: 10 }] },
      ],
    };
    const rows = buildTimelineTrackRows(clip, [{ id: 'n1', name: 'N', kind: 'node' }]);
    const propRow = rows[0].propertyRows[0];
    expect(propRow.times).toHaveLength(2);
    for (const timeMs of propRow.times) {
      const addr = keyframeAddressToString({ targetId: propRow.targetId, property: propRow.property, timeMs });
      expect(addr).toBe(`n1:x:${timeMs}`);
    }
  });
});

describe('move clamp upper bound', () => {
  const src = readFileSync(resolve(import.meta.dirname, '../../src/features/timeline/application/useKeyframeSelection.ts'), 'utf8');

  it('uses clamp for both lower and upper bound in drag', () => {
    expect(src).toContain('clamp(deltaMs, -minTimeMs, upperBound)');
  });

  it('computes upperBound from duration and maxTimeMs', () => {
    expect(src).toContain('durationMs - maxTimeMs');
  });

  it('reads animation.duration for drag context', () => {
    expect(src).toContain('animation?.duration');
  });
});
