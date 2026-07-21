import { describe, it, expect, beforeEach } from 'vitest';
import { executeCommand, executeCommandBatch } from '@/features/canvas/application/workflowCommandRuntime.js';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';
import { clearHistory, undoCount, undo, applyPatches } from '@/store/undoHistory';

function deps() {
  return {
    editorStore: useEditorStore,
    projectStore: useProjectStore,
    pixiRuntime: null,
    editorMode: useEditorStore.getState().editorMode,
  };
}

function resetAll() {
  useProjectStore.getState().resetProject();
  clearHistory();
  useEditorStore.setState({
    selection: [],
    marqueeBox: null,
    hoverHit: null,
    hoverSource: null,
    interaction: { kind: 'idle' },
  });
}

describe('workflowCommandRuntime — executeCommand', () => {
  beforeEach(() => {
    resetAll();
  });

  it('setSelection updates editorStore selection', () => {
    executeCommand({ type: 'setSelection', payload: { ids: ['p1', 'p2'] } }, deps());
    expect(useEditorStore.getState().selection).toEqual(['p1', 'p2']);
  });

  it('clearSelection with element target clears selection', () => {
    useEditorStore.setState({ selection: ['p1'] });
    executeCommand({ type: 'clearSelection', payload: { target: 'element' } }, deps());
    expect(useEditorStore.getState().selection).toEqual([]);
  });

  it('clearSelection with rig target clears rig selection', () => {
    useEditorStore.setState({
      selection: ['b1'],
      activeBoneId: 'b1',
      activeConstraintId: 'c1',
      rigSelectionAnchor: 'b1',
    });
    executeCommand({ type: 'clearSelection', payload: {} }, deps());
    const s = useEditorStore.getState();
    expect(s.selection).toEqual([]);
    expect(s.activeBoneId).toBeNull();
    expect(s.activeConstraintId).toBeNull();
    expect(s.rigSelectionAnchor).toBeNull();
  });

  it('setRigSelection updates rig selection fields', () => {
    executeCommand({
      type: 'setRigSelection',
      payload: { boneIds: ['b1', 'b2'], activeBoneId: 'b2', constraintIds: [], activeConstraintId: null },
    }, deps());
    const s = useEditorStore.getState();
    expect(s.selection).toEqual(['b1', 'b2']);
    expect(s.activeBoneId).toBe('b2');
  });

  it('setMarquee updates marqueeBox', () => {
    executeCommand({ type: 'setMarquee', payload: { box: { x: 0, y: 0, w: 100, h: 50 } } }, deps());
    expect(useEditorStore.getState().marqueeBox).toEqual({ x: 0, y: 0, w: 100, h: 50 });
  });

  it('setMarquee with null clears marqueeBox', () => {
    useEditorStore.setState({ marqueeBox: { x: 0, y: 0, w: 10, h: 10 } });
    executeCommand({ type: 'setMarquee', payload: { box: null } }, deps());
    expect(useEditorStore.getState().marqueeBox).toBeNull();
  });

  it('setHover updates canvas-owned hover atomically', () => {
    executeCommand({ type: 'setHover', payload: { hit: 'partA' } }, deps());
    expect(useEditorStore.getState().hoverHit).toBe('partA');
    expect(useEditorStore.getState().hoverSource).toBe('canvas');
  });

  it('applyWorkflowUi updates durable UI without workflow mirrors', () => {
    useEditorStore.setState({ exportAreaMoveMode: true });
    executeCommand({
      type: 'applyWorkflowUi',
      payload: { showSkeleton: true, clearBlendShape: true, finishExportAreaMove: true },
    }, deps());
    const state = useEditorStore.getState();
    expect(state.showSkeleton).toBe(true);
    expect(state.exportAreaMoveMode).toBe(false);
    expect(state.interaction).toEqual({ kind: 'idle' });
  });

  it('updateProject applies mutator to projectStore', () => {
    const originalName = useProjectStore.getState().project.name;
    executeCommand({
      type: 'updateProject',
      payload: { mutator: (proj) => { proj.name = 'from-command'; } },
    }, deps());
    expect(useProjectStore.getState().project.name).toBe('from-command');
    expect(useProjectStore.getState().project.name).not.toBe(originalName);
  });

  it('updateProject with non-function mutator is a no-op', () => {
    const originalName = useProjectStore.getState().project.name;
    executeCommand({ type: 'updateProject', payload: { mutator: 'not-a-function' } }, deps());
    expect(useProjectStore.getState().project.name).toBe(originalName);
  });

  it('markDirty sets hasUnsavedChanges', () => {
    useProjectStore.getState().setHasUnsavedChanges(false);
    executeCommand({ type: 'markDirty', payload: {} }, deps());
    expect(useProjectStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('autoKeyframe applies mutator only in animation mode', () => {
    useEditorStore.setState({ editorMode: 'animation' });
    executeCommand({
      type: 'autoKeyframe',
      payload: { mutator: (proj) => { proj.name = 'keyframed'; } },
    }, { ...deps(), editorMode: 'animation' });
    expect(useProjectStore.getState().project.name).toBe('keyframed');

    useProjectStore.getState().resetProject();
    useEditorStore.setState({ editorMode: 'staging' });
    executeCommand({
      type: 'autoKeyframe',
      payload: { mutator: (proj) => { proj.name = 'should-not-apply'; } },
    }, { ...deps(), editorMode: 'staging' });
    expect(useProjectStore.getState().project.name).not.toBe('should-not-apply');
  });

  it('unknown command type throws in non-production', () => {
    expect(() => {
      executeCommand({ type: 'unknownCommand', payload: {} }, deps());
    }).toThrow('Unknown command type: "unknownCommand"');
  });
});

describe('workflowCommandRuntime — undo batch integration', () => {
  beforeEach(() => {
    resetAll();
  });

  it('beginBatch + updateProject + endBatch creates one undo entry', () => {
    const before = undoCount();
    const d = deps();

    executeCommand({ type: 'beginBatch', payload: {} }, d);
    executeCommand({
      type: 'updateProject',
      payload: { mutator: (proj) => { proj.name = 'A'; } },
    }, d);
    executeCommand({
      type: 'updateProject',
      payload: { mutator: (proj) => { proj.name = 'B'; } },
    }, d);
    executeCommand({ type: 'endBatch', payload: {} }, d);

    expect(undoCount()).toBe(before + 1);
    expect(useProjectStore.getState().project.name).toBe('B');
  });

  it('undo after batched updateProject restores previous state', () => {
    const originalName = useProjectStore.getState().project.name;
    const d = deps();

    executeCommand({ type: 'beginBatch', payload: {} }, d);
    executeCommand({
      type: 'updateProject',
      payload: { mutator: (proj) => { proj.name = 'batched'; } },
    }, d);
    executeCommand({ type: 'endBatch', payload: {} }, d);

    expect(useProjectStore.getState().project.name).toBe('batched');

    undo((inversePatches) => {
      const fullState = useProjectStore.getState();
      const restored = applyPatches(fullState, inversePatches);
      useProjectStore.getState().restoreProject(restored);
    });
    expect(useProjectStore.getState().project.name).toBe(originalName);
  });

  it('executeCommandBatch wraps document mutations in one undo entry', () => {
    const before = undoCount();
    const d = deps();

    executeCommandBatch([
      { type: 'setSelection', payload: { ids: ['p1'] } },
      { type: 'updateProject', payload: { mutator: (proj) => { proj.name = 'batched'; } } },
      { type: 'setMarquee', payload: { box: { x: 0, y: 0, w: 10, h: 10 } } },
    ], d);

    expect(undoCount()).toBe(before + 1);
    expect(useEditorStore.getState().selection).toEqual(['p1']);
    expect(useEditorStore.getState().marqueeBox).toEqual({ x: 0, y: 0, w: 10, h: 10 });
    expect(useProjectStore.getState().project.name).toBe('batched');
  });
});

describe('workflowCommandRuntime — domain purity', () => {
  it('command runtime module does not import React, Zustand, or DOM', async () => {
    const mod = await import('@/features/canvas/application/workflowCommandRuntime.js');
    const src = Object.values(mod).join('');
    expect(src).not.toContain('useState');
    expect(src).not.toContain('useCallback');
    expect(src).not.toContain('useRef');
    expect(src).not.toContain('document.createElement');
  });
});
