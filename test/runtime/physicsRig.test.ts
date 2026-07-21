import { describe, expect, it } from 'vitest';
import { createPendulumChain, validatePhysicsRig } from '@/runtime/physics/physicsRig';

describe('createPendulumChain', () => {
  it('creates a rig with correct particle count', () => {
    const rig = createPendulumChain('r1', 'Test Pendulum', 'b1', 100, 3, ['test']);
    expect(rig.id).toBe('r1');
    expect(rig.name).toBe('Test Pendulum');
    expect(rig.particles).toHaveLength(4);
    expect(rig.links).toHaveLength(3);
    expect(rig.outputs[0].type).toBe('rotation');
    expect(rig.outputs[0].boneId).toBe('b1');
  });

  it('pins the first particle', () => {
    const rig = createPendulumChain('r1', 'Pendulum', 'b1', 50, 2, []);
    expect(rig.particles[0].pinned).toBe(true);
    expect(rig.particles[1].pinned).toBe(false);
  });

  it('clamps segments to minimum 1', () => {
    const rig = createPendulumChain('r1', 'Min', 'b1', 100, -5, []);
    expect(rig.particles).toHaveLength(2);
  });

  it('includes tags', () => {
    const rig = createPendulumChain('r1', 'Tagged', 'b1', 100, 1, ['cloth']);
    expect(rig.tags).toContain('cloth');
  });
});

describe('validatePhysicsRig', () => {
  const validRig = {
    id: 'r1',
    name: 'Test Rig',
    particles: [
      { id: 'p0', x: 0, y: 0, prevX: 0, prevY: 0, mass: 1, damping: 0.99, pinned: true },
      { id: 'p1', x: 10, y: 0, prevX: 10, prevY: 0, mass: 1, damping: 0.99, pinned: false },
    ],
    links: [{ fromParticleId: 'p0', toParticleId: 'p1', restLength: 10, stiffness: 0.8 }],
    outputs: [{ type: 'rotation', boneId: 'b1', mix: 1, particleId: 'p1' }],
    gravity: { x: 0, y: -980 },
    wind: { x: 0, y: 0 },
    iterations: 8,
    tags: ['test'],
  };

  it('validates a correct rig', () => {
    const result = validatePhysicsRig(validRig);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rig.id).toBe('r1');
    }
  });

  it('rejects non-object input', () => {
    const result = validatePhysicsRig(null);
    expect(result.ok).toBe(false);
  });

  it('detects duplicate particle IDs', () => {
    const rig = {
      ...validRig,
      particles: [
        { id: 'p0', x: 0, y: 0, prevX: 0, prevY: 0, mass: 1, damping: 0.99, pinned: true },
        { id: 'p0', x: 10, y: 0, prevX: 10, prevY: 0, mass: 1, damping: 0.99, pinned: false },
      ],
    };
    const result = validatePhysicsRig(rig);
    expect(result.ok).toBe(false);
  });

  it('rejects rig without particles', () => {
    const rig = { ...validRig, particles: [] };
    const result = validatePhysicsRig(rig);
    expect(result.ok).toBe(false);
  });

  it('rejects rig with missing link particles', () => {
    const rig = {
      ...validRig,
      links: [{ fromParticleId: 'p0', toParticleId: 'p99', restLength: 10, stiffness: 0.8 }],
    };
    const result = validatePhysicsRig(rig);
    expect(result.ok).toBe(false);
  });

  it('rejects rig with missing output particle', () => {
    const rig = {
      ...validRig,
      outputs: [{ type: 'rotation', boneId: 'b1', mix: 1, particleId: 'p99' }],
    };
    const result = validatePhysicsRig(rig);
    expect(result.ok).toBe(false);
  });
});
