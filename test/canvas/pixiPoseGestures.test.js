import { describe, expect, it, vi } from 'vitest';
import {
  handlePoseHandleDrag,
  startPoseHandleDrag,
} from '@/features/canvas/infrastructure/rendering/pixi/PixiPoseGestures.js';

describe('Pixi pose gestures', () => {
  it('selects hovered bone and starts pose without moving its base', () => {
    const editor = {
      activeTool: 'pose',
      editorMode: 'animation',
      selection: [],
      activeBoneId: null,
    };
    const adapter = {
      editorRef: { current: editor },
      projectRef: {
        current: {
          nodes: [],
          bones: [{
            id: 'arm',
            parentId: null,
            setup: { x: 10, y: 20, rotation: 0, length: 50 },
          }],
          animations: [{ id: 'anim-1', tracks: [] }],
        },
      },
      animationRef: {
        current: {
          activeAnimationId: 'anim-1',
          currentTime: 0,
          draftPose: new Map(),
        },
      },
      _eventWorldPosition: vi.fn(() => ({ x: 60, y: 20 })),
      _sendWorkflow: vi.fn(),
      _setDragState: vi.fn(),
      _beginCommandBatch: vi.fn(),
      _executeCommand: vi.fn(),
    };

    startPoseHandleDrag(adapter, {}, {
      boneId: 'arm',
      pivot: { x: 10, y: 20 },
      rotation: 0,
      minRadius: 50,
      maxRadius: 2400,
    });

    expect(adapter._sendWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SELECT_RIG_HIT',
      boneIds: ['arm'],
      activeBoneId: 'arm',
    }));
    expect(adapter.editorRef.current.selection).toEqual(['arm']);
    expect(adapter._setDragState).toHaveBeenCalledWith(expect.objectContaining({
      type: 'poseHandle',
      boneId: 'arm',
      pivot: { x: 10, y: 20 },
    }));
    expect(adapter._beginCommandBatch).not.toHaveBeenCalled();
  });

  it('rotates a parent and moves its child around the parent pivot', () => {
    const draftPose = new Map();
    const editor = {
      activeTool: 'pose',
      editorMode: 'staging',
      selection: [],
      activeBoneId: null,
    };
    const adapter = {
      editorRef: { current: editor },
      projectRef: {
        current: {
          nodes: [],
          bones: [
            {
              id: 'arm',
              parentId: null,
              setup: { x: 0, y: 0, rotation: 0, length: 50 },
            },
            {
              id: 'hand',
              parentId: 'arm',
              setup: { x: 50, y: 0, rotation: 0, length: 20 },
            },
          ],
          animations: [],
        },
      },
      animationRef: {
        current: {
          activeAnimationId: null,
          currentTime: 0,
          draftPose,
          setDraftPose: (boneId, partial) => {
            draftPose.set(boneId, { ...(draftPose.get(boneId) ?? {}), ...partial });
          },
        },
      },
      _eventWorldPosition: vi
        .fn()
        .mockReturnValueOnce({ x: 50, y: 0 })
        .mockReturnValueOnce({ x: 0, y: 50 }),
      _sendWorkflow: vi.fn(),
      _setDragState: vi.fn(state => { adapter.drag = state; }),
      _beginCommandBatch: vi.fn(),
      _poseHandleExtensions: new Map(),
      markDirty: vi.fn(),
    };

    startPoseHandleDrag(adapter, {}, {
      boneId: 'arm',
      pivot: { x: 0, y: 0 },
      rotation: 0,
      minRadius: 50,
      maxRadius: 2400,
    });
    handlePoseHandleDrag(adapter, {}, adapter.drag);

    expect(draftPose.get('arm').rotation).toBeCloseTo(90);
    expect(draftPose.get('hand').x).toBeCloseTo(0);
    expect(draftPose.get('hand').y).toBeCloseTo(50);
    expect(draftPose.get('hand').rotation).toBeCloseTo(90);
  });
});
