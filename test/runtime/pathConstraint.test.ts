import { describe, expect, it } from 'vitest';
import { toBoneId, type Bone } from '@kukla2d/contracts';
import { solvePathConstraint } from '@/runtime/constraints/path';

describe('solvePathConstraint', () => {
  const boneId = toBoneId('b1');
  const bone: Bone = {
    id: boneId,
    name: 'Bone 1',
    parentId: null,
    setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 },
  };
  const pathPoints = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];

  it('returns empty overrides when path has fewer than 2 points', () => {
    const overrides = solvePathConstraint(
      { pathPoints: [{ x: 0, y: 0 }], affectedBoneIds: [boneId] },
      new Map(),
    );
    expect(overrides.size).toBe(0);
  });

  it('returns empty overrides when no affected bones', () => {
    const overrides = solvePathConstraint(
      { pathPoints, affectedBoneIds: [] },
      new Map([[boneId, bone]]),
    );
    expect(overrides.size).toBe(0);
  });

  it('overrides bone position along the path', () => {
    const overrides = solvePathConstraint(
      { pathPoints, affectedBoneIds: [boneId], position: 50 },
      new Map([[boneId, bone]]),
    );
    expect(overrides.size).toBe(1);
    const override = overrides.get(boneId);
    expect(override!.x).toBeGreaterThan(0);
  });

  it('respects mix parameter', () => {
    const full = solvePathConstraint(
      { pathPoints, affectedBoneIds: [boneId], position: 100, mix: 1 },
      new Map([[boneId, bone]]),
    );
    const half = solvePathConstraint(
      { pathPoints, affectedBoneIds: [boneId], position: 100, mix: 0.5 },
      new Map([[boneId, bone]]),
    );
    const fullX = full.get(boneId)!.x;
    const halfX = half.get(boneId)!.x;
    expect(fullX).toBeGreaterThan(halfX);
  });

  it('skips bones not in the bone map', () => {
    const overrides = solvePathConstraint(
      { pathPoints, affectedBoneIds: [boneId, toBoneId('missing')] },
      new Map(),
    );
    expect(overrides.size).toBe(0);
  });

  it('clamps position to valid range', () => {
    const overrides = solvePathConstraint(
      { pathPoints, affectedBoneIds: [boneId], position: -999 },
      new Map([[boneId, bone]]),
    );
    expect(overrides.get(boneId)!.x).toBeCloseTo(0, 2);
  });
});
