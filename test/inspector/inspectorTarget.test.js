import { describe, it, expect } from 'vitest';
import {
  resolveEffectiveInspectorNode,
  resolveEffectiveInspectorTarget,
} from '@/features/inspector/application/useEffectiveInspectorTarget';
import { normalizeInfluences } from '@/features/inspector/domain/normalizeInfluences';

describe('resolveEffectiveInspectorNode', () => {
  const node = {
    id: 'part-1',
    type: 'part',
    name: 'Part 1',
    transform: { x: 1, y: 2, rotation: 3, scaleX: 1, scaleY: 1 },
    opacity: 0.7,
    visible: true,
    blendShapeValues: { smile: 0.1 },
    blendShapes: [{ id: 'smile' }],
  };

  const activeAnimation = {
    id: 'walk',
    tracks: [
      { targetId: 'part-1', property: 'x', keyframes: [{ time: 1000, value: 20 }] },
      { targetId: 'part-1', property: 'y', keyframes: [{ time: 1000, value: 50 }] },
      { targetId: 'part-1', property: 'blendShape:smile', keyframes: [{ time: 1000, value: 0.4 }] },
    ],
  };

  it('returns source node outside animation mode', () => {
    expect(resolveEffectiveInspectorNode({
      node,
      editorMode: 'design',
      activeAnimation,
      currentTime: 1000,
      draftPose: new Map(),
      loopKeyframes: false,
      fps: 30,
      endFrame: 30,
    })).toBe(node);
  });

  it('applies keyframe overrides before draft overrides', () => {
    const result = resolveEffectiveInspectorNode({
      node,
      editorMode: 'animation',
      activeAnimation,
      currentTime: 1000,
      draftPose: new Map([
        ['part-1', {
          x: 30,
          opacity: 0.25,
          visible: false,
          'blendShape:smile': 0.8,
        }],
      ]),
      loopKeyframes: false,
      fps: 30,
      endFrame: 30,
    });

    expect(result).toMatchObject({
      id: 'part-1',
      transform: { x: 30, y: 50, rotation: 3, scaleX: 1, scaleY: 1 },
      opacity: 0.25,
      visible: false,
      blendShapeValues: { smile: 0.8 },
    });
  });
});

describe('resolveEffectiveInspectorTarget', () => {
  const sharedNode = {
    id: 'shared',
    type: 'part',
    name: 'Shared node',
    transform: { x: 1, y: 2 },
    blendShapes: [],
  };
  const sharedBone = {
    id: 'shared',
    name: 'Shared bone',
    setup: {},
  };

  it('returns multiple before any other mode', () => {
    expect(resolveEffectiveInspectorTarget({
      selection: ['node-a', 'bone-a'],
      nodes: [sharedNode],
      bones: [sharedBone],
      constraints: [{ id: 'constraint-a' }],
      editorMode: 'design',
      activeBoneId: 'bone-a',
      activeConstraintId: 'constraint-a',
      activeAnimation: null,
      currentTime: 0,
      draftPose: new Map(),
      loopKeyframes: false,
      fps: 30,
      endFrame: 30,
    })).toEqual({ mode: 'multiple', target: null });
  });

  it('prefers node over bone and constraint', () => {
    const result = resolveEffectiveInspectorTarget({
      selection: ['shared'],
      nodes: [sharedNode],
      bones: [sharedBone],
      constraints: [{ id: 'constraint-a' }],
      editorMode: 'design',
      activeBoneId: 'bone-a',
      activeConstraintId: 'constraint-a',
      activeAnimation: null,
      currentTime: 0,
      draftPose: new Map(),
      loopKeyframes: false,
      fps: 30,
      endFrame: 30,
    });

    expect(result.mode).toBe('node');
    expect(result.target).toBe(sharedNode);
  });

  it('falls back to active bone before active constraint', () => {
    const bone = { id: 'bone-a', name: 'Bone A', setup: {} };
    const constraint = { id: 'constraint-a', name: 'Constraint A' };

    const result = resolveEffectiveInspectorTarget({
      selection: [],
      nodes: [],
      bones: [bone],
      constraints: [constraint],
      editorMode: 'design',
      activeBoneId: 'bone-a',
      activeConstraintId: 'constraint-a',
      activeAnimation: null,
      currentTime: 0,
      draftPose: new Map(),
      loopKeyframes: false,
      fps: 30,
      endFrame: 30,
    });

    expect(result).toEqual({ mode: 'bone', target: bone });
  });

  it('falls back to active constraint when no bone target exists', () => {
    const constraint = { id: 'constraint-a', name: 'Constraint A' };

    const result = resolveEffectiveInspectorTarget({
      selection: [],
      nodes: [],
      bones: [],
      constraints: [constraint],
      editorMode: 'design',
      activeBoneId: null,
      activeConstraintId: 'constraint-a',
      activeAnimation: null,
      currentTime: 0,
      draftPose: new Map(),
      loopKeyframes: false,
      fps: 30,
      endFrame: 30,
    });

    expect(result).toEqual({ mode: 'constraint', target: constraint });
  });
});

describe('resolveEffectiveInspectorBone', () => {
  const bone = {
    id: 'bone-1',
    name: 'Spine',
    setup: { x: 5, y: 10, rotation: 15, scaleX: 1, scaleY: 1 },
  };

  const activeAnimation = {
    id: 'anim-1',
    tracks: [
      { targetId: 'bone-1', property: 'x', keyframes: [{ time: 500, value: 25 }] },
      { targetId: 'bone-1', property: 'rotation', keyframes: [{ time: 500, value: 45 }] },
    ],
  };

  it('returns raw bone outside animation mode', () => {
    const result = resolveEffectiveInspectorTarget({
      selection: ['bone-1'],
      nodes: [],
      bones: [bone],
      constraints: [],
      editorMode: 'design',
      activeBoneId: null,
      activeConstraintId: null,
      activeAnimation,
      currentTime: 500,
      draftPose: new Map(),
      loopKeyframes: false,
      fps: 24,
      endFrame: 48,
    });

    expect(result.mode).toBe('bone');
    expect(result.target).toBe(bone);
  });

  it('applies keyframe overrides to bone setup in animation mode', () => {
    const result = resolveEffectiveInspectorTarget({
      selection: ['bone-1'],
      nodes: [],
      bones: [bone],
      constraints: [],
      editorMode: 'animation',
      activeBoneId: null,
      activeConstraintId: null,
      activeAnimation,
      currentTime: 500,
      draftPose: new Map(),
      loopKeyframes: false,
      fps: 24,
      endFrame: 48,
    });

    expect(result.mode).toBe('bone');
    expect(result.target.setup.x).toBe(25);
    expect(result.target.setup.rotation).toBe(45);
    expect(result.target.setup.y).toBe(10);
  });

  it('applies draft overrides on top of keyframe overrides', () => {
    const result = resolveEffectiveInspectorTarget({
      selection: ['bone-1'],
      nodes: [],
      bones: [bone],
      constraints: [],
      editorMode: 'animation',
      activeBoneId: null,
      activeConstraintId: null,
      activeAnimation,
      currentTime: 500,
      draftPose: new Map([['bone-1', { x: 99 }]]),
      loopKeyframes: false,
      fps: 24,
      endFrame: 48,
    });

    expect(result.target.setup.x).toBe(99);
    expect(result.target.setup.rotation).toBe(45);
  });
});

describe('resolveEffectiveInspectorConstraint', () => {
  const constraint = {
    id: 'ik-1',
    name: 'IK Arm',
    targetX: 100,
    targetY: 200,
    mix: 1,
    fkIk: 1,
    bendPositive: true,
  };

  const activeAnimation = {
    id: 'anim-1',
    tracks: [
      { targetId: 'ik-1', property: 'targetX', keyframes: [{ time: 500, value: 300 }] },
      { targetId: 'ik-1', property: 'mix', keyframes: [{ time: 500, value: 0.5 }] },
    ],
  };

  it('returns raw constraint outside animation mode', () => {
    const result = resolveEffectiveInspectorTarget({
      selection: ['ik-1'],
      nodes: [],
      bones: [],
      constraints: [constraint],
      editorMode: 'design',
      activeBoneId: null,
      activeConstraintId: null,
      activeAnimation,
      currentTime: 500,
      draftPose: new Map(),
      loopKeyframes: false,
      fps: 24,
      endFrame: 48,
    });

    expect(result.mode).toBe('constraint');
    expect(result.target).toBe(constraint);
  });

  it('applies keyframe overrides to constraint in animation mode', () => {
    const result = resolveEffectiveInspectorTarget({
      selection: ['ik-1'],
      nodes: [],
      bones: [],
      constraints: [constraint],
      editorMode: 'animation',
      activeBoneId: null,
      activeConstraintId: null,
      activeAnimation,
      currentTime: 500,
      draftPose: new Map(),
      loopKeyframes: false,
      fps: 24,
      endFrame: 48,
    });

    expect(result.mode).toBe('constraint');
    expect(result.target.targetX).toBe(300);
    expect(result.target.mix).toBe(0.5);
    expect(result.target.targetY).toBe(200);
  });

  it('applies draft overrides on top of keyframe overrides', () => {
    const result = resolveEffectiveInspectorTarget({
      selection: ['ik-1'],
      nodes: [],
      bones: [],
      constraints: [constraint],
      editorMode: 'animation',
      activeBoneId: null,
      activeConstraintId: null,
      activeAnimation,
      currentTime: 500,
      draftPose: new Map([['ik-1', { targetX: 500 }]]),
      loopKeyframes: false,
      fps: 24,
      endFrame: 48,
    });

    expect(result.target.targetX).toBe(500);
    expect(result.target.mix).toBe(0.5);
  });
});

describe('normalizeInfluences', () => {
  it('normalizes weights and sorts descending', () => {
    const result = normalizeInfluences([
      [
        { boneId: 'a', weight: 4 },
        { boneId: 'b', weight: 1 },
        { boneId: 'c', weight: 3 },
        { boneId: 'd', weight: 2 },
        { boneId: 'neg', weight: -1 },
        { boneId: 'zero', weight: 0 },
      ],
    ]);

    expect(result[0]).toHaveLength(4);
    expect(result[0].map(item => item.boneId)).toEqual(['a', 'c', 'd', 'b']);
    expect(result[0][0].weight).toBeCloseTo(4 / 10);
    expect(result[0][1].weight).toBeCloseTo(3 / 10);
    expect(result[0][2].weight).toBeCloseTo(2 / 10);
    expect(result[0][3].weight).toBeCloseTo(1 / 10);
    expect(result[0].reduce((sum, item) => sum + item.weight, 0)).toBeCloseTo(1);
  });

  it('keeps only top four weights', () => {
    const result = normalizeInfluences([
      [
        { boneId: 'a', weight: 5 },
        { boneId: 'b', weight: 4 },
        { boneId: 'c', weight: 3 },
        { boneId: 'd', weight: 2 },
        { boneId: 'e', weight: 1 },
      ],
    ]);

    expect(result[0]).toHaveLength(4);
    expect(result[0].map(item => item.boneId)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns empty influences when all weights are non-positive', () => {
    expect(normalizeInfluences([
      [
        { boneId: 'a', weight: 0 },
        { boneId: 'b', weight: -2 },
      ],
    ])).toEqual([[]]);
  });
});
