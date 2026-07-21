import { describe, it, expect } from 'vitest';
import { solveIK } from '../src/runtime/constraints/ik.js';
import { solveTransformConstraint } from '../src/runtime/constraints/transform.js';
import { solvePathConstraint } from '../src/runtime/constraints/path.js';
import { executeDeformPipeline } from '../src/runtime/deformPipeline.js';
import { evaluatePose } from '../src/runtime/pose.js';
import { stepPhysics, evaluatePhysicsOutputs } from '../src/runtime/physics/solver.js';
import { createPendulumChain } from '../src/runtime/physics/physicsRig.js';
import { evaluateManualPosePhysics, createManualPosePhysicsRuntime } from '../src/runtime/physics/manualPosePhysics.js';
import { linearBlendSkinning, normalizeInfluences } from '../src/runtime/skin.js';
import { compileEvaluationGraph } from '../src/runtime/compileEvaluationGraph.js';
import { migrateProject } from '../src/schema/migrateProject';
import { createPortableProjectSnapshot, assertJsonSafe, validatePortableSnapshot } from '../src/schema/projectSnapshot';
import { pickPersistedProjectFields, prepareLoadedProjectDocument } from '../src/schema/projectDocumentAdapter';

describe('3-to-4 migration branch closure', () => {
  it('handles non-array nodes in migrate_3_to_4', () => {
    const migrated = migrateProject({
      version: 3,
      nodes: null,
    });
    expect(migrated.version).toBeGreaterThan(3);
    expect(Array.isArray(migrated.nodes)).toBe(true);
  });

  it('handles missing nodes field entirely', () => {
    const migrated = migrateProject({
      version: 3,
    });
    expect(migrated.version).toBeGreaterThan(3);
    expect(Array.isArray(migrated.nodes)).toBe(true);
  });
});

describe('IK 2-bone branch closure', () => {
  it('2-bone IK with point target (targetX/targetY)', () => {
    const boneMap = new Map([
      ['b1', { setup: { x: 0, y: 0, rotation: 0, length: 50 } }],
      ['b2', { setup: { x: 50, y: 0, rotation: 0, length: 50 } }],
    ]);
    const result = solveIK({
      affectedBoneIds: ['b1', 'b2'],
      targetX: 60,
      targetY: 40,
      mix: 1,
      bendPositive: true,
    }, boneMap);
    expect(result.has('b1')).toBe(true);
    expect(result.has('b2')).toBe(true);
  });

  it('2-bone IK returns empty when first bone missing', () => {
    const boneMap = new Map([
      ['b2', { setup: { x: 50, y: 0, rotation: 0, length: 50 } }],
      ['target', { setup: { x: 80, y: 0 } }],
    ]);
    const result = solveIK({
      affectedBoneIds: ['missing', 'b2'],
      targetBoneId: 'target',
      mix: 1,
    }, boneMap);
    expect(result.size).toBe(0);
  });

  it('2-bone IK returns empty when second bone missing', () => {
    const boneMap = new Map([
      ['b1', { setup: { x: 0, y: 0, rotation: 0, length: 50 } }],
      ['target', { setup: { x: 80, y: 0 } }],
    ]);
    const result = solveIK({
      affectedBoneIds: ['b1', 'missing'],
      targetBoneId: 'target',
      mix: 1,
    }, boneMap);
    expect(result.size).toBe(0);
  });

  it('2-bone IK with bones missing setup defaults', () => {
    const boneMap = new Map([
      ['b1', {}],
      ['b2', {}],
      ['target', {}],
    ]);
    const result = solveIK({
      affectedBoneIds: ['b1', 'b2'],
      targetBoneId: 'target',
      mix: 1,
      bendPositive: false,
    }, boneMap);
    expect(result.has('b1')).toBe(true);
    expect(result.has('b2')).toBe(true);
  });

  it('1-bone IK with point target', () => {
    const boneMap = new Map([
      ['b1', { setup: { x: 0, y: 0, rotation: 0 } }],
    ]);
    const result = solveIK({
      affectedBoneIds: ['b1'],
      targetX: 100,
      targetY: 0,
      mix: 1,
    }, boneMap);
    expect(result.has('b1')).toBe(true);
  });
});

describe('transform constraint branch closure', () => {
  it('handles rotation delta > 180 wrapping', () => {
    const boneMap = new Map([
      ['src', { setup: { x: 0, y: 0, rotation: 350, scaleX: 1, scaleY: 1 } }],
      ['tgt', { setup: { x: 0, y: 0, rotation: 10, scaleX: 1, scaleY: 1 } }],
    ]);
    const result = solveTransformConstraint({
      targetBoneId: 'src',
      affectedBoneIds: ['tgt'],
      mix: 1,
    }, boneMap);
    expect(result.has('tgt')).toBe(true);
    expect(result.get('tgt').rotation).toBeCloseTo(-10, 0);
  });

  it('handles rotation delta < -180 wrapping', () => {
    const boneMap = new Map([
      ['src', { setup: { x: 0, y: 0, rotation: 10, scaleX: 1, scaleY: 1 } }],
      ['tgt', { setup: { x: 0, y: 0, rotation: 350, scaleX: 1, scaleY: 1 } }],
    ]);
    const result = solveTransformConstraint({
      targetBoneId: 'src',
      affectedBoneIds: ['tgt'],
      mix: 1,
    }, boneMap);
    expect(result.has('tgt')).toBe(true);
  });

  it('handles missing scaleX/scaleY in source setup', () => {
    const boneMap = new Map([
      ['src', { setup: { x: 0, y: 0, rotation: 0 } }],
      ['tgt', { setup: { x: 0, y: 0, rotation: 0 } }],
    ]);
    const result = solveTransformConstraint({
      targetBoneId: 'src',
      affectedBoneIds: ['tgt'],
      mix: 1,
    }, boneMap);
    expect(result.has('tgt')).toBe(true);
    expect(result.get('tgt').scaleX).toBeCloseTo(1, 5);
    expect(result.get('tgt').scaleY).toBeCloseTo(1, 5);
  });

  it('handles copyX false — x not set on override', () => {
    const boneMap = new Map([
      ['src', { setup: { x: 100, y: 200, rotation: 0, scaleX: 1, scaleY: 1 } }],
      ['tgt', { setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } }],
    ]);
    const result = solveTransformConstraint({
      targetBoneId: 'src',
      affectedBoneIds: ['tgt'],
      mix: 1,
      copyX: false,
    }, boneMap);
    expect(result.get('tgt').x).toBeUndefined();
    expect(result.get('tgt').y).toBeCloseTo(200, 0);
  });

  it('handles copyY false — y not set on override', () => {
    const boneMap = new Map([
      ['src', { setup: { x: 100, y: 200, rotation: 0, scaleX: 1, scaleY: 1 } }],
      ['tgt', { setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } }],
    ]);
    const result = solveTransformConstraint({
      targetBoneId: 'src',
      affectedBoneIds: ['tgt'],
      mix: 1,
      copyY: false,
    }, boneMap);
    expect(result.get('tgt').x).toBeCloseTo(100, 0);
    expect(result.get('tgt').y).toBeUndefined();
  });

  it('handles copyScaleX false — scaleX not set on override', () => {
    const boneMap = new Map([
      ['src', { setup: { x: 0, y: 0, rotation: 0, scaleX: 3, scaleY: 1 } }],
      ['tgt', { setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } }],
    ]);
    const result = solveTransformConstraint({
      targetBoneId: 'src',
      affectedBoneIds: ['tgt'],
      mix: 1,
      copyScaleX: false,
    }, boneMap);
    expect(result.get('tgt').scaleX).toBeUndefined();
    expect(result.get('tgt').scaleY).toBeCloseTo(1, 5);
  });

  it('handles copyScaleY false — scaleY not set on override', () => {
    const boneMap = new Map([
      ['src', { setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 3 } }],
      ['tgt', { setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } }],
    ]);
    const result = solveTransformConstraint({
      targetBoneId: 'src',
      affectedBoneIds: ['tgt'],
      mix: 1,
      copyScaleY: false,
    }, boneMap);
    expect(result.get('tgt').scaleX).toBeCloseTo(1, 5);
    expect(result.get('tgt').scaleY).toBeUndefined();
  });

  it('handles copyRotation false — rotation not set on override', () => {
    const boneMap = new Map([
      ['src', { setup: { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1 } }],
      ['tgt', { setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } }],
    ]);
    const result = solveTransformConstraint({
      targetBoneId: 'src',
      affectedBoneIds: ['tgt'],
      mix: 1,
      copyRotation: false,
    }, boneMap);
    expect(result.get('tgt').rotation).toBeUndefined();
  });
});

describe('path constraint branch closure', () => {
  it('handles empty affectedBoneIds', () => {
    const result = solvePathConstraint({
      affectedBoneIds: [],
      pathPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      position: 50,
      mix: 1,
    }, new Map());
    expect(result.size).toBe(0);
  });

  it('handles empty pathPoints', () => {
    const boneMap = new Map([['b1', { setup: { x: 0, y: 0, rotation: 0 } }]]);
    const result = solvePathConstraint({
      affectedBoneIds: ['b1'],
      pathPoints: [],
      position: 50,
      mix: 1,
    }, boneMap);
    expect(result.size).toBe(0);
  });

  it('handles mix 0', () => {
    const boneMap = new Map([['b1', { setup: { x: 50, y: 50, rotation: 45 } }]]);
    const result = solvePathConstraint({
      affectedBoneIds: ['b1'],
      pathPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      position: 50,
      mix: 0,
    }, boneMap);
    expect(result.has('b1')).toBe(true);
    expect(result.get('b1').x).toBeCloseTo(50, 1);
    expect(result.get('b1').y).toBeCloseTo(50, 1);
  });

  it('handles negative position', () => {
    const boneMap = new Map([['b1', { setup: { x: 0, y: 0, rotation: 0 } }]]);
    const result = solvePathConstraint({
      affectedBoneIds: ['b1'],
      pathPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      position: -50,
      mix: 1,
    }, boneMap);
    expect(result.has('b1')).toBe(true);
    expect(result.get('b1').x).toBeCloseTo(0, 1);
  });

  it('handles midpoint on multi-segment path', () => {
    const boneMap = new Map([['b1', { setup: { x: 0, y: 0, rotation: 0 } }]]);
    const result = solvePathConstraint({
      affectedBoneIds: ['b1'],
      pathPoints: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      position: 50,
      mix: 1,
    }, boneMap);
    expect(result.has('b1')).toBe(true);
    expect(result.get('b1').x).toBeCloseTo(50, 1);
  });

  it('handles default setup values (no x/y/rotation)', () => {
    const boneMap = new Map([['b1', {}]]);
    const result = solvePathConstraint({
      affectedBoneIds: ['b1'],
      pathPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      position: 50,
      mix: 1,
    }, boneMap);
    expect(result.has('b1')).toBe(true);
  });
});

describe('solver branch closure', () => {
  it('stepPhysics with dt > 0.25 clamps accumulator', () => {
    const chain = createPendulumChain('test', 'Test', 'b1', 100, 2, []);
    stepPhysics(chain, 1.0, null);
    expect(chain.particles.length).toBeGreaterThan(0);
  });

  it('stepPhysics with dt = 0 does nothing', () => {
    const chain = createPendulumChain('test', 'Test', 'b1', 100, 2, []);
    const xBefore = chain.particles[1].x;
    stepPhysics(chain, 0, null);
    expect(chain.particles[1].x).toBe(xBefore);
  });

  it('stepPhysics with negative dt ignores it', () => {
    const chain = createPendulumChain('test', 'Test', 'b1', 100, 2, []);
    const xBefore = chain.particles[1].x;
    stepPhysics(chain, -1, null);
    expect(chain.particles[1].x).toBe(xBefore);
  });

  it('evaluatePhysicsOutputs with missing particle', () => {
    const rig = {
      particles: [{ id: 'p1', x: 10, y: -20, prevX: 10, prevY: -20, pinned: true }],
      links: [],
      outputs: [
        { boneId: 'b1', type: 'rotation', mix: 1, particleId: 'missing' },
      ],
      iterations: 1,
    };
    const overrides = evaluatePhysicsOutputs(rig);
    expect(overrides.size).toBe(0);
  });

  it('evaluatePhysicsOutputs with missing root particle', () => {
    const rig = {
      particles: [{ id: 'p1', x: 10, y: -20, prevX: 10, prevY: -20, pinned: true }],
      links: [],
      outputs: [
        { boneId: 'b1', type: 'rotation', mix: 1, particleId: 'p1', rootParticleId: 'missing' },
      ],
      iterations: 1,
    };
    const overrides = evaluatePhysicsOutputs(rig);
    expect(overrides.has('b1')).toBe(true);
    expect(typeof overrides.get('b1').rotation).toBe('number');
  });

  it('evaluatePhysicsOutputs translation type', () => {
    const rig = {
      particles: [
        { id: 'root', x: 0, y: 0, prevX: 0, prevY: 0, pinned: true },
        { id: 'p1', x: 10, y: 20, prevX: 10, prevY: 20, pinned: false },
      ],
      links: [],
      outputs: [
        { boneId: 'b1', type: 'translation', mix: 1, particleId: 'p1', rootParticleId: 'root' },
      ],
      iterations: 1,
    };
    const overrides = evaluatePhysicsOutputs(rig);
    expect(overrides.has('b1')).toBe(true);
    expect(overrides.get('b1').x).toBeCloseTo(10, 1);
    expect(overrides.get('b1').y).toBeCloseTo(20, 1);
  });

  it('evaluatePhysicsOutputs with no root and no pinned particle', () => {
    const rig = {
      particles: [{ id: 'p1', x: 10, y: -20, prevX: 10, prevY: -20, pinned: false }],
      links: [],
      outputs: [
        { boneId: 'b1', type: 'rotation', mix: 1, particleId: 'p1', rootParticleId: 'missing' },
      ],
      iterations: 1,
    };
    const overrides = evaluatePhysicsOutputs(rig);
    expect(overrides.has('b1')).toBe(true);
  });

  it('solver with gravity and wind', () => {
    const chain = createPendulumChain('test', 'Test', 'b1', 100, 2, []);
    chain.gravity = { x: 100, y: -980 };
    chain.wind = { x: 50, y: 0 };
    stepPhysics(chain, 1 / 60, { x: 10, y: 20 });
    expect(chain.particles.length).toBeGreaterThan(0);
  });

  it('solver with linked particles having same position (dist < 0.0001)', () => {
    const chain = createPendulumChain('test', 'Test', 'b1', 100, 2, []);
    chain.particles[1].x = chain.particles[2].x;
    chain.particles[1].y = chain.particles[2].y;
    chain.particles[1].prevX = chain.particles[2].x;
    chain.particles[1].prevY = chain.particles[2].y;
    stepPhysics(chain, 1 / 60, null);
    expect(chain.particles.length).toBeGreaterThan(0);
  });

  it('solver with missing particles for link', () => {
    const chain = createPendulumChain('test', 'Test', 'b1', 100, 2, []);
    chain.links.push({ fromParticleId: 'missing_a', toParticleId: 'missing_b', restLength: 50, stiffness: 1 });
    stepPhysics(chain, 1 / 60, null);
    expect(chain.particles.length).toBeGreaterThan(0);
  });
});

describe('deformPipeline branch closure', () => {
  it('applies bone overrides with x/y/rotation/scaleX/scaleY', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null, setup: { x: 10, y: 20, rotation: 30, scaleX: 1, scaleY: 1 } }],
      nodes: [{
        id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0,
        mesh: {
          vertices: new Float32Array([0, 0]),
          influences: [[{ boneId: 'b1', weight: 1 }]],
        },
      }],
    };
    const overrides = new Map([['b1', { x: 5, y: 10, rotation: 15, scaleX: 2, scaleY: 0.5 }]]);
    const result = executeDeformPipeline(project, overrides);
    expect(result.drawList).toHaveLength(1);
  });

  it('applies bone overrides with partial properties', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null, setup: { x: 10, y: 20, rotation: 30, scaleX: 1, scaleY: 1 } }],
      nodes: [{
        id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0,
        mesh: {
          vertices: new Float32Array([0, 0]),
          influences: [[{ boneId: 'b1', weight: 1 }]],
        },
      }],
    };
    const overrides = new Map([['b1', { rotation: 45 }]]);
    const result = executeDeformPipeline(project, overrides);
    expect(result.drawList).toHaveLength(1);
  });

  it('handles bone not in overrides', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } }],
      nodes: [{
        id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0,
        mesh: {
          vertices: new Float32Array([0, 0]),
          influences: [[{ boneId: 'b1', weight: 1 }]],
        },
      }],
    };
    const overrides = new Map([['b2', { x: 10 }]]);
    const result = executeDeformPipeline(project, overrides);
    expect(result.drawList).toHaveLength(1);
  });

  it('applies blend shape with negative influence', () => {
    const project = {
      bones: [],
      nodes: [{
        id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0,
        mesh: { vertices: new Float32Array([0, 0, 10, 0]) },
        blendShapes: [{ id: 'bs1', name: 'smile', deltas: [{ dx: 5, dy: 0 }, { dx: -5, dy: 0 }] }],
        blendShapeValues: { bs1: -0.5 },
      }],
    };
    const result = executeDeformPipeline(project);
    expect(result.drawList[0].vertices[0]).toBeCloseTo(0, 1);
  });

  it('applies blend shape with missing deltas', () => {
    const project = {
      bones: [],
      nodes: [{
        id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0,
        mesh: { vertices: new Float32Array([0, 0, 10, 0]) },
        blendShapes: [{ id: 'bs1', name: 'smile', deltas: null }],
        blendShapeValues: { bs1: 0.5 },
      }],
    };
    const result = executeDeformPipeline(project);
    expect(result.drawList).toHaveLength(1);
  });

  it('applies blend shape with missing blendShapeValues entry', () => {
    const project = {
      bones: [],
      nodes: [{
        id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0,
        mesh: { vertices: new Float32Array([0, 0, 10, 0]) },
        blendShapes: [{ id: 'bs1', name: 'smile', deltas: [{ dx: 5, dy: 0 }, { dx: -5, dy: 0 }] }],
        blendShapeValues: {},
      }],
    };
    const result = executeDeformPipeline(project);
    expect(result.drawList[0].vertices[0]).toBeCloseTo(0, 4);
  });

  it('applies warp deformation with valid lattice', () => {
    const project = {
      bones: [],
      nodes: [
        { id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0, mesh: { vertices: new Float32Array([50, 50]) } },
        { id: 'w1', type: 'warpDeformer', name: 'W' },
      ],
    };
    const overrides = new Map([
      ['warp:w1', {
        lattice: [
          { dx: 0, dy: 0 }, { dx: 10, dy: 0 },
          { dx: 0, dy: 10 }, { dx: 10, dy: 10 },
        ],
        gridW: 100, gridH: 100, gridX: 0, gridY: 0, col: 2, row: 2,
      }],
    ]);
    const result = executeDeformPipeline(project, overrides);
    expect(result.drawList).toHaveLength(1);
  });

  it('handles warp with null lattice entry', () => {
    const project = {
      bones: [],
      nodes: [
        { id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0, mesh: { vertices: new Float32Array([50, 50]) } },
        { id: 'w1', type: 'warpDeformer', name: 'W' },
      ],
    };
    const overrides = new Map([
      ['warp:w1', {
        lattice: [null, null, null, null],
        gridW: 100, gridH: 100, gridX: 0, gridY: 0, col: 2, row: 2,
      }],
    ]);
    const result = executeDeformPipeline(project, overrides);
    expect(result.drawList).toHaveLength(1);
  });

  it('node with blendShapes but no blendShapeValues', () => {
    const project = {
      bones: [],
      nodes: [{
        id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0,
        mesh: { vertices: new Float32Array([0, 0, 10, 0]) },
        blendShapes: [{ id: 'bs1', name: 'smile', deltas: [{ dx: 5, dy: 0 }, { dx: -5, dy: 0 }] }],
      }],
    };
    const result = executeDeformPipeline(project);
    expect(result.drawList).toHaveLength(1);
  });

  it('node with empty blendShapes array', () => {
    const project = {
      bones: [],
      nodes: [{
        id: 'n1', type: 'part', name: 'p', visible: true, draw_order: 0,
        mesh: { vertices: new Float32Array([0, 0, 10, 0]) },
        blendShapes: [],
        blendShapeValues: { bs1: 0.5 },
      }],
    };
    const result = executeDeformPipeline(project);
    expect(result.drawList).toHaveLength(1);
  });
});

describe('manualPosePhysics branch closure', () => {
  it('evaluateManualPosePhysics with physicsRules fallback (no physics_groups)', () => {
    const result = evaluateManualPosePhysics({
      project: {
        bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
        physics_groups: [],
        physicsRules: [
          { id: 'r1', boneId: 'hair', stiffness: 0.9, damping: 0.98, tags: ['hair'] },
        ],
      },
      effectiveBones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      timestamp: 0,
      enabled: true,
    });
    expect(result.active).toBe(true);
  });

  it('evaluateManualPosePhysics with disabled physicsRules', () => {
    const result = evaluateManualPosePhysics({
      project: {
        bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
        physics_groups: [],
        physicsRules: [
          { id: 'r1', boneId: 'hair', enabled: false },
        ],
      },
      effectiveBones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      timestamp: 0,
      enabled: true,
    });
    expect(result.active).toBe(false);
  });

  it('evaluateManualPosePhysics with physicsRule missing boneId', () => {
    const result = evaluateManualPosePhysics({
      project: {
        bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
        physics_groups: [],
        physicsRules: [
          { id: 'r1', stiffness: 0.9 },
        ],
      },
      effectiveBones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      timestamp: 0,
      enabled: true,
    });
    expect(result.active).toBe(false);
  });

  it('createManualPosePhysicsRuntime rebuilds on project change', () => {
    const runtime = createManualPosePhysicsRuntime();
    const project1 = {
      bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      physics_groups: [createPendulumChain('chain1', 'Hair', 'hair', 100, 2, ['hair'])],
      physicsRules: [],
    };
    runtime.evaluate({ project: project1, effectiveBones: project1.bones, timestamp: 0, enabled: true });

    const project2 = {
      bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      physics_groups: [createPendulumChain('chain2', 'Hair', 'hair', 100, 3, ['hair'])],
      physicsRules: [],
    };
    const result = runtime.evaluate({ project: project2, effectiveBones: project2.bones, timestamp: 16, enabled: true });
    expect(result.active).toBe(true);
  });

  it('createManualPosePhysicsRuntime with physicsRules fallback', () => {
    const runtime = createManualPosePhysicsRuntime();
    const project = {
      bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      physics_groups: [],
      physicsRules: [
        { id: 'r1', boneId: 'hair', stiffness: 0.9, damping: 0.98, tags: ['hair'] },
      ],
    };
    const result = runtime.evaluate({ project, effectiveBones: project.bones, timestamp: 0, enabled: true });
    expect(result.active).toBe(true);
  });

  it('createManualPosePhysicsRuntime with empty rigs after rebuild', () => {
    const runtime = createManualPosePhysicsRuntime();
    const project1 = {
      bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      physics_groups: [createPendulumChain('chain1', 'Hair', 'hair', 100, 2, ['hair'])],
      physicsRules: [],
    };
    runtime.evaluate({ project: project1, effectiveBones: project1.bones, timestamp: 0, enabled: true });

    const project2 = {
      bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      physics_groups: [],
      physicsRules: [],
    };
    const result = runtime.evaluate({ project: project2, effectiveBones: project2.bones, timestamp: 16, enabled: true });
    expect(result.active).toBe(false);
  });

  it('evaluateManualPosePhysics with output bone missing from boneMap', () => {
    const chain = createPendulumChain('chain1', 'Hair', 'missing_bone', 100, 2, ['hair']);
    const result = evaluateManualPosePhysics({
      project: {
        bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
        physics_groups: [chain],
        physicsRules: [],
      },
      effectiveBones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      timestamp: 0,
      enabled: true,
    });
    expect(result.active).toBe(true);
  });
});

describe('compileEvaluationGraph branch closure', () => {
  it('addEdge with target bone not in bones array', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null }],
      constraints: [{
        id: 'c1', type: 'ik', targetBoneId: 'b1',
        affectedBoneIds: ['b_missing_target'],
      }],
    };
    const { order, errors, diagnostics } = compileEvaluationGraph(project);
    expect(order.some(n => n.id === 'b1')).toBe(true);
    expect(errors).toContain('MISSING_BONE: b_missing_target referenced by constraint:c1');
    expect(diagnostics).toContainEqual({
      code: 'MISSING_BONE',
      graphId: 'constraint:c1',
      boneId: 'b_missing_target',
    });
  });

  it('transform constraint with target not in bones', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null }],
      constraints: [{
        id: 'c1', type: 'transform', targetBoneId: 'missing_src',
        affectedBoneIds: ['b1'],
      }],
    };
    const { order } = compileEvaluationGraph(project);
    expect(order.some(n => n.id === 'b1')).toBe(true);
  });

  it('path constraint with target not in bones', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null }],
      constraints: [{
        id: 'c1', type: 'path', targetBoneId: 'missing_path_target',
        affectedBoneIds: ['b1'],
      }],
    };
    const { order } = compileEvaluationGraph(project);
    expect(order.some(n => n.id === 'b1')).toBe(true);
  });

  it('physics group with output bone not in bones array', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null }],
      physics_groups: [{
        id: 'pg1', name: 'hair',
        outputs: [{ boneId: 'missing_physics_bone' }],
      }],
    };
    const { order } = compileEvaluationGraph(project);
    expect(order.some(n => n.type === 'physics')).toBe(true);
  });

  it('warp deformer with parent bone not in bones', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null }],
      nodes: [{ id: 'w1', type: 'warpDeformer', parent: 'missing_parent' }],
    };
    const { order } = compileEvaluationGraph(project);
    expect(order.some(n => n.id === 'w1')).toBe(true);
  });
});

describe('projectSnapshot branch closure', () => {
  it('createPortableProjectSnapshot with Float64Array', () => {
    const project = {
      canvas: { width: 800, height: 600 },
      nodes: [{
        id: 'n1', type: 'part', mesh: {
          vertices: new Float32Array([0, 0]),
          uvs: new Float64Array([0, 0]),
          edgeIndices: new Uint16Array([0]),
          boneWeights: new Float32Array([1]),
        },
      }],
    };
    const snapshot = createPortableProjectSnapshot(project);
    expect(snapshot.nodes[0].mesh.uvs).toEqual([0, 0]);
    expect(Array.isArray(snapshot.nodes[0].mesh.uvs)).toBe(true);
  });

  it('createPortableProjectSnapshot with non-array uvs/edgeIndices', () => {
    const project = {
      canvas: { width: 800, height: 600 },
      nodes: [{
        id: 'n1', type: 'part', mesh: {
          vertices: [0, 0],
          uvs: new Float64Array([0, 1]),
          edgeIndices: new Uint32Array([0, 1]),
        },
      }],
    };
    const snapshot = createPortableProjectSnapshot(project);
    expect(Array.isArray(snapshot.nodes[0].mesh.uvs)).toBe(true);
  });

  it('createPortableProjectSnapshot with node without mesh', () => {
    const project = {
      canvas: { width: 800, height: 600 },
      nodes: [{ id: 'n1', type: 'part' }],
    };
    const snapshot = createPortableProjectSnapshot(project);
    expect(snapshot.nodes[0].mesh).toBeUndefined();
  });

  it('assertJsonSafe passes for valid objects', () => {
    expect(() => assertJsonSafe({ a: 1, b: 'str', c: true })).not.toThrow();
    expect(() => assertJsonSafe([1, 'str', true])).not.toThrow();
    expect(() => assertJsonSafe(null)).not.toThrow();
    expect(() => assertJsonSafe(undefined)).toThrow('undefined');
    expect(() => assertJsonSafe(42)).not.toThrow();
    expect(() => assertJsonSafe('hello')).not.toThrow();
    expect(() => assertJsonSafe(true)).not.toThrow();
  });

  it('assertJsonSafe throws for Float32Array', () => {
    expect(() => assertJsonSafe(new Float32Array([1]))).toThrow('TypedArray');
  });

  it('assertJsonSafe throws for Float64Array', () => {
    expect(() => assertJsonSafe(new Float64Array([1]))).toThrow('TypedArray');
  });

  it('assertJsonSafe throws for Uint8Array', () => {
    expect(() => assertJsonSafe(new Uint8Array([1]))).toThrow('TypedArray');
  });

  it('assertJsonSafe throws for Int32Array', () => {
    expect(() => assertJsonSafe(new Int32Array([1]))).toThrow('TypedArray');
  });

  it('assertJsonSafe throws for Uint16Array', () => {
    expect(() => assertJsonSafe(new Uint16Array([1]))).toThrow('TypedArray');
  });

  it('assertJsonSafe throws for Uint32Array', () => {
    expect(() => assertJsonSafe(new Uint32Array([1]))).toThrow('TypedArray');
  });

  it('assertJsonSafe throws for Set', () => {
    expect(() => assertJsonSafe(new Set([1, 2]))).toThrow('Set');
  });

  it('assertJsonSafe throws for Map', () => {
    expect(() => assertJsonSafe(new Map([['a', 1]]))).toThrow('Map');
  });

  it('assertJsonSafe recursively checks nested TypedArrays', () => {
    expect(() => assertJsonSafe({ nested: new Float32Array([1]) })).toThrow('TypedArray');
  });

  it('assertJsonSafe recursively checks nested Sets in arrays', () => {
    expect(() => assertJsonSafe([new Set([1])])).toThrow('Set');
  });

  it('assertJsonSafe with plain objects', () => {
    expect(() => assertJsonSafe({ a: { b: { c: 1 } } })).not.toThrow();
  });

  it('validatePortableSnapshot validates correctly', () => {
    const project = {
      canvas: { width: 800, height: 600 },
      nodes: [],
      bones: [],
      animations: [],
      version: 8,
    };
    const snapshot = createPortableProjectSnapshot(project);
    const result = validatePortableSnapshot(snapshot);
    expect(result).toBeDefined();
  });
});

describe('skin branch closure', () => {
  it('linearBlendSkinning with undefined influence entry', () => {
    const baseVertices = new Float32Array([0, 0, 10, 0]);
    const influences = [undefined, [{ boneId: 'b1', weight: 1 }]];
    const boneWorldMatrices = new Map([['b1', [1, 0, 0, 0, 1, 0, 5, 10, 1]]]);
    const inverseBindMatrices = new Map([['b1', [1, 0, 0, 0, 1, 0, 0, 0, 1]]]);
    const result = linearBlendSkinning(baseVertices, influences, boneWorldMatrices, inverseBindMatrices);
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(4);
  });

  it('normalizeInfluences with zero sum', () => {
    const influences = [[{ boneId: 'b1', weight: 0 }]];
    const result = normalizeInfluences(influences);
    expect(result).toEqual([[]]);
  });

  it('normalizeInfluences with negative weights', () => {
    const influences = [[{ boneId: 'b1', weight: -1 }, { boneId: 'b2', weight: -2 }]];
    const result = normalizeInfluences(influences);
    expect(result).toEqual([[]]);
  });

  it('normalizeInfluences normalizes to top 4', () => {
    const influences = [[
      { boneId: 'b1', weight: 1 },
      { boneId: 'b2', weight: 2 },
      { boneId: 'b3', weight: 3 },
      { boneId: 'b4', weight: 4 },
      { boneId: 'b5', weight: 5 },
    ]];
    const result = normalizeInfluences(influences);
    expect(result[0].length).toBe(4);
    const sum = result[0].reduce((s, inf) => s + inf.weight, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});

describe('pose branch closure', () => {
  it('handles vertices as object array (x, y objects)', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } }],
      nodes: [{
        id: 'n1', type: 'part', name: 'p',
        mesh: {
          vertices: [{ x: 0, y: 0 }, { x: 5, y: 0 }],
          influences: [
            [{ boneId: 'b1', weight: 1 }],
            [{ boneId: 'b1', weight: 1 }],
          ],
        },
      }],
    };
    const result = evaluatePose(project);
    expect(result.skinnedMeshes).toHaveLength(1);
  });

  it('applies defaultPose override', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } }],
      defaultPose: { b1: { rotation: 45 } },
      nodes: [],
    };
    const result = evaluatePose(project);
    const m = result.boneMatrices.get('b1');
    expect(m).toBeDefined();
  });

  it('applies animation override with y and rotation', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } }],
      nodes: [],
    };
    const overrides = new Map([['b1', { y: 10, rotation: 90, scaleY: 2 }]]);
    const result = evaluatePose(project, overrides);
    const m = result.boneMatrices.get('b1');
    expect(m).toBeDefined();
  });

  it('applies defaultPose combined with animation override', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } }],
      defaultPose: { b1: { rotation: 30 } },
      nodes: [],
    };
    const overrides = new Map([['b1', { rotation: 15 }]]);
    const result = evaluatePose(project, overrides);
    const m = result.boneMatrices.get('b1');
    expect(m).toBeDefined();
  });
});

describe('projectDocumentAdapter branch closure', () => {
  it('prepareLoadedProjectDocument with warpDeformer defaults', () => {
    const result = prepareLoadedProjectDocument({
      nodes: [{ id: 'w1', type: 'warpDeformer', name: 'W' }],
    });
    const warp = result.nodes.find(n => n.id === 'w1');
    expect(warp.col).toBe(2);
    expect(warp.row).toBe(2);
    expect(warp.gridW).toBe(200);
    expect(warp.gridH).toBe(200);
    expect(warp.gridX).toBe(0);
    expect(warp.gridY).toBe(0);
    expect(warp).not.toHaveProperty('parameterId');
  });

  it('prepareLoadedProjectDocument with existing warpDeformer values', () => {
    const result = prepareLoadedProjectDocument({
      nodes: [{ id: 'w1', type: 'warpDeformer', name: 'W', col: 4, row: 3, gridW: 500, gridH: 400, gridX: 10, gridY: 20, parameterId: 'p1' }],
    });
    const warp = result.nodes.find(n => n.id === 'w1');
    expect(warp.col).toBe(4);
    expect(warp.row).toBe(3);
  });

  it('prepareLoadedProjectDocument with node missing blendShapes/blendShapeValues', () => {
    const result = prepareLoadedProjectDocument({
      nodes: [{ id: 'n1', type: 'part', name: 'P' }],
    });
    expect(result.nodes[0].blendShapes).toEqual([]);
    expect(result.nodes[0].blendShapeValues).toEqual({});
  });

  it('prepareLoadedProjectDocument with modifier missing bindings/outputs/params', () => {
    const result = prepareLoadedProjectDocument({
      animationModifiers: [{ id: 'm1', name: 'Mod' }],
    });
    expect(result.animationModifiers[0].bindings).toEqual({});
    expect(result.animationModifiers[0].outputs).toEqual([]);
    expect(result.animationModifiers[0].params).toEqual({});
  });

  it('prepareLoadedProjectDocument with modifier having existing values', () => {
    const result = prepareLoadedProjectDocument({
      animationModifiers: [{
        id: 'm1', name: 'Mod',
        bindings: { a: 1 },
        outputs: [{ id: 'o1' }],
        params: { p: 1 },
      }],
    });
    expect(result.animationModifiers[0].bindings).toEqual({ a: 1 });
    expect(result.animationModifiers[0].outputs).toHaveLength(1);
    expect(result.animationModifiers[0].params).toEqual({ p: 1 });
  });

  it('prepareLoadedProjectDocument drops legacy parameters', () => {
    const result = prepareLoadedProjectDocument({
      parameters: [{ id: 'p1', name: 'X', min: 0, max: 1, default: 0 }],
    });
    expect(result).not.toHaveProperty('parameters');
  });

  it('prepareLoadedProjectDocument with legacy canvas preset (hd-720)', () => {
    const result = prepareLoadedProjectDocument({
      canvas: { width: 1280, height: 720 },
    });
    expect(result.canvas.presetId).toBe('hd-720');
  });

  it('prepareLoadedProjectDocument with legacy canvas preset (full-hd)', () => {
    const result = prepareLoadedProjectDocument({
      canvas: { width: 1920, height: 1080 },
    });
    expect(result.canvas.presetId).toBe('full-hd');
  });

  it('prepareLoadedProjectDocument with custom canvas size', () => {
    const result = prepareLoadedProjectDocument({
      canvas: { width: 123, height: 456 },
    });
    expect(result.canvas.presetId).toBe('custom');
  });

  it('prepareLoadedProjectDocument with explicit presetId', () => {
    const result = prepareLoadedProjectDocument({
      canvas: { width: 800, height: 600, presetId: 'my-preset' },
    });
    expect(result.canvas.presetId).toBe('my-preset');
  });

  it('prepareLoadedProjectDocument with null/undefined input', () => {
    const result = prepareLoadedProjectDocument(null);
    expect(result.version).toBeDefined();
  });

  it('prepareLoadedProjectDocument with all legacy presets', () => {
    const presets = [
      ['square-256', 256, 256],
      ['square-512', 512, 512],
      ['square-1024', 1024, 1024],
      ['pixel-16-9', 640, 360],
      ['portrait-720', 720, 1280],
      ['classic-4-3', 800, 600],
    ];
    for (const [id, w, h] of presets) {
      const result = prepareLoadedProjectDocument({ canvas: { width: w, height: h } });
      expect(result.canvas.presetId).toBe(id);
    }
  });

  it('pickPersistedProjectFields with null/undefined project', () => {
    const result = pickPersistedProjectFields(null);
    expect(result.canvas).toBeDefined();
    expect(result.textures).toBeUndefined();
  });

  it('pickPersistedProjectFields with canvas bgEnabled/bgColor removed', () => {
    const result = pickPersistedProjectFields({
      canvas: { width: 800, height: 600, bgEnabled: true, bgColor: '#000' },
    });
    expect(result.canvas.bgEnabled).toBeUndefined();
    expect(result.canvas.bgColor).toBeUndefined();
  });
});
