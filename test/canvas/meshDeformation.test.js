import { describe, it, expect } from 'vitest';
import {
  ensureInfluenceSlots,
  normalizeInfluenceSlots,
  resolveBaseMeshVertices,
  applyLinearBlendSkinning,
  buildWarpGridFrame,
  applyWarpGridToVertices,
  buildEffectiveMeshFrame,
} from '@/features/canvas/domain/meshDeformation.js';
import { buildRestGrid } from '@/features/canvas/domain/warpKeyframes.js';

describe('ensureInfluenceSlots', () => {
  it('creates empty slots when missing', () => {
    const mesh = { vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }] };
    ensureInfluenceSlots(mesh);
    expect(mesh.influences).toHaveLength(2);
    expect(mesh.influences[0]).toEqual([]);
  });

  it('replaces wrong-length array', () => {
    const mesh = { vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }], influences: [[]] };
    ensureInfluenceSlots(mesh);
    expect(mesh.influences).toHaveLength(2);
  });

  it('leaves correct array untouched', () => {
    const mesh = { vertices: [{ x: 0, y: 0 }], influences: [[{ boneId: 'a', weight: 1 }]] };
    ensureInfluenceSlots(mesh);
    expect(mesh.influences[0][0].boneId).toBe('a');
  });
});

describe('normalizeInfluenceSlots', () => {
  it('returns empty slots for missing influences', () => {
    const slots = normalizeInfluenceSlots(null, 2);
    expect(slots).toHaveLength(2);
    expect(slots[0]).toEqual([]);
  });

  it('normalizes and keeps top-4 per vertex', () => {
    const influences = [
      [
        { boneId: 'a', weight: 0.1 },
        { boneId: 'b', weight: 0.2 },
        { boneId: 'c', weight: 0.3 },
        { boneId: 'd', weight: 0.4 },
        { boneId: 'e', weight: 0.5 },
      ],
    ];
    const slots = normalizeInfluenceSlots(influences, 1);
    expect(slots[0]).toHaveLength(4);
    expect(slots[0][0].boneId).toBe('e');
    const sum = slots[0].reduce((acc, inf) => acc + inf.weight, 0);
    expect(sum).toBeCloseTo(1);
  });

  it('pads to vertexCount', () => {
    const slots = normalizeInfluenceSlots([[{ boneId: 'a', weight: 1 }]], 3);
    expect(slots).toHaveLength(3);
    expect(slots[0][0].boneId).toBe('a');
    expect(slots[1]).toEqual([]);
  });
});

describe('resolveBaseMeshVertices', () => {
  function makeNode(verts) {
    return { id: 'p1', mesh: { vertices: verts } };
  }

  it('returns setup vertices by default', () => {
    const node = makeNode([{ x: 0, y: 0 }]);
    const result = resolveBaseMeshVertices({ node, poseOverride: null });
    expect(result.vertices).toEqual([{ x: 0, y: 0 }]);
    expect(result.source).toBe('setup');
    expect(result.mismatch).toBe(false);
  });

  it('uses poseOverride when length matches', () => {
    const node = makeNode([{ x: 0, y: 0 }]);
    const result = resolveBaseMeshVertices({ node, poseOverride: { mesh_verts: [{ x: 5, y: 5 }] } });
    expect(result.vertices).toEqual([{ x: 5, y: 5 }]);
    expect(result.source).toBe('poseOverride');
  });

  it('falls back to setup on length mismatch', () => {
    const node = makeNode([{ x: 0, y: 0 }]);
    const result = resolveBaseMeshVertices({ node, poseOverride: { mesh_verts: [{ x: 5, y: 5 }, { x: 6, y: 6 }] } });
    expect(result.vertices).toEqual([{ x: 0, y: 0 }]);
    expect(result.mismatch).toBe(true);
  });

  it('does not mutate input arrays', () => {
    const setup = [{ x: 0, y: 0 }];
    const override = [{ x: 5, y: 5 }];
    const node = makeNode(setup);
    resolveBaseMeshVertices({ node, poseOverride: { mesh_verts: override } });
    expect(setup[0]).toEqual({ x: 0, y: 0 });
    expect(override[0]).toEqual({ x: 5, y: 5 });
  });
});

describe('applyLinearBlendSkinning', () => {
  function makeBone(id, x, y, rotation = 0) {
    return { id, setup: { x, y, rotation, scaleX: 1, scaleY: 1, length: 10 } };
  }

  function makePart(vertices, influences) {
    return {
      id: 'part',
      type: 'part',
      parent: null,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      mesh: { vertices, influences },
    };
  }

  it('returns vertices unchanged when no influences', () => {
    const part = makePart([{ x: 1, y: 2 }], []);
    const result = applyLinearBlendSkinning({
      vertices: [{ x: 1, y: 2 }],
      node: part,
      bones: new Map(),
      restBones: new Map(),
    });
    expect(result).toEqual([{ x: 1, y: 2 }]);
  });

  it('returns vertices unchanged for identity bind-to-pose', () => {
    const part = makePart([{ x: 10, y: 0 }], [[{ boneId: 'b1', weight: 1 }]]);
    const bones = new Map([['b1', makeBone('b1', 0, 0)]]);
    const result = applyLinearBlendSkinning({
      vertices: [{ x: 10, y: 0 }],
      node: part,
      bones,
      restBones: bones,
    });
    expect(result[0].x).toBeCloseTo(10);
    expect(result[0].y).toBeCloseTo(0);
  });

  it('deforms vertices when bone rotates 90 degrees', () => {
    const part = makePart([{ x: 10, y: 0 }], [[{ boneId: 'b1', weight: 1 }]]);
    const restBones = new Map([['b1', makeBone('b1', 0, 0, 0)]]);
    const bones = new Map([['b1', makeBone('b1', 0, 0, 90)]]);
    const result = applyLinearBlendSkinning({
      vertices: [{ x: 10, y: 0 }],
      node: part,
      bones,
      restBones,
    });
    expect(result[0].x).toBeCloseTo(0);
    expect(result[0].y).toBeCloseTo(10);
  });

  it('falls back to unweighted source when bone is missing', () => {
    const part = makePart([{ x: 10, y: 0 }], [[{ boneId: 'b1', weight: 1 }]]);
    const result = applyLinearBlendSkinning({
      vertices: [{ x: 10, y: 0 }],
      node: part,
      bones: new Map(),
      restBones: new Map(),
    });
    expect(result[0].x).toBeCloseTo(10);
    expect(result[0].y).toBeCloseTo(0);
  });

  it('blends two bone transforms by weight', () => {
    const part = makePart([{ x: 10, y: 0 }], [[
      { boneId: 'b1', weight: 0.5 },
      { boneId: 'b2', weight: 0.5 },
    ]]);
    const restBones = new Map([
      ['b1', makeBone('b1', 0, 0, 0)],
      ['b2', makeBone('b2', 0, 0, 0)],
    ]);
    const bones = new Map([
      ['b1', makeBone('b1', 0, 0, 0)],
      ['b2', makeBone('b2', 0, 0, 90)],
    ]);
    const result = applyLinearBlendSkinning({
      vertices: [{ x: 10, y: 0 }],
      node: part,
      bones,
      restBones,
    });
    expect(result[0].x).toBeCloseTo(5);
    expect(result[0].y).toBeCloseTo(5);
  });
});

describe('buildWarpGridFrame', () => {
  it('produces row-major grid with expected length', () => {
    const frame = buildWarpGridFrame({
      warpNode: { id: 'w1', col: 2, row: 2, gridX: 0, gridY: 0, gridW: 100, gridH: 100 },
      poseOverride: null,
    });
    expect(frame.points).toHaveLength(9);
    expect(frame.col).toBe(2);
    expect(frame.row).toBe(2);
    expect(frame.points[0]).toEqual({ x: 0, y: 0 });
    expect(frame.points[4]).toEqual({ x: 50, y: 50 });
  });

  it('replaces rest grid points with mesh_verts absolute positions', () => {
    const frame = buildWarpGridFrame({
      warpNode: { id: 'w1', col: 1, row: 1, gridX: 0, gridY: 0, gridW: 100, gridH: 100 },
      poseOverride: { mesh_verts: [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }] },
    });
    expect(frame.points[1]).toEqual({ x: 60, y: 0 });
  });

  it('replaces invalid dimensions with defaults', () => {
    const frame = buildWarpGridFrame({
      warpNode: { id: 'w1', col: -1, row: NaN, gridW: 0, gridH: -10 },
      poseOverride: null,
    });
    expect(frame.col).toBe(2);
    expect(frame.row).toBe(2);
    expect(frame.points.length).toBe(9);
  });
});

describe('applyWarpGridToVertices', () => {
  it('warps center point of a 2x2 grid', () => {
    const rest = buildRestGrid({ gridX: 0, gridY: 0, gridW: 100, gridH: 100, col: 2, row: 2 });
    const meshVerts = rest.map((p, i) => (i === 4 ? { x: 60, y: 55 } : p));
    const warpFrame = buildWarpGridFrame({
      warpNode: { id: 'w1', col: 2, row: 2, gridX: 0, gridY: 0, gridW: 100, gridH: 100 },
      poseOverride: { mesh_verts: meshVerts },
    });
    const result = applyWarpGridToVertices({
      vertices: [{ x: 50, y: 50 }],
      warpFrame,
    });
    expect(result[0].x).toBeCloseTo(60);
    expect(result[0].y).toBeCloseTo(55);
  });

  it('leaves points outside bounds unchanged', () => {
    const warpFrame = buildWarpGridFrame({
      warpNode: { id: 'w1', col: 2, row: 2, gridX: 0, gridY: 0, gridW: 100, gridH: 100 },
      poseOverride: null,
    });
    const result = applyWarpGridToVertices({
      vertices: [{ x: 200, y: 200 }],
      warpFrame,
    });
    expect(result[0]).toEqual({ x: 200, y: 200 });
  });

  it('does not mutate input vertices', () => {
    const warpFrame = buildWarpGridFrame({
      warpNode: { id: 'w1', col: 1, row: 1, gridX: 0, gridY: 0, gridW: 100, gridH: 100 },
      poseOverride: null,
    });
    const verts = [{ x: 25, y: 25 }];
    applyWarpGridToVertices({ vertices: verts, warpFrame });
    expect(verts[0]).toEqual({ x: 25, y: 25 });
  });
});

describe('buildEffectiveMeshFrame', () => {
  function makePartNode(id, vertices, parent = null, influences = []) {
    return {
      id,
      type: 'part',
      parent,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      mesh: { vertices, uvs: [], triangles: [], influences },
    };
  }

  it('returns setup vertices by default', () => {
    const part = makePartNode('p1', [{ x: 1, y: 2 }]);
    const frame = buildEffectiveMeshFrame({ partNode: part, poseOverrides: new Map() });
    expect(frame.vertices).toEqual([{ x: 1, y: 2 }]);
    expect(frame.partId).toBe('p1');
  });

  it('applies pose override mesh_verts', () => {
    const part = makePartNode('p1', [{ x: 0, y: 0 }]);
    const overrides = new Map([['p1', { mesh_verts: [{ x: 7, y: 8 }] }]]);
    const frame = buildEffectiveMeshFrame({ partNode: part, poseOverrides: overrides });
    expect(frame.vertices).toEqual([{ x: 7, y: 8 }]);
  });

  it('applies skinning using rest/posed bones', () => {
    const part = makePartNode('p1', [{ x: 10, y: 0 }], null, [[{ boneId: 'b1', weight: 1 }]]);
    const restBones = [{ id: 'b1', setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 10 } }];
    const effectiveBones = [{ id: 'b1', setup: { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1, length: 10 } }];
    const frame = buildEffectiveMeshFrame({
      partNode: part,
      poseOverrides: new Map(),
      effectiveBones,
      restBones,
    });
    expect(frame.vertices[0].x).toBeCloseTo(0);
    expect(frame.vertices[0].y).toBeCloseTo(10);
  });

  it('applies ancestor warp deformer', () => {
    const warp = { id: 'w1', type: 'warpDeformer', parent: null, col: 2, row: 2, gridX: 0, gridY: 0, gridW: 100, gridH: 100 };
    const part = makePartNode('p1', [{ x: 50, y: 50 }], 'w1');
    const rest = buildRestGrid({ gridX: 0, gridY: 0, gridW: 100, gridH: 100, col: 2, row: 2 });
    const meshVerts = rest.map((p, i) => (i === 4 ? { x: 60, y: 55 } : p));
    const warpFrames = new Map([['w1', buildWarpGridFrame({
      warpNode: warp,
      poseOverride: { mesh_verts: meshVerts },
    })]]);
    const frame = buildEffectiveMeshFrame({
      partNode: part,
      poseOverrides: new Map(),
      warpFrames,
      allNodes: [warp, part],
    });
    expect(frame.vertices[0].x).toBeCloseTo(60);
    expect(frame.vertices[0].y).toBeCloseTo(55);
  });
});
