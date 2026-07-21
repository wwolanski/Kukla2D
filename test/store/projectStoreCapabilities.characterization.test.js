import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore } from '@/store/projectStore';
import { clearHistory, undoCount } from '@/store/undoHistory';

const capabilityMethods = [
  'createAnimationClip', 'renameAnimationClip', 'deleteAnimationClip',
  'createAnimation', 'renameAnimation', 'deleteAnimation',
  'setPhysicsRules', 'createPhysicsRule', 'updatePhysicsRule',
  'deletePhysicsRule', 'reorderPhysicsRules',
  'createControlHandle', 'updateControlHandle', 'deleteControlHandle',
  'createAnimationModifier', 'updateAnimationModifier', 'deleteAnimationModifier',
  'loadProject', 'commitLoadedProject', 'resetProject',
  'deleteNode', 'deleteSelectedNodes', 'deleteSelectedBones',
  'deleteSelectedConstraints', 'deleteSelection', 'buildDeleteSelectionIntent',
];

function resetStore() {
  clearHistory();
  useProjectStore.getState().resetProject();
  clearHistory();
}

describe('project store capability characterization', () => {
  beforeEach(resetStore);

  it('keeps planned capability methods on the public getState facade', () => {
    const state = useProjectStore.getState();
    for (const method of capabilityMethods) {
      expect(state[method], method).toEqual(expect.any(Function));
    }
  });

  it('keeps physics mutations document-visible and dirty without implicit history', () => {
    const store = useProjectStore.getState();
    store.createPhysicsRule({ id: 'physics-1', name: 'Hair' });
    store.updatePhysicsRule('physics-1', { name: 'Hair spring' });

    const state = useProjectStore.getState();
    expect(state.project.physicsRules).toEqual([expect.objectContaining({ id: 'physics-1', name: 'Hair spring' })]);
    expect(state.hasUnsavedChanges).toBe(true);
    expect(undoCount()).toBe(0);
  });

  it('keeps load/reset clean and clears prior undo history', () => {
    const store = useProjectStore.getState();
    store.createControlHandle({ id: 'handle-1', name: 'Chest', position: { x: 0, y: 0 } });
    expect(undoCount()).toBe(1);

    const loadedProject = structuredClone(useProjectStore.getState().project);
    loadedProject.parameters = [{ id: 'legacy-parameter', bindings: [] }];
    store.loadProject(loadedProject);

    expect(useProjectStore.getState().project).not.toHaveProperty('parameters');
    expect(useProjectStore.getState().hasUnsavedChanges).toBe(false);
    expect(undoCount()).toBe(0);

    store.resetProject();
    expect(useProjectStore.getState().project).not.toHaveProperty('parameters');
    expect(useProjectStore.getState().hasUnsavedChanges).toBe(false);
  });

  it('keeps deleteSelection atomic, dirty and undoable', () => {
    useProjectStore.setState((state) => ({
      ...state,
      project: {
        ...state.project,
        nodes: [{ id: 'node-1', type: 'group', name: 'Group', parent: null }],
      },
    }));

    useProjectStore.getState().deleteSelection({ nodeIds: ['node-1'] });

    expect(useProjectStore.getState().project.nodes).toEqual([]);
    expect(useProjectStore.getState().hasUnsavedChanges).toBe(true);
    expect(undoCount()).toBe(1);
  });
});
