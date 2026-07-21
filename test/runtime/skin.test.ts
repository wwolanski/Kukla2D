import { describe, expect, it } from 'vitest';
import { linearBlendSkinning, normalizeInfluences } from '@/runtime/skin';
import { toBoneId, type VertexInfluence } from '@kukla2d/contracts';
import { mat3Identity } from '@/domain/transforms';

describe('normalizeInfluences', () => {
  const boneId = toBoneId('b1');
  it('normalizes weights to sum to 1', () => {
    const influences = [
      [
        { boneId, weight: 0.5 },
        { boneId: toBoneId('b2'), weight: 0.5 },
      ],
    ];
    const result = normalizeInfluences(influences);
    expect(result[0]).toHaveLength(2);
    const sum = result[0].reduce((s, inf) => s + inf.weight, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('filters non-positive weights', () => {
    const influences = [
      [
        { boneId, weight: 1 },
        { boneId: toBoneId('b2'), weight: 0 },
        { boneId: toBoneId('b3'), weight: -0.5 },
        { boneId: toBoneId('b4'), weight: NaN },
      ],
    ];
    const result = normalizeInfluences(influences);
    expect(result[0]).toHaveLength(1);
    expect(result[0][0].boneId).toBe('b1');
    expect(result[0][0].weight).toBe(1);
  });

  it('returns empty for all-zero vertex', () => {
    const influences = [[{ boneId, weight: 0 }]];
    expect(normalizeInfluences(influences)[0]).toEqual([]);
  });

  it('caps at 4 influences per vertex', () => {
    const influences = [
      [
        { boneId, weight: 0.5 },
        { boneId: toBoneId('b2'), weight: 0.4 },
        { boneId: toBoneId('b3'), weight: 0.3 },
        { boneId: toBoneId('b4'), weight: 0.2 },
        { boneId: toBoneId('b5'), weight: 0.1 },
      ],
    ];
    const result = normalizeInfluences(influences);
    expect(result[0]).toHaveLength(4);
  });
});

describe('linearBlendSkinning', () => {
  const boneId = toBoneId('b1');

  it('returns identity transform with identity matrices', () => {
    const vertices = new Float32Array([10, 20, 30, 40]);
    const influences = [
      [{ boneId, weight: 1 }],
      [{ boneId, weight: 1 }],
    ];
    const boneWorld = new Map([[boneId, mat3Identity()]]);
    const inverseBind = new Map([[boneId, mat3Identity()]]);
    const result = linearBlendSkinning(vertices, influences, boneWorld, inverseBind);
    expect(result[0]).toBeCloseTo(10, 4);
    expect(result[1]).toBeCloseTo(20, 4);
    expect(result[2]).toBeCloseTo(30, 4);
    expect(result[3]).toBeCloseTo(40, 4);
  });

  it('returns zeros when no influence has a matrix', () => {
    const vertices = new Float32Array([10, 20]);
    const influences = [[{ boneId: toBoneId('missing'), weight: 1 }]];
    const boneWorld = new Map();
    const inverseBind = new Map();
    const result = linearBlendSkinning(vertices, influences, boneWorld, inverseBind);
    expect(result[0]).toBe(10);
    expect(result[1]).toBe(20);
  });

  it('handles empty influences', () => {
    const vertices = new Float32Array([5, 10]);
    const influences: readonly (readonly VertexInfluence[])[] = [[]];
    const boneWorld = new Map();
    const inverseBind = new Map();
    const result = linearBlendSkinning(vertices, influences, boneWorld, inverseBind);
    expect(result).toHaveLength(2);
  });
});
