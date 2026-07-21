import { describe, expect, it, vi } from 'vitest';
import { clearSetupPoseTargets } from '@/features/canvas/infrastructure/rendering/pixi/PixiPosePreview.js';

function adapterFixture(project, activeTool = 'transform') {
  const clearDraftPoseForNode = vi.fn();
  return {
    editorRef: { current: { editorMode: 'staging', activeTool } },
    animationRef: { current: { clearDraftPoseForNode } },
    _executeCommand: vi.fn(command => command.payload.mutator(project)),
    clearDraftPoseForNode,
  };
}

describe('setup transform pose reset', () => {
  it('bakes displayed bone pose into setup and clears only its override', () => {
    const project = {
      bones: [{ id: 'arm', setup: { x: 0, y: 0, rotation: 0, length: 10 } }],
      constraints: [],
      defaultPose: {
        arm: { x: 20, rotation: 45 },
        hand: { rotation: 10 },
      },
    };
    const adapter = adapterFixture(project);

    clearSetupPoseTargets(adapter, ['arm'], {
      arm: { x: 20, y: 4, rotation: 45, length: 10 },
    });

    expect(project.bones[0].setup).toMatchObject({ x: 20, y: 4, rotation: 45, length: 10 });
    expect(project.defaultPose).toEqual({ hand: { rotation: 10 } });
    expect(adapter.clearDraftPoseForNode).toHaveBeenCalledWith('arm');
  });

  it('bakes IK target pose into setup constraint', () => {
    const project = {
      bones: [],
      constraints: [{ id: 'ik', targetX: 0, targetY: 0, mix: 1 }],
      defaultPose: { ik: { targetX: 30, targetY: 40 } },
    };
    const adapter = adapterFixture(project);

    clearSetupPoseTargets(adapter, ['ik'], {
      ik: { targetX: 30, targetY: 40, mix: 0.5 },
    });

    expect(project.constraints[0]).toMatchObject({ targetX: 30, targetY: 40, mix: 0.5 });
    expect(project.defaultPose).toEqual({});
  });

  it('never clears overrides while using Pose tool', () => {
    const project = {
      bones: [{ id: 'arm', setup: { rotation: 0 } }],
      constraints: [],
      defaultPose: { arm: { rotation: 45 } },
    };
    const adapter = adapterFixture(project, 'pose');

    clearSetupPoseTargets(adapter, ['arm'], { arm: { rotation: 45 } });

    expect(project.bones[0].setup.rotation).toBe(0);
    expect(project.defaultPose.arm.rotation).toBe(45);
    expect(adapter._executeCommand).not.toHaveBeenCalled();
  });
});
