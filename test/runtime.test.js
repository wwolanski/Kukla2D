import { describe, it, expect } from 'vitest';
import { computeBoneWorldMatrices, computeInverseBindMatrices } from '../src/runtime/skeleton.js';
import { linearBlendSkinning, normalizeInfluences } from '../src/runtime/skin.js';
import { evaluatePose } from '../src/runtime/pose.js';

describe('skeleton', () => {
  it('computes world matrices for root bone', () => {
    const bones = [{ id: 'b1', name: 'bone1', parentId: null, setup: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } }];
    const matrices = computeBoneWorldMatrices(bones);
    expect(matrices.has('b1')).toBe(true);
    const m = matrices.get('b1');
    expect(m[6]).toBeCloseTo(10, 5);
    expect(m[7]).toBeCloseTo(20, 5);
  });

  it('computes parent-child hierarchy', () => {
    const bones = [
      { id: 'parent', name: 'parent', parentId: null, setup: { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } },
      { id: 'child', name: 'child', parentId: 'parent', setup: { x: 5, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } },
    ];
    const matrices = computeBoneWorldMatrices(bones);
    const childWorld = matrices.get('child');
    expect(childWorld[6]).toBeCloseTo(15, 5);
  });

  it('computes inverse bind matrices', () => {
    const worldMatrices = new Map();
    worldMatrices.set('b1', new Float32Array([1, 0, 0, 0, 1, 0, 10, 20, 1]));
    const inverse = computeInverseBindMatrices(worldMatrices);
    expect(inverse.has('b1')).toBe(true);
    const ibm = inverse.get('b1');
    expect(ibm[6]).toBeCloseTo(-10, 4);
    expect(ibm[7]).toBeCloseTo(-20, 4);
  });
});

describe('skin', () => {
  it('performs linear blend skinning with single bone', () => {
    const baseVertices = new Float32Array([0, 0, 10, 0, 0, 10]);
    const influences = [
      [{ boneId: 'b1', weight: 1.0 }],
      [{ boneId: 'b1', weight: 1.0 }],
      [{ boneId: 'b1', weight: 1.0 }],
    ];
    const boneWorldMatrices = new Map();
    boneWorldMatrices.set('b1', new Float32Array([1, 0, 0, 0, 1, 0, 5, 0, 1]));
    const inverseBindMatrices = new Map();
    inverseBindMatrices.set('b1', new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));

    const result = linearBlendSkinning(baseVertices, influences, boneWorldMatrices, inverseBindMatrices);
    expect(result[0]).toBeCloseTo(5, 4);
    expect(result[2]).toBeCloseTo(15, 4);
  });

  it('normalizes influences to sum to 1', () => {
    const influences = [
      [{ boneId: 'b1', weight: 3 }, { boneId: 'b2', weight: 1 }],
    ];
    const normalized = normalizeInfluences(influences);
    expect(normalized[0][0].weight).toBeCloseTo(0.75, 5);
    expect(normalized[0][1].weight).toBeCloseTo(0.25, 5);
  });

  it('limits to 4 influences per vertex', () => {
    const influences = [
      [
        { boneId: 'b1', weight: 0.4 },
        { boneId: 'b2', weight: 0.3 },
        { boneId: 'b3', weight: 0.2 },
        { boneId: 'b4', weight: 0.05 },
        { boneId: 'b5', weight: 0.05 },
      ],
    ];
    const normalized = normalizeInfluences(influences);
    expect(normalized[0].length).toBeLessThanOrEqual(4);
  });
});

describe('pose', () => {
  it('evaluates pose with no animations', () => {
    const project = {
      bones: [{ id: 'b1', name: 'root', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } }],
      nodes: [{ id: 'n1', type: 'part', name: 'test', mesh: null }],
    };
    const result = evaluatePose(project);
    expect(result.skinnedMeshes).toHaveLength(0);
    expect(result.boneMatrices.has('b1')).toBe(true);
  });

  it('applies animation overrides', () => {
    const project = {
      bones: [{ id: 'b1', name: 'root', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } }],
      nodes: [],
    };
    const overrides = new Map();
    overrides.set('b1', { x: 10, y: 20 });
    const result = evaluatePose(project, overrides);
    const m = result.boneMatrices.get('b1');
    expect(m[6]).toBeCloseTo(10, 5);
    expect(m[7]).toBeCloseTo(20, 5);
  });
});
