import { describe, expect, it } from 'vitest';
import {
  assignConstraintToBone,
  collectBoneDescendants,
  createIkConstraint,
  findConstraintConflict,
  findNearestAvailableBoneTip,
  refreshIkTopology,
  trySetBoneParent,
  findNearestBoneTip,
} from '@/features/canvas/domain/ikConstraintCreation.js';

const bones = [
  { id: 'root', parentId: null, setup: { x: 0, y: 0, length: 20, rotation: 0 } },
  { id: 'child', parentId: 'root', setup: { x: 20, y: 0, length: 15, rotation: 0 } },
  { id: 'grandchild', parentId: 'child', setup: { x: 35, y: 0, length: 10, rotation: 0 } },
  { id: 'other', parentId: null, setup: { x: 100, y: 100, length: 20, rotation: 90 } },
];

describe('IK constraint creation', () => {
  it('finds nearest bone using its tip, not base or midpoint', () => {
    expect(findNearestBoneTip(bones, 34, 1)?.boneId).toBe('child');
  });

  it('collects selected bone and descendants without parents', () => {
    expect(collectBoneDescendants(bones, 'child')).toEqual(['child', 'grandchild']);
  });

  it('assigns root and descendants to constraint', () => {
    const constraint = createIkConstraint({
      id: 'ik-1', sequence: 1, x: 50, y: 10, color: 0xff00ff,
    });
    assignConstraintToBone(constraint, bones, 'child');

    expect(constraint).toMatchObject({
      name: 'IK 1',
      assignedBoneId: 'child',
      affectedBoneIds: ['child', 'grandchild'],
      targetX: 50,
      targetY: 10,
      color: 0xff00ff,
    });
  });

  it('prevents overlapping IK ownership and skips occupied chains', () => {
    const existing = {
      id: 'ik-existing',
      type: 'ik',
      name: 'IK 1',
      affectedBoneIds: ['child', 'grandchild'],
    };

    expect(findConstraintConflict([existing], bones, 'child')?.id).toBe('ik-existing');
    expect(findConstraintConflict([existing], bones, 'grandchild')?.id).toBe('ik-existing');
    expect(findConstraintConflict([existing], bones, 'other')).toBeNull();
    expect(findNearestAvailableBoneTip(bones, [existing], 34, 1)?.boneId).not.toBe('grandchild');
  });

  it('rejects reparenting that would overlap two IK chains', () => {
    const project = {
      bones: [
        { id: 'bone-1', parentId: null, setup: {} },
        { id: 'bone-2', parentId: null, setup: {} },
      ],
      constraints: [
        { id: 'ik-1', type: 'ik', name: 'IK 1', assignedBoneId: 'bone-1', affectedBoneIds: ['bone-1'] },
        { id: 'ik-2', type: 'ik', name: 'IK 2', assignedBoneId: 'bone-2', affectedBoneIds: ['bone-2'] },
      ],
    };

    const result = trySetBoneParent(project, 'bone-2', 'bone-1');

    expect(result.ok).toBe(false);
    expect(project.bones[1].parentId).toBeNull();
    expect(project.constraints[0].affectedBoneIds).toEqual(['bone-1']);
  });

  it('accepts safe reparenting and refreshes affected descendants', () => {
    const project = {
      bones: [
        { id: 'root', parentId: null, setup: {} },
        { id: 'child', parentId: null, setup: {} },
      ],
      constraints: [
        { id: 'ik-1', type: 'ik', name: 'IK 1', assignedBoneId: 'root', affectedBoneIds: ['root'] },
      ],
    };

    expect(trySetBoneParent(project, 'child', 'root').ok).toBe(true);
    expect(project.constraints[0].affectedBoneIds).toEqual(['root', 'child']);
    expect(refreshIkTopology(project).ok).toBe(true);
  });
});
