import { describe, it, expect, vi } from 'vitest';
import { buildFramePose } from '@/features/canvas/domain/framePose.js';
import { syncEffectiveMeshFrames } from '@/features/canvas/application/syncEffectiveMeshFrames.js';

function makeProject(extra = {}) {
  return {
    version: 6,
    canvas: { width: 200, height: 200, x: 0, y: 0, bgEnabled: false, bgColor: '#fff' },
    textures: [],
    nodes: [
      {
        id: 'bone-root',
        type: 'bone',
        parent: null,
        visible: true,
        opacity: 1,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
        setup: { x: 0, y: 0, rotation: 0, length: 100 },
      },
      {
        id: 'part-mesh-verts',
        type: 'part',
        parent: null,
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
      {
        id: 'part-skinning',
        type: 'part',
        parent: null,
        draw_order: 1,
        visible: true,
        opacity: 1,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
        mesh: {
          vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
          uvs: [0, 0, 1, 0],
          indices: [0, 1],
          influences: [
            [{ boneId: 'bone-root', weight: 1 }],
            [{ boneId: 'bone-root', weight: 1 }],
          ],
        },
      },
      {
        id: 'warp',
        type: 'warpDeformer',
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
        id: 'part-warp-child',
        type: 'part',
        parent: 'warp',
        draw_order: 2,
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
    bones: [
      {
        id: 'bone-root',
        parentId: null,
        setup: { x: 0, y: 0, rotation: 0, length: 100 },
      },
    ],
    slots: [],
    attachments: [],
    skins: [],
    constraints: [],
    defaultPose: {},
    physics_groups: [],
    physicsRules: [],
    libraryFolders: [],
    assetPlacements: [],
    animations: [
      {
        id: 'anim',
        name: 'Anim',
        duration: 1000,
        fps: 30,
        tracks: [
          {
            targetId: 'part-mesh-verts',
            property: 'mesh_verts',
            keyframes: [
              { time: 0, value: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] },
              { time: 1000, value: [{ x: 0, y: 0 }, { x: 140, y: 0 }, { x: 140, y: 100 }, { x: 0, y: 100 }] },
            ],
          },
          {
            targetId: 'bone-root',
            property: 'rotation',
            keyframes: [
              { time: 0, value: 0 },
              { time: 1000, value: 90 },
            ],
          },
          {
            targetId: 'warp',
            property: 'mesh_verts',
            keyframes: [
              { time: 0, value: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }] },
              { time: 1000, value: [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 0, y: 100 }, { x: 120, y: 100 }] },
            ],
          },
        ],
      },
    ],
    ...extra,
  };
}

describe('effective mesh render path', () => {
  it('uploads animated mesh_verts as GPU positions', () => {
    const project = makeProject();
    const gateway = { uploadPositions: vi.fn() };

    const framePose = buildFramePose({
      project,
      editorState: { editorMode: 'animation', activeTool: 'select' },
      animationState: { activeAnimationId: 'anim', currentTime: 1000, isPlaying: false },
    });

    syncEffectiveMeshFrames({ gateway, project, effectiveMeshes: framePose.effectiveMeshes, previousIds: new Set() });

    const meshVertsFrame = framePose.effectiveMeshes.get('part-mesh-verts');
    expect(meshVertsFrame.vertices[1]).toEqual({ x: 140, y: 0 });
    expect(gateway.uploadPositions).toHaveBeenCalledWith(
      'part-mesh-verts',
      meshVertsFrame.vertices,
      meshVertsFrame.uvs,
    );
  });

  it('uploads skinned vertices as GPU positions when bones move', () => {
    const project = makeProject();
    const gateway = { uploadPositions: vi.fn() };

    const framePose = buildFramePose({
      project,
      editorState: { editorMode: 'animation', activeTool: 'select' },
      animationState: { activeAnimationId: 'anim', currentTime: 1000, isPlaying: false },
    });

    syncEffectiveMeshFrames({ gateway, project, effectiveMeshes: framePose.effectiveMeshes, previousIds: new Set() });

    const skinningFrame = framePose.effectiveMeshes.get('part-skinning');
    expect(skinningFrame.vertices[0].x).toBeCloseTo(0, 5);
    expect(skinningFrame.vertices[0].y).toBeCloseTo(0, 5);
    expect(skinningFrame.vertices[1].x).toBeCloseTo(0, 5);
    expect(skinningFrame.vertices[1].y).toBeCloseTo(100, 5);
    expect(gateway.uploadPositions).toHaveBeenCalledWith(
      'part-skinning',
      skinningFrame.vertices,
      skinningFrame.uvs,
    );
  });

  it('skins mesh with normalized multi-bone influences after weight operations (G5)', () => {
    const project = makeProject();
    const skinNode = project.nodes.find(n => n.id === 'part-skinning');
    project.bones.push({
      id: 'bone-child',
      parentId: 'bone-root',
      setup: { x: 0, y: 0, rotation: 0, length: 50 },
    });
    skinNode.mesh.influences = [
      [{ boneId: 'bone-root', weight: 0.7 }, { boneId: 'bone-child', weight: 0.3 }],
      [{ boneId: 'bone-root', weight: 0.3 }, { boneId: 'bone-child', weight: 0.7 }],
    ];

    const gateway = { uploadPositions: vi.fn() };

    const framePose = buildFramePose({
      project,
      editorState: { editorMode: 'animation', activeTool: 'select' },
      animationState: { activeAnimationId: 'anim', currentTime: 1000, isPlaying: false },
    });

    syncEffectiveMeshFrames({ gateway, project, effectiveMeshes: framePose.effectiveMeshes, previousIds: new Set() });

    const skinningFrame = framePose.effectiveMeshes.get('part-skinning');
    expect(skinningFrame.vertices).toHaveLength(2);
    expect(skinningFrame.vertices[0].x).toBeCloseTo(0, 5);
    expect(skinningFrame.vertices[0].y).toBeCloseTo(0, 5);
    expect(gateway.uploadPositions).toHaveBeenCalledWith(
      'part-skinning',
      skinningFrame.vertices,
      skinningFrame.uvs,
    );
  });

  it('weight paint UI settings do not affect runtime effective mesh (G5)', () => {
    const project = makeProject();
    const skinNode = project.nodes.find(n => n.id === 'part-skinning');
    skinNode.mesh.influences = [
      [{ boneId: 'bone-root', weight: 1 }],
      [{ boneId: 'bone-root', weight: 1 }],
    ];

    const gateway = { uploadPositions: vi.fn() };

    const baseFrame = buildFramePose({
      project,
      editorState: { editorMode: 'animation', activeTool: 'select' },
      animationState: { activeAnimationId: 'anim', currentTime: 1000, isPlaying: false },
    });

    syncEffectiveMeshFrames({ gateway, project, effectiveMeshes: baseFrame.effectiveMeshes, previousIds: new Set() });
    const basePositions = baseFrame.effectiveMeshes.get('part-skinning').vertices.map(v => ({ x: v.x, y: v.y }));

    const frameWithSettings = buildFramePose({
      project,
      editorState: {
        editorMode: 'animation',
        activeTool: 'select',
        weightPaintBrushMode: 'smooth',
        weightPaintStrength: 0.8,
        weightPaintTargetValue: 0.5,
      },
      animationState: { activeAnimationId: 'anim', currentTime: 1000, isPlaying: false },
    });

    syncEffectiveMeshFrames({ gateway, project, effectiveMeshes: frameWithSettings.effectiveMeshes, previousIds: new Set() });
    const settingsPositions = frameWithSettings.effectiveMeshes.get('part-skinning').vertices.map(v => ({ x: v.x, y: v.y }));

    expect(basePositions).toEqual(settingsPositions);
  });

  it('uploads warp-deformed child vertices as GPU positions', () => {
    const project = makeProject();
    const gateway = { uploadPositions: vi.fn() };

    const framePose = buildFramePose({
      project,
      editorState: { editorMode: 'animation', activeTool: 'select' },
      animationState: { activeAnimationId: 'anim', currentTime: 1000, isPlaying: false },
    });

    syncEffectiveMeshFrames({ gateway, project, effectiveMeshes: framePose.effectiveMeshes, previousIds: new Set() });

    const warpChildFrame = framePose.effectiveMeshes.get('part-warp-child');
    expect(warpChildFrame.vertices[1].x).toBeCloseTo(120, 5);
    expect(gateway.uploadPositions).toHaveBeenCalledWith(
      'part-warp-child',
      warpChildFrame.vertices,
      warpChildFrame.uvs,
    );
  });
});
