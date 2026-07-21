import { describe, it, expect } from 'vitest';
import { evaluateEditorFramePose } from '@/features/canvas/application/evaluateEditorFramePose.js';

function makeProject(overrides = {}) {
  return {
    version: 7,
    canvas: { width: 100, height: 100, x: 0, y: 0, bgEnabled: false, bgColor: '#fff' },
    textures: [],
    nodes: [
      {
        id: 'chest',
        type: 'part',
        name: 'Chest',
        parent: null,
        draw_order: 0,
        visible: true,
        opacity: 1,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
        mesh: { vertices: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }] },
        blendShapes: [{ id: 'breathe', deltas: [{ dx: 1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 1, dy: 0 }] }],
        blendShapeValues: {},
      },
    ],
    bones: [],
    slots: [],
    attachments: [],
    skins: [],
    constraints: [],
    defaultPose: {},
    physics_groups: [],
    physicsRules: [],
    libraryFolders: [],
    assetPlacements: [],
    animations: [],
    controlHandles: [],
    animationModifiers: [{
      id: 'mod1',
      name: 'Idle Breathing',
      presetId: 'builtin.idleBreathing',
      presetVersion: 1,
      enabled: true,
      muted: false,
      order: 0,
      category: 'loop',
      scope: 'project',
      driver: { kind: 'time', periodMs: 2000, phase: 0, curve: 'easeInOutSine' },
      bindings: [{ role: 'chest', target: 'handle', targetId: 'h1', required: true }],
      outputs: [{
        kind: 'blendShapeValue',
        targetId: 'chest',
        property: 'breathe',
        weight: 1,
      }],
      params: { strength: 1, breathe: 1 },
    }],
    ...overrides,
  };
}

describe('evaluateEditorFramePose modifier integration', () => {
  it('evaluates modifiers and includes overrides in pose when modifiers active', () => {
    const project = makeProject();
    const out = evaluateEditorFramePose({
      project,
      editorState: { editorMode: 'staging' },
      animationState: { draftPose: new Map() },
      physicsRuntime: null,
      timestamp: 500,
    });
    const pose = out.poseOverrides;
    expect(pose).not.toBeNull();
    const chestOverrides = pose.get('chest');
    expect(chestOverrides).toBeDefined();
    expect(chestOverrides['blendShape:breathe']).toBeGreaterThan(0);
    expect(chestOverrides['blendShape:breathe']).toBeLessThanOrEqual(1);
  });

  it('animation mode uses currentTime for modifier evaluation', () => {
    const project = makeProject();
    const out = evaluateEditorFramePose({
      project,
      editorState: { editorMode: 'animation' },
      animationState: { activeAnimationId: 'anim1', currentTime: 1000, draftPose: new Map() },
      physicsRuntime: null,
      timestamp: 9999,
    });
    const chestOverrides = out.poseOverrides.get('chest');
    expect(chestOverrides['blendShape:breathe']).toBeGreaterThan(0);
  });

  it('no modifiers produces unchanged frame with no modifier overrides', () => {
    const project = makeProject({ animationModifiers: [] });
    const out = evaluateEditorFramePose({
      project,
      editorState: { editorMode: 'staging' },
      animationState: { draftPose: new Map() },
      physicsRuntime: null,
      timestamp: 500,
    });
    const chestOverrides = out.poseOverrides?.get('chest');
    expect(chestOverrides?.['blendShape:breathe']).toBeUndefined();
  });

  it('disabled modifier produces no blendShape override', () => {
    const project = makeProject({
      animationModifiers: [{
        ...makeProject().animationModifiers[0],
        enabled: false,
      }],
    });
    const out = evaluateEditorFramePose({
      project,
      editorState: { editorMode: 'staging' },
      animationState: { draftPose: new Map() },
      physicsRuntime: null,
      timestamp: 500,
    });
    const chestOverrides = out.poseOverrides?.get('chest');
    expect(chestOverrides?.['blendShape:breathe']).toBeUndefined();
  });

  it('clip-scoped modifier for non-matching clip produces no override', () => {
    const project = makeProject({
      animationModifiers: [{
        ...makeProject().animationModifiers[0],
        scope: 'clip',
        clipId: 'clipA',
      }],
    });
    const out = evaluateEditorFramePose({
      project,
      editorState: { editorMode: 'animation' },
      animationState: { activeAnimationId: 'clipB', currentTime: 500, draftPose: new Map() },
      physicsRuntime: null,
      timestamp: 500,
    });
    const chestOverrides = out.poseOverrides?.get('chest');
    expect(chestOverrides?.['blendShape:breathe']).toBeUndefined();
  });

  it('same project/time produces same overrides (deterministic)', () => {
    const project = makeProject();
    const out1 = evaluateEditorFramePose({
      project,
      editorState: { editorMode: 'staging' },
      animationState: { draftPose: new Map() },
      physicsRuntime: null,
      timestamp: 750,
    });
    const out2 = evaluateEditorFramePose({
      project,
      editorState: { editorMode: 'staging' },
      animationState: { draftPose: new Map() },
      physicsRuntime: null,
      timestamp: 750,
    });
    const v1 = out1.poseOverrides.get('chest')['blendShape:breathe'];
    const v2 = out2.poseOverrides.get('chest')['blendShape:breathe'];
    expect(v1).toBe(v2);
  });

  it('draft pose overrides modifier for same property', () => {
    const project = makeProject();
    const out = evaluateEditorFramePose({
      project,
      editorState: { editorMode: 'staging' },
      animationState: {
        draftPose: new Map([['chest', { 'blendShape:breathe': 0 }]]),
      },
      physicsRuntime: null,
      timestamp: 500,
    });
    expect(out.poseOverrides.get('chest')['blendShape:breathe']).toBe(0);
  });

  it('reaction modifier produces override from bone motion', () => {
    const project = makeProject();
    project.bones = [
      { id: 'headBone', name: 'Head', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 50 } },
    ];
    project.animationModifiers = [{
      id: 'mod-reaction', name: 'Cheek Jiggle', presetId: 'builtin.cheekJiggle', presetVersion: 1,
      enabled: true, muted: false, order: 1, category: 'reaction', scope: 'project',
      driver: { kind: 'boneMotion', sourceBoneId: 'headBone', axes: ['x', 'y'], gain: 0.1 },
      bindings: {},
      outputs: [{ kind: 'blendShapeValue', targetId: 'chest', property: 'breathe' }],
      params: { strength: 1, breathe: 1 },
    }];
    const out = evaluateEditorFramePose({
      project,
      editorState: { editorMode: 'staging' },
      animationState: { draftPose: new Map() },
      physicsRuntime: null,
      timestamp: 500,
    });
    expect(out.poseOverrides).not.toBeNull();
  });

  it('reaction modifier with missing source bone does not crash', () => {
    const project = makeProject();
    project.bones = [];
    project.animationModifiers = [{
      id: 'mod-reaction', name: 'Cheek Jiggle', presetId: 'builtin.cheekJiggle', presetVersion: 1,
      enabled: true, muted: false, order: 1, category: 'reaction', scope: 'project',
      driver: { kind: 'boneMotion', sourceBoneId: 'nonexistent', axes: ['x'], gain: 1 },
      bindings: {},
      outputs: [{ kind: 'blendShapeValue', targetId: 'chest', property: 'breathe' }],
      params: { strength: 1, breathe: 1 },
    }];
    const out = evaluateEditorFramePose({
      project,
      editorState: { editorMode: 'staging' },
      animationState: { draftPose: new Map() },
      physicsRuntime: null,
      timestamp: 500,
    });
    expect(out.effectiveNodes).toBeDefined();
  });

  it('combined time and reaction modifiers produce merged overrides', () => {
    const project = makeProject();
    project.bones = [
      { id: 'headBone', name: 'Head', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 50 } },
    ];
    project.animationModifiers = [
      {
        ...makeProject().animationModifiers[0],
        id: 'mod-time', order: 0,
      },
      {
        id: 'mod-reaction', name: 'Cheek Jiggle', presetId: 'builtin.cheekJiggle', presetVersion: 1,
        enabled: true, muted: false, order: 1, category: 'reaction', scope: 'project',
        driver: { kind: 'boneMotion', sourceBoneId: 'headBone', axes: ['y'], gain: 0.2 },
        bindings: {},
        outputs: [{ kind: 'blendShapeValue', targetId: 'chest', property: 'breathe' }],
        params: { strength: 1, breathe: 1 },
      },
    ];
    const out = evaluateEditorFramePose({
      project,
      editorState: { editorMode: 'staging' },
      animationState: { draftPose: new Map() },
      physicsRuntime: null,
      timestamp: 500,
    });
    expect(out.effectiveNodes).toBeDefined();
    expect(out.effectiveBones).toBeDefined();
  });

  it('same project/time produces same overrides with reaction modifier (deterministic)', () => {
    const project = makeProject();
    project.bones = [
      { id: 'headBone', name: 'Head', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 50 } },
    ];
    project.animationModifiers = [{
      id: 'mod-reaction', name: 'Cheek Jiggle', presetId: 'builtin.cheekJiggle', presetVersion: 1,
      enabled: true, muted: false, order: 1, category: 'reaction', scope: 'project',
      driver: { kind: 'boneMotion', sourceBoneId: 'headBone', axes: ['x'], gain: 0.1 },
      bindings: {},
      outputs: [{ kind: 'blendShapeValue', targetId: 'chest', property: 'breathe' }],
      params: { strength: 1, breathe: 1 },
    }];
    const out1 = evaluateEditorFramePose({
      project, editorState: { editorMode: 'staging' },
      animationState: { draftPose: new Map() },
      physicsRuntime: null, timestamp: 750,
    });
    const out2 = evaluateEditorFramePose({
      project, editorState: { editorMode: 'staging' },
      animationState: { draftPose: new Map() },
      physicsRuntime: null, timestamp: 750,
    });
    const v1 = out1.poseOverrides.get('chest')?.['blendShape:breathe'];
    const v2 = out2.poseOverrides.get('chest')?.['blendShape:breathe'];
    expect(v1).toBe(v2);
  });

  it('time modifiers without boneMotion still work after reaction pass', () => {
    const project = makeProject();
    project.bones = [];
    const out = evaluateEditorFramePose({
      project, editorState: { editorMode: 'staging' },
      animationState: { draftPose: new Map() },
      physicsRuntime: null, timestamp: 500,
    });
    const chestOverrides = out.poseOverrides.get('chest');
    expect(chestOverrides).toBeDefined();
    expect(chestOverrides['blendShape:breathe']).toBeGreaterThan(0);
  });

  it('capture consistency: uses currentTime from animationStateOverride', () => {
    const project = makeProject();
    const out = evaluateEditorFramePose({
      project,
      editorState: { editorMode: 'animation' },
      animationState: {
        activeAnimationId: 'captureAnim',
        currentTime: 1000,
        draftPose: undefined,
        isPlaying: false,
      },
      physicsRuntime: null,
      timestamp: 0,
    });
    const chestOverrides = out.poseOverrides.get('chest');
    expect(chestOverrides['blendShape:breathe']).toBeGreaterThan(0.3);
    expect(chestOverrides['blendShape:breathe']).toBeLessThan(0.8);
  });
});
