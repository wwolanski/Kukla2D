import { describe, it, expect } from 'vitest';
import { applyBoneConstraintOverrides, cloneBoneWithOverrides, mergePoseOverride } from '@/features/canvas/domain/constraintPose.js';
import {
  buildFramePose,
  buildEffectiveNodes,
  mergeModifierPoseOverrides,
  mergeRuntimePoseOverrides,
} from '@/features/canvas/domain/framePose.js';
import { computePoseOverrides } from '@/domain/animationEngine.js';

describe('cloneBoneWithOverrides', () => {
  it('applies override fields into setup', () => {
    const bone = { id: 'a', setup: { x: 0, y: 0, rotation: 0 } };
    const out = cloneBoneWithOverrides(bone, { x: 10, rotation: 45 });
    expect(out.setup.x).toBe(10);
    expect(out.setup.y).toBe(0);
    expect(out.setup.rotation).toBe(45);
  });
});

describe('mergePoseOverride', () => {
  it('creates new entry for new id', () => {
    const m = new Map();
    mergePoseOverride(m, 'a', { x: 1 });
    expect(m.get('a')).toEqual({ x: 1 });
  });

  it('merges with existing entry', () => {
    const m = new Map([['a', { x: 1 }]]);
    mergePoseOverride(m, 'a', { y: 2 });
    expect(m.get('a')).toEqual({ x: 1, y: 2 });
  });

  it('ignores missing targetId', () => {
    const m = new Map();
    mergePoseOverride(m, null, { x: 1 });
    expect(m.size).toBe(0);
  });
});

describe('applyBoneConstraintOverrides', () => {
  it('returns input unchanged when project has no bones', () => {
    const project = { nodes: [] };
    const overrides = new Map([['a', { x: 1 }]]);
    expect(applyBoneConstraintOverrides(project, overrides)).toBe(overrides);
  });

  it('mirrors bone overrides to legacy group node via bone.nodeId', () => {
    const project = {
      nodes: [
        { id: 'group1', type: 'group', boneRole: 'head' },
        { id: 'bone1', type: 'bone', parent: 'group1', nodeId: 'group1' },
      ],
      bones: [{ id: 'bone1', nodeId: 'group1', setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 1 } }],
      constraints: [],
    };
    const overrides = new Map([['bone1', { rotation: 45 }]]);
    const out = applyBoneConstraintOverrides(project, overrides);
    // bone1 override should be mirrored to group1
    expect(out.get('group1').rotation).toBe(45);
  });
});

describe('buildEffectiveNodes', () => {
  it('returns original nodes when no overrides', () => {
    const nodes = [{ id: 'a', transform: { x: 0 }, opacity: 1, visible: true }];
    expect(buildEffectiveNodes({ nodes }, new Map())).toBe(nodes);
    expect(buildEffectiveNodes({ nodes }, null)).toBe(nodes);
  });

  it('applies transform, opacity and visible from overrides', () => {
    const nodes = [{ id: 'a', transform: { x: 0, y: 0, rotation: 0 }, opacity: 1, visible: true }];
    const overrides = new Map([['a', { x: 10, opacity: 0.5, visible: false }]]);
    const out = buildEffectiveNodes({ nodes }, overrides);
    expect(out[0].transform.x).toBe(10);
    expect(out[0].opacity).toBe(0.5);
    expect(out[0].visible).toBe(false);
  });

  it('maps drawOrder to draw_order', () => {
    const nodes = [{ id: 'a', transform: { x: 0, y: 0, rotation: 0 }, opacity: 1, visible: true, draw_order: 0 }];
    const overrides = new Map([['a', { drawOrder: 5 }]]);
    const out = buildEffectiveNodes({ nodes }, overrides);
    expect(out[0].draw_order).toBe(5);
  });
});

describe('buildFramePose', () => {
  it('returns poseOverrides + effectiveNodes', () => {
    const project = { nodes: [{ id: 'a', transform: { x: 0, y: 0 }, opacity: 1, visible: true }], bones: [] };
    const out = buildFramePose({ project, editorState: { editorMode: 'edit' }, animationState: { draftPose: new Map() } });
    expect(out).toHaveProperty('poseOverrides');
    expect(out).toHaveProperty('effectiveNodes');
    expect(out.effectiveNodes[0].id).toBe('a');
  });

  it('preserves keyframe property when draft has different prop', () => {
    // keyframe sets x; draft sets rotation; final transform should have both.
    const project = {
      nodes: [{ id: 'a', transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, opacity: 1, visible: true }],
      animations: [{
        id: 'anim1', tracks: [
          { property: 'x', targetId: 'a', keyframes: [{ time: 0, value: 100 }] },
        ],
      }],
      bones: [],
    };
    const animationState = { activeAnimationId: 'anim1', currentTime: 0, draftPose: new Map([['a', { rotation: 45 }]]) };
    const out = buildFramePose({ project, editorState: { editorMode: 'animation' }, animationState });
    // effectiveNodes is built from kf + draft merged; transform should reflect both
    const node = out.effectiveNodes[0];
    expect(node.transform.x).toBe(100);
    expect(node.transform.rotation).toBe(45);
  });

  it('applies blend shapes to base mesh_verts', () => {
    const project = {
      nodes: [{
        id: 'p1', type: 'part',
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        opacity: 1, visible: true,
        mesh: { vertices: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
        blendShapes: [{ id: 'smile', deltas: [{ dx: 1, dy: 1 }, { dx: 2, dy: 2 }] }],
        blendShapeValues: { smile: 0.5 },
      }],
      bones: [],
    };
    const out = buildFramePose({
      project,
      editorState: { editorMode: 'edit' },
      animationState: { draftPose: new Map() },
    });
    expect(out.poseOverrides.get('p1').mesh_verts).toEqual([
      { x: 0.5, y: 0.5 },
      { x: 11, y: 11 },
    ]);
  });

  it('keeps explicit mesh_verts ahead of blend shapes', () => {
    const project = {
      nodes: [{
        id: 'p1', type: 'part',
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        opacity: 1, visible: true,
        mesh: { vertices: [{ x: 0, y: 0 }] },
        blendShapes: [{ id: 'smile', deltas: [{ dx: 1, dy: 1 }] }],
        blendShapeValues: { smile: 1 },
      }],
      bones: [],
      animations: [{
        id: 'anim1', tracks: [
          { property: 'mesh_verts', targetId: 'p1', keyframes: [{ time: 0, value: [{ x: 5, y: 5 }] }] },
        ],
      }],
    };
    const out = buildFramePose({
      project,
      editorState: { editorMode: 'animation' },
      animationState: { activeAnimationId: 'anim1', currentTime: 0, draftPose: new Map() },
    });
    expect(out.poseOverrides.get('p1').mesh_verts).toEqual([{ x: 5, y: 5 }]);
  });

  it('uses animated blendShape weights when generating mesh vertices', () => {
    const project = {
      nodes: [{
        id: 'p1', type: 'part',
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        opacity: 1, visible: true,
        mesh: { vertices: [{ x: 0, y: 0 }] },
        blendShapes: [{ id: 'smile', deltas: [{ dx: 10, dy: 4 }] }],
        blendShapeValues: { smile: 0 },
      }],
      bones: [],
      animations: [{
        id: 'anim1', tracks: [
          { property: 'blendShape:smile', targetId: 'p1', keyframes: [{ time: 0, value: 0.5 }] },
        ],
      }],
    };
    const out = buildFramePose({
      project,
      editorState: { editorMode: 'animation' },
      animationState: { activeAnimationId: 'anim1', currentTime: 0, draftPose: new Map() },
    });
    expect(out.poseOverrides.get('p1').mesh_verts).toEqual([{ x: 5, y: 2 }]);
  });
});

describe('frame pipeline precedence characterization', () => {
  function nodeFixture(id = 'nodeA', overrides = {}) {
    return {
      id,
      type: 'part',
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      opacity: 1,
      visible: true,
      ...overrides,
    };
  }

  function boneFixture(id = 'boneA', setupOverrides = {}) {
    return {
      id,
      parentId: null,
      setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 10, ...setupOverrides },
    };
  }

  describe('3. animation vs draft (draft > animation)', () => {
    it('draft x overrides animation keyframe x', () => {
      const project = {
        nodes: [nodeFixture()],
        bones: [],
        animations: [{
          id: 'anim1', tracks: [
            { targetId: 'nodeA', property: 'x', keyframes: [{ time: 0, value: 0 }, { time: 100, value: 100 }] },
          ],
        }],
        defaultPose: {},
      };
      const out = buildFramePose({
        project,
        editorState: { editorMode: 'animation' },
        animationState: {
          activeAnimationId: 'anim1',
          currentTime: 50,
          draftPose: new Map([['nodeA', { x: 200 }]]),
          fps: 30,
          endFrame: 100,
        },
      });
      expect(out.effectiveNodes[0].transform.x).toBe(200);
    });

    it('draft rotation overrides animation keyframe rotation', () => {
      const project = {
        nodes: [nodeFixture()],
        bones: [],
        animations: [{
          id: 'anim1', tracks: [
            { targetId: 'nodeA', property: 'rotation', keyframes: [{ time: 0, value: 0 }, { time: 100, value: 180 }] },
          ],
        }],
        defaultPose: {},
      };
      const out = buildFramePose({
        project,
        editorState: { editorMode: 'animation' },
        animationState: {
          activeAnimationId: 'anim1',
          currentTime: 50,
          draftPose: new Map([['nodeA', { rotation: 270 }]]),
          fps: 30,
          endFrame: 100,
        },
      });
      expect(out.effectiveNodes[0].transform.rotation).toBe(270);
    });

    it('draft visible overrides animation keyframe visible (boolean)', () => {
      const project = {
        nodes: [nodeFixture()],
        bones: [],
        animations: [{
          id: 'anim1', tracks: [
            { targetId: 'nodeA', property: 'visible', keyframes: [{ time: 0, value: true }, { time: 50, value: false }] },
          ],
        }],
        defaultPose: {},
      };
      const out = buildFramePose({
        project,
        editorState: { editorMode: 'animation' },
        animationState: {
          activeAnimationId: 'anim1',
          currentTime: 25,
          draftPose: new Map([['nodeA', { visible: true }]]),
          fps: 30,
          endFrame: 100,
        },
      });
      expect(out.effectiveNodes[0].visible).toBe(true);
    });

    it('draft mesh_verts overrides animation keyframe mesh_verts', () => {
      const project = {
        nodes: [{
          ...nodeFixture(),
          mesh: { vertices: [{ x: 0, y: 0 }], influences: [] },
        }],
        bones: [],
        animations: [{
          id: 'anim1', tracks: [
            {
              targetId: 'nodeA', property: 'mesh_verts',
              keyframes: [{ time: 0, value: [{ x: 5, y: 5 }] }, { time: 100, value: [{ x: 50, y: 50 }] }],
            },
          ],
        }],
        defaultPose: {},
      };
      const out = buildFramePose({
        project,
        editorState: { editorMode: 'animation' },
        animationState: {
          activeAnimationId: 'anim1',
          currentTime: 50,
          draftPose: new Map([['nodeA', { mesh_verts: [{ x: 99, y: 99 }] }]]),
          fps: 30,
          endFrame: 100,
        },
      });
      expect(out.poseOverrides.get('nodeA').mesh_verts[0].x).toBe(99);
      expect(out.poseOverrides.get('nodeA').mesh_verts[0].y).toBe(99);
    });
  });

  describe('4. animation preserves non-overlapping draft properties', () => {
    it('animation sets x; draft sets rotation; both apply', () => {
      const project = {
        nodes: [nodeFixture()],
        bones: [],
        animations: [{
          id: 'anim1', tracks: [
            { targetId: 'nodeA', property: 'x', keyframes: [{ time: 0, value: 100 }] },
          ],
        }],
        defaultPose: {},
      };
      const out = buildFramePose({
        project,
        editorState: { editorMode: 'animation' },
        animationState: {
          activeAnimationId: 'anim1',
          currentTime: 0,
          draftPose: new Map([['nodeA', { rotation: 45 }]]),
          fps: 30,
          endFrame: 100,
        },
      });
      expect(out.effectiveNodes[0].transform.x).toBe(100);
      expect(out.effectiveNodes[0].transform.rotation).toBe(45);
    });
  });

  describe('5. bone hierarchy after draft (constraints > draft)', () => {
    it('child bone inherits parent draft rotation via hierarchy', () => {
      const project = {
        nodes: [nodeFixture('child', { boneId: 'childBone' })],
        bones: [
          { id: 'parentBone', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 10 } },
          { id: 'childBone', parentId: 'parentBone', setup: { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 5 } },
        ],
        constraints: [],
        animations: [],
        defaultPose: {},
      };
      const out = buildFramePose({
        project,
        editorState: { editorMode: 'staging' },
        animationState: {
          draftPose: new Map([['parentBone', { rotation: 90 }]]),
        },
      });
      const childBone = out.effectiveBones.find(b => b.id === 'childBone');
      expect(childBone.setup.rotation).toBe(90);
    });

    it('child rotation key keeps inheriting animated parent position', () => {
      const project = {
        nodes: [],
        bones: [
          { id: 'parentBone', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 10 } },
          { id: 'childBone', parentId: 'parentBone', setup: { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 5 } },
        ],
        constraints: [],
        animations: [{
          id: 'anim1',
          fps: 24,
          duration: 1000,
          tracks: [
            { targetId: 'parentBone', property: 'x', keyframes: [{ time: 0, value: 100 }] },
            { targetId: 'childBone', property: 'rotation', keyframes: [{ time: 0, value: 20 }] },
          ],
        }],
        defaultPose: {},
      };
      const out = buildFramePose({
        project,
        editorState: { editorMode: 'animation' },
        animationState: {
          activeAnimationId: 'anim1',
          currentTime: 0,
          draftPose: new Map(),
          fps: 24,
          endFrame: 24,
        },
      });

      const childBone = out.effectiveBones.find(bone => bone.id === 'childBone');
      expect(childBone.setup.x).toBe(110);
      expect(childBone.setup.rotation).toBe(20);
    });
  });

  describe('6. IK constraint after draft (IK > draft)', () => {
    it('IK constraint adjusts bone rotation after draft sets initial value', () => {
      const project = {
        nodes: [
          nodeFixture('tip', { boneId: 'childBone' }),
        ],
        bones: [
          { id: 'parentBone', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 10 } },
          { id: 'childBone', parentId: 'parentBone', setup: { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 5 } },
        ],
        constraints: [{
          id: 'ik1',
          type: 'ik',
          order: 0,
          enabled: true,
          affectedBoneIds: ['parentBone'],
          targetX: 0,
          targetY: 20,
          mix: 1,
        }],
        animations: [],
        defaultPose: {},
      };
      const out = buildFramePose({
        project,
        editorState: { editorMode: 'staging' },
        animationState: {
          draftPose: new Map([['parentBone', { rotation: 10 }]]),
        },
      });
      const parentBone = out.effectiveBones.find(b => b.id === 'parentBone');
      expect(parentBone.setup.rotation).not.toBe(10);
    });
  });

  describe('7. linked nodes follow bone constraints', () => {
    it('node linked to bone receives bone-constrained position', () => {
      const project = {
        nodes: [{
          id: 'linked',
          type: 'part',
          boneId: 'boneA',
          transform: { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
          visible: true,
          opacity: 1,
        }],
        bones: [{ id: 'boneA', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 10 } }],
        constraints: [],
        animations: [],
        defaultPose: { boneA: { rotation: 90 } },
      };
      const out = buildFramePose({
        project,
        editorState: { editorMode: 'staging' },
        animationState: { draftPose: new Map() },
      });
      expect(out.effectiveNodes[0].transform.rotation).toBe(90);
      expect(out.effectiveNodes[0].transform.x).toBeCloseTo(0);
      expect(out.effectiveNodes[0].transform.y).toBeCloseTo(10);
    });
  });

  describe('8. full chain: default → anim → draft → constraints → linked', () => {
    it('all layers compose in documented order', () => {
      const project = {
        nodes: [
          nodeFixture('nodeA', { boneId: 'boneA' }),
        ],
        bones: [
          boneFixture('boneA'),
          { id: 'childBone', parentId: 'boneA', setup: { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 5 } },
        ],
        constraints: [],
        animations: [{
          id: 'anim1', tracks: [
            { targetId: 'boneA', property: 'rotation', keyframes: [{ time: 0, value: 0 }, { time: 100, value: 45 }] },
            { targetId: 'nodeA', property: 'opacity', keyframes: [{ time: 0, value: 1 }, { time: 100, value: 0.5 }] },
          ],
        }],
        defaultPose: { boneA: { rotation: 10 } },
      };
      const out = buildFramePose({
        project,
        editorState: { editorMode: 'animation' },
        animationState: {
          activeAnimationId: 'anim1',
          currentTime: 50,
          draftPose: new Map([['nodeA', { opacity: 0.9 }]]),
          fps: 30,
          endFrame: 100,
        },
      });
      const nodeA = out.effectiveNodes.find(n => n.id === 'nodeA');
      expect(nodeA.opacity).toBe(0.9);
      expect(out.effectiveBones[0].setup.rotation).not.toBe(10);
      expect(out.effectiveBones[0].setup.rotation).not.toBe(0);
    });
  });

  describe('10. defaultPose applies to bone, not node', () => {
    it('defaultPose bone rotation propagates to linked node', () => {
      const project = {
        nodes: [nodeFixture('img', { boneId: 'b1' })],
        bones: [boneFixture('b1')],
        constraints: [],
        animations: [],
        defaultPose: { b1: { rotation: 45 } },
      };
      const out = buildFramePose({
        project,
        editorState: { editorMode: 'staging' },
        animationState: { draftPose: new Map() },
      });
      expect(out.effectiveBones[0].setup.rotation).toBe(45);
      expect(out.effectiveNodes[0].transform.rotation).toBe(45);
    });
  });

  describe('11. numeric interpolation between keyframes', () => {
    it('interpolates x between two keyframes at midpoint', () => {
      const kfOverrides = computePoseOverrides(
        { tracks: [{ targetId: 'a', property: 'x', keyframes: [{ time: 0, value: 0 }, { time: 100, value: 200 }] }] },
        50,
      );
      expect(kfOverrides.get('a').x).toBe(100);
    });
  });

  describe('12. boolean step interpolation', () => {
    it('visible boolean snaps to start keyframe value between keyframes', () => {
      const kfOverrides = computePoseOverrides(
        { tracks: [{ targetId: 'a', property: 'visible', keyframes: [{ time: 0, value: true }, { time: 50, value: false }] }] },
        25,
      );
      expect(kfOverrides.get('a').visible).toBe(true);
    });
  });

  describe('13. mesh_verts interpolation', () => {
    it('interpolates mesh vertices between keyframes', () => {
      const kfOverrides = computePoseOverrides(
        { tracks: [{ targetId: 'a', property: 'mesh_verts', keyframes: [{ time: 0, value: [{ x: 0, y: 0 }] }, { time: 100, value: [{ x: 100, y: 100 }] }] }] },
        50,
      );
      expect(kfOverrides.get('a').mesh_verts[0].x).toBe(50);
      expect(kfOverrides.get('a').mesh_verts[0].y).toBe(50);
    });
  });

});

describe('mergeModifierPoseOverrides', () => {
  it('returns base when modifier is null', () => {
    const base = new Map([['a', { x: 1 }]]);
    expect(mergeModifierPoseOverrides(base, null)).toBe(base);
  });

  it('returns base when modifier is empty Map', () => {
    const base = new Map([['a', { x: 1 }]]);
    expect(mergeModifierPoseOverrides(base, new Map())).toBe(base);
  });

  it('returns modifier when base is null', () => {
    const modifier = new Map([['a', { x: 10 }]]);
    const result = mergeModifierPoseOverrides(null, modifier);
    expect(result.get('a').x).toBe(10);
  });

  it('merges modifier on top of base', () => {
    const base = new Map([['a', { x: 1, y: 2 }]]);
    const modifier = new Map([['a', { x: 10 }]]);
    const result = mergeModifierPoseOverrides(base, modifier);
    expect(result.get('a')).toEqual({ x: 10, y: 2 });
  });

  it('adds new targets from modifier', () => {
    const base = new Map([['a', { x: 1 }]]);
    const modifier = new Map([['b', { y: 20 }]]);
    const result = mergeModifierPoseOverrides(base, modifier);
    expect(result.get('a').x).toBe(1);
    expect(result.get('b').y).toBe(20);
  });
});

describe('buildFramePose modifierPoseOverrides', () => {
  function simpleProject(overrides = {}) {
    return {
      nodes: [{
        id: 'n1', type: 'part',
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
        opacity: 1, visible: true,
        ...overrides,
      }],
      bones: [],
    };
  }

  it('applies modifier overrides to pose when provided', () => {
    const out = buildFramePose({
      project: simpleProject(),
      editorState: { editorMode: 'edit' },
      animationState: { draftPose: new Map() },
      modifierPoseOverrides: new Map([['n1', { x: 42 }]]),
    });
    expect(out.effectiveNodes[0].transform.x).toBe(42);
  });

  it('modifier layer does not override draft pose for same property', () => {
    const out = buildFramePose({
      project: simpleProject(),
      editorState: { editorMode: 'edit' },
      animationState: { draftPose: new Map([['n1', { x: 99 }]]) },
      modifierPoseOverrides: new Map([['n1', { x: 10 }]]),
    });
    expect(out.effectiveNodes[0].transform.x).toBe(99);
  });

  it('modifier and draft apply different properties independently', () => {
    const out = buildFramePose({
      project: simpleProject(),
      editorState: { editorMode: 'edit' },
      animationState: { draftPose: new Map([['n1', { rotation: 45 }]]) },
      modifierPoseOverrides: new Map([['n1', { x: 30 }]]),
    });
    expect(out.effectiveNodes[0].transform.x).toBe(30);
    expect(out.effectiveNodes[0].transform.rotation).toBe(45);
  });

  it('modifier overrides appear after animation keyframes but before draft', () => {
    const project = {
      ...simpleProject({ blendShapes: [{ id: 'breathe', deltas: [{ dx: 1, dy: 0 }] }], blendShapeValues: {} }),
      animations: [{
        id: 'anim1', tracks: [
          { property: 'blendShape:breathe', targetId: 'n1', keyframes: [{ time: 0, value: 0 }] },
        ],
      }],
    };
    const out = buildFramePose({
      project,
      editorState: { editorMode: 'animation' },
      animationState: { activeAnimationId: 'anim1', currentTime: 0, draftPose: new Map() },
    });
    expect(out.poseOverrides.get('n1')).toBeDefined();
    expect(out.poseOverrides.get('n1')['blendShape:breathe']).toBe(0);
  });

  it('empty modifierPoseOverrides is no-op', () => {
    const out = buildFramePose({
      project: simpleProject(),
      editorState: { editorMode: 'edit' },
      animationState: { draftPose: new Map() },
    });
    expect(out.effectiveNodes[0].transform.x).toBe(0);
  });
});

describe('mergeRuntimePoseOverrides', () => {
  it('returns base when runtime is null', () => {
    const base = new Map([['a', { x: 1 }]]);
    expect(mergeRuntimePoseOverrides(base, null)).toBe(base);
  });

  it('returns base when runtime is empty Map', () => {
    const base = new Map([['a', { x: 1 }]]);
    expect(mergeRuntimePoseOverrides(base, new Map())).toBe(base);
  });

  it('returns runtime when base is null', () => {
    const runtime = new Map([['a', { x: 10 }]]);
    const result = mergeRuntimePoseOverrides(null, runtime);
    expect(result.get('a').x).toBe(10);
  });

  it('merges runtime on top of base', () => {
    const base = new Map([['a', { x: 1, y: 2 }]]);
    const runtime = new Map([['a', { x: 10 }]]);
    const result = mergeRuntimePoseOverrides(base, runtime);
    expect(result.get('a')).toEqual({ x: 10, y: 2 });
  });

  it('adds new targets from runtime', () => {
    const base = new Map([['a', { x: 1 }]]);
    const runtime = new Map([['b', { y: 20 }]]);
    const result = mergeRuntimePoseOverrides(base, runtime);
    expect(result.get('a').x).toBe(1);
    expect(result.get('b').y).toBe(20);
  });
});

describe('buildFramePose runtimePoseOverrides', () => {
  function simpleProject() {
    return {
      nodes: [{
        id: 'n1', type: 'part',
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
        opacity: 1, visible: true,
      }],
      bones: [],
    };
  }

  it('returns physicsActive false when no runtimePoseOverrides', () => {
    const out = buildFramePose({
      project: simpleProject(),
      editorState: { editorMode: 'edit' },
      animationState: { draftPose: new Map() },
    });
    expect(out.physicsActive).toBe(false);
  });

  it('returns physicsActive true when runtimePoseOverrides provided and non-empty', () => {
    const out = buildFramePose({
      project: simpleProject(),
      editorState: { editorMode: 'edit' },
      animationState: { draftPose: new Map() },
      runtimePoseOverrides: new Map([['n1', { x: 99 }]]),
    });
    expect(out.physicsActive).toBe(true);
    expect(out.effectiveNodes[0].transform.x).toBe(99);
  });

  it('returns physicsActive false for empty runtimePoseOverrides Map', () => {
    const out = buildFramePose({
      project: simpleProject(),
      editorState: { editorMode: 'edit' },
      animationState: { draftPose: new Map() },
      runtimePoseOverrides: new Map(),
    });
    expect(out.physicsActive).toBe(false);
  });

  it('runtime layer overrides draft but constraints still apply after', () => {
    const project = {
      nodes: [{
        id: 'n1', type: 'part', boneId: 'b1',
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
        opacity: 1, visible: true,
      }],
      bones: [
        { id: 'b1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 10 } },
      ],
      constraints: [],
    };
    const out = buildFramePose({
      project,
      editorState: { editorMode: 'edit' },
      animationState: { draftPose: new Map() },
      runtimePoseOverrides: new Map([['b1', { rotation: 45 }]]),
    });
    const bone = out.effectiveBones.find(b => b.id === 'b1');
    expect(bone.setup.rotation).toBe(45);
    expect(out.physicsActive).toBe(true);
  });

  it('without runtimePoseOverrides result is pre-physics frame', () => {
    const project = {
      nodes: [{
        id: 'n1', type: 'part',
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
        opacity: 0.5, visible: true,
      }],
      bones: [],
    };
    const out = buildFramePose({
      project,
      editorState: { editorMode: 'edit' },
      animationState: { draftPose: new Map() },
    });
    expect(out.effectiveNodes[0].opacity).toBe(0.5);
    expect(out.physicsActive).toBe(false);
  });
});

describe('buildFramePose preLinkedNodes', () => {
  it('returns preLinkedNodes before linked pass for linked node', () => {
    const project = {
      nodes: [{
        id: 'linked', type: 'part', boneId: 'boneA',
        transform: { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
        visible: true, opacity: 1,
      }],
      bones: [{ id: 'boneA', parentId: null, setup: { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1, length: 10 } }],
      constraints: [],
      animations: [],
      defaultPose: {},
    };
    const out = buildFramePose({
      project,
      editorState: { editorMode: 'animation' },
      animationState: { draftPose: new Map() },
    });
    expect(out.preLinkedNodes).toBeDefined();
    expect(out.preLinkedNodes).toHaveLength(1);
    const preLinked = out.preLinkedNodes[0];
    expect(preLinked.transform.x).toBe(10);
    expect(preLinked.transform.y).toBe(0);
  });
});

describe('buildFramePose warp deformation', () => {
  it('deforms child part mesh through ancestor warp deformer', () => {
    const project = {
      nodes: [
        {
          id: 'w1', type: 'warpDeformer', parent: null,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
          visible: true, opacity: 1,
          col: 2, row: 2, gridX: 0, gridY: 0, gridW: 100, gridH: 100,
        },
        {
          id: 'p1', type: 'part', parent: 'w1',
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
          visible: true, opacity: 1,
          mesh: {
            vertices: [{ x: 50, y: 50 }],
            uvs: [0, 0],
            triangles: [[0]],
          },
        },
      ],
      bones: [],
      constraints: [],
      animations: [],
      defaultPose: {
        w1: { mesh_verts: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 50 }, { x: 60, y: 55 }, { x: 100, y: 50 }, { x: 0, y: 100 }, { x: 50, y: 100 }, { x: 100, y: 100 }] },
      },
    };
    const out = buildFramePose({
      project,
      editorState: { editorMode: 'edit' },
      animationState: { draftPose: new Map() },
    });
    expect(out.effectiveMeshes).toBeDefined();
    const frame = out.effectiveMeshes.get('p1');
    expect(frame).toBeDefined();
    expect(frame.vertices[0].x).toBeCloseTo(60);
    expect(frame.vertices[0].y).toBeCloseTo(55);
  });

  it('returns effective meshes matching setup when no warp overrides apply', () => {
    const project = {
      nodes: [
        {
          id: 'p1', type: 'part', parent: null,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
          visible: true, opacity: 1,
          mesh: {
            vertices: [{ x: 10, y: 20 }],
            uvs: [0, 0],
            triangles: [[0]],
          },
        },
      ],
      bones: [],
      constraints: [],
      animations: [],
      defaultPose: {},
    };
    const out = buildFramePose({
      project,
      editorState: { editorMode: 'edit' },
      animationState: { draftPose: new Map() },
    });
    expect(out.effectiveMeshes.get('p1').vertices).toEqual([{ x: 10, y: 20 }]);
  });
});
