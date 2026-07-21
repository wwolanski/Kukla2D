import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '@/store/projectStore';
import { clearHistory, undoCount } from '@/store/undoHistory';

function makeEmptyProject() {
  return {
    version: 7,
    canvas: { width: 800, height: 600, x: 0, y: 0, bgEnabled: false, bgColor: '#ffffff' },
    textures: [],
    nodes: [],
    bones: [],
    slots: [],
    attachments: [],
    skins: [],
    constraints: [],
    defaultPose: {},
    animations: [],
    physics_groups: [],
    physicsRules: [],
    libraryFolders: [],
    assetPlacements: [],
    controlHandles: [],
    animationModifiers: [],
  };
}

function makeProjectWithChest() {
  const project = makeEmptyProject();
  project.nodes.push({
    id: 'chest-1',
    type: 'part',
    name: 'Chest',
    parent: null,
    transform: { x: 400, y: 300, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 50, pivotY: 50 },
    draw_order: 0,
    opacity: 1,
    visible: true,
    mesh: {
      vertices: [
        { x: 0, y: 0, restX: 0, restY: 0 },
        { x: 100, y: 0, restX: 100, restY: 0 },
        { x: 100, y: 100, restX: 100, restY: 100 },
        { x: 0, y: 100, restX: 0, restY: 100 },
      ],
      uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      triangles: [[0, 1, 2], [0, 2, 3]],
      edgeIndices: [0, 1, 2, 3],
    },
  });
  project.animations.push({
    id: 'anim-1',
    name: 'Idle',
    duration: 2000,
    fps: 24,
    tracks: [],
  });
  return project;
}

function resetStore(project) {
  clearHistory();
  useProjectStore.setState({
    project,
    versionControl: { geometryVersion: 0, transformVersion: 0, textureVersion: 0 },
    hasUnsavedChanges: false,
  });
}

describe('project store auto motion', () => {
  beforeEach(() => {
    clearHistory();
    useProjectStore.setState({
      project: makeEmptyProject(),
      versionControl: { geometryVersion: 0, transformVersion: 0, textureVersion: 0 },
      hasUnsavedChanges: false,
    });
  });

  describe('control handle CRUD', () => {
    it('createControlHandle adds handle and marks unsaved', () => {
      const store = useProjectStore.getState();
      store.createControlHandle({
        id: 'h1', name: 'Chest', role: 'chest',
        space: 'node-local',
        target: { kind: 'part', id: 'chest-1' },
        position: { x: 100, y: 200 },
      });

      const state = useProjectStore.getState();
      expect(state.project.controlHandles).toHaveLength(1);
      expect(state.project.controlHandles[0]).toMatchObject({ id: 'h1', role: 'chest' });
      expect(state.hasUnsavedChanges).toBe(true);
      expect(undoCount()).toBe(1);
    });

    it('updateControlHandle patches existing handle', () => {
      resetStore({
        ...makeEmptyProject(),
        controlHandles: [{ id: 'h1', name: 'Chest', role: 'chest', space: 'node-local', target: { kind: 'part', id: 'chest-1' }, position: { x: 0, y: 0 } }],
      });

      useProjectStore.getState().updateControlHandle('h1', { name: 'Torso' });

      const state = useProjectStore.getState();
      expect(state.project.controlHandles[0].name).toBe('Torso');
      expect(state.project.controlHandles).toHaveLength(1);
      expect(state.hasUnsavedChanges).toBe(true);
    });

    it('deleteControlHandle removes handle', () => {
      resetStore({
        ...makeEmptyProject(),
        controlHandles: [
          { id: 'h1', name: 'Chest', role: 'chest', space: 'node-local', target: { kind: 'part', id: 'chest-1' }, position: { x: 0, y: 0 } },
          { id: 'h2', name: 'Head', role: 'head', space: 'node-local', target: { kind: 'part', id: 'head-1' }, position: { x: 0, y: 0 } },
        ],
      });

      useProjectStore.getState().deleteControlHandle('h1');

      const state = useProjectStore.getState();
      expect(state.project.controlHandles).toHaveLength(1);
      expect(state.project.controlHandles[0].id).toBe('h2');
    });

    it('updateControlHandle is no-op for missing id', () => {
      useProjectStore.getState().updateControlHandle('nonexistent', { name: 'X' });
      const state = useProjectStore.getState();
      expect(state.project.controlHandles).toHaveLength(0);
    });
  });

  describe('animation modifier CRUD', () => {
    it('createAnimationModifier adds modifier and marks unsaved', () => {
      const store = useProjectStore.getState();
      store.createAnimationModifier({
        id: 'm1', name: 'Idle Breathing', presetId: 'builtin.idleBreathing',
        presetVersion: 1, enabled: true, order: 0, scope: 'project',
        category: 'loop',
        driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'easeInOutSine' },
        bindings: { chest: { role: 'chest', required: true, target: 'handle', weight: 1 } },
        outputs: [{ kind: 'blendShapeValue', targetId: 'chest-1', property: '', blendMode: 'add' }],
        params: { strength: 1 },
      });

      const state = useProjectStore.getState();
      expect(state.project.animationModifiers).toHaveLength(1);
      expect(state.project.animationModifiers[0]).toMatchObject({ id: 'm1', presetId: 'builtin.idleBreathing' });
      expect(state.hasUnsavedChanges).toBe(true);
      expect(undoCount()).toBe(1);
    });

    it('updateAnimationModifier patches existing modifier', () => {
      resetStore({
        ...makeEmptyProject(),
        animationModifiers: [{
          id: 'm1', name: 'Idle Breathing', presetId: 'builtin.idleBreathing',
          presetVersion: 1, enabled: true, order: 0, scope: 'project',
          category: 'loop',
          driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'easeInOutSine' },
          bindings: {}, outputs: [], params: { strength: 1 },
        }],
      });

      useProjectStore.getState().updateAnimationModifier('m1', { enabled: false, params: { strength: 0.5 } });

      const state = useProjectStore.getState();
      expect(state.project.animationModifiers[0].enabled).toBe(false);
    });

    it('deleteAnimationModifier removes modifier', () => {
      resetStore({
        ...makeEmptyProject(),
        animationModifiers: [
          { id: 'm1', name: 'A', presetId: 'builtin.idleBreathing', presetVersion: 1, enabled: true, order: 0, scope: 'project', category: 'loop', driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'easeInOutSine' }, bindings: {}, outputs: [], params: {} },
          { id: 'm2', name: 'B', presetId: 'builtin.idleBreathing', presetVersion: 1, enabled: true, order: 1, scope: 'project', category: 'loop', driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'easeInOutSine' }, bindings: {}, outputs: [], params: {} },
        ],
      });

      useProjectStore.getState().deleteAnimationModifier('m1');

      const state = useProjectStore.getState();
      expect(state.project.animationModifiers).toHaveLength(1);
      expect(state.project.animationModifiers[0].id).toBe('m2');
    });

    it('reorderAnimationModifiers sets order deterministically', () => {
      resetStore({
        ...makeEmptyProject(),
        animationModifiers: [
          { id: 'm1', name: 'A', presetId: 'builtin.idleBreathing', presetVersion: 1, enabled: true, order: 0, scope: 'project', category: 'loop', driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'easeInOutSine' }, bindings: {}, outputs: [], params: {} },
          { id: 'm2', name: 'B', presetId: 'builtin.idleBreathing', presetVersion: 1, enabled: true, order: 1, scope: 'project', category: 'loop', driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'easeInOutSine' }, bindings: {}, outputs: [], params: {} },
          { id: 'm3', name: 'C', presetId: 'builtin.idleBreathing', presetVersion: 1, enabled: true, order: 2, scope: 'project', category: 'loop', driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'easeInOutSine' }, bindings: {}, outputs: [], params: {} },
        ],
      });

      useProjectStore.getState().reorderAnimationModifiers(['m3', 'm1', 'm2']);

      const state = useProjectStore.getState();
      expect(state.project.animationModifiers.map(m => m.id)).toEqual(['m3', 'm1', 'm2']);
      expect(state.project.animationModifiers.map(m => m.order)).toEqual([0, 1, 2]);
    });

    it('duplicateAnimationModifier deep clones with new id and Copy suffix', () => {
      resetStore({
        ...makeEmptyProject(),
        animationModifiers: [{
          id: 'm1', name: 'Idle Breathing', presetId: 'builtin.idleBreathing',
          presetVersion: 1, enabled: true, order: 0, scope: 'project',
          category: 'loop',
          driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'easeInOutSine' },
          bindings: { chest: { role: 'chest', required: true, target: 'handle', weight: 1 } },
          outputs: [{ kind: 'blendShapeValue', targetId: 'chest-1', property: '', blendMode: 'add' }],
          params: { strength: 1 },
        }],
      });

      useProjectStore.getState().duplicateAnimationModifier('m1');

      const state = useProjectStore.getState();
      expect(state.project.animationModifiers).toHaveLength(2);
      const copy = state.project.animationModifiers.find(m => m.id !== 'm1');
      expect(copy).toBeDefined();
      expect(copy.name).toBe('Idle Breathing Copy');
      expect(copy.presetId).toBe('builtin.idleBreathing');
      expect(copy.driver).toEqual({ kind: 'time', periodMs: 2400, phase: 0, curve: 'easeInOutSine' });
      expect(copy.bindings).toEqual({ chest: { role: 'chest', required: true, target: 'handle', weight: 1 } });
      expect(copy.outputs).toEqual([{ kind: 'blendShapeValue', targetId: 'chest-1', property: '', blendMode: 'add' }]);
      expect(copy.params).toEqual({ strength: 1 });
      expect(state.project.animationModifiers.map(m => m.order)).toEqual([0, 1]);
    });

    it('duplicateAnimationModifier is no-op for missing id', () => {
      useProjectStore.getState().duplicateAnimationModifier('nonexistent');
      expect(useProjectStore.getState().project.animationModifiers).toHaveLength(0);
    });
  });

  describe('createIdleBreathingMotion', () => {
    it('creates handles, blendShape, and modifier in one transaction', () => {
      resetStore(makeProjectWithChest());

      const result = useProjectStore.getState().createIdleBreathingMotion({ chestNodeId: 'chest-1' });

      expect(result.changed).toBe(true);
      expect(result.error).toBeUndefined();

      const state = useProjectStore.getState();
      expect(state.project.controlHandles.length).toBeGreaterThan(0);
      expect(state.project.animationModifiers.length).toBeGreaterThan(0);

      const chestNode = state.project.nodes.find(n => n.id === 'chest-1');
      expect(chestNode.blendShapes.length).toBeGreaterThan(0);
      expect(chestNode.blendShapeValues).toBeDefined();
      expect(chestNode.blendShapeValues[chestNode.blendShapes[0].id]).toBe(0);

      const modifier = state.project.animationModifiers[0];
      expect(modifier.presetId).toBe('builtin.idleBreathing');
      expect(modifier.enabled).toBe(true);

      expect(state.hasUnsavedChanges).toBe(true);
      expect(undoCount()).toBe(1);
    });

    it('returns error for invalid chest node', () => {
      resetStore(makeProjectWithChest());

      const result = useProjectStore.getState().createIdleBreathingMotion({ chestNodeId: 'nonexistent' });

      expect(result.changed).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not found');

      const state = useProjectStore.getState();
      expect(state.project.controlHandles).toHaveLength(0);
      expect(state.project.animationModifiers).toHaveLength(0);
      expect(state.hasUnsavedChanges).toBe(false);
    });

    it('returns error when no chestNodeId provided', () => {
      const result = useProjectStore.getState().createIdleBreathingMotion({});

      expect(result.changed).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('clip-scoped modifier cleanup on clip delete', () => {
    it('removes clip-scoped modifiers when its clip is deleted', () => {
      const project = makeEmptyProject();
      project.animations.push({ id: 'clip-a', name: 'A', duration: 1000, fps: 24, tracks: [] });
      project.animations.push({ id: 'clip-b', name: 'B', duration: 1000, fps: 24, tracks: [] });
      project.animationModifiers = [
        {
          id: 'm1', name: 'Clip A Motion', presetId: 'builtin.idleBreathing',
          presetVersion: 1, enabled: true, order: 0, scope: 'clip', clipId: 'clip-a',
          category: 'loop',
          driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'easeInOutSine' },
          bindings: {}, outputs: [], params: {},
        },
        {
          id: 'm2', name: 'Project Motion', presetId: 'builtin.idleBreathing',
          presetVersion: 1, enabled: true, order: 1, scope: 'project',
          category: 'loop',
          driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'easeInOutSine' },
          bindings: {}, outputs: [], params: {},
        },
        {
          id: 'm3', name: 'Clip B Motion', presetId: 'builtin.idleBreathing',
          presetVersion: 1, enabled: true, order: 2, scope: 'clip', clipId: 'clip-b',
          category: 'loop',
          driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'easeInOutSine' },
          bindings: {}, outputs: [], params: {},
        },
      ];
      resetStore(project);

      useProjectStore.getState().deleteAnimationClip('clip-a');

      const modifiers = useProjectStore.getState().project.animationModifiers;
      expect(modifiers.find(m => m.id === 'm1')).toBeUndefined();
      expect(modifiers.find(m => m.id === 'm2')).toBeDefined();
      expect(modifiers.find(m => m.id === 'm3')).toBeDefined();
    });

    it('keeps project-scoped modifiers when any clip is deleted', () => {
      const project = makeEmptyProject();
      project.animations.push({ id: 'clip-a', name: 'A', duration: 1000, fps: 24, tracks: [] });
      project.animationModifiers = [
        {
          id: 'm1', name: 'Project Motion', presetId: 'builtin.idleBreathing',
          presetVersion: 1, enabled: true, order: 0, scope: 'project',
          category: 'loop',
          driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'easeInOutSine' },
          bindings: {}, outputs: [], params: {},
        },
      ];
      resetStore(project);

      useProjectStore.getState().deleteAnimationClip('clip-a');

      const modifiers = useProjectStore.getState().project.animationModifiers;
      expect(modifiers).toHaveLength(1);
      expect(modifiers[0].id).toBe('m1');
    });
  });

  describe('createHeadCheekJiggleMotion', () => {
    function makeProjectWithFace() {
      const project = makeEmptyProject();
      project.bones.push({
        id: 'head-bone',
        name: 'Head',
        parentId: null,
        setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 50, shearX: 0, shearY: 0 },
      });
      project.nodes.push({
        id: 'face-1',
        type: 'part',
        name: 'Face',
        parent: null,
        transform: { x: 200, y: 150, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
        draw_order: 0,
        opacity: 1,
        visible: true,
        mesh: {
          vertices: [
            { x: 0, y: 0, restX: 0, restY: 0 },
            { x: 60, y: 0, restX: 60, restY: 0 },
            { x: 60, y: 60, restX: 60, restY: 60 },
            { x: 0, y: 60, restX: 0, restY: 60 },
          ],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          triangles: [[0, 1, 2], [0, 2, 3]],
          edgeIndices: [0, 1, 2, 3],
        },
      });
      project.animations.push({
        id: 'anim-1',
        name: 'Idle',
        duration: 2000,
        fps: 24,
        tracks: [],
      });
      return project;
    }

    it('creates blendShape and modifier for valid bone and face with mesh', () => {
      resetStore(makeProjectWithFace());
      const result = useProjectStore.getState().createHeadCheekJiggleMotion({
        sourceBoneId: 'head-bone',
        faceNodeId: 'face-1',
      });
      expect(result.changed).toBe(true);
      expect(result.error).toBeUndefined();

      const state = useProjectStore.getState();
      expect(state.project.controlHandles.length).toBeGreaterThan(0);
      expect(state.project.animationModifiers.length).toBe(1);

      const modifier = state.project.animationModifiers[0];
      expect(modifier.category).toBe('reaction');
      expect(modifier.driver.kind).toBe('boneMotion');
      expect(modifier.driver.sourceBoneId).toBe('head-bone');
      expect(modifier.bindings.sourceBone).toBeDefined();
      expect(modifier.bindings.facePart).toBeDefined();
      expect(modifier.bindings.cheekArea).toBeDefined();
      expect(modifier.outputs.some(output => output.kind === 'meshDelta')).toBe(true);

      const faceNode = state.project.nodes.find(n => n.id === 'face-1');
      expect(faceNode.blendShapes.length).toBe(1);
      expect(faceNode.blendShapes[0].name).toBe('Cheek Jiggle');
      expect(faceNode.blendShapeValues[faceNode.blendShapes[0].id]).toBe(0);

      expect(state.hasUnsavedChanges).toBe(true);
    });

    it('returns error for missing source bone', () => {
      resetStore(makeProjectWithFace());
      const result = useProjectStore.getState().createHeadCheekJiggleMotion({
        sourceBoneId: 'nonexistent',
        faceNodeId: 'face-1',
      });
      expect(result.changed).toBe(false);
      expect(result.error).toBeDefined();

      const state = useProjectStore.getState();
      expect(state.project.animationModifiers.length).toBe(0);
    });

    it('returns error for missing mesh on face part', () => {
      const project = makeProjectWithFace();
      project.nodes.find(n => n.id === 'face-1').mesh = undefined;
      resetStore(project);
      const result = useProjectStore.getState().createHeadCheekJiggleMotion({
        sourceBoneId: 'head-bone',
        faceNodeId: 'face-1',
      });
      expect(result.changed).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('bakeAnimationModifierToKeyframes', () => {
    it('returns error when modifier not found', () => {
      resetStore(makeProjectWithChest());
      const result = useProjectStore.getState().bakeAnimationModifierToKeyframes({
        modifierId: 'nonexistent', animationId: 'anim-1',
      });
      expect(result.changed).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns error when animation not found', () => {
      const project = makeProjectWithChest();
      project.animationModifiers = [{
        id: 'm1', name: 'Idle Breathing', presetId: 'builtin.idleBreathing',
        presetVersion: 1, enabled: true, order: 0, scope: 'project',
        category: 'loop',
        driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'sine' },
        bindings: {}, outputs: [
          { kind: 'blendShapeValue', targetId: 'chest-1', property: 'bs1', blendMode: 'add' },
        ],
        params: { strength: 1, bs1: 1 },
      }];
      project.nodes.find(n => n.id === 'chest-1').blendShapes = [{ id: 'bs1', name: 'Breath', deltas: [] }];
      project.nodes.find(n => n.id === 'chest-1').blendShapeValues = { bs1: 0 };
      resetStore(project);

      const result = useProjectStore.getState().bakeAnimationModifierToKeyframes({
        modifierId: 'm1', animationId: 'nonexistent',
      });
      expect(result.changed).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('creates keyframes and disables modifier by default', () => {
      const project = makeProjectWithChest();
      project.animationModifiers = [{
        id: 'm1', name: 'Idle Breathing', presetId: 'builtin.idleBreathing',
        presetVersion: 1, enabled: true, order: 0, scope: 'project',
        category: 'loop',
        driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'sine' },
        bindings: {}, outputs: [
          { kind: 'blendShapeValue', targetId: 'chest-1', property: 'bs1', blendMode: 'add' },
        ],
        params: { strength: 1, bs1: 1 },
      }];
      project.nodes.find(n => n.id === 'chest-1').blendShapes = [{ id: 'bs1', name: 'Breath', deltas: [] }];
      project.nodes.find(n => n.id === 'chest-1').blendShapeValues = { bs1: 0 };
      resetStore(project);

      const result = useProjectStore.getState().bakeAnimationModifierToKeyframes({
        modifierId: 'm1', animationId: 'anim-1',
      });
      expect(result.changed).toBe(true);
      expect(result.count).toBeGreaterThan(0);

      const state = useProjectStore.getState();
      const mod = state.project.animationModifiers.find(m => m.id === 'm1');
      expect(mod.enabled).toBe(false);
      expect(mod.bake).toEqual({ clipped: true });

      const anim = state.project.animations.find(a => a.id === 'anim-1');
      const track = anim.tracks.find(t => t.property === 'blendShape:bs1');
      expect(track).toBeDefined();
      expect(track.keyframes.length).toBeGreaterThan(0);
      expect(state.hasUnsavedChanges).toBe(true);
    });

    it('keeps modifier enabled when mode is keep-live', () => {
      const project = makeProjectWithChest();
      project.animationModifiers = [{
        id: 'm1', name: 'Idle Breathing', presetId: 'builtin.idleBreathing',
        presetVersion: 1, enabled: true, order: 0, scope: 'project',
        category: 'loop',
        driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'sine' },
        bindings: {}, outputs: [
          { kind: 'blendShapeValue', targetId: 'chest-1', property: 'bs1', blendMode: 'add' },
        ],
        params: { strength: 1, bs1: 1 },
      }];
      project.nodes.find(n => n.id === 'chest-1').blendShapes = [{ id: 'bs1', name: 'Breath', deltas: [] }];
      project.nodes.find(n => n.id === 'chest-1').blendShapeValues = { bs1: 0 };
      resetStore(project);

      useProjectStore.getState().bakeAnimationModifierToKeyframes({
        modifierId: 'm1', animationId: 'anim-1', mode: 'keep-live',
      });
      const mod = useProjectStore.getState().project.animationModifiers.find(m => m.id === 'm1');
      expect(mod.enabled).toBe(true);
      expect(mod.bake).toEqual({ clipped: true });
    });

    it('returns error for non-time driver', () => {
      const project = makeProjectWithChest();
      project.animationModifiers = [{
        id: 'm1', name: 'Test', presetId: 'test', presetVersion: 1,
        enabled: true, order: 0, scope: 'project', category: 'loop',
        driver: { kind: 'reaction' },
        bindings: {}, outputs: [], params: {},
      }];
      resetStore(project);

      const result = useProjectStore.getState().bakeAnimationModifierToKeyframes({
        modifierId: 'm1', animationId: 'anim-1',
      });
      expect(result.changed).toBe(false);
      expect(result.error).toContain('Only time-driven');
    });
  });

  describe('resetProject clears auto motion arrays', () => {
    it('clears controlHandles and animationModifiers on reset', () => {
      resetStore({
        ...makeEmptyProject(),
        controlHandles: [{ id: 'h1', name: 'Chest', role: 'chest', space: 'node-local', target: { kind: 'part', id: 'chest-1' }, position: { x: 0, y: 0 } }],
        animationModifiers: [{ id: 'm1', name: 'A', presetId: 'builtin.idleBreathing', presetVersion: 1, enabled: true, order: 0, scope: 'project', category: 'loop', driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'easeInOutSine' }, bindings: {}, outputs: [], params: {} }],
      });

      useProjectStore.getState().resetProject();

      const state = useProjectStore.getState();
      expect(state.project.controlHandles).toEqual([]);
      expect(state.project.animationModifiers).toEqual([]);
      expect(state.hasUnsavedChanges).toBe(false);
    });
  });
});
