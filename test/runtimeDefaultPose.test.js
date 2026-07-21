import { describe, expect, it } from 'vitest';
import { evaluatePose } from '@/runtime/pose.js';

describe('runtime default pose', () => {
  it('skins against setup bind matrices, not effective pose matrices', () => {
    const project = {
      bones: [{
        id: 'bone',
        parentId: null,
        setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      }],
      defaultPose: { bone: { rotation: 90 } },
      nodes: [{
        id: 'mesh',
        type: 'part',
        mesh: {
          vertices: [{ x: 10, y: 0 }],
          influences: [[{ boneId: 'bone', weight: 1 }]],
        },
      }],
    };

    const result = evaluatePose(project, new Map());
    expect(result.skinnedMeshes[0].vertices[0]).toBeCloseTo(0);
    expect(result.skinnedMeshes[0].vertices[1]).toBeCloseTo(10);
  });
});
