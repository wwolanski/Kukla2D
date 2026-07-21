import { describe, expect, it, vi } from 'vitest';
import {
  handleDragMove as onDragMove,
  startMoveDrag,
} from '@/features/canvas/infrastructure/rendering/pixi/PixiInputDrag.js';
import {
  startBoneDrag,
  startBoneLength,
  startBoneRotate,
} from '@/features/canvas/infrastructure/rendering/pixi/PixiBoneTransformDrag.js';

function createAdapter({
  editor,
  project,
  effectiveNodes = project.nodes,
  effectiveBones = project.bones,
}) {
  const draft = new Map();
  const animation = {
    activeAnimationId: editor.editorMode === 'animation' ? 'anim-1' : null,
    currentTime: 0,
    draftPose: draft,
    setDraftPose(targetId, partial) {
      draft.set(targetId, { ...(draft.get(targetId) ?? {}), ...partial });
    },
    clearDraftPoseForNode(targetId) {
      draft.delete(targetId);
    },
  };
  const adapter = {
    editorRef: { current: editor },
    projectRef: { current: project },
    animationRef: { current: animation },
    animationAuthoringAdapter: {
      previewPartial: vi.fn((targetId, partial) => {
        animation.setDraftPose(targetId, partial);
        return { valid: true };
      }),
      beginGesture: vi.fn(() => 'test-gesture'),
    },
    readFramePose: () => ({
      effectiveNodes,
      effectiveBones,
      poseOverrides: draft,
    }),
    _eventWorldPosition: event => event.world,
    _setDragState(state) { this._dragState = state; },
    _sendWorkflow: vi.fn(),
    _beginCommandBatch: vi.fn(),
    _executeCommand: vi.fn(command => {
      if (command.type === 'updateProject') command.payload.mutator(project);
    }),
    markDirty: vi.fn(),
  };
  return { adapter, animation, draft };
}

describe('Pixi transform draft regressions', () => {
  it('moves from rendered animation pose instead of stale project transform', () => {
    const project = {
      nodes: [{ id: 'part', type: 'part', transform: { x: 10, y: 20 } }],
      bones: [],
      animations: [{ id: 'anim-1', tracks: [] }],
    };
    const editor = {
      editorMode: 'animation',
      activeTool: 'transform',
      selection: ['part'],
      view: { zoom: 1, panX: 0, panY: 0 },
    };
    const effectiveNodes = [{ ...project.nodes[0], transform: { x: 100, y: 200 } }];
    const { adapter, draft } = createAdapter({ editor, project, effectiveNodes });

    startMoveDrag(adapter, { world: { x: 300, y: 400 } });
    onDragMove(adapter, { world: { x: 315, y: 390 } });

    expect(draft.get('part')).toEqual({ x: 115, y: 190 });
    expect(project.nodes[0].transform).toEqual({ x: 10, y: 20 });
  });

  it('blocks bone translation in staging POSE', () => {
    const project = {
      nodes: [],
      bones: [{ id: 'bone', setup: { x: 0, y: 0, rotation: 0, length: 80 } }],
      animations: [],
    };
    const editor = {
      editorMode: 'staging',
      activeTool: 'pose',
      selection: ['bone'],
      activeBoneId: 'bone',
      view: { zoom: 1, panX: 0, panY: 0 },
    };
    const effectiveBones = [{ ...project.bones[0], setup: { x: 50, y: 60, rotation: 0, length: 80 } }];
    const { adapter, draft } = createAdapter({ editor, project, effectiveBones });

    startBoneDrag(adapter, { world: { x: 50, y: 60 } }, 'bone');

    expect(adapter._dragState).toBeUndefined();
    expect(draft.size).toBe(0);
    expect(project.bones[0].setup).toEqual({ x: 0, y: 0, rotation: 0, length: 80 });
  });

  it('keeps raw setup as the bind snapshot when IK changes the displayed bone', () => {
    const project = {
      nodes: [],
      bones: [{ id: 'bone', setup: { x: 10, y: 20, rotation: 5, length: 80 } }],
      constraints: [{
        id: 'ik',
        type: 'ik',
        affectedBoneIds: ['bone'],
        targetX: 200,
        targetY: 100,
      }],
      animations: [],
    };
    const editor = {
      editorMode: 'staging',
      activeTool: 'transform',
      selection: ['bone'],
      activeBoneId: 'bone',
      view: { zoom: 1, panX: 0, panY: 0 },
    };
    const effectiveBones = [{
      ...project.bones[0],
      setup: { x: 10, y: 20, rotation: 47, length: 80 },
    }];
    const { adapter } = createAdapter({ editor, project, effectiveBones });

    startBoneDrag(adapter, { world: { x: 10, y: 20 } }, 'bone');

    expect(adapter._dragState.startBones.bone.rotation).toBe(47);
    expect(adapter._dragState.setupEffectiveValues.bone.rotation).toBe(5);
  });

  it('does not replace a saved pose when Transform only selects a bone', () => {
    const project = {
      nodes: [],
      bones: [{ id: 'bone', setup: { x: 0, y: 0, rotation: 0, length: 80 } }],
      defaultPose: { bone: { x: 50, rotation: 30 } },
      animations: [],
    };
    const editor = {
      editorMode: 'staging',
      activeTool: 'transform',
      selection: ['bone'],
      activeBoneId: 'bone',
      view: { zoom: 1, panX: 0, panY: 0 },
    };
    const effectiveBones = [{
      ...project.bones[0],
      setup: { x: 50, y: 0, rotation: 30, length: 80 },
    }];
    const { adapter } = createAdapter({ editor, project, effectiveBones });

    startBoneDrag(adapter, { world: { x: 50, y: 0 } }, 'bone');

    expect(adapter._dragState).toBeUndefined();
    expect(project.defaultPose).toEqual({ bone: { x: 50, rotation: 30 } });
    expect(project.bones[0].setup).toEqual({ x: 0, y: 0, rotation: 0, length: 80 });
  });

  it('rotates a bone in ANIMATION through authoring draft, not project setup', () => {
    const project = {
      nodes: [],
      bones: [{ id: 'bone', setup: { x: 0, y: 0, rotation: 5, length: 80 } }],
      animations: [{ id: 'anim-1', tracks: [] }],
    };
    const editor = {
      editorMode: 'animation',
      activeTool: 'transform',
      selection: ['bone'],
      activeBoneId: 'bone',
      view: { zoom: 1, panX: 0, panY: 0 },
    };
    const effectiveBones = [{ ...project.bones[0], setup: { x: 10, y: 20, rotation: 30, length: 80 } }];
    const { adapter, draft } = createAdapter({ editor, project, effectiveBones });

    startBoneRotate(adapter, { world: { x: 20, y: 20 } });
    onDragMove(adapter, { world: { x: 10, y: 30 } });

    expect(draft.get('bone').rotation).toBeCloseTo(120);
    expect(project.bones[0].setup.rotation).toBe(5);
  });

  it('blocks bone length drag in Animation mode (R5)', () => {
    const project = {
      nodes: [],
      bones: [{ id: 'bone', setup: { x: 0, y: 0, rotation: 0, length: 50 } }],
      animations: [{ id: 'anim-1', tracks: [] }],
    };
    const editor = {
      editorMode: 'animation',
      activeTool: 'transform',
      selection: ['bone'],
      activeBoneId: 'bone',
      view: { zoom: 1, panX: 0, panY: 0 },
    };
    const effectiveBones = [{ ...project.bones[0], setup: { x: 0, y: 0, rotation: 90, length: 100 } }];
    const { adapter, draft } = createAdapter({ editor, project, effectiveBones });

    startBoneLength(adapter, { world: { x: 0, y: 100 } });

    expect(adapter._dragState).toBeFalsy();
    expect(draft.size).toBe(0);
    expect(project.bones[0].setup.length).toBe(50);
  });
});
