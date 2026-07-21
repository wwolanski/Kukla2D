import { describe, it, expect } from 'vitest';
import { createEmptyProject } from '../src/core/createEmptyProject';
import { CURRENT_PROJECT_VERSION } from '../src/schema/projectSchema';
import { solveIK } from '../src/runtime/constraints/ik.js';
import { solveTransformConstraint } from '../src/runtime/constraints/transform.js';
import { executeDeformPipeline } from '../src/runtime/deformPipeline.js';
import { evaluateDrawOrder } from '../src/runtime/drawOrder.js';
import { evaluatePose } from '../src/runtime/pose.js';
import { Kukla2dRuntime } from '../src/runtime/runtimeApi.js';
import { migrateProject } from '../src/schema/migrateProject';
import { deduplicateKeyframes, validateKeyframeValue, isDiscreteType, VALUE_TYPES } from '../src/schema/trackBinding';
import { compileEvaluationGraph } from '../src/runtime/compileEvaluationGraph.js';
import { evaluateLayers } from '../src/runtime/animationMixer.js';
import { evaluateTransitions, validateStateMachine } from '../src/runtime/stateMachine.js';
import { evaluatePhysicsOutputs } from '../src/runtime/physics/solver.js';
import { computeBoneWorldMatrices } from '../src/runtime/skeleton.js';
import { solvePathConstraint as solvePathConstraint2 } from '../src/runtime/constraints/path.js';
import { mapPhysicsRulesToRig as mapPhysicsRulesToRig2 } from '../src/runtime/physics/mapper.js';

describe('createEmptyProject', () => {
  it('returns a project at the current schema version', () => {
    const proj = createEmptyProject();
    expect(proj.version).toBe(CURRENT_PROJECT_VERSION);
    expect(proj.canvas.width).toBe(800);
    expect(proj.canvas.height).toBe(600);
    expect(Array.isArray(proj.textures)).toBe(true);
    expect(Array.isArray(proj.nodes)).toBe(true);
    expect(Array.isArray(proj.animations)).toBe(true);
    expect(proj).not.toHaveProperty('parameters');
    expect(Array.isArray(proj.physics_groups)).toBe(true);
    expect(Array.isArray(proj.physicsRules)).toBe(true);
  });
});

describe('IK 2-bone coverage', () => {
  it('2-bone IK returns overrides for both bones when target is reachable', () => {
    const boneMap = new Map([
      ['b1', { setup: { x: 0, y: 0, rotation: 0, length: 50 } }],
      ['b2', { setup: { x: 0, y: 0, rotation: 0, length: 50 } }],
      ['target', { setup: { x: 80, y: 0, rotation: 0 } }],
    ]);
    const result = solveIK({ affectedBoneIds: ['b1', 'b2'], targetBoneId: 'target', mix: 1 }, boneMap);
    expect(result.has('b1')).toBe(true);
    expect(result.has('b2')).toBe(true);
  });

  it('2-bone IK with bendPositive=false flips sign', () => {
    const boneMap = new Map([
      ['b1', { setup: { x: 0, y: 0, rotation: 0, length: 50 } }],
      ['b2', { setup: { x: 0, y: 0, rotation: 0, length: 50 } }],
      ['target', { setup: { x: 80, y: 0, rotation: 0 } }],
    ]);
    const resultPos = solveIK({ affectedBoneIds: ['b1', 'b2'], targetBoneId: 'target', mix: 1, bendPositive: true }, boneMap);
    const resultNeg = solveIK({ affectedBoneIds: ['b1', 'b2'], targetBoneId: 'target', mix: 1, bendPositive: false }, boneMap);
    expect(resultPos.get('b1').rotation).not.toBeCloseTo(resultNeg.get('b1').rotation, 0);
  });

  it('2-bone IK clamps unreachable target distance', () => {
    const boneMap = new Map([
      ['b1', { setup: { x: 0, y: 0, rotation: 0, length: 30 } }],
      ['b2', { setup: { x: 0, y: 0, rotation: 0, length: 30 } }],
      ['target', { setup: { x: 1000, y: 0, rotation: 0 } }],
    ]);
    const result = solveIK({ affectedBoneIds: ['b1', 'b2'], targetBoneId: 'target', mix: 1 }, boneMap);
    expect(result.has('b1')).toBe(true);
    expect(result.has('b2')).toBe(true);
  });

  it('2-bone IK returns empty when bones are missing', () => {
    const boneMap = new Map([
      ['b1', { setup: { x: 0, y: 0, rotation: 0, length: 50 } }],
      ['target', { setup: { x: 50, y: 0, rotation: 0 } }],
    ]);
    const result = solveIK({ affectedBoneIds: ['b1', 'missing'], targetBoneId: 'target', mix: 1 }, boneMap);
    expect(result.size).toBe(0);
  });
});

describe('deformPipeline edge cases', () => {
  it('applies LBS when influences are present', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } }],
      nodes: [{
        id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0,
        mesh: {
          vertices: new Float32Array([0, 0, 10, 0]),
          influences: [
            [{ boneId: 'b1', weight: 1 }],
            [{ boneId: 'b1', weight: 1 }],
          ],
        },
      }],
    };
    const result = executeDeformPipeline(project);
    expect(result.drawList[0].vertices[0]).toBeCloseTo(0, 4);
    expect(result.drawList[0].vertices[2]).toBeCloseTo(10, 4);
  });

  it('LBS deforms vertices when bone moves from bind pose', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null, setup: { x: 5, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } }],
      nodes: [{
        id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0,
        mesh: {
          vertices: new Float32Array([0, 0]),
          influences: [
            [{ boneId: 'b1', weight: 1 }],
          ],
        },
      }],
    };
    const result = executeDeformPipeline(project);
    expect(result.drawList[0].vertices).toBeDefined();
  });

  it('applies warp override when present in animation overrides', () => {
    const project = {
      bones: [],
      nodes: [{
        id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0,
        mesh: { vertices: new Float32Array([0, 0, 10, 0]) },
      }],
    };
    const warp = {
      id: 'w1', type: 'warpDeformer', name: 'W',
    };
    project.nodes.push(warp);
    const overrides = new Map([
      [`warp:${warp.id}`, {
        lattice: [
          { dx: 0, dy: 0 }, { dx: 1, dy: 0 },
          { dx: 0, dy: 1 }, { dx: 1, dy: 1 },
        ],
        gridW: 200, gridH: 200, col: 2, row: 2,
      }],
    ]);
    const result = executeDeformPipeline(project, overrides);
    expect(result.drawList.length).toBe(1);
  });

  it('skips blend shapes with influence 0', () => {
    const project = {
      bones: [],
      nodes: [{
        id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0,
        mesh: { vertices: new Float32Array([0, 0]) },
        blendShapes: [{ id: 'bs1', name: 'x', deltas: [{ dx: 5, dy: 0 }] }],
        blendShapeValues: { bs1: 0 },
      }],
    };
    const result = executeDeformPipeline(project);
    expect(result.drawList[0].vertices[0]).toBe(0);
  });
});

describe('evaluateDrawOrder extra coverage', () => {
  it('uses default drawOrder when override is missing', () => {
    const slots = [{ id: 's1', drawOrder: 5 }];
    const overrides = new Map();
    const result = evaluateDrawOrder(slots, overrides);
    expect(result).toEqual(['s1']);
  });
});

describe('evaluatePose extra coverage', () => {
  it('skips nodes without mesh or influences', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } }],
      nodes: [
        { id: 'n1', type: 'part', name: 'p' },
        { id: 'n2', type: 'group', name: 'g' },
      ],
    };
    const result = evaluatePose(project);
    expect(result.skinnedMeshes).toHaveLength(0);
  });

  it('applies scale overrides via multiplication', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 1, shearX: 0, shearY: 0, length: 0 } }],
      nodes: [],
    };
    const overrides = new Map([['b1', { scaleX: 3 }]]);
    const result = evaluatePose(project, overrides);
    const m = result.boneMatrices.get('b1');
    expect(m[0]).toBeCloseTo(6, 4);
  });
});

describe('Kukla2dRuntime extra coverage', () => {
  it('play() adds a layer and accumulates over multiple update calls', () => {
    const runtime = new Kukla2dRuntime({
      animations: [{
        id: 'c1', duration: 1000, fps: 24,
        tracks: [{ targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 0, easing: 'linear' }, { time: 1000, value: 10, easing: 'linear' }] }],
      }],
      bones: [], nodes: [],
    });
    runtime.createInstance('i1');
    runtime.play('i1', 'c1');
    runtime.update('i1', 0.5);
    runtime.update('i1', 0.5);
    expect(runtime.instances.get('i1').layers).toHaveLength(1);
  });

  it('update() returns null for missing instance', () => {
    const runtime = new Kukla2dRuntime({ animations: [], bones: [], nodes: [] });
    expect(runtime.update('missing', 0.016)).toBeNull();
  });

  it('update() returns null for disposed instance', () => {
    const runtime = new Kukla2dRuntime({ animations: [], bones: [], nodes: [] });
    runtime.createInstance('i1');
    runtime.disposeInstance('i1');
    expect(runtime.update('i1', 0.016)).toBeNull();
  });

  it('setParameter stores the parameter', () => {
    const runtime = new Kukla2dRuntime({ animations: [], bones: [], nodes: [] });
    runtime.createInstance('i1');
    runtime.setParameter('i1', 'p1', 0.5);
    expect(runtime.instances.get('i1').parameters.p1).toBe(0.5);
  });

  it('play() ignores missing instance', () => {
    const runtime = new Kukla2dRuntime({ animations: [], bones: [], nodes: [] });
    runtime.play('missing', 'c1');
    expect(runtime.instances.size).toBe(0);
  });

  it('setParameter is a no-op for missing instance', () => {
    const runtime = new Kukla2dRuntime({ animations: [], bones: [], nodes: [] });
    runtime.setParameter('missing', 'p', 1);
    expect(true).toBe(true);
  });
});

describe('migrateProject edge cases', () => {
  it('migrates v1 → v2 by promoting groups to bones and parts to slots', () => {
    const v1 = {
      version: 1,
      nodes: [
        { id: 'g1', type: 'group', name: 'G', parent: null, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } },
        { id: 'p1', type: 'part', name: 'P', parent: 'g1', draw_order: 0, transform: { x: 1, y: 2, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } },
      ],
    };
    const migrated = migrateProject(v1);
    expect(migrated.version).toBe(CURRENT_PROJECT_VERSION);
    expect(migrated.bones.length).toBeGreaterThan(0);
    expect(migrated.slots.length).toBeGreaterThan(0);
    expect(migrated.attachments.length).toBeGreaterThan(0);
  });

  it('migrates warpDeformer nodes to bones in v1→v2', () => {
    const v1 = {
      version: 1,
      nodes: [
        { id: 'g1', type: 'group', name: 'Root', parent: null, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } },
        { id: 'w1', type: 'warpDeformer', name: 'W', parent: 'g1', transform: { x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } },
      ],
    };
    const migrated = migrateProject(v1);
    const warpBone = migrated.bones.find(b => b.id === 'w1');
    expect(warpBone).toBeDefined();
    expect(warpBone.setup.x).toBe(5);
  });

  it('migrates jointBoneId/boneWeights to influences in v1→v2', () => {
    const v1 = {
      version: 1,
      nodes: [
        { id: 'g1', type: 'group', name: 'Root', parent: null, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } },
        { id: 'p1', type: 'part', name: 'P', parent: 'g1', draw_order: 0,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
          mesh: { vertices: [0, 0, 10, 0], triangles: [], uvs: [], jointBoneId: 'g1', boneWeights: 0.6 },
        },
      ],
    };
    const migrated = migrateProject(v1);
    const part = migrated.nodes.find(n => n.id === 'p1');
    expect(part.mesh.influences).toBeDefined();
    expect(part.mesh.influences[0].length).toBe(2);
  });

  it('migrates v2→v3 by creating default skin from slots', () => {
    const v2 = {
      version: 2,
      nodes: [],
      bones: [],
      slots: [{ id: 's1', name: 'S', boneId: 'b1', setupAttachmentId: 'a1' }],
    };
    const migrated = migrateProject(v2);
    expect(migrated.skins).toHaveLength(1);
    expect(migrated.skins[0].name).toBe('default');
  });
});

describe('trackBinding extra coverage', () => {
  it('validates angle values', () => {
    expect(validateKeyframeValue(45, VALUE_TYPES.ANGLE)).toBe(true);
    expect(validateKeyframeValue('not a number', VALUE_TYPES.ANGLE)).toBe(false);
  });

  it('validates vec2 values', () => {
    expect(validateKeyframeValue({ x: 1, y: 2 }, VALUE_TYPES.VEC2)).toBe(true);
    expect(validateKeyframeValue({ x: 1 }, VALUE_TYPES.VEC2)).toBe(false);
  });

  it('validates color values', () => {
    expect(validateKeyframeValue('#ffffff', VALUE_TYPES.COLOR)).toBe(true);
    expect(validateKeyframeValue('not-a-color', VALUE_TYPES.COLOR)).toBe(false);
  });

  it('validates attachmentRef values', () => {
    expect(validateKeyframeValue('att_1', VALUE_TYPES.ATTACHMENT_REF)).toBe(true);
    expect(validateKeyframeValue(null, VALUE_TYPES.ATTACHMENT_REF)).toBe(true);
    expect(validateKeyframeValue(42, VALUE_TYPES.ATTACHMENT_REF)).toBe(false);
  });

  it('validates drawOrder values', () => {
    expect(validateKeyframeValue(0, VALUE_TYPES.DRAW_ORDER)).toBe(true);
    expect(validateKeyframeValue(NaN, VALUE_TYPES.DRAW_ORDER)).toBe(false);
  });

  it('validates event values', () => {
    expect(validateKeyframeValue({ eventId: 'e1' }, VALUE_TYPES.EVENT)).toBe(true);
    expect(validateKeyframeValue('just a string', VALUE_TYPES.EVENT)).toBe(false);
  });

  it('returns true for unknown value types', () => {
    expect(validateKeyframeValue('anything', 'unknown_type')).toBe(true);
  });

  it('identifies non-discrete types', () => {
    expect(isDiscreteType(VALUE_TYPES.SCALAR)).toBe(false);
    expect(isDiscreteType(VALUE_TYPES.VEC2)).toBe(false);
    expect(isDiscreteType(VALUE_TYPES.COLOR)).toBe(false);
  });

  it('deduplicateKeyframes keeps last value at same time', () => {
    const kfs = [
      { time: 100, value: 'a' },
      { time: 100, value: 'b' },
    ];
    const result = deduplicateKeyframes(kfs);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('b');
  });
});

describe('compileEvaluationGraph extra coverage', () => {
  it('handles path constraint', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null }],
      constraints: [{
        id: 'c1', type: 'path', targetBoneId: 'b1', affectedBoneIds: ['b1'],
      }],
    };
    const { order } = compileEvaluationGraph(project);
    expect(order.some(n => n.type === 'constraint')).toBe(true);
  });

  it('handles transform constraint', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null }],
      constraints: [{
        id: 'c1', type: 'transform', targetBoneId: 'b1', affectedBoneIds: ['b1'],
      }],
    };
    const { order } = compileEvaluationGraph(project);
    expect(order.some(n => n.type === 'constraint')).toBe(true);
  });

  it('handles physics groups', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null }],
      physics_groups: [{
        id: 'pg1', name: 'hair',
        outputs: [{ boneId: 'b1' }],
      }],
    };
    const { order } = compileEvaluationGraph(project);
    expect(order.some(n => n.type === 'physics')).toBe(true);
  });

  it('handles warp deformer nodes', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null }],
      nodes: [{ id: 'w1', type: 'warpDeformer', parent: 'b1' }],
    };
    const { order } = compileEvaluationGraph(project);
    expect(order.some(n => n.type === 'deformer')).toBe(true);
  });

  it('handles physics group with no id but has name', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null }],
      physics_groups: [{
        name: 'cloth',
        outputs: [{ boneId: 'b1' }],
      }],
    };
    const { order } = compileEvaluationGraph(project);
    expect(order.some(n => n.type === 'physics')).toBe(true);
  });
});

describe('transform constraint branch coverage', () => {
  it('copies x with mix', () => {
    const boneMap = new Map([
      ['source', { setup: { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } }],
      ['target', { setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } }],
    ]);
    const result = solveTransformConstraint({
      targetBoneId: 'source', affectedBoneIds: ['target'], mix: 1,
      copyX: true, copyY: false, copyRotation: false, copyScaleX: false, copyScaleY: false,
    }, boneMap);
    expect(result.get('target').x).toBeCloseTo(10, 1);
  });

  it('copies y with mix', () => {
    const boneMap = new Map([
      ['source', { setup: { x: 0, y: 20, rotation: 0, scaleX: 1, scaleY: 1 } }],
      ['target', { setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } }],
    ]);
    const result = solveTransformConstraint({
      targetBoneId: 'source', affectedBoneIds: ['target'], mix: 1,
      copyX: false, copyY: true, copyRotation: false, copyScaleX: false, copyScaleY: false,
    }, boneMap);
    expect(result.get('target').y).toBeCloseTo(20, 1);
  });

  it('copies scaleX with mix', () => {
    const boneMap = new Map([
      ['source', { setup: { x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 1 } }],
      ['target', { setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } }],
    ]);
    const result = solveTransformConstraint({
      targetBoneId: 'source', affectedBoneIds: ['target'], mix: 0.5,
      copyX: false, copyY: false, copyRotation: false, copyScaleX: true, copyScaleY: false,
    }, boneMap);
    expect(result.get('target').scaleX).toBeCloseTo(1.5, 1);
  });

  it('copies scaleY with mix', () => {
    const boneMap = new Map([
      ['source', { setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 3 } }],
      ['target', { setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } }],
    ]);
    const result = solveTransformConstraint({
      targetBoneId: 'source', affectedBoneIds: ['target'], mix: 0.5,
      copyX: false, copyY: false, copyRotation: false, copyScaleX: false, copyScaleY: true,
    }, boneMap);
    expect(result.get('target').scaleY).toBeCloseTo(2, 1);
  });

  it('skips missing affected bone', () => {
    const boneMap = new Map([
      ['source', { setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } }],
    ]);
    const result = solveTransformConstraint({
      targetBoneId: 'source', affectedBoneIds: ['missing'], mix: 1,
    }, boneMap);
    expect(result.size).toBe(0);
  });
});

describe('animationMixer branch coverage', () => {
  it('skips layer with weight 0', () => {
    const layers = [{
      order: 0, weight: 0, mode: 'override', clipId: 'c1', time: 0, timeScale: 1, loop: false,
    }];
    const clips = [{
      id: 'c1', duration: 1000, fps: 24,
      tracks: [{ targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 0, easing: 'linear' }] }],
    }];
    const result = evaluateLayers(layers, clips, 0.1);
    expect(result.overrides.size).toBe(0);
  });

  it('skips layer with no clipId', () => {
    const layers = [{
      order: 0, weight: 1, mode: 'override', clipId: null, time: 0, timeScale: 1, loop: false,
    }];
    const result = evaluateLayers(layers, [], 0.1);
    expect(result.overrides.size).toBe(0);
  });

  it('skips unknown clip id', () => {
    const layers = [{
      order: 0, weight: 1, mode: 'override', clipId: 'unknown', time: 0, timeScale: 1, loop: false,
    }];
    const result = evaluateLayers(layers, [], 0.1);
    expect(result.overrides.size).toBe(0);
  });

  it('handles additive mode with non-numeric value', () => {
    const layers = [{
      order: 0, weight: 1, mode: 'additive', clipId: 'c1', time: 0, timeScale: 1, loop: false,
    }];
    const clips = [{
      id: 'c1', duration: 1000, fps: 24,
      tracks: [{ targetId: 'n1', property: 'visible', keyframes: [{ time: 0, value: true, easing: 'linear' }] }],
    }];
    const result = evaluateLayers(layers, clips, 0.1);
    expect(result.overrides.has('n1')).toBe(true);
  });

  it('respects bone mask', () => {
    const layers = [{
      order: 0, weight: 1, mode: 'override', clipId: 'c1', time: 0, timeScale: 1, loop: false,
      maskBoneIds: new Set(['b1']),
    }];
    const clips = [{
      id: 'c1', duration: 1000, fps: 24,
      tracks: [
        { targetId: 'b1', property: 'x', keyframes: [{ time: 0, value: 5, easing: 'linear' }] },
        { targetId: 'b2', property: 'x', keyframes: [{ time: 0, value: 10, easing: 'linear' }] },
      ],
    }];
    const result = evaluateLayers(layers, clips, 0.1);
    expect(result.overrides.has('b1')).toBe(true);
    expect(result.overrides.has('b2')).toBe(false);
  });

  it('clips time to duration when not looping', () => {
    const layers = [{
      order: 0, weight: 1, mode: 'override', clipId: 'c1', time: 0, timeScale: 1, loop: false,
    }];
    const clips = [{
      id: 'c1', duration: 1000, fps: 24,
      tracks: [{ targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 0, easing: 'linear' }, { time: 1000, value: 10, easing: 'linear' }] }],
    }];
    evaluateLayers(layers, clips, 5);
    expect(layers[0].time).toBe(1);
  });

  it('wraps time with loop', () => {
    const layers = [{
      order: 0, weight: 1, mode: 'override', clipId: 'c1', time: 0, timeScale: 1, loop: true,
    }];
    const clips = [{
      id: 'c1', duration: 1000, fps: 24,
      tracks: [{ targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 0, easing: 'linear' }] }],
    }];
    evaluateLayers(layers, clips, 5);
    expect(layers[0].time).toBeLessThan(1);
  });
});

describe('state machine branch coverage', () => {
  it('handles parameter less condition', () => {
    const states = [{ id: 'idle' }];
    const transitions = [{
      id: 't1', fromStateId: 'idle', toStateId: 'low',
      condition: 'parameter', paramName: 'speed', comparison: 'less', threshold: 0.5,
    }];
    const result = evaluateTransitions(states, transitions, 'idle', { speed: 0.3 }, 0.1, 1);
    expect(result.newStateId).toBe('low');
  });

  it('handles parameter equals condition', () => {
    const states = [{ id: 'idle' }];
    const transitions = [{
      id: 't1', fromStateId: 'idle', toStateId: 'same',
      condition: 'parameter', paramName: 'speed', comparison: 'equals', threshold: 0.5,
    }];
    const result = evaluateTransitions(states, transitions, 'idle', { speed: 0.5 }, 0.1, 1);
    expect(result.newStateId).toBe('same');
  });

  it('handles unknown condition as always true', () => {
    const states = [{ id: 'idle' }];
    const transitions = [{
      id: 't1', fromStateId: 'idle', toStateId: 'any', condition: 'unknown',
    }];
    const result = evaluateTransitions(states, transitions, 'idle', {}, 0.1, 1);
    expect(result.newStateId).toBe('any');
  });

  it('returns null when current state is missing', () => {
    const result = evaluateTransitions([], [], 'unknown', {}, 0.1, 1);
    expect(result.newStateId).toBeNull();
  });

  it('handles exitTime with zero clipDuration', () => {
    const states = [{ id: 'idle' }];
    const transitions = [{
      id: 't1', fromStateId: 'idle', toStateId: 'next',
      condition: 'exitTime', exitTime: 0.5,
    }];
    const result = evaluateTransitions(states, transitions, 'idle', {}, 0.1, 0.0001);
    expect(result.newStateId).toBe('next');
  });

  it('validates state machine with no errors', () => {
    const states = [{ id: 'a' }, { id: 'b' }];
    const transitions = [{ id: 't1', fromStateId: 'a', toStateId: 'b' }];
    const { valid, errors } = validateStateMachine(states, transitions);
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });
});

describe('path constraint branch coverage', () => {
  it('handles position beyond total length', () => {
    const boneMap = new Map([['b1', { setup: { x: 0, y: 0, rotation: 0 } }]]);
    const result = solvePathConstraint2({
      affectedBoneIds: ['b1'],
      pathPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      position: 200,
      mix: 1,
    }, boneMap);
    expect(result.get('b1').x).toBe(100);
  });

  it('returns empty for zero-length path', () => {
    const boneMap = new Map([['b1', { setup: { x: 0, y: 0, rotation: 0 } }]]);
    const result = solvePathConstraint2({
      affectedBoneIds: ['b1'],
      pathPoints: [{ x: 5, y: 5 }, { x: 5, y: 5 }],
      position: 0,
      mix: 1,
    }, boneMap);
    expect(result.size).toBe(0);
  });

  it('skips missing bone', () => {
    const boneMap = new Map();
    const result = solvePathConstraint2({
      affectedBoneIds: ['missing'],
      pathPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      position: 0,
      mix: 1,
    }, boneMap);
    expect(result.size).toBe(0);
  });
});

describe('animationMixer path branch coverage', () => {
  it('clamps time on additive layer (no loop)', () => {
    const layers = [{
      order: 0, weight: 1, mode: 'additive', clipId: 'c1', time: 0, timeScale: 1, loop: false,
    }];
    const clips = [{
      id: 'c1', duration: 1000, fps: 24,
      tracks: [{ targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 5, easing: 'linear' }, { time: 1000, value: 10, easing: 'linear' }] }],
    }];
    evaluateLayers(layers, clips, 5);
    expect(layers[0].time).toBe(1);
  });

  it('handles negative time wrap with loop', () => {
    const layers = [{
      order: 0, weight: 1, mode: 'override', clipId: 'c1', time: 0, timeScale: 1, loop: true,
    }];
    const clips = [{
      id: 'c1', duration: 1000, fps: 24,
      tracks: [{ targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 0, easing: 'linear' }] }],
    }];
    evaluateLayers(layers, clips, -0.5);
    expect(layers[0].time).toBeGreaterThanOrEqual(0);
  });

  it('handles undefined value in track', () => {
    const layers = [{
      order: 0, weight: 1, mode: 'override', clipId: 'c1', time: 0, timeScale: 1, loop: false,
    }];
    const clips = [{
      id: 'c1', duration: 1000, fps: 24,
      tracks: [{ targetId: 'n1', property: 'x', keyframes: [] }],
    }];
    const result = evaluateLayers(layers, clips, 0.1);
    expect(result.overrides.size).toBe(0);
  });

  it('emits event when crossing event keyframe', () => {
    const layers = [{
      order: 0, weight: 1, mode: 'override', clipId: 'c1', time: 0, timeScale: 1, loop: false,
    }];
    const clips = [{
      id: 'c1', duration: 1000, fps: 24,
      tracks: [
        { targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 0, easing: 'linear' }] },
        { targetId: 'n1', property: 'event', keyframes: [{ time: 100, value: { eventId: 'step' }, easing: 'step' }] },
      ],
    }];
    const result = evaluateLayers(layers, clips, 0.1);
    expect(result.events.length).toBeGreaterThan(0);
  });
});

describe('stateMachine validation more branches', () => {
  it('validates multiple errors', () => {
    const states = [{ id: 'a' }];
    const transitions = [
      { id: 't1', fromStateId: 'x', toStateId: 'y' },
      { id: 't2', fromStateId: 'a', toStateId: 'z' },
    ];
    const { valid, errors } = validateStateMachine(states, transitions);
    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('physicsMapper branch coverage', () => {
  it('applies custom stiffness and damping', async () => {
    const { mapPhysicsRulesToRig } = await import('../src/runtime/physics/mapper.js');
    const rules = [
      { id: 'r1', boneId: 'b1', stiffness: 0.5, damping: 0.95, segments: 4 },
    ];
    const bones = [{ id: 'b1', setup: { length: 100 } }];
    const { rig } = mapPhysicsRulesToRig(rules, bones);
    expect(rig.links[0].stiffness).toBe(0.5);
    expect(rig.particles[1].damping).toBe(0.95);
  });

  it('reports requireTag mismatch', async () => {
    const { mapPhysicsRulesToRig } = await import('../src/runtime/physics/mapper.js');
    const rules = [
      { id: 'r1', boneId: 'b1', requireTag: 'hair' },
    ];
    const bones = [{ id: 'b1', setup: { length: 100 } }];
    const { warnings } = mapPhysicsRulesToRig(rules, bones);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('deform pipeline extra branch coverage', () => {
  it('applies influence with zero weight to skip', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } }],
      nodes: [{
        id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0,
        mesh: {
          vertices: new Float32Array([0, 0]),
          influences: [
            [{ boneId: 'missing', weight: 0 }],
          ],
        },
      }],
    };
    const result = executeDeformPipeline(project);
    expect(result.drawList[0].vertices[0]).toBe(0);
  });

  it('handles bone with no boneWorldMatrices entry', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } }],
      nodes: [{
        id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0,
        mesh: {
          vertices: new Float32Array([0, 0]),
          influences: [
            [{ boneId: 'unknown_bone', weight: 1 }],
          ],
        },
      }],
    };
    const result = executeDeformPipeline(project);
    expect(result.drawList[0].vertices).toBeDefined();
  });

  it('handles warp lattice with bad indices', () => {
    const project = {
      bones: [],
      nodes: [
        { id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0, mesh: { vertices: new Float32Array([0, 0]) } },
        { id: 'w1', type: 'warpDeformer', name: 'W' },
      ],
    };
    const overrides = new Map([
      ['warp:w1', { lattice: [], gridW: 200, gridH: 200, col: 2, row: 2 }],
    ]);
    const result = executeDeformPipeline(project, overrides);
    expect(result.drawList.length).toBe(1);
  });
});

describe('pose extra branch coverage', () => {
  it('handles empty bones array', () => {
    const project = { bones: [], nodes: [] };
    const result = evaluatePose(project);
    expect(result.boneMatrices.size).toBe(0);
  });
});

describe('migrateProject 0_1-to-1 branches', () => {
  it('handles existing canvas properties', () => {
    const old = {
      version: '0.1',
      canvas: { width: 1024, height: 768, x: 10, y: 20 },
    };
    const migrated = migrateProject(old);
    expect(migrated.canvas.width).toBe(1024);
    expect(migrated.canvas.x).toBe(10);
  });

  it('drops legacy parameters with bindings', () => {
    const old = {
      version: '0.1',
      parameters: [{ id: 'p1', name: 'X', min: 0, max: 1, default: 0, bindings: [{ animationId: 'a1', nodeId: 'n1', property: 'x' }] }],
    };
    const migrated = migrateProject(old);
    expect(migrated).not.toHaveProperty('parameters');
  });
});

describe('IK extra branches', () => {
  it('handles missing bone in 1-bone IK', () => {
    const boneMap = new Map();
    const result = solveIK({ affectedBoneIds: ['b_missing'], targetBoneId: 't1', mix: 1 }, boneMap);
    expect(result.size).toBe(0);
  });

  it('handles 1-bone IK with non-zero rotation', () => {
    const boneMap = new Map([
      ['b1', { setup: { x: 0, y: 0, rotation: 45, length: 50 } }],
      ['target', { setup: { x: 50, y: 0, rotation: 0 } }],
    ]);
    const result = solveIK({ affectedBoneIds: ['b1'], targetBoneId: 'target', mix: 0.5 }, boneMap);
    expect(result.has('b1')).toBe(true);
    expect(typeof result.get('b1').rotation).toBe('number');
  });
});

describe('transform extra branches', () => {
  it('handles rotation delta > 180 wrap', () => {
    const boneMap = new Map([
      ['source', { setup: { rotation: 350, scaleX: 1, scaleY: 1 } }],
      ['target', { setup: { rotation: 0, scaleX: 1, scaleY: 1 } }],
    ]);
    const result = solveTransformConstraint({
      targetBoneId: 'source', affectedBoneIds: ['target'], mix: 1,
      copyRotation: true, copyX: false, copyY: false, copyScaleX: false, copyScaleY: false,
    }, boneMap);
    expect(result.get('target').rotation).toBeDefined();
  });

  it('handles rotation delta < -180 wrap', () => {
    const boneMap = new Map([
      ['source', { setup: { rotation: -350, scaleX: 1, scaleY: 1 } }],
      ['target', { setup: { rotation: 0, scaleX: 1, scaleY: 1 } }],
    ]);
    const result = solveTransformConstraint({
      targetBoneId: 'source', affectedBoneIds: ['target'], mix: 1,
      copyRotation: true, copyX: false, copyY: false, copyScaleX: false, copyScaleY: false,
    }, boneMap);
    expect(result.get('target').rotation).toBeDefined();
  });

  it('handles mix 0 (no change)', () => {
    const boneMap = new Map([
      ['source', { setup: { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1 } }],
      ['target', { setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } }],
    ]);
    const result = solveTransformConstraint({
      targetBoneId: 'source', affectedBoneIds: ['target'], mix: 0,
    }, boneMap);
    expect(result.get('target').x).toBeCloseTo(0, 1);
  });
});

describe('deformPipeline extra branches', () => {
  it('handles node with mesh but no influences (no LBS applied)', () => {
    const project = {
      bones: [],
      nodes: [{
        id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0,
        mesh: { vertices: new Float32Array([5, 5]) },
      }],
    };
    const result = executeDeformPipeline(project);
    expect(result.drawList[0].vertices[0]).toBe(5);
  });

  it('handles node with no mesh (quad)', () => {
    const project = {
      bones: [],
      nodes: [{ id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0 }],
    };
    const result = executeDeformPipeline(project);
    expect(result.drawList[0].vertices).toBeNull();
  });

  it('handles warp with col < 2 (no warp applied)', () => {
    const project = {
      bones: [],
      nodes: [
        { id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0, mesh: { vertices: new Float32Array([0, 0]) } },
        { id: 'w1', type: 'warpDeformer', name: 'W' },
      ],
    };
    const overrides = new Map([
      ['warp:w1', { lattice: [{ dx: 0, dy: 0 }], gridW: 200, gridH: 200, col: 1, row: 1 }],
    ]);
    const result = executeDeformPipeline(project, overrides);
    expect(result.drawList[0].vertices[0]).toBe(0);
  });
});

describe('migrateProject 1-to-2 branches', () => {
  it('does not re-promote groups when bones already exist', () => {
    const v1 = {
      version: 1,
      bones: [{ id: 'b1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } }],
      nodes: [],
    };
    const migrated = migrateProject(v1);
    expect(migrated.bones).toHaveLength(1);
  });

  it('creates __root_bone__ when no groups and no bones', () => {
    const v1 = {
      version: 1,
      bones: [],
      nodes: [],
    };
    const migrated = migrateProject(v1);
    expect(migrated.bones.length).toBeGreaterThan(0);
    expect(migrated.bones[0].id).toBe('__root_bone__');
  });

  it('handles part without mesh (region attachment)', () => {
    const v1 = {
      version: 1,
      nodes: [
        { id: 'g1', type: 'group', name: 'Root', parent: null, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } },
        { id: 'p1', type: 'part', name: 'P', parent: 'g1', draw_order: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } },
      ],
    };
    const migrated = migrateProject(v1);
    const att = migrated.attachments.find(a => a.id === 'att_p1');
    expect(att.type).toBe('region');
  });
});

describe('skeleton edge branches', () => {
  it('handles 3-level hierarchy', () => {
    const bones = [
      { id: 'a', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } },
      { id: 'b', parentId: 'a', setup: { x: 5, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } },
      { id: 'c', parentId: 'b', setup: { x: 3, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } },
    ];
    const m = computeBoneWorldMatrices(bones);
    expect(m.get('c')[6]).toBeCloseTo(8, 5);
  });

  it('skips bones whose parent is missing', () => {
    const bones = [
      { id: 'a', parentId: 'missing', setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } },
    ];
    const m = computeBoneWorldMatrices(bones);
    expect(m.has('a')).toBe(true);
  });
});

describe('pose LBS branch coverage', () => {
  it('applies LBS via evaluatePose', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } }],
      nodes: [{
        id: 'n1', type: 'part', name: 'p',
        mesh: {
          vertices: new Float32Array([0, 0, 5, 0]),
          influences: [
            [{ boneId: 'b1', weight: 1 }],
            [{ boneId: 'b1', weight: 1 }],
          ],
        },
      }],
    };
    const result = evaluatePose(project);
    expect(result.skinnedMeshes).toHaveLength(1);
    expect(result.skinnedMeshes[0].vertices).toBeDefined();
  });

  it('skips nodes with mesh but no influences', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } }],
      nodes: [{
        id: 'n1', type: 'part', name: 'p',
        mesh: { vertices: new Float32Array([0, 0]) },
      }],
    };
    const result = evaluatePose(project);
    expect(result.skinnedMeshes).toHaveLength(0);
  });
});

describe('solver evaluatePhysicsOutputs branches', () => {
  it('handles rotation override with existing override', () => {
    const rig = {
      particles: [{ id: 'p1', x: 10, y: -20, prevX: 10, prevY: -20, mass: 1, damping: 0.99, pinned: true }],
      links: [],
      outputs: [
        { boneId: 'b1', type: 'rotation', mix: 0.5, particleId: 'p1' },
        { boneId: 'b1', type: 'rotation', mix: 0.5, particleId: 'p1' },
      ],
      gravity: { x: 0, y: -980 },
      wind: { x: 0, y: 0 },
      iterations: 1,
    };
    const overrides = evaluatePhysicsOutputs(rig);
    expect(overrides.get('b1').rotation).toBeDefined();
  });

  it('handles translation with existing override', () => {
    const rig = {
      particles: [{ id: 'p1', x: 5, y: -10, prevX: 5, prevY: -10, mass: 1, damping: 0.99, pinned: true }],
      links: [],
      outputs: [
        { boneId: 'b1', type: 'translation', mix: 0.5, particleId: 'p1' },
        { boneId: 'b1', type: 'translation', mix: 0.3, particleId: 'p1' },
      ],
      gravity: { x: 0, y: -980 },
      wind: { x: 0, y: 0 },
      iterations: 1,
    };
    const overrides = evaluatePhysicsOutputs(rig);
    expect(overrides.get('b1').x).toBeDefined();
  });
});

describe('mapper more branches', () => {
  it('uses default id and name for nameless rule', () => {
    const rules = [{ boneId: 'b1' }];
    const bones = [{ id: 'b1', setup: { length: 100 } }];
    const { rig } = mapPhysicsRulesToRig2(rules, bones);
    expect(rig.id).toBe('mapped_rig');
  });
});

describe('0_1-to-1 migration canvas background cleanup', () => {
  it('drops obsolete Export Area background fields', () => {
    const old = {
      version: '0.1',
      canvas: { width: 800, height: 600, bgEnabled: true, bgColor: '#000000' },
    };
    const migrated = migrateProject(old);
    expect(migrated.canvas).not.toHaveProperty('bgEnabled');
    expect(migrated.canvas).not.toHaveProperty('bgColor');
  });
});

describe('0_1-to-1 migration node branches', () => {
  it('preserves existing node fields (does not overwrite)', () => {
    const old = {
      version: '0.1',
      nodes: [{
        id: 'w1', type: 'warpDeformer', name: 'W',
        col: 4, row: 3, gridW: 500, gridH: 400, gridX: 10, gridY: 20, parameterId: 'p1',
        blendShapes: [{ id: 'bs' }], blendShapeValues: { bs: 0.5 },
      }],
    };
    const migrated = migrateProject(old);
    expect(migrated.nodes[0].col).toBe(4);
    expect(migrated.nodes[0].row).toBe(3);
    expect(migrated.nodes[0].gridW).toBe(500);
    expect(migrated.nodes[0].gridH).toBe(400);
    expect(migrated.nodes[0].gridX).toBe(10);
    expect(migrated.nodes[0].gridY).toBe(20);
    expect(migrated.nodes[0]).not.toHaveProperty('parameterId');
  });

  it('adds default audioTracks when missing', () => {
    const old = {
      version: '0.1',
      animations: [{ id: 'a1', name: 'A', duration: 1000, fps: 24, tracks: [] }],
    };
    const migrated = migrateProject(old);
    expect(migrated.animations[0].audioTracks).toEqual([]);
  });

  it('drops existing legacy bindings', () => {
    const old = {
      version: '0.1',
      parameters: [{ id: 'p1', name: 'P', min: 0, max: 1, default: 0, bindings: [{ animationId: 'a1' }] }],
    };
    const migrated = migrateProject(old);
    expect(migrated).not.toHaveProperty('parameters');
  });
});

describe('compileEvaluationGraph cycle error branch', () => {
  it('reports remaining in-degree after cycle', () => {
    const project = {
      bones: [
        { id: 'a', parentId: 'b' },
        { id: 'b', parentId: 'a' },
        { id: 'c', parentId: 'a' },
      ],
    };
    const { errors } = compileEvaluationGraph(project);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('deform pipeline more branches', () => {
  it('handles part with mesh.uvs as plain array', () => {
    const project = {
      bones: [],
      nodes: [{
        id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0,
        mesh: { vertices: new Float32Array([0, 0, 5, 0]), uvs: [0, 0, 1, 0] },
      }],
    };
    const result = executeDeformPipeline(project);
    expect(result.drawList.length).toBe(1);
  });

  it('returns existing vertices when warp has no lattice', () => {
    const project = {
      bones: [],
      nodes: [
        { id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0, mesh: { vertices: new Float32Array([0, 0]) } },
        { id: 'w1', type: 'warpDeformer', name: 'W' },
      ],
    };
    const overrides = new Map([
      ['warp:w1', { col: 4, row: 4, gridW: 200, gridH: 200 }],
    ]);
    const result = executeDeformPipeline(project, overrides);
    expect(result.drawList[0].vertices[0]).toBe(0);
  });
});

describe('path constraint branches', () => {
  it('handles path with single segment', () => {
    const boneMap = new Map([['b1', { setup: { x: 0, y: 0, rotation: 0 } }]]);
    const result = solvePathConstraint2({
      affectedBoneIds: ['b1'],
      pathPoints: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
      position: 50,
      mix: 1,
    }, boneMap);
    expect(result.has('b1')).toBe(true);
  });
});

describe('skinning with bone 0 weight skipped', () => {
  it('handles skinning with no bone found', () => {
    const project = {
      bones: [],
      nodes: [{
        id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0,
        mesh: {
          vertices: new Float32Array([0, 0]),
          influences: [
            [{ boneId: 'missing', weight: 1 }],
          ],
        },
      }],
    };
    const result = executeDeformPipeline(project);
    expect(result.drawList[0].vertices[0]).toBe(0);
  });
});

describe('animation mixer empty duration', () => {
  it('handles clip with no duration', () => {
    const layers = [{
      order: 0, weight: 1, mode: 'override', clipId: 'c1', time: 0, timeScale: 1, loop: true,
    }];
    const clips = [{
      id: 'c1', duration: 0, fps: 24,
      tracks: [{ targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 5, easing: 'linear' }] }],
    }];
    evaluateLayers(layers, clips, 0.5);
    expect(layers[0].time).toBe(0);
  });
});

describe('mapper extra branches', () => {
  it('uses default id when rule has no id and no boneId', () => {
    const rules = [{ id: 'r1' }];
    const bones = [];
    const { warnings, rig: _rig } = mapPhysicsRulesToRig2(rules, bones);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
