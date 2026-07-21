import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { editorWorkflowMachine } from '@/features/canvas/application/editorWorkflowMachine.js';
import { routerResultToMachineEvent, routerResultToCommandEvent, routerResultToSelectionEvent } from '@/features/canvas/domain/editorWorkflowEvents.js';

function startMachine() {
  const actor = createActor(editorWorkflowMachine);
  actor.start();
  return actor;
}

describe('editorWorkflowMachine', () => {
  it('starts in idle', () => {
    const actor = startMachine();
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.selectionTarget).toBe('all');
    actor.stop();
  });

  it('idle → panning → idle on POINTER_UP', () => {
    const actor = startMachine();
    actor.send({ type: 'POINTER_DOWN', intent: 'pan' });
    expect(actor.getSnapshot().value).toBe('panning');
    actor.send({ type: 'POINTER_UP' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('idle → panning → idle on CANCEL', () => {
    const actor = startMachine();
    actor.send({ type: 'POINTER_DOWN', intent: 'pan' });
    expect(actor.getSnapshot().value).toBe('panning');
    actor.send({ type: 'CANCEL' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('idle → drawingBone → idle on POINTER_UP', () => {
    const actor = startMachine();
    actor.send({ type: 'POINTER_DOWN', intent: 'drawBone' });
    expect(actor.getSnapshot().value).toBe('drawingBone');
    actor.send({ type: 'POINTER_UP' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('idle → drawingBone → idle on CANCEL', () => {
    const actor = startMachine();
    actor.send({ type: 'POINTER_DOWN', intent: 'drawBone' });
    expect(actor.getSnapshot().value).toBe('drawingBone');
    actor.send({ type: 'CANCEL' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('idle → editingMesh → idle on POINTER_UP', () => {
    const actor = startMachine();
    actor.send({ type: 'POINTER_DOWN', intent: 'meshEditAddVertex' });
    expect(actor.getSnapshot().value).toBe('editingMesh');
    actor.send({ type: 'POINTER_UP' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('idle → editingMesh → idle on EXIT_MESH_EDIT', () => {
    const actor = startMachine();
    actor.send({ type: 'POINTER_DOWN', intent: 'startBrushDrag' });
    expect(actor.getSnapshot().value).toBe('editingMesh');
    actor.send({ type: 'EXIT_MESH_EDIT' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('idle → weightPainting → idle on POINTER_UP', () => {
    const actor = startMachine();
    actor.send({ type: 'POINTER_DOWN', intent: 'startWeightPaint' });
    expect(actor.getSnapshot().value).toBe('weightPainting');
    actor.send({ type: 'POINTER_UP' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('idle → draggingTransform → idle on POINTER_UP', () => {
    const actor = startMachine();
    actor.send({ type: 'POINTER_DOWN', intent: 'dragZoom' });
    expect(actor.getSnapshot().value).toBe('draggingTransform');
    actor.send({ type: 'POINTER_UP' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('selectPart transitions through selecting back to idle (auto)', () => {
    const actor = startMachine();
    actor.send({ type: 'POINTER_DOWN', intent: 'selectPart', partId: 'p1' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('SET_TOOL updates context.activeTool', () => {
    const actor = startMachine();
    actor.send({ type: 'SET_SELECTION_TARGET', target: 'rig' });
    actor.send({ type: 'SET_TOOL', tool: 'transform' });
    expect(actor.getSnapshot().context.activeTool).toBe('transform');
    expect(actor.getSnapshot().context.selectionTarget).toBe('rig');
    expect(actor.getSnapshot().context.riggingMode).toBe('bones');
    expect(actor.getSnapshot().context.meshEditMode).toBe(false);
    actor.stop();
  });

  it('SET_TOOL meshEdit sets meshEditMode true', () => {
    const actor = startMachine();
    actor.send({ type: 'SET_TOOL', tool: 'meshEdit' });
    expect(actor.getSnapshot().context.meshEditMode).toBe(true);
    actor.stop();
  });

  it('SET_TOOL mesh toolbar tools set explicit mesh modes', () => {
    const actor = startMachine();
    actor.send({ type: 'SET_TOOL', tool: 'meshDeform' });
    expect(actor.getSnapshot().context).toMatchObject({
      activeTool: 'meshDeform',
      meshEditMode: true,
      meshSubMode: 'deform',
      toolMode: 'select',
      selectionTarget: 'element',
    });
    actor.send({ type: 'SET_TOOL', tool: 'meshAddVertex' });
    expect(actor.getSnapshot().context).toMatchObject({
      activeTool: 'meshAddVertex',
      meshEditMode: true,
      meshSubMode: 'adjust',
      toolMode: 'add_vertex',
    });
    actor.send({ type: 'SET_TOOL', tool: 'meshRemoveVertex' });
    expect(actor.getSnapshot().context).toMatchObject({
      activeTool: 'meshRemoveVertex',
      meshEditMode: true,
      meshSubMode: 'adjust',
      toolMode: 'remove_vertex',
    });
    actor.stop();
  });

  it('SET_SELECTION_TARGET updates context', () => {
    const actor = startMachine();
    actor.send({ type: 'SET_SELECTION_TARGET', target: 'rig' });
    expect(actor.getSnapshot().context.selectionTarget).toBe('rig');
    actor.stop();
  });

  it('ENTER_MESH_EDIT / EXIT_MESH_EDIT toggle context', () => {
    const actor = startMachine();
    actor.send({ type: 'ENTER_MESH_EDIT' });
    expect(actor.getSnapshot().context.meshEditMode).toBe(true);
    actor.send({ type: 'EXIT_MESH_EDIT' });
    expect(actor.getSnapshot().context.meshEditMode).toBe(false);
    actor.stop();
  });

  it('ENTER_RIG / EXIT_RIG toggle selectionTarget', () => {
    const actor = startMachine();
    actor.send({ type: 'ENTER_RIG' });
    expect(actor.getSnapshot().context.selectionTarget).toBe('rig');
    actor.send({ type: 'EXIT_RIG' });
    expect(actor.getSnapshot().context.selectionTarget).toBe('element');
    actor.stop();
  });

  it('machine does not import Zustand store', async () => {
    const mod = await import('@/features/canvas/application/editorWorkflowMachine.js');
    const src = String(mod.editorWorkflowMachine);
    expect(src).not.toContain('useEditorStore');
    expect(src).not.toContain('useProjectStore');
  });

  describe('command events (new vocabulary)', () => {
    it('START_PAN → panning with session', () => {
      const actor = startMachine();
      actor.send({ type: 'START_PAN', payload: { button: 1 } });
      expect(actor.getSnapshot().value).toBe('panning');
      const session = actor.getSnapshot().context.activeSession;
      expect(session).not.toBeNull();
      expect(session.kind).toBe('pan');
      expect(session.status).toBe('active');
      actor.stop();
    });

    it('START_TRANSFORM_DRAG → draggingTransform with dragZoom session', () => {
      const actor = startMachine();
      actor.send({ type: 'START_TRANSFORM_DRAG', payload: { nodeId: 'n1' } });
      expect(actor.getSnapshot().value).toBe('draggingTransform');
      const session = actor.getSnapshot().context.activeSession;
      expect(session.kind).toBe('dragZoom');
      expect(session.payload.nodeId).toBe('n1');
      actor.stop();
    });

    it('START_MESH_BRUSH → editingMesh with session', () => {
      const actor = startMachine();
      actor.send({ type: 'START_MESH_BRUSH', payload: { mode: 'deform' } });
      expect(actor.getSnapshot().value).toBe('editingMesh');
      expect(actor.getSnapshot().context.activeSession.kind).toBe('meshBrush');
      actor.stop();
    });

    it('START_WEIGHT_PAINT → weightPainting with session', () => {
      const actor = startMachine();
      actor.send({ type: 'START_WEIGHT_PAINT', payload: { boneId: 'b1' } });
      expect(actor.getSnapshot().value).toBe('weightPainting');
      expect(actor.getSnapshot().context.activeSession.kind).toBe('weightPaint');
      actor.stop();
    });

    it('START_DRAW_BONE → drawingBone with session', () => {
      const actor = startMachine();
      actor.send({ type: 'START_DRAW_BONE' });
      expect(actor.getSnapshot().value).toBe('drawingBone');
      expect(actor.getSnapshot().context.activeSession.kind).toBe('drawBone');
      actor.stop();
    });

    it('START_VERTEX_DRAG → editingMesh with vertexDrag session', () => {
      const actor = startMachine();
      actor.send({ type: 'START_VERTEX_DRAG', payload: { partId: 'p1', vertexIndex: 0 } });
      expect(actor.getSnapshot().value).toBe('editingMesh');
      expect(actor.getSnapshot().context.activeSession.kind).toBe('vertexDrag');
      expect(actor.getSnapshot().context.activeSession.payload.partId).toBe('p1');
      expect(actor.getSnapshot().context.activeSession.payload.vertexIndex).toBe(0);
      actor.stop();
    });

    it('COMMIT_GESTURE clears session and returns to idle', () => {
      const actor = startMachine();
      actor.send({ type: 'START_PAN' });
      expect(actor.getSnapshot().context.activeSession).not.toBeNull();
      actor.send({ type: 'COMMIT_GESTURE' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.activeSession).toBeNull();
      actor.stop();
    });

    it('CANCEL_GESTURE clears session and returns to idle', () => {
      const actor = startMachine();
      actor.send({ type: 'START_TRANSFORM_DRAG' });
      actor.send({ type: 'CANCEL_GESTURE' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.activeSession).toBeNull();
      actor.stop();
    });

    it('MOVE_GESTURE updates session payload', () => {
      const actor = startMachine();
      actor.send({ type: 'START_PAN' });
      actor.send({ type: 'MOVE_GESTURE', payload: { dx: 10, dy: 20 } });
      const session = actor.getSnapshot().context.activeSession;
      expect(session.payload.dx).toBe(10);
      expect(session.payload.dy).toBe(20);
      actor.stop();
    });

    it('POINTER_UP from command-started gesture clears session', () => {
      const actor = startMachine();
      actor.send({ type: 'START_DRAW_BONE' });
      expect(actor.getSnapshot().context.activeSession).not.toBeNull();
      actor.send({ type: 'POINTER_UP' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.activeSession).toBeNull();
      actor.stop();
    });
  });
});

describe('routerResultToMachineEvent', () => {
  it('converts startPan to POINTER_DOWN with intent pan', () => {
    expect(routerResultToMachineEvent({ type: 'startPan' })).toEqual({
      type: 'POINTER_DOWN',
      intent: 'pan',
    });
  });

  it('converts selectPart with partId', () => {
    expect(routerResultToMachineEvent({ type: 'selectPart', partId: 'p1' })).toEqual({
      type: 'POINTER_DOWN',
      intent: 'selectPart',
      partId: 'p1',
    });
  });

  it('returns null for unknown type', () => {
    expect(routerResultToMachineEvent({ type: 'unknown' })).toBeNull();
  });

  it('converts meshEditAddVertex', () => {
    expect(routerResultToMachineEvent({ type: 'meshEditAddVertex' })).toEqual({
      type: 'POINTER_DOWN',
      intent: 'meshEditAddVertex',
    });
  });

  it('converts startWeightPaint', () => {
    expect(routerResultToMachineEvent({ type: 'startWeightPaint' })).toEqual({
      type: 'POINTER_DOWN',
      intent: 'startWeightPaint',
    });
  });

  describe('routerResultToCommandEvent', () => {
    it('converts startPan to START_PAN', () => {
      expect(routerResultToCommandEvent({ type: 'startPan' })).toEqual({ type: 'START_PAN' });
    });

    it('converts startDragZoom to START_TRANSFORM_DRAG', () => {
      expect(routerResultToCommandEvent({ type: 'startDragZoom' })).toEqual({ type: 'START_TRANSFORM_DRAG' });
    });

    it('converts startDrawBone to START_DRAW_BONE', () => {
      expect(routerResultToCommandEvent({ type: 'startDrawBone' })).toEqual({ type: 'START_DRAW_BONE' });
    });

    it('converts startBrushDrag to START_MESH_BRUSH', () => {
      expect(routerResultToCommandEvent({ type: 'startBrushDrag' })).toEqual({ type: 'START_MESH_BRUSH' });
    });

    it('converts startVertexDrag to START_VERTEX_DRAG', () => {
      expect(routerResultToCommandEvent({ type: 'startVertexDrag' })).toEqual({ type: 'START_VERTEX_DRAG' });
    });

    it('converts startWeightPaint to START_WEIGHT_PAINT', () => {
      expect(routerResultToCommandEvent({ type: 'startWeightPaint' })).toEqual({ type: 'START_WEIGHT_PAINT' });
    });

    it('returns null for selectPart', () => {
      expect(routerResultToCommandEvent({ type: 'selectPart', partId: 'p1' })).toBeNull();
    });

    it('returns null for clearSelection', () => {
      expect(routerResultToCommandEvent({ type: 'clearSelection' })).toBeNull();
    });
  });
});

describe('routerResultToSelectionEvent', () => {
  it('converts selectPart to SELECT_HIT with partId', () => {
    expect(routerResultToSelectionEvent({ type: 'selectPart', partId: 'p1' })).toEqual({
      type: 'SELECT_HIT',
      partId: 'p1',
    });
  });

  it('converts clearSelection to CLEAR_SELECTION', () => {
    expect(routerResultToSelectionEvent({ type: 'clearSelection' })).toEqual({
      type: 'CLEAR_SELECTION',
    });
  });

  it('returns null for gesture router results', () => {
    expect(routerResultToSelectionEvent({ type: 'startPan' })).toBeNull();
    expect(routerResultToSelectionEvent({ type: 'startDrawBone' })).toBeNull();
  });

  it('returns null for unknown type', () => {
    expect(routerResultToSelectionEvent({ type: 'unknown' })).toBeNull();
  });
});

describe('marquee workflow', () => {
  it('START_MARQUEE → marqueeSelecting with session and marqueeBox', () => {
    const actor = startMachine();
    actor.send({ type: 'START_MARQUEE', origin: { x: 10, y: 20 } });
    expect(actor.getSnapshot().value).toBe('marqueeSelecting');
    expect(actor.getSnapshot().context.activeSession).not.toBeNull();
    expect(actor.getSnapshot().context.activeSession.kind).toBe('marquee');
    expect(actor.getSnapshot().context.marqueeBox).toEqual({ x: 10, y: 20, w: 0, h: 0 });
    actor.stop();
  });

  it('UPDATE_MARQUEE updates marqueeBox', () => {
    const actor = startMachine();
    actor.send({ type: 'START_MARQUEE', origin: { x: 0, y: 0 } });
    actor.send({ type: 'UPDATE_MARQUEE', box: { x: 0, y: 0, w: 100, h: 50 } });
    expect(actor.getSnapshot().context.marqueeBox).toEqual({ x: 0, y: 0, w: 100, h: 50 });
    actor.stop();
  });

  it('COMMIT_MARQUEE → idle and clears session + marqueeBox', () => {
    const actor = startMachine();
    actor.send({ type: 'START_MARQUEE', origin: { x: 0, y: 0 } });
    actor.send({ type: 'UPDATE_MARQUEE', box: { x: 0, y: 0, w: 50, h: 50 } });
    actor.send({ type: 'COMMIT_MARQUEE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.activeSession).toBeNull();
    expect(actor.getSnapshot().context.marqueeBox).toBeNull();
    actor.stop();
  });

  it('CANCEL_GESTURE from marqueeSelecting → idle and clears', () => {
    const actor = startMachine();
    actor.send({ type: 'START_MARQUEE', origin: { x: 5, y: 5 } });
    actor.send({ type: 'CANCEL_GESTURE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.activeSession).toBeNull();
    expect(actor.getSnapshot().context.marqueeBox).toBeNull();
    actor.stop();
  });

  it('CANCEL from marqueeSelecting → idle and clears', () => {
    const actor = startMachine();
    actor.send({ type: 'START_MARQUEE', origin: { x: 0, y: 0 } });
    actor.send({ type: 'CANCEL' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.marqueeBox).toBeNull();
    actor.stop();
  });
});

describe('drag-and-drop import workflow', () => {
  it('DRAG_FILES_ENTER → dragOverFiles with importStatus dragOver', () => {
    const actor = startMachine();
    actor.send({ type: 'DRAG_FILES_ENTER' });
    expect(actor.getSnapshot().value).toBe('dragOverFiles');
    expect(actor.getSnapshot().context.importStatus).toBe('dragOver');
    actor.stop();
  });

  it('DRAG_FILES_LEAVE → idle with importStatus idle', () => {
    const actor = startMachine();
    actor.send({ type: 'DRAG_FILES_ENTER' });
    actor.send({ type: 'DRAG_FILES_LEAVE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.importStatus).toBe('idle');
    actor.stop();
  });

  it('DROP_FILES from dragOverFiles → importingFiles', () => {
    const actor = startMachine();
    actor.send({ type: 'DRAG_FILES_ENTER' });
    actor.send({ type: 'DROP_FILES' });
    expect(actor.getSnapshot().value).toBe('importingFiles');
    expect(actor.getSnapshot().context.importStatus).toBe('importing');
    actor.stop();
  });

  it('DROP_FILES from idle → importingFiles', () => {
    const actor = startMachine();
    actor.send({ type: 'DROP_FILES' });
    expect(actor.getSnapshot().value).toBe('importingFiles');
    expect(actor.getSnapshot().context.importStatus).toBe('importing');
    actor.stop();
  });

  it('IMPORT_DONE → idle with importStatus done', () => {
    const actor = startMachine();
    actor.send({ type: 'DROP_FILES' });
    actor.send({ type: 'IMPORT_DONE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.importStatus).toBe('done');
    actor.stop();
  });

  it('IMPORT_FAILED → idle with importStatus failed', () => {
    const actor = startMachine();
    actor.send({ type: 'DROP_FILES' });
    actor.send({ type: 'IMPORT_FAILED' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.importStatus).toBe('failed');
    actor.stop();
  });

  it('CANCEL_GESTURE from importingFiles → idle with importStatus idle', () => {
    const actor = startMachine();
    actor.send({ type: 'DROP_FILES' });
    actor.send({ type: 'CANCEL_GESTURE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.importStatus).toBe('idle');
    actor.stop();
  });

  it('CANCEL_GESTURE from dragOverFiles → idle', () => {
    const actor = startMachine();
    actor.send({ type: 'DRAG_FILES_ENTER' });
    actor.send({ type: 'CANCEL_GESTURE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.importStatus).toBe('idle');
    actor.stop();
  });
});

describe('selection events in idle', () => {
  it('SELECT_HIT accepted in idle (stays idle)', () => {
    const actor = startMachine();
    actor.send({ type: 'SELECT_HIT', partId: 'p1' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('CLEAR_SELECTION accepted in idle (stays idle)', () => {
    const actor = startMachine();
    actor.send({ type: 'CLEAR_SELECTION' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });
});

describe('invalid events do not change state', () => {
  it('COMMIT_GESTURE from idle is a no-op', () => {
    const actor = startMachine();
    actor.send({ type: 'COMMIT_GESTURE' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('MOVE_GESTURE from idle is a no-op', () => {
    const actor = startMachine();
    actor.send({ type: 'MOVE_GESTURE', payload: { dx: 1 } });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('POINTER_UP from idle is a no-op', () => {
    const actor = startMachine();
    actor.send({ type: 'POINTER_UP' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('UPDATE_MARQUEE from idle is a no-op', () => {
    const actor = startMachine();
    actor.send({ type: 'UPDATE_MARQUEE', box: { x: 0, y: 0, w: 1, h: 1 } });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.marqueeBox).toBeNull();
    actor.stop();
  });

  it('IMPORT_DONE from idle is a no-op', () => {
    const actor = startMachine();
    actor.send({ type: 'IMPORT_DONE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.importStatus).toBe('idle');
    actor.stop();
  });

  it('DRAG_FILES_LEAVE from idle is a no-op', () => {
    const actor = startMachine();
    actor.send({ type: 'DRAG_FILES_LEAVE' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });
});

describe('session lifecycle — activeSession cleared after commit/cancel', () => {
  const gestureStartEvents = [
    { type: 'START_PAN', commitEvent: { type: 'COMMIT_GESTURE' }, state: 'panning' },
    { type: 'START_TRANSFORM_DRAG', commitEvent: { type: 'COMMIT_GESTURE' }, state: 'draggingTransform' },
    { type: 'START_MESH_BRUSH', commitEvent: { type: 'COMMIT_GESTURE' }, state: 'editingMesh' },
    { type: 'START_WEIGHT_PAINT', commitEvent: { type: 'COMMIT_GESTURE' }, state: 'weightPainting' },
    { type: 'START_DRAW_BONE', commitEvent: { type: 'COMMIT_GESTURE' }, state: 'drawingBone' },
    { type: 'START_VERTEX_DRAG', commitEvent: { type: 'COMMIT_GESTURE' }, state: 'editingMesh' },
    { type: 'START_MARQUEE', commitEvent: { type: 'COMMIT_MARQUEE' }, origin: { x: 0, y: 0 }, state: 'marqueeSelecting' },
    { type: 'START_GIZMO_MOVE', commitEvent: { type: 'COMMIT_GESTURE' }, state: 'editingGizmo' },
    { type: 'START_GIZMO_ROTATE', commitEvent: { type: 'COMMIT_GESTURE' }, state: 'editingGizmo' },
    { type: 'START_GIZMO_PIVOT', commitEvent: { type: 'COMMIT_GESTURE' }, state: 'editingGizmo' },
    { type: 'START_SKELETON_JOINT', commitEvent: { type: 'COMMIT_GESTURE' }, state: 'editingRig' },
    { type: 'START_SKELETON_BONE', commitEvent: { type: 'COMMIT_GESTURE' }, state: 'editingRig' },
    { type: 'START_SKELETON_TRACKPAD', commitEvent: { type: 'COMMIT_GESTURE' }, state: 'editingRig' },
    { type: 'START_SKELETON_ROTATE', commitEvent: { type: 'COMMIT_GESTURE' }, state: 'editingRig' },
  ];

  for (const { type, commitEvent, state } of gestureStartEvents) {
    it(`${type} creates session, commit clears it`, () => {
      const actor = startMachine();
      actor.send(type === 'START_MARQUEE' ? { type, origin: { x: 0, y: 0 } } : { type });
      expect(actor.getSnapshot().value).toBe(state);
      expect(actor.getSnapshot().context.activeSession).not.toBeNull();
      actor.send(commitEvent);
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.activeSession).toBeNull();
      actor.stop();
    });

    it(`${type} creates session, CANCEL_GESTURE clears it`, () => {
      const actor = startMachine();
      actor.send(type === 'START_MARQUEE' ? { type, origin: { x: 0, y: 0 } } : { type });
      expect(actor.getSnapshot().context.activeSession).not.toBeNull();
      actor.send({ type: 'CANCEL_GESTURE' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.activeSession).toBeNull();
      actor.stop();
    });
  }
});

describe('overlay gesture sessions — gizmo', () => {
  it('START_GIZMO_MOVE creates gizmoMove session in editingGizmo', () => {
    const actor = startMachine();
    actor.send({ type: 'START_GIZMO_MOVE', payload: { nodeId: 'n1', startX: 0, startY: 0 } });
    const snap = actor.getSnapshot();
    expect(snap.value).toBe('editingGizmo');
    expect(snap.context.activeSession.kind).toBe('gizmoMove');
    expect(snap.context.activeSession.payload.nodeId).toBe('n1');
    actor.stop();
  });

  it('START_GIZMO_ROTATE creates gizmoRotate session in editingGizmo', () => {
    const actor = startMachine();
    actor.send({ type: 'START_GIZMO_ROTATE', payload: { nodeId: 'n1', startAngle: 0, startRotation: 0 } });
    const snap = actor.getSnapshot();
    expect(snap.value).toBe('editingGizmo');
    expect(snap.context.activeSession.kind).toBe('gizmoRotate');
    actor.stop();
  });

  it('START_GIZMO_PIVOT creates gizmoPivot session in editingGizmo', () => {
    const actor = startMachine();
    actor.send({ type: 'START_GIZMO_PIVOT', payload: { nodeId: 'n1' } });
    const snap = actor.getSnapshot();
    expect(snap.value).toBe('editingGizmo');
    expect(snap.context.activeSession.kind).toBe('gizmoPivot');
    actor.stop();
  });

  it('MOVE_GESTURE updates gizmo session payload', () => {
    const actor = startMachine();
    actor.send({ type: 'START_GIZMO_MOVE', payload: { nodeId: 'n1' } });
    actor.send({ type: 'MOVE_GESTURE', payload: { clientX: 100, clientY: 200 } });
    const snap = actor.getSnapshot();
    expect(snap.context.activeSession.payload.clientX).toBe(100);
    expect(snap.context.activeSession.payload.clientY).toBe(200);
    actor.stop();
  });

  it('editingGizmo → idle on CANCEL_GESTURE clears session', () => {
    const actor = startMachine();
    actor.send({ type: 'START_GIZMO_ROTATE', payload: { nodeId: 'n1' } });
    actor.send({ type: 'CANCEL_GESTURE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.activeSession).toBeNull();
    actor.stop();
  });
});

describe('overlay gesture sessions — skeleton', () => {
  it('START_SKELETON_JOINT creates skeletonJoint session in editingRig', () => {
    const actor = startMachine();
    actor.send({ type: 'START_SKELETON_JOINT', payload: { nodeId: 'j1' } });
    const snap = actor.getSnapshot();
    expect(snap.value).toBe('editingRig');
    expect(snap.context.activeSession.kind).toBe('skeletonJoint');
    expect(snap.context.activeSession.payload.nodeId).toBe('j1');
    actor.stop();
  });

  it('START_SKELETON_BONE creates skeletonBone session in editingRig', () => {
    const actor = startMachine();
    actor.send({ type: 'START_SKELETON_BONE', payload: { boneId: 'b1', startWorldX: 0, startWorldY: 0 } });
    const snap = actor.getSnapshot();
    expect(snap.value).toBe('editingRig');
    expect(snap.context.activeSession.kind).toBe('skeletonBone');
    actor.stop();
  });

  it('START_SKELETON_TRACKPAD creates skeletonTrackpad session in editingRig', () => {
    const actor = startMachine();
    actor.send({ type: 'START_SKELETON_TRACKPAD', payload: { nodeId: 'n1', tpX: 50, tpY: 50 } });
    const snap = actor.getSnapshot();
    expect(snap.value).toBe('editingRig');
    expect(snap.context.activeSession.kind).toBe('skeletonTrackpad');
    actor.stop();
  });

  it('START_SKELETON_ROTATE creates skeletonRotate session in editingRig', () => {
    const actor = startMachine();
    actor.send({ type: 'START_SKELETON_ROTATE', payload: { nodeId: 'n1', startAngle: 0, startRotation: 0 } });
    const snap = actor.getSnapshot();
    expect(snap.value).toBe('editingRig');
    expect(snap.context.activeSession.kind).toBe('skeletonRotate');
    actor.stop();
  });

  it('MOVE_GESTURE updates skeleton session payload', () => {
    const actor = startMachine();
    actor.send({ type: 'START_SKELETON_BONE', payload: { boneId: 'b1' } });
    actor.send({ type: 'MOVE_GESTURE', payload: { clientX: 50, clientY: 60 } });
    expect(actor.getSnapshot().context.activeSession.payload.clientX).toBe(50);
    actor.stop();
  });

  it('editingRig → idle on CANCEL_GESTURE clears session', () => {
    const actor = startMachine();
    actor.send({ type: 'START_SKELETON_ROTATE', payload: { nodeId: 'n1' } });
    actor.send({ type: 'CANCEL_GESTURE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.activeSession).toBeNull();
    actor.stop();
  });

  it('editingRig → idle on POINTER_UP clears session', () => {
    const actor = startMachine();
    actor.send({ type: 'START_SKELETON_JOINT', payload: { nodeId: 'j1' } });
    actor.send({ type: 'POINTER_UP' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.activeSession).toBeNull();
    actor.stop();
  });
});
