import { describe, expect, it } from 'vitest';
import { useProjectStore } from '@/store/projectStore';

const OWNERSHIP_MANIFEST = {
  base: ['updateProject', 'setHasUnsavedChanges'],
  animation: [
    'createAnimationClip', 'renameAnimationClip', 'deleteAnimationClip',
    'updateAnimationTiming', 'upsertAnimationKeyframe', 'upsertAnimationKeyframes',
    'editAnimationKeyframes', 'moveAnimationKeyframes', 'deleteAnimationKeyframes',
    'setAnimationKeyframeEasing', 'addAnimationMarker', 'addAnimationAudioTrack',
    'updateAnimationAudioTrack', 'removeAnimationAudioTrack',
    'createAnimation', 'renameAnimation', 'deleteAnimation',
  ],
  physicsRule: [
    'setPhysicsRules', 'createPhysicsRule', 'updatePhysicsRule',
    'deletePhysicsRule', 'reorderPhysicsRules',
  ],
  blendShape: [
    'createBlendShape', 'deleteBlendShape', 'setBlendShapeValue', 'updateBlendShapeDeltas',
  ],
  controlMotion: [
    'createControlHandle', 'updateControlHandle', 'deleteControlHandle',
    'createAnimationModifier', 'updateAnimationModifier', 'deleteAnimationModifier',
    'reorderAnimationModifiers', 'duplicateAnimationModifier',
    'createIdleBreathingMotion', 'createHeadCheekJiggleMotion', 'bakeAnimationModifierToKeyframes',
  ],
  lifecycle: [
    'resetProject', 'commitLoadedProject', 'loadProject', 'updateCanvas', 'restoreProject',
  ],
  nodeHierarchy: [
    'createWarpDeformer', 'createGroup', 'reparentNode', 'duplicateNode',
    'deleteNode', 'deleteSelectedNodes', 'deleteSelectedBones',
    'deleteSelectedConstraints', 'deleteSelection', 'buildDeleteSelectionIntent',
  ],
};

const REAL_CAPABILITY_MODULES = [
  'projectBaseCommands',
  'projectAnimationCommands',
  'projectPhysicsRuleCommands',
  'projectBlendShapeCommands',
  'projectControlMotionCommands',
  'projectLifecycleCommands',
  'projectNodeHierarchyCommands',
];

describe('project store capability ownership', () => {
  it('every method key belongs to exactly one owner', () => {
    const allKeys = Object.values(OWNERSHIP_MANIFEST).flat();
    const uniqueKeys = new Set(allKeys);
    expect(uniqueKeys.size).toBe(allKeys.length);
  });

  it('every ownership method exists on the store facade', () => {
    const state = useProjectStore.getState();
    const allKeys = Object.values(OWNERSHIP_MANIFEST).flat();
    for (const key of allKeys) {
      expect(state, `missing method: ${key}`).toHaveProperty(key);
      expect(typeof state[key]).toBe('function');
    }
  });

  it('shared module does not expose store API methods', async () => {
    const sharedExports = await import('@/store/project/projectStoreShared');
    const ownNames = Object.keys(sharedExports);
    const storeMethodNames = new Set(Object.values(OWNERSHIP_MANIFEST).flat());
    const overlaps = ownNames.filter(name => storeMethodNames.has(name));
    expect(overlaps).toEqual([]);
  });

  it.each(REAL_CAPABILITY_MODULES)(
    'real capability module %s does not call selectCapability or createProjectStoreLegacyActions',
    async (moduleName) => {
      const mod = await import(`@/store/project/${moduleName}.ts`);
      const exportKeys = Object.keys(mod).filter(k => k.startsWith('createProject'));
      for (const key of exportKeys) {
        const fnStr = mod[key].toString();
        expect(fnStr, `${key} calls createProjectStoreLegacyActions`).not.toContain('createProjectStoreLegacyActions');
        expect(fnStr, `${key} calls selectCapability`).not.toContain('selectCapability');
      }
    }
  );


});
