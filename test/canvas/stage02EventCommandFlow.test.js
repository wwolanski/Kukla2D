import { beforeEach, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createActor } from 'xstate';
import { editorWorkflowMachine } from '@/features/canvas/application/editorWorkflowMachine.js';
import { resolveEditorCommands } from '@/features/canvas/domain/resolveEditorCommands.js';
import { executeCommand, executeCommandBatch } from '@/features/canvas/application/workflowCommandRuntime.js';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';

const workflowContext = {
  activeTool: 'select',
  selectionTarget: 'element',
  selectionTargetBeforeShift: null,
  riggingMode: 'off',
  riggingTool: 'select',
  toolMode: 'select',
  meshEditMode: false,
  meshSubMode: 'deform',
  weightPaintMode: false,
  activeSession: null,
  marqueeBox: null,
  importStatus: 'idle',
};

function deps() {
  return {
    editorStore: useEditorStore,
    projectStore: useProjectStore,
    pixiRuntime: null,
    editorMode: useEditorStore.getState().editorMode,
  };
}

describe('single-owner workflow', () => {
  beforeEach(() => {
    useEditorStore.setState({
      selection: [],
      activeBoneId: null,
      activeConstraintId: null,
      rigSelectionAnchor: null,
      marqueeBox: null,
      showSkeleton: false,
      blendShapeEditMode: false,
      activeBlendShapeId: null,
      interaction: { kind: 'idle' },
    });
  });

  it('machine owns complete tool/mode state', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'SET_TOOL', tool: 'drawBone' });
    expect(actor.getSnapshot().context).toMatchObject({
      activeTool: 'drawBone',
      selectionTarget: 'rig',
      riggingMode: 'bones',
      riggingTool: 'draw',
      toolMode: 'draw_bone',
      meshEditMode: false,
      weightPaintMode: false,
    });
    actor.stop();
  });

  it('entering Select clears stale rig selection, focus, and hover', () => {
    useEditorStore.setState({
      selection: ['bone-1'],
      activeBoneId: 'bone-1',
      rigSelectionAnchor: 'bone-1',
      hoverHit: 'bone:bone-1',
    });
    const [command] = resolveEditorCommands({
      event: { type: 'SET_TOOL', tool: 'select' },
      context: workflowContext,
    });

    executeCommand(command, deps());

    expect(useEditorStore.getState()).toMatchObject({
      selection: [],
      activeBoneId: null,
      rigSelectionAnchor: null,
      hoverHit: null,
    });
  });

  it('entering Transform preserves active rig selection and focus', () => {
    useEditorStore.setState({
      selection: ['bone-1'],
      activeBoneId: 'bone-1',
      rigSelectionAnchor: 'bone-1',
    });
    const [command] = resolveEditorCommands({
      event: { type: 'SET_TOOL', tool: 'transform' },
      context: { ...workflowContext, selectionTarget: 'rig' },
    });

    executeCommand(command, deps());

    expect(useEditorStore.getState()).toMatchObject({
      selection: ['bone-1'],
      activeBoneId: 'bone-1',
      rigSelectionAnchor: 'bone-1',
    });
  });

  it('selection activates Transform while preserving selection target', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'SET_SELECTION_TARGET', target: 'element' });
    actor.send({ type: 'SELECT_HIT', partId: 'part-1' });

    expect(actor.getSnapshot().context).toMatchObject({
      activeTool: 'transform',
      selectionTarget: 'element',
    });
    actor.stop();
  });

  it('rig selection activates Transform with rig handles enabled', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'SET_SELECTION_TARGET', target: 'rig' });
    actor.send({
      type: 'SELECT_RIG_HIT',
      elementIds: [],
      boneIds: ['bone-1'],
      constraintIds: [],
      activeBoneId: 'bone-1',
      anchor: 'bone-1',
    });

    expect(actor.getSnapshot().context).toMatchObject({
      activeTool: 'transform',
      selectionTarget: 'rig',
      riggingMode: 'bones',
      riggingTool: 'select',
    });
    actor.stop();
  });

  it('draw preview command has a real store endpoint and clears cleanly', () => {
    const preview = { startX: 1, startY: 2, endX: 30, endY: 40 };

    expect(() => executeCommand({
      type: 'setDrawBonePreview',
      payload: { preview },
    }, deps())).not.toThrow();
    expect(useEditorStore.getState().drawBonePreview).toEqual(preview);

    executeCommand({ type: 'setDrawBonePreview', payload: { preview: null } }, deps());
    expect(useEditorStore.getState().drawBonePreview).toBeNull();
  });

  it('rigging, mesh and weight events mutate XState only', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    actor.send({ type: 'SET_RIGGING_MODE', riggingMode: 'ik' });
    expect(actor.getSnapshot().context).toMatchObject({
      activeTool: 'drawIk',
      selectionTarget: 'rig',
      riggingMode: 'ik',
    });
    actor.send({ type: 'ENTER_MESH_EDIT' });
    actor.send({ type: 'SET_MESH_SUBMODE', meshSubMode: 'adjust' });
    expect(actor.getSnapshot().context).toMatchObject({
      activeTool: 'meshEdit',
      meshEditMode: true,
      meshSubMode: 'adjust',
      weightPaintMode: false,
    });
    actor.send({ type: 'ENTER_WEIGHT_PAINT' });
    expect(actor.getSnapshot().context).toMatchObject({
      activeTool: 'weightPaint',
      riggingMode: 'weights',
      meshEditMode: false,
      weightPaintMode: true,
    });
    actor.stop();
  });

  it('Alt cycles durable selection targets: all → element → rig → all', () => {
    const actor = createActor(editorWorkflowMachine);
    actor.start();
    expect(actor.getSnapshot().context.selectionTarget).toBe('all');
    actor.send({ type: 'CYCLE_SELECTION_TARGET' });
    expect(actor.getSnapshot().context.selectionTarget).toBe('element');
    actor.send({ type: 'CYCLE_SELECTION_TARGET' });
    expect(actor.getSnapshot().context.selectionTarget).toBe('rig');
    actor.send({ type: 'CYCLE_SELECTION_TARGET' });
    expect(actor.getSnapshot().context.selectionTarget).toBe('all');
    actor.stop();
  });

  it('tool resolver emits durable UI effect, never workflow mirror command', () => {
    const commands = resolveEditorCommands({
      event: { type: 'SET_TOOL', tool: 'drawBone' },
      context: { ...workflowContext, activeTool: 'drawBone', selectionTarget: 'rig' },
    });
    expect(commands).toEqual([{
      type: 'applyWorkflowUi',
      payload: {
        showSkeleton: true,
        clearRigFocus: false,
        clearSelection: false,
        clearHover: true,
        clearBlendShape: true,
        finishExportAreaMove: true,
      },
    }]);
    expect(commands.map(command => command.type)).not.toContain('setActiveTool');
  });

  it('selection event resolves and executes exactly one payload command', () => {
    const commands = resolveEditorCommands({
      event: { type: 'SELECT_HIT', partId: 'part-1' },
      context: workflowContext,
    });
    expect(commands).toEqual([{ type: 'setSelection', payload: { ids: ['part-1'] } }]);
    executeCommandBatch(commands, deps());
    expect(useEditorStore.getState().selection).toEqual(['part-1']);
  });

  it('clear selection carries actor-owned target into executor', () => {
    useEditorStore.setState({ selection: ['b1'], activeBoneId: 'b1' });
    const commands = resolveEditorCommands({
      event: { type: 'CLEAR_SELECTION' },
      context: { ...workflowContext, selectionTarget: 'rig' },
    });
    expect(commands).toEqual([{ type: 'clearSelection', payload: { target: 'rig' } }]);
    executeCommandBatch(commands, deps());
    expect(useEditorStore.getState()).toMatchObject({ selection: [], activeBoneId: null });
  });

  it('applyWorkflowUi changes durable UI without adding workflow fields', () => {
    executeCommand({
      type: 'applyWorkflowUi',
      payload: { showSkeleton: true, clearBlendShape: true, resetRigOverlays: true },
    }, deps());
    const state = useEditorStore.getState();
    expect(state.showSkeleton).toBe(true);
    for (const field of ['activeTool', 'selectionTarget', 'riggingMode', 'meshEditMode', 'weightPaintMode']) {
      expect(state).not.toHaveProperty(field);
    }
  });

  it('unknown command throws in non-production', () => {
    expect(() => executeCommand({ type: 'unknown', payload: {} }, deps())).toThrow(
      '[EditorCommandExecutor] Unknown command type',
    );
  });
});

describe('source ownership guards', () => {
  it('editorStore contains no workflow fields or setters', async () => {
    const source = await readFile('src/store/editorStore.ts', 'utf8');
    for (const token of [
      'activeTool:',
      'selectionTarget:',
      'riggingMode:',
      'riggingTool:',
      'toolMode:',
      'meshEditMode:',
      'meshSubMode:',
      'weightPaintMode:',
      'setActiveTool:',
      'setRiggingMode:',
    ]) {
      expect(source).not.toContain(token);
    }
  });

  it('workflow hook delegates directly to actor send', async () => {
    const source = await readFile('src/features/canvas/application/useWorkflowActor.ts', 'utf8');
    expect(source).toContain('actorRef.send(event)');
    expect(source).not.toContain('resolveEditorCommands');
    expect(source).not.toContain('executeCommandBatch');
  });

  it('toolbar and keyboard use event-only API', async () => {
    const toolbar = await readFile('src/features/projects/components/WorkspaceToolbar.jsx', 'utf8');
    const keyboard = await readFile('src/features/canvas/application/useCanvasKeyboardShortcuts.ts', 'utf8');
    expect(toolbar).toContain('send(');
    expect(toolbar).not.toContain('setActiveTool');
    expect(keyboard).not.toContain('setActiveTool');
    expect(keyboard).not.toContain('setRiggingMode');
  });
});
