import { describe, it, expect } from 'vitest';
import { buildBoneTreeRows, isBoneDescendant } from '@/features/layers/domain/buildBoneTreeRows.js';

function makeBone(id, name, parentId = null) {
  return {
    id,
    name,
    parentId,
    nodeId: null,
    inherit: 'normal',
    setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
  };
}

function makeNode(id, draw_order, boneId = null) {
  const node = {
    id,
    type: 'part',
    name: id,
    parent: null,
    draw_order,
    visible: true,
  };
  if (boneId) node.boneId = boneId;
  return node;
}

describe('isBoneDescendant', () => {
  it('returns true for reachable descendants', () => {
    const bones = [
      makeBone('root', 'Root'),
      makeBone('child', 'Child', 'root'),
      makeBone('leaf', 'Leaf', 'child'),
    ];

    expect(isBoneDescendant(bones, 'root', 'leaf')).toBe(true);
    expect(isBoneDescendant(bones, 'child', 'leaf')).toBe(true);
  });

  it('returns false for unrelated target even when hierarchy contains a cycle', () => {
    const bones = [
      makeBone('a', 'A', 'b'),
      makeBone('b', 'B', 'a'),
      makeBone('c', 'C'),
    ];

    expect(isBoneDescendant(bones, 'a', 'c')).toBe(false);
  });
});

describe('buildBoneTreeRows', () => {
  it('preserves image counts when image rows are hidden', () => {
    const rows = buildBoneTreeRows({
      bones: [makeBone('root', 'Root')],
      nodes: [makeNode('image-a', 1, 'root'), makeNode('image-b', 2, 'root')],
      constraints: [],
      expanded: new Set(['bone:root']),
      showImages: false,
    });

    expect(rows.find(row => row.key === 'bone:root')).toMatchObject({
      assignedCount: 2,
      hasChildren: true,
    });
    expect(rows.some(row => row.kind === 'node')).toBe(false);
  });

  it('keeps collapsed tree shallow and unassigned nodes sorted by draw order', () => {
    const bones = [
      makeBone('root', 'Root'),
      makeBone('zulu', 'Zulu', 'root'),
      makeBone('alpha', 'Alpha', 'root'),
    ];
    const nodes = [
      makeNode('u-low', 1),
      makeNode('u-high', 8),
      makeNode('alpha-low', 2, 'alpha'),
      makeNode('alpha-high', 7, 'alpha'),
    ];

    const rows = buildBoneTreeRows({
      bones,
      nodes,
      constraints: [],
      expanded: new Set(),
    });

    expect(rows.map(row => row.key)).toEqual([
      'root',
      'bone:root',
      'unassigned',
      'node:u-high',
      'node:u-low',
    ]);
    expect(rows[1]).toMatchObject({ kind: 'bone', hasChildren: true, assignedCount: 0 });
    expect(rows[3]).toMatchObject({ kind: 'node', depth: 1, boneId: null });
    expect(rows[3].node.id).toBe('u-high');
    expect(rows[4].node.id).toBe('u-low');
  });

  it('expands nested bones, sorts bone names and attaches IK badges', () => {
    const bones = [
      makeBone('root', 'Root'),
      makeBone('zulu', 'Zulu', 'root'),
      makeBone('alpha', 'Alpha', 'root'),
      makeBone('leaf', 'Leaf', 'alpha'),
    ];
    const nodes = [
      makeNode('u-low', 1),
      makeNode('u-high', 8),
      makeNode('alpha-low', 2, 'alpha'),
      makeNode('alpha-high', 7, 'alpha'),
      makeNode('leaf-only', 5, 'leaf'),
    ];
    const constraints = [
      { id: 'ik-alpha', type: 'ik', name: 'IK Alpha', color: 0x22d3ee, affectedBoneIds: ['alpha'] },
      { id: 'ik-leaf', type: 'ik', name: 'IK Leaf', affectedBoneIds: ['leaf'] },
    ];

    const rows = buildBoneTreeRows({
      bones,
      nodes,
      constraints,
      expanded: new Set(['bone:root', 'bone:alpha', 'bone:leaf']),
    });

    expect(rows.map(row => row.key)).toEqual([
      'root',
      'bone:root',
      'bone:alpha',
      'node:alpha-high',
      'node:alpha-low',
      'bone:leaf',
      'node:leaf-only',
      'bone:zulu',
      'unassigned',
      'node:u-high',
      'node:u-low',
    ]);

    expect(rows.find(row => row.key === 'bone:alpha')).toMatchObject({
      kind: 'bone',
      depth: 1,
      hasChildren: true,
      assignedCount: 2,
    });
    expect(rows.find(row => row.key === 'bone:alpha').ikConstraints).toHaveLength(1);
    expect(rows.find(row => row.key === 'bone:leaf')).toMatchObject({
      kind: 'bone',
      depth: 2,
      assignedCount: 1,
    });
    expect(rows.find(row => row.key === 'bone:leaf').ikConstraints).toHaveLength(1);
    expect(rows.find(row => row.key === 'node:leaf-only')).toMatchObject({
      kind: 'node',
      depth: 3,
      boneId: 'leaf',
      familyId: 'root',
    });
    expect(rows.find(row => row.key === 'bone:zulu')).toMatchObject({
      kind: 'bone',
      depth: 1,
      hasChildren: false,
      assignedCount: 0,
    });
    expect(rows.find(row => row.key === 'node:u-high')).toMatchObject({
      kind: 'node',
      depth: 1,
      boneId: null,
    });
    expect(rows.find(row => row.key === 'node:u-high').familyId).toBeUndefined();
    expect(rows.filter(row => row.familyId).every(row => row.familyId === 'root')).toBe(true);
  });

  it('assigns one family id per highest root bone', () => {
    const bones = [
      makeBone('root-a', 'Root A'),
      makeBone('child-a', 'Child A', 'root-a'),
      makeBone('root-b', 'Root B'),
      makeBone('child-b', 'Child B', 'root-b'),
    ];
    const rows = buildBoneTreeRows({
      bones,
      expanded: new Set(['bone:root-a', 'bone:root-b']),
      showImages: false,
    });

    expect(rows.find(row => row.key === 'bone:child-a').familyId).toBe('root-a');
    expect(rows.find(row => row.key === 'bone:child-b').familyId).toBe('root-b');
    expect(rows.find(row => row.key === 'root').familyId).toBeUndefined();
  });

  it('can hide image rows while preserving bone hierarchy rows', () => {
    const bones = [
      makeBone('root', 'Root'),
      makeBone('child', 'Child', 'root'),
    ];
    const nodes = [
      makeNode('assigned', 4, 'child'),
      makeNode('unassigned', 5),
    ];

    const rows = buildBoneTreeRows({
      bones,
      nodes,
      constraints: [],
      expanded: new Set(['bone:root', 'bone:child']),
      showImages: false,
    });

    expect(rows.map(row => row.key)).toEqual([
      'root',
      'bone:root',
      'bone:child',
    ]);
    expect(rows.some(row => row.kind === 'node')).toBe(false);
    expect(rows.some(row => row.key === 'unassigned')).toBe(false);
  });

  it('keeps mesh influences separate from unique layer assignment', () => {
    const bones = [makeBone('b1', 'Bone 1'), makeBone('b2', 'Bone 2')];
    const weighted = makeNode('weighted', 4);
    weighted.mesh = {
      vertices: [{ x: 0, y: 0 }],
      influences: [[
        { boneId: 'b1', weight: 0.6 },
        { boneId: 'b2', weight: 0.4 },
      ]],
    };

    const rows = buildBoneTreeRows({
      bones,
      nodes: [weighted],
      expanded: new Set(['bone:b1', 'bone:b2']),
    });

    expect(rows.filter(row => row.kind === 'node')).toHaveLength(1);
    expect(rows.filter(row => row.kind === 'meshInfluence').map(row => row.key)).toEqual([
      'influence:b1:weighted',
      'influence:b2:weighted',
    ]);
    expect(rows.find(row => row.key === 'bone:b1')).toMatchObject({
      assignedCount: 0,
      influencedCount: 1,
    });
  });

  it('shows a corrupt duplicate direct assignment only once', () => {
    const bones = [
      { ...makeBone('b1', 'Bone 1'), nodeId: 'shared' },
      { ...makeBone('b2', 'Bone 2'), nodeId: 'shared' },
    ];
    const rows = buildBoneTreeRows({
      bones,
      nodes: [makeNode('shared', 1)],
      expanded: new Set(['bone:b1', 'bone:b2']),
    });

    expect(rows.filter(row => row.kind === 'node' && row.node.id === 'shared')).toHaveLength(1);
  });
});
