import { describe, it, expect } from 'vitest';
import { applyLegacyJointWeights, LEGACY_SKINNING_BLEND, LEGACY_LIMB_ROLE_MAP } from '@/features/canvas/domain/legacySkinning.js';

describe('applyLegacyJointWeights', () => {
  it('returns false when parent group missing', () => {
    const project = { nodes: [{ id: 'p1', parent: 'missing' }] };
    const r = applyLegacyJointWeights({ project, node: project.nodes[0], vertices: [] });
    expect(r).toBe(false);
  });

  it('returns false when parent has no boneRole', () => {
    const project = {
      nodes: [
        { id: 'p1', parent: 'g1' },
        { id: 'g1', boneRole: null },
      ],
    };
    const r = applyLegacyJointWeights({ project, node: project.nodes[0], vertices: [] });
    expect(r).toBe(false);
  });

  it('applies weights for leftArm -> leftElbow limb', () => {
    const project = {
      nodes: [
        { id: 'part1', parent: 'g1', mesh: {} },
        { id: 'g1', boneRole: 'leftArm', transform: { pivotX: 0, pivotY: 0 } },
        { id: 'elbow1', parent: 'g1', boneRole: 'leftElbow', transform: { pivotX: 50, pivotY: 0 } },
      ],
    };
    const node = project.nodes[0];
    const vertices = [
      { x: -10, y: 0 }, // upper arm
      { x: 100, y: 0 }, // lower arm past elbow
      { x: 50, y: 0 },  // exactly at elbow (w ~ 0.5)
    ];
    const r = applyLegacyJointWeights({ project, node, vertices });
    expect(r).toBe(true);
    expect(node.mesh.jointBoneId).toBe('elbow1');
    expect(node.mesh.boneWeights).toHaveLength(3);
    // Upper arm: negative proj2 → w clamped 0
    expect(node.mesh.boneWeights[0]).toBeCloseTo(0, 5);
    // Lower arm past elbow: positive proj2 → w > 0.5
    expect(node.mesh.boneWeights[1]).toBeGreaterThan(0.5);
  });

  it('returns false when child bone missing', () => {
    const project = {
      nodes: [
        { id: 'part1', parent: 'g1', mesh: {} },
        { id: 'g1', boneRole: 'leftArm', transform: { pivotX: 0, pivotY: 0 } },
      ],
    };
    const node = project.nodes[0];
    const r = applyLegacyJointWeights({ project, node, vertices: [{ x: 0, y: 0 }] });
    expect(r).toBe(false);
  });

  it('exposes the constant blend value and role map', () => {
    expect(LEGACY_SKINNING_BLEND).toBe(40);
    expect(LEGACY_LIMB_ROLE_MAP.leftArm).toBe('leftElbow');
    expect(LEGACY_LIMB_ROLE_MAP.rightLeg).toBe('rightKnee');
  });
});
