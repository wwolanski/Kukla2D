/**
 * Workflow integration tests — pure logic that ties together
 * the editor workflow machine, the input router bridge, and the
 * patch history gesture boundary (beginBatch / endBatch).
 *
 * No React, no DOM, no Pixi: these tests exercise the same
 * sequence of events the DOM and Pixi adapters emit, so a
 * regression in any layer fails fast.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createActor } from 'xstate';
import { editorWorkflowMachine } from '@/features/canvas/application/editorWorkflowMachine.js';
import { routerResultToMachineEvent, routerResultToSelectionEvent } from '@/features/canvas/domain/editorWorkflowEvents.js';
import { routePointerDown } from '@/features/canvas/domain/inputRouter.js';
import {
  createPointerDownEvent,
  createPointerUpEvent,
  createPointerCancelEvent,
  createDropFilesEvent,
  createDragFilesEnterEvent,
  createDragFilesLeaveEvent,
  createKeyDownEvent,
  createEditorCommand,
} from '@/features/canvas/domain/workflowContracts.js';
import { useProjectStore } from '@/store/projectStore';
import { useEditorStore } from '@/store/editorStore';
import {
  beginBatch,
  endBatch,
  clearHistory,
  undoCount,
  redoCount,
  undo,
  applyPatches,
} from '@/store/undoHistory';

function startMachine() {
  const actor = createActor(editorWorkflowMachine);
  actor.start();
  return actor;
}

function resetProject() {
  useProjectStore.getState().resetProject();
  clearHistory();
}

describe('workflow + bridge integration', () => {
  beforeEach(() => {
    resetProject();
  });

  it('router startPan → machine POINTER_DOWN panning → POINTER_UP idle', () => {
    const actor = startMachine();
    const routerResult = routePointerDown({
      button: 1,
      altKey: false,
      ctrlKey: false,
      editorState: { activeTool: 'select', selectionTarget: 'element', toolMode: 'select', meshEditMode: false, weightPaintMode: false, selection: [] },
      toolMode: 'select',
      meshEditMode: false,
      weightPaintMode: false,
    });
    const event = routerResultToMachineEvent(routerResult);
    expect(event).toEqual({ type: 'POINTER_DOWN', intent: 'pan' });

    actor.send(event);
    expect(actor.getSnapshot().value).toBe('panning');

    actor.send({ type: 'POINTER_UP' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('router startDrawBone → machine drawingBone', () => {
    const actor = startMachine();
    const routerResult = routePointerDown({
      button: 0,
      altKey: false,
      ctrlKey: false,
      editorState: { activeTool: 'drawBone', toolMode: 'draw_bone', selectionTarget: 'element', meshEditMode: false, weightPaintMode: false, selection: [] },
      toolMode: 'draw_bone',
      meshEditMode: false,
      weightPaintMode: false,
    });
    const event = routerResultToMachineEvent(routerResult);
    expect(event.intent).toBe('drawBone');
    actor.send(event);
    expect(actor.getSnapshot().value).toBe('drawingBone');
    actor.send({ type: 'POINTER_UP' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('router startBrushDrag → machine editingMesh', () => {
    const actor = startMachine();
    const routerResult = routePointerDown({
      button: 0,
      altKey: false,
      ctrlKey: false,
      editorState: { activeTool: 'select', selectionTarget: 'element', toolMode: 'deform', meshEditMode: true, weightPaintMode: false, selection: ['p1'] },
      toolMode: 'deform',
      meshEditMode: true,
      weightPaintMode: false,
    });
    const event = routerResultToMachineEvent(routerResult);
    expect(event.intent).toBe('startBrushDrag');
    actor.send(event);
    expect(actor.getSnapshot().value).toBe('editingMesh');
    actor.send({ type: 'POINTER_UP' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('router startWeightPaint → machine weightPainting', () => {
    const actor = startMachine();
    const routerResult = routePointerDown({
      button: 0,
      altKey: false,
      ctrlKey: false,
      editorState: { activeTool: 'select', selectionTarget: 'element', toolMode: 'select', meshEditMode: false, weightPaintMode: true, selection: ['p1'] },
      toolMode: 'select',
      meshEditMode: false,
      weightPaintMode: true,
    });
    const event = routerResultToMachineEvent(routerResult);
    expect(event.intent).toBe('startWeightPaint');
    actor.send(event);
    expect(actor.getSnapshot().value).toBe('weightPainting');
    actor.send({ type: 'POINTER_UP' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('POINTER_UP from idle is a no-op (no machine transition)', () => {
    const actor = startMachine();
    actor.send({ type: 'POINTER_UP' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('CANCEL exits active gesture to idle', () => {
    const actor = startMachine();
    actor.send({ type: 'POINTER_DOWN', intent: 'pan' });
    expect(actor.getSnapshot().value).toBe('panning');
    actor.send({ type: 'CANCEL' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });
});

describe('history gesture boundary (one undo step per gesture)', () => {
  beforeEach(() => {
    resetProject();
  });

  it('multiple updateProject calls inside a batch collapse into one undo entry', () => {
    const store = useProjectStore.getState();
    const project = useProjectStore.getState().project;
    const initialUndoCount = undoCount();

    beginBatch(project);
    store.updateProject((proj) => {
      proj.name = 'A';
    });
    store.updateProject((proj) => {
      proj.name = 'B';
    });
    store.updateProject((proj) => {
      proj.name = 'C';
    });
    endBatch();

    expect(undoCount()).toBe(initialUndoCount + 1);
  });

  it('batched project mutation marks project as unsaved', () => {
    const store = useProjectStore.getState();
    const project = useProjectStore.getState().project;
    useProjectStore.getState().setHasUnsavedChanges(false);

    beginBatch(project);
    store.updateProject((proj) => {
      proj.name = 'dirty-from-gesture';
    });
    endBatch();

    expect(useProjectStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('endBatch with no patches is a no-op for undo count', () => {
    const project = useProjectStore.getState().project;
    const before = undoCount();
    beginBatch(project);
    endBatch();
    expect(undoCount()).toBe(before);
  });

  it('after a batched gesture, undo restores the pre-gesture state', () => {
    const store = useProjectStore.getState();
    const project = useProjectStore.getState().project;
    const originalName = project.name;

    beginBatch(project);
    store.updateProject((proj) => {
      proj.name = 'gesture-final';
    });
    endBatch();

    expect(useProjectStore.getState().project.name).toBe('gesture-final');

    undo((inversePatches) => {
      const fullState = useProjectStore.getState();
      const restored = applyPatches(fullState, inversePatches);
      useProjectStore.getState().restoreProject(restored);
    });
    expect(useProjectStore.getState().project.name).toBe(originalName);
  });

  it('batched gesture followed by new edit clears redo stack', () => {
    const store = useProjectStore.getState();
    const project = useProjectStore.getState().project;

    beginBatch(project);
    store.updateProject((proj) => { proj.name = 'first'; });
    endBatch();
    expect(undoCount()).toBeGreaterThan(0);

    undo((inversePatches) => {
      const fullState = useProjectStore.getState();
      const restored = applyPatches(fullState, inversePatches);
      useProjectStore.getState().restoreProject(restored);
    });
    expect(redoCount()).toBeGreaterThan(0);

    beginBatch(project);
    store.updateProject((proj) => { proj.name = 'second'; });
    endBatch();
    expect(redoCount()).toBe(0);
  });
});

describe('event → machine → command bridge', () => {
  it('router selectPart → SELECT_HIT event accepted by machine', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    const routerResult = routePointerDown({
      button: 0,
      altKey: false,
      ctrlKey: false,
      editorState: { activeTool: 'select', selectionTarget: 'element', toolMode: 'select', meshEditMode: false, weightPaintMode: false, selection: [] },
      toolMode: 'select',
      meshEditMode: false,
      weightPaintMode: false,
      alphaHit: 'part1',
    });
    const selectionEvent = routerResultToSelectionEvent(routerResult);
    expect(selectionEvent).toEqual({ type: 'SELECT_HIT', partId: 'part1' });
    actor.send(selectionEvent);
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('router clearSelection → CLEAR_SELECTION event accepted by machine', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    const routerResult = routePointerDown({
      button: 0,
      altKey: false,
      ctrlKey: false,
      editorState: { activeTool: 'select', selectionTarget: 'element', toolMode: 'select', meshEditMode: false, weightPaintMode: false, selection: [] },
      toolMode: 'select',
      meshEditMode: false,
      weightPaintMode: false,
    });
    const selectionEvent = routerResultToSelectionEvent(routerResult);
    expect(selectionEvent).toEqual({ type: 'CLEAR_SELECTION' });
    actor.send(selectionEvent);
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('router startPan → command event START_PAN → machine panning', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    const routerResult = routePointerDown({
      button: 1,
      altKey: false,
      ctrlKey: false,
      editorState: { activeTool: 'select', selectionTarget: 'element', toolMode: 'select', meshEditMode: false, weightPaintMode: false, selection: [] },
      toolMode: 'select',
      meshEditMode: false,
      weightPaintMode: false,
    });
    const commandEvent = routerResultToMachineEvent(routerResult);
    expect(commandEvent).toEqual({ type: 'POINTER_DOWN', intent: 'pan' });
    actor.send(commandEvent);
    expect(actor.getSnapshot().value).toBe('panning');
    actor.send({ type: 'POINTER_UP' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('DnD workflow: DRAG_FILES_ENTER → DROP_FILES → IMPORT_DONE', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'DRAG_FILES_ENTER' });
    expect(actor.getSnapshot().value).toBe('dragOverFiles');
    actor.send({ type: 'DROP_FILES' });
    expect(actor.getSnapshot().value).toBe('importingFiles');
    actor.send({ type: 'IMPORT_DONE' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('marquee workflow: START_MARQUEE → UPDATE_MARQUEE → COMMIT_MARQUEE', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'START_MARQUEE', origin: { x: 10, y: 20 } });
    expect(actor.getSnapshot().value).toBe('marqueeSelecting');
    actor.send({ type: 'UPDATE_MARQUEE', box: { x: 10, y: 20, w: 100, h: 80 } });
    expect(actor.getSnapshot().context.marqueeBox).toEqual({ x: 10, y: 20, w: 100, h: 80 });
    actor.send({ type: 'COMMIT_MARQUEE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.marqueeBox).toBeNull();
    actor.stop();
  });
});

describe('workflowContracts helpers', () => {
  it('createPointerDownEvent produces correct shape', () => {
    const event = createPointerDownEvent(
      { x: 10, y: 20 },
      { x: 100, y: 200 },
      { x: 50, y: 60 },
      { shiftKey: true },
      0,
      { kind: 'part', id: 'p1' },
    );
    expect(event.type).toBe('pointerDown');
    expect(event.pointer).toEqual({ x: 10, y: 20 });
    expect(event.world).toEqual({ x: 100, y: 200 });
    expect(event.screen).toEqual({ x: 50, y: 60 });
    expect(event.modifiers.shiftKey).toBe(true);
    expect(event.modifiers.altKey).toBe(false);
    expect(event.button).toBe(0);
    expect(event.target).toEqual({ kind: 'part', id: 'p1' });
  });

  it('createPointerUpEvent produces correct shape', () => {
    const event = createPointerUpEvent({ x: 1, y: 2 });
    expect(event.type).toBe('pointerUp');
    expect(event.pointer).toEqual({ x: 1, y: 2 });
    expect(event.button).toBe(0);
  });

  it('createPointerCancelEvent produces correct shape', () => {
    const event = createPointerCancelEvent();
    expect(event.type).toBe('pointerCancel');
    expect(event.pointer).toBeNull();
  });

  it('createDropFilesEvent includes files', () => {
    const files = [{ name: 'test.png' }];
    const event = createDropFilesEvent(files, { x: 5, y: 5 });
    expect(event.type).toBe('dropFiles');
    expect(event.files).toBe(files);
    expect(event.pointer).toEqual({ x: 5, y: 5 });
  });

  it('createDragFilesEnterEvent includes files', () => {
    const files = [{ name: 'a.psd' }];
    const event = createDragFilesEnterEvent(files);
    expect(event.type).toBe('dragFilesEnter');
    expect(event.files).toBe(files);
  });

  it('createDragFilesLeaveEvent has no files', () => {
    const event = createDragFilesLeaveEvent();
    expect(event.type).toBe('dragFilesLeave');
    expect(event.files).toBeUndefined();
  });

  it('createKeyDownEvent includes key', () => {
    const event = createKeyDownEvent('Escape', { ctrlKey: true });
    expect(event.type).toBe('keyDown');
    expect(event.key).toBe('Escape');
    expect(event.modifiers.ctrlKey).toBe(true);
  });

  it('createEditorCommand produces correct shape', () => {
    const cmd = createEditorCommand('setSelection', { ids: ['p1'] });
    expect(cmd.type).toBe('setSelection');
    expect(cmd.payload).toEqual({ ids: ['p1'] });
  });

  it('contracts module does not import React, Zustand, or DOM', async () => {
    const mod = await import('@/features/canvas/domain/workflowContracts.js');
    const src = Object.values(mod).join('');
    expect(src).not.toContain('useEditorStore');
    expect(src).not.toContain('useProjectStore');
    expect(src).not.toContain('document');
    expect(src).not.toContain('window');
  });
});

describe('tool/mode single-owner integration', () => {
  it('SET_TOOL updates complete XState mode without Zustand mirror', () => {
    const actor = startMachine();
    actor.send({ type: 'SET_TOOL', tool: 'drawBone' });
    expect(actor.getSnapshot().context).toMatchObject({
      activeTool: 'drawBone',
      selectionTarget: 'rig',
      riggingMode: 'bones',
      riggingTool: 'draw',
    });
    expect(useEditorStore.getState()).not.toHaveProperty('activeTool');
    actor.stop();
  });

  it('SET_SELECTION_TARGET is owned only by machine', () => {
    const actor = startMachine();
    actor.send({ type: 'SET_SELECTION_TARGET', target: 'rig' });
    expect(actor.getSnapshot().context).toMatchObject({
      selectionTarget: 'rig',
      riggingMode: 'bones',
    });
    expect(useEditorStore.getState()).not.toHaveProperty('selectionTarget');
    actor.stop();
  });

  it('mesh edit is owned only by machine', () => {
    const actor = startMachine();
    actor.send({ type: 'ENTER_MESH_EDIT' });
    expect(actor.getSnapshot().context).toMatchObject({
      activeTool: 'meshEdit',
      meshEditMode: true,
    });
    expect(useEditorStore.getState()).not.toHaveProperty('meshEditMode');
    actor.stop();
  });

  it('machine context excludes document and selection payload', () => {
    const actor = startMachine();
    actor.send({ type: 'SET_TOOL', tool: 'weightPaint' });
    const ctx = actor.getSnapshot().context;
    expect(ctx.activeTool).toBe('weightPaint');
    expect(ctx.selection).toBeUndefined();
    expect(ctx.project).toBeUndefined();
    actor.stop();
  });
});

describe('selection workflow events (Stage 03)', () => {
  it('SELECT_HIT for part click keeps machine in idle', () => {
    const actor = startMachine();
    actor.send({ type: 'SELECT_HIT', partId: 'part1' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('SELECT_HIT for rig click keeps machine in idle', () => {
    const actor = startMachine();
    actor.send({ type: 'SELECT_HIT', partId: 'bone1' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('CLEAR_SELECTION keeps machine in idle', () => {
    const actor = startMachine();
    actor.send({ type: 'CLEAR_SELECTION' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('router selectPart → SELECT_HIT → store setElementSelection', () => {
    const actor = startMachine();
    const routerResult = routePointerDown({
      button: 0, altKey: false, ctrlKey: false,
      editorState: { activeTool: 'select', selectionTarget: 'element', toolMode: 'select', meshEditMode: false, weightPaintMode: false, selection: [] },
      toolMode: 'select', meshEditMode: false, weightPaintMode: false,
      alphaHit: 'part1',
    });
    const selEvent = routerResultToSelectionEvent(routerResult);
    expect(selEvent).toEqual({ type: 'SELECT_HIT', partId: 'part1' });
    actor.send(selEvent);
    useEditorStore.getState().setElementSelection(['part1']);
    expect(useEditorStore.getState().selection).toEqual(['part1']);
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('router clearSelection → CLEAR_SELECTION → store clear based on target', () => {
    const actor = startMachine();
    useEditorStore.setState({ selectionTarget: 'rig', selection: ['b1'], activeBoneId: 'b1' });
    const routerResult = routePointerDown({
      button: 0, altKey: false, ctrlKey: false,
      editorState: { activeTool: 'select', selectionTarget: 'rig', toolMode: 'select', meshEditMode: false, weightPaintMode: false, selection: ['b1'] },
      toolMode: 'select', meshEditMode: false, weightPaintMode: false,
    });
    const clearEvent = routerResultToSelectionEvent(routerResult);
    expect(clearEvent).toEqual({ type: 'CLEAR_SELECTION' });
    actor.send(clearEvent);
    useEditorStore.getState().clearRigSelection();
    expect(useEditorStore.getState().activeBoneId).toBeNull();
    actor.stop();
  });

  it('router clearSelection with element target → setElementSelection([])', () => {
    const actor = startMachine();
    useEditorStore.setState({ selectionTarget: 'element', selection: ['p1'] });
    const routerResult = routePointerDown({
      button: 0, altKey: false, ctrlKey: false,
      editorState: { activeTool: 'select', selectionTarget: 'element', toolMode: 'select', meshEditMode: false, weightPaintMode: false, selection: ['p1'] },
      toolMode: 'select', meshEditMode: false, weightPaintMode: false,
    });
    const clearEvent = routerResultToSelectionEvent(routerResult);
    actor.send(clearEvent);
    useEditorStore.getState().setElementSelection([]);
    expect(useEditorStore.getState().selection).toEqual([]);
    actor.stop();
  });
});

describe('marquee workflow events (Stage 03)', () => {
  it('START_MARQUEE → marqueeSelecting with session and marqueeBox', () => {
    const actor = startMachine();
    actor.send({ type: 'START_MARQUEE', origin: { x: 10, y: 20 }, target: 'element' });
    const snap = actor.getSnapshot();
    expect(snap.value).toBe('marqueeSelecting');
    expect(snap.context.activeSession).not.toBeNull();
    expect(snap.context.activeSession.kind).toBe('marquee');
    expect(snap.context.marqueeBox).toEqual({ x: 10, y: 20, w: 0, h: 0 });
    actor.stop();
  });

  it('UPDATE_MARQUEE updates marqueeBox in context', () => {
    const actor = startMachine();
    actor.send({ type: 'START_MARQUEE', origin: { x: 0, y: 0 }, target: 'element' });
    actor.send({ type: 'UPDATE_MARQUEE', box: { x: 0, y: 0, w: 100, h: 80 } });
    expect(actor.getSnapshot().context.marqueeBox).toEqual({ x: 0, y: 0, w: 100, h: 80 });
    actor.stop();
  });

  it('COMMIT_MARQUEE returns to idle and clears marqueeBox', () => {
    const actor = startMachine();
    actor.send({ type: 'START_MARQUEE', origin: { x: 0, y: 0 }, target: 'element' });
    actor.send({ type: 'UPDATE_MARQUEE', box: { x: 0, y: 0, w: 50, h: 50 } });
    actor.send({ type: 'COMMIT_MARQUEE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.marqueeBox).toBeNull();
    expect(actor.getSnapshot().context.activeSession).toBeNull();
    actor.stop();
  });

  it('CANCEL_GESTURE from marqueeSelecting returns to idle and clears', () => {
    const actor = startMachine();
    actor.send({ type: 'START_MARQUEE', origin: { x: 0, y: 0 }, target: 'rig' });
    actor.send({ type: 'CANCEL_GESTURE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.marqueeBox).toBeNull();
    actor.stop();
  });

  it('marquee with rig target stores target in session payload', () => {
    const actor = startMachine();
    actor.send({ type: 'START_MARQUEE', origin: { x: 5, y: 5 }, target: 'rig', modifiers: { shiftKey: false } });
    expect(actor.getSnapshot().context.activeSession.payload.target).toBe('rig');
    actor.stop();
  });

  it('full marquee lifecycle: start → update → update → commit', () => {
    const actor = startMachine();
    actor.send({ type: 'START_MARQUEE', origin: { x: 10, y: 10 }, target: 'element' });
    actor.send({ type: 'UPDATE_MARQUEE', box: { x: 10, y: 10, w: 20, h: 20 } });
    actor.send({ type: 'UPDATE_MARQUEE', box: { x: 10, y: 10, w: 50, h: 40 } });
    actor.send({ type: 'COMMIT_MARQUEE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.marqueeBox).toBeNull();
    actor.stop();
  });
});

describe('DnD import workflow events (Stage 03)', () => {
  it('DRAG_FILES_ENTER → dragOverFiles with importStatus dragOver', () => {
    const actor = startMachine();
    actor.send({ type: 'DRAG_FILES_ENTER' });
    expect(actor.getSnapshot().value).toBe('dragOverFiles');
    expect(actor.getSnapshot().context.importStatus).toBe('dragOver');
    actor.stop();
  });

  it('DRAG_FILES_LEAVE from dragOverFiles → idle with importStatus idle', () => {
    const actor = startMachine();
    actor.send({ type: 'DRAG_FILES_ENTER' });
    actor.send({ type: 'DRAG_FILES_LEAVE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.importStatus).toBe('idle');
    actor.stop();
  });

  it('DROP_FILES from dragOverFiles → importingFiles with importStatus importing', () => {
    const actor = startMachine();
    actor.send({ type: 'DRAG_FILES_ENTER' });
    actor.send({ type: 'DROP_FILES' });
    expect(actor.getSnapshot().value).toBe('importingFiles');
    expect(actor.getSnapshot().context.importStatus).toBe('importing');
    actor.stop();
  });

  it('DROP_FILES from idle → importingFiles (direct drop without drag enter)', () => {
    const actor = startMachine();
    actor.send({ type: 'DROP_FILES' });
    expect(actor.getSnapshot().value).toBe('importingFiles');
    expect(actor.getSnapshot().context.importStatus).toBe('importing');
    actor.stop();
  });

  it('IMPORT_DONE from importingFiles → idle with importStatus done', () => {
    const actor = startMachine();
    actor.send({ type: 'DROP_FILES' });
    actor.send({ type: 'IMPORT_DONE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.importStatus).toBe('done');
    actor.stop();
  });

  it('IMPORT_FAILED from importingFiles → idle with importStatus failed', () => {
    const actor = startMachine();
    actor.send({ type: 'DROP_FILES' });
    actor.send({ type: 'IMPORT_FAILED' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.importStatus).toBe('failed');
    actor.stop();
  });

  it('CANCEL_GESTURE from dragOverFiles → idle with importStatus idle', () => {
    const actor = startMachine();
    actor.send({ type: 'DRAG_FILES_ENTER' });
    actor.send({ type: 'CANCEL_GESTURE' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.importStatus).toBe('idle');
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

  it('full DnD lifecycle: enter → drop → done', () => {
    const actor = startMachine();
    actor.send({ type: 'DRAG_FILES_ENTER' });
    expect(actor.getSnapshot().value).toBe('dragOverFiles');
    actor.send({ type: 'DROP_FILES' });
    expect(actor.getSnapshot().value).toBe('importingFiles');
    actor.send({ type: 'IMPORT_DONE' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('DnD with leave before drop: enter → leave → enter → drop → done', () => {
    const actor = startMachine();
    actor.send({ type: 'DRAG_FILES_ENTER' });
    expect(actor.getSnapshot().value).toBe('dragOverFiles');
    actor.send({ type: 'DRAG_FILES_LEAVE' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.send({ type: 'DRAG_FILES_ENTER' });
    expect(actor.getSnapshot().value).toBe('dragOverFiles');
    actor.send({ type: 'DROP_FILES' });
    actor.send({ type: 'IMPORT_DONE' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });
});

describe('overlay gesture workflow integration', () => {
  function startMachine() {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    return actor;
  }

  describe('gizmo overlay sessions', () => {
    it('gizmo move: start → move → commit lifecycle', () => {
      const actor = startMachine();
      actor.send({ type: 'START_GIZMO_MOVE', payload: { nodeId: 'n1', startX: 10, startY: 20, isAnimMode: false } });
      expect(actor.getSnapshot().value).toBe('editingGizmo');
      expect(actor.getSnapshot().context.activeSession.kind).toBe('gizmoMove');
      actor.send({ type: 'MOVE_GESTURE', payload: { clientX: 100, clientY: 200 } });
      expect(actor.getSnapshot().context.activeSession.payload.clientX).toBe(100);
      actor.send({ type: 'COMMIT_GESTURE' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.activeSession).toBeNull();
      actor.stop();
    });

    it('gizmo rotate: start → move → cancel lifecycle', () => {
      const actor = startMachine();
      actor.send({ type: 'START_GIZMO_ROTATE', payload: { nodeId: 'n1', startAngle: 0, startRotation: 45 } });
      expect(actor.getSnapshot().value).toBe('editingGizmo');
      expect(actor.getSnapshot().context.activeSession.kind).toBe('gizmoRotate');
      actor.send({ type: 'MOVE_GESTURE', payload: { clientX: 50, clientY: 50, shiftKey: true } });
      actor.send({ type: 'CANCEL_GESTURE' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.activeSession).toBeNull();
      actor.stop();
    });

    it('gizmo pivot: start → commit lifecycle', () => {
      const actor = startMachine();
      actor.send({ type: 'START_GIZMO_PIVOT', payload: { nodeId: 'n1', startPivotX: 5, startPivotY: 5 } });
      expect(actor.getSnapshot().value).toBe('editingGizmo');
      expect(actor.getSnapshot().context.activeSession.kind).toBe('gizmoPivot');
      actor.send({ type: 'COMMIT_GESTURE' });
      expect(actor.getSnapshot().value).toBe('idle');
      actor.stop();
    });

    it('gizmo session does not contain DOM refs or store state', () => {
      const actor = startMachine();
      actor.send({ type: 'START_GIZMO_MOVE', payload: { nodeId: 'n1', startX: 0, startY: 0 } });
      const session = actor.getSnapshot().context.activeSession;
      expect(session.payload.svgRef).toBeUndefined();
      expect(session.payload.viewRef).toBeUndefined();
      expect(session.payload.editorModeRef).toBeUndefined();
      actor.stop();
    });
  });

  describe('skeleton overlay sessions', () => {
    it('skeleton joint: start → move → commit lifecycle', () => {
      const actor = startMachine();
      actor.send({ type: 'START_SKELETON_JOINT', payload: { nodeId: 'j1' } });
      expect(actor.getSnapshot().value).toBe('editingRig');
      expect(actor.getSnapshot().context.activeSession.kind).toBe('skeletonJoint');
      actor.send({ type: 'MOVE_GESTURE', payload: { clientX: 100, clientY: 200 } });
      actor.send({ type: 'COMMIT_GESTURE' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.activeSession).toBeNull();
      actor.stop();
    });

    it('skeleton bone: start → move → commit lifecycle', () => {
      const actor = startMachine();
      actor.send({ type: 'START_SKELETON_BONE', payload: { boneId: 'b1', startWorldX: 10, startWorldY: 20 } });
      expect(actor.getSnapshot().value).toBe('editingRig');
      expect(actor.getSnapshot().context.activeSession.kind).toBe('skeletonBone');
      actor.send({ type: 'MOVE_GESTURE', payload: { clientX: 50, clientY: 60 } });
      actor.send({ type: 'COMMIT_GESTURE' });
      expect(actor.getSnapshot().value).toBe('idle');
      actor.stop();
    });

    it('skeleton trackpad: start → move → cancel lifecycle', () => {
      const actor = startMachine();
      actor.send({ type: 'START_SKELETON_TRACKPAD', payload: { nodeId: 'n1', tpX: 50, tpY: 50 } });
      expect(actor.getSnapshot().value).toBe('editingRig');
      expect(actor.getSnapshot().context.activeSession.kind).toBe('skeletonTrackpad');
      actor.send({ type: 'MOVE_GESTURE', payload: { clientX: 60, clientY: 70 } });
      actor.send({ type: 'CANCEL_GESTURE' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.activeSession).toBeNull();
      actor.stop();
    });

    it('skeleton rotate: start → move → commit lifecycle', () => {
      const actor = startMachine();
      actor.send({ type: 'START_SKELETON_ROTATE', payload: { nodeId: 'n1', startAngle: 0, startRotation: 0 } });
      expect(actor.getSnapshot().value).toBe('editingRig');
      expect(actor.getSnapshot().context.activeSession.kind).toBe('skeletonRotate');
      actor.send({ type: 'MOVE_GESTURE', payload: { clientX: 100, clientY: 100, shiftKey: false } });
      actor.send({ type: 'COMMIT_GESTURE' });
      expect(actor.getSnapshot().value).toBe('idle');
      actor.stop();
    });

    it('skeleton session does not contain DOM refs or store state', () => {
      const actor = startMachine();
      actor.send({ type: 'START_SKELETON_BONE', payload: { boneId: 'b1' } });
      const session = actor.getSnapshot().context.activeSession;
      expect(session.payload.svgRef).toBeUndefined();
      expect(session.payload.viewRef).toBeUndefined();
      expect(session.payload.effectiveNodes).toBeUndefined();
      actor.stop();
    });

    it('editingRig supports EXIT_RIG from gesture session back to idle', () => {
      const actor = startMachine();
      actor.send({ type: 'START_SKELETON_JOINT', payload: { nodeId: 'j1' } });
      expect(actor.getSnapshot().value).toBe('editingRig');
      actor.send({ type: 'EXIT_RIG' });
      expect(actor.getSnapshot().value).toBe('idle');
      actor.stop();
    });
  });
});

describe('tool/mode workflow events (Stage 04)', () => {
  it('SET_RIGGING_TOOL on machine updates weightPaintMode to false in context', () => {
    const actor = startMachine();
    actor.send({ type: 'SET_RIGGING_TOOL', riggingTool: 'draw' });
    expect(actor.getSnapshot().context.weightPaintMode).toBe(false);
    actor.stop();
  });

  it('ENTER_WEIGHT_PAINT on machine sets weightPaintMode true in context', () => {
    const actor = startMachine();
    actor.send({ type: 'ENTER_WEIGHT_PAINT' });
    expect(actor.getSnapshot().context.weightPaintMode).toBe(true);
    actor.stop();
  });

  it('EXIT_WEIGHT_PAINT on machine sets weightPaintMode false in context', () => {
    const actor = startMachine();
    actor.send({ type: 'ENTER_WEIGHT_PAINT' });
    expect(actor.getSnapshot().context.weightPaintMode).toBe(true);
    actor.send({ type: 'EXIT_WEIGHT_PAINT' });
    expect(actor.getSnapshot().context.weightPaintMode).toBe(false);
    actor.stop();
  });

  it('SET_MESH_SUBMODE on machine stays in idle (no-op context change)', () => {
    const actor = startMachine();
    actor.send({ type: 'SET_MESH_SUBMODE', meshSubMode: 'deform' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('SET_TOOL with weightPaint sets weightPaintMode true in context', () => {
    const actor = startMachine();
    actor.send({ type: 'SET_TOOL', tool: 'weightPaint' });
    expect(actor.getSnapshot().context.activeTool).toBe('weightPaint');
    expect(actor.getSnapshot().context.weightPaintMode).toBe(true);
    actor.stop();
  });

  it('SET_TOOL with non-weightPaint clears weightPaintMode in context', () => {
    const actor = startMachine();
    actor.send({ type: 'SET_TOOL', tool: 'weightPaint' });
    expect(actor.getSnapshot().context.weightPaintMode).toBe(true);
    actor.send({ type: 'SET_TOOL', tool: 'select' });
    expect(actor.getSnapshot().context.weightPaintMode).toBe(false);
    actor.stop();
  });
});

describe('mode lifecycle remains XState-only', () => {
  it('full weight paint lifecycle: ENTER_WEIGHT_PAINT → gesture → EXIT_WEIGHT_PAINT', () => {
    const actor = startMachine();
    actor.send({ type: 'ENTER_WEIGHT_PAINT' });
    expect(actor.getSnapshot().context.weightPaintMode).toBe(true);
    actor.send({ type: 'START_WEIGHT_PAINT', payload: { boneId: 'b1' } });
    expect(actor.getSnapshot().value).toBe('weightPainting');
    actor.send({ type: 'MOVE_GESTURE', payload: { strength: 0.5 } });
    actor.send({ type: 'COMMIT_GESTURE' });
    expect(actor.getSnapshot().value).toBe('idle');

    actor.send({ type: 'EXIT_WEIGHT_PAINT' });
    expect(actor.getSnapshot().context.weightPaintMode).toBe(false);
    expect(useEditorStore.getState()).not.toHaveProperty('weightPaintMode');
    actor.stop();
  });

  it('bridge does not put document state into machine context (extended)', () => {
    const actor = startMachine();
    actor.send({ type: 'ENTER_WEIGHT_PAINT' });
    const ctx = actor.getSnapshot().context;
    expect(ctx.weightPaintMode).toBe(true);
    expect(ctx.selection).toBeUndefined();
    expect(ctx.project).toBeUndefined();
    expect(ctx.marqueeBox).toBeNull();
    actor.stop();
  });
});

import { evaluateEditorFramePose } from '@/features/canvas/application/evaluateEditorFramePose.js';

describe('evaluateEditorFramePose orchestrator', () => {
  const project = {
    nodes: [],
    bones: [],
    defaultPose: {},
    animations: [],
    physics_groups: [],
    physicsRules: { groups: [], rules: [] },
  };
  const editorState = { activeTool: 'select', editorMode: 'edit' };
  const animationState = { activeAnimationId: null, currentTime: 0, draftPose: null };

  it('without physics runtime returns pre-physics frame', () => {
    const result = evaluateEditorFramePose({
      project,
      editorState,
      animationState,
      physicsRuntime: null,
      timestamp: 0,
    });
    expect(result).toHaveProperty('poseOverrides');
    expect(result).toHaveProperty('effectiveNodes');
    expect(result).toHaveProperty('effectiveBones');
    expect(result).toHaveProperty('physicsActive');
    expect(result.physicsActive).toBe(false);
  });

  it('with null physics runtime returns pre-physics frame', () => {
    const result = evaluateEditorFramePose({
      project,
      editorState,
      animationState,
      physicsRuntime: undefined,
      timestamp: 0,
    });
    expect(result.physicsActive).toBe(false);
  });

  it('physics runtime with no overrides returns pre-physics frame with physicsActive', () => {
    const physicsRuntime = {
      evaluate: () => ({ active: true, overrides: null }),
    };
    const result = evaluateEditorFramePose({
      project,
      editorState,
      animationState,
      physicsRuntime,
      timestamp: 0,
    });
    expect(result.physicsActive).toBe(true);
  });

  it('physics runtime with empty overrides returns pre-physics frame with physicsActive', () => {
    const physicsRuntime = {
      evaluate: () => ({ active: true, overrides: new Map() }),
    };
    const result = evaluateEditorFramePose({
      project,
      editorState,
      animationState,
      physicsRuntime,
      timestamp: 0,
    });
    expect(result.physicsActive).toBe(true);
  });

  it('physics runtime with overrides returns final frame with runtime layer', () => {
    const physicsRuntime = {
      evaluate: () => ({ active: true, overrides: new Map([['bone1', { rotation: 45 }]]) }),
    };
    const result = evaluateEditorFramePose({
      project,
      editorState,
      animationState,
      physicsRuntime,
      timestamp: 0,
    });
    expect(result.physicsActive).toBe(true);
    expect(result.poseOverrides.get('bone1')).toEqual({ rotation: 45 });
  });

  it('physics disabled passes enabled=false to adapter', () => {
    let receivedEnabled;
    const physicsRuntime = {
      evaluate: ({ enabled }) => { receivedEnabled = enabled; return { active: false, overrides: null }; },
    };
    evaluateEditorFramePose({
      project,
      editorState: { ...editorState, activeTool: 'select' },
      animationState,
      physicsRuntime,
      timestamp: 0,
    });
    expect(receivedEnabled).toBe(false);
  });

  it('physics enabled when activeTool is pose', () => {
    let receivedEnabled;
    const physicsRuntime = {
      evaluate: ({ enabled }) => { receivedEnabled = enabled; return { active: false, overrides: null }; },
    };
    evaluateEditorFramePose({
      project,
      editorState: { ...editorState, activeTool: 'pose' },
      animationState,
      physicsRuntime,
      timestamp: 0,
    });
    expect(receivedEnabled).toBe(true);
  });

  it('orchestrator does not import React, Zustand, or DOM', async () => {
    const mod = await import('@/features/canvas/application/evaluateEditorFramePose.js');
    const src = Object.values(mod).join('');
    expect(src).not.toContain('useEditorStore');
    expect(src).not.toContain('useProjectStore');
    expect(src).not.toContain('document');
    expect(src).not.toContain('window');
  });
});
