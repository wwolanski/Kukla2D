import { describe, it, expect, beforeEach } from 'vitest';
import '@/store/immerPatches.js';
import { applyPatches } from 'immer';
import { useProjectStore } from '@/store/projectStore';
import { clearHistory, undo, undoCount } from '@/store/undoHistory';
import {
  buildDeleteSelectionIntent,
  deletePartNodes,
  deleteBones,
  deleteConstraints,
} from '@/domain/deleteCommands';

function createTestProject() {
  return {
    version: 6,
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
  };
}

function resetStore(project) {
  clearHistory();
  useProjectStore.setState({
    project,
    versionControl: { geometryVersion: 0, transformVersion: 0, textureVersion: 0 },
    hasUnsavedChanges: false,
  });
}

function undoViaStore() {
  undo((patches) => {
    useProjectStore.getState().restoreProject(
      applyPatches(useProjectStore.getState(), patches),
    );
  });
}

describe('deleteCommands — part deletion (3A)', () => {
  it('preserves textures when deleting a part node', () => {
    const project = createTestProject();
    project.nodes.push({
      id: 'p1', type: 'part', name: 'Part 1', parent: null,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      draw_order: 0, opacity: 1, visible: true,
    });
    project.textures.push({ id: 'tex-1', source: 'part1.png' });
    project.assetPlacements = [{ assetId: 'tex-1', folderId: null }];

    const result = deletePartNodes(project, ['p1']);

    expect(result.changed).toBe(true);
    expect(project.nodes).toHaveLength(0);
    expect(project.textures).toHaveLength(1);
    expect(project.textures[0].id).toBe('tex-1');
    expect(project.assetPlacements).toHaveLength(1);
  });

  it('removes animation tracks targeting deleted node', () => {
    const project = createTestProject();
    project.nodes.push({
      id: 'p1', type: 'part', name: 'Part 1', parent: null,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      draw_order: 0, opacity: 1, visible: true,
    });
    project.nodes.push({
      id: 'p2', type: 'part', name: 'Part 2', parent: null,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      draw_order: 1, opacity: 1, visible: true,
    });
    project.animations.push({
      id: 'anim-1', name: 'Anim 1', duration: 2000, fps: 24,
      tracks: [
        { targetId: 'p1', property: 'x', keyframes: [{ time: 0, value: 0 }] },
        { targetId: 'p2', property: 'x', keyframes: [{ time: 0, value: 10 }] },
      ],
    });

    deletePartNodes(project, ['p1']);

    const anim = project.animations[0];
    expect(anim.tracks).toHaveLength(1);
    expect(anim.tracks[0].targetId).toBe('p2');
  });

  it('clears legacy bone.nodeId when its source image is deleted', () => {
    const project = createTestProject();
    project.nodes.push({
      id: 'p1', type: 'part', name: 'Part 1', parent: null,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      draw_order: 0, opacity: 1, visible: true,
    });
    project.bones.push({ id: 'b1', name: 'Bone', parentId: null, nodeId: 'p1', setup: {} });

    deletePartNodes(project, ['p1']);

    expect(project.bones[0].nodeId).toBeNull();
  });

  it('clears clipToPartId when target is deleted', () => {
    const project = createTestProject();
    project.nodes.push({
      id: 'p1', type: 'part', name: 'Part 1', parent: null,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      draw_order: 0, opacity: 1, visible: true,
    });
    project.nodes.push({
      id: 'p2', type: 'part', name: 'Part 2', parent: null,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      draw_order: 1, opacity: 1, visible: true,
      clipToPartId: 'p1',
    });

    deletePartNodes(project, ['p1']);

    expect(project.nodes[0].id).toBe('p2');
    expect(project.nodes[0].clipToPartId).toBeUndefined();
  });

  it('recursively deletes children', () => {
    const project = createTestProject();
    project.nodes.push(
      { id: 'g1', type: 'group', name: 'Group', parent: null, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, opacity: 1, visible: true },
      { id: 'p1', type: 'part', name: 'Child', parent: 'g1', transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, draw_order: 0, opacity: 1, visible: true },
    );

    deletePartNodes(project, ['g1']);

    expect(project.nodes).toHaveLength(0);
  });

  it('re-normalizes draw_order after deletion', () => {
    const project = createTestProject();
    project.nodes.push(
      { id: 'p1', type: 'part', name: 'P1', parent: null, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, draw_order: 0, opacity: 1, visible: true },
      { id: 'p2', type: 'part', name: 'P2', parent: null, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, draw_order: 1, opacity: 1, visible: true },
      { id: 'p3', type: 'part', name: 'P3', parent: null, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, draw_order: 2, opacity: 1, visible: true },
    );

    deletePartNodes(project, ['p2']);

    expect(project.nodes.map((n) => n.draw_order)).toEqual([0, 1]);
    expect(project.nodes.find((n) => n.id === 'p1').draw_order).toBe(0);
    expect(project.nodes.find((n) => n.id === 'p3').draw_order).toBe(1);
  });

  it('returns changed=false for non-existent node', () => {
    const project = createTestProject();
    const result = deletePartNodes(project, ['nonexistent']);
    expect(result.changed).toBe(false);
  });
});

describe('deleteCommands — bone deletion (3B)', () => {
  function makeBoneProject() {
    const project = createTestProject();
    project.bones = [
      { id: 'b1', name: 'Root', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, inherit: 'normal' },
      { id: 'b2', name: 'Child', parentId: 'b1', setup: { x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, inherit: 'normal' },
      { id: 'b3', name: 'Grandchild', parentId: 'b2', setup: { x: 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, inherit: 'normal' },
    ];
    project.constraints = [
      { id: 'ik1', type: 'ik', name: 'IK 1', order: 0, enabled: true, affectedBoneIds: ['b2', 'b3'], assignedBoneId: 'b2', targetBoneId: null, poleBoneId: null, mix: 1, fkIk: 1, bendPositive: true },
    ];
    project.defaultPose = { b1: { x: 0 }, b2: { x: 50 }, b3: { x: 100 } };
    project.animations = [{
      id: 'anim-1', name: 'Anim', duration: 2000, fps: 24,
      tracks: [
        { targetId: 'b1', property: 'x', keyframes: [{ time: 0, value: 0 }] },
        { targetId: 'b2', property: 'x', keyframes: [{ time: 0, value: 50 }] },
        { targetId: 'ik1', property: 'targetX', keyframes: [{ time: 0, value: 100 }] },
      ],
    }];
    project.slots = [
      { id: 's1', name: 'Slot 1', boneId: 'b1' },
      { id: 's2', name: 'Slot 2', boneId: 'b2' },
    ];
    project.nodes = [
      { id: 'p1', type: 'part', name: 'Part', parent: null, boneId: 'b2', mesh: { jointBoneId: 'b2', geometry: { boneWeights: [[{ boneId: 'b2', weight: 1 }], [{ boneId: 'b1', weight: 0.5 }, { boneId: 'b2', weight: 0.5 }]] } }, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, draw_order: 0, opacity: 1, visible: true },
    ];
    return project;
  }

  it('deletes only selected bones, not descendants', () => {
    const project = makeBoneProject();

    deleteBones(project, ['b1']);

    expect(project.bones.find((b) => b.id === 'b1')).toBeUndefined();
    expect(project.bones.find((b) => b.id === 'b2')).toBeDefined();
    expect(project.bones.find((b) => b.id === 'b3')).toBeDefined();
  });

  it('reparents surviving children to deleted bone parent', () => {
    const project = makeBoneProject();
    project.bones.push({ id: 'b4', name: 'Sibling', parentId: 'b2', setup: { x: 50, y: 50, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, inherit: 'normal' });

    deleteBones(project, ['b2']);

    const b4 = project.bones.find((b) => b.id === 'b4');
    expect(b4).toBeDefined();
    expect(b4.parentId).toBe('b1');
  });

  it('reparents through a chain of deleted ancestors', () => {
    const project = makeBoneProject();

    deleteBones(project, ['b1', 'b2']);

    expect(project.bones.find((b) => b.id === 'b3')?.parentId).toBeNull();
  });

  it('removes IK constraint when assignedBoneId is deleted and its tracks', () => {
    const project = makeBoneProject();

    deleteBones(project, ['b2']);

    expect(project.constraints.find((c) => c.id === 'ik1')).toBeUndefined();
    const anim = project.animations[0];
    expect(anim.tracks.find((t) => t.targetId === 'ik1')).toBeUndefined();
  });

  it('removes animation tracks targeting deleted bones', () => {
    const project = makeBoneProject();

    deleteBones(project, ['b2']);

    const anim = project.animations[0];
    expect(anim.tracks.find((t) => t.targetId === 'b2')).toBeUndefined();
    expect(anim.tracks.find((t) => t.targetId === 'b1')).toBeDefined();
  });

  it('cleans defaultPose for deleted bones', () => {
    const project = makeBoneProject();

    deleteBones(project, ['b2']);

    expect(project.defaultPose.b2).toBeUndefined();
    expect(project.defaultPose.b1).toBeDefined();
    expect(project.defaultPose.b3).toBeDefined();
  });

  it('removes slots referencing deleted bones', () => {
    const project = makeBoneProject();

    deleteBones(project, ['b2']);

    expect(project.slots.find((s) => s.id === 's2')).toBeUndefined();
    expect(project.slots.find((s) => s.id === 's1')).toBeDefined();
  });

  it('cleans node boneId, jointBoneId, and boneWeights', () => {
    const project = makeBoneProject();

    deleteBones(project, ['b2']);

    const node = project.nodes[0];
    expect(node.boneId).toBeNull();
    expect(node.mesh.jointBoneId).toBeNull();
    expect(node.mesh.geometry.boneWeights[0]).toEqual([]);
    expect(node.mesh.geometry.boneWeights[1]).toEqual([{ boneId: 'b1', weight: 0.5 }]);
  });

  it('does not delete textures', () => {
    const project = makeBoneProject();
    project.textures = [{ id: 'tex-1', source: 'tex.png' }];

    deleteBones(project, ['b1']);

    expect(project.textures).toHaveLength(1);
  });
});

describe('deleteCommands — constraint deletion (3B)', () => {
  it('removes constraint and its tracks', () => {
    const project = createTestProject();
    project.constraints = [
      { id: 'ik1', type: 'ik', name: 'IK 1', order: 0, affectedBoneIds: ['b1'], assignedBoneId: 'b1' },
      { id: 'ik2', type: 'ik', name: 'IK 2', order: 1, affectedBoneIds: ['b2'], assignedBoneId: 'b2' },
    ];
    project.animations = [{
      id: 'anim-1', name: 'A', duration: 1000, fps: 24,
      tracks: [
        { targetId: 'ik1', property: 'targetX', keyframes: [] },
        { targetId: 'ik2', property: 'targetX', keyframes: [] },
      ],
    }];

    const result = deleteConstraints(project, ['ik1']);

    expect(result.changed).toBe(true);
    expect(project.constraints).toHaveLength(1);
    expect(project.constraints[0].id).toBe('ik2');
    expect(project.animations[0].tracks).toHaveLength(1);
    expect(project.animations[0].tracks[0].targetId).toBe('ik2');
  });

  it('returns changed=false for non-existent constraint', () => {
    const project = createTestProject();
    const result = deleteConstraints(project, ['nope']);
    expect(result.changed).toBe(false);
  });
});

describe('deleteCommands — DeleteSelectionIntent (3C)', () => {
  it('classifies mixed selection with expanded node descendants', () => {
    const project = createTestProject();
    project.nodes = [
      { id: 'g1', type: 'group', name: 'G', parent: null, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, opacity: 1, visible: true },
      { id: 'p1', type: 'part', name: 'P', parent: 'g1', transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, draw_order: 0, opacity: 1, visible: true },
    ];
    project.bones = [
      { id: 'b1', name: 'B1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } },
      { id: 'b2', name: 'B2', parentId: 'b1', setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } },
    ];
    project.constraints = [
      { id: 'ik1', type: 'ik', name: 'IK', order: 0, affectedBoneIds: [], assignedBoneId: 'b1' },
    ];

    const intent = buildDeleteSelectionIntent(project, {
      nodeIds: ['g1'],
      boneIds: ['b1'],
      constraintIds: ['ik1'],
    });

    expect(intent.nodeIds).toEqual(expect.arrayContaining(['g1', 'p1']));
    expect(intent.boneIds).toEqual(['b1']);
    expect(intent.constraintIds).toEqual(['ik1']);
    expect(intent.counts.nodes).toBe(2);
    expect(intent.counts.bones).toBe(1);
    expect(intent.counts.constraints).toBe(1);
    expect(intent.isEmpty).toBe(false);
    expect(intent.hasMixedTargets).toBe(true);
    expect(intent.label).toContain('2 layers');
    expect(intent.label).toContain('1 bone');
    expect(intent.label).toContain('1 IK constraint');
  });

  it('deduplicates and ignores non-existent IDs', () => {
    const project = createTestProject();
    project.nodes = [
      { id: 'p1', type: 'part', name: 'P', parent: null, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, draw_order: 0, opacity: 1, visible: true },
    ];

    const intent = buildDeleteSelectionIntent(project, {
      nodeIds: ['p1', 'p1', 'nonexistent'],
    });

    expect(intent.nodeIds).toEqual(['p1']);
    expect(intent.counts.nodes).toBe(1);
  });

  it('returns empty intent for empty selection', () => {
    const project = createTestProject();
    const intent = buildDeleteSelectionIntent(project, {});
    expect(intent.isEmpty).toBe(true);
    expect(intent.label).toBe('Nothing to delete');
  });
});

describe('store facade — undo/redo integration', () => {
  beforeEach(() => {
    clearHistory();
  });

  it('deleteNode via store preserves textures and is undoable', () => {
    const project = createTestProject();
    project.nodes.push({
      id: 'p1', type: 'part', name: 'Part', parent: null,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      draw_order: 0, opacity: 1, visible: true,
    });
    project.textures.push({ id: 'tex-1', source: 'part.png' });
    resetStore(project);

    useProjectStore.getState().deleteNode('p1');

    let state = useProjectStore.getState();
    expect(state.project.nodes).toHaveLength(0);
    expect(state.project.textures).toHaveLength(1);
    expect(undoCount()).toBe(1);

    undoViaStore();

    state = useProjectStore.getState();
    expect(state.project.nodes).toHaveLength(1);
    expect(state.project.nodes[0].id).toBe('p1');
    expect(state.project.textures).toHaveLength(1);
  });

  it('deleteSelectedBones via store is undoable', () => {
    const project = createTestProject();
    project.bones = [
      { id: 'b1', name: 'B1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } },
      { id: 'b2', name: 'B2', parentId: 'b1', setup: { x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } },
    ];
    project.defaultPose = { b1: { x: 0 }, b2: { x: 50 } };
    resetStore(project);

    useProjectStore.getState().deleteSelectedBones(['b1', 'b2']);

    let state = useProjectStore.getState();
    expect(state.project.bones).toHaveLength(0);
    expect(state.project.defaultPose).toEqual({});
    expect(undoCount()).toBe(1);

    undoViaStore();

    state = useProjectStore.getState();
    expect(state.project.bones).toHaveLength(2);
    expect(state.project.defaultPose).toEqual({ b1: { x: 0 }, b2: { x: 50 } });
  });

  it('deleteSelectedConstraints via store is undoable', () => {
    const project = createTestProject();
    project.constraints = [
      { id: 'ik1', type: 'ik', name: 'IK', order: 0, affectedBoneIds: [], assignedBoneId: null },
    ];
    resetStore(project);

    useProjectStore.getState().deleteSelectedConstraints(['ik1']);

    let state = useProjectStore.getState();
    expect(state.project.constraints).toHaveLength(0);
    expect(undoCount()).toBe(1);

    undoViaStore();

    state = useProjectStore.getState();
    expect(state.project.constraints).toHaveLength(1);
  });

  it('buildDeleteSelectionIntent via store returns correct intent', () => {
    const project = createTestProject();
    project.nodes = [
      { id: 'p1', type: 'part', name: 'P', parent: null, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, draw_order: 0, opacity: 1, visible: true },
    ];
    resetStore(project);

    const intent = useProjectStore.getState().buildDeleteSelectionIntent({ nodeIds: ['p1'] });
    expect(intent.counts.nodes).toBe(1);
    expect(intent.isEmpty).toBe(false);
  });
});
