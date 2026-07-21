import { describe, expect, it, vi } from 'vitest';
import { createActor } from 'xstate';
import {
  createCanvasFrameSubscriptions,
  didAnimationFrameStateChange,
  didFrameEditorStateChange,
  didWorkflowFrameStateChange,
} from '@/features/canvas/application/useCanvasFrameSubscriptions.js';
import { editorWorkflowMachine } from '@/features/canvas/application/editorWorkflowMachine.js';
import { useEditorStore } from '@/store/editorStore';

describe('canvas frame dependency selectors', () => {
  it.each([
    ['selection', ['a']],
    ['view', { zoom: 2, panX: 0, panY: 0 }],
    ['editorMode', 'animation'],
    ['showSkeleton', false],
    ['hoverHit', 'part-1'],
    ['hoverSource', 'panel'],
    ['activeConstraintId', 'ik-1'],
    ['marqueeBox', { x: 0, y: 0, w: 1, h: 1 }],
    ['drawBonePreview', { startX: 0 }],
    ['brushSize', 80],
    ['brushHardness', 0.2],
    ['blendShapeEditMode', true],
    ['weightPaintBoneId', 'b1'],
    ['activeBoneId', 'b1'],
    ['interaction', { kind: 'pendingPickIKBone', constraintId: 'ik-1' }],
    ['showExportArea', true],
  ])('editor field %s invalidates frame', (field, value) => {
    expect(didFrameEditorStateChange({}, { [field]: value })).toBe(true);
  });

  it.each([
    'activeLayerTab',
    'expandedGroups',
    'dragState',
    'meshDefaults',
  ])('panel-only field %s does not invalidate frame', (field) => {
    expect(didFrameEditorStateChange({}, { [field]: {} })).toBe(false);
  });

  it.each([
    ['activeTool', 'drawBone'],
    ['selectionTarget', 'rig'],
    ['riggingMode', 'bones'],
    ['riggingTool', 'draw'],
    ['toolMode', 'add_vertex'],
    ['meshEditMode', true],
    ['meshSubMode', 'adjust'],
    ['weightPaintMode', true],
  ])('workflow field %s invalidates frame', (field, value) => {
    expect(didWorkflowFrameStateChange({}, { [field]: value })).toBe(true);
  });

  it.each([
    ['activeAnimationId', 'anim-1'],
    ['currentTime', 100],
    ['endFrame', 30],
    ['fps', 60],
    ['loopKeyframes', true],
    ['draftPose', new Map()],
  ])('animation field %s invalidates frame', (field, value) => {
    expect(didAnimationFrameStateChange({}, { [field]: value })).toBe(true);
  });

  it('unrelated animation UI state does not invalidate frame', () => {
    expect(didAnimationFrameStateChange({}, { selectedKeyframes: ['k1'] })).toBe(false);
  });

  it('cleanup detaches store and actor subscriptions', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    const markDirty = vi.fn();
    const cleanup = createCanvasFrameSubscriptions({
      projectRef: { current: null },
      editorRef: { current: null },
      animationRef: { current: null },
      parameterRef: { current: null },
      workflowActorRef: actor,
      markDirty,
    });

    actor.send({ type: 'SET_TOOL', tool: 'drawBone' });
    useEditorStore.getState().setView({ zoom: 2 });
    expect(markDirty).toHaveBeenCalled();

    cleanup();
    markDirty.mockClear();
    actor.send({ type: 'SET_TOOL', tool: 'select' });
    useEditorStore.getState().setView({ zoom: 3 });
    expect(markDirty).not.toHaveBeenCalled();
    actor.stop();
  });
});
