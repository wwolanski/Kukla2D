import { describe, it, expect } from 'vitest';
import { createPendulumChain } from '../src/runtime/physics/physicsRig.js';
import { stepPhysics, resetPhysics, evaluatePhysicsOutputs } from '../src/runtime/physics/solver.js';
import { mapPhysicsRulesToRig } from '../src/runtime/physics/mapper.js';
import { bakePhysicsToKeyframes } from '../src/runtime/physics/bake.js';
import { createManualPosePhysicsRuntime, evaluateManualPosePhysics } from '../src/runtime/physics/manualPosePhysics.js';

describe('physicsRig', () => {
  it('creates a pendulum chain with correct structure', () => {
    const chain = createPendulumChain('test', 'Test', 'b1', 100, 3, ['hair']);
    expect(chain.particles).toHaveLength(4);
    expect(chain.links).toHaveLength(3);
    expect(chain.outputs).toHaveLength(1);
    expect(chain.outputs[0].boneId).toBe('b1');
    expect(chain.tags).toContain('hair');
  });

  it('first particle is pinned', () => {
    const chain = createPendulumChain('test', 'Test', 'b1', 100, 3, []);
    expect(chain.particles[0].pinned).toBe(true);
    expect(chain.particles[1].pinned).toBe(false);
  });
});

describe('solver', () => {
  it('does not move pinned particles', () => {
    const chain = createPendulumChain('test', 'Test', 'b1', 100, 2, []);
    chain.particles[0].x = 5;
    stepPhysics(chain, 1 / 60, { x: 0, y: 0 });
    expect(chain.particles[0].x).toBeCloseTo(5, 2);
  });

  it('gravity pulls particles down', () => {
    const chain = createPendulumChain('test', 'Test', 'b1', 100, 2, []);
    const initialY = chain.particles[2].y;
    for (let i = 0; i < 60; i++) {
      stepPhysics(chain, 1 / 60, { x: 0, y: 0 });
    }
    expect(chain.particles[2].y).toBeLessThan(initialY);
  });

  it('reset clears velocities', () => {
    const chain = createPendulumChain('test', 'Test', 'b1', 100, 2, []);
    stepPhysics(chain, 1 / 60, { x: 0, y: 0 });
    resetPhysics(chain);
    for (const p of chain.particles) {
      expect(p.prevX).toBeCloseTo(p.x, 5);
      expect(p.prevY).toBeCloseTo(p.y, 5);
    }
  });

  it('produces deterministic results', () => {
    const chain1 = createPendulumChain('t', 'T', 'b1', 100, 2, []);
    const chain2 = createPendulumChain('t', 'T', 'b1', 100, 2, []);
    for (let i = 0; i < 100; i++) {
      stepPhysics(chain1, 1 / 60, { x: 10 * Math.sin(i), y: 0 });
      stepPhysics(chain2, 1 / 60, { x: 10 * Math.sin(i), y: 0 });
    }
    expect(chain1.particles[2].x).toBeCloseTo(chain2.particles[2].x, 6);
    expect(chain1.particles[2].y).toBeCloseTo(chain2.particles[2].y, 6);
  });

  it('evaluatePhysicsOutputs returns overrides', () => {
    const chain = createPendulumChain('test', 'Test', 'b1', 100, 2, []);
    chain.particles[2].x = 10;
    chain.particles[2].y = -50;
    const overrides = evaluatePhysicsOutputs(chain);
    expect(overrides.has('b1')).toBe(true);
    expect(typeof overrides.get('b1').rotation).toBe('number');
  });
});

describe('manual pose physics runtime', () => {
  it('anchors a configured chain to its bone and produces secondary rotation', () => {
    const runtime = createManualPosePhysicsRuntime();
    const project = {
      bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 10, length: 100 } }],
      physics_groups: [createPendulumChain('hair-chain', 'Hair', 'hair', 100, 2, ['hair'])],
      physicsRules: [],
    };

    runtime.evaluate({
      project,
      effectiveBones: project.bones,
      timestamp: 0,
      enabled: true,
    });
    const movedBones = [{
      ...project.bones[0],
      setup: { ...project.bones[0].setup, x: 50 },
    }];
    const result = runtime.evaluate({
      project,
      effectiveBones: movedBones,
      timestamp: 1000 / 60,
      enabled: true,
    });

    expect(result.active).toBe(true);
    expect(result.overrides.get('hair').rotation).not.toBeCloseTo(10);
  });
});

describe('mapper', () => {
  it('maps physicsRules to rig', () => {
    const rules = [
      { id: 'r1', boneId: 'b1', stiffness: 0.9, damping: 0.98, tags: ['hair'] },
    ];
    const bones = [{ id: 'b1', setup: { length: 80 } }];
    const { rig, warnings } = mapPhysicsRulesToRig(rules, bones);
    expect(rig.particles.length).toBeGreaterThan(0);
    expect(warnings).toEqual([]);
  });

  it('reports missing boneId', () => {
    const rules = [{ id: 'r1', name: 'test' }];
    const { warnings } = mapPhysicsRulesToRig(rules, []);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('bake', () => {
  it('bakes physics to keyframes', () => {
    const chain = createPendulumChain('test', 'Test', 'b1', 100, 2, []);
    const inputs = [
      { time: 0, input: { x: 0, y: 0 } },
      { time: 0.5, input: { x: 10, y: 0 } },
    ];
    const tracks = bakePhysicsToKeyframes(chain, 1, 24, inputs);
    expect(tracks.length).toBeGreaterThan(0);
    expect(tracks[0].keyframes.length).toBeGreaterThan(0);
  });
});

describe('physics policy characterization', () => {
  it('physics evaluates on pre-physics effectiveBones', () => {
    const runtime = createManualPosePhysicsRuntime();
    const project = {
      bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      physics_groups: [createPendulumChain('chain1', 'Hair', 'hair', 100, 2, ['hair'])],
      physicsRules: [],
    };
    runtime.evaluate({ project, effectiveBones: project.bones, timestamp: 0, enabled: true });
    const movedBones = [{ ...project.bones[0], setup: { ...project.bones[0].setup, x: 50 } }];
    const result = runtime.evaluate({ project, effectiveBones: movedBones, timestamp: 1000 / 60, enabled: true });
    expect(result.active).toBe(true);
    expect(result.overrides.has('hair')).toBe(true);
  });

  it('physics disabled returns no overrides', () => {
    const runtime = createManualPosePhysicsRuntime();
    const project = {
      bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      physics_groups: [createPendulumChain('chain1', 'Hair', 'hair', 100, 2, ['hair'])],
      physicsRules: [],
    };
    runtime.evaluate({ project, effectiveBones: project.bones, timestamp: 0, enabled: true });
    const result = runtime.evaluate({ project, effectiveBones: project.bones, timestamp: 1000 / 60, enabled: false });
    expect(result.active).toBe(false);
    expect(result.overrides).toBeNull();
  });

  it('physics override values are relative to bone setup', () => {
    const runtime = createManualPosePhysicsRuntime();
    const project = {
      bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 10, length: 100 } }],
      physics_groups: [createPendulumChain('chain1', 'Hair', 'hair', 100, 2, ['hair'])],
      physicsRules: [],
    };
    runtime.evaluate({ project, effectiveBones: project.bones, timestamp: 0, enabled: true });
    const movedBones = [{ ...project.bones[0], setup: { ...project.bones[0].setup, x: 30 } }];
    const result = runtime.evaluate({ project, effectiveBones: movedBones, timestamp: 1000 / 60, enabled: true });
    expect(result.active).toBe(true);
    const rotation = result.overrides.get('hair').rotation;
    expect(typeof rotation).toBe('number');
    expect(Number.isFinite(rotation)).toBe(true);
  });

  it('physics reset clears state for deterministic restart', () => {
    const runtime = createManualPosePhysicsRuntime();
    const project = {
      bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      physics_groups: [createPendulumChain('chain1', 'Hair', 'hair', 100, 2, ['hair'])],
      physicsRules: [],
    };
    runtime.evaluate({ project, effectiveBones: project.bones, timestamp: 0, enabled: true });
    runtime.evaluate({ project, effectiveBones: project.bones, timestamp: 16, enabled: true });
    runtime.reset();
    const result1 = runtime.evaluate({ project, effectiveBones: project.bones, timestamp: 0, enabled: true });
    const result2 = runtime.evaluate({ project, effectiveBones: project.bones, timestamp: 16, enabled: true });
    expect(result1.active).toBe(true);
    expect(result2.active).toBe(true);
    expect(result2.overrides.get('hair').rotation).toBeCloseTo(0, 2);
  });

  it('applyToFrame merges physics overrides onto baseFrame without callbacks', () => {
    const runtime = createManualPosePhysicsRuntime();
    const project = {
      bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      nodes: [],
      physics_groups: [createPendulumChain('chain1', 'Hair', 'hair', 100, 2, ['hair'])],
      physicsRules: [],
    };
    runtime.evaluate({ project, effectiveBones: project.bones, timestamp: 0, enabled: true });

    const baseFrame = {
      effectiveBones: project.bones,
      effectiveNodes: [],
      poseOverrides: new Map(),
    };

    const result = runtime.applyToFrame({
      baseFrame,
      project,
      editor: { activeTool: 'pose' },
      timestamp: 1000 / 60,
    });
    expect(result.physicsActive).toBe(true);
    expect(result.effectiveBones).toBe(baseFrame.effectiveBones);
    expect(result.effectiveNodes).toBe(baseFrame.effectiveNodes);
    expect(result.poseOverrides.size).toBeGreaterThan(0);
  });

  it('applyToFrame returns baseFrame unchanged when pose tool inactive', () => {
    const runtime = createManualPosePhysicsRuntime();
    const project = {
      bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      physics_groups: [createPendulumChain('chain1', 'Hair', 'hair', 100, 2, ['hair'])],
      physicsRules: [],
    };
    runtime.evaluate({ project, effectiveBones: project.bones, timestamp: 0, enabled: true });

    const baseFrame = {
      effectiveBones: project.bones,
      effectiveNodes: [],
      poseOverrides: new Map(),
    };

    const result = runtime.applyToFrame({
      baseFrame,
      project,
      editor: { activeTool: 'select' },
      timestamp: 1000 / 60,
    });
    expect(result.physicsActive).toBe(false);
    expect(result.poseOverrides).toBe(baseFrame.poseOverrides);
  });

  it('applyToFrame merges with existing poseOverrides', () => {
    const runtime = createManualPosePhysicsRuntime();
    const project = {
      bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      physics_groups: [createPendulumChain('chain1', 'Hair', 'hair', 100, 2, ['hair'])],
      physicsRules: [],
    };
    runtime.evaluate({ project, effectiveBones: project.bones, timestamp: 0, enabled: true });

    const existingOverrides = new Map([['otherBone', { rotation: 99 }]]);
    const baseFrame = {
      effectiveBones: project.bones,
      effectiveNodes: [],
      poseOverrides: existingOverrides,
    };

    const result = runtime.applyToFrame({
      baseFrame,
      project,
      editor: { activeTool: 'pose' },
      timestamp: 1000 / 60,
    });
    expect(result.physicsActive).toBe(true);
    expect(result.poseOverrides.get('otherBone').rotation).toBe(99);
    expect(result.poseOverrides.has('hair')).toBe(true);
  });
});

describe('evaluateManualPosePhysics (pure)', () => {
  it('returns { active: false, overrides: null } when disabled', () => {
    const project = {
      bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      physics_groups: [createPendulumChain('chain1', 'Hair', 'hair', 100, 2, ['hair'])],
      physicsRules: [],
    };
    const result = evaluateManualPosePhysics({
      project,
      effectiveBones: project.bones,
      timestamp: 0,
      enabled: false,
    });
    expect(result.active).toBe(false);
    expect(result.overrides).toBeNull();
  });

  it('returns { active: false, overrides: null } when no physics rigs', () => {
    const project = {
      bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      physics_groups: [],
      physicsRules: [],
    };
    const result = evaluateManualPosePhysics({
      project,
      effectiveBones: project.bones,
      timestamp: 0,
      enabled: true,
    });
    expect(result.active).toBe(false);
    expect(result.overrides).toBeNull();
  });

  it('returns { active: true, overrides: Map } when enabled with valid rig', () => {
    const project = {
      bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      physics_groups: [createPendulumChain('chain1', 'Hair', 'hair', 100, 2, ['hair'])],
      physicsRules: [],
    };
    const result = evaluateManualPosePhysics({
      project,
      effectiveBones: project.bones,
      timestamp: 0,
      enabled: true,
    });
    expect(result.active).toBe(true);
    expect(result.overrides).toBeInstanceOf(Map);
  });

  it('produces deterministic results with same input', () => {
    const project = {
      bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      physics_groups: [createPendulumChain('chain1', 'Hair', 'hair', 100, 2, ['hair'])],
      physicsRules: [],
    };
    const r1 = evaluateManualPosePhysics({
      project,
      effectiveBones: project.bones,
      timestamp: 500,
      enabled: true,
    });
    const r2 = evaluateManualPosePhysics({
      project,
      effectiveBones: project.bones,
      timestamp: 500,
      enabled: true,
    });
    expect(r1.overrides.get('hair').rotation).toBeCloseTo(r2.overrides.get('hair').rotation, 5);
  });

  it('overrides contain numeric values for affected bones', () => {
    const project = {
      bones: [{ id: 'hair', setup: { x: 10, y: 20, rotation: 5, length: 100 } }],
      physics_groups: [createPendulumChain('chain1', 'Hair', 'hair', 100, 2, ['hair'])],
      physicsRules: [],
    };
    const result = evaluateManualPosePhysics({
      project,
      effectiveBones: project.bones,
      timestamp: 0,
      enabled: true,
    });
    expect(result.active).toBe(true);
    const ov = result.overrides.get('hair');
    expect(typeof ov.rotation).toBe('number');
    expect(Number.isFinite(ov.rotation)).toBe(true);
  });

  it('is pure — does not mutate input effectiveBones', () => {
    const project = {
      bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      physics_groups: [createPendulumChain('chain1', 'Hair', 'hair', 100, 2, ['hair'])],
      physicsRules: [],
    };
    const bones = [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }];
    const originalSetup = { ...bones[0].setup };
    evaluateManualPosePhysics({
      project,
      effectiveBones: bones,
      timestamp: 0,
      enabled: true,
    });
    expect(bones[0].setup).toEqual(originalSetup);
  });

  it('is pure — does not mutate project', () => {
    const project = {
      bones: [{ id: 'hair', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
      physics_groups: [createPendulumChain('chain1', 'Hair', 'hair', 100, 2, ['hair'])],
      physicsRules: [],
    };
    const projectSnapshot = structuredClone(project);
    evaluateManualPosePhysics({
      project,
      effectiveBones: project.bones,
      timestamp: 0,
      enabled: true,
    });
    expect(project).toEqual(projectSnapshot);
  });
});
