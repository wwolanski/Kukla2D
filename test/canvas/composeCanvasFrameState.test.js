import { describe, expect, it } from 'vitest';
import { applyWarpDeformerOverrides, composeCanvasFrameState } from '@/features/canvas/application/composeCanvasFrameState.js';

function makeProject() {
  return {
    version: 6,
    canvas: { width: 100, height: 100, x: 0, y: 0, bgEnabled: false, bgColor: '#fff' },
    textures: [],
    nodes: [
      {
        id: 'warp',
        type: 'warpDeformer',
        name: 'Warp',
        parent: null,
        visible: true,
        opacity: 1,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
        col: 1,
        row: 1,
        gridX: 0,
        gridY: 0,
        gridW: 100,
        gridH: 100,
      },
      {
        id: 'part',
        type: 'part',
        name: 'Part',
        parent: 'warp',
        draw_order: 0,
        visible: true,
        opacity: 1,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
        mesh: {
          vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          indices: [0, 1, 2, 0, 2, 3],
        },
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
    animations: [{
      id: 'anim',
      name: 'Anim',
      duration: 1000,
      fps: 30,
      tracks: [{
        targetId: 'warp',
        property: 'mesh_verts',
        keyframes: [
          {
            time: 0,
            value: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }],
          },
          {
            time: 1000,
            value: [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 0, y: 100 }, { x: 120, y: 100 }],
          },
        ],
      }],
    }],
  };
}

function composeAt(timeMs) {
  return composeCanvasFrameState({
    project: makeProject(),
    editorState: { activeTool: 'mesh', editorMode: 'animation' },
    animationState: { activeAnimationId: 'anim', currentTime: timeMs, isPlaying: false },
    physicsRuntime: null,
    timestamp: timeMs,
  });
}

describe('composeCanvasFrameState', () => {
  it('applies animated warp deformer overrides without a second RAF-only pipeline', () => {
    const frame0 = composeAt(0);
    const frame1000 = composeAt(1000);

    expect(frame0.poseOverrides.get('part').mesh_verts[1]).toEqual({ x: 100, y: 0 });
    expect(frame1000.poseOverrides.get('part').mesh_verts[1]).toEqual({ x: 120, y: 0 });
    expect(frame1000.effectiveNodes.find(node => node.id === 'part').id).toBe('part');
  });

  it('includes modifier blendShape overrides in composed frame state', () => {
  const project = makeProject();
  project.animationModifiers = [{
    id: 'mod1',
    name: 'Test Modifier',
    presetId: 'test',
    presetVersion: 1,
    enabled: true,
    muted: false,
    order: 0,
    category: 'loop',
    scope: 'project',
    driver: { kind: 'time', periodMs: 2000, phase: 0, curve: 'easeInOutSine' },
    bindings: [],
    outputs: [{
      kind: 'blendShapeValue',
      targetId: 'part',
      property: 'breathe',
      weight: 1,
    }],
    params: { strength: 1, breathe: 1 },
  }];
  project.nodes[1].blendShapes = [{ id: 'breathe', deltas: [{ dx: 1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 1, dy: 0 }] }];
  project.nodes[1].blendShapeValues = {};

  const frame = composeCanvasFrameState({
    project,
    editorState: { activeTool: 'mesh', editorMode: 'animation' },
    animationState: { activeAnimationId: 'anim', currentTime: 500, isPlaying: false, draftPose: new Map() },
    physicsRuntime: null,
    timestamp: 0,
  });

  const partOverrides = frame.poseOverrides?.get('part');
  expect(partOverrides).toBeDefined();
  expect(partOverrides['blendShape:breathe']).toBeGreaterThan(0);
});

it('uses live timestamp for loop modifiers in staging mode', () => {
  const project = makeProject();
  project.animationModifiers = [{
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
    bindings: {},
    outputs: [{
      kind: 'blendShapeValue',
      targetId: 'part',
      property: 'breathe',
      blendMode: 'add',
    }],
    params: { strength: 1, breathe: 1 },
  }];
  project.nodes[1].blendShapes = [{ id: 'breathe', deltas: [{ dx: 1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 1, dy: 0 }] }];
  project.nodes[1].blendShapeValues = {};

  const frame = composeCanvasFrameState({
    project,
    editorState: { activeTool: 'select', editorMode: 'staging' },
    animationState: { activeAnimationId: null, currentTime: 0, isPlaying: false, draftPose: new Map() },
    physicsRuntime: null,
    timestamp: 500,
  });

  expect(frame.poseOverrides?.get('part')?.['blendShape:breathe']).toBeGreaterThan(0);
});

it('uses timeline currentTime for loop modifiers in animation mode', () => {
  const project = makeProject();
  project.animationModifiers = [{
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
    bindings: {},
    outputs: [{
      kind: 'blendShapeValue',
      targetId: 'part',
      property: 'breathe',
      blendMode: 'add',
    }],
    params: { strength: 1, breathe: 1 },
  }];
  project.nodes[1].blendShapes = [{ id: 'breathe', deltas: [{ dx: 1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 1, dy: 0 }] }];
  project.nodes[1].blendShapeValues = {};

  const frame = composeCanvasFrameState({
    project,
    editorState: { activeTool: 'select', editorMode: 'animation' },
    animationState: { activeAnimationId: 'anim', currentTime: 0, isPlaying: false, draftPose: new Map() },
    physicsRuntime: null,
    timestamp: 500,
  });

  expect(frame.poseOverrides?.get('part')?.['blendShape:breathe']).toBeCloseTo(0, 5);
});

it('does not mutate input pose map and ignores malformed warp grids', () => {
    const project = makeProject();
    const originalPartVerts = [{ x: 5, y: 5 }, { x: 95, y: 5 }, { x: 95, y: 95 }, { x: 5, y: 95 }];
    const input = new Map([
      ['warp', { mesh_verts: [{ x: 0, y: 0 }] }],
      ['part', { mesh_verts: originalPartVerts }],
    ]);

    const output = applyWarpDeformerOverrides({ project, poseOverrides: input });

    expect(input.get('part').mesh_verts).toBe(originalPartVerts);
    expect(output).not.toBe(input);
    expect(output.get('part').mesh_verts).toEqual(originalPartVerts);
  });
});
