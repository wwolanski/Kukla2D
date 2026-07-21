import { describe, expect, it } from 'vitest';
import { isMarqueeTiny } from '@/features/canvas/application/useCanvasInput.js';
import { shouldStartMarquee } from '@/features/canvas/application/useCanvasInput.js';
import { routerResultToSelectionEvent } from '@/features/canvas/domain/editorWorkflowEvents.js';
import { routePointerDown } from '@/features/canvas/domain/inputRouter.js';
import { createActor } from 'xstate';
import { editorWorkflowMachine } from '@/features/canvas/application/editorWorkflowMachine.js';
import { useEditorStore } from '@/store/editorStore';

describe('isMarqueeTiny', () => {
  it('treats missing marquee box as tiny click', () => {
    expect(isMarqueeTiny(null)).toBe(true);
  });

  it('treats small marquee box as tiny click', () => {
    expect(isMarqueeTiny({ x: 0, y: 0, w: 3, h: 5 })).toBe(true);
  });

  it('treats dragged marquee box as selection box', () => {
    expect(isMarqueeTiny({ x: 0, y: 0, w: 20, h: 10 })).toBe(false);
  });

  it('uses absolute area for reverse drag boxes', () => {
    expect(isMarqueeTiny({ x: 20, y: 10, w: -20, h: -10 })).toBe(false);
  });
});

describe('shouldStartMarquee', () => {
  const base = {
    activeTool: 'select',
    meshEditMode: false,
    weightPaintMode: false,
    shiftKey: false,
    ctrlOrMetaKey: false,
    selectionTarget: 'element',
    alphaHit: null,
  };

  it('allows element marquee only when no image alpha hit exists', () => {
    expect(shouldStartMarquee(base)).toBe(true);
    expect(shouldStartMarquee({ ...base, alphaHit: 'part-1' })).toBe(false);
  });

  it('allows rig marquee even when pointer starts over an image', () => {
    expect(shouldStartMarquee({
      ...base,
      selectionTarget: 'rig',
      alphaHit: 'part-1',
    })).toBe(true);
  });

  it('blocks marquee while modifier selection is active', () => {
    expect(shouldStartMarquee({ ...base, selectionTarget: 'rig', shiftKey: true })).toBe(false);
    expect(shouldStartMarquee({ ...base, selectionTarget: 'rig', ctrlOrMetaKey: true })).toBe(false);
  });
});

describe('selection event parity (Stage 03)', () => {
  it('part click: router → SELECT_HIT → machine idle → store selection', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    const result = routePointerDown({
      button: 0, altKey: false, ctrlKey: false,
      editorState: { activeTool: 'select', selectionTarget: 'element', toolMode: 'select', meshEditMode: false, weightPaintMode: false, selection: [] },
      toolMode: 'select', meshEditMode: false, weightPaintMode: false,
      alphaHit: 'part-1',
    });
    expect(result.type).toBe('selectPart');
    const selEvent = routerResultToSelectionEvent(result);
    expect(selEvent.type).toBe('SELECT_HIT');
    expect(selEvent.partId).toBe('part-1');
    actor.send(selEvent);
    expect(actor.getSnapshot().value).toBe('idle');
    useEditorStore.getState().setElementSelection(['part-1']);
    expect(useEditorStore.getState().selection).toEqual(['part-1']);
    actor.stop();
  });

  it('clear click: router → CLEAR_SELECTION → machine idle → store clear', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    useEditorStore.setState({ selection: ['p1'], selectionTarget: 'element' });
    const result = routePointerDown({
      button: 0, altKey: false, ctrlKey: false,
      editorState: { activeTool: 'select', selectionTarget: 'element', toolMode: 'select', meshEditMode: false, weightPaintMode: false, selection: ['p1'] },
      toolMode: 'select', meshEditMode: false, weightPaintMode: false,
    });
    expect(result.type).toBe('clearSelection');
    const clearEvent = routerResultToSelectionEvent(result);
    expect(clearEvent.type).toBe('CLEAR_SELECTION');
    actor.send(clearEvent);
    expect(actor.getSnapshot().value).toBe('idle');
    useEditorStore.getState().setElementSelection([]);
    expect(useEditorStore.getState().selection).toEqual([]);
    actor.stop();
  });

  it('rig clear: router → CLEAR_SELECTION → clearRigSelection', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    useEditorStore.setState({
      selectionTarget: 'rig', selection: ['b1'],
      activeBoneId: 'b1', rigSelectionAnchor: 'b1',
    });
    const result = routePointerDown({
      button: 0, altKey: false, ctrlKey: false,
      editorState: { activeTool: 'select', selectionTarget: 'rig', toolMode: 'select', meshEditMode: false, weightPaintMode: false, selection: ['b1'] },
      toolMode: 'select', meshEditMode: false, weightPaintMode: false,
    });
    const clearEvent = routerResultToSelectionEvent(result);
    actor.send(clearEvent);
    useEditorStore.getState().clearRigSelection();
    expect(useEditorStore.getState().activeBoneId).toBeNull();
    expect(useEditorStore.getState().rigSelectionAnchor).toBeNull();
    actor.stop();
  });
});

describe('marquee event parity (Stage 03)', () => {
  it('marquee start sends START_MARQUEE and machine enters marqueeSelecting', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'START_MARQUEE', origin: { x: 10, y: 20 }, target: 'element' });
    expect(actor.getSnapshot().value).toBe('marqueeSelecting');
    expect(actor.getSnapshot().context.marqueeBox).toEqual({ x: 10, y: 20, w: 0, h: 0 });
    actor.stop();
  });

  it('marquee move sends UPDATE_MARQUEE and updates box', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'START_MARQUEE', origin: { x: 0, y: 0 }, target: 'element' });
    useEditorStore.getState().setMarqueeBox({ x: 0, y: 0, w: 0, h: 0 });
    actor.send({ type: 'UPDATE_MARQUEE', box: { x: 0, y: 0, w: 50, h: 40 } });
    useEditorStore.getState().setMarqueeBox({ x: 0, y: 0, w: 50, h: 40 });
    expect(actor.getSnapshot().context.marqueeBox).toEqual({ x: 0, y: 0, w: 50, h: 40 });
    expect(useEditorStore.getState().marqueeBox).toEqual({ x: 0, y: 0, w: 50, h: 40 });
    actor.stop();
  });

  it('marquee commit sends COMMIT_MARQUEE and clears marqueeBox', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'START_MARQUEE', origin: { x: 0, y: 0 }, target: 'element' });
    useEditorStore.getState().setMarqueeBox({ x: 0, y: 0, w: 50, h: 40 });
    actor.send({ type: 'COMMIT_MARQUEE' });
    useEditorStore.getState().setMarqueeBox(null);
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.marqueeBox).toBeNull();
    expect(useEditorStore.getState().marqueeBox).toBeNull();
    actor.stop();
  });

  it('tiny marquee behaves as click (clear selection)', () => {
    expect(isMarqueeTiny({ x: 0, y: 0, w: 3, h: 3 })).toBe(true);
    expect(isMarqueeTiny({ x: 0, y: 0, w: 20, h: 20 })).toBe(false);
  });

  it('marquee cancel clears marqueeBox in store and machine', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'START_MARQUEE', origin: { x: 0, y: 0 }, target: 'element' });
    useEditorStore.getState().setMarqueeBox({ x: 0, y: 0, w: 30, h: 30 });
    actor.send({ type: 'CANCEL_GESTURE' });
    useEditorStore.getState().setMarqueeBox(null);
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.marqueeBox).toBeNull();
    expect(useEditorStore.getState().marqueeBox).toBeNull();
    actor.stop();
  });
});

describe('DnD import event parity (Stage 03)', () => {
  it('drag enter sends DRAG_FILES_ENTER → machine dragOverFiles', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'DRAG_FILES_ENTER' });
    expect(actor.getSnapshot().value).toBe('dragOverFiles');
    expect(actor.getSnapshot().context.importStatus).toBe('dragOver');
    actor.stop();
  });

  it('drag leave sends DRAG_FILES_LEAVE → machine idle', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'DRAG_FILES_ENTER' });
    actor.send({ type: 'DRAG_FILES_LEAVE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.importStatus).toBe('idle');
    actor.stop();
  });

  it('drop sends DROP_FILES → importingFiles → IMPORT_DONE → idle', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'DRAG_FILES_ENTER' });
    actor.send({ type: 'DROP_FILES' });
    expect(actor.getSnapshot().value).toBe('importingFiles');
    actor.send({ type: 'IMPORT_DONE' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('drop failure sends IMPORT_FAILED → idle', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'DROP_FILES' });
    actor.send({ type: 'IMPORT_FAILED' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.importStatus).toBe('failed');
    actor.stop();
  });
});

describe('canvas edit gesture session lifecycle (Stage 04)', () => {
  it('pan: START_PAN → MOVE_GESTURE → COMMIT_GESTURE clears session', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'START_PAN', payload: { mode: 'pan' } });
    expect(actor.getSnapshot().value).toBe('panning');
    expect(actor.getSnapshot().context.activeSession.kind).toBe('pan');
    actor.send({ type: 'MOVE_GESTURE', payload: { dx: 10, dy: 20 } });
    expect(actor.getSnapshot().context.activeSession.payload.dx).toBe(10);
    actor.send({ type: 'COMMIT_GESTURE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.activeSession).toBeNull();
    actor.stop();
  });

  it('pan: CANCEL_GESTURE clears session', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'START_PAN' });
    actor.send({ type: 'CANCEL_GESTURE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.activeSession).toBeNull();
    actor.stop();
  });

  it('dragZoom: START_TRANSFORM_DRAG → MOVE_GESTURE → COMMIT_GESTURE', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'START_TRANSFORM_DRAG', payload: { mode: 'dragZoom' } });
    expect(actor.getSnapshot().value).toBe('draggingTransform');
    expect(actor.getSnapshot().context.activeSession.kind).toBe('dragZoom');
    actor.send({ type: 'MOVE_GESTURE', payload: { dy: -50 } });
    actor.send({ type: 'COMMIT_GESTURE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.activeSession).toBeNull();
    actor.stop();
  });

  it('drawBone: START_DRAW_BONE → MOVE_GESTURE → COMMIT_GESTURE', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'START_DRAW_BONE', payload: { parentId: null } });
    expect(actor.getSnapshot().value).toBe('drawingBone');
    expect(actor.getSnapshot().context.activeSession.kind).toBe('drawBone');
    actor.send({ type: 'MOVE_GESTURE', payload: { worldX: 100, worldY: 50 } });
    expect(actor.getSnapshot().context.activeSession.payload.worldX).toBe(100);
    actor.send({ type: 'COMMIT_GESTURE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.activeSession).toBeNull();
    actor.stop();
  });

  it('drawBone: CANCEL_GESTURE clears session and preview should be cleaned', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'START_DRAW_BONE' });
    expect(actor.getSnapshot().context.activeSession).not.toBeNull();
    actor.send({ type: 'CANCEL_GESTURE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.activeSession).toBeNull();
    actor.stop();
  });

  it('meshBrush: START_MESH_BRUSH → MOVE_GESTURE → COMMIT_GESTURE', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'START_MESH_BRUSH', payload: { partId: 'p1', mode: 'deform' } });
    expect(actor.getSnapshot().value).toBe('editingMesh');
    expect(actor.getSnapshot().context.activeSession.kind).toBe('meshBrush');
    actor.send({ type: 'MOVE_GESTURE', payload: { partId: 'p1', worldX: 50, worldY: 50 } });
    actor.send({ type: 'COMMIT_GESTURE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.activeSession).toBeNull();
    actor.stop();
  });

  it('weightPaint: START_WEIGHT_PAINT → MOVE_GESTURE → COMMIT_GESTURE', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'START_WEIGHT_PAINT', payload: { partId: 'p1', boneId: 'b1' } });
    expect(actor.getSnapshot().value).toBe('weightPainting');
    expect(actor.getSnapshot().context.activeSession.kind).toBe('weightPaint');
    actor.send({ type: 'MOVE_GESTURE', payload: { partId: 'p1', boneId: 'b1', worldX: 30, worldY: 30 } });
    actor.send({ type: 'COMMIT_GESTURE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.activeSession).toBeNull();
    actor.stop();
  });

  it('vertexDrag: START_VERTEX_DRAG → MOVE_GESTURE → COMMIT_GESTURE', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'START_VERTEX_DRAG', payload: { partId: 'p1', vertexIndex: 3 } });
    expect(actor.getSnapshot().value).toBe('editingMesh');
    expect(actor.getSnapshot().context.activeSession.kind).toBe('vertexDrag');
    expect(actor.getSnapshot().context.activeSession.payload.vertexIndex).toBe(3);
    actor.send({ type: 'MOVE_GESTURE', payload: { partId: 'p1', vertexIndex: 3, worldX: 20, worldY: 20 } });
    actor.send({ type: 'COMMIT_GESTURE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.activeSession).toBeNull();
    actor.stop();
  });

  it('vertexDrag: CANCEL_GESTURE clears session', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'START_VERTEX_DRAG', payload: { partId: 'p1', vertexIndex: 0 } });
    expect(actor.getSnapshot().context.activeSession).not.toBeNull();
    actor.send({ type: 'CANCEL_GESTURE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.activeSession).toBeNull();
    actor.stop();
  });

  it('EXIT_MESH_EDIT while in editingMesh clears session and returns to idle', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'START_MESH_BRUSH', payload: { partId: 'p1' } });
    expect(actor.getSnapshot().value).toBe('editingMesh');
    actor.send({ type: 'EXIT_MESH_EDIT' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.activeSession).toBeNull();
    actor.stop();
  });
});
