import { describe, it, expect } from 'vitest';
import { compileEvaluationGraph } from '../src/runtime/compileEvaluationGraph.js';
import { solveIK } from '../src/runtime/constraints/ik.js';
import { solveTransformConstraint } from '../src/runtime/constraints/transform.js';
import { solvePathConstraint } from '../src/runtime/constraints/path.js';

describe('compileEvaluationGraph', () => {
  it('returns empty order for empty project', () => {
    const { order, errors } = compileEvaluationGraph({});
    expect(order).toEqual([]);
    expect(errors).toEqual([]);
  });

  it('orders bones by parent dependency', () => {
    const project = {
      bones: [
        { id: 'parent', parentId: null },
        { id: 'child', parentId: 'parent' },
      ],
    };
    const { order, errors } = compileEvaluationGraph(project);
    expect(errors).toEqual([]);
    const parentIdx = order.findIndex(n => n.id === 'parent');
    const childIdx = order.findIndex(n => n.id === 'child');
    expect(parentIdx).toBeLessThan(childIdx);
  });

  it('detects cycles', () => {
    const project = {
      bones: [
        { id: 'a', parentId: 'b' },
        { id: 'b', parentId: 'a' },
      ],
    };
    const { errors } = compileEvaluationGraph(project);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('GRAPH_CYCLE');
  });

  it('includes constraint nodes', () => {
    const project = {
      bones: [{ id: 'b1', parentId: null }],
      constraints: [{ id: 'c1', type: 'ik', targetBoneId: 'b1', affectedBoneIds: ['b1'] }],
    };
    const { order } = compileEvaluationGraph(project);
    expect(order.some(n => n.type === 'constraint')).toBe(true);
  });
});

describe('solveIK', () => {
  it('returns empty for missing target', () => {
    const boneMap = new Map();
    const result = solveIK({ affectedBoneIds: ['b1'], targetBoneId: 'missing' }, boneMap);
    expect(result.size).toBe(0);
  });

  it('1-bone IK points toward target', () => {
    const boneMap = new Map([
      ['b1', { setup: { x: 0, y: 0, rotation: 0, length: 50 } }],
      ['target', { setup: { x: 50, y: 0, rotation: 0 } }],
    ]);
    const result = solveIK({ affectedBoneIds: ['b1'], targetBoneId: 'target', mix: 1 }, boneMap);
    expect(result.has('b1')).toBe(true);
    expect(result.get('b1').rotation).toBeCloseTo(0, 1);
  });

  it('2-bone IK with mix=0 returns no override', () => {
    const boneMap = new Map([
      ['b1', { setup: { x: 0, y: 0, rotation: 0, length: 50 } }],
      ['b2', { setup: { x: 50, y: 0, rotation: 0, length: 50 } }],
      ['target', { setup: { x: 80, y: 0, rotation: 0 } }],
    ]);
    const result = solveIK({ affectedBoneIds: ['b1', 'b2'], targetBoneId: 'target', mix: 0 }, boneMap);
    expect(result.size).toBe(0);
  });

  it('2-bone IK places child at solved elbow and points it at target', () => {
    const boneMap = new Map([
      ['upper', { id: 'upper', setup: { x: 0, y: 0, rotation: 0, length: 50 } }],
      ['lower', { id: 'lower', parentId: 'upper', setup: { x: 50, y: 0, rotation: 0, length: 50 } }],
    ]);
    const result = solveIK({
      affectedBoneIds: ['upper', 'lower'],
      targetX: 60,
      targetY: 60,
      mix: 1,
      bendPositive: true,
    }, boneMap);
    const upper = result.get('upper');
    const lower = result.get('lower');
    const tipX = lower.x + Math.cos(lower.rotation * Math.PI / 180) * 50;
    const tipY = lower.y + Math.sin(lower.rotation * Math.PI / 180) * 50;

    expect(upper).toBeDefined();
    expect(lower).toBeDefined();
    expect(tipX).toBeCloseTo(60, 4);
    expect(tipY).toBeCloseTo(60, 4);
  });
});

describe('solveTransformConstraint', () => {
  it('returns empty for missing source', () => {
    const boneMap = new Map([['b1', { setup: { x: 0, y: 0 } }]]);
    const result = solveTransformConstraint({ targetBoneId: 'missing', affectedBoneIds: ['b1'] }, boneMap);
    expect(result.size).toBe(0);
  });

  it('copies rotation with mix', () => {
    const boneMap = new Map([
      ['source', { setup: { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1 } }],
      ['target', { setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } }],
    ]);
    const result = solveTransformConstraint({
      targetBoneId: 'source',
      affectedBoneIds: ['target'],
      mix: 0.5,
      copyRotation: true,
      copyX: false,
      copyY: false,
      copyScaleX: false,
      copyScaleY: false,
    }, boneMap);
    expect(result.has('target')).toBe(true);
    expect(result.get('target').rotation).toBeCloseTo(45, 1);
  });
});

describe('solvePathConstraint', () => {
  it('returns empty for too few path points', () => {
    const boneMap = new Map([['b1', { setup: { x: 0, y: 0, rotation: 0 } }]]);
    const result = solvePathConstraint({
      affectedBoneIds: ['b1'],
      pathPoints: [{ x: 0, y: 0 }],
    }, boneMap);
    expect(result.size).toBe(0);
  });

  it('positions bone at start of path', () => {
    const boneMap = new Map([['b1', { setup: { x: 50, y: 50, rotation: 0 } }]]);
    const result = solvePathConstraint({
      affectedBoneIds: ['b1'],
      pathPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      position: 0,
      mix: 1,
    }, boneMap);
    expect(result.has('b1')).toBe(true);
    expect(result.get('b1').x).toBeCloseTo(0, 1);
    expect(result.get('b1').y).toBeCloseTo(0, 1);
  });

  it('positions bone at end of path', () => {
    const boneMap = new Map([['b1', { setup: { x: 0, y: 0, rotation: 0 } }]]);
    const result = solvePathConstraint({
      affectedBoneIds: ['b1'],
      pathPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      position: 100,
      mix: 1,
    }, boneMap);
    expect(result.has('b1')).toBe(true);
    expect(result.get('b1').x).toBeCloseTo(100, 1);
  });
});
