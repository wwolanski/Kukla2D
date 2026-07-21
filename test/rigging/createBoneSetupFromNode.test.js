import { describe, it, expect } from 'vitest';
import { createBoneSetupFromNode } from '@/features/rigging';

describe('createBoneSetupFromNode', () => {
  it('returns default setup when node is missing', () => {
    expect(createBoneSetupFromNode(null)).toEqual({
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      shearX: 0,
      shearY: 0,
      length: 80,
    });
  });

  it('uses pivot when present', () => {
    expect(createBoneSetupFromNode({
      transform: {
        pivotX: 12,
        pivotY: 34,
        x: 100,
        y: 200,
        rotation: 45,
        scaleX: 2,
        scaleY: 3,
      },
    })).toEqual({
      x: 12,
      y: 34,
      rotation: 45,
      scaleX: 2,
      scaleY: 3,
      shearX: 0,
      shearY: 0,
      length: Math.max(20, Math.hypot(100, 200) || 80),
    });
  });

  it('falls back to x and y when pivot is missing', () => {
    expect(createBoneSetupFromNode({
      transform: {
        x: 7,
        y: 9,
      },
    })).toEqual({
      x: 7,
      y: 9,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      shearX: 0,
      shearY: 0,
      length: Math.max(20, Math.hypot(7, 9) || 80),
    });
  });

  it('uses default rotation, scale and shear when missing', () => {
    expect(createBoneSetupFromNode({ transform: {} })).toEqual({
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      shearX: 0,
      shearY: 0,
      length: 80,
    });
  });

  it('enforces minimum length 20', () => {
    expect(createBoneSetupFromNode({ transform: { x: 3, y: 4 } }).length).toBe(20);
  });

  it('falls back to length 80 when node has zero translation', () => {
    expect(createBoneSetupFromNode({ transform: { x: 0, y: 0 } }).length).toBe(80);
  });
});
