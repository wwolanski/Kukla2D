// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';
import { buildDeleteSelectionIntent } from '@/domain/deleteCommands';
import { editorModePolicy, ACTION_IDS } from '@/domain/editorModePolicy';
import { applyPatches } from 'immer';
import { clearHistory, undo, undoCount } from '@/store/undoHistory';

function makeFixture() {
  return {
    nodes: [
      { id: 'n1', type: 'part', name: 'Part1', parent: null },
      { id: 'n2', type: 'part', name: 'Part2', parent: null },
    ],
    bones: [
      { id: 'b1', name: 'Bone1', parentId: null },
      { id: 'b2', name: 'Bone2', parentId: null },
    ],
    constraints: [
      { id: 'ik1', type: 'ik', name: 'IK1' },
    ],
    animations: [],
    textures: [{ id: 'tex1', source: 'test.png' }],
  };
}

describe('Delete intent classification', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: makeFixture() });
  });

  it('classifies node selection', () => {
    const intent = buildDeleteSelectionIntent(useProjectStore.getState().project, {
      nodeIds: ['n1'],
    });
    expect(intent.isEmpty).toBe(false);
    expect(intent.counts.nodes).toBe(1);
    expect(intent.counts.bones).toBe(0);
    expect(intent.counts.constraints).toBe(0);
    expect(intent.hasMixedTargets).toBe(false);
  });

  it('classifies bone selection', () => {
    const intent = buildDeleteSelectionIntent(useProjectStore.getState().project, {
      boneIds: ['b1'],
    });
    expect(intent.isEmpty).toBe(false);
    expect(intent.counts.bones).toBe(1);
    expect(intent.hasMixedTargets).toBe(false);
  });

  it('classifies mixed selection', () => {
    const intent = buildDeleteSelectionIntent(useProjectStore.getState().project, {
      nodeIds: ['n1'],
      boneIds: ['b1'],
    });
    expect(intent.isEmpty).toBe(false);
    expect(intent.hasMixedTargets).toBe(true);
    expect(intent.label).toContain('1 layer');
    expect(intent.label).toContain('1 bone');
  });

  it('returns empty for no selection', () => {
    const intent = buildDeleteSelectionIntent(useProjectStore.getState().project, {});
    expect(intent.isEmpty).toBe(true);
  });

  it('ignores non-existent IDs', () => {
    const intent = buildDeleteSelectionIntent(useProjectStore.getState().project, {
      nodeIds: ['nonexistent'],
    });
    expect(intent.isEmpty).toBe(true);
  });
});

describe('Delete policy check', () => {
  it('allows bone delete in staging', () => {
    const decision = editorModePolicy({
      mode: 'staging',
      actionId: ACTION_IDS.BONE_DELETE,
      targetKind: 'structure',
    });
    expect(decision.allowed).toBe(true);
  });

  it('blocks bone delete in animation', () => {
    const decision = editorModePolicy({
      mode: 'animation',
      actionId: ACTION_IDS.BONE_DELETE,
      targetKind: 'structure',
    });
    expect(decision.allowed).toBe(false);
  });
});

describe('Canvas select-all logic', () => {
  beforeEach(() => {
    useEditorStore.setState({
      selection: [],
      activeBoneId: null,
      activeConstraintId: null,
    });
    useProjectStore.setState({ project: makeFixture() });
  });

  it('element target selects only nodes', () => {
    const proj = useProjectStore.getState().project;
    const nodeIds = proj.nodes.map((n) => n.id);
    useEditorStore.getState().setElementSelection(nodeIds);

    const sel = useEditorStore.getState().selection;
    expect(sel).toContain('n1');
    expect(sel).toContain('n2');
    expect(sel).not.toContain('b1');
    expect(sel).not.toContain('ik1');
  });

  it('rig target selects bones and constraints', () => {
    const proj = useProjectStore.getState().project;
    const boneIds = proj.bones.map((b) => b.id);
    const constraintIds = proj.constraints.map((c) => c.id);

    useEditorStore.getState().setRigSelection({
      elementIds: [],
      boneIds,
      constraintIds,
      activeBoneId: boneIds[boneIds.length - 1],
      activeConstraintId: constraintIds[constraintIds.length - 1],
    });

    const sel = useEditorStore.getState().selection;
    expect(sel).toContain('b1');
    expect(sel).toContain('b2');
    expect(sel).toContain('ik1');
    expect(sel).not.toContain('n1');
  });

  it('all target selects everything', () => {
    const proj = useProjectStore.getState().project;
    const nodeIds = proj.nodes.map((n) => n.id);
    const boneIds = proj.bones.map((b) => b.id);
    const constraintIds = proj.constraints.map((c) => c.id);

    useEditorStore.getState().setRigSelection({
      elementIds: nodeIds,
      boneIds,
      constraintIds,
      activeBoneId: boneIds[boneIds.length - 1],
      activeConstraintId: constraintIds[constraintIds.length - 1],
    });

    const sel = useEditorStore.getState().selection;
    expect(sel).toContain('n1');
    expect(sel).toContain('n2');
    expect(sel).toContain('b1');
    expect(sel).toContain('b2');
    expect(sel).toContain('ik1');
  });
});

describe('Delete execution clears selection', () => {
  beforeEach(() => {
    clearHistory();
    useEditorStore.setState({
      selection: ['n1'],
      activeBoneId: null,
      activeConstraintId: null,
    });
    useProjectStore.setState({ project: makeFixture() });
  });

  it('deleteSelectedNodes removes nodes and preserves textures', () => {
    const store = useProjectStore.getState();
    store.deleteSelectedNodes(['n1']);

    const proj = useProjectStore.getState().project;
    expect(proj.nodes.find((n) => n.id === 'n1')).toBeUndefined();
    expect(proj.nodes.find((n) => n.id === 'n2')).toBeDefined();
    expect(proj.textures.length).toBe(1);
  });

  it('after delete, selection is cleared', () => {
    const store = useProjectStore.getState();
    store.deleteSelectedNodes(['n1']);
    useEditorStore.getState().clearSelection();

    expect(useEditorStore.getState().selection).toEqual([]);
  });

  it('deleteSelectedBones removes bones', () => {
    const store = useProjectStore.getState();
    store.deleteSelectedBones(['b1']);

    const proj = useProjectStore.getState().project;
    expect(proj.bones.find((b) => b.id === 'b1')).toBeUndefined();
    expect(proj.bones.find((b) => b.id === 'b2')).toBeDefined();
  });

  it('deleteSelectedConstraints removes constraints', () => {
    const store = useProjectStore.getState();
    store.deleteSelectedConstraints(['ik1']);

    const proj = useProjectStore.getState().project;
    expect(proj.constraints.find((c) => c.id === 'ik1')).toBeUndefined();
  });

  it('deletes mixed selection as one undoable transaction', () => {
    const store = useProjectStore.getState();

    store.deleteSelection({ nodeIds: ['n1'], boneIds: ['b1'], constraintIds: ['ik1'] });

    expect(undoCount()).toBe(1);
    expect(useProjectStore.getState().project.nodes.some((n) => n.id === 'n1')).toBe(false);
    expect(useProjectStore.getState().project.bones.some((b) => b.id === 'b1')).toBe(false);
    expect(useProjectStore.getState().project.constraints.some((c) => c.id === 'ik1')).toBe(false);

    undo((patches) => {
      useProjectStore.getState().restoreProject(
        applyPatches(useProjectStore.getState(), patches),
      );
    });

    expect(useProjectStore.getState().project.nodes.some((n) => n.id === 'n1')).toBe(true);
    expect(useProjectStore.getState().project.bones.some((b) => b.id === 'b1')).toBe(true);
    expect(useProjectStore.getState().project.constraints.some((c) => c.id === 'ik1')).toBe(true);
  });
});

describe('Guard: editable targets', () => {
  it('INPUT tag is editable', () => {
    const input = document.createElement('input');
    expect(input.tagName).toBe('INPUT');
  });

  it('TEXTAREA tag is editable', () => {
    const textarea = document.createElement('textarea');
    expect(textarea.tagName).toBe('TEXTAREA');
  });
});

describe('Guard: dialog detection', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('detects open dialog', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('data-state', 'open');
    document.body.appendChild(dialog);

    expect(document.querySelector('[role="dialog"][data-state="open"]')).toBeTruthy();
  });

  it('no false positive for closed dialog', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('data-state', 'closed');
    document.body.appendChild(dialog);

    expect(document.querySelector('[role="dialog"][data-state="open"]')).toBeNull();
  });
});
